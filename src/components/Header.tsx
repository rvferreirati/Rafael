import React from 'react';
import { FileSpreadsheet, Users, History, Building2, HelpCircle, FileCheck2 } from 'lucide-react';

export type TabType = 'create-order' | 'customers' | 'history' | 'settings';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenHelp: () => void;
  ordersCount: number;
  customersCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenHelp,
  ordersCount,
  customersCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('create-order')}>
            <div className="bg-indigo-600 text-white p-2 rounded-xl font-bold text-lg leading-none shadow-sm flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                SalesOrder<span className="text-indigo-600">Pro</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                OCR & PDF
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-3 text-sm font-medium">
            <button
              onClick={() => onTabChange('create-order')}
              className={`py-2 px-3 sm:px-4 rounded-lg flex items-center gap-2 transition-all ${
                activeTab === 'create-order'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Pedido & OCR</span>
              <span className="sm:hidden">Novo</span>
            </button>

            <button
              onClick={() => onTabChange('customers')}
              className={`py-2 px-3 sm:px-4 rounded-lg flex items-center gap-2 transition-all ${
                activeTab === 'customers'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Clientes</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {customersCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange('history')}
              className={`py-2 px-3 sm:px-4 rounded-lg flex items-center gap-2 transition-all ${
                activeTab === 'history'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Histórico</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {ordersCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange('settings')}
              className={`py-2 px-3 sm:px-4 rounded-lg flex items-center gap-2 transition-all ${
                activeTab === 'settings'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden md:inline">Empresa</span>
            </button>
          </nav>

          {/* Quick Help Guide Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenHelp}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all shadow-xs"
              title="Ver instruções de teste"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Como Testar?</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
