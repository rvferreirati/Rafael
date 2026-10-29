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

function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics (acentos)
    .replace(/[\s.·=~–—\-:;,•\*\[\]\(\)\#\+]+/g, ' ') // replace symbols with space
    .trim();
}

/**
 * Matches detected OCR/Text against catalog to find corresponding official product.
 * Resolves truncated names (e.g. "Lixa mini canário pur..." or "X Bloco Polidor TE")
 */
export function matchItemWithCatalog(
  detectedText: string,
  detectedPrice?: number,
  catalog: CatalogProduct[] = DEFAULT_CATALOG
): { product: CatalogProduct; confidence: number; reason: string } | null {
  if (!detectedText || detectedText.trim().length === 0) return null;

  const rawNorm = normalizeForComparison(detectedText);
  // Remove known prefixes like "x ", "bi ", "bl ", "pur", "po", "esto"
  const cleanNorm = rawNorm
    .replace(/^(?:x|bi|bl)\s+/i, '')
    .replace(/\b(?:pur|po|esto|te)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Direct Code match (e.g. text starts with "47" or "#47")
  const codeMatch = detectedText.match(/^(?:#|c[óo]d(?:igo)?[\s.:#-]*)?(\d{1,4})\b/i);
  if (codeMatch && codeMatch[1]) {
    const num = codeMatch[1];
    const found = catalog.find((c) => c.code === num);
    if (found) {
      return { product: found, confidence: 0.98, reason: `Código #${found.code} exato` };
    }
  }

  // 2. Exact or substring match in name
  for (const prod of catalog) {
    const prodNorm = normalizeForComparison(prod.name);
    // Remove the trailing "..." if any
    const prodClean = prodNorm.replace(/\.{2,}/g, '').trim();

    // Direct contains or equality
    if (cleanNorm === prodClean || cleanNorm.startsWith(prodClean) || prodClean.startsWith(cleanNorm)) {
      if (cleanNorm.length >= 4) {
        return { product: prod, confidence: 0.95, reason: `Nome compatível com catálogo` };
      }
    }

    // Token-based match (e.g. "bloco polidor", "lixa mini canario", "lixa moeda preta", "algodao prensado")
    const prodTokens = prodClean.split(' ').filter((t) => t.length >= 3);
    const textTokens = cleanNorm.split(' ').filter((t) => t.length >= 3);

    if (prodTokens.length > 0 && textTokens.length > 0) {
      const matchCount = textTokens.filter((token) =>
        prodTokens.some((pt) => pt.startsWith(token) || token.startsWith(pt))
      ).length;

      // If at least 2 key words match, or 100% of the detected words match
      if (matchCount >= 2 || (matchCount >= 1 && textTokens.length <= 2 && matchCount === textTokens.length)) {
        return { product: prod, confidence: 0.9, reason: `Termos-chave: ${matchCount} palavras correspondentes` };
      }
    }
  }

  // 3. Fallback: match by price if provided and matches uniquely in catalog
  if (detectedPrice && detectedPrice > 0) {
    const matchingPrices = catalog.filter((p) => Math.abs(p.price - detectedPrice) < 0.05);
    if (matchingPrices.length === 1) {
      // Check if there is at least one letter overlap
      const candidate = matchingPrices[0];
      const candNorm = normalizeForComparison(candidate.name);
      const hasAnyToken = candNorm.split(' ').some((tok) => tok.length >= 4 && cleanNorm.includes(tok));
      if (hasAnyToken) {
        return { product: candidate, confidence: 0.85, reason: `Preço R$ ${detectedPrice.toFixed(2)} + termo similar` };
      }
    }
  }

  return null;
}

/**
 * Reconciles an array of LineItems with the catalog
 */
export function reconcileItemsWithCatalog<T extends { code?: string; description: string; unitPrice: number; quantity: number; total?: number }>(
  items: T[],
  catalog: CatalogProduct[] = DEFAULT_CATALOG
): T[] {
  return items.map((item) => {
    const match = matchItemWithCatalog(item.description, item.unitPrice, catalog);
    if (match) {
      const unitPrice = item.unitPrice > 0 ? item.unitPrice : match.product.price;
      const qty = item.quantity || 1;
      return {
        ...item,
        code: `#${match.product.code}`,
        description: match.product.name,
        unitPrice,
        total: qty * unitPrice,
      };
    }
    return item;
  });
}
