export interface Product {
  Id: number;
  CompanyId: number;
  CategoryId: number | null;
  CategoryName?: string;
  Name: string;
  Barcode: string;
  Barcode2: string;
  SKU: string;
  Price: number;
  CostPrice?: number;
  VATRate: number;
  IsVATInclusive: number;
  StockQty: number;
  LowStockThreshold: number;
  MaxStock?: number;
  CreatedAt: string;
  UpdatedAt: string;
  Log?: string;
  IsDeleted: number;
}

export interface Category {
  Id: number;
  CompanyId: number;
  Name: string;
}

export interface StockMovement {
  Id: number;
  ProductId: number;
  ProductName?: string;
  Type: 'Sale' | 'Purchase' | 'Adjustment' | 'Return';
  Qty: number;
  Note: string;
  CreatedAt: string;
  CreatedBy?: string;
}

export interface ProductStats {
  total: number;
  lowStock: number;
  outOfStock: number;
  categories: number;
}

export interface ProductForm {
  name: string;
  categoryId: number | null;
  unit: string;
  barcode: string;
  barcode2: string;
  sku: string;
  costPrice: number | null;
  price: number | null;
  vatRate: number;
  isVATInclusive: boolean;
  discount: number;
  stockQty: number;
  lowStockThreshold: number;
  maxStock: number | null;
  log: string;
}

export type ProductView =
  | 'add'
  | 'list'
  | 'categories'
  | 'stock-levels'
  | 'low-stock'
  | 'stock-movements'
  | 'import-csv'
  | 'export';
