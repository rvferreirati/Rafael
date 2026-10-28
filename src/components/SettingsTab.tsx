import React, { useState } from 'react';
import { Building2, Save, CheckCircle2, ShieldCheck, DollarSign } from 'lucide-react';
import { CompanyProfile } from '../types';

interface SettingsTabProps {
  company: CompanyProfile;
  onSaveCompany: (updated: CompanyProfile) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ company, onSaveCompany }) => {
  const [name, setName] = useState(company.name);
  const [taxId, setTaxId] = useState(company.taxId);
  const [email, setEmail] = useState(company.email);
  const [phone, setPhone] = useState(company.phone);
  const [address, setAddress] = useState(company.address);
  const [currency, setCurrency] = useState(company.currency || 'R$');
  const [defaultTaxRate, setDefaultTaxRate] = useState(company.defaultTaxRate || 8);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCompany({
      name,
      taxId,
      email,
      phone,
      address,
      currency,
      defaultTaxRate,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Configurações da Empresa Emissora</h2>
            <p className="text-xs text-slate-500">
              Essas informações aparecerão no cabeçalho e rodapé de todos os PDFs gerados.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Dados da empresa atualizados com sucesso! Próximos PDFs usarão estas configurações.</span>
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
                placeholder="Ex: Apex Industrial Soluções Ltda"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
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
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
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
                placeholder="comercial@apexindustrial.com"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
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
                placeholder="+55 (11) 3456-7890"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Moeda Padrão
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
              >
                <option value="R$">Real Brasileiro (R$)</option>
                <option value="$">Dólar Americano ($)</option>
                <option value="€">Euro (€)</option>
                <option value="£">Libra (£)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Taxa de Impostos Padrão (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
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
              placeholder="Av. Paulista, 1000, 5º andar - Bela Vista, São Paulo - SP, CEP 01310-100"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
            ></textarea>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Perfil da Empresa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
