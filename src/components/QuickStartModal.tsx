import React from 'react';
import { X, Sparkles, Upload, FileText, CheckCircle2, Download, HelpCircle } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Como Testar a Aplicação?</h2>
              <p className="text-sm text-slate-500">Guia rápido passo a passo para testar o OCR e geração de PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Step Flow */}
        <div className="space-y-4">
          <div className="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
              1
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-indigo-600" />
                Carregue uma Fatura de Teste ou Imagem Real
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Você pode arrastar qualquer captura de tela/foto de pedido ou usar um dos <strong>Exemplos Prontos</strong> com 1 clique abaixo. O sistema já vem com imagens pré-configuradas de alta legibilidade.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
              2
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Extração Automática dos Itens e Produtos
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                O motor com <strong>Inteligência Artificial (Gemini Vision)</strong> e <strong>OCR</strong> lê a imagem, identifica tabelas e insere automaticamente os códigos SKU, descrições, quantidades e preços na tabela de produtos.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
              3
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <Download className="w-4 h-4 text-indigo-600" />
                Gerar PDF & Enviar por WhatsApp ou E-mail
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ao clicar em <strong>"Gerar PDF & Enviar Pedido"</strong>, o documento oficial é baixado (com o comprovante anexado na 2ª página) e você pode enviar a lista completa de produtos diretamente via <strong>WhatsApp</strong> ou <strong>E-mail</strong> para o cliente!
              </p>
            </div>
          </div>
        </div>

        {/* Quick test buttons inside modal */}
        <div className="pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Experimente agora mesmo com 1 clique:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => {
                onSelectSamplePreset('hardware');
                onClose();
              }}
              className="p-3 text-left border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 rounded-xl transition-all group"
            >
              <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600">Hardware & TI</div>
              <div className="text-[11px] text-slate-500 mt-0.5">4 produtos com roteadores e cabos</div>
            </button>
            <button
              onClick={() => {
                onSelectSamplePreset('consulting');
                onClose();
              }}
              className="p-3 text-left border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 rounded-xl transition-all group"
            >
              <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600">Consultoria TI</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Serviços e horas técnicas</div>
            </button>
            <button
              onClick={() => {
                onSelectSamplePreset('office');
                onClose();
              }}
              className="p-3 text-left border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 rounded-xl transition-all group"
            >
              <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600">Mobiliário & Escritório</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Cadeiras e monitores 4K</div>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            Entendi, Ir Para o App
          </button>
        </div>
      </div>
    </div>
  );
};
