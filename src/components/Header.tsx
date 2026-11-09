import React from 'react';
import { FileSpreadsheet, Users, History, Building2, HelpCircle, FileCheck2, Database, LogOut, User, RefreshCw, Boxes } from 'lucide-react';

export type TabType = 'create-order' | 'stock' | 'customers' | 'history' | 'settings';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenHelp: () => void;
  onOpenCatalog?: () => void;
  onSyncCatalog?: () => void;
  isSyncing?: boolean;
  ordersCount: number;
  customersCount: number;
  stockCount?: number;
  catalogCount?: number;
  currentUser?: { username: string; name: string } | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenHelp,
  onOpenCatalog,
  onSyncCatalog,
  isSyncing,
  ordersCount,
  customersCount,
  stockCount,
  catalogCount,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo Brand ARTEX7 */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('create-order')}>
            <img
              src="/assets/aistudio/Logo_ARtex7_em_Preto_254e2cb7.png"
              alt="ARTEX7"
              className="h-8 sm:h-9 w-auto object-contain"
            />
            <span className="hidden sm:inline-block ml-1 text-[11px] font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200">
              Pedidos & Estoque
            </span>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex space-x-1 lg:space-x-2 text-sm font-medium">
            <button
              onClick={() => onTabChange('create-order')}
              className={`py-2 px-3 lg:px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'create-order'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Novo Pedido & OCR</span>
            </button>

            <button
              onClick={() => onTabChange('stock')}
              className={`py-2 px-3 lg:px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'stock'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Boxes className="w-4 h-4 text-emerald-600" />
              <span>Estoque</span>
              {stockCount !== undefined && (
                <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                  {stockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('customers')}
              className={`py-2 px-3 lg:px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'customers'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Clientes</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                {customersCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange('history')}
              className={`py-2 px-3 lg:px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                {ordersCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange('settings')}
              className={`py-2 px-3 lg:px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Empresa</span>
            </button>
          </nav>

          {/* Quick Actions (Sync, Help, User) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {onSyncCatalog && (
              <button
                type="button"
                onClick={onSyncCatalog}
                disabled={isSyncing}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 border border-sky-300 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
                title="Sincronizar Banco de Dados com todos os dispositivos (PC e Celular)"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>
            )}
            <button
              onClick={onOpenHelp}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-xs cursor-pointer"
              title="Ver instruções de teste"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Ajuda</span>
            </button>

            {currentUser && (
              <div className="flex items-center pl-1.5 sm:pl-2 ml-1 border-l border-slate-200 gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-800" title={`Conectado como ${currentUser.name}`}>
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] uppercase font-bold">
                    {currentUser.name[0]}
                  </span>
                  <span className="hidden sm:inline">{currentUser.name}</span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Sair do sistema (Logout)"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Thumbs-friendly bar fixed at bottom for phones) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-1.5 px-2 flex justify-around items-center shadow-lg">
        <button
          onClick={() => onTabChange('create-order')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'create-order'
              ? 'text-indigo-600 font-bold bg-indigo-50/70'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Pedido</span>
        </button>

        <button
          onClick={() => onTabChange('stock')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'stock'
              ? 'text-emerald-700 font-bold bg-emerald-50/70'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Estoque</span>
          {stockCount !== undefined && stockCount > 0 && (
            <span className="absolute top-0.5 right-2 min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold font-mono flex items-center justify-center">
              {stockCount > 99 ? '99+' : stockCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('customers')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'customers'
              ? 'text-indigo-600 font-bold bg-indigo-50/70'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Clientes</span>
        </button>

        <button
          onClick={() => onTabChange('history')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'history'
              ? 'text-indigo-600 font-bold bg-indigo-50/70'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Histórico</span>
          {ordersCount > 0 && (
            <span className="absolute top-0.5 right-2 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold font-mono flex items-center justify-center">
              {ordersCount > 99 ? '99+' : ordersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'text-indigo-600 font-bold bg-indigo-50/70'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Empresa</span>
        </button>
      </nav>
    </header>
  );
};
