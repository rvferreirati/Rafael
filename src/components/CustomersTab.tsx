import React, { useState } from 'react';
import { Users, Plus, Search, Mail, Phone, MapPin, Edit2, Trash2, X, Check, Cloud, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { Customer } from '../types';
import {
  formatCpfCnpj,
  formatCep,
  validateCpfCnpj,
  isValidCep,
  lookupAddressByCep,
  onlyDigits,
} from '../utils/masks';

interface CustomersTabProps {
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onSyncCustomers?: () => Promise<void> | void;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({
  customers,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onSyncCustomers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setTaxId('');
    setEmail('');
    setPhone('');
    setCep('');
    setAddress('');
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    const digitsOnly = onlyDigits(c.taxId || '');
    setTaxId(digitsOnly.length >= 11 && !/[a-zA-Z]/.test(c.taxId || '') ? formatCpfCnpj(c.taxId) : (c.taxId || ''));
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setCep(c.cep ? formatCep(c.cep) : '');
    setAddress(c.address || '');
    setModalOpen(true);
  };

  const handleCepChange = async (rawValue: string) => {
    const masked = formatCep(rawValue);
    setCep(masked);
    if (onlyDigits(masked).length === 8) {
      setIsLookingUpCep(true);
      try {
        const res = await lookupAddressByCep(masked);
        if (res?.formatted && !address.trim()) {
          setAddress(res.formatted);
        }
      } finally {
        setIsLookingUpCep(false);
      }
    }
  };

  const handleForceCepLookup = async () => {
    if (!isValidCep(cep)) return;
    setIsLookingUpCep(true);
    try {
      const res = await lookupAddressByCep(cep);
      if (res?.formatted) {
        setAddress(res.formatted);
      }
    } finally {
      setIsLookingUpCep(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanCep = cep.trim();
    const cleanTaxId = taxId.trim();

    if (editingCustomer) {
      onUpdateCustomer({
        ...editingCustomer,
        name: name.trim(),
        taxId: cleanTaxId,
        email: email.trim(),
        phone: phone.trim(),
        cep: cleanCep,
        address: address.trim(),
      });
    } else {
      onAddCustomer({
        id: `cust-${Date.now()}`,
        name: name.trim(),
        taxId: cleanTaxId,
        email: email.trim(),
        phone: phone.trim(),
        cep: cleanCep,
        address: address.trim(),
      });
    }

    setModalOpen(false);
  };

  const handleManualSync = async () => {
    if (!onSyncCustomers) return;
    setIsSyncing(true);
    try {
      await onSyncCustomers();
    } finally {
      setIsSyncing(false);
    }
  };

  const taxIdValidation = validateCpfCnpj(taxId);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.taxId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.cep || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Cloud Sync Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-xs sm:text-sm font-black text-slate-800">
                Clientes Sincronizados na Nuvem ({customers.length} cadastrados)
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Tempo Real
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Qualquer cliente adicionado, editado ou excluído aparece instantaneamente em todos os seus dispositivos.
            </p>
          </div>
        </div>

        {onSyncCustomers && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="self-start sm:self-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-75"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Forçar Envio Nuvem'}</span>
          </button>
        )}
      </div>

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
          <>
            {/* Mobile Customer Cards (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((c) => (
                <div key={c.id} className="p-4 space-y-2.5 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="w-9 h-9 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerToDelete(c)}
                        className="w-9 h-9 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {c.taxId && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      CNPJ/CPF: {c.taxId}
                    </div>
                  )}

                  <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-50">
                    {c.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.email}</span>
                      </div>
                    )}
                    {(c.address || c.cep) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <span className="text-slate-500 text-[11px]">
                          {c.cep ? `CEP ${c.cep}${c.address ? ' • ' : ''}` : ''}
                          {c.address}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Customers Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
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
                        {c.address || c.cep ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {c.cep ? `${c.cep}${c.address ? ' • ' : ''}` : ''}
                              {c.address}
                            </span>
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
                          onClick={() => setCustomerToDelete(c)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-semibold p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
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
          </>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CNPJ / CPF
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={18}
                    value={taxId}
                    onChange={(e) => setTaxId(formatCpfCnpj(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 outline-none ${
                      taxId && !taxIdValidation.valid
                        ? 'border-amber-300 focus:ring-amber-300 bg-amber-50/30'
                        : taxId && taxIdValidation.valid && taxIdValidation.type
                        ? 'border-emerald-300 focus:ring-emerald-300 bg-emerald-50/20'
                        : 'border-slate-300 focus:ring-indigo-500'
                    }`}
                  />
                  {taxId && taxIdValidation.message && (
                    <span
                      className={`mt-1 text-[10px] font-semibold flex items-center gap-1 ${
                        taxIdValidation.valid ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {taxIdValidation.valid ? (
                        <Check className="w-3 h-3 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 shrink-0" />
                      )}
                      {taxIdValidation.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CEP
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={9}
                      value={cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 outline-none ${
                        cep && isValidCep(cep)
                          ? 'border-emerald-300 focus:ring-emerald-300 bg-emerald-50/20'
                          : 'border-slate-300 focus:ring-indigo-500'
                      }`}
                    />
                    {isValidCep(cep) && (
                      <button
                        type="button"
                        onClick={handleForceCepLookup}
                        disabled={isLookingUpCep}
                        className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer disabled:opacity-60"
                        title="Preencher endereço pelo CEP"
                      >
                        {isLookingUpCep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Buscar'}
                      </button>
                    )}
                  </div>
                  {cep && (
                    <span
                      className={`mt-1 text-[10px] font-semibold flex items-center gap-1 ${
                        isValidCep(cep) ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {isLookingUpCep
                        ? 'Buscando endereço...'
                        : isValidCep(cep)
                        ? 'CEP completo (00000-000)'
                        : `${onlyDigits(cep).length}/8 dígitos`}
                    </span>
                  )}
                </div>
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

      {/* Modal de Confirmação de Exclusão de Cliente */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir cliente {customerToDelete.name}?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tem certeza que deseja excluir o cadastro deste cliente? Os pedidos anteriores no histórico permanecerão intactos.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCustomer(customerToDelete.id);
                  setCustomerToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Sim, Excluir Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
