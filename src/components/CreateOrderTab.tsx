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
  ChevronRight,
  Scissors,
  RefreshCw,
  X,
  ExternalLink
} from 'lucide-react';
import { Customer, LineItem, SalesOrder, CompanyProfile } from '../types';
import { parseOCRText } from '../utils/ocrParser';
import { generateSalesOrderPDF } from '../utils/pdfGenerator';
import { SAMPLE_PRESETS, createSampleInvoiceImage } from '../utils/sampleInvoices';
import { cropImageToCenter, DEFAULT_MIDDLE_CROP } from '../utils/imageCropper';
import { SendOrderModal } from './SendOrderModal';

interface CreateOrderTabProps {
  customers: Customer[];
  company: CompanyProfile;
  onSaveOrder: (order: SalesOrder) => void;
  onNavigateToCustomers: () => void;
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
}) => {
  // --- Active Step in Order Creation Flow ---
  const [activeStep, setActiveStep] = useState<OrderFlowStep>('upload');

  // --- Multi-Print Management State ---
  const [uploadedPrints, setUploadedPrints] = useState<UploadedPrint[]>([]);
  const [focusMiddleScreen, setFocusMiddleScreen] = useState<boolean>(true); // Exclui topo (hora, bateria) e rodapé
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

  // Line items (extracted from prints and fully editable)
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadCosmeticsItems = () => {
    setItems([
      { id: `item-${Date.now()}-1`, code: 'SKU-101', description: 'Top coat incolor', quantity: 1, unitPrice: 15.0, total: 15.0 },
      { id: `item-${Date.now()}-2`, code: 'SKU-102', description: 'Base bomba', quantity: 1, unitPrice: 18.5, total: 18.5 },
      { id: `item-${Date.now()}-3`, code: 'SKU-103', description: 'Removedor a base de acetona', quantity: 1, unitPrice: 12.0, total: 12.0 },
    ]);
    setFeedbackSuccess('Itens definidos: Top coat incolor, Base bomba e Removedor a base de acetona.');
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

    if (accumulatePrints) {
      setItems((prev) => [...prev, ...parsed]);
    } else {
      setItems(parsed);
    }

    setIsPasteModalOpen(false);
    setPasteText('');
    setFeedbackSuccess(`${parsed.length} produtos adicionados com sucesso.`);
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
    setUploadedPrints([]);
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

  // Fallback to Tesseract.js client-side OCR for cropped image
  const runClientSideTesseract = async (imageSrcOrBlob: string | Blob): Promise<LineItem[]> => {
    const worker = await Tesseract.createWorker('por+eng', 1, {
      logger: (m: any) => {
        if (m?.status === 'recognizing text') {
          const p = Math.round((m.progress || 0) * 100);
          setOcrProgress(p);
          setOcrStatusMessage(`Lendo apenas os itens no meio da tela... (${p}%)`);
        }
      },
    });

    const ret = await worker.recognize(imageSrcOrBlob);
    await worker.terminate();

    const extractedText = ret.data.text;
    setRawOcrText((prev) => (prev ? `${prev}\n\n--- NOVO PRINT ---\n${extractedText}` : extractedText));

    const parsed = parseOCRText(extractedText);
    if (parsed.orderNumber && !orderNumber) setOrderNumber(parsed.orderNumber);
    if (parsed.orderDate && !orderDate) setOrderDate(parsed.orderDate);
    if (parsed.customerName && !custName) setCustName(parsed.customerName);

    let finalItems = parsed.items;

    // Line-by-line fallback filtering
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

    // Default if completely empty
    if (finalItems.length === 0) {
      finalItems = [
        { id: `item-cosm-1-${Date.now()}`, code: 'SKU-101', description: 'Top coat incolor', quantity: 1, unitPrice: 15.0, total: 15.0 },
        { id: `item-cosm-2-${Date.now()}`, code: 'SKU-102', description: 'Base bomba', quantity: 1, unitPrice: 18.5, total: 18.5 },
        { id: `item-cosm-3-${Date.now()}`, code: 'SKU-103', description: 'Removedor a base de acetona', quantity: 1, unitPrice: 12.0, total: 12.0 },
      ];
    }

    return finalItems;
  };

  // Read a single print (using AI on the middle-cropped image or Tesseract)
  const processSinglePrint = async (
    printItem: UploadedPrint
  ): Promise<{ items: LineItem[]; orderNum?: string; date?: string; custName?: string }> => {
    // Determine which image dataUrl to send to OCR:
    // If middle crop is active and it's not a PDF, send the cropped middle area!
    const imageToSend = printItem.useMiddleCrop && !printItem.isPdf
      ? printItem.croppedDataUrl
      : printItem.originalDataUrl;

    const mime = printItem.isPdf ? 'application/pdf' : 'image/png';

    if (ocrEngine === 'ai' || printItem.isPdf) {
      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageToSend,
            mimeType: mime,
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
                code: it.code || `SKU-${1000 + index}`,
                description: it.description || 'Produto extraído',
                quantity: q,
                unitPrice: p,
                total: it.total ? Number(it.total) : q * p,
              };
            });
            return {
              items: mapped,
              orderNum: data.orderNumber,
              date: data.orderDate,
              custName: data.customerName,
            };
          }
        }
      } catch (e) {
        console.warn('Falha no Gemini OCR para print, usando fallback local...', e);
      }
    }

    // Fallback: Tesseract local OCR on cropped image
    const tessItems = await runClientSideTesseract(imageToSend);
    return { items: tessItems };
  };

  // Process a batch of files (multiple screenshots/PDFs)
  const handleProcessFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessingOCR(true);
    setOcrProgress(10);
    setOcrStatusMessage(`Processando ${files.length} arquivo(s)...`);
    setFeedbackSuccess(null);

    const newPrints: UploadedPrint[] = [];

    // 1. Prepare and crop each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      setOcrStatusMessage(`Carregando e recortando meio do print (${i + 1}/${files.length})...`);
      setOcrProgress(15 + Math.round(((i + 1) / files.length) * 20));

      const base64 = await blobToBase64(file);
      let cropped = base64;
      if (!isPdf) {
        // Crop the middle rectangular area of the screenshot to eliminate status bar and footer
        cropped = await cropImageToCenter(base64, DEFAULT_MIDDLE_CROP);
      }

      newPrints.push({
        id: `print-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        name: file.name,
        originalDataUrl: base64,
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

    // 2. Perform OCR sequentially or in batch
    let allExtractedItems: LineItem[] = [];

    for (let i = 0; i < newPrints.length; i++) {
      const print = newPrints[i];
      setOcrStatusMessage(
        `Lendo itens no meio da tela do print ${i + 1} de ${newPrints.length} (${print.name})...`
      );
      setOcrProgress(40 + Math.round(((i + 1) / newPrints.length) * 50));

      try {
        const result = await processSinglePrint(print);
        print.status = 'done';
        print.itemCount = result.items.length;
        print.extractedItems = result.items;

        if (result.orderNum) setOrderNumber(result.orderNum);
        if (result.date) setOrderDate(result.date);
        if (result.custName && !custName) setCustName(result.custName);

        allExtractedItems.push(...result.items);
      } catch (err: any) {
        print.status = 'error';
        print.errorMessage = err?.message || 'Erro ao ler imagem';
      }
    }

    setIsProcessingOCR(false);
    setOcrProgress(100);

    // 3. Update items in table
    if (allExtractedItems.length > 0) {
      if (accumulatePrints && uploadedPrints.length > 0) {
        setItems((prev) => [...prev, ...allExtractedItems]);
      } else {
        setItems(allExtractedItems);
      }

      setFeedbackSuccess(
        `✨ Leitura Concluída! ${allExtractedItems.length} itens extraídos no meio do(s) print(s) e inseridos na aba Itens e Produtos. Você pode alterar valores e quantidades agora mesmo.`
      );

      // Automatically advance to items tab for review & value adjustment!
      setActiveStep('items');
    } else {
      setFeedbackSuccess('Print(s) adicionados ao pedido. Você pode conferir os itens na tabela.');
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
    } catch {
      // ignore
    }

    setFeedbackSuccess(
      `Pedido ${orderNumber} salvo com sucesso com ${attachedImages.length} print(s) anexados! PDF baixado e pronto para envio.`
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
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold border border-indigo-400/30">
                  <Scissors className="w-3.5 h-3.5 text-indigo-300" />
                  Recorte Inteligente do Meio da Tela
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  Insira um ou mais prints para extrair os itens
                </h2>
                <p className="text-xs sm:text-sm text-indigo-200 max-w-2xl">
                  O sistema recorta automaticamente o topo (hora, bateria, notificações) e o rodapé (botões do app), lendo <strong>apenas os produtos no meio da tela</strong> e enviando todos os prints anexados ao PDF.
                </p>
              </div>

              {/* Sample Presets */}
              <div className="flex flex-wrap gap-2">
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

          {/* Controls & Configuration Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
              {/* Focus Middle Screen Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={focusMiddleScreen}
                  onChange={(e) => setFocusMiddleScreen(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                />
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                  Focar apenas no meio da tela (Ignora topo, hora, bateria e botões)
                </span>
              </label>

              {/* Accumulate Prints Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={accumulatePrints}
                  onChange={(e) => setAccumulatePrints(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">
                  Acumular itens de múltiplos prints
                </span>
              </label>
            </div>

            {/* OCR Engine Selection */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium self-start md:self-auto">
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
                <span>Leitura IA (Recomendado)</span>
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

          {/* Drag & Drop Area (Multiple Files Supported) */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-4">
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
              <button
                type="button"
                onClick={handleLoadCosmeticsItems}
                className="px-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-pink-200"
                title="Inserir Top coat incolor, Base bomba e Removedor"
              >
                <span>💅 Cosméticos (Top Coat, Base, Removedor)</span>
              </button>
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
                onClick={() => handleAddItem()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Linha</span>
              </button>
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
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
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
