import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { matchItemWithCatalog, normalizeForComparison } from './src/utils/productCatalog';

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

// Centralized Catalog file for real-time synchronization across PC & Mobile
const CATALOG_FILE_PATH = path.join(path.resolve(), 'data', 'catalog.json');

const INITIAL_CATALOG = [
  { id: 'cat-47', code: '47', name: 'Bloco Polidor', price: 3.0 },
  { id: 'cat-46', code: '46', name: 'Lixa mini canário pura arte com...', price: 7.7 },
  { id: 'cat-10', code: '10', name: 'Lixa moeda preta podóloga grão...', price: 6.93 },
  { id: 'cat-12', code: '12', name: 'Algodão prensado com 1000 unidades', price: 13.0 },
  { id: 'cat-14', code: '14', name: 'Algodão bola 95 g', price: 5.0 },
  { id: 'cat-23', code: '23', name: 'Rolo de Algodão 500 g', price: 20.0 },
  { id: 'cat-22', code: '22', name: 'Protetor de bacia plástica Manic...', price: 5.2 },
  { id: 'cat-56', code: '56', name: 'Protetor de bacia pedicure com 50 unidades', price: 11.5 },
  { id: 'cat-66', code: '66', name: 'Touca plástica descartável com...', price: 8.51 },
  { id: 'cat-17', code: '17', name: 'Cílios Mix 8 a 14', price: 30.0 },
  { id: 'cat-90', code: '90', name: 'Cílios Magina D-lash Naturals Knot-free flares 10 mm', price: 12.0 },
  { id: 'cat-34', code: '34', name: 'Cílios Postiços 7P-C 14mm', price: 11.0 },
  { id: 'cat-secante', code: '-', name: 'Secante rápido não oleoso com11 ml', price: 6.9 },
  { id: 'cat-boneca', code: '-', name: 'Colorama Boneca', price: 5.9 },
  { id: 'cat-bastao', code: '-', name: 'Bastão Inox c/ silicone ,Isis', price: 7.07 },
  { id: 'cat-palito', code: '-', name: 'Palito para depilação com 100 unidades', price: 7.5 },
];

function readServerCatalog(): any[] {
  try {
    if (fs.existsSync(CATALOG_FILE_PATH)) {
      const data = fs.readFileSync(CATALOG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Erro ao ler data/catalog.json:', err);
  }
  return INITIAL_CATALOG;
}

function writeServerCatalog(catalog: any[]): boolean {
  try {
    fs.mkdirSync(path.dirname(CATALOG_FILE_PATH), { recursive: true });
    fs.writeFileSync(CATALOG_FILE_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Erro ao escrever data/catalog.json:', err);
    return false;
  }
}

// API Route: Get shared catalog (synced across PC & Mobile)
app.get('/api/catalog', (req, res) => {
  const catalog = readServerCatalog();
  return res.json({ catalog });
});

// API Route: Update shared catalog (synced across PC & Mobile)
app.post('/api/catalog', (req, res) => {
  const { catalog } = req.body;
  if (!Array.isArray(catalog)) {
    return res.status(400).json({ error: 'O catálogo deve ser uma lista (array).' });
  }
  const ok = writeServerCatalog(catalog);
  if (ok) {
    return res.json({ success: true, count: catalog.length, catalog });
  } else {
    return res.status(500).json({ error: 'Falha ao salvar catálogo no servidor.' });
  }
});

// API Route: Reset shared catalog to initial defaults
app.post('/api/catalog/reset', (req, res) => {
  const ok = writeServerCatalog(INITIAL_CATALOG);
  if (ok) {
    return res.json({ success: true, catalog: INITIAL_CATALOG });
  } else {
    return res.status(500).json({ error: 'Falha ao restaurar catálogo.' });
  }
});

// API Route: AI OCR for invoices, quotes, receipts, and order screenshots
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType, catalog: customCatalog } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
    }

    const serverDb = readServerCatalog();
    const activeCatalog = Array.isArray(customCatalog) && customCatalog.length > 0 ? customCatalog : serverDb;
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

BANCO DE DADOS DE PRODUTOS PARA CONCILIAÇÃO:
${catalogSummary}

SUA MISSÃO:
- Extraia CADA PRODUTO de compra presente na imagem (descrição, quantidade e preço unitário).
- Preste atenção: carrinhos contêm múltiplos produtos (3, 5, 8 ou mais). Extraia TODOS os produtos da lista, de cima a baixo da tela!
- Use o BANCO DE DADOS acima para associar o código oficial (#47, #12, #56 ou '-') e o nome correto.

REGRA DE VALIDAÇÃO:
- NUNCA invente nem presuma produtos. Extraia APENAS E EXCLUSIVAMENTE os produtos com texto e imagem claramente VISÍVEIS na tela da imagem enviada.
- Se um produto do banco de dados NÃO estiver visível neste print específico, NUNCA o inclua no resultado!
- NUNCA crie produtos a partir de valores de preço soltos isolados (como "R$ 520").
- NUNCA crie produtos a partir de botões ou links de categorias (como "Mostrar tudo", "Ver tudo", "Ver carrinho", "Continuar comprando").

ATENÇÃO MÁXIMA AO SUBTOTAL / TOTAL DO CARRINHO:
- Se houver um valor de subtotal no rodapé da tela, NUNCA o atribua como preço de um item individual.
- Use a quantidade exibida no print (ex: "Quantidade: 1" -> 1).

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

    // Post-reconciliation against catalog - STRICT: SÓ INSERIR SE ESTIVER NO BANCO DE DADOS
    const reconciledItems: any[] = [];
    const seenCodes = new Set<string>();

    for (const it of (parsed.items || [])) {
      const desc = String(it.description || '').trim();
      const rawPrice = Number(it.unitPrice) || 0;
      const match = matchItemWithCatalog(desc, rawPrice, activeCatalog);
      
      if (match) {
        const isNoCode = !match.product.code || match.product.code === '-';
        const codeKey = isNoCode
          ? '-'
          : (match.product.code.startsWith('#') ? match.product.code : `#${match.product.code}`);
        
        // CRITICAL: Unique key for deduplication
        // If code is '-', deduplicate by product NAME so multiple items with code '-' are NOT dropped!
        const uniqueKey = isNoCode
          ? `name_${normalizeForComparison(match.product.name)}`
          : `code_${match.product.code.toLowerCase()}`;

        // Deduplicate rows if same product is extracted multiple times from same print
        if (seenCodes.has(uniqueKey)) {
          const existing = reconciledItems.find((r) =>
            isNoCode
              ? normalizeForComparison(r.description) === normalizeForComparison(match.product.name)
              : r.code === codeKey
          );
          if (existing && it.quantity && Number(it.quantity) > existing.quantity) {
            existing.quantity = Number(it.quantity);
            existing.total = existing.quantity * existing.unitPrice;
          }
          continue;
        }

        const q = Number(it.quantity) && Number(it.quantity) > 0 ? Number(it.quantity) : 1;
        // ALWAYS USE OFFICIAL CATALOG PRICE as truth (prevents cart total 17.63 from overwriting unit price 3.00)
        const p = Number(match.product.price) > 0 ? Number(match.product.price) : rawPrice;

        reconciledItems.push({
          code: codeKey,
          description: match.product.name,
          quantity: q,
          unitPrice: p,
          total: q * p,
        });
        seenCodes.add(uniqueKey);
      }
      // If it did NOT match the catalog (e.g. "R$ 520", "Cilios Mostrar tudo", etc.):
      // DO NOT INSERT! Strictly filter out non-database items as requested by user.
    }

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
