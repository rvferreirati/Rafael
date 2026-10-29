import React, { useState, useEffect, useRef } from 'react';
import { Header, TabType } from './components/Header';
import { CreateOrderTab } from './components/CreateOrderTab';
import { CustomersTab } from './components/CustomersTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { QuickStartModal } from './components/QuickStartModal';
import { CatalogModal } from './components/CatalogModal';
import { Customer, SalesOrder, CompanyProfile } from './types';
import { CatalogProduct, loadStoredCatalog } from './utils/productCatalog';
import { HelpCircle, Sparkles } from 'lucide-react';

const STORAGE_KEYS = {
  CUSTOMERS: 'so_pro_customers_v1',
  ORDERS: 'so_pro_orders_v1',
  COMPANY: 'so_pro_company_v1',
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
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

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

  // Order Handlers
  const handleSaveOrder = (newOrder: SalesOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
  };

  const handleDeleteOrder = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const handleUpdateOrder = (updatedOrder: SalesOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenCatalog={() => setIsCatalogOpen(true)}
        catalogCount={catalog.length}
        ordersCount={orders.length}
        customersCount={customers.length}
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
            onUpdateCatalog={setCatalog}
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
        onUpdateCatalog={setCatalog}
      />
    </div>
  );
}
