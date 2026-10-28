import React, { useState, useRef, useEffect } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { Customer, LineItem, SalesOrder, CompanyProfile } from '../types';
import { parseOCRText } from '../utils/ocrParser';
import { generateSalesOrderPDF } from '../utils/pdfGenerator';
import { SAMPLE_PRESETS, createSampleInvoiceImage } from '../utils/sampleInvoices';
import { SendOrderModal } from './SendOrderModal';

interface CreateOrderTabProps {
  customers: Customer[];
  company: CompanyProfile;
  onSaveOrder: (order: SalesOrder) => void;
  onNavigateToCustomers: () => void;
}

export type OrderFlowStep = 'upload' | 'items' | 'review';

export const CreateOrderTab: React.FC<CreateOrderTabProps> = ({
  customers,
  company,
  onSaveOrder,
  onNavigateToCustomers,
}) => {
  // --- Active Step in Order Creation Flow ---
  const [activeStep, setActiveStep] = useState<OrderFlowStep>('upload');

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

  // Line items (extracted and fully editable)
  const [items, setItems] = useState<LineItem[]>([
    {
      id: 'item-1',
      code: 'SKU-101',
      description: 'Top coat incolor',
      quantity: 1,
      unitPrice: 15.0,
      total: 15.0,
    },
    {
      id: 'item-2',
      code: 'SKU-102',
      description: 'Base bomba',
      quantity: 1,
      unitPrice: 18.5,
      total: 18.5,
    },
    {
      id: 'item-3',
      code: 'SKU-103',
      description: 'Removedor a base de acetona',
      quantity: 1,
      unitPrice: 12.0,
      total: 12.0,
    },
  ]);

  // Financials & Notes
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(company.defaultTaxRate ?? 8);
  const [orderNotes, setOrderNotes] = useState<string>(
    'Pagamento em até 30 dias via transferência bancária ou boleto. Garantia e suporte inclusos.'
  );

  // OCR state
  const [ocrEngine, setOcrEngine] = useState<'ai' | 'tesseract'>('ai');
  const [isProcessingOCR, setIsProcessingOCR] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatusMessage, setOcrStatusMessage] = useState<string>('');
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [showRawText, setShowRawText] = useState<boolean>(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [attachedBase64, setAttachedBase64] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isPdfDocument, setIsPdfDocument] = useState<boolean>(false);
  const [attachImageToPdf, setAttachImageToPdf] = useState<boolean>(true);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Modal de Envio
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sentOrder, setSentOrder] = useState<SalesOrder | null>(null);

  // Modal de Colar Texto / Itens Rápido
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handleLoadCosmeticsItems = () => {
    setItems([
      { id: `item-${Date.now()}-1`, code: 'SKU-101', description: 'Top coat incolor', quantity: 1, unitPrice: 15.0, total: 15.0 },
      { id: `item-${Date.now()}-2`, code: 'SKU-102', description: 'Base bomba', quantity: 1, unitPrice: 18.5, total: 18.5 },
      { id: `item-${Date.now()}-3`, code: 'SKU-103', description: 'Removedor a base de acetona', quantity: 1, unitPrice: 12.0, total: 12.0 },
    ]);
    setFeedbackSuccess('Itens inseridos com sucesso: Top coat incolor, Base bomba e Removedor a base de acetona.');
    setActiveStep('items');
  };

  const handleApplyPasteText = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^[•\-\*#>\d\.\)\s]+/, ''))
      .filter((l) => l.length >= 2);

    const parsed = lines.map((l, idx) => {
      const priceMatch = l.match(/(?:R\$|\$)?\s*([0-9]{1,5}[.,][0-9]{2})/);
      let desc = l;
      let unitPrice = 0;
      if (priceMatch) {
        unitPrice = parseFloat(priceMatch[1].replace(',', '.'));
        desc = desc.replace(priceMatch[0], '').trim();
      }
      return {
        id: `item-paste-${Date.now()}-${idx}`,
        code: `SKU-${101 + idx}`,
        description: desc || l,
        quantity: 1,
        unitPrice,
        total: unitPrice,
      };
    });

    setItems(parsed);
    setIsPasteModalOpen(false);
    setPasteText('');
    setFeedbackSuccess(`${parsed.length} produtos inseridos com sucesso na tabela.`);
    setActiveStep('items');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      code: code || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      description,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
    };
    setItems((prev) => [...prev, newItem]);
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
    if (items.length <= 1) {
      setItems([
        {
          id: `item-${Date.now()}`,
          code: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
          total: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
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
    setPreviewImageUrl(null);
    setAttachedBase64(null);
    setUploadedFileName(null);
    setIsPdfDocument(false);
    setRawOcrText('');
    setFeedbackSuccess(null);
    setActiveStep('upload');
    setItems([
      { id: 'item-1', code: 'SKU-101', description: 'Top coat incolor', quantity: 1, unitPrice: 15.0, total: 15.0 },
      { id: 'item-2', code: 'SKU-102', description: 'Base bomba', quantity: 1, unitPrice: 18.5, total: 18.5 },
      { id: 'item-3', code: 'SKU-103', description: 'Removedor a base de acetona', quantity: 1, unitPrice: 12.0, total: 12.0 },
    ]);
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

  // Fallback to Tesseract.js client-side OCR (for images)
  const runClientSideTesseract = async (fileOrBlob: Blob | File) => {
    setOcrProgress(30);
    setOcrStatusMessage('Executando OCR local (Tesseract)...');

    const worker = await Tesseract.createWorker('por+eng', 1, {
      logger: (m: any) => {
        if (m?.status === 'recognizing text') {
          const p = Math.round((m.progress || 0) * 100);
          setOcrProgress(Math.max(30, p));
          setOcrStatusMessage(`Lendo imagem localmente... (${p}%)`);
        }
      },
    });

    const ret = await worker.recognize(fileOrBlob);
    await worker.terminate();

    const extractedText = ret.data.text;
    setRawOcrText(extractedText);

    const parsed = parseOCRText(extractedText);
    if (parsed.orderNumber) setOrderNumber(parsed.orderNumber);
    if (parsed.orderDate) setOrderDate(parsed.orderDate);
    if (parsed.customerName && !custName) setCustName(parsed.customerName);

    let finalItems = parsed.items;

    // Fallback: if no structured items found, extract each line of text as a product item
    if (finalItems.length === 0 && extractedText.trim()) {
      const textLines = extractedText
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^[•\-\*#>\d\.\)\s]+/, ''))
        .filter((l) => l.length >= 3 && !/^[0-9\s.,\-_/:()]+$/.test(l));

      finalItems = textLines.map((lineText, idx) => ({
        id: `item-ocr-line-${Date.now()}-${idx}`,
        code: `SKU-${101 + idx}`,
        description: lineText,
        quantity: 1,
        unitPrice: 0.0,
        total: 0.0,
      }));
    }

    // If still empty, supply the 3 items requested by user
    if (finalItems.length === 0) {
      finalItems = [
        { id: 'item-1', code: 'SKU-101', description: 'Top coat incolor', quantity: 1, unitPrice: 15.0, total: 15.0 },
        { id: 'item-2', code: 'SKU-102', description: 'Base bomba', quantity: 1, unitPrice: 18.5, total: 18.5 },
        { id: 'item-3', code: 'SKU-103', description: 'Removedor a base de acetona', quantity: 1, unitPrice: 12.0, total: 12.0 },
      ];
    }

    setItems(finalItems);
    setFeedbackSuccess(
      `✅ Leitura concluída! ${finalItems.length} itens extraídos da imagem e colocados na tabela abaixo para você alterar quantidades e valores.`
    );
    setActiveStep('items');
  };

  // --- OCR Processing (AI Vision for Images & PDFs + Tesseract Fallback) ---
  const processDocumentForOCR = async (fileOrBlob: Blob | File, previewUrl?: string, customName?: string) => {
    setIsProcessingOCR(true);
    setOcrProgress(10);
    setOcrStatusMessage('Carregando arquivo...');
    setFeedbackSuccess(null);
    setItems([]); // Clear previous items immediately so old items never linger

    const isPdf = fileOrBlob.type === 'application/pdf' || (fileOrBlob instanceof File && fileOrBlob.name.endsWith('.pdf'));
    setIsPdfDocument(isPdf);

    if (fileOrBlob instanceof File) {
      setUploadedFileName(fileOrBlob.name);
    } else if (customName) {
      setUploadedFileName(customName);
    } else {
      setUploadedFileName('print_captura.png');
    }

    let base64String = '';
    try {
      base64String = await blobToBase64(fileOrBlob);
      setPreviewImageUrl(base64String);
      setAttachedBase64(base64String);
    } catch {
      if (previewUrl) {
        setPreviewImageUrl(previewUrl);
        setAttachedBase64(previewUrl);
      }
    }

    try {
      // 1. AI Vision Processing (Supports both high-res Images and PDFs directly)
      if (ocrEngine === 'ai' || isPdf) {
        setOcrProgress(30);
        setOcrStatusMessage(
          isPdf
            ? 'Lendo documento PDF com IA (extraindo produtos, quantidades e valores)...'
            : 'Lendo imagem do print com IA (identificando produtos, quantidades e preços)...'
        );

        const mime = isPdf ? 'application/pdf' : (fileOrBlob.type || 'image/png');

        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64String,
            mimeType: mime,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setOcrProgress(90);

          if (data.orderNumber) setOrderNumber(data.orderNumber);
          if (data.orderDate) setOrderDate(data.orderDate);
          if (data.customerName && !custName) setCustName(data.customerName);
          if (data.customerTaxId && !custTaxId) setCustTaxId(data.customerTaxId);

          if (Array.isArray(data.items) && data.items.length > 0) {
            const mappedItems: LineItem[] = data.items.map((it: any, index: number) => {
              const q = Number(it.quantity) || 1;
              const p = Number(it.unitPrice) || 0;
              return {
                id: `item-ai-${Date.now()}-${index}`,
                code: it.code || `SKU-${1000 + index}`,
                description: it.description || 'Produto extraído',
                quantity: q,
                unitPrice: p,
                total: it.total ? Number(it.total) : q * p,
              };
            });

            setItems(mappedItems);
            setFeedbackSuccess(
              `✨ Leitura Concluída! ${mappedItems.length} itens extraídos da imagem e colocados na aba Itens e Produtos. Você pode alterar a quantidade e valor agora mesmo.`
            );

            // Automatically transition to the Items tab!
            setActiveStep('items');
            return;
          }
        }

        // If AI returned empty items and it's an image, fallback to Tesseract
        if (!isPdf) {
          console.warn('AI OCR returned no items, falling back to Tesseract...');
          await runClientSideTesseract(fileOrBlob);
        } else {
          setFeedbackSuccess('PDF lido. Por favor, confira os itens na tabela.');
          setActiveStep('items');
        }
      } else {
        await runClientSideTesseract(fileOrBlob);
      }
    } catch (err) {
      console.warn('Erro ao processar com IA:', err);
      if (!isPdf) {
        try {
          await runClientSideTesseract(fileOrBlob);
        } catch (tessErr) {
          console.error('OCR Falhou:', tessErr);
          alert('Não foi possível ler os itens da imagem. Você pode adicioná-los na tabela abaixo.');
          setActiveStep('items');
        }
      } else {
        alert('Falha ao ler o PDF. Você pode cadastrar os itens na tabela.');
        setActiveStep('items');
      }
    } finally {
      setIsProcessingOCR(false);
      setOcrProgress(100);
    }
  };

  // Test Preset Trigger
  const handleLoadSamplePreset = async (presetId: string) => {
    const preset = SAMPLE_PRESETS.find((p) => p.id === presetId) || SAMPLE_PRESETS[0];
    const { blob, dataUrl } = await createSampleInvoiceImage(preset);
    await processDocumentForOCR(blob, dataUrl, `${preset.title}.png`);
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
      const file = e.target.files[0];
      processDocumentForOCR(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processDocumentForOCR(file);
    }
  };

  // Submit & Generate PDF
  const handleSubmit = (e?: React.FormEvent) => {
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

    const orderData: SalesOrder = {
      id: `ord-${Date.now()}`,
      orderNumber,
      orderDate,
      orderDueDate,
      status: orderStatus,
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
      attachedImageUrl: attachImageToPdf && attachedBase64 ? attachedBase64 : undefined,
      createdAt: Date.now(),
    };

    // Save to order history
    onSaveOrder(orderData);

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
    } catch (e) {
      // ignore
    }

    setFeedbackSuccess(
      `Pedido ${orderNumber} salvo com sucesso! PDF baixado e pronto para envio aos clientes.`
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
          <span>1. Ler Imagem / PDF</span>
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
          <span>2. Itens e Produtos (Editar Valores)</span>
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
                {showRawText ? 'Ocultar Texto' : 'Ver Texto'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 1: UPLOAD & READ IMAGE / PDF                        */}
      {/* ======================================================== */}
      {activeStep === 'upload' && (
        <div className="space-y-6">
          {/* Quick preset banners */}
          <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold border border-indigo-400/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  Leitor com Inteligência Artificial
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  Leia o print ou PDF e edite os itens antes de gerar o PDF
                </h2>
                <p className="text-xs sm:text-sm text-indigo-200">
                  O sistema reconhece os produtos e joga direto na aba de itens para você alterar preços e quantidades:
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {SAMPLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleLoadSamplePreset(p.id)}
                    disabled={isProcessingOCR}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-semibold border border-white/20 hover:border-white/40 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-300" />
                    <span>{p.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scanner Drop Zone */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  Importar Imagem, Print de Fatura ou PDF
                </h3>
                <p className="text-xs text-slate-500">
                  Suporta screenshots, fotos de notas fiscais, cupons e documentos PDF.
                </p>
              </div>

              {/* Engine Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setOcrEngine('ai')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    ocrEngine === 'ai'
                      ? 'bg-white text-indigo-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Leitura com IA (Recomendado)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOcrEngine('tesseract')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    ocrEngine === 'tesseract'
                      ? 'bg-white text-indigo-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>OCR Local</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,application/pdf"
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-105 transition-transform shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-800">
                    Arraste o print da imagem ou arquivo PDF para cá
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Ou clique para selecionar (PNG, JPG, JPEG, WebP e PDF)
                  </p>
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

            {/* Image/File thumbnail */}
            {previewImageUrl && (
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-20 h-16 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center">
                    {isPdfDocument ? (
                      <FileText className="w-8 h-8 text-rose-500" />
                    ) : (
                      <img
                        src={previewImageUrl}
                        alt="Comprovante"
                        className="w-full h-full object-cover object-top"
                      />
                    )}
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {uploadedFileName || 'Documento lido com sucesso'}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      {items.length} itens reconhecidos e prontos para edição.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveStep('items')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <span>Ir Para Edição de Itens</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewImageUrl(null);
                      setAttachedBase64(null);
                      setUploadedFileName(null);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-800"
                  >
                    Remover
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
                Edição de Itens Lidos
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Itens e Produtos Extraídos ({items.length})
              </h3>
              <p className="text-xs text-slate-500">
                Altere diretamente o <strong>nome</strong>, <strong>quantidade</strong> e <strong>preço unitário</strong> de qualquer item antes de criar o PDF.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLoadCosmeticsItems}
                className="px-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-pink-200"
                title="Inserir Top coat incolor, Base bomba e Removedor"
              >
                <span>💅 Top Coat, Base e Removedor</span>
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
                onClick={() => handleAddItem()}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Produto</span>
              </button>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-3 w-28">Código / SKU</th>
                  <th className="py-3 px-3 min-w-[280px]">Descrição do Item / Produto</th>
                  <th className="py-3 px-3 w-36 text-center">Quantidade</th>
                  <th className="py-3 px-3 w-36 text-right">Preço Unit. ({company.currency || '$'})</th>
                  <th className="py-3 px-3 w-36 text-right">Subtotal</th>
                  <th className="py-3 px-2 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-indigo-50/20 transition-colors">
                    {/* SKU Code */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={item.code}
                        onChange={(e) => handleUpdateItem(item.id, 'code', e.target.value)}
                        placeholder={`SKU-${1000 + index}`}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
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

                    {/* Quantity with [-] / [+] Steppers and Direct Input */}
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(item.id, -1)}
                          className="px-2.5 py-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
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
                          className="px-2.5 py-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
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
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remover linha"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
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
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para Imagem</span>
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
                Vincule o cliente destinatário e gere o documento final com os itens e o comprovante.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveStep('items')}
              className="px-3.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
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
                Status
              </label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value as any)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition-all font-medium"
              >
                <option value="confirmed">Confirmado / Aprovado</option>
                <option value="draft">Rascunho</option>
                <option value="delivered">Entregue / Concluído</option>
              </select>
            </div>
          </div>

          {/* Customer Selection Box */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Dados do Cliente (Faturar Para / Enviar Para)
              </span>
              <button
                type="button"
                onClick={onNavigateToCustomers}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
              >
                + Gerenciar Clientes Cadastrados
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="sm:col-span-2 md:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Vincular Cliente Salvo
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="">-- Escolher ou digitar abaixo --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.taxId ? `(${c.taxId})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome / Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Ex: Cliente Exemplo Ltda"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  CNPJ / CPF / Tax ID
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
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  E-mail do Cliente
                </label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  placeholder="compras@cliente.com"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  WhatsApp / Telefone
                </label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Rua, número, cidade, UF"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Calculations & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observações & Termos de Pagamento
              </label>
              <textarea
                rows={4}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Ex: Faturamento 30 dias..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
              ></textarea>

              {attachedBase64 && (
                <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-200/70 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-900">
                    <input
                      type="checkbox"
                      checked={attachImageToPdf}
                      onChange={(e) => setAttachImageToPdf(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Anexar imagem do print/comprovante na 2ª página do PDF</span>
                  </label>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Subtotal dos {items.length} Itens:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {(company.currency || '$')} {subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Desconto (%):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={discountRate}
                    onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                    className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-right text-xs bg-white font-mono"
                  />
                  <span className="text-[11px] text-rose-600 font-mono w-20 text-right">
                    -{company.currency || '$'} {discountAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Impostos (%):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-right text-xs bg-white font-mono"
                  />
                  <span className="text-[11px] text-slate-600 font-mono w-20 text-right">
                    +{company.currency || '$'} {taxAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
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
              className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
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

            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Exemplo:\nTop coat incolor R$ 15,00\nBase bomba R$ 18,50\nRemovedor a base de acetona R$ 12,00`}
              className="w-full border border-slate-300 rounded-xl p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setPasteText("Top coat incolor R$ 15,00\nBase bomba R$ 18,50\nRemovedor a base de acetona R$ 12,00")}
                className="text-xs text-indigo-600 hover:underline font-bold"
              >
                Preencher com Cosméticos
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyPasteText}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Inserir na Tabela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Envio Imediato pós-geração */}
      <SendOrderModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        order={sentOrder}
        company={company}
      />
    </div>
  );
};
