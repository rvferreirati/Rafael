import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Download,
  Upload,
  Layers,
  CheckCircle2,
  Cloud,
  AlertCircle,
  Boxes,
  Users,
  History,
  Building2,
  Database
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  CatalogProduct,
  fetchServerCatalogInfo,
  syncCatalogWithServer,
  SyncMode,
  ServerCatalogInfo
} from '../utils/productCatalog';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  localCatalog: CatalogProduct[];
  onUpdateCatalog: (newCatalog: CatalogProduct[]) => void;
  stockCount?: number;
  customersCount?: number;
  ordersCount?: number;
  companyName?: string;
  onSyncAllToCloud?: () => Promise<void>;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  localCatalog,
  onUpdateCatalog,
  stockCount = 0,
  customersCount = 0,
  ordersCount = 0,
  companyName = 'Empresa',
  onSyncAllToCloud,
}) => {
  const [serverInfo, setServerInfo] = useState<ServerCatalogInfo | null>(null);
  const [isLoadingServer, setIsLoadingServer] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadServerStatus = async () => {
    setIsLoadingServer(true);
    const info = await fetchServerCatalogInfo();
    setServerInfo(info);
    setIsLoadingServer(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadServerStatus();
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFullCloudSync = async () => {
    if (!onSyncAllToCloud) return;
    setIsProcessing(true);
    setFeedback(null);
    try {
      await onSyncAllToCloud();
      confetti({
        particleCount: 60,
        spread: 65,
        origin: { y: 0.6 },
      });
      setFeedback({
        type: 'success',
        message: 'Todos os dados (Estoque, Clientes, Pedidos, Empresa e Catálogo) foram sincronizados na nuvem em tempo real!',
      });
      await loadServerStatus();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao enviar dados completos para o banco de dados na nuvem.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = async (mode: SyncMode) => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      const result = await syncCatalogWithServer(localCatalog, mode);
      onUpdateCatalog(result.catalog);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });

      setFeedback({
        type: 'success',
        message: result.message,
      });

      await loadServerStatus();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Falha ao sincronizar com o servidor.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Cloud className={`w-5 h-5 ${isProcessing ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold leading-tight">Banco de Dados na Nuvem (Tempo Real)</h3>
              <p className="text-[11px] sm:text-xs text-slate-300">
                Sincronização automática entre Computador, Celular e qualquer navegador
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Feedback message */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-semibold animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Live Modules Overview */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs sm:text-sm font-black text-emerald-950">
                  Módulos Conectados em Tempo Real
                </span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Firestore Ativo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white rounded-xl p-2.5 border border-emerald-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Boxes className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Estoque</div>
                  <div className="text-xs sm:text-sm font-black text-slate-800 truncate">{stockCount} itens</div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-2.5 border border-emerald-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Clientes</div>
                  <div className="text-xs sm:text-sm font-black text-slate-800 truncate">{customersCount} ativos</div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-2.5 border border-emerald-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Pedidos</div>
                  <div className="text-xs sm:text-sm font-black text-slate-800 truncate">{ordersCount} salvos</div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-2.5 border border-emerald-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Empresa</div>
                  <div className="text-xs sm:text-sm font-black text-slate-800 truncate">{companyName}</div>
                </div>
              </div>
            </div>

            {onSyncAllToCloud && (
              <button
                type="button"
                onClick={handleFullCloudSync}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
              >
                <Database className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>
                  {isProcessing
                    ? 'Sincronizando todos os módulos...'
                    : 'Forçar Envio Completo deste Aparelho para Nuvem'}
                </span>
              </button>
            )}
          </div>

          {/* Catalog Status */}
          <div className="pt-1 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Catálogo de Pesquisa Rápida ({localCatalog.length} itens locais • {isLoadingServer ? '...' : serverInfo ? serverInfo.count : '0'} nuvem)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => handleAction('pull')}
                disabled={isProcessing}
                className="w-full text-left p-3 rounded-2xl border border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    Baixar Catálogo da Nuvem
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Atualiza o catálogo deste aparelho com a versão da nuvem.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAction('merge')}
                disabled={isProcessing}
                className="w-full text-left p-3 rounded-2xl border border-emerald-200 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    Mesclar Catálogo Local e Nuvem
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Combina produtos sem apagar nenhum código.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAction('push')}
                disabled={isProcessing}
                className="w-full text-left p-3 rounded-2xl border border-slate-200 hover:border-sky-400 bg-white hover:bg-sky-50/40 transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    Enviar Catálogo Local para Nuvem
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Publica a lista de catálogo deste aparelho para todos os outros.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={loadServerStatus}
            disabled={isLoadingServer}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServer ? 'animate-spin' : ''}`} />
            <span>Atualizar Status</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
