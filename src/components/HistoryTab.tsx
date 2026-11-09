import React, { useState } from 'react';
import { FileText, Download, Trash2, Search, Calendar, DollarSign, Package, Send, Edit3, XCircle, RotateCcw, CheckCircle2 } from 'lucide-react';
import { SalesOrder, CompanyProfile } from '../types';
import { generateSalesOrderPDF } from '../utils/pdfGenerator';
import { SendOrderModal } from './SendOrderModal';
import { EditOrderModal } from './EditOrderModal';

interface HistoryTabProps {
  orders: SalesOrder[];
  company: CompanyProfile;
  onDeleteOrder: (id: string) => void;
  onUpdateOrder?: (updatedOrder: SalesOrder) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ orders, company, onDeleteOrder, onUpdateOrder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'draft' | 'delivered' | 'cancelled'>('all');
  const [selectedOrderToSend, setSelectedOrderToSend] = useState<SalesOrder | null>(null);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<SalesOrder | null>(null);
  const [orderToReactivate, setOrderToReactivate] = useState<SalesOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<SalesOrder | null>(null);

  const filtered = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, curr) => acc + (curr.grandTotal || 0), 0);
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;

  const handleDownloadPDF = (order: SalesOrder) => {
    generateSalesOrderPDF(order, company, true);
  };

  const handleToggleCancelOrder = (order: SalesOrder) => {
    if (!onUpdateOrder) return;
    if (order.status !== 'cancelled') {
      setOrderToCancel(order);
    } else {
      setOrderToReactivate(order);
    }
  };

  const confirmCancelOrder = () => {
    if (!orderToCancel || !onUpdateOrder) return;
    onUpdateOrder({
      ...orderToCancel,
      status: 'cancelled',
    });
    setOrderToCancel(null);
  };

  const confirmReactivateOrder = () => {
    if (!orderToReactivate || !onUpdateOrder) return;
    onUpdateOrder({
      ...orderToReactivate,
      status: 'confirmed',
    });
    setOrderToReactivate(null);
  };

  const confirmDeleteOrder = () => {
    if (!orderToDelete) return;
    onDeleteOrder(orderToDelete.id);
    setOrderToDelete(null);
  };

  const getStatusBadge = (status: SalesOrder['status']) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Confirmado
          </span>
        );
      case 'draft':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Rascunho
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Entregue
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200" title="Saldo estornado para o estoque">
            Cancelado (Estornado)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top metrics summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total de Pedidos
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{orders.length}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Faturamento Registrado
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              {company.currency || '$'} {totalRevenue.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ticket Médio
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              {company.currency || '$'} {avgOrder.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Histórico de Pedidos</h2>
          <p className="text-xs text-slate-500">
            Acesse e baixe novamente o PDF de qualquer pedido emitido a qualquer momento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nº ou cliente..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">Todos os Status</option>
            <option value="confirmed">Confirmados</option>
            <option value="draft">Rascunhos</option>
            <option value="delivered">Entregues</option>
            <option value="cancelled">Cancelados (Estornados)</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm">Nenhum pedido de venda registrado até o momento.</p>
          </div>
        ) : (
          <>
            {/* Mobile Order Cards (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((order) => (
                <div key={order.id} className="p-4 space-y-3 bg-white">
                  {/* Top Bar: Order Number & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-sm text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                      {order.orderNumber}
                    </span>
                    <div>{getStatusBadge(order.status)}</div>
                  </div>

                  {/* Customer Info */}
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{order.customer.name}</div>
                    {order.customer.taxId && (
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {order.customer.taxId}
                      </div>
                    )}
                  </div>

                  {/* Date, Items & Total */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 bg-slate-50/70 p-3 rounded-xl">
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div>Data: <strong className="text-slate-800">{order.orderDate}</strong></div>
                      <div className="text-[11px] text-slate-500">{order.items.length} produto(s)</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total</span>
                      <span className="font-mono font-black text-base text-slate-900">
                        {company.currency || '$'} {order.grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Primary Touch Actions: WhatsApp & PDF */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrderToSend(order);
                        setIsSendOpen(true);
                      }}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>WhatsApp / Enviar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadPDF(order)}
                      className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar PDF</span>
                    </button>
                  </div>

                  {/* Secondary Actions: Edit, Cancel, Delete */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOrder(order);
                        setIsEditOpen(true);
                      }}
                      className="flex-1 py-2 px-2.5 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-800 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors border border-amber-200 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {order.status !== 'cancelled' ? (
                      <button
                        type="button"
                        onClick={() => handleToggleCancelOrder(order)}
                        className="flex-1 py-2 px-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors border border-rose-200 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancelar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleCancelOrder(order)}
                        className="flex-1 py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors border border-emerald-300 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reativar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setOrderToDelete(order)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Excluir pedido"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Orders Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Nº Pedido</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Qtd Itens</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 text-xs">
                        {order.orderNumber}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {order.orderDate}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div>{order.customer.name}</div>
                        {order.customer.taxId && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {order.customer.taxId}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-slate-600">
                        {order.items.length} itens
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        {company.currency || '$'} {order.grandTotal.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrder(order);
                            setIsEditOpen(true);
                          }}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition-colors border border-amber-200"
                          title="Alterar quantidades, valores e gerar PDF novamente"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        {order.status !== 'cancelled' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleCancelOrder(order)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition-colors border border-rose-200 cursor-pointer"
                            title="Cancelar pedido e voltar produtos para o estoque"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleCancelOrder(order)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition-colors border border-emerald-300 cursor-pointer"
                            title="Reativar pedido e baixar estoque novamente"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reativar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderToSend(order);
                            setIsSendOpen(true);
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition-colors"
                          title="Enviar pedido por WhatsApp ou E-mail"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(order)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition-colors"
                          title="Baixar PDF do pedido"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderToDelete(order)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                          title="Excluir pedido"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal de Edição (Quantidades, Valores e Novo PDF) */}
      <EditOrderModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingOrder(null);
        }}
        order={editingOrder}
        company={company}
        onSave={(updatedOrder) => {
          if (onUpdateOrder) {
            onUpdateOrder(updatedOrder);
          }
          setEditingOrder(updatedOrder);
        }}
        onSaveAndSend={(updatedOrder) => {
          setSelectedOrderToSend(updatedOrder);
          setIsSendOpen(true);
        }}
      />

      {/* Modal de Envio para pedidos do histórico */}
      <SendOrderModal
        isOpen={isSendOpen}
        onClose={() => setIsSendOpen(false)}
        order={selectedOrderToSend}
        company={company}
      />

      {/* Modal de Confirmação de Cancelamento de Pedido */}
      {orderToCancel && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Cancelar pedido {orderToCancel.orderNumber}?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ao cancelar, os itens do pedido serão estornados e as quantidades voltarão automaticamente ao saldo de estoque.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmCancelOrder}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Sim, Cancelar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Reativação de Pedido */}
      {orderToReactivate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Reativar pedido {orderToReactivate.orderNumber}?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                O pedido voltará ao status "Confirmado" e os itens darão baixa novamente no estoque.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderToReactivate(null)}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmReactivateOrder}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Sim, Reativar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão Definitiva de Pedido */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir pedido {orderToDelete.orderNumber}?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                O registro do pedido será excluído do histórico. Se o pedido estava ativo, seus itens retornarão ao estoque.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteOrder}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Sim, Excluir Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
