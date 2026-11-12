import React, { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle2, Cloud, RefreshCw } from 'lucide-react';
import { CompanyProfile } from '../types';

interface SettingsTabProps {
  company: CompanyProfile;
  onSaveCompany: (updated: CompanyProfile) => void;
  onSyncCompany?: () => Promise<void> | void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ company, onSaveCompany, onSyncCompany }) => {
  const [name, setName] = useState(company.name);
  const [taxId, setTaxId] = useState(company.taxId);
  const [email, setEmail] = useState(company.email);
  const [phone, setPhone] = useState(company.phone);
  const [address, setAddress] = useState(company.address);
  const [currency, setCurrency] = useState(company.currency || 'R$');
  const [defaultTaxRate, setDefaultTaxRate] = useState(company.defaultTaxRate || 8);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sincroniza formulário automaticamente caso chegue atualização em tempo real da nuvem (outro dispositivo)
  useEffect(() => {
    setName(company.name);
    setTaxId(company.taxId);
    setEmail(company.email);
    setPhone(company.phone);
    setAddress(company.address);
    setCurrency(company.currency || 'R$');
    setDefaultTaxRate(company.defaultTaxRate ?? 8);
  }, [company]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCompany({
      name: name.trim(),
      taxId: taxId.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      currency,
      defaultTaxRate,
      logoUrl: company.logoUrl || '/assets/aistudio/Logo_ARtex7_em_Preto_254e2cb7.png',
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleManualSync = async () => {
    if (!onSyncCompany) return;
    setIsSyncing(true);
    try {
      await onSyncCompany();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
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
                Perfil da Empresa Sincronizado na Nuvem
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Tempo Real
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Alterações feitas aqui são aplicadas automaticamente no computador, celular e em qualquer navegador.
            </p>
          </div>
        </div>

        {onSyncCompany && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="self-start sm:self-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-75"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Enviando...' : 'Sincronizar Empresa'}</span>
          </button>
        )}
      </div>

      <div className="bg-white p-5 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center space-x-4 pb-4 border-b border-slate-100">
          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
            <img src={company.logoUrl || "/assets/aistudio/Logo_ARtex7_em_Preto_254e2cb7.png"} alt="ARTEX7 Logo" className="h-7 sm:h-8 w-auto object-contain" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Configurações da Empresa Emissora (ARTEX7)</h2>
            <p className="text-xs text-slate-500">
              Essas informações e o logotipo ARTEX7 aparecerão no cabeçalho de todos os PDFs gerados.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Dados da empresa salvos e sincronizados na nuvem com sucesso!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Razão Social / Nome da Empresa *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: ARTEX7"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CNPJ / CPF / Tax ID *
              </label>
              <input
                type="text"
                required
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="Ex: 00.123.456/0001-90"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail Corporativo
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@artex7.com.br"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telefone de Contato
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 4004-9800"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Moeda Padrão
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium min-h-[44px]"
              >
                <option value="R$">Real Brasileiro (R$)</option>
                <option value="$">Dólar Americano ($)</option>
                <option value="€">Euro (€)</option>
                <option value="£">Libra (£)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Frete Padrão ({currency || 'R$'})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Endereço Comercial Completo
            </label>
            <textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Paulista, 1000, 12º andar - São Paulo, SP"
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
            ></textarea>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              <span>Salvar e Sincronizar Empresa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
