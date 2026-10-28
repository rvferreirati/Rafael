import React, { useState } from 'react';
import { Users, Plus, Search, Mail, Phone, MapPin, Edit2, Trash2, X, Check } from 'lucide-react';
import { Customer } from '../types';

interface CustomersTabProps {
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({
  customers,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setTaxId('');
    setEmail('');
    setPhone('');
    setAddress('');
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setTaxId(c.taxId);
    setEmail(c.email);
    setPhone(c.phone);
    setAddress(c.address);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCustomer) {
      onUpdateCustomer({
        ...editingCustomer,
        name,
        taxId,
        email,
        phone,
        address,
      });
    } else {
      onAddCustomer({
        id: `cust-${Date.now()}`,
        name,
        taxId,
        email,
        phone,
        address,
      });
    }

    setModalOpen(false);
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.taxId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Diretório de Clientes</h2>
          <p className="text-xs text-slate-500">
            Gerencie empresas e clientes cadastrados para preenchimento rápido em pedidos de venda.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou e-mail..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Customer List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm">Nenhum cliente encontrado com os termos pesquisados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nome / Razão Social</th>
                  <th className="py-3 px-4">CNPJ / Tax ID</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Endereço</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {c.taxId || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 space-y-0.5">
                      {c.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {!c.email && !c.phone && <span>—</span>}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                      {c.address ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold p-1.5 rounded-lg hover:bg-indigo-50"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Excluir o cliente ${c.name}?`)) {
                            onDeleteCustomer(c.id);
                          }
                        }}
                        className="text-xs text-rose-500 hover:text-rose-700 font-semibold p-1.5 rounded-lg hover:bg-rose-50"
                        title="Excluir cliente"
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

      {/* Customer Modal (Add/Edit) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome / Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do cliente ou empresa"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CNPJ / CPF / Tax ID
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@dominio.com"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Endereço Completo
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, complemento, cidade, estado"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
