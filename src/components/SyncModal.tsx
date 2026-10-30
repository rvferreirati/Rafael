import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Download,
  Upload,
  Layers,
  CheckCircle2,
  Smartphone,
  Laptop,
  Cloud,
  Check,
  AlertCircle
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
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  localCatalog,
  onUpdateCatalog,
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

      // Reload server info after sync
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

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'Desconhecido';
    const date = new Date(ts);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' (' + date.toLocaleDateString('pt-BR') + ')';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
              <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Sincronização com Computador e Celular</h3>
              <p className="text-xs text-slate-300">
                Transfira produtos e atualizações em tempo real entre todos os dispositivos
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

        {/* Feedback message */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-semibold animate-in fade-in ${
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

        {/* Status Comparison Cards */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Este Computador */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
                <Laptop className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500">Neste Dispositivo</span>
              <span className="text-2xl font-black text-slate-900 mt-1">
                {localCatalog.length}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">produtos ativos</span>
            </div>

            {/* Nuvem / Celular */}
            <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl flex flex-col items-center text-center relative">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mb-2">
                <Cloud className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-sky-700">Na Nuvem (Celular)</span>
              <span className="text-2xl font-black text-sky-950 mt-1">
                {isLoadingServer ? '...' : serverInfo ? serverInfo.count : '0'}
              </span>
              <span className="text-[11px] text-sky-600 mt-0.5">
                {isLoadingServer
                  ? 'Verificando...'
                  : serverInfo
                  ? `Última: ${formatTimestamp(serverInfo.updatedAt)}`
                  : 'Servidor pronto'}
              </span>
            </div>
          </div>

          {/* Sync Actions */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Escolha como deseja sincronizar:
            </span>

            {/* Option 1: Baixar da Nuvem (Atualizar este Computador) */}
            <button
              type="button"
              onClick={() => handleAction('pull')}
              disabled={isProcessing}
              className="w-full text-left p-3.5 rounded-2xl border-2 border-indigo-200 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 transition-all flex items-start gap-3.5 cursor-pointer group disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Download className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    1. Baixar da Nuvem para este Computador
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                    Receber do Celular
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Substitui os dados deste computador pelos produtos que foram salvos pelo celular ou nuvem.
                </p>
              </div>
            </button>

            {/* Option 2: Mesclar Tudo (Inteligente) */}
            <button
              type="button"
              onClick={() => handleAction('merge')}
              disabled={isProcessing}
              className="w-full text-left p-3.5 rounded-2xl border-2 border-emerald-300 hover:border-emerald-500 bg-emerald-50/60 hover:bg-emerald-50 transition-all flex items-start gap-3.5 cursor-pointer group disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    2. Mesclar Celular e Computador
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Mais Seguro
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Combina os produtos de ambos os dispositivos. Nenhum produto ou código é apagado!
                </p>
              </div>
            </button>

            {/* Option 3: Enviar deste Computador para a Nuvem */}
            <button
              type="button"
              onClick={() => handleAction('push')}
              disabled={isProcessing}
              className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-sky-400 bg-white hover:bg-sky-50/40 transition-all flex items-start gap-3.5 cursor-pointer group disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    3. Enviar deste Computador para a Nuvem
                  </span>
                  <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-full">
                    Enviar para Celulares
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Salva a lista completa deste computador na nuvem para que os celulares baixem.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={loadServerStatus}
            disabled={isLoadingServer}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServer ? 'animate-spin' : ''}`} />
            <span>Verificar Novamente</span>
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
