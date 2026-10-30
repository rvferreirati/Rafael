export interface CatalogProduct {
  id?: string;
  code: string;
  name: string;
  price: number;
}

export const STORAGE_KEY_CATALOG = 'artex7_product_catalog_v1';

// Seeded with the user's official database from fdg_48c9d622.txt
export const DEFAULT_CATALOG: CatalogProduct[] = [
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

export function loadStoredCatalog(): CatalogProduct[] {
  if (typeof window === 'undefined') return DEFAULT_CATALOG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATALOG);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Return stored items directly without re-merging DEFAULT_CATALOG!
        // This guarantees deleted items STAY deleted and allows clearing the catalog.
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
 * Fetches the synchronized catalog from the server (shared across PC & Mobile)
 */
export async function fetchServerCatalog(): Promise<CatalogProduct[] | null> {
  try {
    const res = await fetch('/api/catalog');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.catalog)) {
        saveStoredCatalog(data.catalog);
        return data.catalog;
      }
    }
  } catch (err) {
    console.warn('Não foi possível sincronizar catálogo com o servidor:', err);
  }
  return null;
}

/**
 * Pushes the catalog to the server for instant synchronization with mobile phones
 */
export async function pushServerCatalog(catalog: CatalogProduct[]): Promise<boolean> {
  saveStoredCatalog(catalog);
  try {
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Erro ao salvar catálogo no servidor:', err);
    return false;
  }
}

/**
 * Resets the catalog on the server and locally to the default products
 */
export async function resetServerCatalog(): Promise<CatalogProduct[]> {
  try {
    const res = await fetch('/api/catalog/reset', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.catalog)) {
        saveStoredCatalog(data.catalog);
        return data.catalog;
      }
    }
  } catch (err) {
    console.warn('Erro ao restaurar catálogo no servidor:', err);
  }
  saveStoredCatalog(DEFAULT_CATALOG);
  return DEFAULT_CATALOG;
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
      const code = hyphenParts[0].replace(/^#/, '').trim() || '-';
      const name = hyphenParts[1];
      const rawPrice = hyphenParts[2];
      const price = parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
      results.push({ code, name, price });
      continue;
    } else if (hyphenParts.length === 2) {
      const rawPrice = hyphenParts[1];
      const price = parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
      // Item without code: use '-' as code
      results.push({ code: '-', name: hyphenParts[0].trim(), price });
      continue;
    }

    // 4. Try Space-separated: "47 Bloco Polidor R$ 3,00" or "- Bloco Polidor 3.00"
    const spaceMatch = line.match(/^#?([0-9A-Za-z_-]+)\s+(.+?)\s+(?:r\$\s*)?([0-9]+(?:[.,][0-9]{1,2})?)$/i);
    if (spaceMatch) {
      const code = spaceMatch[1].trim() || '-';
      const name = spaceMatch[2].trim();
      const rawPrice = spaceMatch[3];
      const price = parseFloat(rawPrice.replace(',', '.')) || 0;
      if (name && !isNaN(price)) {
        results.push({ code, name, price });
        continue;
      }
    }

    // 5. Try Item without code, space separated: "Bloco Polidor 3,00"
    const noCodeMatch = line.match(/^(.+?)\s+(?:r\$\s*)?([0-9]+(?:[.,][0-9]{1,2}))$/i);
    if (noCodeMatch) {
      const name = noCodeMatch[1].trim().replace(/^-\s*/, '');
      const price = parseFloat(noCodeMatch[2].replace(',', '.')) || 0;
      if (name && !isNaN(price)) {
        results.push({ code: '-', name, price });
        continue;
      }
    }
  }

  // Deduplicate within the parsed text itself (keeping last occurrence for keyed items, but preserving separate items with code '-')
  const uniqueMap = new Map<string, CatalogProduct>();
  results.forEach((item, index) => {
    const isNoCode = !item.code || item.code.trim() === '-';
    const key = isNoCode
      ? `nocode_${index}_${normalizeForComparison(item.name)}`
      : item.code.trim().toLowerCase();
    uniqueMap.set(key, { ...item, code: isNoCode ? '-' : item.code.trim() });
  });

  return Array.from(uniqueMap.values());
}

/**
 * Inserts or updates an existing catalog product by code or by name if code is '-'.
 * If the product code already exists (and is not '-'), updates name and price.
 * If code is '-', matches only by product name, allowing multiple distinct items with code '-'.
 */
export function upsertCatalogProduct(catalog: CatalogProduct[], product: CatalogProduct): CatalogProduct[] {
  const rawCode = product.code.replace(/^#/, '').trim();
  const isNoCode = !rawCode || rawCode === '-';
  const normCode = isNoCode ? '-' : rawCode;

  let existingIndex = -1;
  if (!isNoCode) {
    existingIndex = catalog.findIndex(
      (p) => p.code.toLowerCase() !== '-' && p.code.replace(/^#/, '').trim().toLowerCase() === normCode.toLowerCase()
    );
  } else {
    // If no code, only match if the exact product name exists
    existingIndex = catalog.findIndex(
      (p) => normalizeForComparison(p.name) === normalizeForComparison(product.name)
    );
  }

  if (existingIndex >= 0) {
    const next = [...catalog];
    next[existingIndex] = {
      code: isNoCode && next[existingIndex].code !== '-' ? next[existingIndex].code : normCode,
      name: product.name.trim() || next[existingIndex].name,
      price: product.price >= 0 ? product.price : next[existingIndex].price,
    };
    return next;
  }

  return [...catalog, { ...product, code: normCode, name: product.name.trim() }];
}

/**
 * Merges incoming products into current catalog, updating existing products and adding new ones.
 */
export function mergeCatalogProducts(current: CatalogProduct[], incoming: CatalogProduct[]): CatalogProduct[] {
  let result = [...current];
  for (const item of incoming) {
    result = upsertCatalogProduct(result, item);
  }
  return result;
}

export function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/([a-zà-ÿ])(\d)/gi, '$1 $2') // split "com11" -> "com 11"
    .replace(/(\d)([a-zà-ÿ])/gi, '$1 $2') // split "11ml" -> "11 ml"
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
    } else if (cleanNorm.startsWith(prodClean)) {
      score += 85;
      reasons.push('Início compatível');
    } else if (prodClean.startsWith(cleanNorm) && cleanNorm.length >= Math.min(prodClean.length * 0.75, 10)) {
      score += 65;
      reasons.push('Início de nome compatível');
    }

    // Specific check for Bloco Polidor: requires either code #47 or the specific word 'polidor'
    if (prod.code === '47' || prodNorm.includes('bloco polidor')) {
      if (!detectedCodeNum && !cleanNorm.includes('polidor')) {
        score -= 60; // Never match Bloco Polidor without code #47 or the word 'polidor'
      }
    }

    // 3. Word / Token Matching (+25 per matching key word)
    const prodTokens = prodClean.split(' ').filter((t) => t.length >= 2);
    const textTokens = cleanNorm.split(' ').filter((t) => t.length >= 2);

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

    // 4. Specific Cotton ("algodão") detection and classification
    const isTextCotton = cleanNorm.includes('algoda') || cleanNorm.includes('cotton');
    const isProdCotton = prodClean.includes('algoda');

    if (isTextCotton && isProdCotton) {
      score += 45;
      reasons.push('Produto de algodão');

      // Check if prensado / 1000 unidades
      const isTextPrensado = cleanNorm.includes('prensa') || cleanNorm.includes('1000') || cleanNorm.includes('unid');
      const isProdPrensado = prodClean.includes('prensa') || prodClean.includes('1000');
      if (isTextPrensado && isProdPrensado) {
        score += 65;
        reasons.push('Algodão prensado 1000un');
      }

      // Check if bola / 95 g
      const isTextBola = cleanNorm.includes('bola') || cleanNorm.includes('95');
      const isProdBola = prodClean.includes('bola') || prodClean.includes('95');
      if (isTextBola && isProdBola) {
        score += 65;
        reasons.push('Algodão bola 95g');
      }

      // Check if rolo / 500 g
      const isTextRolo = cleanNorm.includes('rolo') || cleanNorm.includes('500');
      const isProdRolo = prodClean.includes('rolo') || prodClean.includes('500');
      if (isTextRolo && isProdRolo) {
        score += 65;
        reasons.push('Rolo de algodão 500g');
      }
    } else if (isTextCotton && !isProdCotton) {
      score -= 50;
    }

    // 5. Specific differentiator checks for similar products:
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

    // 6. Price verification (+45 points if price matches table)
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
      const isNoCode = !match.product.code || match.product.code === '-';
      const codeKey = isNoCode
        ? '-'
        : (match.product.code.startsWith('#') ? match.product.code : `#${match.product.code}`);

      // CRITICAL FIX: Unique key for deduplication
      // If code is '-', deduplicate by product NAME so multiple items with code '-' are NEVER dropped!
      const uniqueKey = isNoCode
        ? `name_${normalizeForComparison(match.product.name)}`
        : `code_${match.product.code.toLowerCase()}`;

      // Deduplicate: if this product was already added from this print, do not duplicate row
      const existing = result.find((r) =>
        isNoCode
          ? normalizeForComparison(r.description) === normalizeForComparison(match.product.name)
          : r.code === codeKey
      );
      if (existing) {
        if (item.quantity && item.quantity > existing.quantity) {
          existing.quantity = item.quantity;
          existing.total = existing.quantity * existing.unitPrice;
        }
        continue;
      }

      // ALWAYS USE OFFICIAL CATALOG PRICE as primary truth
      const officialPrice = match.product.price > 0 ? match.product.price : item.unitPrice;
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;

      result.push({
        ...item,
        code: codeKey,
        description: match.product.name,
        unitPrice: officialPrice,
        total: qty * officialPrice,
      });
      seenCodes.add(uniqueKey);
    } else if (!strictCatalogOnly) {
      result.push(item);
    }
  }

  return result;
}
