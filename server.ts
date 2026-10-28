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
    const candidateModels = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.6-flash'];

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
                text: `Você é um especialista em OCR e extração estruturada de itens para pedidos de venda.
IMPORTANTE: A imagem pode ser uma captura de tela (print) de celular ou aplicativo.
FOQUE EXCLUSIVAMENTE nos itens e produtos que estão NO MEIO DA TELA (área de conteúdo principal).
Ignore completamente elementos de interface do smartphone como:
- Barra de status superior (horário, bateria, Wi-Fi, 4G, 5G, ícones do sistema)
- Cabeçalhos de topo de aplicativos (botão voltar, campo de pesquisa, títulos de tela)
- Barras de navegação inferior e botões de ação ("Comprar", "Finalizar", "Adicionar ao carrinho", "Ver sacola")

Extraia apenas os produtos reais no meio da tela (ex: "Top coat incolor", "Base bomba", "Removedor a base de acetona"):
1. "orderNumber": Número do pedido ou fatura se houver.
2. "orderDate": Data de emissão no formato YYYY-MM-DD se houver.
3. "customerName": Nome do cliente ou destinatário se houver.
4. "customerTaxId": CNPJ ou CPF se houver.
5. "items": Lista dos produtos encontrados no meio da tela.
   Para cada item:
   - "code": Código SKU
   - "description": Nome limpo e claro do produto
   - "quantity": Quantidade inteira ou decimal (padrão 1)
   - "unitPrice": Preço unitário numérico (ex: 15.00)
   - "total": Valor total do item (quantity * unitPrice)

Retorne a resposta estritamente em JSON compatível com o schema definido.`,
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
