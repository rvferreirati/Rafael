import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StockItem, SalesOrder, StockMovement, Customer } from '../types';
import { CatalogProduct } from '../utils/productCatalog';
import { saveStoredStock, loadStoredStock } from '../utils/stockManager';

const sanitizeDocId = (id: string): string => {
  return String(id).replace(/[\/\s#?]+/g, '_').substring(0, 100);
};

// ----------------------------------------------------
// Real-time Stock Sync across all Devices (PC & Mobile)
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
              id: docSnap.id, // Strictly use Firestore doc ID so deletes match 100%
            });
          }
        });

        if (items.length > 0) {
          // Sort items by code/name
          items.sort((a, b) => {
            const codeA = a.code || '';
            const codeB = b.code || '';
            if (codeA && codeB) return codeA.localeCompare(codeB, undefined, { numeric: true });
            return (a.name || '').localeCompare(b.name || '');
          });

          // Update local cache and notify listener
          saveStoredStock(items);
          onStockUpdate(items);
        } else {
          // When collection has 0 items (or user deleted all), respect empty stock!
          // NEVER re-seed 63 demo items automatically!
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

// Clear all stock items completely from Firestore (Used to delete all 63 items)
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

// Completely replace Firestore stock with a clean new list (wipes old demo items)
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

// Push an entire stock list (e.g. after Excel import) to Firestore using Batches
export const pushAllStockToFirestore = async (items: StockItem[]): Promise<boolean> => {
  if (!items || items.length === 0) {
    return clearAllStockFromFirestore();
  }

  try {
    // Firestore batches limit is 500 writes
    const CHUNK_SIZE = 400;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((item) => {
        const docId = sanitizeDocId(item.id || item.code || `stock-${Date.now()}`);
        const ref = doc(db, 'stock', docId);
        batch.set(ref, {
          ...item,
          id: docId,
          updatedAt: item.updatedAt || Date.now(),
        }, { merge: true });
      });

      await batch.commit();
    }

    // Update metadata record
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

// Save a single stock item
export const saveStockItemToFirestore = async (item: StockItem): Promise<boolean> => {
  try {
    const docId = sanitizeDocId(item.id || item.code || `stock-${Date.now()}`);
    await setDoc(
      doc(db, 'stock', docId),
      {
        ...item,
        id: docId,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Erro ao salvar item no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, `stock/${item.id}`);
    return false;
  }
};

// Delete a single stock item
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

// Delete multiple stock items with multi-key matching (doc ID, sanitized ID, item code)
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

    // Also directly schedule sanitized IDs
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
// Real-time Orders Sync across all Devices
// ----------------------------------------------------

export const subscribeToOrders = (
  onOrdersUpdate: (orders: SalesOrder[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  const ordersCol = collection(db, 'orders');

  const unsubscribe = onSnapshot(
    ordersCol,
    (snapshot) => {
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

        // Sort descending by date/creation
        orders.sort((a, b) => {
          const timeA = a.createdAt || new Date(a.orderDate).getTime() || 0;
          const timeB = b.createdAt || new Date(b.orderDate).getTime() || 0;
          return timeB - timeA;
        });

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
    const docId = sanitizeDocId(order.id || `order-${order.orderNumber}`);
    await setDoc(
      doc(db, 'orders', docId),
      {
        ...order,
        id: docId,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Erro ao salvar pedido no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, `orders/${order.id}`);
    return false;
  }
};

export const deleteOrderFromFirestore = async (orderId: string): Promise<boolean> => {
  try {
    const docId = sanitizeDocId(orderId);
    await deleteDoc(doc(db, 'orders', docId));
    return true;
  } catch (error) {
    console.error('Erro ao deletar pedido no Firestore:', error);
    handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    return false;
  }
};

// ----------------------------------------------------
// Real-time Catalog Sync
// ----------------------------------------------------

export const subscribeToCatalog = (
  onCatalogUpdate: (products: CatalogProduct[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  const catalogCol = collection(db, 'catalog');

  const unsubscribe = onSnapshot(
    catalogCol,
    (snapshot) => {
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

        if (products.length > 0) {
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
        batch.set(ref, { ...p, id: docId }, { merge: true });
      });

      await batch.commit();
    }
    return true;
  } catch (error) {
    console.error('Erro ao salvar catálogo no Firestore:', error);
    handleFirestoreError(error, OperationType.WRITE, 'catalog');
    return false;
  }
};
