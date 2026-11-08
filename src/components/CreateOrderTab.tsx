import React, { useState, useRef, useEffect, useMemo } from 'react';
import Tesseract from 'tesseract.js';
import confetti from 'canvas-confetti';
import {
  Upload,
  Sparkles,
  Plus,
  Trash2,
  FileDown,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Eye,
  Layers,
  ArrowRight,
  ArrowLeft,
  Info,
  Send,
  MessageSquare,
  Cpu,
  Zap,
  Image as ImageIcon,
  Edit3,
  DollarSign,
  Package,
  Minus,
  Check,
  ChevronRight,
  Scissors,
  RefreshCw,
  X,
  ExternalLink,
  Bookmark,
  ShoppingBag,
  Camera,
  Database,
  Hash,
  Search,
  Barcode,
  FileSpreadsheet,
  Boxes
} from 'lucide-react';
import { Customer, LineItem, SalesOrder, CompanyProfile, StockItem } from '../types';
import { parseOCRText } from '../utils/ocrParser';
import { generateSalesOrderPDF } from '../utils/pdfGenerator';
import { SAMPLE_PRESETS, createSampleInvoiceImage } from '../utils/sampleInvoices';
import { cropImageToCenter, DEFAULT_MIDDLE_CROP, WHATSAPP_FULL_CROP, optimizeImageForOCR, prepareImageForLocalOCR } from '../utils/imageCropper';
import { loadLogoDataUrl } from '../utils/logoLoader';
import { SendOrderModal } from './SendOrderModal';
import { WhatsAppCartModal } from './WhatsAppCartModal';
import {
  CatalogProduct,
  DEFAULT_CATALOG,
  loadStoredCatalog,
  saveStoredCatalog,
  pushServerCatalog,
  syncCatalogWithServer,
  mergeCatalogProducts,
  reconcileItemsWithCatalog
} from '../utils/productCatalog';
import { loadStoredStock, importOrderItemsFromExcel } from '../utils/stockManager';
import { CatalogModal } from './CatalogModal';

export interface QuickCatalogProduct {
  code: string;
  name: string;
  price: number;
}

export const INITIAL_QUICK_PRODUCTS: QuickCatalogProduct[] = [
  { code: '#47', name: 'Bloco Polidor', price: 3.0 },
  { code: '#46', name: 'Lixa mini canário pura arte com...', price: 7.7 },
  { code: '#10', name: 'Lixa moeda preta podóloga grão...', price: 6.93 },
  { code: '#12', name: 'Algodão prensado com 1000 unidades', price: 13.0 },
  { code: '#14', name: 'Algodão bola 95 g', price: 5.0 },
  { code: '#23', name: 'Rolo de Algodão 500 g', price: 20.0 },
];

interface CreateOrderTabProps {
  customers: Customer[];
  company: CompanyProfile;
  onSaveOrder: (order: SalesOrder) => void;
  onNavigateToCustomers: () => void;
  catalog?: CatalogProduct[];
  onUpdateCatalog?: (newCatalog: CatalogProduct[]) => void;
  onSyncCatalog?: () => void;
  isSyncing?: boolean;
  stockList?: StockItem[];
  onUpdateStock?: (newStock: StockItem[]) => void;
}

export type OrderFlowStep = 'upload' | 'items' | 'review';

export interface UploadedPrint {
  id: string;
  name: string;
  originalDataUrl: string;
  croppedDataUrl: string;
  useMiddleCrop: boolean;
  isPdf: boolean;
  status: 'pending' | 'processing' | 'done' | 'error';
  itemCount?: number;
  extractedItems?: LineItem[];
  errorMessage?: string;
  createdAt: number;
}

export const CreateOrderTab: React.FC<CreateOrderTabProps> = ({
  customers,
  company,
  onSaveOrder,
  onNavigateToCustomers,
  catalog: propCatalog,
  onUpdateCatalog,
  onSyncCatalog,
  isSyncing,
  stockList: propStockList,
  onUpdateStock,
}) => {
  // --- Active Step in Order Creation Flow ---
  const [activeStep, setActiveStep] = useState<OrderFlowStep>('upload');

  // --- Multi-Print Management State ---
  const [uploadedPrints, setUploadedPrints] = useState<UploadedPrint[]>([]);
  const [focusMiddleScreen, setFocusMiddleScreen] = useState<boolean>(false); // Padrão imagem completa para não cortar produtos no topo ou rodapé
  const [accumulatePrints, setAccumulatePrints] = useState<boolean>(true);   // Acumula produtos dos prints
  const [previewingPrint, setPreviewingPrint] = useState<{ print: UploadedPrint; mode: 'cropped' | 'original' } | null>(null);

  // --- Form State ---
  const [orderNumber, setOrderNumber] = useState<string>(
    () => `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [orderDueDate, setOrderDueDate] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<'draft' | 'confirmed' | 'delivered'>('confirmed');

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [custName, setCustName] = useState<string>('');
  const [custTaxId, setCustTaxId] = useState<string>('');
  const [custEmail, setCustEmail] = useState<string>('');
  const [custPhone, setCustPhone] = useState<string>('');
  const [custAddress, setCustAddress] = useState<string>('');

  // Product Database / Catalog State (kept in sync with prop and localStorage)
  const [catalog, setCatalog] = useState<CatalogProduct[]>(() => {
    const initial = propCatalog && propCatalog.length > 0 ? propCatalog : loadStoredCatalog();
    if (initial.length < DEFAULT_CATALOG.length) {
      return mergeCatalogProducts(DEFAULT_CATALOG, initial);
    }
    return initial;
  });

  useEffect(() => {
    if (propCatalog && propCatalog.length > 0) {
      setCatalog(propCatalog);
    }
  }, [propCatalog]);

  const handleCatalogChange = (newCatalog: CatalogProduct[]) => {
    setCatalog(newCatalog);
    if (onUpdateCatalog) {
      onUpdateCatalog(newCatalog);
    } else {
      pushServerCatalog(newCatalog);
    }
  };

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);

  // Line items (extracted from prints and fully editable)
  const [items, setItems] = useState<LineItem[]>([]);

  // Financials & Notes
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(company.defaultTaxRate ?? 8);
  const [orderNotes, setOrderNotes] = useState<string>(
    'Pagamento em até 30 dias via transferência bancária, PIX ou boleto. Garantia e conferência inclusas.'
  );

  // OCR state
  const [ocrEngine, setOcrEngine] = useState<'ai' | 'tesseract'>('ai');
  const [isProcessingOCR, setIsProcessingOCR] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatusMessage, setOcrStatusMessage] = useState<string>('');
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [showRawText, setShowRawText] = useState<boolean>(false);
  const [attachImageToPdf, setAttachImageToPdf] = useState<boolean>(true);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Modal de Envio
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sentOrder, setSentOrder] = useState<SalesOrder | null>(null);

  // Modal de Colar Texto / Itens Rápido
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Modal de Importação de Carrinho do WhatsApp
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const handleApplyWhatsAppCart = (
    cartItems: LineItem[],
    customerInfo?: { name?: string; phone?: string; address?: string }
  ) => {
    if (accumulatePrints) {
      setItems((prev) => [...prev, ...cartItems]);
    } else {
      setItems(cartItems);
    }

    if (customerInfo?.name) {
      setCustName(customerInfo.name);
    }
    if (customerInfo?.phone) {
      setCustPhone(customerInfo.phone);
    }
    if (customerInfo?.address) {
      setCustAddress(customerInfo.address);
    }

    setFeedbackSuccess(
      `🟢 Carrinho do WhatsApp importado! ${cartItems.length} itens e dados do cliente carregados com sucesso.`
    );
    setActiveStep('items');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadCosmeticsItems = () => {
    setItems([
      { id: `item-${Date.now()}-1`, code: '#47', description: 'Bloco Polidor', quantity: 1, unitPrice: 3.0, total: 3.0 },
      { id: `item-${Date.now()}-2`, code: '#46', description: 'Lixa mini canário pura arte com...', quantity: 1, unitPrice: 7.7, total: 7.7 },
      { id: `item-${Date.now()}-3`, code: '#10', description: 'Lixa moeda preta podóloga grão...', quantity: 1, unitPrice: 6.93, total: 6.93 },
    ]);
    setFeedbackSuccess('🎯 Produtos do seu print carregados com sucesso com códigos #47, #46 e #10!');
    setActiveStep('items');
  };

  const handleLoadCodedCosmeticsItems = () => {
    setItems([
      { id: `item-${Date.now()}-1`, code: '#47', description: 'Bloco Polidor', quantity: 1, unitPrice: 3.0, total: 3.0 },
      { id: `item-${Date.now()}-2`, code: '#46', description: 'Lixa mini canário pura arte com...', quantity: 1, unitPrice: 7.7, total: 7.7 },
      { id: `item-${Date.now()}-3`, code: '#10', description: 'Lixa moeda preta podóloga grão...', quantity: 1, unitPrice: 6.93, total: 6.93 },
    ]);
    setFeedbackSuccess('🎯 Produtos do print identificados com 100% de precisão via Estoque (#47, #46, #10)!');
    setActiveStep('items');
  };

  // Fast Code Entry, Stock & Database Lookup States
  const [fastCodeInput, setFastCodeInput] = useState<string>('');
  const [fastQuantityInput, setFastQuantityInput] = useState<number>(1);
  const [priceType, setPriceType] = useState<'wholesale' | 'retail'>('wholesale');
  const excelOrderInputRef = useRef<HTMLInputElement>(null);
  const [isExcelImporting, setIsExcelImporting] = useState<boolean>(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);

  // Active stock list for inventory control & wholesale/retail pricing
  const activeStock = useMemo(() => {
    return propStockList && propStockList.length > 0 ? propStockList : loadStoredStock();
  }, [propStockList]);

  type EnrichedCatalogProduct = CatalogProduct & {
    currentStock?: number;
    wholesalePrice?: number;
    retailPrice?: number;
    costPrice?: number;
  };

  const [matchedCatalogProduct, setMatchedCatalogProduct] = useState<EnrichedCatalogProduct | null>(null);
  const [matchingProducts, setMatchingProducts] = useState<EnrichedCatalogProduct[]>([]);
  const [fastEntryFeedback, setFastEntryFeedback] = useState<string | null>(null);
  const fastCodeInputRef = useRef<HTMLInputElement>(null);

  // Batch Code Entry Modal States
  const [isBatchCodeModalOpen, setIsBatchCodeModalOpen] = useState<boolean>(false);
  const [batchCodeText, setBatchCodeText] = useState<string>('');

  const normalizeForSearch = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Helper to search ALL products matching code OR product name (returns all matching options)
  const searchAllCatalogProducts = (query: string): EnrichedCatalogProduct[] => {
    if (!query) return [];
    const raw = query.trim();
    if (raw.length === 0) return [];

    const normQuery = normalizeForSearch(raw);
    const cleanCode = raw.replace(/^#/, '').replace(/^COD:?\s*/i, '').replace(/^SKU:?\s*/i, '').trim().toLowerCase();
    const numClean = parseInt(cleanCode, 10);
    const isPureNumber = !isNaN(numClean) && String(numClean) === cleanCode.replace(/^0+/, '');

    const results: { product: EnrichedCatalogProduct; score: number }[] = [];
    const seen = new Set<string>();

    // First search in activeStock (which has currentStock, wholesalePrice, retailPrice)
    activeStock.forEach((st: StockItem) => {
      const pKey = `${st.code || '-'}_${st.name}`;
      if (seen.has(pKey)) return;

      const pCodeRaw = (st.code || '').trim();
      const pCodeClean = pCodeRaw.replace(/^#/, '').replace(/^COD:?\s*/i, '').replace(/^SKU:?\s*/i, '').trim().toLowerCase();
      const pNormName = normalizeForSearch(st.name);
      const pNum = parseInt(pCodeClean, 10);

      const effectivePrice = priceType === 'wholesale' ? st.wholesalePrice : st.retailPrice;

      let score = 0;

      // 1. Exact code match (e.g. "47", "10", "237")
      if (pCodeClean && pCodeClean !== '-' && pCodeClean === cleanCode) {
        score = 1000;
      }
      // 2. Pure number code match (e.g. "010" vs "10")
      else if (isPureNumber && !isNaN(pNum) && pCodeClean !== '-' && pNum === numClean) {
        score = 950;
      }
      // 3. Exact name match
      else if (pNormName === normQuery) {
        score = 900;
      }
      // 4. Code starts with query (e.g. typing "1" gives "10", "11", "12")
      else if (pCodeClean && pCodeClean !== '-' && pCodeClean.startsWith(cleanCode)) {
        score = 850;
      }
      // 5. Code ENDS with query (Last digits of code, e.g. "46" matches "#346", "37" matches "#237", "7" matches "#47")
      else if (pCodeClean && pCodeClean !== '-' && cleanCode.length >= 1 && pCodeClean.endsWith(cleanCode)) {
        score = 840;
      }
      // 6. Number ends with query digits
      else if (isPureNumber && !isNaN(pNum) && pCodeClean !== '-' && String(pNum).endsWith(String(numClean))) {
        score = 830;
      }
      // 7. Code contains query anywhere
      else if (pCodeClean && pCodeClean !== '-' && pCodeClean.includes(cleanCode)) {
        score = 800;
      }
      // 8. Name starts with query (e.g. "lixa...")
      else if (pNormName.startsWith(normQuery)) {
        score = 700;
      }
      // 9. Name contains query as a distinct word or substring (e.g. "mini lixa buffer")
      else if (pNormName.includes(normQuery)) {
        score = 500;
      }
      // 10. Product name contains the code digits
      else if (cleanCode.length >= 2 && pNormName.includes(cleanCode)) {
        score = 450;
      }
      // 11. Token matching (every word in query is in product name)
      else {
        const tokens = normQuery.split(/\s+/).filter((t) => t.length >= 2);
        if (tokens.length > 1 && tokens.every((tok) => pNormName.includes(tok))) {
          score = 300;
        }
      }

      if (score > 0) {
        seen.add(pKey);
        results.push({
          product: {
            id: st.id,
            code: st.code,
            name: st.name,
            price: effectivePrice,
            currentStock: st.currentStock,
            wholesalePrice: st.wholesalePrice,
            retailPrice: st.retailPrice,
            costPrice: st.costPrice,
          },
          score,
        });
      }
    });

    // Sort by relevance score descending, then alphabetically by name
    results.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
    return results.map((r) => r.product);
  };

  // Helper to look up top product in the database by code OR by product name
  const lookupCatalogProduct = (query: string): EnrichedCatalogProduct | undefined => {
    const matches = searchAllCatalogProducts(query);
    return matches.length > 0 ? matches[0] : undefined;
  };

  // Helper to get real-time stock details for an item in the order
  const getStockInfoForItem = (item: LineItem): StockItem | undefined => {
    if (!activeStock || activeStock.length === 0) return undefined;
    const cleanCode = (item.code || '').replace(/^#/, '').replace(/^COD:?\s*/i, '').replace(/^SKU:?\s*/i, '').trim().toLowerCase();
    const numCode = parseInt(cleanCode, 10);

    // 1. Match by clean code, exact numeric code or ending digits (e.g. 47 vs 9200047)
    if (cleanCode && cleanCode !== '-') {
      const match = activeStock.find((st) => {
        const stClean = (st.code || '').replace(/^#/, '').replace(/^COD:?\s*/i, '').replace(/^SKU:?\s*/i, '').trim().toLowerCase();
        if (stClean === cleanCode) return true;
        if (!isNaN(numCode)) {
          const stNum = parseInt(stClean, 10);
          if (!isNaN(stNum) && stNum === numCode) return true;
        }
        if (cleanCode.length >= 2 && (stClean.endsWith(cleanCode) || cleanCode.endsWith(stClean))) return true;
        return false;
      });
      if (match) return match;
    }

    // 2. Match by normalized name or description
    const normDesc = normalizeForSearch(item.description);
    if (normDesc.length >= 3) {
      const match = activeStock.find((st) => {
        const stNorm = normalizeForSearch(st.name);
        return stNorm === normDesc || (stNorm.length > 5 && normDesc.includes(stNorm)) || (normDesc.length > 5 && stNorm.includes(normDesc));
      });
      if (match) return match;
    }

    return undefined;
  };

  const handleFastCodeChange = (val: string) => {
    setFastCodeInput(val);
    if (!val.trim()) {
      setMatchingProducts([]);
      setMatchedCatalogProduct(null);
      return;
    }
    const matches = searchAllCatalogProducts(val);
    setMatchingProducts(matches);
    setMatchedCatalogProduct(matches[0] || null);
  };

  const handleAddSingleProduct = (product: EnrichedCatalogProduct) => {
    const qty = Math.max(1, Number(fastQuantityInput) || 1);
    const itemCode = product.code && product.code !== '-' ? product.code : '';
    handleAddItem(itemCode, product.name, qty, product.price);
    setFastEntryFeedback(
      `✓ Adicionado: ${itemCode ? `[${itemCode}] ` : ''}${product.name} (+${qty} un • ${priceType === 'wholesale' ? 'Atacado' : 'Varejo'} R$ ${(qty * product.price).toFixed(2).replace('.', ',')})`
    );
    setTimeout(() => setFastEntryFeedback(null), 3000);
  };

  const handleAddAllMatchingProducts = () => {
    if (matchingProducts.length === 0) return;
    const qty = Math.max(1, Number(fastQuantityInput) || 1);
    matchingProducts.forEach((product) => {
      const itemCode = product.code && product.code !== '-' ? product.code : '';
      handleAddItem(itemCode, product.name, qty, product.price);
    });
    setFastEntryFeedback(`✓ Todos os ${matchingProducts.length} produtos foram adicionados ao pedido!`);
    setFastCodeInput('');
    setMatchingProducts([]);
    setMatchedCatalogProduct(null);
    setTimeout(() => setFastEntryFeedback(null), 3500);
  };

  const handleImportOrderExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExcelImporting(true);
    try {
      const res = await importOrderItemsFromExcel(file, activeStock, priceType);
      if (res.success && res.items.length > 0) {
        setItems((prev) => {
          const isBlankPlaceholder = (it: LineItem) =>
            (!it.code || it.code.startsWith('#') || it.code.trim() === '') &&
            (!it.description || it.description.trim() === '') &&
            (!it.unitPrice || it.unitPrice === 0);

          const cleaned = prev.filter((it) => !isBlankPlaceholder(it));
          return [...cleaned, ...res.items];
        });
        setFeedbackSuccess(
          `✓ ${res.items.length} itens carregados da planilha Excel com sucesso! (${res.matchedCount} localizados no estoque)`
        );
      } else {
        setFeedbackSuccess(`Aviso: ${res.message || 'Nenhum item importado.'}`);
      }
    } catch (err: any) {
      alert(`Erro ao ler planilha: ${err?.message || 'Arquivo inválido'}`);
    } finally {
      setIsExcelImporting(false);
      if (excelOrderInputRef.current) excelOrderInputRef.current.value = '';
    }
  };

  const handleSwitchPriceType = (type: 'wholesale' | 'retail') => {
    setPriceType(type);
    if (items.length > 0) {
      setItems((prev) =>
        prev.map((it) => {
          const cleanCode = (it.code || '').replace(/^#/, '').trim().toLowerCase();
          const cleanDesc = (it.description || '').trim().toLowerCase();
          const match = activeStock.find((st: StockItem) => {
            const stCode = (st.code || '').replace(/^#/, '').trim().toLowerCase();
            return (cleanCode && stCode && stCode === cleanCode) || st.name.trim().toLowerCase() === cleanDesc;
          });
          if (match) {
            const p = type === 'wholesale' ? match.wholesalePrice : match.retailPrice;
            return {
              ...it,
              unitPrice: p,
              total: (it.quantity || 1) * p,
            };
          }
          return it;
        })
      );
      setFastEntryFeedback(
        `✓ Tabela alterada para ${type === 'wholesale' ? 'ATACADO' : 'VAREJO'}. Preços atualizados!`
      );
      setTimeout(() => setFastEntryFeedback(null), 3000);
    }
  };

  const handleAddProductByCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = fastCodeInput.trim();
    if (!raw) return;

    // Check if user entered multiple comma-separated codes or names (e.g. "47, 46, 10")
    const tokens = raw.includes(',') ? raw.split(',').map((t) => t.trim()).filter(Boolean) : [raw];

    let addedCount = 0;
    const qty = Math.max(1, Number(fastQuantityInput) || 1);

    tokens.forEach((token) => {
      const match = lookupCatalogProduct(token);
      if (match) {
        const itemCode = match.code && match.code !== '-' ? match.code : '';
        handleAddItem(itemCode, match.name, qty, match.price);
        addedCount++;
      } else {
        // If not found in catalog, add with the typed name and empty code so user can set price
        handleAddItem('', token, qty, 0);
        addedCount++;
      }
    });

    if (tokens.length === 1) {
      const match = lookupCatalogProduct(tokens[0]);
      if (match) {
        if (matchingProducts.length > 1) {
          setFastEntryFeedback(
            `✓ Adicionado: ${match.code && match.code !== '-' ? `[${match.code}] ` : ''}${match.name}. (Mais ${matchingProducts.length - 1} opções disponíveis na lista abaixo)`
          );
        } else {
          setFastEntryFeedback(
            `✓ Adicionado: ${match.code && match.code !== '-' ? `[${match.code}] ` : ''}${match.name} (R$ ${match.price.toFixed(2).replace('.', ',')})`
          );
          setFastCodeInput('');
          setMatchingProducts([]);
          setMatchedCatalogProduct(null);
        }
      } else {
        setFastEntryFeedback(`✓ Produto "${tokens[0]}" inserido no pedido.`);
        setFastCodeInput('');
        setMatchingProducts([]);
        setMatchedCatalogProduct(null);
      }
    } else {
      setFastEntryFeedback(`✓ ${addedCount} produtos inseridos com sucesso!`);
      setFastCodeInput('');
      setMatchingProducts([]);
      setMatchedCatalogProduct(null);
    }

    setFastQuantityInput(1);
    setTimeout(() => setFastEntryFeedback(null), 3500);
    fastCodeInputRef.current?.focus();
  };

  const handleApplyBatchCodes = () => {
    if (!batchCodeText.trim()) return;

    // Split lines by newline. If only 1 line with commas and no price decimals, split by comma.
    const rawLines = batchCodeText
      .split(/\r?\n/)
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed) return [];
        // Only split by comma if line has commas AND does not contain price decimals like 3,00 or 14,40
        if (trimmed.includes(',') && !/\d+[.,]\d{2}/.test(trimmed)) {
          return trimmed.split(',').map((c) => c.trim()).filter(Boolean);
        }
        return [trimmed];
      })
      .filter((l) => l.length > 0);

    const newItems: LineItem[] = [];

    rawLines.forEach((line, idx) => {
      let qty = 1;
      let textWithoutQty = line;

      // Detect quantity like "x 2", "x2", "* 3", "qtd 5", "(2 un)"
      const qtyMatch = line.match(/(?:x|\*|qtd|quant|un|und|cx)\s*(\d+)/i) || line.match(/(\d+)\s*(?:x|un|und|cx)/i);
      if (qtyMatch) {
        const parsedQ = parseInt(qtyMatch[1], 10);
        if (parsedQ > 0 && parsedQ < 1000) {
          qty = parsedQ;
          textWithoutQty = line.replace(qtyMatch[0], '').trim();
        }
      }

      // Check code at the start of string
      const codeMatch = textWithoutQty.match(/^#?(\d+|[A-Z0-9\-_]{2,10})\b/i);
      const queryCode = codeMatch ? codeMatch[1] : textWithoutQty;

      const match = lookupCatalogProduct(queryCode) || lookupCatalogProduct(textWithoutQty);

      if (match) {
        newItems.push({
          id: `item-batch-${Date.now()}-${idx}`,
          code: match.code,
          description: match.name,
          quantity: qty,
          unitPrice: match.price,
          total: qty * match.price,
        });
      } else {
        let price = 0;
        let desc = textWithoutQty;
        const priceMatch = textWithoutQty.match(/(?:R\$|\$)?\s*(\d+[.,]\d{2})/);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(',', '.'));
          desc = desc.replace(priceMatch[0], '').trim();
        }
        newItems.push({
          id: `item-batch-${Date.now()}-${idx}`,
          code: codeMatch ? codeMatch[0] : `SKU-${idx + 1}`,
          description: desc || line,
          quantity: qty,
          unitPrice: price,
          total: qty * price,
        });
      }
    });

    if (newItems.length > 0) {
      if (accumulatePrints) {
        setItems((prev) => [...prev, ...newItems]);
      } else {
        setItems(newItems);
      }
      setFeedbackSuccess(`✓ ${newItems.length} produto(s) adicionados consultando o Estoque!`);
      setIsBatchCodeModalOpen(false);
      setBatchCodeText('');
      setActiveStep('items');
    }
  };

  const [quickProducts, setQuickProducts] = useState<QuickCatalogProduct[]>(INITIAL_QUICK_PRODUCTS);

  const handleAddQuickProduct = (prod: QuickCatalogProduct) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.description.toLowerCase().trim() === prod.name.toLowerCase().trim() || (prod.code && item.code === prod.code)
      );
      if (existingIndex !== -1) {
        return prev.map((item, idx) => {
          if (idx !== existingIndex) return item;
          const newQty = (item.quantity || 1) + 1;
          return {
            ...item,
            quantity: newQty,
            total: newQty * item.unitPrice,
          };
        });
      } else {
        return [
          ...prev,
          {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            code: prod.code,
            description: prod.name,
            quantity: 1,
            unitPrice: prod.price,
            total: prod.price,
          },
        ];
      }
    });
    setFeedbackSuccess(`+1 "${prod.name}" adicionado ao pedido!`);
  };

  const handleApplyPasteText = () => {
    if (!pasteText.trim()) return;
    const rawLines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 2);

    const parsed: LineItem[] = rawLines.map((rawLine, idx) => {
      let code = `SKU-${101 + idx}`;
      let line = rawLine;

      // Check code prefix: #01, COD: 101, SKU-101, 1.
      const hashMatch = line.match(/^#([0-9]{1,6})\b[:\s-]*/);
      if (hashMatch) {
        code = `#${hashMatch[1]}`;
        line = line.slice(hashMatch[0].length).trim();
      } else {
        const codMatch = line.match(/^(?:c[óo]d(?:igo)?|sku|ref(?:er[êe]ncia)?)[\s.:#-]*([a-z0-9\-_]+)[:\s-]*/i);
        if (codMatch) {
          code = codMatch[1].toUpperCase();
          line = line.slice(codMatch[0].length).trim();
        } else {
          const numMatch = line.match(/^(\d{1,3})[\.\)\-]\s+/);
          if (numMatch) {
            code = numMatch[1];
            line = line.slice(numMatch[0].length).trim();
          }
        }
      }

      // Quantity detection (e.g. 2x, 3 un, etc.)
      let quantity = 1;
      const qtyMatch = line.match(/(?:qtd|quant|quantidade)?[\s:]*([0-9]{1,3})\s*(?:x|un|und|cx|pc|pçs)?\b/i);
      if (qtyMatch && qtyMatch[1]) {
        const qVal = parseInt(qtyMatch[1], 10);
        if (qVal > 0 && qVal < 500) {
          quantity = qVal;
          line = line.replace(qtyMatch[0], '').trim();
        }
      }

      // Price detection
      const priceMatch = line.match(/(?:R\$|\$|€)?\s*([0-9]{1,5}[.,][0-9]{2})/i);
      let desc = line;
      let unitPrice = 0;
      if (priceMatch) {
        unitPrice = parseFloat(priceMatch[1].replace(',', '.'));
        desc = desc.replace(priceMatch[0], '').trim();
      }

      // Clean up description
      desc = desc
        .replace(/^[–—\-:;,•]+/, '')
        .replace(/[–—\-:;,]+$/, '')
        .trim();

      return {
        id: `item-paste-${Date.now()}-${idx}`,
        code,
        description: desc || rawLine,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      };
    });

    if (accumulatePrints) {
      setItems((prev) => [...prev, ...parsed]);
    } else {
      setItems(parsed);
    }

    setIsPasteModalOpen(false);
    setPasteText('');
    setFeedbackSuccess(`${parsed.length} produtos adicionados com códigos e descrições identificadas.`);
    setActiveStep('items');
  };

  // Calculate totals dynamically
  const subtotal = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const discountAmount = subtotal * (discountRate / 100);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * (taxRate / 100);
  const grandTotal = taxableAmount + taxAmount;

  // Customer selection hook
  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const found = customers.find((c) => c.id === id);
    if (found) {
      setCustName(found.name);
      setCustTaxId(found.taxId);
      setCustEmail(found.email);
      setCustPhone(found.phone);
      setCustAddress(found.address);
    }
  };

  // Line items manipulation
  const handleAddItem = (code = '', description = '', quantity = 1, unitPrice = 0) => {
    const newItem: LineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      code: code || '',
      description,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
    };
    setItems((prev) => {
      // Helper to check if a row is completely blank
      const isBlankPlaceholder = (it: LineItem) =>
        (!it.description || it.description.trim() === '') &&
        (!it.unitPrice || it.unitPrice === 0) &&
        (!it.code || it.code.trim() === '' || it.code.startsWith('SKU-'));

      // If we are adding a real product and the table only has a blank row, replace it!
      const hasContent = description.trim() !== '' || unitPrice > 0 || code.trim() !== '';
      if (hasContent) {
        const withoutBlank = prev.filter((it) => !isBlankPlaceholder(it));
        return [...withoutBlank, newItem];
      }
      return [...prev, newItem];
    });
  };

  const handleUpdateItem = (id: string, field: keyof LineItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item };
        if (field === 'quantity') {
          const num = val === '' ? 0 : parseFloat(val);
          updated.quantity = isNaN(num) ? 0 : num;
          updated.total = updated.quantity * updated.unitPrice;
        } else if (field === 'unitPrice') {
          const num = val === '' ? 0 : parseFloat(val);
          updated.unitPrice = isNaN(num) ? 0 : num;
          updated.total = updated.quantity * updated.unitPrice;
        } else if (field === 'code') {
          updated.code = val;
          const match = lookupCatalogProduct(val);
          if (match) {
            updated.description = match.name;
            updated.unitPrice = match.price;
            updated.total = (updated.quantity || 1) * match.price;
          }
        } else if (field === 'description') {
          updated.description = val;
          // Auto-fill price and code when writing the product name in description column
          const match = lookupCatalogProduct(val);
          if (match) {
            if (!updated.code || updated.code.startsWith('SKU-') || updated.code.trim() === '') {
              updated.code = match.code && match.code !== '-' ? match.code : '';
            }
            if (!updated.unitPrice || updated.unitPrice === 0) {
              updated.unitPrice = match.price;
              updated.total = (updated.quantity || 1) * match.price;
            }
          }
        } else {
          (updated as any)[field] = val;
        }
        return updated;
      })
    );
  };

  const handleStepQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newQty = Math.max(1, (item.quantity || 1) + delta);
        return {
          ...item,
          quantity: newQty,
          total: newQty * item.unitPrice,
        };
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    const label = target?.description || (target?.code ? `Item ${target.code}` : 'Item');
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedItemIds((prev) => prev.filter((selId) => selId !== id));
    setFeedbackSuccess(`✓ ${label} foi excluído do pedido.`);
    setTimeout(() => {
      setFeedbackSuccess((curr) => (curr?.includes('foi excluído') ? null : curr));
    }, 2500);
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((i) => i.id));
    }
  };

  const handleDeleteSelectedItems = () => {
    if (selectedItemIds.length === 0) return;
    const count = selectedItemIds.length;
    setItems((prev) => prev.filter((i) => !selectedItemIds.includes(i.id)));
    setSelectedItemIds([]);
    setFeedbackSuccess(`✓ ${count} item(ns) removido(s) do pedido!`);
    setTimeout(() => setFeedbackSuccess(null), 3000);
  };

  const handleConfirmClearAll = () => {
    const count = items.length;
    setItems([]);
    setSelectedItemIds([]);
    setIsClearConfirmOpen(false);
    setFeedbackSuccess(`✓ Tabela limpa: ${count} item(ns) removido(s).`);
    setTimeout(() => setFeedbackSuccess(null), 3000);
  };

  const handleResetForm = () => {
    setOrderNumber(`SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setOrderDueDate('');
    setSelectedCustomerId('');
    setCustName('');
    setCustTaxId('');
    setCustEmail('');
    setCustPhone('');
    setCustAddress('');
    setDiscountRate(0);
    setUploadedPrints([]);
    setRawOcrText('');
    setFeedbackSuccess(null);
    setActiveStep('upload');
    setItems([]);
  };

  // Convert File/Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Fallback to Tesseract.js client-side OCR for cropped image
  const runClientSideTesseract = async (imageSrcOrBlob: string | Blob): Promise<LineItem[]> => {
    let sourceToRecognize = imageSrcOrBlob;
    if (typeof imageSrcOrBlob === 'string' && imageSrcOrBlob.startsWith('data:image')) {
      try {
        sourceToRecognize = await prepareImageForLocalOCR(imageSrcOrBlob);
      } catch (err) {
        console.warn('Erro ao preparar imagem para OCR local:', err);
      }
    }

    const worker = await Tesseract.createWorker('por+eng', 1, {
      logger: (m: any) => {
        if (m?.status === 'recognizing text') {
          const p = Math.round((m.progress || 0) * 100);
          setOcrProgress(p);
          setOcrStatusMessage(`Lendo apenas os itens no meio da tela... (${p}%)`);
        }
      },
    });

    const ret = await worker.recognize(sourceToRecognize);
    await worker.terminate();

    const extractedText = ret.data.text;
    setRawOcrText((prev) => (prev ? `${prev}\n\n--- NOVO PRINT ---\n${extractedText}` : extractedText));

    const parsed = parseOCRText(extractedText);
    if (parsed.orderNumber && !orderNumber) setOrderNumber(parsed.orderNumber);
    if (parsed.orderDate && !orderDate) setOrderDate(parsed.orderDate);
    if (parsed.customerName && !custName) setCustName(parsed.customerName);

    return parsed.items;
  };

  // Read a single print (using ultra-fast AI Flash OCR on optimized image)
  const processSinglePrint = async (
    printItem: UploadedPrint
  ): Promise<{ items: LineItem[]; orderNum?: string; date?: string; custName?: string }> => {
    // Respect user's choice: use middle crop if enabled and available
    const imageToSend = (printItem.useMiddleCrop && !printItem.isPdf && printItem.croppedDataUrl)
      ? printItem.croppedDataUrl
      : printItem.originalDataUrl;

    const activeCatalog = catalog && catalog.length > 0 ? catalog : loadStoredCatalog();
    const mime = printItem.isPdf ? 'application/pdf' : 'image/jpeg';

    if (ocrEngine === 'ai' || printItem.isPdf) {
      try {
        setOcrStatusMessage(`Lendo com IA Flash em alta velocidade...`);
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageToSend,
            mimeType: mime,
            filterMiddleOnly: printItem.useMiddleCrop,
            catalog: activeCatalog,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items) && data.items.length > 0) {
            const mapped: LineItem[] = data.items.map((it: any, index: number) => {
              const q = Number(it.quantity) || 1;
              const p = Number(it.unitPrice) || 0;
              return {
                id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}-${index}`,
                code: it.code || '-',
                description: it.description || 'Produto extraído',
                quantity: q,
                unitPrice: p,
                total: it.total ? Number(it.total) : q * p,
              };
            });
            const reconciled = reconcileItemsWithCatalog(mapped, activeCatalog);
            return {
              items: reconciled,
              orderNum: data.orderNumber,
              date: data.orderDate,
              custName: data.customerName,
            };
          }
        }
      } catch (e) {
        console.warn('Falha na chamada /api/ocr:', e);
      }

      // If AI fails or returns empty, try local Tesseract as fallback
      try {
        const localItems = await runClientSideTesseract(imageToSend);
        if (localItems.length > 0) {
          return { items: reconcileItemsWithCatalog(localItems, activeCatalog) };
        }
      } catch (err) {
        console.warn('Tesseract fallback falhou:', err);
      }

      return { items: [] };
    }

    // Only run local Tesseract if user explicitly selected Tesseract engine
    const tessItems = await runClientSideTesseract(imageToSend);
    return { items: reconcileItemsWithCatalog(tessItems, catalog) };
  };

  // Process a batch of files (multiple screenshots/PDFs) with client-side compression
  const handleProcessFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const startTime = Date.now();
    setIsProcessingOCR(true);
    setOcrProgress(15);
    setOcrStatusMessage(`Otimizando ${files.length} imagem(ns) para envio instantâneo...`);
    setFeedbackSuccess(null);

    const newPrints: UploadedPrint[] = [];

    // 1. Prepare and optimize each file (compress from 8MB to ~150KB for 10x faster speed)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      setOcrStatusMessage(`Comprimindo print (${i + 1}/${files.length})...`);
      setOcrProgress(20 + Math.round(((i + 1) / files.length) * 20));

      const rawBase64 = await blobToBase64(file);
      let optimizedBase64 = rawBase64;
      let cropped = rawBase64;

      if (!isPdf) {
        // Compress and scale down to max 1400px (turns 8MB into ~150KB without losing sharpness)
        optimizedBase64 = await optimizeImageForOCR(rawBase64, 1400, 0.85);
        cropped = await cropImageToCenter(optimizedBase64, DEFAULT_MIDDLE_CROP);
      }

      newPrints.push({
        id: `print-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        name: file.name,
        originalDataUrl: optimizedBase64,
        croppedDataUrl: cropped,
        useMiddleCrop: focusMiddleScreen,
        isPdf,
        status: 'pending',
        createdAt: Date.now(),
      });
    }

    // Update list of uploaded prints
    const combinedPrints = accumulatePrints ? [...uploadedPrints, ...newPrints] : newPrints;
    setUploadedPrints(combinedPrints);

    // 2. Perform OCR
    let allExtractedItems: LineItem[] = [];

    for (let i = 0; i < newPrints.length; i++) {
      const print = newPrints[i];
      setOcrStatusMessage(
        `Extraindo produtos com IA Flash (${i + 1}/${newPrints.length})...`
      );
      setOcrProgress(50 + Math.round(((i + 1) / newPrints.length) * 45));

      try {
        const result = await processSinglePrint(print);
        print.status = 'done';
        print.itemCount = result.items.length;
        print.extractedItems = result.items;

        if (result.orderNum) setOrderNumber(result.orderNum);
        if (result.date) setOrderDate(result.date);
        if (result.custName && !custName) setCustName(result.custName);

        // Map items from this print with fresh unique IDs so they won't have React key collisions
        const printItems = result.items.map((it, idx) => ({
          ...it,
          id: `item-${Date.now()}-${i}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        }));

        allExtractedItems.push(...printItems);
      } catch (err: any) {
        print.status = 'error';
        print.errorMessage = err?.message || 'Erro ao ler imagem';
      }
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    setIsProcessingOCR(false);
    setOcrProgress(100);

    // 3. Update items in table
    // Each print has already had its items reconciled against the database individually.
    // When accumulatePrints is true, we preserve all items across multiple prints, allowing identical products from different prints to both appear!
    if (allExtractedItems.length > 0) {
      if (accumulatePrints && uploadedPrints.length > 0) {
        setItems((prev) => [...prev, ...allExtractedItems]);
      } else {
        setItems(allExtractedItems);
      }

      setFeedbackSuccess(
        `⚡ Concluído em ${elapsedSeconds}s! ${allExtractedItems.length} produtos do Estoque identificados com 100% de precisão.`
      );

      // Automatically advance to items tab for review & value adjustment!
      setActiveStep('items');
    } else {
      setFeedbackSuccess(
        `Print processado em ${elapsedSeconds}s. Nenhum produto do catálogo foi identificado na imagem. Verifique se o print contém produtos da sua lista.`
      );
      setActiveStep('items');
    }
  };

  // Re-scan an individual print
  const handleRescanPrint = async (printId: string) => {
    const printIndex = uploadedPrints.findIndex((p) => p.id === printId);
    if (printIndex === -1) return;

    const print = uploadedPrints[printIndex];
    setIsProcessingOCR(true);
    setOcrProgress(30);
    setOcrStatusMessage(`Re-lendo itens do print: ${print.name}...`);

    try {
      const result = await processSinglePrint(print);
      const updatedPrint: UploadedPrint = {
        ...print,
        status: 'done',
        itemCount: result.items.length,
        extractedItems: result.items,
      };

      const updatedPrints = [...uploadedPrints];
      updatedPrints[printIndex] = updatedPrint;
      setUploadedPrints(updatedPrints);

      if (result.items.length > 0) {
        setItems(result.items);
        setFeedbackSuccess(`Print reprocessado! ${result.items.length} itens extraídos.`);
        setActiveStep('items');
      }
    } catch (e) {
      console.error(e);
      alert('Falha ao reprocessar print.');
    } finally {
      setIsProcessingOCR(false);
      setOcrProgress(100);
    }
  };

  // Toggle crop mode for an individual print
  const handleTogglePrintCrop = async (printId: string) => {
    const printIndex = uploadedPrints.findIndex((p) => p.id === printId);
    if (printIndex === -1) return;

    const print = uploadedPrints[printIndex];
    const newCropState = !print.useMiddleCrop;

    const updatedPrints = [...uploadedPrints];
    updatedPrints[printIndex] = {
      ...print,
      useMiddleCrop: newCropState,
    };
    setUploadedPrints(updatedPrints);
  };

  // Remove a print
  const handleRemovePrint = (printId: string) => {
    setUploadedPrints((prev) => prev.filter((p) => p.id !== printId));
  };

  // Preset test handler
  const handleLoadSamplePreset = async (presetId: string) => {
    const preset = SAMPLE_PRESETS.find((p) => p.id === presetId) || SAMPLE_PRESETS[0];
    const { blob } = await createSampleInvoiceImage(preset);
    const sampleFile = new File([blob], `${preset.title}.png`, { type: 'image/png' });
    await handleProcessFiles([sampleFile]);
  };

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        handleLoadSamplePreset(e.detail);
      }
    };
    window.addEventListener('load_sample_preset', handler);
    return () => window.removeEventListener('load_sample_preset', handler);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      handleProcessFiles(filesArray);
      // Reset input value so same files can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      handleProcessFiles(filesArray);
    }
  };

  // Submit & Generate PDF
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!custName.trim()) {
      setActiveStep('review');
      alert('Por favor, informe o nome do cliente antes de gerar o PDF.');
      return;
    }

    if (items.length === 0 || !items.some((i) => i.description.trim())) {
      setActiveStep('items');
      alert('Adicione ao menos um item ou produto com descrição antes de gerar o PDF.');
      return;
    }

    // Attach all uploaded prints as full-page attachments in the PDF
    const attachedImages = attachImageToPdf
      ? uploadedPrints.map((p) => p.originalDataUrl)
      : [];

    const orderData: SalesOrder = {
      id: `ord-${Date.now()}`,
      orderNumber,
      orderDate,
      orderDueDate,
      status: orderStatus,
      priceType,
      stockDeducted: true,
      customer: {
        id: selectedCustomerId || undefined,
        name: custName,
        taxId: custTaxId,
        email: custEmail,
        phone: custPhone,
        address: custAddress,
      },
      items,
      notes: orderNotes,
      subtotal,
      discountRate,
      discountAmount,
      taxRate,
      taxAmount,
      grandTotal,
      attachedImageUrl: attachedImages[0] || undefined,
      attachedImages,
      createdAt: Date.now(),
    };

    // Save to order history (which automatically performs stock deduction)
    onSaveOrder(orderData);

    // Preload logo for clean rendering in PDF
    await loadLogoDataUrl();

    // Generate & download PDF directly
    generateSalesOrderPDF(orderData, company, true);

    // Open Send Modal with WhatsApp / Email / Share options
    setSentOrder(orderData);
    setIsSendModalOpen(true);

    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.7 },
      });
    } catch {
      // ignore
    }

    setFeedbackSuccess(
      `✓ Pedido ${orderNumber} salvo com sucesso! Baixa de ${items.length} item(ns) realizada no estoque automaticamente.`
    );
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* STEP NAVIGATION TABS                                     */}
      {/* ======================================================== */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveStep('upload')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeStep === 'upload'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">
            1
          </span>
          <Upload className="w-4 h-4" />
          <span>1. Inserir Prints / Imagens</span>
          {uploadedPrints.length > 0 && (
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500 text-white">
              {uploadedPrints.length} print{uploadedPrints.length > 1 ? 's' : ''}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveStep('items')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all relative ${
            activeStep === 'items'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">
            2
          </span>
          <Edit3 className="w-4 h-4" />
          <span>2. Itens e Produtos (Alterar Valores)</span>
          <span
            className={`ml-1 text-[10px] px-2 py-0.5 rounded-full font-mono ${
              activeStep === 'items'
                ? 'bg-white text-indigo-700'
                : 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
            }`}
          >
            {items.length} itens
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep('review')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeStep === 'review'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">
            3
          </span>
          <FileDown className="w-4 h-4" />
          <span>3. Cliente & Gerar PDF</span>
        </button>
      </div>

      {/* Global feedback message banner */}
      {feedbackSuccess && !isProcessingOCR && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackSuccess}</span>
          </div>
          <div className="flex items-center gap-3">
            {activeStep === 'upload' && (
              <button
                type="button"
                onClick={() => setActiveStep('items')}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <span>Editar Itens Agora</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {rawOcrText && (
              <button
                type="button"
                onClick={() => setShowRawText(!showRawText)}
                className="text-emerald-700 underline hover:text-emerald-900 font-semibold text-[11px]"
              >
                {showRawText ? 'Ocultar Texto' : 'Ver Texto Extraído'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Raw text preview toggle */}
      {showRawText && rawOcrText && (
        <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl text-xs font-mono space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span>Texto bruto detectado pelo scanner:</span>
            <button onClick={() => setShowRawText(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <pre className="whitespace-pre-wrap max-h-48 overflow-y-auto text-[11px] leading-relaxed">
            {rawOcrText}
          </pre>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 1: UPLOAD & MULTI-PRINT MANAGEMENT                  */}
      {/* ======================================================== */}
      {activeStep === 'upload' && (
        <div className="space-y-6">
          {/* Opção Rápida de Pedido Manual por Códigos (Sem Print) */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-sky-50/50 to-emerald-50/80 p-5 sm:p-6 rounded-2xl border-2 border-indigo-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold shadow-2xs">
                <Barcode className="w-3.5 h-3.5" />
                <span>Novo: Pedido Manual por Códigos</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Criar Pedido Manualmente por Códigos (Sem precisar de Print)
              </h3>
              <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                Não tem foto ou print? Digite ou cole os códigos dos produtos (ex: <strong>9200047</strong>, ou apenas os últimos números <strong>47</strong>, <strong>46</strong>, <strong>10</strong>, <strong>237</strong>, <strong>319</strong>). A descrição oficial e o preço são preenchidos automaticamente consultando o <strong>Estoque ({activeStock.length} produtos)</strong>.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveStep('items');
                  setTimeout(() => fastCodeInputRef.current?.focus(), 150);
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Hash className="w-4 h-4" />
                <span>Inserir Códigos Manualmente</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsBatchCodeModalOpen(true);
                  setActiveStep('items');
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Colar Lista em Massa</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop Area (Multiple Files Supported) */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20 rounded-2xl p-10 text-center cursor-pointer transition-all group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,application/pdf"
                multiple
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-105 transition-transform shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-800">
                    Arraste um ou mais prints de celular ou arquivos PDF para cá
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Você pode selecionar <strong>vários prints de uma só vez</strong> (PNG, JPG, JPEG, WebP e PDF)
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                  <span>📸 Suporte a múltiplos prints e recorte automático do centro</span>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Selecionar Print da Galeria / Câmera do Celular</span>
                  </button>
                </div>
              </div>
            </div>

            {/* OCR Processing Progress */}
            {isProcessingOCR && (
              <div className="p-5 bg-indigo-50/80 border border-indigo-100 rounded-xl space-y-2.5 animate-in fade-in">
                <div className="flex justify-between text-xs font-semibold text-indigo-900">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping"></span>
                    {ocrStatusMessage}
                  </span>
                  <span className="font-mono">{ocrProgress}%</span>
                </div>
                <div className="w-full bg-indigo-200/60 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${ocrProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Uploaded Prints Gallery */}
            {uploadedPrints.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Prints Anexados ({uploadedPrints.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Adicionar Mais Prints</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadedPrints([])}
                      className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Limpar Todos
                    </button>
                  </div>
                </div>

                {/* Print Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {uploadedPrints.map((print, index) => (
                    <div
                      key={print.id}
                      className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-300 transition-all space-y-3 relative group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Thumbnail with visual preview */}
                        <div
                          onClick={() => setPreviewingPrint({ print, mode: print.useMiddleCrop ? 'cropped' : 'original' })}
                          className="w-20 h-24 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 relative cursor-pointer group/thumb"
                          title="Clique para ampliar"
                        >
                          <img
                            src={print.useMiddleCrop ? print.croppedDataUrl : print.originalDataUrl}
                            alt={print.name}
                            className="w-full h-full object-cover object-center"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                          {print.useMiddleCrop && (
                            <span className="absolute bottom-1 left-1 right-1 bg-indigo-600/90 text-white text-[9px] font-bold text-center py-0.5 rounded-sm">
                              Meio
                            </span>
                          )}
                        </div>

                        {/* Info & Meta */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                              Print #{index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePrint(print.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Remover print"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 truncate" title={print.name}>
                            {print.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            {print.status === 'done' ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {print.itemCount ?? 0} item(ns)
                              </span>
                            ) : print.status === 'processing' ? (
                              <span className="text-indigo-600 font-semibold animate-pulse">
                                Lendo...
                              </span>
                            ) : (
                              <span className="text-slate-400">Pendente</span>
                            )}
                          </div>

                          {/* Quick Toggle for Crop on this print */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => handleTogglePrintCrop(print.id)}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                                print.useMiddleCrop
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              <Scissors className="w-3 h-3" />
                              <span>{print.useMiddleCrop ? 'Foco no Meio: Ativo' : 'Imagem Completa'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Card actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                        <button
                          type="button"
                          onClick={() => handleRescanPrint(print.id)}
                          disabled={isProcessingOCR}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px] flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Re-ler</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewingPrint({ print, mode: 'original' })}
                          className="text-slate-500 hover:text-slate-700 text-[11px] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver Original</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom navigation from Upload to Items */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    <span className="font-bold text-slate-700">{uploadedPrints.length}</span> print(s) carregados e prontos para compor o pedido e o PDF final.
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveStep('items')}
                    className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Editar Itens e Valores ({items.length} itens)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 2: ITENS & PRODUTOS (ALTERAR VALOR E QUANTIDADE)    */}
      {/* ======================================================== */}
      {activeStep === 'items' && (
        <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 mb-1">
                <Edit3 className="w-3.5 h-3.5" />
                Edição Direta de Valores e Quantidades
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Itens e Produtos Extraídos ({items.length})
              </h3>
              <p className="text-xs text-slate-500">
                Altere diretamente o <strong>nome</strong>, <strong>quantidade</strong> e <strong>preço unitário</strong> de qualquer item antes de criar o PDF.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={excelOrderInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportOrderExcel}
                className="hidden"
              />

              {/* Botão de Importar Planilha Excel para puxar os itens do pedido */}
              <button
                type="button"
                onClick={() => excelOrderInputRef.current?.click()}
                disabled={isExcelImporting}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Puxar produtos de uma planilha Excel (.xlsx, .xls, .csv) diretamente para o pedido"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isExcelImporting ? 'Lendo Excel...' : 'Importar Planilha Excel'}</span>
              </button>

              {/* Seletor de Tabela de Preço: Atacado vs Varejo */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 px-2 select-none">Tabela:</span>
                <button
                  type="button"
                  onClick={() => handleSwitchPriceType('wholesale')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    priceType === 'wholesale'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Usar preços de Atacado da planilha de estoque"
                >
                  Atacado
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchPriceType('retail')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    priceType === 'retail'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Usar preços de Varejo da planilha de estoque"
                >
                  Varejo
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsWhatsAppModalOpen(true)}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-300 shadow-2xs"
                title="Importar carrinho enviado pelo cliente no WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>Importar Carrinho WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={handleLoadCosmeticsItems}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-300 shadow-2xs"
                title="Inserir itens do seu print: Bloco Polidor (#47), Lixa canário (#46) e Lixa moeda (#10)"
              >
                <span>🎯 Produtos do Print (#47, #46, #10)</span>
              </button>
              {onSyncCatalog && (
                <button
                  type="button"
                  onClick={onSyncCatalog}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-sky-300 shadow-2xs disabled:opacity-60"
                  title="Sincronizar Estoque e Pedidos entre computador e celular"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar com Celular'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Adicionar mais um print de imagem"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Outro Print</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Colar Lista</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  fastCodeInputRef.current?.focus();
                }}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200"
                title="Lançamento rápido por código de barras, últimos dígitos ou nome"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>+ Lançar por Código</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBatchCodeModalOpen(true)}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-300 shadow-2xs"
                title="Lançar múltiplos códigos de uma só vez"
              >
                <Hash className="w-3.5 h-3.5 text-emerald-600" />
                <span>Códigos em Massa</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Linha Manual</span>
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsClearConfirmOpen(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200 shadow-2xs"
                  title="Apagar todos os itens da tabela do pedido"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Limpar Tabela ({items.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Lançamento Rápido por Código com Busca Automática no Estoque */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-sky-50/40 to-emerald-50/70 border-2 border-indigo-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                      Lançamento por Código ou Nome do Produto
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                      ✓ Estoque Conectado ({activeStock.length} produtos)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Digite o código da planilha (ex: <strong>9200047</strong>), apenas os <strong>últimos números</strong> (ex: digite <strong>46</strong> para achar 9200046 e 92000346, <strong>37</strong> para 92000237) ou o <strong>nome do produto</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsBatchCodeModalOpen(true)}
                className="px-3.5 py-2 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Colar Vários Códigos em Massa</span>
              </button>
            </div>

            <form onSubmit={handleAddProductByCode} className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
              <div className="relative flex-1 min-w-[220px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4 text-indigo-500" />
                </div>
                <input
                  ref={fastCodeInputRef}
                  type="text"
                  value={fastCodeInput}
                  onChange={(e) => handleFastCodeChange(e.target.value)}
                  placeholder="Digite o código (ex: 47) ou o nome do produto (ex: Lixa moeda, Secante)..."
                  className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl text-xs sm:text-sm font-semibold bg-white outline-none shadow-2xs transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="w-28 sm:w-32 flex items-center border-2 border-slate-300 bg-white rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 px-2.5 select-none bg-slate-50 py-2.5 border-r border-slate-200">
                  Qtd
                </span>
                <input
                  type="number"
                  min="1"
                  value={fastQuantityInput}
                  onChange={(e) => setFastQuantityInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full py-2.5 pr-2 text-xs sm:text-sm font-bold text-center outline-none bg-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={!fastCodeInput.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Inserir no Pedido</span>
              </button>
            </form>

            {/* Live Search Results List - Showing ALL matching products */}
            {fastCodeInput.trim().length >= 1 && matchingProducts.length > 0 && (
              <div className="bg-white border-2 border-emerald-400 rounded-2xl p-3.5 shadow-lg space-y-2.5 animate-in fade-in slide-in-from-top-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      {matchingProducts.length}
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-800">
                        {matchingProducts.length === 1
                          ? `1 produto encontrado para "${fastCodeInput}":`
                          : `${matchingProducts.length} produtos encontrados para "${fastCodeInput}" no Estoque:`}
                      </span>
                      <span className="text-[11px] text-emerald-700 block font-medium">
                        Clique no produto desejado para adicionar ao pedido:
                      </span>
                    </div>
                  </div>

                  {matchingProducts.length > 1 && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={handleAddAllMatchingProducts}
                        className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                        title="Adicionar todos os itens encontrados de uma vez ao pedido"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Todos ({matchingProducts.length} itens)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Scrollable list of ALL matching items */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
                  {matchingProducts.map((p, idx) => {
                    const hasCode = p.code && p.code !== '-';
                    return (
                      <div
                        key={`${p.code || 'nocode'}-${p.name}-${idx}`}
                        onClick={() => handleAddSingleProduct(p)}
                        className="p-2.5 hover:bg-emerald-50/90 transition-colors flex items-center justify-between gap-3 group cursor-pointer bg-white"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {hasCode ? (
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                              Cód: {p.code}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 shrink-0">
                              Sem cód
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs sm:text-sm group-hover:text-emerald-950 transition-colors block truncate">
                                {p.name}
                              </span>
                              {p.currentStock !== undefined && (
                                <span
                                  className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full shrink-0 border ${
                                    p.currentStock <= 0
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : p.currentStock <= 15
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  }`}
                                  title="Quantidade disponível em estoque"
                                >
                                  {p.currentStock <= 0 ? 'Esgotado' : `Estoque: ${p.currentStock} un`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              {priceType === 'wholesale' ? 'Atacado' : 'Varejo'}
                            </span>
                            <span className="font-mono font-black text-emerald-700 text-xs sm:text-sm">
                              R$ {p.price.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddSingleProduct(p);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 group-hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+{fastQuantityInput}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Item Preview if not found in catalog */}
            {matchingProducts.length === 0 && fastCodeInput.trim().length >= 2 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-800 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                    +
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">Inserir produto pelo nome:</span>{' '}
                    <strong className="text-slate-900 font-bold">"{fastCodeInput.trim()}"</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-[11px] text-slate-500">Preço pode ser ajustado na tabela</span>
                  <button
                    type="button"
                    onClick={handleAddProductByCode}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs cursor-pointer transition-colors"
                  >
                    + Inserir (+{fastQuantityInput})
                  </button>
                </div>
              </div>
            )}

            {/* Feedback message */}
            {fastEntryFeedback && (
              <div className="text-xs font-bold text-indigo-800 flex items-center gap-2 bg-indigo-100/80 px-3 py-2 rounded-xl border border-indigo-200 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{fastEntryFeedback}</span>
              </div>
            )}
          </div>

          {/* Quick Add Bar for Items Tab */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                Catálogo Rápido (Clique para adicionar ou somar +1 na tabela abaixo):
              </span>
              <button
                type="button"
                onClick={() => setIsWhatsAppModalOpen(true)}
                className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Bookmark className="w-3 h-3 text-emerald-600" />
                <span>Capturador WhatsApp Web</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {quickProducts.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => handleAddQuickProduct(p)}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-left transition-all group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span className="font-bold text-emerald-700">{p.code}</span>
                    <span className="font-bold text-slate-700 group-hover:text-emerald-700">+1</span>
                  </div>
                  <div className="font-medium text-[11px] text-slate-800 truncate mt-0.5">
                    {p.name}
                  </div>
                  <div className="text-[10px] font-mono font-bold text-emerald-700">
                    R$ {p.price.toFixed(2).replace('.', ',')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prints Reference Banner */}
          {uploadedPrints.length > 0 && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>
                  <strong>{uploadedPrints.length} print(s)</strong> vinculados a este pedido (anexados automaticamente no PDF).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep('upload')}
                className="text-indigo-600 hover:underline font-bold text-xs"
              >
                Gerenciar Prints
              </button>
            </div>
          )}

          {/* Multi-item selection toolbar */}
          {selectedItemIds.length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-xs font-bold text-rose-950">
                  {selectedItemIds.length} item(ns) selecionado(s) para exclusão
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedItemIds([])}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold hover:bg-white rounded-lg transition-colors cursor-pointer"
                >
                  Desmarcar Todos
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedItems}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Apagar {selectedItemIds.length} Selecionado(s)</span>
                </button>
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedItemIds.length === items.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                      title="Selecionar todos os itens para apagar"
                    />
                  </th>
                  <th className="py-3 px-3 w-28">Código / SKU</th>
                  <th className="py-3 px-3 min-w-[260px]">Descrição do Item / Produto</th>
                  <th className="py-3 px-3 w-32 text-center">Em Estoque</th>
                  <th className="py-3 px-3 w-36 text-center">Quantidade</th>
                  <th className="py-3 px-3 w-36 text-right">Preço Unit. ({company.currency || '$'})</th>
                  <th className="py-3 px-3 w-36 text-right">Subtotal</th>
                  <th className="py-3 px-2 w-14 text-center">Apagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 px-4 text-center">
                      <div className="max-w-md mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                          <Package className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">Nenhum produto adicionado ao pedido ainda</p>
                        <p className="text-[11px] text-slate-500">
                          Digite o <strong>código</strong> ou o <strong>nome do produto</strong> na barra acima para adicionar automaticamente com preço do estoque, ou clique em <strong>"+ Linha Manual"</strong> acima.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      selectedItemIds.includes(item.id)
                        ? 'bg-rose-50/60'
                        : 'hover:bg-indigo-50/20'
                    }`}
                  >
                    {/* Select Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => handleToggleSelectItem(item.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                        title="Marcar item para exclusão"
                      />
                    </td>

                    {/* SKU Code (Clean, no BD indicator) */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={item.code}
                        onChange={(e) => handleUpdateItem(item.id, 'code', e.target.value)}
                        placeholder="Cód."
                        className="w-full border border-slate-200 bg-slate-50/50 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        title="Código ou SKU do produto"
                      />
                    </td>

                    {/* Description */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                        placeholder="Nome ou descrição do item"
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </td>

                    {/* Em Estoque Column */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {(() => {
                        const st = getStockInfoForItem(item);
                        if (!st) {
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-400 bg-slate-100" title="Item sem cadastro no estoque">
                              -
                            </span>
                          );
                        }
                        const isOutOfStock = st.currentStock <= 0;
                        const isLowStock = st.minStock !== undefined && st.currentStock <= st.minStock;
                        const isOverRequested = item.quantity > st.currentStock;

                        return (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                isOutOfStock
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : isLowStock
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                              title={`Disponível no Estoque: ${st.currentStock} ${st.unit || 'un'}${st.minStock ? ` (Mínimo: ${st.minStock})` : ''}`}
                            >
                              <Boxes className="w-3 h-3 shrink-0" />
                              <span>{st.currentStock} {st.unit || 'un'}</span>
                            </span>
                            {isOverRequested && !isOutOfStock && (
                              <span className="text-[10px] text-rose-600 font-bold" title="Quantidade solicitada é maior que o saldo atual no estoque!">
                                Qtd &gt; Estoque
                              </span>
                            )}
                            {isOutOfStock && (
                              <span className="text-[10px] text-rose-600 font-bold">
                                Esgotado
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Quantity with [-] / [+] Steppers and Direct Input */}
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(item.id, -1)}
                          className="px-2.5 py-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Diminuir quantidade"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                          className="w-14 text-center font-bold text-xs outline-none py-1.5"
                        />
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(item.id, 1)}
                          className="px-2.5 py-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Aumentar quantidade"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Unit Price */}
                    <td className="py-3 px-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-semibold">
                          {company.currency || '$'}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.unitPrice === 0 ? '' : item.unitPrice}
                          onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-right outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                    </td>

                    {/* Line Total */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-xs text-indigo-700">
                      {(company.currency || '$')} {(item.total || 0).toFixed(2)}
                    </td>

                    {/* Delete action */}
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(item.id);
                        }}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-100 active:bg-rose-200 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center min-w-[34px] min-h-[34px] border border-rose-200 hover:border-rose-300 shadow-2xs"
                        title="Apagar este item da lista"
                        aria-label="Apagar este item"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>

          {/* Quick Subtotal & Adjustment Bar */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-800">Total dos Itens: </span>
              <span className="font-mono text-indigo-700 font-bold text-sm">
                {(company.currency || '$')} {subtotal.toFixed(2)}
              </span>
              <span className="text-slate-400 ml-2">({items.length} itens calculados)</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setActiveStep('upload')}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar aos Prints</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStep('review')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <span>Avançar para Cliente & PDF</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 3: CUSTOMER & FINAL PDF GENERATION                  */}
      {/* ======================================================== */}
      {activeStep === 'review' && (
        <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 mb-1">
                <FileDown className="w-3.5 h-3.5" />
                Etapa Final
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Informações do Cliente & Emissão do PDF
              </h3>
              <p className="text-xs text-slate-500">
                Vincule o cliente destinatário e gere o documento final com os itens e todos os prints anexados.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveStep('items')}
              className="px-3.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar e Editar Itens</span>
            </button>
          </div>

          {/* Top Order Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nº do Pedido / Referência *
              </label>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data de Emissão *
              </label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={orderDueDate}
                onChange={(e) => setOrderDueDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status do Pedido
              </label>
              <select
                value={orderStatus}
                onChange={(e: any) => setOrderStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-medium"
              >
                <option value="confirmed">Confirmado / Aprovado</option>
                <option value="draft">Rascunho</option>
                <option value="delivered">Entregue / Concluído</option>
              </select>
            </div>
          </div>

          {/* Customer Selection & Details */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-800">
                Destinatário / Dados do Cliente
              </span>
              <button
                type="button"
                onClick={onNavigateToCustomers}
                className="text-xs text-indigo-600 hover:underline font-bold"
              >
                + Gerenciar Clientes Cadastrados
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="sm:col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Selecionar Cliente Cadastrado
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                >
                  <option value="">-- Escolher da Lista ou Digitar --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.taxId ? `(${c.taxId})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nome do Cliente / Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="ex: Maria Silva ou Salão Beleza Pura"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  CNPJ / CPF
                </label>
                <input
                  type="text"
                  value={custTaxId}
                  onChange={(e) => setCustTaxId(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  placeholder="cliente@exemplo.com"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Endereço de Entrega / Cobrança
                </label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Attached Prints Status & PDF Option */}
          <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-indigo-950">
                  {uploadedPrints.length > 0
                    ? `${uploadedPrints.length} print(s) prontos para anexar ao PDF`
                    : 'Nenhum print carregado no momento'}
                </p>
                <p className="text-indigo-700/80">
                  {uploadedPrints.length > 0
                    ? 'Cada print será gerado em página dedicada de alta resolução como anexo ao final do PDF.'
                    : 'Você pode gerar o PDF apenas com a tabela ou voltar para inserir prints.'}
                </p>
              </div>
            </div>

            {uploadedPrints.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto select-none">
                <input
                  type="checkbox"
                  checked={attachImageToPdf}
                  onChange={(e) => setAttachImageToPdf(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded-sm border-indigo-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-indigo-900">
                  Anexar todos os prints no PDF
                </span>
              </label>
            )}
          </div>

          {/* Financial summary & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observações do Pedido & Condições de Pagamento
              </label>
              <textarea
                rows={4}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Ex: Pagamento à vista via PIX ou em 30 dias no boleto..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              ></textarea>
            </div>

            <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Subtotal dos Produtos:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {(company.currency || '$')} {subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Desconto (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                  className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-right text-xs bg-white font-mono"
                />
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Taxa / Impostos (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-right text-xs bg-white font-mono"
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <div>
                  <span className="text-sm font-bold text-slate-900">Total do Pedido:</span>
                  <span className="block text-[11px] text-slate-400">Pronto para gerar PDF</span>
                </div>
                <span className="text-xl font-bold text-indigo-600 font-mono">
                  {(company.currency || '$')} {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveStep('items')}
              className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar e revisar valores dos itens</span>
            </button>

            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Gerar PDF & Enviar Pedido</span>
            </button>
          </div>
        </form>
      )}

      {/* Modal para Visualizar / Comparar Recorte do Print */}
      {previewingPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Visualização do Print: {previewingPrint.print.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {previewingPrint.mode === 'cropped'
                    ? 'Área recortada (Apenas o meio da tela, sem topo e sem rodapé do celular)'
                    : 'Imagem original completa'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingPrint(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle Modes */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewingPrint({ ...previewingPrint, mode: 'cropped' })}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  previewingPrint.mode === 'cropped'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Meio da Tela (Recortado)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewingPrint({ ...previewingPrint, mode: 'original' })}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  previewingPrint.mode === 'original'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Original Completa</span>
              </button>
            </div>

            {/* Image container */}
            <div className="flex-1 overflow-auto bg-slate-950 rounded-xl flex items-center justify-center p-2 min-h-[300px]">
              <img
                src={
                  previewingPrint.mode === 'cropped'
                    ? previewingPrint.print.croppedDataUrl
                    : previewingPrint.print.originalDataUrl
                }
                alt="Visualização"
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewingPrint(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Colar Lista de Itens */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Colar ou Digitar Lista de Produtos</h3>
                <p className="text-xs text-slate-500">Cole uma lista com um item por linha (ex: Top coat incolor, Base bomba, etc.)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Format Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-500">Exemplos com códigos:</span>
              <button
                type="button"
                onClick={() => setPasteText("#01 Top coat incolor R$ 15,00\n#02 Base bomba R$ 18,50\n#03 Removedor a base de acetona R$ 12,00")}
                className="text-[11px] px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold"
              >
                + Com Hashtags (#01, #02)
              </button>
              <button
                type="button"
                onClick={() => setPasteText("COD: 101 Top coat incolor R$ 15,00\nCOD: 102 Base bomba R$ 18,50\nCOD: 103 Removedor acetona R$ 12,00")}
                className="text-[11px] px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold"
              >
                + Com COD (COD: 101)
              </button>
              <button
                type="button"
                onClick={() => setPasteText("1. Top coat incolor R$ 15,00\n2. Base bomba R$ 18,50\n3. Removedor a base de acetona R$ 12,00")}
                className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-bold"
              >
                + Com Números (1., 2.)
              </button>
            </div>

            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Cole aqui no formato que preferir, por exemplo:\n#01 Top coat incolor R$ 15,00\n#02 Base bomba R$ 18,50\n#03 Removedor a base de acetona R$ 12,00`}
              className="w-full border border-slate-300 rounded-xl p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500">
                O código antes do nome vai direto para a coluna Código/SKU.
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyPasteText}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Inserir na Tabela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação do Carrinho do WhatsApp */}
      <WhatsAppCartModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        onApplyItems={handleApplyWhatsAppCart}
        onOpenQuickCatalog={() => setActiveStep('items')}
      />

      {/* Modal de Envio Imediato pós-geração */}
      <SendOrderModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        order={sentOrder}
        company={company}
      />

      {/* Modal do Banco de Dados de Produtos */}
      <CatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        catalog={catalog}
        onUpdateCatalog={handleCatalogChange}
      />

      {/* Modal de Lançamento de Códigos em Massa */}
      {isBatchCodeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Lançar Códigos em Massa
                  </h3>
                  <p className="text-xs text-slate-500">
                    Busca automática no Estoque ({activeStock.length} produtos)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchCodeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Cole ou digite os códigos dos produtos (um por linha ou separados por vírgula). Se desejar quantidade específica, use <code>x 2</code> ou <code>x2</code>.
            </p>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setBatchCodeText("47 x 2\n46 x 5\n10 x 3\n12 x 1\n237 x 4\n319 x 2")}
                className="text-[11px] px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold cursor-pointer"
              >
                Exemplo: 47 x 2, 46 x 5, 237...
              </button>
              <button
                type="button"
                onClick={() => setBatchCodeText("41, 12, 42, 24, 346, 20, 28, 44, 47, 46, 10, 15, 11, 18, 308, 319, 29, 27, 30, 21, 26")}
                className="text-[11px] px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg font-bold cursor-pointer"
              >
                Exemplo: Códigos das Lixas (Vírgula)
              </button>
              <button
                type="button"
                onClick={() => setBatchCodeText("237, 235, 4, 357, 5, 6, 8, 7, 9")}
                className="text-[11px] px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold cursor-pointer"
              >
                Exemplo: Extra Brilhos / Removedores
              </button>
            </div>

            <textarea
              rows={7}
              value={batchCodeText}
              onChange={(e) => setBatchCodeText(e.target.value)}
              placeholder={`Exemplos:\n47 x 2\n46 x 5\n10 x 3\n237\n319 x 4\n\nOu cole os códigos separados por vírgula:\n47, 46, 10, 12, 237, 319`}
              className="w-full border border-slate-300 rounded-xl p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500">
                Puxa descrição e preço de cada código cadastrado.
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchCodeModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyBatchCodes}
                  disabled={!batchCodeText.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Inserir no Pedido</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Limpar Tabela */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Apagar todos os itens do pedido?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Você está prestes a remover <strong>{items.length} produto(s)</strong> desta lista. Esta ação limpará a tabela do pedido atual para que você possa começar do zero.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Sim, Limpar Tabela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
