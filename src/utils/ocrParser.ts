import { LineItem } from '../types';

export interface ParsedOCRResult {
  orderNumber?: string;
  orderDate?: string;
  customerName?: string;
  items: LineItem[];
  rawText: string;
}

export function parseOCRText(rawText: string): ParsedOCRResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const result: ParsedOCRResult = {
    items: [],
    rawText,
  };

  // 1. Order Number Detection
  const orderRegexes = [
    /(?:order|so|pedido|invoice|fatura|po|n[ºo°])[\s#:.-]*([a-z0-9\-_/]+)/i,
    /(?:so|po|inv|ped)-[0-9]{3,6}/i,
    /#([0-9]{3,8})/
  ];

  for (const regex of orderRegexes) {
    const match = rawText.match(regex);
    if (match && match[1]) {
      result.orderNumber = match[1].replace(/[^a-zA-Z0-9\-_]/g, '').toUpperCase();
      break;
    } else if (match && match[0]) {
      result.orderNumber = match[0].toUpperCase();
      break;
    }
  }

  // 2. Date Detection
  const dateRegex = /(?:date|data)[\s:]*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4})/i;
  const dateMatch = rawText.match(dateRegex);
  if (dateMatch && dateMatch[1]) {
    const rawDate = dateMatch[1];
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      result.orderDate = rawDate;
    } else {
      const parts = rawDate.split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          result.orderDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          result.orderDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
  }

  // 3. Customer name heuristic
  const custRegex = /(?:cliente|customer|bill to|destinat[aá]rio|para)[\s:]*([^\n\r]+)/i;
  const custMatch = rawText.match(custRegex);
  if (custMatch && custMatch[1]) {
    const name = custMatch[1].trim();
    if (name.length > 2 && name.length < 50) {
      result.customerName = name;
    }
  }

  // 4. Line Items Detection
  const items: LineItem[] = [];

  const ignoredKeywords = [
    'subtotal', 'total amount', 'grand total', 'valor total', 'impostos',
    'tax id', 'cnpj', 'cpf', 'date', 'data', 'order', 'pedido', 'invoice',
    'telefone', 'phone', 'email', 'rua', 'avenida', 'observa', 'page',
    'assina', 'signature', 'obrigado', 'volte sempre', 'cupom fiscal',
    'via do cliente', 'forma de pagamento', 'dinheiro', 'cartao', 'cartão',
    'debito', 'credito', 'troco', 'itens', 'produtos', 'quantidade', 'preco',
    'unidade', 'descricao', 'descrição'
  ];

  // Helper to check if a line is a header or metadata line
  const isIgnoredLine = (line: string): boolean => {
    const lower = line.toLowerCase().trim();
    if (lower.length < 3) return true;
    if (/^[0-9\s.,\-_/:()]+$/.test(lower)) return true; // only numbers and symbols
    return ignoredKeywords.some((kw) => lower.startsWith(kw) || lower === kw);
  };

  const candidateLines = lines.filter((l) => !isIgnoredLine(l));

  candidateLines.forEach((line, idx) => {
    const cleanLine = line.replace(/^[•\-\*#>\d\.\)\s]+/, '').trim();
    if (cleanLine.length < 3) return;

    // Pattern A: Line has price with comma or dot (e.g. "Top coat incolor 1x 25,00" or "Base bomba R$ 18.50" or "Removedor acetona 12,90")
    const priceRegex = /(?:R\$|\$|€|£)?\s*([0-9]{1,5}[.,][0-9]{2})/i;
    const priceMatch = cleanLine.match(priceRegex);

    // Quantity pattern (e.g. "2x", "2 un", "qtd: 2", or isolated integer)
    const qtyRegex = /(?:qtd|quant|quantidade)?[\s:]*([0-9]{1,3})\s*(?:x|un|und|cx|pc|pçs)?\b/i;
    const qtyMatch = cleanLine.match(qtyRegex);

    if (priceMatch) {
      const priceVal = parseFloat(priceMatch[1].replace(',', '.'));
      // Remove price string from description
      let desc = cleanLine.replace(priceMatch[0], '').trim();

      let quantity = 1;
      if (qtyMatch && qtyMatch[1]) {
        const parsedQty = parseInt(qtyMatch[1], 10);
        if (parsedQty > 0 && parsedQty < 500) {
          quantity = parsedQty;
          desc = desc.replace(qtyMatch[0], '').trim();
        }
      }

      // Clean up description
      desc = desc.replace(/[–—\-:;,]+$/, '').replace(/^[–—\-:;,]+/, '').trim();

      if (desc.length >= 2 && !isNaN(priceVal)) {
        items.push({
          id: `item-ocr-${Date.now()}-${idx}`,
          code: `SKU-${1000 + idx}`,
          description: desc,
          quantity,
          unitPrice: priceVal,
          total: quantity * priceVal,
        });
        return;
      }
    }

    // Pattern B: Line looks like a pure product or service name (e.g. "Top coat incolor", "Base bomba", "Removedor a base de acetona")
    // When text is detected without price, we still add it so the user can easily fill in the price!
    if (cleanLine.length >= 3 && cleanLine.length <= 80) {
      // Check if it's not a common sentence
      const lower = cleanLine.toLowerCase();
      if (!lower.includes('atendimento') && !lower.includes('sac') && !lower.includes('garantia')) {
        items.push({
          id: `item-ocr-${Date.now()}-${idx}`,
          code: `SKU-${1000 + idx}`,
          description: cleanLine,
          quantity: 1,
          unitPrice: 0.0,
          total: 0.0,
        });
      }
    }
  });

  result.items = items;
  return result;
}
