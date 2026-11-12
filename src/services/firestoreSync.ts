import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StockItem, SalesOrder, StockMovement, Customer, CompanyProfile } from '../types';
import { CatalogProduct, saveStoredCatalog } from '../utils/productCatalog';
import { saveStoredStock, saveStoredStockMovements } from '../utils/stockManager';

const sanitizeDocId = (id: string): string => {
  return String(id).replace(/[\/\s#?]+/g, '_').substring(0, 100);
};

// Recursively remove undefined fields so Firestore setDoc/writeBatch never rejects payloads
const cleanForFirestore = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    Object.entries(value as Record<string, any>).forEach(([k, v]) => {
      if (v !== undefined) {
        cleaned[k] = cleanForFirestore(v);
      }
    });
    return cleaned as T;
  }
  return value;
};

// Ensure SalesOrder fits well within Firestore's 1MB document limit
const prepareOrderForFirestore = (order: SalesOrder): SalesOrder & { updatedAt: number } => {
  const docId = sanitizeDocId(order.id || `order-${order.orderNumber}`);
  const baseOrder = cleanForFirestore({
    ...order,
    id: docId,
    updatedAt: Date.now(),
  });

  try {
    const jsonSize = JSON.stringify(baseOrder).length;
    if (jsonSize > 850000) {
      // Strip heavy base64 images if they would exceed Firestore's 1MB limit
      const trimmed: any = { ...baseOrder };
      delete trimmed.attachedImageUrl;
      if (Array.isArray(trimmed.attachedImages) && trimmed.attachedImages.length > 0) {
        // Keep only first compressed image if it fits, otherwise strip
        const singleTest = { ...trimmed, attachedImages: [trimmed.attachedImages[0]] };
        if (JSON.stringify(singleTest).length <= 850000) {
          trimmed.attachedImages = [trimmed.attachedImages[0]];
        } else {
          delete trimmed.attachedImages;
        }
      }
      return trimmed;
    }
  } catch {
    // ignore serialization check error
  }

  return baseOrder;
};

// ----------------------------------------------------
// 1. Real-time Stock Sync across all Devices (PC & Mobile)
// ----------------------------------------------------

export const subscribeToStock = (
  onStockUpdate: (items: StockItem[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  const stockCol = collection(db, 'stock');

  const unsubscribe = onSnapshot(
    stockCol,
    (snapshot) => {
      try {
        const items: StockItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as StockItem;
          if (data && (data.name || data.code)) {
            items.push({
              ...data,
              id: docSnap.id,
            });
          }
        });

        if (items.length > 0) {
          items.sort((a, b) => {
            const codeA = a.code || '';
            const codeB = b.code || '';
            if (codeA && codeB) return codeA.localeCompare(codeB, undefined, { numeric: true });
            return (a.name || '').localeCompare(b.name || '');
          });

          saveStoredStock(items);
          onStockUpdate(items);
        } else {
          saveStoredStock([]);
          onStockUpdate([]);
        }
      } catch (err) {
        console.error('Erro ao processar snapshot de estoque:', err);
      }
    },
    (error) => {
      console.warn('Erro na conexão em tempo real do estoque (Firestore):', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, 'stock');
    }
  );

  return unsubscribe;
};

export const clearAllStockFromFirestore = async (): Promise<boolean> => {
  try {
    const stockCol = collection(db, 'stock');
    const snapshot = await getDocs(stockCol);

    if (!snapshot.empty) {
      const docs = snapshot.docs;
      const CHUNK_SIZE = 400;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    await setDoc(doc(db, 'system_meta', 'stock_meta'), {
      count: 0,
      updatedAt: Date.now(),
      lastSync: new Date().toISOString(),
      cleared: true,
    });

    saveStoredStock([]);
    return true;
  } catch (error) {
    console.error('Erro ao limpar estoque do Firestore:', error);
    handleFirestoreError(error, OperationType.DELETE, 'stock');
    return false;
  }
};

export const replaceStockInFirestore = async (newItems: StockItem[]): Promise<boolean> => {
  try {
    await clearAllStockFromFirestore();
    if (newItems.length > 0) {
      await pushAllStockToFirestore(newItems);
    }
    return true;
  } catch (error) {
    console.error('Erro ao substituir estoque no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, 'stock');
    return false;
  }
};

export const pushAllStockToFirestore = async (items: StockItem[]): Promise<boolean> => {
  if (!items || items.length === 0) {
    return clearAllStockFromFirestore();
  }

  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((item) => {
        const docId = sanitizeDocId(item.id || item.code || `stock-${Date.now()}`);
        const ref = doc(db, 'stock', docId);
        batch.set(
          ref,
          cleanForFirestore({
            ...item,
            id: docId,
            updatedAt: item.updatedAt || Date.now(),
          }),
          { merge: true }
        );
      });

      await batch.commit();
    }

    await setDoc(doc(db, 'system_meta', 'stock_meta'), {
      count: items.length,
      updatedAt: Date.now(),
      lastSync: new Date().toISOString(),
      cleared: false,
    });

    saveStoredStock(items);
    return true;
  } catch (error) {
    console.error('Erro ao salvar lote de estoque no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, 'stock');
    return false;
  }
};

export const saveStockItemToFirestore = async (item: StockItem): Promise<boolean> => {
  try {
    const docId = sanitizeDocId(item.id || item.code || `stock-${Date.now()}`);
    await setDoc(
      doc(db, 'stock', docId),
      cleanForFirestore({
        ...item,
        id: docId,
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Erro ao salvar item no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, `stock/${item.id}`);
    return false;
  }
};

export const deleteStockItemFromFirestore = async (itemId: string): Promise<boolean> => {
  try {
    const cleanId = sanitizeDocId(itemId);
    await deleteDoc(doc(db, 'stock', cleanId));
    if (itemId !== cleanId) {
      await deleteDoc(doc(db, 'stock', itemId)).catch(() => {});
    }
    return true;
  } catch (error) {
    console.error('Erro ao deletar item no Firestore:', error);
    handleFirestoreError(error, OperationType.DELETE, `stock/${itemId}`);
    return false;
  }
};

export const deleteBatchStockFromFirestore = async (itemIds: string[]): Promise<boolean> => {
  if (!itemIds || itemIds.length === 0) return true;

  try {
    const stockCol = collection(db, 'stock');
    const snap = await getDocs(stockCol);
    const targetSet = new Set(itemIds.map((id) => String(id).toLowerCase().trim()));
    const sanitizedSet = new Set(itemIds.map((id) => sanitizeDocId(id).toLowerCase()));

    const toDeleteRefs: any[] = [];
    snap.forEach((docSnap) => {
      const docId = docSnap.id.toLowerCase();
      const data = docSnap.data();
      const rawId = String(data.id || '').toLowerCase();
      const rawCode = String(data.code || '').toLowerCase();

      if (
        targetSet.has(docId) ||
        sanitizedSet.has(docId) ||
        (rawId && targetSet.has(rawId)) ||
        (rawCode && targetSet.has(rawCode))
      ) {
        toDeleteRefs.push(docSnap.ref);
      }
    });

    itemIds.forEach((id) => {
      toDeleteRefs.push(doc(db, 'stock', sanitizeDocId(id)));
    });

    const CHUNK_SIZE = 400;
    for (let i = 0; i < toDeleteRefs.length; i += CHUNK_SIZE) {
      const chunk = toDeleteRefs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    return true;
  } catch (error) {
    console.error('Erro ao deletar múltiplos itens do Firestore:', error);
    handleFirestoreError(error, OperationType.DELETE, 'stock');
    return false;
  }
};

// ----------------------------------------------------
// 2. Real-time Stock Movements Sync
// ----------------------------------------------------

export const subscribeToStockMovements = (
  onMovementsUpdate: (movements: StockMovement[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  const movCol = collection(db, 'stock_movements');

  const unsubscribe = onSnapshot(
    movCol,
    (snapshot) => {
      try {
        const movements: StockMovement[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as StockMovement;
          if (data && data.id) {
            movements.push({ ...data, id: docSnap.id });
          }
        });

        movements.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const trimmed = movements.slice(0, 300);
        saveStoredStockMovements(trimmed);
        onMovementsUpdate(trimmed);
      } catch (err) {
        console.error('Erro ao processar movimentações de estoque:', err);
      }
    },
    (error) => {
      console.warn('Erro na conexão de movimentações (Firestore):', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, 'stock_movements');
    }
  );

  return unsubscribe;
};

export const saveStockMovementsToFirestore = async (movements: StockMovement[]): Promise<boolean> => {
  if (!movements || movements.length === 0) return true;
  try {
    const CHUNK_SIZE = 400;
    const recent = movements.slice(0, 300);
    for (let i = 0; i < recent.length; i += CHUNK_SIZE) {
      const chunk = recent.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((mov) => {
        const docId = sanitizeDocId(mov.id || `mov-${Date.now()}`);
        batch.set(
          doc(db, 'stock_movements', docId),
          cleanForFirestore({ ...mov, id: docId }),
          { merge: true }
        );
      });
      await batch.commit();
    }
    return true;
  } catch (error) {
    console.error('Erro ao salvar movimentações no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, 'stock_movements');
    return false;
  }
};

// ----------------------------------------------------
// 3. Real-time Orders (Histórico de Pedidos) Sync
// ----------------------------------------------------

let ordersBootstrapChecked = false;

export const subscribeToOrders = (
  onOrdersUpdate: (orders: SalesOrder[]) => void,
  initialLocalOrders: SalesOrder[] = [],
  onError?: (err: any) => void
): (() => void) => {
  const ordersCol = collection(db, 'orders');

  const unsubscribe = onSnapshot(
    ordersCol,
    async (snapshot) => {
      try {
        const orders: SalesOrder[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as SalesOrder;
          if (data && data.orderNumber) {
            orders.push({
              ...data,
              id: data.id || docSnap.id,
            });
          }
        });

        // One-time migration if Firestore orders is empty and not initialized yet
        if (orders.length === 0 && !ordersBootstrapChecked && !snapshot.metadata.fromCache) {
          ordersBootstrapChecked = true;
          try {
            const metaSnap = await getDoc(doc(db, 'system_meta', 'orders_meta'));
            if (!metaSnap.exists()) {
              if (initialLocalOrders.length > 0) {
                await pushAllOrdersToFirestore(initialLocalOrders);
                return; // onSnapshot will fire again immediately with uploaded orders
              } else {
                await setDoc(doc(db, 'system_meta', 'orders_meta'), {
                  initialized: true,
                  count: 0,
                  updatedAt: Date.now(),
                });
              }
            }
          } catch (bootstrapErr) {
            console.warn('Aviso ao verificar bootstrap de pedidos:', bootstrapErr);
          }
        } else if (orders.length > 0) {
          ordersBootstrapChecked = true;
        }

        orders.sort((a, b) => {
          const timeA = a.createdAt || new Date(a.orderDate).getTime() || 0;
          const timeB = b.createdAt || new Date(b.orderDate).getTime() || 0;
          return timeB - timeA;
        });

        try {
          localStorage.setItem('so_pro_orders_v1', JSON.stringify(orders));
        } catch {
          // ignore localStorage quota error
        }

        onOrdersUpdate(orders);
      } catch (err) {
        console.error('Erro ao processar snapshot de pedidos:', err);
      }
    },
    (error) => {
      console.warn('Erro na conexão em tempo real dos pedidos (Firestore):', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, 'orders');
    }
  );

  return unsubscribe;
};

export const saveOrderToFirestore = async (order: SalesOrder): Promise<boolean> => {
  try {
    const payload = prepareOrderForFirestore(order);
    await setDoc(doc(db, 'orders', payload.id), payload, { merge: true });
    await setDoc(
      doc(db, 'system_meta', 'orders_meta'),
      { initialized: true, updatedAt: Date.now() },
      { merge: true }
    ).catch(() => {});
    return true;
  } catch (error) {
    console.error('Erro ao salvar pedido no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, `orders/${order.id}`);
    return false;
  }
};

export const pushAllOrdersToFirestore = async (orders: SalesOrder[]): Promise<boolean> => {
  try {
    if (orders.length > 0) {
      const CHUNK_SIZE = 200; // Smaller chunk size because orders contain line items
      for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
        const chunk = orders.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((order) => {
          const payload = prepareOrderForFirestore(order);
          batch.set(doc(db, 'orders', payload.id), payload, { merge: true });
        });
        await batch.commit();
      }
    }

    await setDoc(
      doc(db, 'system_meta', 'orders_meta'),
      {
        initialized: true,
        count: orders.length,
        updatedAt: Date.now(),
        lastSync: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Erro ao enviar pedidos em lote para o Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, 'orders');
    return false;
  }
};

export const deleteOrderFromFirestore = async (orderId: string): Promise<boolean> => {
  try {
    const docId = sanitizeDocId(orderId);
    await deleteDoc(doc(db, 'orders', docId));
    if (orderId !== docId) {
      await deleteDoc(doc(db, 'orders', orderId)).catch(() => {});
    }
    await setDoc(
      doc(db, 'system_meta', 'orders_meta'),
      { initialized: true, updatedAt: Date.now() },
      { merge: true }
    ).catch(() => {});
    return true;
  } catch (error) {
    console.error('Erro ao deletar pedido no Firestore:', error);
    handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    return false;
  }
};

// ----------------------------------------------------
// 4. Real-time Customers (Clientes) Sync across all Devices
// ----------------------------------------------------

let customersBootstrapChecked = false;

export const subscribeToCustomers = (
  onCustomersUpdate: (customers: Customer[]) => void,
  initialLocalCustomers: Customer[] = [],
  onError?: (err: any) => void
): (() => void) => {
  const custCol = collection(db, 'customers');

  const unsubscribe = onSnapshot(
    custCol,
    async (snapshot) => {
      try {
        const customers: Customer[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Customer;
          if (data && data.name) {
            customers.push({
              ...data,
              id: data.id || docSnap.id,
            });
          }
        });

        // One-time migration if Firestore customers collection was never initialized
        if (customers.length === 0 && !customersBootstrapChecked && !snapshot.metadata.fromCache) {
          customersBootstrapChecked = true;
          try {
            const metaSnap = await getDoc(doc(db, 'system_meta', 'customers_meta'));
            if (!metaSnap.exists()) {
              if (initialLocalCustomers.length > 0) {
                await pushAllCustomersToFirestore(initialLocalCustomers);
                return;
              } else {
                await setDoc(doc(db, 'system_meta', 'customers_meta'), {
                  initialized: true,
                  count: 0,
                  updatedAt: Date.now(),
                });
              }
            }
          } catch (bootstrapErr) {
            console.warn('Aviso ao verificar bootstrap de clientes:', bootstrapErr);
          }
        } else if (customers.length > 0) {
          customersBootstrapChecked = true;
        }

        customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        try {
          localStorage.setItem('so_pro_customers_v1', JSON.stringify(customers));
        } catch {
          // ignore
        }

        onCustomersUpdate(customers);
      } catch (err) {
        console.error('Erro ao processar snapshot de clientes:', err);
      }
    },
    (error) => {
      console.warn('Erro na conexão em tempo real dos clientes (Firestore):', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, 'customers');
    }
  );

  return unsubscribe;
};

export const saveCustomerToFirestore = async (customer: Customer): Promise<boolean> => {
  try {
    const docId = sanitizeDocId(customer.id || `cust-${Date.now()}`);
    await setDoc(
      doc(db, 'customers', docId),
      cleanForFirestore({
        ...customer,
        id: docId,
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
    await setDoc(
      doc(db, 'system_meta', 'customers_meta'),
      { initialized: true, updatedAt: Date.now() },
      { merge: true }
    ).catch(() => {});
    return true;
  } catch (error) {
    console.error('Erro ao salvar cliente no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, `customers/${customer.id}`);
    return false;
  }
};

export const deleteCustomerFromFirestore = async (customerId: string): Promise<boolean> => {
  try {
    const docId = sanitizeDocId(customerId);
    await deleteDoc(doc(db, 'customers', docId));
    if (customerId !== docId) {
      await deleteDoc(doc(db, 'customers', customerId)).catch(() => {});
    }
    await setDoc(
      doc(db, 'system_meta', 'customers_meta'),
      { initialized: true, updatedAt: Date.now() },
      { merge: true }
    ).catch(() => {});
    return true;
  } catch (error) {
    console.error('Erro ao deletar cliente no Firestore:', error);
    handleFirestoreError(error, OperationType.DELETE, `customers/${customerId}`);
    return false;
  }
};

export const pushAllCustomersToFirestore = async (customers: Customer[]): Promise<boolean> => {
  try {
    if (customers.length > 0) {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < customers.length; i += CHUNK_SIZE) {
        const chunk = customers.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((cust) => {
          const docId = sanitizeDocId(cust.id || `cust-${Date.now()}`);
          batch.set(
            doc(db, 'customers', docId),
            cleanForFirestore({
              ...cust,
              id: docId,
              updatedAt: Date.now(),
            }),
            { merge: true }
          );
        });
        await batch.commit();
      }
    }

    await setDoc(
      doc(db, 'system_meta', 'customers_meta'),
      {
        initialized: true,
        count: customers.length,
        updatedAt: Date.now(),
        lastSync: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Erro ao salvar clientes em lote no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, 'customers');
    return false;
  }
};

// ----------------------------------------------------
// 5. Real-time Company Profile (Empresa) Sync
// ----------------------------------------------------

let companyBootstrapChecked = false;

export const subscribeToCompanyProfile = (
  onCompanyUpdate: (profile: CompanyProfile) => void,
  initialLocalCompany: CompanyProfile,
  onError?: (err: any) => void
): (() => void) => {
  const companyRef = doc(db, 'settings', 'company_profile');

  const unsubscribe = onSnapshot(
    companyRef,
    async (docSnap) => {
      try {
        if (docSnap.exists()) {
          companyBootstrapChecked = true;
          const data = docSnap.data() as CompanyProfile & { updatedAt?: number };
          const profile: CompanyProfile = {
            name: data.name || initialLocalCompany.name,
            taxId: data.taxId || initialLocalCompany.taxId,
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || '',
            currency: data.currency || 'R$',
            defaultTaxRate: typeof data.defaultTaxRate === 'number' ? data.defaultTaxRate : 8,
            logoUrl: data.logoUrl || initialLocalCompany.logoUrl,
          };

          try {
            localStorage.setItem('so_pro_company_v1', JSON.stringify(profile));
          } catch {
            // ignore
          }
          onCompanyUpdate(profile);
        } else if (!companyBootstrapChecked && !docSnap.metadata.fromCache) {
          companyBootstrapChecked = true;
          await saveCompanyToFirestore(initialLocalCompany);
        }
      } catch (err) {
        console.error('Erro ao processar perfil da empresa (Firestore):', err);
      }
    },
    (error) => {
      console.warn('Erro na conexão em tempo real da empresa (Firestore):', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, 'settings/company_profile');
    }
  );

  return unsubscribe;
};

export const saveCompanyToFirestore = async (profile: CompanyProfile): Promise<boolean> => {
  try {
    await setDoc(
      doc(db, 'settings', 'company_profile'),
      cleanForFirestore({
        ...profile,
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Erro ao salvar dados da empresa no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, 'settings/company_profile');
    return false;
  }
};

// ----------------------------------------------------
// 6. Real-time Catalog Sync
// ----------------------------------------------------

let catalogBootstrapChecked = false;

export const subscribeToCatalog = (
  onCatalogUpdate: (products: CatalogProduct[]) => void,
  initialLocalCatalog: CatalogProduct[] = [],
  onError?: (err: any) => void
): (() => void) => {
  const catalogCol = collection(db, 'catalog');

  const unsubscribe = onSnapshot(
    catalogCol,
    async (snapshot) => {
      try {
        const products: CatalogProduct[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as CatalogProduct;
          if (data && data.name) {
            products.push({
              ...data,
              id: data.id || docSnap.id,
            });
          }
        });

        if (products.length === 0 && !catalogBootstrapChecked && !snapshot.metadata.fromCache) {
          catalogBootstrapChecked = true;
          try {
            const metaSnap = await getDoc(doc(db, 'system_meta', 'catalog_meta'));
            if (!metaSnap.exists() && initialLocalCatalog.length > 0) {
              await pushAllCatalogToFirestore(initialLocalCatalog);
              return;
            }
          } catch (err) {
            console.warn('Aviso ao verificar bootstrap do catálogo:', err);
          }
        } else if (products.length > 0) {
          catalogBootstrapChecked = true;
        }

        if (products.length > 0) {
          saveStoredCatalog(products);
          onCatalogUpdate(products);
        }
      } catch (err) {
        console.error('Erro ao processar catálogo:', err);
      }
    },
    (error) => {
      console.warn('Erro ao sincronizar catálogo (Firestore):', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, 'catalog');
    }
  );

  return unsubscribe;
};

export const pushAllCatalogToFirestore = async (products: CatalogProduct[]): Promise<boolean> => {
  if (!products || products.length === 0) return true;

  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((p) => {
        const docId = sanitizeDocId(p.id || p.code || `cat-${Date.now()}`);
        const ref = doc(db, 'catalog', docId);
        batch.set(ref, cleanForFirestore({ ...p, id: docId }), { merge: true });
      });

      await batch.commit();
    }

    await setDoc(
      doc(db, 'system_meta', 'catalog_meta'),
      {
        initialized: true,
        count: products.length,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Erro ao salvar catálogo no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, 'catalog');
    return false;
  }
};
