import { LineItem } from '../types';
import { reconcileItemsWithCatalog } from './productCatalog';

export interface ParsedOCRResult {
  orderNumber?: string;
  orderDate?: string;
  customerName?: string;
  items: LineItem[];
  rawText: string;
}

export function parseOCRText(rawText: string): ParsedOCRResult {
  const originalLines = rawText
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
    if (name.length > 2 && name.length < 50 && !/continuar|subtotal|comprar/i.test(name)) {
      result.customerName = name;
    }
  }

  // 4. Boundary Enforcement (only trim if markers are found appropriately):
  let lines = [...originalLines];

  // A. Find "Continuar comprando" start marker
  const startIndex = lines.findIndex((l) =>
    /(?:continuar\s+comprando|voltar\s+a(?:s|o)\s+compras|itens\s+no\s+carrinho|meu\s+carrinho)/i.test(l)
  );

  if (startIndex !== -1 && startIndex < lines.length - 1) {
    // Only keep lines strictly AFTER "continuar comprando"
    lines = lines.slice(startIndex + 1);
  }

  // B. Find "Subtotal" end marker (only if it appears after some potential items, not at the very top)
  const endIndex = lines.findIndex((l, idx) =>
    idx > 0 && /(?:^|\b)(?:sub[\s-]?total|total\s+dos\s+produtos|calcular\s+frete|entrega\s+e\s+frete|forma\s+de\s+pagamento|ir\s+para\s+o\s+pagamento|finalizar\s+compra|cupom\s+de\s+desconto)(?:\b|$)/i.test(l)
  );

  if (endIndex !== -1 && endIndex > 0) {
    // Only keep lines strictly BEFORE "subtotal"
    lines = lines.slice(0, endIndex);
  }

  // =========================================================================
  // 5. Code & Prefix Detection Helper
  // =========================================================================
  const extractCodePrefix = (raw: string): { code?: string; cleaned: string } => {
    // 1. #01, #101, #1
    const hashMatch = raw.match(/^#([0-9]{1,6})\b[:\s-]*/);
    if (hashMatch) {
      return {
        code: `#${hashMatch[1]}`,
        cleaned: raw.slice(hashMatch[0].length).trim(),
      };
    }

    // 2. COD: 01, CÓD 101, CODIGO 10, SKU-101, REF: 202
    const codMatch = raw.match(/^(?:c[óo]d(?:igo)?|sku|ref(?:er[êe]ncia)?)[\s.:#-]*([a-z0-9\-_]+)[:\s-]*/i);
    if (codMatch) {
      return {
        code: codMatch[1].toUpperCase(),
        cleaned: raw.slice(codMatch[0].length).trim(),
      };
    }

    // 3. [01], [SKU-10]
    const bracketMatch = raw.match(/^\[([a-z0-9\-_]+)\][\s:-]*/i);
    if (bracketMatch) {
      return {
        code: bracketMatch[1].toUpperCase(),
        cleaned: raw.slice(bracketMatch[0].length).trim(),
      };
    }

    // 4. Numbered list: "1. ", "01) ", "2 - "
    const numMatch = raw.match(/^(\d{1,3})[\.\)\-]\s+/);
    if (numMatch) {
      return {
        code: numMatch[1],
        cleaned: raw.slice(numMatch[0].length).trim(),
      };
    }

    return { cleaned: raw };
  };

  // =========================================================================
  // 6. Noise & UI Words Filter (Ignore anything that does NOT make sense as product)
  // =========================================================================
  const uiNoiseRegex = /^(?:remover|excluir|salvar|salvar\s+para\s+depois|favoritar|editar|alterar|ver\s+mais|comprar|adicionar|diminuir|aumentar|dispon[ií]vel|em\s+estoque|esgotado|frete|frete\s+gr[aá]tis|vendido\s+por|entregue\s+por|prazo|receba\s+em|qtd|quantidade|unidade|unidades|\d+\s*un|carrinho|sacola|voltar|pesquisar|buscar|menu|notifica[çc][õo]es|compartilhar|detalhes|marca|cor|tamanho|voltagem|volts|garantia|troca)$/i;

  const isNonsenseOrNoise = (text: string): boolean => {
    const clean = text.toLowerCase().trim();
    if (clean.length < 2) return true; // Single character
    if (/^[0-9\s.,\-_/:()#*+]+$/.test(clean)) return true; // Only digits & symbols
    if (/^(?:vivo|claro|tim|oi|4g|5g|wifi|wi-fi|lte)$/i.test(clean)) return true;
    if (/^(?:[01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(clean)) return true; // Clock
    if (/^[0-9]{1,3}%$/.test(clean)) return true; // Battery or percent
    if (uiNoiseRegex.test(clean)) return true;
    if (clean.includes('continuar comprando') || clean.includes('subtotal')) return true;
    return false;
  };

  const validLines = lines.filter((l) => !isNonsenseOrNoise(l));

  // =========================================================================
  // 7. Extraction & Association of Products with Quantities and Prices
  // =========================================================================
  const priceRegex = /(?:R\$|\$|€|£)?\s*([0-9]{1,5}[.,][0-9]{2})/i;
  // Strict quantity regex that NEVER matches decimals inside prices (e.g. 6 in 6,93)
  const qtyRegex = /(?:(?:qtd|quant|quantidade)[\s.:]*([0-9]{1,3})\b)|(?:([0-9]{1,3})\s*(?:x|un|und|cx|pc|pçs)\b)/i;

  const cleanDesc = (text: string): string => {
    let s = text.replace(/^[\s.·=~–—\-:;,•\*]+/, '');
    s = s.replace(/^(?:X|BI|Bl)\s+(?!oco)/i, '');
    s = s.replace(/[\s.·=~–—\-:;,•\*]+$/, '');
    s = s.replace(/\b(?:TE|ESTO|pur|po)\b/gi, '');
    s = s.replace(/\bquantidade[\s.:]*\d+/gi, '');
    return s.replace(/\s+/g, ' ').trim();
  };

  const items: LineItem[] = [];
  let pendingPrice: number | null = null;
  let pendingProduct: LineItem | null = null;

  for (let i = 0; i < validLines.length; i++) {
    const rawLine = validLines[i].trim();
    if (isNonsenseOrNoise(rawLine)) continue;

    // Check for explicit code prefix (#01, COD, 1.)
    const { code: detectedCode, cleaned } = extractCodePrefix(rawLine);
    let line = cleaned.trim();
    if (isNonsenseOrNoise(line)) continue;

    const priceMatch = line.match(priceRegex);
    const qtyMatch = line.match(qtyRegex);

    if (priceMatch) {
      const priceVal = parseFloat(priceMatch[1].replace(',', '.'));
      const textWithoutPrice = line.replace(priceMatch[0], '').trim();
      const desc = cleanDesc(textWithoutPrice);
      const isPurePrice = desc.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').length < 3;

      if (isPurePrice) {
        if (pendingProduct) {
          pendingProduct.unitPrice = priceVal;
          pendingProduct.total = pendingProduct.quantity * priceVal;
          items.push(pendingProduct);
          pendingProduct = null;
        } else if (items.length > 0 && items[items.length - 1].unitPrice === 0) {
          items[items.length - 1].unitPrice = priceVal;
          items[items.length - 1].total = items[items.length - 1].quantity * priceVal;
        } else {
          pendingPrice = priceVal;
        }
        continue;
      }

      let quantity = 1;
      if (qtyMatch) {
        const q = parseInt(qtyMatch[1] || qtyMatch[2], 10);
        if (q > 0 && q < 500) quantity = q;
      }

      const item: LineItem = {
        id: `item-${Date.now()}-${items.length}`,
        code: detectedCode || `SKU-${101 + items.length}`,
        description: desc,
        quantity,
        unitPrice: priceVal,
        total: quantity * priceVal,
      };
      items.push(item);
      pendingPrice = null;
      continue;
    }

    // Line without price:
    // Check if it's a continuation of the previous item (e.g. "ão preta po quantidade: 1")
    if (line.match(/^(?:ão|da|de|do|pur|po|para|com|em|preta)\b/i) || line.match(/quantidade[\s.:]*\d+/i)) {
      if (qtyMatch && items.length > 0) {
        const q = parseInt(qtyMatch[1] || qtyMatch[2], 10);
        if (q > 0) {
          items[items.length - 1].quantity = q;
          items[items.length - 1].total = q * items[items.length - 1].unitPrice;
        }
      }
      continue;
    }

    const desc = cleanDesc(line);
    if (desc.length >= 2 && !isNonsenseOrNoise(desc)) {
      const item: LineItem = {
        id: `item-${Date.now()}-${items.length}`,
        code: detectedCode || `SKU-${101 + items.length}`,
        description: desc,
        quantity: 1,
        unitPrice: pendingPrice || 0,
        total: (pendingPrice || 0) * 1,
      };
      pendingPrice = null;

      if (item.unitPrice > 0) {
        items.push(item);
      } else {
        if (pendingProduct) items.push(pendingProduct);
        pendingProduct = item;
      }
    }
  }

  if (pendingProduct) items.push(pendingProduct);

  result.items = reconcileItemsWithCatalog(items);
  return result;
}
