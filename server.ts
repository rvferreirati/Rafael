import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Allow body payloads up to 30mb for high-res screenshots
app.use(express.json({ limit: '30mb' }));

// Server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Route: AI OCR for invoices, quotes, receipts, and order screenshots
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
    }

    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9\/\-+.]+;base64,/, '');

    let response: any;
    let lastError: any;
    // Prioritize ultra-fast flash-lite for sub-second OCR speed
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: `Você é um especialista de altíssima precisão em OCR visual e extração estruturada de itens para pedidos e faturas a partir de prints de smartphones, telas de e-commerce e principalmente telas e mensagens do WHATSAPP.

OBJETIVO PRINCIPAL:
Extrair a lista COMPLETA de PRODUTOS REAIS presentes na imagem (itens do carrinho, itens do pedido ou tabela de produtos).

RECONHECIMENTO ESPECIAL DE TELAS DO WHATSAPP:
1. CARTÃO DE PEDIDO NO CHAT DO WHATSAPP ("🛍️ Pedido • X itens", "Ver carrinho", lista prévia):
   - Frequentemente exibe os produtos logo abaixo do título do pedido, como:
     "1x Top coat incolor"
     "2x Base bomba"
     "1x Removedor a base de acetona"
   - Extraia TODOS os produtos listados no cartão.

2. TELA DE CARRINHO / DETALHES DO PEDIDO NO WHATSAPP:
   - Exibe a lista com miniatura, Nome do Produto, Valor unitário (ex: "R$ 15,00" ou "15,00") e seletor de Quantidade (botões "[-] 1 [+]" ou badge "1x", "2x", "Qtd: 1").
   - Extraia com máxima fidelidade o nome do produto, quantidade e valor.

3. RECONHECIMENTO DE CÓDIGOS E IDENTIFICADORES:
   - Se houver códigos, números ou marcadores na frente do item (ex: "#01", "#1", "COD: 101", "COD 01", "SKU-101", "1.", "2.", "[1]"):
     * Preencha o campo "code" com este identificador exato.
   - Se não houver código explícito, crie um código limpo sequencial como "PROD-01", "PROD-02", "PROD-03".

4. ATRIBUTOS DE CADA ITEM:
   - "description": Nome limpo e claro do produto (ex: "Top coat incolor", "Base bomba", "Removedor a base de acetona"). NUNCA inclua palavras de botões ou de interface como "Ver carrinho", "Toque para ver", "Remover", "un", "x", "R$".
   - "quantity": Quantidade inteira de unidades compradas (ex: 1, 2, 3). Padrão = 1 se não especificado.
   - "unitPrice": Preço unitário numérico decimal (ex: 15.00, 18.50).
   - "total": Valor total daquele produto (quantity * unitPrice).

5. FILTRAGEM RIGOROSA DE RUÍDOS DE INTERFACE (NÃO SÃO PRODUTOS):
   - NUNCA crie produtos a partir de botões ou textos do WhatsApp: "Pedido", "Ver carrinho", "Toque para ver os itens", "Continuar comprando", "Subtotal", "Total estimado", "Enviar mensagem", "Fazer pedido", "Editar", "Remover", "Excluir".
   - NUNCA inclua relógio/hora (ex: "14:32"), porcentagem de bateria ("90%"), ícones ("✓✓"), status ("Online", "Digitando...") ou cabeçalhos do celular.
   - Retorne APENAS itens que sejam mercadorias/produtos físicos vendidos.

6. DADOS GERAIS DO PEDIDO (SE VISÍVEIS):
   - "orderNumber": Número do pedido se constar no print (ex: "#1023", "PED-12").
   - "customerName": Nome do cliente se visível no topo da tela ou conversa.
   - "orderDate": Data se visível.

Retorne estritamente em JSON compatível com o schema definido.`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                orderNumber: { type: Type.STRING },
                orderDate: { type: Type.STRING },
                customerName: { type: Type.STRING },
                customerTaxId: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      code: { type: Type.STRING },
                      description: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unitPrice: { type: Type.NUMBER },
                      total: { type: Type.NUMBER },
                    },
                    required: ['description', 'quantity', 'unitPrice'],
                  },
                },
              },
              required: ['items'],
            },
          },
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} falhou:`, err?.message || err);
      }
    }

    if (!response) {
      throw lastError || new Error('Falha ao processar OCR com IA após tentativas');
    }

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Erro na API OCR Gemini:', error);
    return res.status(500).json({
      error: error.message || 'Falha ao processar OCR com IA',
    });
  }
});

// In-memory store for WhatsApp orders received via Meta Cloud API Webhook
interface WhatsAppReceivedOrder {
  id: string;
  receivedAt: string;
  senderPhone: string;
  senderName: string;
  catalogId?: string;
  items: {
    retailerId: string;
    quantity: number;
    itemPrice: number;
    currency: string;
  }[];
  notes?: string;
  rawPayload: any;
}

const receivedWhatsAppOrders: WhatsAppReceivedOrder[] = [];

// Meta WhatsApp Webhook Verification Endpoint (GET)
app.get('/api/whatsapp-webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'artex7_whatsapp_token';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp Webhook] Webhook verificado com sucesso pela Meta');
    return res.status(200).send(challenge);
  } else {
    return res.status(403).json({ error: 'Token de verificação inválido' });
  }
});

// Meta WhatsApp Webhook Event Receiver (POST)
app.post('/api/whatsapp-webhook', (req, res) => {
  try {
    const body = req.body;

    // Check if it's a WhatsApp Business Account message event
    if (body.object === 'whatsapp_business_account' || body.entry) {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value?.messages) {
            for (const msg of value.messages) {
              // 1. Order from WhatsApp Cart
              if (msg.type === 'order' && msg.order) {
                const contact = value.contacts?.find((c: any) => c.wa_id === msg.from) || value.contacts?.[0];
                const newOrder: WhatsAppReceivedOrder = {
                  id: msg.id || `wa-${Date.now()}`,
                  receivedAt: new Date().toISOString(),
                  senderPhone: msg.from || '',
                  senderName: contact?.profile?.name || 'Cliente WhatsApp',
                  catalogId: msg.order.catalog_id,
                  items: (msg.order.product_items || []).map((it: any) => ({
                    retailerId: it.product_retailer_id || '',
                    quantity: Number(it.quantity) || 1,
                    itemPrice: Number(it.item_price) || 0,
                    currency: it.currency || 'BRL',
                  })),
                  notes: msg.order.text || '',
                  rawPayload: msg,
                };
                receivedWhatsAppOrders.unshift(newOrder);
                console.log(`[WhatsApp Webhook] Pedido de carrinho recebido de ${newOrder.senderName}:`, newOrder);
              }
            }
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }

    return res.status(200).json({ status: 'ignored' });
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Erro ao processar webhook:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint to list WhatsApp orders received via webhook
app.get('/api/whatsapp-orders', (_req, res) => {
  return res.json({
    orders: receivedWhatsAppOrders,
    count: receivedWhatsAppOrders.length,
    webhookUrl: '/api/whatsapp-webhook',
  });
});


async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SalesOrder Pro server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
