import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Download,
  Send,
  Save,
  DollarSign,
  Package,
  Minus,
  Check,
  AlertCircle,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { SalesOrder, LineItem, CompanyProfile } from '../types';
import { loadStoredCatalog, CatalogProduct } from '../utils/productCatalog';
import { generateSalesOrderPDF } from '../utils/pdfGenerator';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalesOrder | null;
  company: CompanyProfile;
  onSave: (updatedOrder: SalesOrder) => void;
  onSaveAndSend?: (updatedOrder: SalesOrder) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  company,
  onSave,
  onSaveAndSend,
}) => {
  const [items, setItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [status, setOrderStatus] = useState<SalesOrder['status']>('confirmed');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  // Sync state when order prop changes
  useEffect(() => {
    if (order) {
      setItems(
        order.items.map((it) => ({
          ...it,
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          total: Number(((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)),
        }))
      );
      setNotes(order.notes || '');
      setDiscountRate(order.discountRate || 0);
      setOrderStatus(order.status || 'confirmed');
      setSavedSuccess(false);
      setShowCatalogPicker(false);
    }
    setCatalog(loadStoredCatalog());
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const currency = company.currency || 'R$';

  // Calculate totals
  const subtotal = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const discountAmount = Number(((subtotal * discountRate) / 100).toFixed(2));
  const taxRate = order.taxRate || 0;
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const taxAmount = Number(((taxableBase * taxRate) / 100).toFixed(2));
  const grandTotal = Number((taxableBase + taxAmount).toFixed(2));

  // Item handlers
  const handleItemQuantityChange = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const newQty = Math.max(1, (it.quantity || 1) + delta);
        return {
          ...it,
          quantity: newQty,
          total: Number((newQty * (it.unitPrice || 0)).toFixed(2)),
        };
      })
    );
  };

  const handleItemQuantityInput = (id: string, value: string) => {
    const qty = Math.max(1, parseInt(value, 10) || 1);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return {
          ...it,
          quantity: qty,
          total: Number((qty * (it.unitPrice || 0)).toFixed(2)),
        };
      })
    );
  };

  const handleItemPriceChange = (id: string, value: string) => {
    const cleaned = value.replace(',', '.');
    const price = Math.max(0, parseFloat(cleaned) || 0);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return {
          ...it,
          unitPrice: price,
          total: Number(((it.quantity || 1) * price).toFixed(2)),
        };
      })
    );
  };

  const handleItemDescriptionChange = (id: string, description: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, description } : it))
    );
  };

  const handleItemCodeChange = (id: string, code: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, code } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAddItemFromCatalog = (prod: CatalogProduct) => {
    const newItem: LineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      code: prod.code,
      description: prod.name,
      quantity: 1,
      unitPrice: prod.price,
      total: prod.price,
    };
    setItems((prev) => [...prev, newItem]);
    setShowCatalogPicker(false);
  };

  const handleAddCustomItem = () => {
    const newItem: LineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      code: '-',
      description: 'Novo Produto / Serviço',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Build the updated order object
  const buildUpdatedOrder = (): SalesOrder => {
    return {
      ...order,
      items,
      notes,
      status,
      discountRate,
      discountAmount,
      taxRate,
      taxAmount,
      subtotal,
      grandTotal,
    };
  };

  const handleSaveOnly = () => {
    const updated = buildUpdatedOrder();
    onSave(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleSaveAndGeneratePDF = () => {
    const updated = buildUpdatedOrder();
    onSave(updated);
    generateSalesOrderPDF(updated, company, true);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleSaveAndOpenSend = () => {
    const updated = buildUpdatedOrder();
    onSave(updated);
    if (onSaveAndSend) {
      onSaveAndSend(updated);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                {order.orderNumber}
              </span>
              <span className="text-xs text-slate-300">
                • {order.customer.name}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-1">
              Editar Quantidades e Valores do Pedido
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Alterações salvas com sucesso! Gerando novo documento...</span>
            </div>
          )}

          {/* Quick Info Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Data Emissão</span>
                <span className="font-semibold text-slate-700">{order.orderDate}</span>
              </div>
              {order.orderDueDate && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Vencimento</span>
                  <span className="font-semibold text-slate-700">{order.orderDueDate}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                <select
                  value={status}
                  onChange={(e) => setOrderStatus(e.target.value as any)}
                  className="mt-0.5 font-bold text-xs bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-800 outline-none"
                >
                  <option value="confirmed">Confirmado</option>
                  <option value="draft">Rascunho</option>
                  <option value="delivered">Entregue</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCatalogPicker(!showCatalogPicker)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>+ Produto do Banco ({catalog.length})</span>
              </button>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Item Avulso</span>
              </button>
            </div>
          </div>

          {/* Quick Catalog Picker Drawer */}
          {showCatalogPicker && (
            <div className="p-4 bg-white rounded-2xl border border-indigo-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-indigo-600" />
                  Clique em um produto para adicionar a este pedido:
                </span>
                <button
                  type="button"
                  onClick={() => setShowCatalogPicker(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Fechar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {catalog.map((prod) => (
                  <button
                    key={prod.code}
                    type="button"
                    onClick={() => handleAddItemFromCatalog(prod)}
                    className="p-2.5 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-xl text-left transition-colors flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-[10px] font-bold text-indigo-600">{prod.code}</div>
                      <div className="text-xs font-semibold text-slate-800 truncate">{prod.name}</div>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-700 shrink-0">
                      {currency} {prod.price.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Items Table / Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Itens do Pedido ({items.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Altere valores e quantidades diretamente nos campos
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Package className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">Nenhum item neste pedido. Clique nos botões acima para adicionar.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="p-3 sm:p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    {/* SKU Code */}
                    <div className="w-20 shrink-0">
                      <label className="text-[10px] font-bold text-slate-400 uppercase sm:hidden block">Cód.</label>
                      <input
                        type="text"
                        value={it.code}
                        onChange={(e) => handleItemCodeChange(it.id, e.target.value)}
                        placeholder="-"
                        className="w-full text-xs font-mono font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-200 rounded-lg px-2 py-1.5 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold text-slate-400 uppercase sm:hidden block">Descrição</label>
                      <input
                        type="text"
                        value={it.description}
                        onChange={(e) => handleItemDescriptionChange(it.id, e.target.value)}
                        placeholder="Nome do produto..."
                        className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <label className="text-[10px] font-bold text-slate-400 uppercase sm:hidden block mr-2">Qtd:</label>
                      <button
                        type="button"
                        onClick={() => handleItemQuantityChange(it.id, -1)}
                        className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => handleItemQuantityInput(it.id, e.target.value)}
                        className="w-12 text-center text-xs font-bold text-slate-800 border border-slate-300 rounded-lg py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleItemQuantityChange(it.id, 1)}
                        className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Unit Price */}
                    <div className="w-28 shrink-0">
                      <label className="text-[10px] font-bold text-slate-400 uppercase sm:hidden block">Preço Unit. ({currency})</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-[11px] text-slate-400 font-mono">
                          {currency}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unitPrice}
                          onChange={(e) => handleItemPriceChange(it.id, e.target.value)}
                          className="w-full text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-right focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Subtotal */}
                    <div className="w-24 text-right shrink-0">
                      <label className="text-[10px] font-bold text-slate-400 uppercase sm:hidden block">Total</label>
                      <span className="text-xs font-mono font-bold text-indigo-900 block pt-1">
                        {currency} {it.total.toFixed(2)}
                      </span>
                    </div>

                    {/* Delete item button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 self-end sm:self-center"
                      title="Excluir item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes & Summary Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Notes */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Observações do Pedido
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ex: Pagamento na entrega via PIX, sem taxa de entrega..."
                className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Financial Summary */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal dos Itens:</span>
                <span className="font-mono font-bold">{currency} {subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  Desconto (%):
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountRate}
                    onChange={(e) => setDiscountRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-14 text-center text-xs font-mono border border-slate-200 rounded-md py-0.5"
                  />
                </span>
                <span className="font-mono text-emerald-700 font-bold">
                  -{currency} {discountAmount.toFixed(2)}
                </span>
              </div>

              {taxRate > 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Impostos ({taxRate}%):</span>
                  <span className="font-mono font-bold">+{currency} {taxAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900">Total Atualizado:</span>
                <span className="text-xl font-mono font-extrabold text-indigo-700">
                  {currency} {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </button>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSaveOnly}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Alterações</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndGeneratePDF}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Salvar & Gerar PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndOpenSend}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Salvar & Enviar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
