export interface LineItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  stockItemId?: string;
  costPrice?: number;
}

export interface Customer {
  id: string;
  name: string;
  taxId: string;
  email: string;
  phone: string;
  cep?: string;
  address: string;
}

export interface StockItem {
  id: string;
  code: string;             // Código / SKU
  barcode?: string;         // Código de Barras (EAN / GTIN / QR / Code128)
  name: string;             // Descrição do Produto
  currentStock: number;     // Em Estoque (Qtd atual)
  minStock?: number;        // Estoque Mínimo
  costPrice: number;        // Preço de Custo (R$)
  wholesalePrice: number;   // Preço Atacado (R$)
  retailPrice: number;      // Preço Varejo (R$)
  category?: string;        // Categoria / Marca
  unit?: string;            // 'un', 'cx', 'pct'
  notes?: string;           // Observações
  updatedAt?: number;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  itemCode: string;
  itemName: string;
  type: 'sale' | 'cancellation_return' | 'manual_adjustment' | 'purchase_entry' | 'initial_import';
  quantity: number; // positive or negative
  previousStock: number;
  newStock: number;
  orderId?: string;
  orderNumber?: string;
  reason?: string;
  timestamp: number;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  orderDueDate: string;
  status: 'draft' | 'confirmed' | 'delivered' | 'cancelled';
  priceType?: 'wholesale' | 'retail' | 'custom';
  stockDeducted?: boolean;
  customer: {
    id?: string;
    name: string;
    taxId: string;
    email: string;
    phone?: string;
    cep?: string;
    address: string;
  };
  items: LineItem[];
  notes: string;
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  attachedImageUrl?: string;
  attachedImages?: string[];
  createdAt: number;
}

export interface CompanyProfile {
  name: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  defaultTaxRate: number;
  logoUrl?: string;
}
