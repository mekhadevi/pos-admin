import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { Header } from '../../shared/header/header';
import { ProductSidebar } from './panels/product-sidebar/product-sidebar';
import { ProductView, StockMovement } from './product.models';
import { Categories } from './panels/categories/categories';
import { LowStockAlerts } from './panels/low-stock-alerts/low-stock-alerts';
import { StockMovements } from './panels/stock-movements/stock-movements';
import { ImportCsv } from './panels/import-csv/import-csv';
import { Export } from './panels/export/export';

export interface Product {
  LowStockThreshold: number;
  Id: number;
  CompanyId: number;
  CategoryId: number | null;
  CategoryName: string;
  Name: string;
  Barcode: string;
  Barcode2: string;
  SKU: string;
  Price: number;
  VATRate: number;
  IsVATInclusive: number;
  StockQty: number;
  CreatedAt: string;
  UpdatedAt: string;
  IsDeleted: number;
}

export interface Category {
  Id: number;
  CompanyId: number;
  Name: string;
}

type Panel =
  | 'list'
  | 'add'
  | 'edit'
  | 'stock'
  | 'categories'
  | 'low-stock'
  | 'stock-movements'
  | 'import-csv'
  | 'export';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Header,
    ProductSidebar,
    Categories,
    LowStockAlerts,
    StockMovements,
    ImportCsv,
    Export,
  ],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products implements OnInit {
  panel: Panel = 'list';

  products: Product[] = [];
  filtered: Product[] = [];
  categories: Category[] = [];

  selectedCategoryId: number | null = null;
  searchQuery = '';
  companyId = 1;

  stats = { total: 0, lowStock: 0, outOfStock: 0, categories: 0 };

  // Form model
  form: any = this.emptyForm();
  editingId: number | null = null;

  // Stock adjust
  stockProduct: Product | null = null;
  stockQty = 0;
  stockNote = '';

  saving = false;
  deleteConfirmId: number | null = null;
  newCategoryName = '';

  movements: StockMovement[] = [];

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  ngOnInit() {
    const session = this.authService.getSession();
    if (session) this.companyId = session.company.id;
    this.load();
  }

  async load() {
    await Promise.all([this.loadProducts(), this.loadCategories(), this.loadStats()]);
  }

  async loadProducts() {
    const data = await (window as any).electronAPI.products.getAll({
      companyId: this.companyId,
      categoryId: this.selectedCategoryId,
      search: this.searchQuery,
    });
    this.zone.run(() => {
      this.products = data;
      this.filtered = data;
      this.cdr.detectChanges();
    });
  }

  async loadCategories() {
    const data = await (window as any).electronAPI.categories.getAll(this.companyId);
    this.zone.run(() => {
      this.categories = data;
      this.cdr.detectChanges();
    });
  }

  async loadStats() {
    const data = await (window as any).electronAPI.products.getStats(this.companyId);
    this.zone.run(() => {
      this.stats = data;
      this.cdr.detectChanges();
    });
  }

  filterByCategory(id: number | null) {
    this.selectedCategoryId = id;
    this.loadProducts();
  }

  onSearch() {
    this.loadProducts();
  }

  emptyForm() {
    return {
      name: '',
      categoryId: null,
      barcode: '',
      barcode2: '',
      sku: '',
      price: '',
      vatRate: 0,
      isVATInclusive: false,
      stockQty: 0,
      log: '',
    };
  }

  openAdd() {
    this.form = this.emptyForm();
    this.editingId = null;
    this.panel = 'add';
  }

  openEdit(p: Product) {
    this.editingId = p.Id;
    this.form = {
      name: p.Name,
      categoryId: p.CategoryId,
      barcode: p.Barcode || '',
      barcode2: p.Barcode2 || '',
      sku: p.SKU || '',
      price: p.Price,
      vatRate: p.VATRate,
      isVATInclusive: !!p.IsVATInclusive,
      stockQty: p.StockQty,
      log: '',
    };
    this.panel = 'edit';
  }

  openStock(p: Product) {
    this.stockProduct = p;
    this.stockQty = 0;
    this.stockNote = '';
    this.panel = 'stock';
  }

  async save() {
    if (!this.form.name || !this.form.price) return;
    this.saving = true;
    const data = { ...this.form, companyId: this.companyId };
    if (this.editingId) {
      await (window as any).electronAPI.products.update(this.editingId, data);
    } else {
      await (window as any).electronAPI.products.create(data);
    }
    this.saving = false;
    await this.load();
    this.panel = 'list';
  }

  async deleteProduct(id: number) {
    await (window as any).electronAPI.products.delete(id);
    this.deleteConfirmId = null;
    await this.load();
  }

  async saveStock() {
    if (!this.stockProduct) return;
    await (window as any).electronAPI.products.adjustStock(
      this.stockProduct.Id,
      this.stockQty,
      this.stockNote,
    );
    await this.load();
    this.panel = 'list';
  }

  async addCategory() {
    if (!this.newCategoryName.trim()) return;
    await (window as any).electronAPI.categories.create(
      this.companyId,
      this.newCategoryName.trim(),
    );
    this.newCategoryName = '';
    await this.loadCategories();
  }

  async scanBarcode() {
    // Placeholder — implement with Electron serial/USB scanner IPC
    alert('Connect barcode scanner via Electron IPC');
  }

  stockStatus(qty: number): 'out' | 'low' | 'ok' {
    if (qty <= 0) return 'out';
    if (qty < 10) return 'low';
    return 'ok';
  }

  get panelTitle(): string {
    const map: Record<Panel, string> = {
      list: 'Products',
      add: 'Add product',
      edit: 'Edit product',
      categories: 'Categories',
      stock: 'Adjust stock',
      'low-stock': 'Low stock alerts',
      'stock-movements': 'Stock movements',
      'import-csv': 'Import CSV',
      export: 'Export products',
    };
    return map[this.panel];
  }

  vatPrice(p: Product): number {
    if (!p.IsVATInclusive) return p.Price * (1 + p.VATRate / 100);
    return p.Price;
  }
  mapPanelToView(panel: Panel): ProductView {
    switch (panel) {
      case 'list':
        return 'list';
      case 'add':
        return 'add';
      case 'edit':
        return 'add';
      case 'stock':
        return 'stock-levels';
      case 'categories':
        return 'categories';
      case 'low-stock':
        return 'low-stock';
      case 'stock-movements':
        return 'stock-movements';
      case 'import-csv':
        return 'import-csv';
      case 'export':
        return 'export';
      default:
        return 'list';
    }
  }
  onSidebarChange(view: ProductView) {
    switch (view) {
      case 'list':
        this.panel = 'list';
        break;

      case 'add':
        this.openAdd();
        break;

      case 'categories':
        this.panel = 'categories';
        break;

      case 'low-stock':
        this.panel = 'low-stock';
        this.filterLowStock();
        break;

      case 'stock-levels':
        this.panel = 'stock';
        break;
      case 'stock-movements':
        this.panel = 'stock-movements';
        this.loadMovements();
        break;
      case 'import-csv':
        this.panel = 'import-csv';
        break;
      case 'export':
        this.panel = 'export';
        break;
      default:
        console.warn('Unhandled view:', view);
    }
  }
  filterLowStock() {
    this.filtered = this.products.filter((p) => p.StockQty < p.LowStockThreshold);
  }
  addCategoryFromSidebar(name: string) {
    this.newCategoryName = name;
    this.addCategory();
  }

  async deleteCategory(id: number) {
    await (window as any).electronAPI.categories.delete(id);
    await this.loadCategories();
  }
  async loadMovements() {
    const data = await (window as any).electronAPI.products.getMovements(this.companyId);
    this.zone.run(() => {
      this.movements = data;
      this.cdr.detectChanges();
    });
  }
  catPillClass(category: string): string {
    const map: Record<string, string> = {
      Food: 'cat-food',
      Beverage: 'cat-bev',
      Sweet: 'cat-sweet',
      Snack: 'cat-snack',
      Alcohol: 'cat-alc',
    };
    return map[category] || 'cat-default';
  }

  stockClass(qty: number): string {
    if (qty <= 0) return 'stock-low';
    if (qty < 10) return 'stock-med';
    return 'stock-ok';
  }
}
