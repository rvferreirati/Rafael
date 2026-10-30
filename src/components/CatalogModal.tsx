import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Edit2,
  Check,
  AlertTriangle,
  ArrowRight,
  Layers,
  Filter,
  RefreshCw,
  Download
} from 'lucide-react';
import {
  CatalogProduct,
  DEFAULT_CATALOG,
  parseCatalogText,
  saveStoredCatalog,
  pushServerCatalog,
  resetServerCatalog,
  syncCatalogWithServer,
  upsertCatalogProduct,
  mergeCatalogProducts
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
  const [feedback, setFeedback] = useState<string | null>(null);

  // Import Drawer and Preview state
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [previewItems, setPreviewItems] = useState<CatalogProduct[] | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    const result = await syncCatalogWithServer(catalog, 'merge');
    onUpdateCatalog(result.catalog);
    setIsSyncing(false);
    setFeedback(result.message);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handlePullFromCloud = async () => {
    setIsSyncing(true);
    const result = await syncCatalogWithServer(catalog, 'pull');
    onUpdateCatalog(result.catalog);
    setIsSyncing(false);
    setFeedback(`Baixado da nuvem! ${result.count} produtos carregados no computador.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  // Inline editing for existing items (using unique identifier)
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editItemCode, setEditItemCode] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');

  // New item form
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  if (!isOpen) return null;

  const getItemKey = (item: CatalogProduct, index: number) => {
    return item.id || `${item.code}_${item.name}_${index}`;
  };

  const filtered = catalog.filter(
    (p) =>
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if newCode already exists in catalog
  const isNoCode = !newCode.trim() || newCode.trim() === '-';
  const existingProductWithCode = (!isNoCode && newCode.trim())
    ? catalog.find(
        (p) => p.code.toLowerCase() !== '-' && p.code.toLowerCase() === newCode.trim().replace(/^#/, '').toLowerCase()
      )
    : null;

  // Add or update item from manual form
  const handleAddNewOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const priceNum = parseFloat(newPrice.replace(',', '.')) || 0;
    const rawCode = newCode.trim().replace(/^#/, '');
    const codeVal = rawCode === '' || rawCode === '-' ? '-' : rawCode;

    const newItem: CatalogProduct = {
      id: `cat-${codeVal === '-' ? Date.now() : codeVal}-${Math.random().toString(36).substr(2, 4)}`,
      code: codeVal,
      name: newName.trim(),
      price: priceNum,
    };

    const updated = upsertCatalogProduct(catalog, newItem);

    onUpdateCatalog(updated);
    await pushServerCatalog(updated);

    const wasUpdate = !!existingProductWithCode;
    setNewCode('');
    setNewName('');
    setNewPrice('');
    setFeedback(
      wasUpdate
        ? `Produto #${codeVal} atualizado (R$ ${priceNum.toFixed(2).replace('.', ',')}) e sincronizado com o celular!`
        : codeVal === '-'
        ? `Produto "${newName.trim()}" adicionado sem código (-) e sincronizado!`
        : `Produto #${codeVal} adicionado e sincronizado com o celular!`
    );
    setTimeout(() => setFeedback(null), 3500);
  };

  // Start inline editing of an item
  const handleStartEdit = (item: CatalogProduct, index: number) => {
    const key = getItemKey(item, index);
    setEditingKey(key);
    setEditItemCode(item.code);
    setEditItemName(item.name);
    setEditItemPrice(item.price.toFixed(2).replace('.', ','));
  };

  const handleSaveEdit = async (originalItem: CatalogProduct, originalIndex: number) => {
    const priceNum = parseFloat(editItemPrice.replace(',', '.')) || 0;
    const rawCode = editItemCode.trim().replace(/^#/, '');
    const cleanCode = rawCode === '' || rawCode === '-' ? '-' : rawCode;

    const originalKey = getItemKey(originalItem, originalIndex);
    const withoutOriginal = catalog.filter((p, i) => getItemKey(p, i) !== originalKey);

    const updatedItem: CatalogProduct = {
      id: originalItem.id || `cat-${Date.now()}`,
      code: cleanCode,
      name: editItemName.trim() || 'Item sem nome',
      price: priceNum,
    };

    const updated = upsertCatalogProduct(withoutOriginal, updatedItem);

    onUpdateCatalog(updated);
    await pushServerCatalog(updated);
    setEditingKey(null);
    setFeedback(
      cleanCode === '-'
        ? `Produto atualizado sem código (-) e sincronizado com o celular!`
        : `Produto #${cleanCode} atualizado e sincronizado com o celular!`
    );
    setTimeout(() => setFeedback(null), 3000);
  };

  // Delete an individual item safely without affecting others
  const handleRemove = async (item: CatalogProduct, index: number) => {
    const targetKey = getItemKey(item, index);
    const updated = catalog.filter((p, i) => getItemKey(p, i) !== targetKey);
    onUpdateCatalog(updated);
    await pushServerCatalog(updated);
    setFeedback(`Produto "${item.name}" excluído do banco de dados e sincronizado!`);
    setTimeout(() => setFeedback(null), 2500);
  };

  // Delete ALL items completely
  const handleClearAll = async () => {
    if (confirm(`Atenção: Deseja realmente apagar TODOS os ${catalog.length} produtos do Banco de Dados?`)) {
      onUpdateCatalog([]);
      await pushServerCatalog([]);
      setFeedback('Todos os produtos foram apagados do banco de dados!');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Reset to the default catalog
  const handleResetDefault = async () => {
    if (confirm('Restaurar o banco de dados oficial (16 produtos padrão)?')) {
      const restored = await resetServerCatalog();
      onUpdateCatalog(restored);
      setFeedback('Banco de dados restaurado com os 16 produtos padrão e sincronizado!');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // --- Step 1: Parse and show PRE-LISTA (Preview) ---
  const handleAnalyzeAndPreview = () => {
    if (!importText.trim()) return;
    const parsed = parseCatalogText(importText);
    if (parsed.length === 0) {
      alert('Nenhum produto reconhecido no texto. Cole em formato de tabela, ou linhas como: "47 Bloco Polidor 3,00" ou "Código - Descrição - Preço".');
      return;
    }
    setPreviewItems(parsed);
  };

  // Modify item within the pre-lista
  const handlePreviewItemChange = (index: number, field: keyof CatalogProduct, value: string) => {
    if (!previewItems) return;
    const next = [...previewItems];
    if (field === 'price') {
      const priceNum = parseFloat(value.replace(',', '.')) || 0;
      next[index] = { ...next[index], price: priceNum };
    } else if (field === 'code') {
      next[index] = { ...next[index], code: value.replace(/^#/, '').trim() };
    } else {
      next[index] = { ...next[index], name: value };
    }
    setPreviewItems(next);
  };

  const handleRemovePreviewItem = (index: number) => {
    if (!previewItems) return;
    const next = previewItems.filter((_, i) => i !== index);
    setPreviewItems(next);
  };

  const handleAddPreviewItem = () => {
    if (!previewItems) return;
    setPreviewItems([
      ...previewItems,
      {
        code: `${catalog.length + previewItems.length + 1}`,
        name: 'Novo Item na Pré-lista',
        price: 0,
      },
    ]);
  };

  // --- Step 2: Confirm and Save Pre-Lista to Database ---
  const handleSavePreListToDatabase = () => {
    if (!previewItems || previewItems.length === 0) return;

    let finalCatalog: CatalogProduct[];
    if (importMode === 'replace') {
      finalCatalog = previewItems;
    } else {
      // Merge mode: preserves other items in catalog, updates matched codes, adds new
      finalCatalog = mergeCatalogProducts(catalog, previewItems);
    }

    onUpdateCatalog(finalCatalog);
    pushServerCatalog(finalCatalog);

    const count = previewItems.length;
    setIsImporting(false);
    setPreviewItems(null);
    setImportText('');
    setFeedback(`Importação concluída! ${count} produtos salvos e sincronizados com o celular.`);
    setTimeout(() => setFeedback(null), 3500);
    setFeedback(
      importMode === 'replace'
        ? `Banco de dados substituído por ${count} itens da pré-lista!`
        : `${count} itens mesclados e atualizados no banco de dados com sucesso!`
    );
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
        // Automatically parse and show preview
        const parsed = parseCatalogText(content);
        if (parsed.length > 0) {
          setPreviewItems(parsed);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
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
                Usado pelo OCR e IA para conciliar nomes cortados ("..."), códigos oficiais e preços corretos
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
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-sm animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{feedback}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por código (#47, #10) ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-3.5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                title="Sincronizar e mesclar produtos entre todos os dispositivos (PC e Celular)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar com Todos'}</span>
              </button>

              <button
                type="button"
                onClick={handlePullFromCloud}
                disabled={isSyncing}
                className="px-3 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                title="Substituir os produtos deste computador pela lista mais recente salva na nuvem/celular"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Baixar da Nuvem</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsImporting(!isImporting);
                  if (isImporting) setPreviewItems(null);
                }}
                className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  isImporting
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                {isImporting ? 'Fechar Importador' : 'Importar / Colar Lista'}
              </button>

              <button
                type="button"
                onClick={handleResetDefault}
                className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                title="Restaura os 16 produtos oficiais da lista enviada"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar 16 Itens
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-2 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200"
                title="Apaga todos os produtos do banco de dados de uma vez só"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Banco
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* IMPORT DRAWER & INTERACTIVE PRE-LISTA                    */}
          {/* ======================================================== */}
          {isImporting && (
            <div className="p-4 sm:p-5 bg-gradient-to-b from-indigo-50/70 to-white border-2 border-indigo-200 rounded-2xl space-y-4 shadow-sm animate-in fade-in">
              {!previewItems ? (
                // Step A: Paste text / Upload file
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        Cole sua tabela ou arquivo de produtos para gerar a Pré-Lista:
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Você verá uma <strong>pré-lista editável</strong> antes de salvar, permitindo alterar valores e quantidades.
                      </p>
                    </div>

                    <label className="text-xs text-indigo-700 font-semibold hover:underline cursor-pointer flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      Arquivo .txt / .csv
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
                    placeholder="Cole aqui (do Excel, WhatsApp ou bloco de notas), ex:&#10;47	Bloco Polidor	R$ 3,00&#10;46	Lixa mini canário pura arte com...	R$ 7,70&#10;10	Lixa moeda preta podóloga grão...	R$ 6,93"
                    className="w-full text-xs font-mono p-3 bg-white border border-indigo-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      💡 Formatos aceitos: Tabulação, "Código - Nome - Preço", ou "47 Nome 3,00"
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsImporting(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAnalyzeAndPreview}
                        disabled={!importText.trim()}
                        className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <span>Gerar Pré-Lista Editável</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Step B: INTERACTIVE PRE-LISTA (Alterar valor e salvar)
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-100 gap-2">
                    <div>
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        <Sparkles className="w-3 h-3" />
                        Pré-Lista Gerada ({previewItems.length} itens detectados)
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        Confira e altere os códigos, nomes ou valores antes de salvar no banco:
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddPreviewItem}
                        className="px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar Linha
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewItems(null)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Voltar ao Texto
                      </button>
                    </div>
                  </div>

                  {/* Pre-list items table */}
                  <div className="border border-indigo-200 rounded-xl overflow-hidden bg-white max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-indigo-50/80 sticky top-0 text-indigo-950 font-bold border-b border-indigo-200">
                        <tr>
                          <th className="py-2 px-3 w-20">CÓDIGO</th>
                          <th className="py-2 px-3">DESCRIÇÃO DO PRODUTO</th>
                          <th className="py-2 px-3 w-32 text-right">VALOR / PREÇO</th>
                          <th className="py-2 px-3 w-40 text-center">STATUS NO BANCO</th>
                          <th className="py-2 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewItems.map((item, index) => {
                          const itemCode = item.code.trim();
                          const isItemNoCode = !itemCode || itemCode === '-';
                          const existing = !isItemNoCode
                            ? catalog.find(
                                (c) => c.code.toLowerCase() !== '-' && c.code.toLowerCase() === itemCode.toLowerCase()
                              )
                            : catalog.find(
                                (c) => c.name.toLowerCase().trim() === item.name.toLowerCase().trim()
                              );
                          return (
                            <tr key={index} className="hover:bg-indigo-50/30 transition-colors">
                              {/* Code input */}
                              <td className="py-1.5 px-3">
                                <input
                                  type="text"
                                  value={item.code}
                                  placeholder="-"
                                  onChange={(e) =>
                                    handlePreviewItemChange(index, 'code', e.target.value)
                                  }
                                  className="w-full text-xs font-mono font-bold text-indigo-700 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                              </td>

                              {/* Name input */}
                              <td className="py-1.5 px-3">
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) =>
                                    handlePreviewItemChange(index, 'name', e.target.value)
                                  }
                                  className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                              </td>

                              {/* Price input */}
                              <td className="py-1.5 px-3 text-right">
                                <div className="relative inline-flex items-center">
                                  <span className="text-[10px] text-slate-400 mr-1 font-mono">
                                    R$
                                  </span>
                                  <input
                                    type="text"
                                    value={item.price.toFixed(2).replace('.', ',')}
                                    onChange={(e) =>
                                      handlePreviewItemChange(index, 'price', e.target.value)
                                    }
                                    className="w-20 text-right text-xs font-mono font-bold text-emerald-700 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                  />
                                </div>
                              </td>

                              {/* Status badge */}
                              <td className="py-1.5 px-3 text-center">
                                {existing ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                                    title={`Preço atual no banco: R$ ${existing.price.toFixed(2)}`}
                                  >
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    Atualizará (R$ {existing.price.toFixed(2).replace('.', ',')})
                                  </span>
                                ) : isItemNoCode ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    Sem código (-)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    Novo Item
                                  </span>
                                )}
                              </td>

                              {/* Remove row */}
                              <td className="py-1.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePreviewItem(index)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                                  title="Remover este item da pré-lista"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Import Mode Selection & Confirm Button */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="font-bold text-slate-700">Como salvar:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="text-indigo-600"
                        />
                        <span className="font-semibold text-slate-700">
                          Mesclar e Atualizar (Mantém existentes e atualiza valores)
                        </span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="text-indigo-600"
                        />
                        <span className="text-slate-600">Substituir Todo o Banco</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewItems(null);
                          setIsImporting(false);
                        }}
                        className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={handleSavePreListToDatabase}
                        className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>Salvar {previewItems.length} Itens no Banco de Dados</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* MAIN CATALOG TABLE (WITH INLINE EDITING)                 */}
          {/* ======================================================== */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 sticky top-0 border-b border-slate-200 text-slate-700 font-bold z-10">
                  <tr>
                    <th className="py-3 px-4 w-24">CÓDIGO</th>
                    <th className="py-3 px-4">DESCRIÇÃO DO PRODUTO</th>
                    <th className="py-3 px-4 w-36 text-right">PREÇO TABELA</th>
                    <th className="py-3 px-3 w-28 text-center">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Nenhum produto cadastrado no banco de dados. Adicione novos produtos abaixo ou clique em "Restaurar 16 Itens".
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, index) => {
                      const itemKey = getItemKey(item, index);
                      const isEditingThis = editingKey === itemKey;
                      return (
                        <tr
                          key={itemKey}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isEditingThis ? 'bg-amber-50/60' : ''
                          }`}
                        >
                          {/* Code */}
                          <td className="py-2.5 px-4 font-bold text-amber-700">
                            {isEditingThis ? (
                              <input
                                type="text"
                                value={editItemCode}
                                placeholder="-"
                                onChange={(e) => setEditItemCode(e.target.value)}
                                className="w-16 font-mono font-bold text-xs px-2 py-1 bg-white border border-amber-300 rounded-md outline-none"
                              />
                            ) : item.code === '-' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-mono text-xs font-bold" title="Item sem código">
                                -
                              </span>
                            ) : (
                              <span>#{item.code}</span>
                            )}
                          </td>

                          {/* Name */}
                          <td className="py-2.5 px-4 font-medium text-slate-800">
                            {isEditingThis ? (
                              <input
                                type="text"
                                value={editItemName}
                                onChange={(e) => setEditItemName(e.target.value)}
                                className="w-full text-xs font-semibold px-2 py-1 bg-white border border-amber-300 rounded-md outline-none"
                              />
                            ) : (
                              <div>
                                <span className="font-semibold text-slate-900">{item.name}</span>
                              </div>
                            )}
                          </td>

                          {/* Price */}
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700 font-mono">
                            {isEditingThis ? (
                              <div className="inline-flex items-center justify-end">
                                <span className="text-[10px] text-slate-400 mr-1">R$</span>
                                <input
                                  type="text"
                                  value={editItemPrice}
                                  onChange={(e) => setEditItemPrice(e.target.value)}
                                  className="w-20 text-right font-mono font-bold text-xs px-1.5 py-1 bg-white border border-amber-300 rounded-md outline-none"
                                />
                              </div>
                            ) : (
                              <span>R$ {item.price.toFixed(2).replace('.', ',')}</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {isEditingThis ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(item, index)}
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                                  title="Salvar alterações"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingKey(null)}
                                  className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                  title="Cancelar edição"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(item, index)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Editar valor ou descrição"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemove(item, index)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Remover produto individualmente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ======================================================== */}
          {/* ADD / UPDATE SINGLE ITEM FORM                            */}
          {/* ======================================================== */}
          <div className="space-y-2">
            <form
              onSubmit={handleAddNewOrUpdate}
              className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-center"
            >
              <div className="flex items-center gap-1 shrink-0">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-700">Inserir/Atualizar Item:</span>
              </div>
              <input
                type="text"
                placeholder="Cód (ex: 47 ou -)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full sm:w-28 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
              />
              <input
                type="text"
                placeholder="Nome do produto..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Preço (ex: 3,00)"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full sm:w-28 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{existingProductWithCode ? 'Atualizar Item' : 'Salvar Item'}</span>
              </button>
            </form>

            {/* Inform user if code already exists and will update */}
            {existingProductWithCode && (
              <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  O código <strong>#{existingProductWithCode.code}</strong> já existe ({existingProductWithCode.name} - R$ {existingProductWithCode.price.toFixed(2)}). Ao salvar, o valor e nome serão <strong>atualizados</strong>.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span className="font-medium">
            {catalog.length} produtos sincronizados localmente no banco de dados
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Concluir & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
