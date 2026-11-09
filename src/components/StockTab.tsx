import React, { useState, useMemo, useRef } from 'react';
import {
  Boxes,
  Plus,
  Minus,
  Search,
  FileSpreadsheet,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ArrowUpDown,
  History,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Filter,
  Check,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { StockItem, StockMovement, CompanyProfile } from '../types';
import {
  exportStockToExcel,
  importStockFromExcel,
  saveStoredStock,
  pushServerStock,
  fetchServerStock,
  loadStoredStockMovements,
  saveStoredStockMovements,
} from '../utils/stockManager';
import {
  pushAllStockToFirestore,
  saveStockItemToFirestore,
  deleteStockItemFromFirestore,
  deleteBatchStockFromFirestore,
  clearAllStockFromFirestore,
  replaceStockInFirestore,
} from '../services/firestoreSync';
import { Cloud, CheckCircle, Wifi } from 'lucide-react';

interface StockTabProps {
  stockList: StockItem[];
  onUpdateStock: (newStock: StockItem[]) => void;
  company: CompanyProfile;
}

export const StockTab: React.FC<StockTabProps> = ({
  stockList,
  onUpdateStock,
  company,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out' | 'normal'>('all');
  
  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [importedExcelItems, setImportedExcelItems] = useState<StockItem[]>([]);
  
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustType, setAdjustType] = useState<'entry' | 'exit'>('entry');
  const [adjustReason, setAdjustReason] = useState<string>('Entrada de mercadoria');

  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states for Add/Edit
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formStock, setFormStock] = useState<number>(50);
  const [formMinStock, setFormMinStock] = useState<number>(15);
  const [formCost, setFormCost] = useState<number>(0);
  const [formWholesale, setFormWholesale] = useState<number>(0);
  const [formRetail, setFormRetail] = useState<number>(0);
  const [formCategory, setFormCategory] = useState('Geral');
  const [formUnit, setFormUnit] = useState('un');

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    stockList.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }, [stockList]);

  // Filtered stock list
  const filteredStock = useMemo(() => {
    return stockList.filter((item) => {
      const matchSearch =
        searchTerm === '' ||
        (item.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;

      let matchStatus = true;
      const min = item.minStock || 15;
      if (stockStatusFilter === 'out') {
        matchStatus = item.currentStock <= 0;
      } else if (stockStatusFilter === 'low') {
        matchStatus = item.currentStock > 0 && item.currentStock <= min;
      } else if (stockStatusFilter === 'normal') {
        matchStatus = item.currentStock > min;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [stockList, searchTerm, selectedCategory, stockStatusFilter]);

  // Overall statistics
  const stats = useMemo(() => {
    let totalUnits = 0;
    let totalCostVal = 0;
    let totalWholesaleVal = 0;
    let totalRetailVal = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    stockList.forEach((it) => {
      const qty = it.currentStock || 0;
      totalUnits += qty;
      totalCostVal += qty * (it.costPrice || 0);
      totalWholesaleVal += qty * (it.wholesalePrice || 0);
      totalRetailVal += qty * (it.retailPrice || 0);

      const min = it.minStock || 15;
      if (qty <= 0) outOfStockCount++;
      else if (qty <= min) lowStockCount++;
    });

    return {
      totalItems: stockList.length,
      totalUnits,
      totalCostVal,
      totalWholesaleVal,
      totalRetailVal,
      lowStockCount,
      outOfStockCount,
    };
  }, [stockList]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormCode('');
    setFormName('');
    setFormStock(50);
    setFormMinStock(15);
    setFormCost(0);
    setFormWholesale(0);
    setFormRetail(0);
    setFormCategory('Geral');
    setFormUnit('un');
    setIsAddEditModalOpen(true);
  };

  const handleOpenEdit = (item: StockItem) => {
    setEditingItem(item);
    setFormCode(item.code || '');
    setFormName(item.name);
    setFormStock(item.currentStock);
    setFormMinStock(item.minStock || 15);
    setFormCost(item.costPrice);
    setFormWholesale(item.wholesalePrice);
    setFormRetail(item.retailPrice);
    setFormCategory(item.category || 'Geral');
    setFormUnit(item.unit || 'un');
    setIsAddEditModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showFeedback('Informe a descrição do produto.', 'error');
      return;
    }

    if (editingItem) {
      // Update existing item
      const updated = stockList.map((it) => {
        if (it.id === editingItem.id) {
          return {
            ...it,
            code: formCode.trim(),
            name: formName.trim(),
            currentStock: Math.max(0, Number(formStock) || 0),
            minStock: Math.max(0, Number(formMinStock) || 0),
            costPrice: Math.max(0, Number(formCost) || 0),
            wholesalePrice: Math.max(0, Number(formWholesale) || 0),
            retailPrice: Math.max(0, Number(formRetail) || 0),
            category: formCategory.trim() || 'Geral',
            unit: formUnit.trim() || 'un',
            updatedAt: Date.now(),
          };
        }
        return it;
      });

      const targetItem = updated.find((it) => it.id === editingItem.id);
      onUpdateStock(updated);
      saveStoredStock(updated);
      pushServerStock(updated);
      if (targetItem) saveStockItemToFirestore(targetItem);
      showFeedback(`✓ Produto "${formName}" atualizado com sucesso!`);
    } else {
      // Add new item
      const newItem: StockItem = {
        id: `stock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        code: formCode.trim(),
        name: formName.trim(),
        currentStock: Math.max(0, Number(formStock) || 0),
        minStock: Math.max(0, Number(formMinStock) || 0),
        costPrice: Math.max(0, Number(formCost) || 0),
        wholesalePrice: Math.max(0, Number(formWholesale) || 0),
        retailPrice: Math.max(0, Number(formRetail) || 0),
        category: formCategory.trim() || 'Geral',
        unit: formUnit.trim() || 'un',
        updatedAt: Date.now(),
      };

      const updated = [newItem, ...stockList];
      onUpdateStock(updated);
      saveStoredStock(updated);
      pushServerStock(updated);
      saveStockItemToFirestore(newItem);
      showFeedback(`✓ Novo produto "${formName}" adicionado ao estoque!`);
    }

    setIsAddEditModalOpen(false);
  };

  const handleDeleteItem = (item: StockItem) => {
    setItemToDelete(item);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete.id;
    const name = itemToDelete.name;
    const updated = stockList.filter((it) => it.id !== id);
    onUpdateStock(updated);
    saveStoredStock(updated);
    setSelectedStockIds((prev) => prev.filter((i) => i !== id));
    setItemToDelete(null);

    if (updated.length === 0) {
      await clearAllStockFromFirestore();
      await pushServerStock([]);
    } else {
      await deleteStockItemFromFirestore(id);
      await pushServerStock(updated);
    }
    showFeedback(`✓ Produto "${name}" removido permanentemente.`);
  };

  const handleToggleSelectStock = (id: string) => {
    setSelectedStockIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllStock = () => {
    if (selectedStockIds.length === filteredStock.length) {
      setSelectedStockIds([]);
    } else {
      setSelectedStockIds(filteredStock.map((it) => it.id));
    }
  };

  const confirmBulkDeleteStock = async () => {
    if (selectedStockIds.length === 0) return;
    const count = selectedStockIds.length;
    const toDeleteIds = [...selectedStockIds];
    const updated = stockList.filter((it) => !selectedStockIds.includes(it.id));
    onUpdateStock(updated);
    saveStoredStock(updated);
    setSelectedStockIds([]);
    setIsBulkDeleteModalOpen(false);

    if (updated.length === 0) {
      await clearAllStockFromFirestore();
      await pushServerStock([]);
    } else {
      await deleteBatchStockFromFirestore(toDeleteIds);
      await pushServerStock(updated);
    }
    showFeedback(`✓ ${count} produto(s) excluído(s) permanentemente do estoque.`);
  };

  // Excluir TODOS os itens do estoque de uma vez só
  const handleConfirmClearAllStock = async () => {
    const count = stockList.length;
    setIsClearAllModalOpen(false);
    onUpdateStock([]);
    saveStoredStock([]);
    setSelectedStockIds([]);
    await clearAllStockFromFirestore();
    await pushServerStock([]);
    showFeedback(`✓ Todos os ${count} produtos foram excluídos permanentemente do estoque e da nuvem!`);
  };

  // Stock Adjustment (+ Entrada / - Saída)
  const handleOpenAdjust = (item: StockItem) => {
    setAdjustingItem(item);
    setAdjustQty(10);
    setAdjustType('entry');
    setAdjustReason('Entrada de mercadoria / reposição');
    setIsAdjustModalOpen(true);
  };

  const handleConfirmAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    const qty = Math.max(1, Number(adjustQty) || 1);
    const prev = adjustingItem.currentStock;
    const next = adjustType === 'entry' ? prev + qty : Math.max(0, prev - qty);

    let changedItem: StockItem | null = null;
    const updated = stockList.map((it) => {
      if (it.id === adjustingItem.id) {
        changedItem = {
          ...it,
          currentStock: next,
          updatedAt: Date.now(),
        };
        return changedItem;
      }
      return it;
    });

    // Record movement
    const mov: StockMovement = {
      id: `mov-${Date.now()}`,
      stockItemId: adjustingItem.id,
      itemCode: adjustingItem.code,
      itemName: adjustingItem.name,
      type: adjustType === 'entry' ? 'purchase_entry' : 'manual_adjustment',
      quantity: adjustType === 'entry' ? qty : -qty,
      previousStock: prev,
      newStock: next,
      reason: adjustReason.trim() || (adjustType === 'entry' ? 'Entrada manual' : 'Saída manual'),
      timestamp: Date.now(),
    };

    const movs = loadStoredStockMovements();
    saveStoredStockMovements([mov, ...movs]);

    onUpdateStock(updated);
    saveStoredStock(updated);
    pushServerStock(updated);
    if (changedItem) saveStockItemToFirestore(changedItem);

    showFeedback(
      `✓ Saldo ajustado: ${adjustingItem.name} (${prev} → ${next} un)`
    );
    setIsAdjustModalOpen(false);
  };

  // Quick 1-tap stock stepper for mobile
  const handleQuickStepStock = (item: StockItem, delta: number) => {
    const prev = item.currentStock;
    const next = Math.max(0, prev + delta);
    if (prev === next) return;

    let changedItem: StockItem | null = null;
    const updated = stockList.map((it) => {
      if (it.id === item.id) {
        changedItem = { ...it, currentStock: next, updatedAt: Date.now() };
        return changedItem;
      }
      return it;
    });

    onUpdateStock(updated);
    saveStoredStock(updated);
    pushServerStock(updated);
    if (changedItem) saveStockItemToFirestore(changedItem);
  };

  // Excel file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const res = await importStockFromExcel(file);
      if (res.success && res.items.length > 0) {
        if (stockList.length > 0) {
          // If items exist (like demo items), prompt user whether to replace or merge
          setImportedExcelItems(res.items);
          setIsExcelImportModalOpen(true);
        } else {
          // Stock was already empty, save directly
          await handleApplyExcelItems(res.items, 'replace');
        }
      } else {
        showFeedback(res.message || 'Falha ao importar planilha.', 'error');
      }
    } catch (err: any) {
      showFeedback(`Erro ao importar: ${err?.message || 'Arquivo inválido'}`, 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyExcelItems = async (items: StockItem[], mode: 'replace' | 'merge') => {
    setIsExcelImportModalOpen(false);
    setIsImporting(true);

    try {
      let finalStock: StockItem[] = [];

      if (mode === 'replace') {
        finalStock = items;
        onUpdateStock(finalStock);
        saveStoredStock(finalStock);
        await replaceStockInFirestore(finalStock);
        await pushServerStock(finalStock);
        showFeedback(`✓ ${items.length} produtos importados! O estoque anterior foi substituído com sucesso.`);
      } else {
        // Merge
        const merged = [...stockList];
        items.forEach((imp) => {
          const idx = merged.findIndex((ex) => {
            const exCode = (ex.code || '').replace(/^#/, '').toLowerCase().trim();
            const impCode = (imp.code || '').replace(/^#/, '').toLowerCase().trim();
            if (exCode && impCode) {
              if (exCode === impCode) return true;
              if (exCode.endsWith(impCode) || impCode.endsWith(exCode)) return true;
            }
            const exName = ex.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const impName = imp.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            return exName === impName || (exName.length > 5 && impName.includes(exName)) || (impName.length > 5 && exName.includes(impName));
          });

          if (idx >= 0) {
            merged[idx] = {
              ...merged[idx],
              currentStock: imp.currentStock,
              costPrice: imp.costPrice || merged[idx].costPrice,
              wholesalePrice: imp.wholesalePrice || merged[idx].wholesalePrice,
              retailPrice: imp.retailPrice || merged[idx].retailPrice,
              category: imp.category || merged[idx].category,
              updatedAt: Date.now(),
            };
          } else {
            merged.push(imp);
          }
        });

        finalStock = merged;
        onUpdateStock(finalStock);
        saveStoredStock(finalStock);
        await pushAllStockToFirestore(finalStock);
        await pushServerStock(finalStock);
        showFeedback(`✓ ${items.length} produtos mesclados com sucesso!`);
      }
    } catch (err: any) {
      showFeedback(`Erro ao salvar itens importados: ${err?.message || 'Falha'}`, 'error');
    } finally {
      setIsImporting(false);
      setImportedExcelItems([]);
    }
  };

  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSyncStock = async () => {
    setIsManualSyncing(true);
    try {
      await pushAllStockToFirestore(stockList);
      await pushServerStock(stockList);
      showFeedback(`✓ Estoque (${stockList.length} itens) sincronizado com a nuvem Firestore com sucesso!`);
    } catch (e: any) {
      showFeedback(`Erro ao sincronizar estoque: ${e?.message || 'Falha de rede'}`, 'error');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleOpenMovements = () => {
    const movs = loadStoredStockMovements();
    setMovements(movs);
    setIsMovementsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all animate-in fade-in slide-in-from-bottom-2 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-800 text-white border border-emerald-600'
              : 'bg-rose-800 text-white border border-rose-600'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-300" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Hidden File Input for Excel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Produtos</span>
            <Boxes className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalItems}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            <strong>{stats.totalUnits}</strong> unidades em estoque
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Valor Custo</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            R$ {stats.totalCostVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5 font-medium">Investimento estocado</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Valor Atacado</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 font-mono">
            R$ {stats.totalWholesaleVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-blue-700 mt-0.5 font-medium">Preço tabela atacado</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Valor Varejo</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 font-mono">
            R$ {stats.totalRetailVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">Faturamento potencial</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Alertas</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-lg font-black text-amber-600">{stats.lowStockCount}</span>
              <span className="text-[10px] text-slate-500 block">Estoque baixo</span>
            </div>
            <div className="w-px h-7 bg-slate-200" />
            <div>
              <span className="text-lg font-black text-rose-600">{stats.outOfStockCount}</span>
              <span className="text-[10px] text-slate-500 block">Esgotados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Sync Status Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-xs sm:text-sm font-black text-slate-800">
                Sincronização em Nuvem Ativa (Firebase Firestore)
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Tempo Real
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Ao importar planilhas ou alterar o estoque no computador, seu celular e a hospedagem Vercel recebem os {stockList.length} itens instantaneamente.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualSyncStock}
          disabled={isManualSyncing}
          className="self-start sm:self-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-75"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
          <span>{isManualSyncing ? 'Enviando...' : 'Forçar Envio Celular'}</span>
        </button>
      </div>

      {/* Control Bar: Search, Category, Actions */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (ex: 47, 10) ou descrição do produto (ex: lixa, bloco)..."
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Produto</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="Importar produtos e saldo de planilha Excel (.xlsx, .csv)"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>{isImporting ? 'Importando...' : 'Importar Excel'}</span>
            </button>

            <button
              type="button"
              onClick={() => exportStockToExcel(stockList)}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="Baixar planilha de estoque completa (.xlsx)"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={handleOpenMovements}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="Ver histórico de baixas e estornos"
            >
              <History className="w-4 h-4 text-purple-600" />
              <span>Movimentações</span>
            </button>

            <button
              type="button"
              onClick={handleManualSyncStock}
              disabled={isManualSyncing}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="Sincronizar estoque com o Firebase Firestore (Celular & PC)"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${isManualSyncing ? 'animate-spin' : ''}`} />
              <span>{isManualSyncing ? 'Sincronizando...' : 'Nuvem Firestore'}</span>
            </button>

            {stockList.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(true)}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="Excluir todos os produtos do estoque e da nuvem de uma só vez"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Limpar Todo Estoque ({stockList.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-bold mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Categoria:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas ({stockList.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStockStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                stockStatusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStockStatusFilter('low')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                stockStatusFilter === 'low'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              Estoque Baixo ({stats.lowStockCount})
            </button>
            <button
              type="button"
              onClick={() => setStockStatusFilter('out')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                stockStatusFilter === 'out'
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-800 bg-rose-50 hover:bg-rose-100'
              }`}
            >
              Esgotados ({stats.outOfStockCount})
            </button>
          </div>
        </div>
      </div>

      {/* Multi-selection Toolbar for Stock */}
      {selectedStockIds.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="text-xs font-bold text-rose-950">
              {selectedStockIds.length} produto(s) selecionado(s) no estoque
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setSelectedStockIds([])}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              Desmarcar Todos
            </button>
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir {selectedStockIds.length} Selecionado(s)</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Selection Header */}
      <div className="md:hidden flex items-center justify-between px-1 py-1 text-xs">
        <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filteredStock.length > 0 && selectedStockIds.length === filteredStock.length}
            onChange={handleToggleSelectAllStock}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
          />
          <span>Selecionar todos ({filteredStock.length})</span>
        </label>
        <span className="text-[11px] text-slate-500 font-medium">
          {filteredStock.length} produto{filteredStock.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Mobile Card List (< 768px) */}
      <div className="md:hidden space-y-3">
        {filteredStock.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-bold text-sm">Nenhum produto encontrado</p>
            <p className="text-xs text-slate-500 mt-1">
              Ajuste os filtros de pesquisa ou clique em "+ Novo Produto".
            </p>
          </div>
        ) : (
          filteredStock.map((item) => {
            const min = item.minStock || 15;
            const isOut = item.currentStock <= 0;
            const isLow = !isOut && item.currentStock <= min;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all p-3.5 space-y-3 shadow-2xs ${
                  selectedStockIds.includes(item.id)
                    ? 'border-rose-300 bg-rose-50/30 ring-2 ring-rose-200'
                    : 'border-slate-200'
                }`}
              >
                {/* Header: Checkbox, Code, Category, Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedStockIds.includes(item.id)}
                      onChange={() => handleToggleSelectStock(item.id)}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 cursor-pointer shrink-0"
                    />
                    {item.code ? (
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                        {item.code}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono text-xs">Sem cód.</span>
                    )}
                    {item.category && item.category !== 'Geral' && (
                      <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md truncate">
                        {item.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="w-9 h-9 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors cursor-pointer"
                      title="Editar produto"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item)}
                      className="w-9 h-9 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                      title="Excluir produto do estoque"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Product Name */}
                <div className="font-bold text-slate-900 text-sm leading-snug">
                  {item.name}
                </div>

                {/* Stock Stepper & Status */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 bg-slate-50/60 p-2.5 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickStepStock(item, -1)}
                      className="w-9 h-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-base transition-colors shadow-2xs cursor-pointer"
                      title="Diminuir 1 do estoque"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAdjust(item)}
                      className={`font-mono font-black text-sm px-3 py-1.5 rounded-lg border cursor-pointer ${
                        isOut
                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                          : isLow
                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      }`}
                      title="Clique para ajuste detalhado"
                    >
                      {item.currentStock} {item.unit || 'un'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickStepStock(item, 1)}
                      className="w-9 h-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-base transition-colors shadow-2xs cursor-pointer"
                      title="Adicionar 1 ao estoque"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAdjust(item)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Ajustar</span>
                  </button>
                </div>

                {/* 3-Column Prices Grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Custo</span>
                    <span className="font-mono font-bold text-slate-700">
                      R$ {item.costPrice.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <div className="bg-blue-50/60 p-2 rounded-xl border border-blue-100">
                    <span className="text-[10px] text-blue-600 uppercase font-semibold block">Atacado</span>
                    <span className="font-mono font-black text-blue-700">
                      R$ {item.wholesalePrice.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-emerald-600 uppercase font-semibold block">Varejo</span>
                    <span className="font-mono font-black text-emerald-700">
                      R$ {item.retailPrice.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Main Stock Table (Desktop >= 768px) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredStock.length > 0 && selectedStockIds.length === filteredStock.length}
                    onChange={handleToggleSelectAllStock}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                    title="Selecionar todos os produtos filtrados"
                  />
                </th>
                <th className="py-3.5 px-3.5 w-24">Código</th>
                <th className="py-3.5 px-4 min-w-[260px]">Descrição do Item / Produto</th>
                <th className="py-3.5 px-3.5 text-center w-36">Em Estoque</th>
                <th className="py-3.5 px-3.5 text-right w-32">Preço Custo</th>
                <th className="py-3.5 px-3.5 text-right w-32">Preço Atacado</th>
                <th className="py-3.5 px-3.5 text-right w-32">Preço Varejo</th>
                <th className="py-3.5 px-3.5 text-center w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm">Nenhum produto encontrado</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Ajuste os filtros de pesquisa ou clique em "+ Novo Produto".
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStock.map((item) => {
                  const min = item.minStock || 15;
                  const isOut = item.currentStock <= 0;
                  const isLow = !isOut && item.currentStock <= min;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors group ${
                        selectedStockIds.includes(item.id)
                          ? 'bg-rose-50/50'
                          : 'hover:bg-indigo-50/20'
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStockIds.includes(item.id)}
                          onChange={() => handleToggleSelectStock(item.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                          title="Marcar produto para exclusão"
                        />
                      </td>

                      {/* Code */}
                      <td className="py-3 px-3.5">
                        {item.code ? (
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                            {item.code}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        )}
                      </td>

                      {/* Name & Category */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{item.name}</div>
                        {item.category && item.category !== 'Geral' && (
                          <span className="text-[10px] text-slate-400 font-medium">{item.category}</span>
                        )}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`font-mono font-black text-sm px-2.5 py-1 rounded-lg border ${
                              isOut
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : isLow
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {item.currentStock} {item.unit || 'un'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenAdjust(item)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Ajustar saldo (+ entrada / - saída)"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Cost Price */}
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-600">
                        R$ {item.costPrice.toFixed(2).replace('.', ',')}
                      </td>

                      {/* Wholesale Price */}
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-700">
                        R$ {item.wholesalePrice.toFixed(2).replace('.', ',')}
                      </td>

                      {/* Retail Price */}
                      <td className="py-3 px-3.5 text-right font-mono font-black text-emerald-700">
                        R$ {item.retailPrice.toFixed(2).replace('.', ',')}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar produto"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir produto do estoque"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add / Edit Product */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingItem ? 'Editar Produto no Estoque' : 'Cadastrar Novo Produto no Estoque'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Código / SKU
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="Ex: 47, 10"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Descrição do Produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Lixa moeda preta podóloga..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Em Estoque (Qtd)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formStock}
                    onChange={(e) => setFormStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 text-center font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 text-center font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Lixas, Blocos..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Prices: Cost, Wholesale, Retail */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1">
                    Preço de Custo (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formCost}
                    onChange={(e) => setFormCost(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">
                    Preço Atacado (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formWholesale}
                    onChange={(e) => setFormWholesale(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-blue-300 bg-blue-50/40 rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">
                    Preço Varejo (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formRetail}
                    onChange={(e) => setFormRetail(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/40 rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-500 text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {editingItem ? 'Salvar Alterações' : 'Cadastrar no Estoque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Stock Adjustment (+ Entry / - Exit) */}
      {isAdjustModalOpen && adjustingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Ajustar Saldo em Estoque
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjust} className="space-y-4 pt-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800 text-sm">{adjustingItem.name}</div>
                <div className="flex items-center justify-between text-slate-500 mt-1">
                  <span>Código: <strong>{adjustingItem.code || '-'}</strong></span>
                  <span>Saldo Atual: <strong className="text-slate-900 font-mono text-sm">{adjustingItem.currentStock} un</strong></span>
                </div>
              </div>

              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAdjustType('entry')}
                  className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    adjustType === 'entry'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>+ Entrada (Adicionar)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('exit')}
                  className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    adjustType === 'exit'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>- Saída (Subtrair)</span>
                </button>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Quantidade a {adjustType === 'entry' ? 'adicionar' : 'subtrair'}:
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 border-2 border-indigo-300 rounded-xl text-center font-mono font-black text-lg outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Motivo / Justificativa:
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Compra de fornecedor, contagem de inventário, perda..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200 text-indigo-950 flex items-center justify-between font-medium">
                <span>Novo Saldo Previsto:</span>
                <span className="font-mono font-black text-sm">
                  {adjustType === 'entry'
                    ? adjustingItem.currentStock + adjustQty
                    : Math.max(0, adjustingItem.currentStock - adjustQty)}{' '}
                  un
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white rounded-xl font-bold shadow-xs transition-colors ${
                    adjustType === 'entry' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Stock Movements History */}
      {isMovementsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Histórico de Movimentações (Baixas e Estornos)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMovementsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-3 divide-y divide-slate-100 text-xs">
              {movements.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-bold">Nenhuma movimentação registrada ainda</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Baixas de pedidos e estornos de cancelamento aparecerão aqui automaticamente.
                  </p>
                </div>
              ) : (
                movements.map((mov) => {
                  const isPositive = mov.quantity > 0;
                  const dateStr = new Date(mov.timestamp).toLocaleString('pt-BR');

                  return (
                    <div key={mov.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 truncate">
                            {mov.itemCode ? `[${mov.itemCode}] ` : ''}
                            {mov.itemName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{mov.reason || 'Movimentação'}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono font-black text-xs ${
                            isPositive ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isPositive ? `+${mov.quantity}` : `${mov.quantity}`} un
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {mov.previousStock} → {mov.newStock} un • {dateStr}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsMovementsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Excluir Produto Individual do Estoque */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir produto do estoque?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tem certeza que deseja excluir o produto:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-1 my-2">
                <div className="font-bold text-slate-900 text-sm">
                  {itemToDelete.code ? `[${itemToDelete.code}] ` : ''}{itemToDelete.name}
                </div>
                <div className="text-xs text-slate-500 flex justify-between">
                  <span>Saldo atual: <strong>{itemToDelete.currentStock} {itemToDelete.unit || 'un'}</strong></span>
                  <span>Preço Custo: <strong>R$ {itemToDelete.costPrice.toFixed(2)}</strong></span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Esta ação remove o produto do controle de estoque e atualiza os servidores em tempo real.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteItem}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Sim, Excluir Produto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Excluir Múltiplos Produtos do Estoque */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir {selectedStockIds.length} produto(s) do estoque?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Você selecionou <strong>{selectedStockIds.length} produtos</strong> para exclusão definitiva do estoque e da nuvem.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmBulkDeleteStock}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Excluir {selectedStockIds.length} Selecionados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Limpar TODO o Estoque (Excluir os 63 itens) */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                Excluir todos os {stockList.length} itens do estoque?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta ação apagará <strong>todos os produtos</strong> do estoque permanentemente do computador, celular e da nuvem Firestore.
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                Use esta opção para limpar os 63 itens padrão de demonstração antes de importar sua própria planilha.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAllStock}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Sim, Excluir Todos ({stockList.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Escolha de Importação Excel (Substituir vs Mesclar) */}
      {isExcelImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Como deseja importar a planilha?
              </h3>
              <p className="text-xs text-slate-600">
                A planilha contém <strong>{importedExcelItems.length} produtos</strong>. Você já possui <strong>{stockList.length} itens</strong> cadastrados no estoque.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {/* Opção 1: Substituir (Recomendado) */}
              <button
                type="button"
                onClick={() => handleApplyExcelItems(importedExcelItems, 'replace')}
                className="w-full p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 hover:bg-emerald-100/60 text-left transition-all cursor-pointer flex items-start gap-3.5 group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-950">
                      Substituir Estoque Atual (Recomendado)
                    </span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                      Limpa itens antigos
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Apaga os itens antigos (incluindo os itens de teste) e cadastra <strong>apenas os {importedExcelItems.length} produtos da sua planilha</strong>.
                  </p>
                </div>
              </button>

              {/* Opção 2: Mesclar */}
              <button
                type="button"
                onClick={() => handleApplyExcelItems(importedExcelItems, 'merge')}
                className="w-full p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/40 text-left transition-all cursor-pointer flex items-start gap-3.5 group"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      Mesclar com Produtos Existentes
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Mantém os produtos atuais e adiciona os itens da planilha que não existirem.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsExcelImportModalOpen(false);
                  setImportedExcelItems([]);
                }}
                className="px-4 py-2 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar Importação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
