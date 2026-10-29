import React, { useState } from 'react';
import {
  X,
  Database,
  Plus,
  Trash2,
  Upload,
  RotateCcw,
  CheckCircle2,
  FileText,
  Save,
  Search,
  Sparkles
} from 'lucide-react';
import {
  CatalogProduct,
  DEFAULT_CATALOG,
  parseCatalogText,
  saveStoredCatalog
} from '../utils/productCatalog';

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogProduct[];
  onUpdateCatalog: (newCatalog: CatalogProduct[]) => void;
}

export const CatalogModal: React.FC<CatalogModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onUpdateCatalog,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // New item form
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  if (!isOpen) return null;

  const filtered = catalog.filter(
    (p) =>
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const priceNum = parseFloat(newPrice.replace(',', '.')) || 0;
    const codeVal = newCode.trim() || `${catalog.length + 1}`;

    const updated = [
      ...catalog,
      { code: codeVal, name: newName.trim(), price: priceNum },
    ];
    onUpdateCatalog(updated);
    saveStoredCatalog(updated);

    setNewCode('');
    setNewName('');
    setNewPrice('');
    setFeedback(`Produto #${codeVal} adicionado com sucesso!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleRemove = (code: string) => {
    const updated = catalog.filter((p) => p.code !== code);
    onUpdateCatalog(updated);
    saveStoredCatalog(updated);
  };

  const handleResetDefault = () => {
    if (confirm('Restaurar o banco de dados original (12 produtos da sua lista)?')) {
      onUpdateCatalog(DEFAULT_CATALOG);
      saveStoredCatalog(DEFAULT_CATALOG);
      setFeedback('Banco de dados restaurado com os 12 produtos padrão!');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleProcessImport = () => {
    if (!importText.trim()) return;
    const parsed = parseCatalogText(importText);
    if (parsed.length === 0) {
      alert('Nenhum produto reconhecido no texto. Cole em formato de tabela, separado por tabulação ou "Código - Nome - Preço".');
      return;
    }

    onUpdateCatalog(parsed);
    saveStoredCatalog(parsed);
    setIsImporting(false);
    setImportText('');
    setFeedback(`${parsed.length} produtos importados e salvos com sucesso!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setImportText(content);
        setIsImporting(true);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Banco de Dados de Produtos</h3>
                <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-400/30">
                  {catalog.length} cadastrados
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Usado pelo OCR e IA para corrigir títulos cortados ("..."), códigos e preços de tabela
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

        {/* Feedback Alert */}
        {feedback && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{feedback}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsImporting(!isImporting)}
                className="px-3 py-2 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {isImporting ? 'Fechar Importador' : 'Importar / Colar Lista'}
              </button>

              <button
                type="button"
                onClick={handleResetDefault}
                className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Restaura os 12 produtos oficiais da lista enviada"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar 12 Itens
              </button>
            </div>
          </div>

          {/* Import / Paste Drawer */}
          {isImporting && (
            <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Cole sua tabela ou arquivo TXT/CSV de produtos:
                </span>
                <label className="text-xs text-indigo-700 font-semibold hover:underline cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  Carregar arquivo .txt
                  <input
                    type="file"
                    accept=".txt,.csv,.tsv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              <textarea
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Exemplo copiado do Excel ou arquivo:&#10;47	Bloco Polidor	R$ 3,00&#10;46	Lixa mini canário pura arte com...	R$ 7,70&#10;10	Lixa moeda preta podóloga grão...	R$ 6,93"
                className="w-full text-xs font-mono p-3 bg-white border border-indigo-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImporting(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleProcessImport}
                  className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
                >
                  Confirmar e Salvar Catálogo
                </button>
              </div>
            </div>
          )}

          {/* Table of Products */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-20">CÓDIGO</th>
                    <th className="py-2.5 px-3">DESCRIÇÃO DO PRODUTO</th>
                    <th className="py-2.5 px-3 w-28 text-right">PREÇO TABELA</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Nenhum produto encontrado na pesquisa.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.code} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-bold text-amber-700">
                          #{item.code}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">
                          {item.name}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          R$ {item.price.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemove(item.code)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                            title="Remover produto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Manual Item Form */}
          <form onSubmit={handleAddNew} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-2 items-center">
            <span className="text-xs font-bold text-slate-700 shrink-0">Novo Item:</span>
            <input
              type="text"
              placeholder="Cód (ex: 99)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="w-full sm:w-20 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Nome do produto..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Preço (ex: 15,00)"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-full sm:w-28 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </form>

          {/* Educational Note */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Como o Banco de Dados resolve o problema do WhatsApp:</span>
              <p className="text-slate-600 leading-relaxed">
                Nos prints de celular, o WhatsApp costuma cortar o texto com reticências (ex: <i>"Lixa mini canário pur..."</i> ou <i>"Lixa moeda preta po..."</i>).
                Com o banco de dados carregado, a IA e o OCR fazem a <b>conciliação automática</b>: preenchem o código oficial (ex: <b>#46</b> e <b>#10</b>), o nome completo e o preço de tabela, garantindo <b>100% de exatidão</b>.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>{catalog.length} produtos sincronizados localmente</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Concluir & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
