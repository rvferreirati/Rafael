export interface LineItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Customer {
  id: string;
  name: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  orderDueDate: string;
  status: 'draft' | 'confirmed' | 'delivered';
  customer: {
    id?: string;
    name: string;
    taxId: string;
    email: string;
    phone?: string;
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
