import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Share2,
  Mail,
  MessageSquare,
  Download,
  Copy,
  Check,
  FileText,
  ExternalLink,
  Building2,
  Sparkles
} from 'lucide-react';
import { SalesOrder, CompanyProfile } from '../types';
import { generateSalesOrderPDF } from '../utils/pdfGenerator';

interface SendOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalesOrder | null;
  company: CompanyProfile;
}

export const SendOrderModal: React.FC<SendOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  company,
}) => {
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const currency = company.currency || '$';

  // Format message for WhatsApp / E-mail
  const buildOrderSummaryMessage = () => {
    const itemsList = order.items
      .map(
        (it) =>
          `• ${it.quantity}x ${it.description} (${currency} ${it.unitPrice.toFixed(2)}) = ${currency} ${it.total.toFixed(2)}`
      )
      .join('\n');

    return `*PEDIDO DE VENDA - ${order.orderNumber}*
🏢 Empresa: ${company.name}
👤 Cliente: ${order.customer.name}
${order.customer.taxId ? `📄 Documento: ${order.customer.taxId}\n` : ''}📅 Data: ${order.orderDate}
${order.orderDueDate ? `⏳ Vencimento: ${order.orderDueDate}\n` : ''}
📦 *Itens e Produtos:*
${itemsList}

💵 *Subtotal:* ${currency} ${order.subtotal.toFixed(2)}
${order.discountRate > 0 ? `🏷️ *Desconto (${order.discountRate}%):* -${currency} ${order.discountAmount.toFixed(2)}\n` : ''}${order.taxRate > 0 ? `🏛️ *Impostos (${order.taxRate}%):* +${currency} ${order.taxAmount.toFixed(2)}\n` : ''}⭐ *TOTAL GERAL: ${currency} ${order.grandTotal.toFixed(2)}*

${order.notes ? `📝 *Observações:* ${order.notes}\n` : ''}
📄 Documento oficial em PDF gerado via ARTEX7.`;
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(buildOrderSummaryMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const message = encodeURIComponent(buildOrderSummaryMessage());
    let phoneParam = '';

    if (order.customer.phone) {
      // Remove any non-numeric characters
      const cleanPhone = order.customer.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 8) {
        // If no country code, default to Brazil 55
        phoneParam = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
      }
    }

    const url = phoneParam
      ? `https://api.whatsapp.com/send?phone=${phoneParam}&text=${message}`
      : `https://api.whatsapp.com/send?text=${message}`;

    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Pedido de Venda ${order.orderNumber} - ${company.name}`);
    const body = encodeURIComponent(buildOrderSummaryMessage());
    const recipient = order.customer.email ? encodeURIComponent(order.customer.email) : '';
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  const handleShareFile = async () => {
    try {
      const doc = generateSalesOrderPDF(order, company, false);
      const blob = doc.output('blob');
      const filename = `SalesOrder_${order.orderNumber}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Pedido de Venda ${order.orderNumber}`,
          text: `Segue o pedido de venda ${order.orderNumber} em anexo.`,
        });
        setShareFeedback('Arquivo compartilhado com sucesso!');
      } else {
        // Fallback: download
        doc.save(filename);
        setShareFeedback('PDF baixado! Seu navegador não suporta compartilhamento direto de arquivo.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Share error', err);
        setShareFeedback('Não foi possível compartilhar diretamente. O PDF foi baixado.');
      }
    }
    setTimeout(() => setShareFeedback(null), 4000);
  };

  const handleDownloadAgain = () => {
    generateSalesOrderPDF(order, company, true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Pedido Gerado & Pronto para Envio!
              </h2>
              <p className="text-xs text-slate-500">
                O PDF foi criado com todos os itens e comprovantes. Escolha como deseja enviá-los:
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Details Brief Box */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-600">Nº do Pedido:</span>
            <span className="font-mono font-bold text-indigo-600">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-600">Cliente / Destinatário:</span>
            <span className="font-medium text-slate-800">{order.customer.name}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-600">Itens e Produtos Extraídos:</span>
            <span className="font-medium text-slate-800">{order.items.length} itens listados</span>
          </div>
          <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2 font-bold">
            <span className="text-slate-800">Total Geral:</span>
            <span className="text-indigo-600 font-mono text-sm">
              {currency} {order.grandTotal.toFixed(2)}
            </span>
          </div>

          {order.attachedImageUrl && (
            <div className="pt-1 text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>A imagem original do comprovante foi anexada na 2ª página do PDF.</span>
            </div>
          )}
        </div>

        {/* Share feedback */}
        {shareFeedback && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs rounded-xl font-medium">
            {shareFeedback}
          </div>
        )}

        {/* Send Action Buttons */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Enviar Pedido & Produtos Imediatamente:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* WhatsApp */}
            <button
              onClick={handleSendWhatsApp}
              className="p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs flex items-center justify-between shadow-xs transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span>Enviar via WhatsApp</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>

            {/* Email */}
            <button
              onClick={handleSendEmail}
              className="p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs flex items-center justify-between shadow-xs transition-colors"
            >
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>Enviar por E-mail</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>

            {/* Web Share (Mobile / Desktop Share Sheet) */}
            <button
              onClick={handleShareFile}
              className="p-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-xs flex items-center justify-between shadow-xs transition-colors"
            >
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                <span>Compartilhar Arquivo PDF</span>
              </div>
              <Share2 className="w-3.5 h-3.5 opacity-80" />
            </button>

            {/* Download Again */}
            <button
              onClick={handleDownloadAgain}
              className="p-3.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-slate-600" />
                <span>Baixar PDF Novamente</span>
              </div>
              <Download className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>
        </div>

        {/* Copy text snippet option */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleCopyMessage}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1.5 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600">Resumo dos itens copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar texto com a lista de itens</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
