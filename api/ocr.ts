import { GoogleGenAI, Type } from '@google/genai';
import { matchItemWithCatalog } from '../src/utils/productCatalog';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType, catalog: customCatalog } = req.body || {};
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

    const cleanBase64 = imageBase64
      .replace(/^data:[^;]+;base64,/i, '')
      .replace(/\s+/g, '');

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

    const promptText = `Você é um especialista de altíssima precisão em OCR visual e extração estruturada de produtos a partir de prints de tela de celular e carrinhos do WhatsApp.

BANCO DE DADOS OFICIAL DE PRODUTOS PARA CONCILIAÇÃO:
${catalogSummary}

REGRA CRÍTICA DE OURO - SÓ RETORNAR ITENS QUE ESTÃO NO BANCO DE DADOS:
- Retorne EXCLUSIVAMENTE produtos que correspondam a produtos do BANCO DE DADOS OFICIAL acima.
- NUNCA crie produtos a partir de valores de preço soltos (como "R$ 520", "5,20", "11,50").
- NUNCA crie produtos a partir de botões ou links de categorias (como "Mostrar tudo", "Cílios Mostrar tudo", "Ver tudo", "Ver carrinho").
- Se algo não for um produto do banco de dados, DESCARTE-O e NÃO o inclua na lista.

ATENÇÃO MÁXIMA AO SUBTOTAL / TOTAL DO CARRINHO (Ex: "R$ 17,63"):
- O valor no rodapé da tela ou resumo (ex: "Total: R$ 17,63", "Subtotal: R$ 17,63") é a SOMA dos produtos, NUNCA o preço de um item individual!
- NUNCA atribua o valor do Subtotal (17,63) a nenhum produto como o Bloco Polidor.
- O preço de tabela do Bloco Polidor no Banco de Dados é SEMPRE R$ 3,00.
- O preço da Lixa mini canário é SEMPRE R$ 7,70.
- O preço da Lixa moeda preta é SEMPRE R$ 6,93.
- Use SEMPRE o preço unitário oficial de cada produto indicado no Banco de Dados acima.

REGRA PARA NOMES TRUNCADOS / RETICÊNCIAS ("..."):
- Os prints de celulares e WhatsApp frequentemente CORTAM os nomes dos produtos com "..." (exemplo: "Lixa mini canário pur..." ou "Lixa moeda preta po...").
- Sempre que a imagem contiver um item cujo texto bate com o início ou palavras de um produto do BANCO DE DADOS acima, use:
  1. "code": O código oficial do produto (ex: "#47", "#46", "#10", "#22", "#56").
  2. "description": O nome COMPLETO oficial do banco de dados (ex: "Bloco Polidor", "Lixa mini canário pura arte com...", "Lixa moeda preta podóloga grão...", "Protetor de bacia pedicure com...").
  3. "unitPrice": O valor unitário oficial daquele produto no banco de dados (ex: 3.00, 7.70, 6.93, 11.50).
  4. "quantity": A quantidade informada no print (ex: 1, 2, etc.). Padrão 1.
  5. "total": quantity * unitPrice.

FILTROS DE RUÍDO:
- NUNCA inclua cabeçalhos, botões ("Continuar comprando", "Subtotal", "Ver carrinho"), relógio ou status do celular.
- Extraia cada produto único presente no carrinho.

Retorne estritamente em JSON compatível com o schema definido.`;

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let response: any;
    let lastError: any;

    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout no modelo ${modelName}`)), 9000)
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
              { text: promptText },
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

    if (!response?.text) {
      throw lastError || new Error('Falha ao processar com modelos Gemini');
    }

    const parsed = JSON.parse(response.text);

    // Post-reconciliation against catalog - STRICT: SÓ INSERIR SE ESTIVER NO BANCO DE DADOS
    const reconciledItems: any[] = [];
    const seenCodes = new Set<string>();

    for (const it of (parsed.items || [])) {
      const desc = String(it.description || '').trim();
      const rawPrice = Number(it.unitPrice) || 0;
      const match = matchItemWithCatalog(desc, rawPrice, activeCatalog);

      if (match) {
        const codeKey = `#${match.product.code}`;
        
        // Deduplicate rows if same product is extracted multiple times
        if (seenCodes.has(codeKey)) {
          const existing = reconciledItems.find((r) => r.code === codeKey);
          if (existing && it.quantity && Number(it.quantity) > existing.quantity) {
            existing.quantity = Number(it.quantity);
            existing.total = existing.quantity * existing.unitPrice;
          }
          continue;
        }

        const q = Number(it.quantity) && Number(it.quantity) > 0 ? Number(it.quantity) : 1;
        // ALWAYS PREFER OFFICIAL CATALOG PRICE
        const p = Number(match.product.price) > 0 ? Number(match.product.price) : rawPrice;

        reconciledItems.push({
          code: codeKey,
          description: match.product.name,
          quantity: q,
          unitPrice: p,
          total: q * p,
        });
        seenCodes.add(codeKey);
      }
      // If it did NOT match the catalog (e.g. "R$ 520", "Cilios Mostrar tudo"):
      // DO NOT INSERT! Strictly filter out non-database items as requested by user.
    }

    parsed.items = reconciledItems;
    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error('Erro na rota /api/ocr:', error);
    return res.status(500).json({ error: error.message || 'Erro no OCR com IA' });
  }
}
