export interface CatalogProduct {
  code: string;
  name: string;
  price: number;
}

export const STORAGE_KEY_CATALOG = 'artex7_product_catalog_v1';

// Seeded with the user's official database from fdg_48c9d622.txt
export const DEFAULT_CATALOG: CatalogProduct[] = [
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

export function loadStoredCatalog(): CatalogProduct[] {
  if (typeof window === 'undefined') return DEFAULT_CATALOG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATALOG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar catálogo salvo:', err);
  }
  return DEFAULT_CATALOG;
}

export function saveStoredCatalog(catalog: CatalogProduct[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(catalog));
  } catch (err) {
    console.warn('Erro ao salvar catálogo no localStorage:', err);
  }
}

/**
 * Parses user-pasted text (TSV, CSV, or formatted lines like "47 - Bloco Polidor - R$ 3,00")
 */
export function parseCatalogText(text: string): CatalogProduct[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: CatalogProduct[] = [];

  for (const line of lines) {
    // Skip header line if it looks like "Código Description Preço"
    if (/c[óo]digo.*descri/i.test(line)) continue;

    // 1. Try Tab-separated
    if (line.includes('\t')) {
      const parts = line.split('\t').map((p) => p.trim());
      if (parts.length >= 2) {
        const code = parts[0].replace(/^#/, '');
        const name = parts[1];
        const rawPrice = parts[2] || '0';
        const price = parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
        if (name) {
          results.push({ code, name, price });
          continue;
        }
      }
    }

    // 2. Try Semicolon or comma separated
    if (line.includes(';') || (line.includes(',') && !line.includes('R$'))) {
      const sep = line.includes(';') ? ';' : ',';
      const parts = line.split(sep).map((p) => p.trim());
      if (parts.length >= 2) {
        const code = parts[0].replace(/^#/, '');
        const name = parts[1];
        const rawPrice = parts[2] || '0';
        const price = parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
        if (name) {
          results.push({ code, name, price });
          continue;
        }
      }
    }

    // 3. Try hyphen-separated: "47 - Bloco Polidor - R$ 3,00" or "Bloco Polidor - R$ 3,00"
    const hyphenParts = line.split(/\s*-\s*/);
    if (hyphenParts.length >= 3) {
      const code = hyphenParts[0].replace(/^#/, '');
      const name = hyphenParts[1];
      const rawPrice = hyphenParts[2];
      const price = parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
      results.push({ code, name, price });
      continue;
    } else if (hyphenParts.length === 2) {
      const rawPrice = hyphenParts[1];
      const price = parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
      results.push({ code: `SKU-${100 + results.length}`, name: hyphenParts[0], price });
      continue;
    }
  }

  return results;
}

export function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[\s.·=~–—\-:;,•\*\[\]\(\)\#\+]+/g, ' ') // replace symbols with space
    .trim();
}

/**
 * Checks if a detected string is UI noise, raw price numbers (e.g. "R$ 520"),
 * or buttons like "Mostrar tudo", which must NEVER be added to the order.
 */
export function isInvalidProductNoise(text: string): boolean {
  if (!text) return true;
  const clean = text.toLowerCase().trim();
  if (clean.length < 2) return true;

  // 1. Raw price numbers like "R$ 520", "520", "R$ 5,20", "$ 11.50"
  if (/^(?:r\$|\$|€)?\s*[0-9]+([.,][0-9]{1,2})?\s*$/i.test(clean)) return true;

  // 2. Buttons, links, or navigation words
  const uiKeywords = [
    'mostrar tudo',
    'ver tudo',
    'ver mais',
    'ver carrinho',
    'toque para ver',
    'continuar comprando',
    'voltar as compras',
    'subtotal',
    'total estimado',
    'enviar mensagem',
    'comprar agora',
    'adicionar mais',
    'itens no carrinho',
  ];
  for (const kw of uiKeywords) {
    if (clean.includes(kw)) return true;
  }

  // 3. Strings without any actual word letters
  if (!/[a-zà-ÿ]{2,}/i.test(clean)) return true;

  return false;
}

/**
 * Matches detected OCR/Text against catalog with comprehensive scoring.
 * Differentiates items sharing common prefixes (e.g. #22 Manicure R$5,20 vs #56 Pedicure R$11,50)
 * and strictly rejects unmatched or noise lines.
 */
export function matchItemWithCatalog(
  detectedText: string,
  detectedPrice?: number,
  catalog: CatalogProduct[] = DEFAULT_CATALOG
): { product: CatalogProduct; confidence: number; reason: string } | null {
  if (!detectedText || detectedText.trim().length === 0) return null;
  if (isInvalidProductNoise(detectedText)) return null;

  const rawNorm = normalizeForComparison(detectedText);
  // Remove known OCR prefixes
  const cleanNorm = rawNorm
    .replace(/^(?:x|bi|bl)\s+/i, '')
    .replace(/\b(?:pur|po|esto|te)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (isInvalidProductNoise(cleanNorm)) return null;

  // Check direct Code match (e.g. text starts with "47" or "#47")
  const codeMatch = detectedText.match(/^(?:#|c[óo]d(?:igo)?[\s.:#-]*)?(\d{1,4})\b/i);
  const detectedCodeNum = codeMatch && codeMatch[1] ? codeMatch[1] : null;

  let bestProduct: CatalogProduct | null = null;
  let bestScore = -999;
  let bestReason = '';

  for (const prod of catalog) {
    let score = 0;
    const reasons: string[] = [];

    const prodNorm = normalizeForComparison(prod.name);
    const prodClean = prodNorm.replace(/\.{2,}/g, '').trim();

    // 1. Code Match (+120 points)
    if (detectedCodeNum && (prod.code === detectedCodeNum || prod.code === detectedCodeNum.replace(/^0+/, ''))) {
      score += 120;
      reasons.push(`Código #${prod.code}`);
    }

    // 2. Exact or Substring Name Equality (+100 points)
    if (cleanNorm === prodClean) {
      score += 100;
      reasons.push('Nome idêntico');
    } else if (cleanNorm.startsWith(prodClean) || prodClean.startsWith(cleanNorm)) {
      if (cleanNorm.length >= 4) {
        score += 70;
        reasons.push('Início compatível');
      }
    }

    // 3. Word / Token Matching (+20 per matching key word)
    const prodTokens = prodClean.split(' ').filter((t) => t.length >= 3);
    const textTokens = cleanNorm.split(' ').filter((t) => t.length >= 3);

    let matchedWordCount = 0;
    for (const token of textTokens) {
      if (prodTokens.some((pt) => pt.startsWith(token) || token.startsWith(pt))) {
        matchedWordCount++;
        score += 25;
      }
    }

    if (matchedWordCount > 0) {
      reasons.push(`${matchedWordCount} palavras coincidentes`);
    }

    // 4. Specific differentiator checks for similar products:
    // e.g. "pedicure" vs "manicure" or "plastica"
    if (cleanNorm.includes('pedi') && prodClean.includes('pedi')) {
      score += 40;
      reasons.push('Termo pedicure');
    } else if (cleanNorm.includes('pedi') && prodClean.includes('mani')) {
      score -= 50; // Penalty for manicure when pedicure is detected
    }

    if (cleanNorm.includes('mani') && prodClean.includes('mani')) {
      score += 40;
      reasons.push('Termo manicure');
    } else if (cleanNorm.includes('mani') && prodClean.includes('pedi')) {
      score -= 50;
    }

    // 5. Price verification (+45 points if price matches table)
    if (detectedPrice && detectedPrice > 0) {
      const priceDiff = Math.abs(prod.price - detectedPrice);
      if (priceDiff < 0.08) {
        score += 45;
        reasons.push(`Preço exato R$ ${prod.price.toFixed(2)}`);
      } else if (priceDiff > 1.0 && score > 0) {
        // Light penalty if price differs significantly
        score -= 15;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestProduct = prod;
      bestReason = reasons.join(', ');
    }
  }

  // Minimum score threshold to accept as a valid catalog item
  // (Prevents accidental matches of UI words or unrelated text)
  if (bestScore >= 45 && bestProduct) {
    const confidence = Math.min(1.0, 0.5 + bestScore / 150);
    return {
      product: bestProduct,
      confidence,
      reason: bestReason,
    };
  }

  return null;
}

/**
 * Reconciles an array of LineItems with the catalog.
 * By default, strictCatalogOnly = true: ONLY ITEMS IN THE DATABASE WILL BE INSERTED!
 * - ALWAYS uses official catalog price (prevents cart subtotals like 17.63 from overwriting unit price 3.00).
 * - Deduplicates items so the same product is not inserted twice from a single print.
 * - Discards noises like "R$ 520", "Mostrar tudo", or any unregistered item.
 */
export function reconcileItemsWithCatalog<
  T extends { code?: string; description: string; unitPrice: number; quantity: number; total?: number }
>(
  items: T[],
  catalog: CatalogProduct[] = DEFAULT_CATALOG,
  strictCatalogOnly: boolean = true
): T[] {
  const result: T[] = [];
  const seenCodes = new Set<string>();

  for (const item of items) {
    // If description is invalid noise, skip immediately
    if (isInvalidProductNoise(item.description)) {
      continue;
    }

    const match = matchItemWithCatalog(item.description, item.unitPrice, catalog);
    if (match) {
      const codeKey = `#${match.product.code}`;

      // Deduplicate: if this product was already added from this print, do not duplicate row
      const existing = result.find((r) => r.code === codeKey);
      if (existing) {
        if (item.quantity && item.quantity > existing.quantity) {
          existing.quantity = item.quantity;
          existing.total = existing.quantity * existing.unitPrice;
        }
        continue;
      }

      // ALWAYS USE OFFICIAL CATALOG PRICE as primary truth
      // (This guarantees Bloco Polidor is R$ 3,00 and never 17.63 which is the subtotal)
      const officialPrice = match.product.price > 0 ? match.product.price : item.unitPrice;
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;

      result.push({
        ...item,
        code: codeKey,
        description: match.product.name,
        unitPrice: officialPrice,
        total: qty * officialPrice,
      });
      seenCodes.add(codeKey);
    } else if (!strictCatalogOnly) {
      result.push(item);
    }
  }

  return result;
}
