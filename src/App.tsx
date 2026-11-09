import React, { useState, useEffect, useRef } from 'react';
import { Header, TabType } from './components/Header';
import { CreateOrderTab } from './components/CreateOrderTab';
import { StockTab } from './components/StockTab';
import { CustomersTab } from './components/CustomersTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { QuickStartModal } from './components/QuickStartModal';
import { CatalogModal } from './components/CatalogModal';
import { SyncModal } from './components/SyncModal';
import { LoginScreen } from './components/LoginScreen';
import { Customer, SalesOrder, CompanyProfile, StockItem } from './types';
import {
  CatalogProduct,
  DEFAULT_CATALOG,
  loadStoredCatalog,
  saveStoredCatalog,
  fetchServerCatalog,
  pushServerCatalog,
  syncCatalogWithServer,
  mergeCatalogProducts
} from './utils/productCatalog';
import {
  loadStoredStock,
  saveStoredStock,
  fetchServerStock,
  pushServerStock,
  deductStockForOrder,
  restoreStockForOrder,
} from './utils/stockManager';
import {
  subscribeToStock,
  pushAllStockToFirestore,
  subscribeToOrders,
  saveOrderToFirestore,
  deleteOrderFromFirestore,
} from './services/firestoreSync';
import { HelpCircle, Sparkles } from 'lucide-react';

const STORAGE_KEYS = {
  CUSTOMERS: 'so_pro_customers_v1',
  ORDERS: 'so_pro_orders_v1',
  COMPANY: 'so_pro_company_v1',
  AUTH: 'artex7_auth_user_v1',
};

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'TechCorp Brasil Soluções Ltda',
    taxId: '12.345.678/0001-90',
    email: 'financeiro@techcorp.com.br',
    phone: '(11) 3200-4500',
    address: 'Av. Brigadeiro Faria Lima, 2200 - Itaim Bibi, São Paulo, SP',
  },
  {
    id: 'cust-2',
    name: 'Logística Global do Brasil S/A',
    taxId: '98.765.432/0001-11',
    email: 'contas@logisticaglobal.com',
    phone: '(19) 3871-9000',
    address: 'Rodovia Anhanguera, km 105 - Distrito Industrial, Campinas, SP',
  },
  {
    id: 'cust-3',
    name: 'Quantum Cloud Inc',
    taxId: 'US-9920194',
    email: 'accounts@quantumcloud.io',
    phone: '+1 (555) 019-9022',
    address: '78 Silicon Alley, Suite 400, Austin, TX',
  },
];

const DEFAULT_COMPANY: CompanyProfile = {
  name: 'ARTEX7',
  taxId: '34.981.240/0001-55',
  email: 'contato@artex7.com.br',
  phone: '(11) 4004-9800',
  address: 'Av. Paulista, 1000, 12º andar - São Paulo, SP',
  currency: 'R$',
  defaultTaxRate: 8,
  logoUrl: '/assets/aistudio/Logo_ARtex7_em_Preto_254e2cb7.png',
};

const INITIAL_ORDERS: SalesOrder[] = [
  {
    id: 'ord-seed-1',
    orderNumber: 'SO-2026-1044',
    orderDate: '2026-10-25',
    orderDueDate: '2026-11-25',
    status: 'confirmed',
    customer: {
      id: 'cust-1',
      name: 'TechCorp Brasil Soluções Ltda',
      taxId: '12.345.678/0001-90',
      email: 'financeiro@techcorp.com.br',
      phone: '(11) 3200-4500',
      address: 'Av. Brigadeiro Faria Lima, 2200 - São Paulo, SP',
    },
    items: [
      {
        id: 'item-seed-1',
        code: 'SKU-8821',
        description: 'Servidores Rack 2U Dell PowerEdge',
        quantity: 2,
        unitPrice: 7500.0,
        total: 15000.0,
      },
      {
        id: 'item-seed-2',
        code: 'SKU-4412',
        description: 'Instalação e Configuração de Cluster',
        quantity: 1,
        unitPrice: 3200.0,
        total: 3200.0,
      },
    ],
    notes: 'Pagamento faturado em 30 dias após instalação.',
    subtotal: 18200.0,
    discountRate: 5,
    discountAmount: 910.0,
    taxRate: 8,
    taxAmount: 1383.2,
    grandTotal: 18673.2,
    createdAt: Date.now() - 86400000 * 3,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('create-order');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>(loadStoredCatalog);
  const [stockList, setStockList] = useState<StockItem[]>(loadStoredStock);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Open the dedicated Sync Modal with real-time PC & Mobile status
  const handleOpenSyncModal = () => {
    setIsSyncModalOpen(true);
  };

  useEffect(() => {
    // 1. Real-time Cloud Firestore Stock Sync (instant mobile & PC updates)
    const unsubStock = subscribeToStock((cloudStock) => {
      if (Array.isArray(cloudStock)) {
        setStockList(cloudStock);
      }
    });

    // 2. Real-time Cloud Firestore Orders Sync
    const unsubOrders = subscribeToOrders((cloudOrders) => {
      if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
        setOrders(cloudOrders);
      }
    });

    // If local catalog on PC has fewer than 63 products, upgrade to full catalog
    if (catalog.length < DEFAULT_CATALOG.length) {
      const merged = mergeCatalogProducts(DEFAULT_CATALOG, catalog);
      setCatalog(merged);
      saveStoredCatalog(merged);
    }

    // Secondary fallback sync for catalog only
    fetchServerCatalog().then((serverCat) => {
      if (serverCat && serverCat.length > 0) {
        setCatalog(serverCat);
      }
    });

    const handleFocus = () => {
      fetchServerCatalog().then((serverCat) => {
        if (serverCat && serverCat.length > 0) {
          setCatalog(serverCat);
        }
      });
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      unsubStock();
      unsubOrders();
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleUpdateCatalog = (newCatalog: CatalogProduct[]) => {
    setCatalog(newCatalog);
    pushServerCatalog(newCatalog);
  };

  const handleUpdateStock = (newStock: StockItem[]) => {
    setStockList(newStock);
    saveStoredStock(newStock);
    pushServerStock(newStock);
    pushAllStockToFirestore(newStock);
  };

  // Persistence
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      return stored ? JSON.parse(stored) : DEFAULT_CUSTOMERS;
    } catch {
      return DEFAULT_CUSTOMERS;
    }
  });

  const [orders, setOrders] = useState<SalesOrder[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return stored ? JSON.parse(stored) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [company, setCompany] = useState<CompanyProfile>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.COMPANY);
      return stored ? JSON.parse(stored) : DEFAULT_COMPANY;
    } catch {
      return DEFAULT_COMPANY;
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [customers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(company));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [company]);

  // Order Handlers with Stock Automation (Baixa no estoque & Estorno no cancelamento)
  const handleSaveOrder = (newOrder: SalesOrder) => {
    // 1. Baixa no estoque para os itens do pedido
    const result = deductStockForOrder(newOrder, stockList);
    if (result.success) {
      setStockList(result.updatedStock);
      newOrder.stockDeducted = true;
      pushAllStockToFirestore(result.updatedStock);
    }
    setOrders((prev) => [newOrder, ...prev]);
    saveOrderToFirestore(newOrder);
  };

  const handleDeleteOrder = (id: string) => {
    const orderToDelete = orders.find((o) => o.id === id);
    if (orderToDelete && orderToDelete.status !== 'cancelled') {
      // Se excluído sem ter sido cancelado antes, estorna o estoque
      const result = restoreStockForOrder(orderToDelete, stockList);
      if (result.success) {
        setStockList(result.updatedStock);
        pushAllStockToFirestore(result.updatedStock);
      }
    }
    setOrders((prev) => prev.filter((o) => o.id !== id));
    deleteOrderFromFirestore(id);
  };

  const handleUpdateOrder = (updatedOrder: SalesOrder) => {
    const previousOrder = orders.find((o) => o.id === updatedOrder.id);

    // Quando cancelar um pedido, volta o saldo para em estoque!
    if (updatedOrder.status === 'cancelled' && previousOrder?.status !== 'cancelled') {
      const result = restoreStockForOrder(updatedOrder, stockList);
      if (result.success) {
        setStockList(result.updatedStock);
        updatedOrder.stockDeducted = false;
        pushAllStockToFirestore(result.updatedStock);
      }
    }
    // Quando reativar um pedido cancelado, refaz a baixa do estoque!
    else if (updatedOrder.status !== 'cancelled' && previousOrder?.status === 'cancelled') {
      const result = deductStockForOrder(updatedOrder, stockList);
      if (result.success) {
        setStockList(result.updatedStock);
        updatedOrder.stockDeducted = true;
        pushAllStockToFirestore(result.updatedStock);
      }
    }

    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    saveOrderToFirestore(updatedOrder);
  };

  // Customer Handlers
  const handleAddCustomer = (newCust: Customer) => {
    setCustomers((prev) => [newCust, ...prev]);
  };

  const handleUpdateCustomer = (updatedCust: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
  };

  const handleDeleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  // User Authentication State (Arnaldo / Rafael - Senha: 7284)
  const [currentUser, setCurrentUser] = useState<{ username: string; name: string } | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUTH);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (user: { username: string; name: string }) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(user));
    } catch (e) {
      console.warn('Erro ao salvar sessão de usuário:', e);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH);
    } catch (e) {
      console.warn('Erro ao encerrar sessão:', e);
    }
  };

  // If user is not authenticated, show the Login Screen
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenCatalog={() => setIsCatalogOpen(true)}
        onSyncCatalog={handleOpenSyncModal}
        isSyncing={isSyncing}
        catalogCount={catalog.length}
        stockCount={stockList.length}
        ordersCount={orders.length}
        customersCount={customers.length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full">
        {activeTab === 'create-order' && (
          <CreateOrderTab
            customers={customers}
            company={company}
            onSaveOrder={handleSaveOrder}
            onNavigateToCustomers={() => setActiveTab('customers')}
            catalog={catalog}
            onUpdateCatalog={handleUpdateCatalog}
            onSyncCatalog={handleOpenSyncModal}
            isSyncing={isSyncing}
            stockList={stockList}
            onUpdateStock={handleUpdateStock}
          />
        )}

        {activeTab === 'stock' && (
          <StockTab
            stockList={stockList}
            onUpdateStock={handleUpdateStock}
            company={company}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersTab
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            orders={orders}
            company={company}
            onDeleteOrder={handleDeleteOrder}
            onUpdateOrder={handleUpdateOrder}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            company={company}
            onSaveCompany={setCompany}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <img src="/assets/aistudio/Logo_ARtex7_em_Preto_254e2cb7.png" alt="ARTEX7" className="h-4 w-auto object-contain" />
            <span>•</span>
            <span>OCR de Carrinho com Recorte Inteligente</span>
            <span>•</span>
            <span>Geração de PDF nativo com Anexos</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Guia: Como Testar
            </button>
          </div>
        </div>
      </footer>

      {/* Quick Start Walkthrough Modal */}
      <QuickStartModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onSelectSamplePreset={(presetId) => {
          setActiveTab('create-order');
          // Dispatch a custom event or let user know
          const event = new CustomEvent('load_sample_preset', { detail: presetId });
          window.dispatchEvent(event);
        }}
      />

      {/* Global Product Catalog Modal */}
      <CatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        catalog={catalog}
        onUpdateCatalog={handleUpdateCatalog}
      />

      {/* Dedicated PC <-> Mobile Sync Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        localCatalog={catalog}
        onUpdateCatalog={handleUpdateCatalog}
      />
    </div>
  );
}
