import React, { useState } from 'react';
import { FileText, Download, Trash2, Search, Calendar, DollarSign, Package, Send, Edit3 } from 'lucide-react';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'draft' | 'delivered'>('all');
  const [selectedOrderToSend, setSelectedOrderToSend] = useState<SalesOrder | null>(null);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const filtered = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.grandTotal || 0), 0);
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;

  const handleDownloadPDF = (order: SalesOrder) => {
    generateSalesOrderPDF(order, company, true);
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
          <div className="overflow-x-auto">
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
                        onClick={() => {
                          if (confirm(`Excluir o registro do pedido ${order.orderNumber}?`)) {
                            onDeleteOrder(order.id);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
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
    </div>
  );
};
