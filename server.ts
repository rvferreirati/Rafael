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
    const { imageBase64, mimeType, catalog: customCatalog } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
    }

    const defaultDb = [
      { code: '47', name: 'Bloco Polidor', price: 3.0 },
      { code: '46', name: 'Lixa mini canário pura arte com...', price: 7.7 },
      { code: '10', name: 'Lixa moeda preta podóloga grão...', price: 6.93 },
      { code: '12', name: 'Algodão prensado com 1000 unidades', price: 13.0 },
      { code: '14', name: 'Algodão bola 95 g', price: 5.0 },
      { code: '23', name: 'Rolo de Algodão 500 g', price: 20.0 },
      { code: '22', name: 'Protetor de bacia plástica Manic...', price: 5.2 },
      { code: '56', name: 'Protetor de bacia pedicure com...', price: 11.5 },
      { code: '66', name: 'Touca plástica descartável com...', price: 8.51 },
      { code: '17', name: 'Cílios Mix 8 a 14', price: 30.0 },
      { code: '90', name: 'Cílios Magna D-lash Naturals Kn...', price: 12.0 },
      { code: '34', name: 'Cílios Postiços 7P-C 14mm', price: 11.0 },
    ];
    const activeCatalog = Array.isArray(customCatalog) && customCatalog.length > 0 ? customCatalog : defaultDb;
    const catalogSummary = activeCatalog
      .map((p: any) => `- Código #${p.code}: "${p.name}" (Preço tabela: R$ ${Number(p.price).toFixed(2)})`)
      .join('\n');

    // Strip header and any whitespace/newlines produced by mobile FileReader
    const cleanBase64 = imageBase64
      .replace(/^data:[^;]+;base64,/i, '')
      .replace(/\s+/g, '');

    if (!cleanBase64) {
      return res.status(400).json({ error: 'Dados de imagem vazios ou corrompidos' });
    }

    // Normalize MIME type for Gemini
    let effectiveMime = mimeType || 'image/jpeg';
    const headerMatch = imageBase64.match(/^data:([^;]+);base64,/i);
    if (headerMatch && headerMatch[1]) {
      const rawMime = headerMatch[1].toLowerCase().trim();
      if (rawMime === 'image/jpg' || rawMime === 'image/jpeg') {
        effectiveMime = 'image/jpeg';
      } else if (rawMime === 'image/png') {
        effectiveMime = 'image/png';
      } else if (rawMime === 'image/webp') {
        effectiveMime = 'image/webp';
      } else if (rawMime === 'application/pdf') {
        effectiveMime = 'application/pdf';
      } else {
        effectiveMime = 'image/jpeg';
      }
    }

    let response: any;
    let lastError: any;
    // Prioritize ultra-fast flash-lite for sub-second OCR speed
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

    const promptText = `Você é um especialista de altíssima precisão em OCR visual e extração estruturada de produtos a partir de prints de tela de celular e carrinhos do WhatsApp.

BANCO DE DADOS OFICIAL DE PRODUTOS PARA CONCILIAÇÃO:
${catalogSummary}

REGRA DE OURO PARA NOMES TRUNCADOS / RETICÊNCIAS ("..."):
- Os prints de celulares e WhatsApp frequentemente CORTAM os nomes dos produtos com "..." (exemplo: "Lixa mini canário pur..." ou "Lixa moeda preta po...").
- Sempre que a imagem contiver um item cujo texto bate com o início ou palavras de um produto do BANCO DE DADOS acima, use:
  1. "code": O código oficial do produto (ex: "#47", "#46", "#10").
  2. "description": O nome COMPLETO oficial do banco de dados (ex: "Bloco Polidor", "Lixa mini canário pura arte com...", "Lixa moeda preta podóloga grão...").
  3. "unitPrice": O valor unitário do item (ex: 3.00, 7.70, 6.93).
  4. "quantity": A quantidade informada no print (ex: 1, 2, etc.). Padrão 1.
  5. "total": quantity * unitPrice.

FILTROS DE RUÍDO:
- NUNCA inclua cabeçalhos, botões ("Continuar comprando", "Subtotal", "Ver carrinho"), relógio ou status do celular.
- Extraia TODOS os produtos visíveis no carrinho.

Retorne estritamente em JSON compatível com o schema definido.`;

    for (const modelName of candidateModels) {
      try {
        // Enforce 8.5s timeout per candidate model
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout no modelo ${modelName}`)), 8500)
        );

        const apiPromise = ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: effectiveMime,
                  data: cleanBase64,
                },
              },
              {
                text: promptText,
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

        response = await Promise.race([apiPromise, timeoutPromise]);
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} falhou:`, err?.message || err);
      }
    }

    let parsed: any = { items: [] };

    if (response?.text) {
      try {
        parsed = JSON.parse(response.text);
      } catch (e) {
        console.warn('Erro ao decodificar JSON do Gemini, usando fallback:', e);
      }
    }

    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      console.log('[OCR] Nenhum item detectado pelo modelo.');
      return res.json({ items: [], message: 'Nenhum produto detectado na imagem.' });
    }

    // Post-reconciliation against catalog
    const reconciledItems = (parsed.items || []).map((it: any) => {
      const desc = String(it.description || '').trim();
      const normDesc = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      const matched = activeCatalog.find((catItem: any) => {
        const catNorm = catItem.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\.{2,}/g, '').trim();
        // Check code match
        if (it.code && (it.code === catItem.code || it.code === `#${catItem.code}`)) return true;
        // Check name start or inclusion
        if (normDesc.startsWith(catNorm) || catNorm.startsWith(normDesc)) return true;
        // Check key word matching (e.g. "bloco polidor", "lixa mini canario", "lixa moeda preta")
        const keyWords = catNorm.split(' ').filter((w: string) => w.length >= 4);
        return keyWords.length > 0 && keyWords.every((kw: string) => normDesc.includes(kw));
      });

      if (matched) {
        const q = Number(it.quantity) || 1;
        const p = Number(it.unitPrice) > 0 ? Number(it.unitPrice) : Number(matched.price);
        return {
          code: `#${matched.code}`,
          description: matched.name,
          quantity: q,
          unitPrice: p,
          total: q * p,
        };
      }
      return it;
    });

    parsed.items = reconciledItems;
    return res.json(parsed);
  } catch (error: any) {
    console.error('Erro na API OCR Gemini:', error);
    return res.status(500).json({
      error: error.message || 'Falha ao processar OCR com IA',
      items: [],
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
