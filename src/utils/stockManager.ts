import * as XLSX from 'xlsx';
import { StockItem, StockMovement, SalesOrder, LineItem } from '../types';
import { CatalogProduct, DEFAULT_CATALOG } from './productCatalog';

export const STORAGE_KEY_STOCK = 'artex7_stock_items_v1';
export const STORAGE_KEY_STOCK_MOVEMENTS = 'artex7_stock_movements_v1';

export const buildInitialStockFromCatalog = (catalogList: CatalogProduct[] = DEFAULT_CATALOG): StockItem[] => {
  return catalogList.map((p, index) => {
    const basePrice = Number(p.price) || 0;
    // Default sensible values: cost ~60%, wholesale ~88%, retail = 100%
    const cost = Math.round(basePrice * 0.6 * 100) / 100;
    const wholesale = Math.round(basePrice * 0.88 * 100) / 100;
    const retail = Math.round(basePrice * 100) / 100;

    let category = 'Geral';
    const lowerName = (p.name || '').toLowerCase();
    if (lowerName.includes('lixa') || lowerName.includes('buffer')) category = 'Lixas & Buffers';
    else if (lowerName.includes('bloco')) category = 'Blocos Polidores';
    else if (lowerName.includes('cílios') || lowerName.includes('cilios')) category = 'Cílios';
    else if (lowerName.includes('algodão') || lowerName.includes('algodao')) category = 'Algodão & Descartáveis';
    else if (lowerName.includes('acetona') || lowerName.includes('removedor')) category = 'Removedores';
    else if (lowerName.includes('base') || lowerName.includes('top coat') || lowerName.includes('brilho') || lowerName.includes('secante')) category = 'Finalizadores & Esmaltes';

    return {
      id: p.id || `stock-${p.code || 'item'}-${index}`,
      code: p.code && p.code !== '-' ? p.code : '',
      name: p.name || '',
      currentStock: 100, // Saldo inicial para controle ativo
      minStock: 15,
      costPrice: cost,
      wholesalePrice: wholesale,
      retailPrice: retail,
      category,
      unit: 'un',
      updatedAt: Date.now(),
    };
  });
};

export const loadStoredStock = (): StockItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STOCK);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Return parsed array even if empty (0 items)
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar estoque do localStorage:', err);
  }

  // Initial startup defaults only if completely uninitialized
  const initial = buildInitialStockFromCatalog(DEFAULT_CATALOG);
  saveStoredStock(initial);
  return initial;
};

export const saveStoredStock = (items: StockItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_STOCK, JSON.stringify(items));
  } catch (err) {
    console.error('Erro ao salvar estoque no localStorage:', err);
  }
};

export const loadStoredStockMovements = (): StockMovement[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STOCK_MOVEMENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Erro ao carregar movimentações de estoque:', err);
  }
  return [];
};

export const saveStoredStockMovements = (movements: StockMovement[]): void => {
  try {
    // Keep last 500 movements
    const trimmed = movements.slice(-500);
    localStorage.setItem(STORAGE_KEY_STOCK_MOVEMENTS, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Erro ao salvar movimentações:', err);
  }
};

export interface ServerStockMeta {
  stock: StockItem[];
  count: number;
  updatedAt?: number;
  updatedBy?: string;
}

// Server synchronization helpers with anti-cache timestamp for instant mobile delivery
export const fetchServerStock = async (): Promise<StockItem[] | null> => {
  try {
    const res = await fetch(`/api/stock?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.stock) && data.stock.length > 0) {
        saveStoredStock(data.stock);
        return data.stock;
      }
    }
  } catch (err) {
    // offline or server unavailable
  }
  return null;
};

export const fetchServerStockMeta = async (): Promise<ServerStockMeta | null> => {
  try {
    const res = await fetch(`/api/stock?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.stock)) {
        return {
          stock: data.stock,
          count: data.stock.length,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        };
      }
    }
  } catch (err) {
    // offline
  }
  return null;
};

export const pushServerStock = async (stock: StockItem[]): Promise<boolean> => {
  try {
    // 1. Direct Cloud Firestore Sync (Cross-Device PC & Mobile, works on Vercel)
    try {
      const { pushAllStockToFirestore } = await import('../services/firestoreSync');
      pushAllStockToFirestore(stock).catch((err) =>
        console.warn('Firestore sync background notice:', err)
      );
    } catch (e) {
      // background sync catch
    }

    // 2. Fallback server route
    const res = await fetch(`/api/stock?t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      body: JSON.stringify({
        stock,
        device: typeof navigator !== 'undefined' && /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'celular' : 'computador',
      }),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
};

// Stock deduction when creating / confirming an order
export const deductStockForOrder = (
  order: SalesOrder,
  currentStockList: StockItem[]
): {
  success: boolean;
  updatedStock: StockItem[];
  movements: StockMovement[];
  deductedItems: { code: string; name: string; qty: number; previousStock: number; newStock: number }[];
} => {
  const updatedStock = [...currentStockList];
  const movements: StockMovement[] = [];
  const deductedItems: { code: string; name: string; qty: number; previousStock: number; newStock: number }[] = [];

  order.items.forEach((item) => {
    const itemQty = Number(item.quantity) || 0;
    if (itemQty <= 0) return;

    // Find in stock by exact code or name
    const cleanItemCode = (item.code || '').replace(/^#/, '').trim().toLowerCase();
    const cleanItemName = (item.description || '').trim().toLowerCase();

    const stockIndex = updatedStock.findIndex((st) => {
      const stCode = (st.code || '').replace(/^#/, '').trim().toLowerCase();
      const stBarcode = (st.barcode || '').trim().toLowerCase();
      if (stBarcode && cleanItemCode && stBarcode === cleanItemCode) return true;
      if (stCode && cleanItemCode && stCode === cleanItemCode) return true;
      if (cleanItemCode && cleanItemCode.length >= 2 && (stCode.endsWith(cleanItemCode) || cleanItemCode.endsWith(stCode))) return true;
      return st.name.trim().toLowerCase() === cleanItemName;
    });

    if (stockIndex >= 0) {
      const current = updatedStock[stockIndex];
      const prev = current.currentStock;
      const next = Math.max(0, prev - itemQty); // Baixa no estoque

      updatedStock[stockIndex] = {
        ...current,
        currentStock: next,
        updatedAt: Date.now(),
      };

      const mov: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        stockItemId: current.id,
        itemCode: current.code,
        itemName: current.name,
        type: 'sale',
        quantity: -itemQty,
        previousStock: prev,
        newStock: next,
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: `Baixa pelo Pedido #${order.orderNumber} (${order.customer?.name || 'Cliente'})`,
        timestamp: Date.now(),
      };
      movements.push(mov);
      deductedItems.push({
        code: current.code,
        name: current.name,
        qty: itemQty,
        previousStock: prev,
        newStock: next,
      });
    }
  });

  saveStoredStock(updatedStock);
  const existingMovements = loadStoredStockMovements();
  saveStoredStockMovements([...movements, ...existingMovements]);
  pushServerStock(updatedStock);

  if (movements.length > 0) {
    import('../services/firestoreSync')
      .then(({ saveStockMovementsToFirestore }) => saveStockMovementsToFirestore(movements))
      .catch((err) => console.warn('Aviso ao sincronizar movimentações:', err));
  }

  return { success: true, updatedStock, movements, deductedItems };
};

// Stock return / restoration when cancelling an order
export const restoreStockForOrder = (
  order: SalesOrder,
  currentStockList: StockItem[]
): {
  success: boolean;
  updatedStock: StockItem[];
  movements: StockMovement[];
  restoredItems: { code: string; name: string; qty: number; previousStock: number; newStock: number }[];
} => {
  const updatedStock = [...currentStockList];
  const movements: StockMovement[] = [];
  const restoredItems: { code: string; name: string; qty: number; previousStock: number; newStock: number }[] = [];

  order.items.forEach((item) => {
    const itemQty = Number(item.quantity) || 0;
    if (itemQty <= 0) return;

    const cleanItemCode = (item.code || '').replace(/^#/, '').trim().toLowerCase();
    const cleanItemName = (item.description || '').trim().toLowerCase();

    const stockIndex = updatedStock.findIndex((st) => {
      const stCode = (st.code || '').replace(/^#/, '').trim().toLowerCase();
      const stBarcode = (st.barcode || '').trim().toLowerCase();
      if (stBarcode && cleanItemCode && stBarcode === cleanItemCode) return true;
      if (stCode && cleanItemCode && stCode === cleanItemCode) return true;
      if (cleanItemCode && cleanItemCode.length >= 2 && (stCode.endsWith(cleanItemCode) || cleanItemCode.endsWith(stCode))) return true;
      return st.name.trim().toLowerCase() === cleanItemName;
    });

    if (stockIndex >= 0) {
      const current = updatedStock[stockIndex];
      const prev = current.currentStock;
      const next = prev + itemQty; // Volta o saldo para em estoque

      updatedStock[stockIndex] = {
        ...current,
        currentStock: next,
        updatedAt: Date.now(),
      };

      const mov: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        stockItemId: current.id,
        itemCode: current.code,
        itemName: current.name,
        type: 'cancellation_return',
        quantity: itemQty,
        previousStock: prev,
        newStock: next,
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: `Estorno por cancelamento do Pedido #${order.orderNumber}`,
        timestamp: Date.now(),
      };
      movements.push(mov);
      restoredItems.push({
        code: current.code,
        name: current.name,
        qty: itemQty,
        previousStock: prev,
        newStock: next,
      });
    }
  });

  saveStoredStock(updatedStock);
  const existingMovements = loadStoredStockMovements();
  saveStoredStockMovements([...movements, ...existingMovements]);
  pushServerStock(updatedStock);

  if (movements.length > 0) {
    import('../services/firestoreSync')
      .then(({ saveStockMovementsToFirestore }) => saveStockMovementsToFirestore(movements))
      .catch((err) => console.warn('Aviso ao sincronizar estornos:', err));
  }

  return { success: true, updatedStock, movements, restoredItems };
};

// Export Stock to Excel (.xlsx) with formatting
export const exportStockToExcel = (stockList: StockItem[], filename = 'Controle_Estoque_ARTEX7.xlsx') => {
  const rows = stockList.map((item) => {
    const totalCost = Number((item.currentStock * item.costPrice).toFixed(2));
    const totalWholesale = Number((item.currentStock * item.wholesalePrice).toFixed(2));
    const totalRetail = Number((item.currentStock * item.retailPrice).toFixed(2));

    return {
      'Código / SKU': item.code || '-',
      'Código de Barras': item.barcode || '',
      'Descrição do Produto': item.name,
      'Em Estoque': item.currentStock,
      'Preço Custo (R$)': item.costPrice,
      'Preço Atacado (R$)': item.wholesalePrice,
      'Preço Varejo (R$)': item.retailPrice,
      'Valor Total Custo (R$)': totalCost,
      'Valor Total Atacado (R$)': totalWholesale,
      'Valor Total Varejo (R$)': totalRetail,
      'Categoria': item.category || 'Geral',
      'Unidade': item.unit || 'un',
      'Estoque Mínimo': item.minStock || 10,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths for clean readability
  ws['!cols'] = [
    { wch: 14 }, // Código
    { wch: 18 }, // Código de Barras
    { wch: 42 }, // Descrição
    { wch: 14 }, // Em Estoque
    { wch: 16 }, // Preço Custo
    { wch: 18 }, // Preço Atacado
    { wch: 18 }, // Preço Varejo
    { wch: 20 }, // Total Custo
    { wch: 22 }, // Total Atacado
    { wch: 22 }, // Total Varejo
    { wch: 20 }, // Categoria
    { wch: 10 }, // Unidade
    { wch: 14 }, // Mínimo
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Estoque ARTEX7');
  XLSX.writeFile(wb, filename);
};

// Import Stock from an Excel or CSV file
export const importStockFromExcel = async (
  file: File
): Promise<{ success: boolean; count: number; items: StockItem[]; message: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          return resolve({ success: false, count: 0, items: [], message: 'A planilha selecionada está vazia.' });
        }

        const importedItems: StockItem[] = [];

        rawJson.forEach((row, idx) => {
          // Normalize column headers
          const keys = Object.keys(row);
          const findKey = (candidates: string[]) => {
            return keys.find((k) =>
              candidates.some((c) => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(c))
            );
          };

          const barcodeKey = findKey(['barra', 'barras', 'barcode', 'ean', 'gtin']);
          const codeKey = keys.find((k) => {
            if (k === barcodeKey) return false;
            const norm = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return ['cod', 'sku', 'codigo', 'ref'].some((c) => norm.includes(c));
          });
          const nameKey = findKey(['descri', 'nome', 'produto', 'item', 'mercadoria']);
          const stockKey = findKey(['estoque', 'em estoque', 'saldo', 'qtd', 'quantidade']);
          const costKey = findKey(['custo', 'preco custo', 'preco de custo', 'valor custo']);
          const wholesaleKey = findKey(['atacado', 'preco atacado', 'preco de atacado']);
          const retailKey = findKey(['varejo', 'preco varejo', 'preco de varejo', 'preco', 'venda']);
          const catKey = findKey(['categoria', 'grupo', 'tipo', 'marca']);
          const minKey = findKey(['minimo', 'min']);

          const rawCode = codeKey ? String(row[codeKey]).trim() : '';
          const rawBarcode = barcodeKey ? String(row[barcodeKey]).trim() : '';
          const rawName = nameKey ? String(row[nameKey]).trim() : '';

          if (!rawName && !rawCode && !rawBarcode) return; // Skip blank rows

          const parseNumber = (val: any, fallback = 0) => {
            if (typeof val === 'number') return val;
            if (!val) return fallback;
            const str = String(val).replace(/R\$|\$/g, '').trim();
            // Handle brazilian 1.234,56 or standard 1234.56
            if (str.includes(',') && str.includes('.')) {
              return parseFloat(str.replace(/\./g, '').replace(',', '.')) || fallback;
            }
            if (str.includes(',')) {
              return parseFloat(str.replace(',', '.')) || fallback;
            }
            return parseFloat(str) || fallback;
          };

          const currentStock = stockKey ? Math.max(0, Math.round(parseNumber(row[stockKey], 0))) : 50;
          const retail = retailKey ? parseNumber(row[retailKey], 0) : 0;
          const wholesale = wholesaleKey ? parseNumber(row[wholesaleKey], retail > 0 ? retail * 0.88 : 0) : retail * 0.88;
          const cost = costKey ? parseNumber(row[costKey], retail > 0 ? retail * 0.6 : 0) : retail * 0.6;
          const minStock = minKey ? parseNumber(row[minKey], 10) : 10;
          const category = catKey && row[catKey] ? String(row[catKey]).trim() : 'Geral';

          importedItems.push({
            id: `stock-imp-${Date.now()}-${idx}`,
            code: rawCode.replace(/^#/, ''),
            barcode: rawBarcode || undefined,
            name: rawName || `Produto ${rawCode || rawBarcode}`,
            currentStock,
            minStock,
            costPrice: Math.round(cost * 100) / 100,
            wholesalePrice: Math.round(wholesale * 100) / 100,
            retailPrice: Math.round(retail * 100) / 100,
            category,
            unit: 'un',
            updatedAt: Date.now(),
          });
        });

        resolve({
          success: true,
          count: importedItems.length,
          items: importedItems,
          message: `${importedItems.length} produtos importados com sucesso da planilha!`,
        });
      } catch (err: any) {
        resolve({
          success: false,
          count: 0,
          items: [],
          message: `Erro ao processar planilha: ${err?.message || 'Arquivo inválido'}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, count: 0, items: [], message: 'Erro ao ler o arquivo selecionado.' });
    };

    reader.readAsBinaryString(file);
  });
};

// Import Order Items from an Excel sheet to populate an order directly
export const importOrderItemsFromExcel = async (
  file: File,
  stockCatalog: StockItem[],
  priceType: 'wholesale' | 'retail' = 'wholesale'
): Promise<{
  success: boolean;
  items: LineItem[];
  matchedCount: number;
  unmatchedCount: number;
  message: string;
}> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          return resolve({
            success: false,
            items: [],
            matchedCount: 0,
            unmatchedCount: 0,
            message: 'A planilha de pedido está vazia.',
          });
        }

        const orderItems: LineItem[] = [];
        let matchedCount = 0;
        let unmatchedCount = 0;

        const parseNum = (val: any, fallback = 0) => {
          if (typeof val === 'number') return val;
          if (!val) return fallback;
          const s = String(val).replace(/R\$|\$/g, '').trim();
          if (s.includes(',') && s.includes('.')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || fallback;
          if (s.includes(',')) return parseFloat(s.replace(',', '.')) || fallback;
          return parseFloat(s) || fallback;
        };

        rawJson.forEach((row, idx) => {
          const keys = Object.keys(row);
          const findKey = (candidates: string[]) => {
            return keys.find((k) =>
              candidates.some((c) => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(c))
            );
          };

          const codeKey = findKey(['cod', 'codigo', 'sku', 'ref']);
          const nameKey = findKey(['descri', 'nome', 'produto', 'item']);
          const qtyKey = findKey(['qtd', 'quantidade', 'quant', 'un']);
          const priceKey = findKey(['preco', 'unit', 'valor', 'total']);

          const rawCode = codeKey ? String(row[codeKey]).trim() : '';
          const rawName = nameKey ? String(row[nameKey]).trim() : '';
          const quantity = qtyKey ? Math.max(1, Math.round(parseNum(row[qtyKey], 1))) : 1;

          if (!rawCode && !rawName) return;

          // Lookup in stock catalog
          const cleanCode = rawCode.replace(/^#/, '').trim().toLowerCase();
          const cleanName = rawName.trim().toLowerCase();

          const stockMatch = stockCatalog.find((st) => {
            const stCode = (st.code || '').replace(/^#/, '').trim().toLowerCase();
            const stBarcode = (st.barcode || '').trim().toLowerCase();
            if (cleanCode && stBarcode && stBarcode === cleanCode) return true;
            if (cleanCode && stCode && stCode === cleanCode) return true;
            if (cleanName && st.name.trim().toLowerCase() === cleanName) return true;
            if (cleanName && cleanName.length >= 4 && st.name.trim().toLowerCase().includes(cleanName)) return true;
            return false;
          });

          let unitPrice = 0;
          let description = rawName;
          let code = rawCode;
          let stockItemId: string | undefined = undefined;

          if (stockMatch) {
            matchedCount++;
            code = stockMatch.code || code;
            description = stockMatch.name;
            stockItemId = stockMatch.id;
            unitPrice = priceType === 'wholesale' ? stockMatch.wholesalePrice : stockMatch.retailPrice;
          } else {
            unmatchedCount++;
            if (priceKey) {
              unitPrice = parseNum(row[priceKey], 0);
            }
          }

          orderItems.push({
            id: `item-excel-${Date.now()}-${idx}`,
            code,
            description: description || `Item ${code || idx + 1}`,
            quantity,
            unitPrice,
            total: quantity * unitPrice,
            stockItemId,
          });
        });

        resolve({
          success: true,
          items: orderItems,
          matchedCount,
          unmatchedCount,
          message: `${orderItems.length} itens extraídos da planilha (${matchedCount} vinculados ao estoque)!`,
        });
      } catch (err: any) {
        resolve({
          success: false,
          items: [],
          matchedCount: 0,
          unmatchedCount: 0,
          message: `Erro ao processar planilha de pedido: ${err?.message || 'Arquivo inválido'}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        items: [],
        matchedCount: 0,
        unmatchedCount: 0,
        message: 'Erro ao ler arquivo de planilha.',
      });
    };

    reader.readAsBinaryString(file);
  });
};
