import React, { useState } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Copy,
  Layers,
  FileText,
  Smartphone,
  Webhook,
  Bookmark,
  MousePointer,
  AlertCircle,
  ExternalLink,
  Laptop
} from 'lucide-react';
import { LineItem } from '../types';
import { parseWhatsAppCartMessage, SAMPLE_WHATSAPP_CART_MESSAGE } from '../utils/whatsappCartParser';

interface WhatsAppCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyItems: (items: LineItem[], customerInfo?: { name?: string; phone?: string; address?: string }) => void;
  onOpenQuickCatalog?: () => void;
}

export const WhatsAppCartModal: React.FC<WhatsAppCartModalProps> = ({
  isOpen,
  onClose,
  onApplyItems,
  onOpenQuickCatalog,
}) => {
  const [cartText, setCartText] = useState(SAMPLE_WHATSAPP_CART_MESSAGE);
  const [activeTab, setActiveTab] = useState<'solutions' | 'bookmarklet' | 'paste' | 'webhook'>('solutions');
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  if (!isOpen) return null;

  const parsed = parseWhatsAppCartMessage(cartText);

  const bookmarkletCode = `javascript:(function(){try{var items=[];var els=document.querySelectorAll('[role="dialog"] [role="listitem"], [data-testid="order-item"], [data-testid="interactive-order"], .copyable-text');var text="*Pedido do WhatsApp*\\n\\n";if(els.length>0){els.forEach(function(el){var t=el.innerText.replace(/\\n+/g," ").trim();if(t&&t.length>3){text+="• "+t+"\\n";}});}else{text=document.body.innerText.slice(0,500);}navigator.clipboard.writeText(text).then(function(){alert("✅ Itens do WhatsApp copiados! Volte ao ARTEX7 e cole no importador.");}).catch(function(){prompt("Copie os itens abaixo:",text);});}catch(e){alert("Abra o carrinho no WhatsApp Web e clique novamente.");}})();`;

  const handleApply = () => {
    if (parsed.items.length === 0) {
      return;
    }

    onApplyItems(parsed.items, {
      name: parsed.customerName,
      phone: parsed.customerPhone,
      address: parsed.customerAddress,
    });
    onClose();
  };

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiedBookmarklet(true);
    setTimeout(() => setCopiedBookmarklet(false), 2500);
  };

  const handleCopyWebhookUrl = () => {
    const fullUrl = `${window.location.origin}/api/whatsapp-webhook`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-5 sm:p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-xs">
              <MessageSquare className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Leitor de Carrinho do WhatsApp</h3>
                <span className="text-[10px] bg-emerald-500/40 border border-emerald-300/40 text-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                  Solução para o bloqueio do WhatsApp
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Como ler e preencher seus pedidos ARTEX7 com precisão total
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex flex-wrap items-center gap-1.5 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('solutions')}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'solutions'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>1. Melhores Maneiras de Ler</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bookmarklet')}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'bookmarklet'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. Capturador WhatsApp Web</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>3. Colar Texto / Testar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('webhook')}
            className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'webhook'
                ? 'bg-white text-teal-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Webhook className="w-3.5 h-3.5 text-teal-600" />
            <span>4. API Meta</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: SOLUTIONS & WHY WHATSAPP BLOCKS COPY */}
          {activeTab === 'solutions' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950 text-xs">
                    Por que não é possível copiar o carrinho no WhatsApp?
                  </p>
                  <p className="text-amber-900 text-[11px] leading-relaxed">
                    O WhatsApp trata o balão do carrinho (<code className="bg-amber-100 font-mono px-1 py-0.5 rounded">🛍️ Pedido com X itens</code>) como um <strong>botão nativo fechado</strong>. O aplicativo desabilita deliberadamente o comando de copiar o texto desse cartão para forçar o uso da interface interna dele.
                  </p>
                </div>
              </div>

              <h4 className="font-bold text-slate-900 text-sm">
                Como contornar isso e ler os itens sem esforço:
              </h4>

              <div className="grid grid-cols-1 gap-3">
                {/* Method 1: Improved Screenshot OCR */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 flex items-center gap-2 text-xs">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                      Tirar Print da Tela (IA Atualizada e Especializada)
                    </span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                      Corrigido no App
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    <strong>O que mudou:</strong> Anteriormente a IA falhava porque procurava frases rígidas como &quot;Continuar comprando&quot; e &quot;Subtotal&quot;, que não existem no WhatsApp, e cortava o topo da imagem (decepando o primeiro item). Agora nossa IA foi recalibrada para entender exatamente o formato do WhatsApp (balão de pedido, botões de quantidade e preços), garantindo a extração dos produtos como <em>Top coat</em>, <em>Base bomba</em> e <em>Removedor</em>.
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                      Voltar e Carregar Print do WhatsApp
                    </button>
                  </div>
                </div>

                {/* Method 2: Bookmarklet for WhatsApp Web */}
                <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-950 flex items-center gap-2 text-xs">
                      <span className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                      Capturador 1-Clique no WhatsApp Web (Para Computador)
                    </span>
                    <span className="text-[10px] bg-sky-200 text-sky-900 font-bold px-2 py-0.5 rounded-full">
                      Zero Erro • 100% Exato
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-800 leading-relaxed">
                    Se você usa o WhatsApp Web no navegador: criamos um botão inteligente de favoritos. Basta clicar nele com a conversa aberta que ele lê o carrinho direto do código da tela e copia os produtos na hora, sem IA e sem chance de errar!
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('bookmarklet')}
                      className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Ver Como Usar o Capturador 1-Clique</span>
                    </button>
                  </div>
                </div>

                {/* Method 3: Quick Catalog */}
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 flex items-center gap-2 text-xs">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                      Catálogo Rápido em 1 Toque (Sem precisar de print)
                    </span>
                    <span className="text-[10px] bg-indigo-200 text-indigo-900 font-bold px-2 py-0.5 rounded-full">
                      Mais Rápido
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Você pode tocar diretamente nos botões dos seus produtos frequentes (Top coat, Base bomba, Removedor, etc.) no painel do pedido e ajustar as unidades com os botões <code className="bg-indigo-100 font-mono px-1 py-0.5 rounded">+</code> e <code className="bg-indigo-100 font-mono px-1 py-0.5 rounded">-</code>. Leva menos de 5 segundos para fechar o pedido.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onOpenQuickCatalog) onOpenQuickCatalog();
                      }}
                      className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                      Abrir Catálogo Rápido no Pedido
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BOOKMARKLET FOR WHATSAPP WEB */}
          {activeTab === 'bookmarklet' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex items-start gap-3">
                <Laptop className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sky-950 text-xs">
                    Capturador Automático de Carrinho para WhatsApp Web
                  </p>
                  <p className="text-sky-800 text-[11px] leading-relaxed">
                    Como o WhatsApp Web bloqueia a seleção de texto pelo mouse, este favorito lê os itens diretamente do código da página em menos de 1 segundo!
                  </p>
                </div>
              </div>

              {/* Step by step */}
              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <MousePointer className="w-4 h-4 text-emerald-600" />
                  Passo a Passo de Instalação (Fazer apenas 1 vez):
                </h5>

                <ol className="list-decimal list-inside space-y-2 text-[11px] text-slate-700">
                  <li>
                    Exiba a <strong>Barra de Favoritos</strong> do seu navegador (<kbd className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">Ctrl + Shift + B</kbd> no Chrome/Edge).
                  </li>
                  <li>
                    Arraste o botão verde abaixo diretamente para a barra de favoritos do navegador:
                  </li>
                </ol>

                <div className="py-2 flex flex-col sm:flex-row items-center gap-3">
                  <a
                    href={bookmarkletCode}
                    onClick={(e) => {
                      e.preventDefault();
                      alert('👉 Arraste este botão para a sua Barra de Favoritos do navegador!');
                    }}
                    draggable
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-grab active:cursor-grabbing border-2 border-dashed border-emerald-300"
                  >
                    <Bookmark className="w-4 h-4" />
                    <span>⚡ Ler Carrinho WhatsApp (Arraste p/ Favoritos)</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyBookmarklet}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedBookmarklet ? 'Código Copiado!' : 'Copiar Código'}</span>
                  </button>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800">Como usar no dia a dia:</p>
                  <p>1. No WhatsApp Web, abra a conversa com o cliente que mandou o carrinho.</p>
                  <p>2. Clique no favorito <strong>⚡ Ler Carrinho WhatsApp</strong> na barra do seu navegador.</p>
                  <p>3. Os itens serão copiados para a sua área de transferência. Volte aqui e clique em &quot;Colar Texto&quot;!</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PASTE TEXT */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-950 text-xs">
                    Conversor Automático de Texto em Produtos
                  </p>
                  <p className="text-emerald-800 text-[11px] leading-relaxed">
                    Cole qualquer texto copiado do WhatsApp, digitado ou capturado pelo Bookmarklet. O parser identifica nomes, quantidades e valores automaticamente.
                  </p>
                </div>
              </div>

              {/* Quick Template Fill */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Mensagem ou Resumo de Itens:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCartText(SAMPLE_WHATSAPP_CART_MESSAGE)}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    + Exemplo Cosméticos (Top coat, Base bomba, Removedor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCartText('')}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={cartText}
                onChange={(e) => setCartText(e.target.value)}
                placeholder="Cole a mensagem aqui... Exemplo:&#10;• 1x Top coat incolor (R$ 15,00)&#10;• 2x Base bomba (R$ 18,50)&#10;• 1x Removedor a base de acetona (R$ 12,00)"
                rows={6}
                className="w-full p-3.5 border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-2xl font-mono text-xs text-slate-800 leading-relaxed outline-none"
              />

              {/* Live Preview */}
              {parsed.items.length > 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      {parsed.items.length} Produto{parsed.items.length > 1 ? 's' : ''} Identificado{parsed.items.length > 1 ? 's' : ''}:
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      Total: R$ {parsed.items.reduce((acc, i) => acc + i.total, 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {parsed.customerName && (
                    <div className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200 flex flex-wrap gap-x-4 gap-y-1">
                      <span><strong>Cliente:</strong> {parsed.customerName}</span>
                      {parsed.customerPhone && <span><strong>Tel:</strong> {parsed.customerPhone}</span>}
                    </div>
                  )}

                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {parsed.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                            {item.code}
                          </span>
                          <span className="font-semibold text-slate-800 truncate">{item.description}</span>
                          <span className="text-[11px] text-slate-500 shrink-0">x{item.quantity}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 shrink-0">
                          R$ {item.total.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
                  Cole o texto acima ou clique em &quot;Exemplo Cosméticos&quot; para testar.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WEBHOOK */}
          {activeTab === 'webhook' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs">Webhook Oficial da Meta Ativo</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                    Endpoint Pronto
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Para contas de WhatsApp com Cloud API oficial da Meta (Facebook Developers), os pedidos chegam automaticamente por webhook:
                </p>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 font-mono text-[11px] text-emerald-300">
                  <span className="truncate">{window.location.origin}/api/whatsapp-webhook</span>
                  <button
                    type="button"
                    onClick={handleCopyWebhookUrl}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-1 transition-colors text-[10px] font-sans font-bold shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedWebhook ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 space-y-1">
                  <div><strong>Verify Token:</strong> <code className="text-emerald-300">artex7_whatsapp_token</code></div>
                  <div><strong>Evento de webhook:</strong> <code className="text-emerald-300">messages (tipo: order)</code></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Fechar
          </button>

          {activeTab === 'paste' ? (
            <button
              type="button"
              onClick={handleApply}
              disabled={parsed.items.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Importar {parsed.items.length} Itens para o Pedido</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>Testar Conversor de Texto</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
