import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Boxes,
  RefreshCw,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  RotateCcw,
  HelpCircle,
  Hash,
  ShoppingBag
} from 'lucide-react';

interface QuickStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSamplePreset: (presetId: string) => void;
}

export const QuickStartModal: React.FC<QuickStartModalProps> = ({
  isOpen,
  onClose,
  onSelectSamplePreset,
}) => {
  const [activeGuideTab, setActiveGuideTab] = useState<'novidades' | 'ocr'>('novidades');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Guia de Testes e Funcionalidades</h2>
              <p className="text-sm text-slate-500">
                Como testar a busca pelos últimos dígitos, a coluna de estoque e a sincronização
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch inside modal */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <button
            type="button"
            onClick={() => setActiveGuideTab('novidades')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeGuideTab === 'novidades'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Estoque, Códigos & Sincronização</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveGuideTab('ocr')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeGuideTab === 'ocr'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>OCR de Prints & Exemplos Prontos</span>
          </button>
        </div>

        {activeGuideTab === 'novidades' ? (
          <div className="space-y-4">
            {/* Test 1: Suffix Code Search in Manual Order vs Stock 92000 Codes */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-indigo-600" />
                  Códigos 92000 no Estoque & Busca Rápida no Pedido Manual
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                • <strong>Na Aba Estoque:</strong> Os códigos permanecem exatamente como na sua planilha original (padrão <strong>92000...</strong>, ex: <strong>9200047</strong>, <strong>9200046</strong>, <strong>9200010</strong>, etc.).<br />
                • <strong>Na Aba de Pedido Manual:</strong> Você pode digitar o código completo <strong>9200047</strong> ou <strong>apenas os últimos números</strong>, agilizando o lançamento:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs text-xs">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">46</span>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Encontra <strong>9200046</strong> (Lixa mini canário) e <strong>92000346</strong> (Lixa canário)
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs text-xs">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">37</span>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Encontra <strong>92000237</strong> (Lixa refil reta descartável)
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs text-xs">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">9200047</span>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Busca também pelo código completo oficial da planilha!
                  </p>
                </div>
              </div>
            </div>

            {/* Test 2: Estoque Column in Order */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-emerald-700" />
                  Coluna "Em Estoque" no Pedido (Sem poluição visual)
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Na tabela de itens do pedido, adicionamos a coluna oficial <strong>"Em Estoque"</strong>.
                Ela exibe em tempo real o saldo disponível de cada produto (ex: <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">100 un</span>).
                A legenda confusa <em>"BD: R$"</em> sob o código foi completamente removida.
              </p>
            </div>

            {/* Test 3: Deduct & Restock on Cancel */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  Baixa Automática no Estoque & Estorno ao Cancelar
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. Ao clicar em <strong>"Salvar Pedido"</strong> ou <strong>"Gerar PDF & Enviar"</strong>, o saldo de cada produto é baixado da aba <strong>Estoque</strong>.<br />
                2. Na aba <strong>Histórico</strong>, se você alterar o status do pedido para <strong>"Cancelado"</strong> (ou excluir o pedido), o sistema estorna automaticamente as quantidades de volta para o Estoque!
              </p>
            </div>

            {/* Test 4: Real-time Multi-Device Sync */}
            <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-sky-600" />
                  Como Testar a Sincronização (PC e Celular)
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Clique no botão <strong>"Sincronizar com Todos"</strong> no topo da tela. Ele abre o painel de sincronização em tempo real:
              </p>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                <li>Você pode escanear o <strong>QR Code</strong> ou copiar o link para abrir no celular.</li>
                <li>Ao alterar um produto ou pedido no PC, ele atualiza no celular e vice-versa.</li>
                <li>Ao alternar entre janelas ou clicar em sincronizar, os dados são recarregados instantaneamente.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">Exemplos Prontos de Faturas para Testar OCR:</h3>
              <p className="text-xs text-slate-600">
                Se quiser testar a leitura automática por imagem com inteligência artificial, clique em um dos exemplos abaixo:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectSamplePreset('hardware');
                    onClose();
                  }}
                  className="p-3 text-left border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 rounded-xl transition-all cursor-pointer"
                >
                  <div className="font-bold text-xs text-slate-900">Hardware & TI</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">4 produtos com roteadores e cabos</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSamplePreset('consulting');
                    onClose();
                  }}
                  className="p-3 text-left border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 rounded-xl transition-all cursor-pointer"
                >
                  <div className="font-bold text-xs text-slate-900">Consultoria TI</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Serviços e horas técnicas</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSamplePreset('office');
                    onClose();
                  }}
                  className="p-3 text-left border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 rounded-xl transition-all cursor-pointer"
                >
                  <div className="font-bold text-xs text-slate-900">Mobiliário & Escritório</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Cadeiras e monitores 4K</div>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Entendi, Ir Para o App
          </button>
        </div>
      </div>
    </div>
  );
};
