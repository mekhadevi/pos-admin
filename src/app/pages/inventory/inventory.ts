import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PendingCountPipe } from '../../pipes/pending-count.pipe';
import { Header } from '../../shared/header/header';

export type InventoryView =
  | 'overview'
  | 'stock'
  | 'adjustments'
  | 'po'
  | 'expiry'
  | 'movements'
  | 'low-stock';

export interface StockProduct {
  Id: number;
  Name: string;
  CategoryName: string;
  StockQty: number;
  LowStockThreshold: number;
  ExpiryDate: string | null;
  Price: number;
}

export interface StockMovement {
  Id: number;
  ProductName: string;
  Type: string;
  Qty: number;
  StockAfter: number;
  Note: string;
  CreatedAt: string;
  CreatedBy: string;
}

export interface PurchaseOrder {
  Id: number;
  PoNumber: string;
  SupplierName: string;
  InvoiceNumber: string;
  TotalAmount: number;
  Status: string;
  ExpectedDate: string;
  CreatedAt: string;
  ItemCount: number;
}

export interface PoItem {
  productId: number | null;
  productName: string;
  qty: number;
  unitCost: number;
}

export interface Supplier {
  Id: number;
  Name: string;
}

export interface ExpiryProduct {
  Id: number;
  Name: string;
  CategoryName: string;
  StockQty: number;
  ExpiryDate: string;
  DaysLeft: number;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, PendingCountPipe, Header],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
})
export class Inventory implements OnInit {
  view: InventoryView = 'overview';

  // ── session ────────────────────────────────────────────
  companyId: number | null = null;
  branchId: number | null = null;

  // ── overview stats ─────────────────────────────────────
  stats = { total: 0, lowStock: 0, outOfStock: 0, expiringCount: 0, categories: 0 };

  // ── stock levels ───────────────────────────────────────
  products: StockProduct[] = [];
  filteredProducts: StockProduct[] = [];
  stockSearch = '';
  stockCategoryFilter = '';
  stockStatusFilter = '';
  categories: string[] = [];

  // ── adjustments ────────────────────────────────────────
  adjForm = {
    productId: null as number | null,
    type: 'add',
    qty: 0,
    reason: 'Stock count correction',
    note: '',
  };
  recentAdjustments: StockMovement[] = [];
  adjSaving = false;

  // ── purchase orders ────────────────────────────────────
  purchaseOrders: PurchaseOrder[] = [];
  suppliers: Supplier[] = [];
  poForm = {
    supplierId: null as number | null,
    invoiceNumber: '',
    expectedDate: '',
    notes: '',
  };
  poItems: PoItem[] = [{ productId: null, productName: '', qty: 1, unitCost: 0 }];
  poSaving = false;
  showPoForm = false;

  // ── expiry ─────────────────────────────────────────────
  expiryProducts: ExpiryProduct[] = [];
  expiryFilter = '7';
  expToday = 0;
  exp1to3 = 0;
  exp4to7 = 0;

  // ── movements ─────────────────────────────────────────
  movements: StockMovement[] = [];
  movementTypeFilter = '';

  // ── low stock ──────────────────────────────────────────
  lowStockProducts: StockProduct[] = [];

  private api = (window as any).electronAPI;

  constructor(
    private router: Router,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {}

  async ngOnInit() {
    const session = this.authService.getSession();
    if (!session) {
      this.router.navigate(['/login']);
      return;
    }
    this.companyId = session.company.id;
    this.branchId = session.branch?.id ?? null;
    await this.loadAll();
  }

  // ── loaders ────────────────────────────────────────────
  async loadAll() {
    await Promise.all([
      this.loadStats(),
      this.loadProducts(),
      this.loadSuppliers(),
      this.loadPurchaseOrders(),
      this.loadExpiry(),
      this.loadMovements(),
      this.loadRecentAdjustments(),
    ]);
  }

  async loadStats() {
    try {
      const s = await this.api.inventory.getStats(this.companyId);
      this.zone.run(() => {
        this.stats = s;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadStats', e);
    }
  }

  async loadProducts() {
    try {
      const rows: StockProduct[] = await this.api.products.getAll({ companyId: this.companyId });
      this.zone.run(() => {
        this.products = rows;
        this.categories = ['', ...new Set(rows.map((p) => p.CategoryName).filter(Boolean))];
        this.filterProducts();
        this.lowStockProducts = rows.filter((p) => p.StockQty <= p.LowStockThreshold);
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadProducts', e);
    }
  }

  async loadSuppliers() {
    try {
      const rows = await this.api.inventory.getSuppliers(this.companyId);
      this.zone.run(() => {
        this.suppliers = rows;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadSuppliers', e);
    }
  }

  async loadPurchaseOrders() {
    try {
      const rows = await this.api.inventory.getPurchaseOrders(this.companyId);
      this.zone.run(() => {
        this.purchaseOrders = rows;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadPurchaseOrders', e);
    }
  }

  async loadExpiry() {
    try {
      const rows: ExpiryProduct[] = await this.api.inventory.getExpiryProducts(
        this.companyId,
        parseInt(this.expiryFilter),
      );
      this.zone.run(() => {
        this.expiryProducts = rows;
        this.expToday = rows.filter((p) => p.DaysLeft === 0).length;
        this.exp1to3 = rows.filter((p) => p.DaysLeft >= 1 && p.DaysLeft <= 3).length;
        this.exp4to7 = rows.filter((p) => p.DaysLeft >= 4 && p.DaysLeft <= 7).length;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadExpiry', e);
    }
  }

  async loadMovements() {
    try {
      const rows = await this.api.inventory.getMovements(
        this.companyId,
        this.movementTypeFilter || null,
      );
      this.zone.run(() => {
        this.movements = rows;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadMovements', e);
    }
  }

  async loadRecentAdjustments() {
    try {
      const rows = await this.api.inventory.getMovements(this.companyId, 'Adjustment');
      this.zone.run(() => {
        this.recentAdjustments = rows.slice(0, 10);
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadRecentAdjustments', e);
    }
  }

  // ── navigation ─────────────────────────────────────────
  setView(v: InventoryView) {
    this.view = v;
    this.cdr.detectChanges();
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  // ── stock filter ───────────────────────────────────────
  filterProducts() {
    const q = this.stockSearch.toLowerCase();
    this.filteredProducts = this.products.filter((p) => {
      const matchQ = !q || p.Name.toLowerCase().includes(q);
      const matchCat = !this.stockCategoryFilter || p.CategoryName === this.stockCategoryFilter;
      const matchSt =
        !this.stockStatusFilter ||
        (this.stockStatusFilter === 'ok' && p.StockQty > p.LowStockThreshold) ||
        (this.stockStatusFilter === 'low' && p.StockQty > 0 && p.StockQty <= p.LowStockThreshold) ||
        (this.stockStatusFilter === 'out' && p.StockQty <= 0);
      return matchQ && matchCat && matchSt;
    });
  }

  // ── stock helpers ──────────────────────────────────────
  stockBarWidth(p: StockProduct): number {
    if (!p.LowStockThreshold) return 100;
    return Math.min(100, Math.round((p.StockQty / (p.LowStockThreshold * 2)) * 100));
  }

  stockBarColor(p: StockProduct): string {
    if (p.StockQty <= 0) return '#E24B4A';
    if (p.StockQty <= p.LowStockThreshold) return '#EF9F27';
    return '#97C459';
  }

  stockStatus(p: StockProduct): 'out' | 'low' | 'ok' {
    if (p.StockQty <= 0) return 'out';
    if (p.StockQty <= p.LowStockThreshold) return 'low';
    return 'ok';
  }

  shortage(p: StockProduct): number {
    return Math.max(0, p.LowStockThreshold - p.StockQty);
  }

  expiryClass(daysLeft: number): string {
    if (daysLeft === 0) return 'today';
    if (daysLeft <= 3) return 'soon';
    return 'ok';
  }

  expiryLabel(daysLeft: number): string {
    if (daysLeft === 0) return 'Today';
    if (daysLeft === 1) return '1 day';
    return `${daysLeft} days`;
  }

  // ── adjustment ─────────────────────────────────────────
  adjSuccess = false;

  async saveAdjustment() {
    if (!this.adjForm.productId || !this.adjForm.qty) return;
    this.adjSaving = true;
    this.adjSuccess = false;
    this.cdr.detectChanges();

    try {
      const qty =
        this.adjForm.type === 'remove' ? -Math.abs(this.adjForm.qty) : Math.abs(this.adjForm.qty);

      const result = await this.api.products.adjustStock(
        this.adjForm.productId,
        qty,
        `${this.adjForm.reason}${this.adjForm.note ? ' — ' + this.adjForm.note : ''}`,
        this.companyId,
      );

      console.log('adjustStock result:', result);

      // Reset form immediately
      this.adjForm = {
        productId: null,
        type: 'add',
        qty: 0,
        reason: 'Stock count correction',
        note: '',
      };
      this.adjSuccess = true;
      this.adjSaving = false; // ← reset here, not just in finally
      this.cdr.detectChanges();

      // Reload data
      await Promise.all([this.loadProducts(), this.loadRecentAdjustments(), this.loadStats()]);

      setTimeout(() => {
        this.adjSuccess = false;
        this.cdr.detectChanges();
      }, 2000);
    } catch (e: any) {
      console.error('saveAdjustment error:', e);
      this.adjSaving = false;
      this.cdr.detectChanges();
    }
  }
  // ── purchase order ─────────────────────────────────────
  get poTotal(): number {
    return this.poItems.reduce((s, i) => s + i.qty * i.unitCost, 0);
  }

  addPoItem() {
    this.poItems.push({ productId: null, productName: '', qty: 1, unitCost: 0 });
  }

  removePoItem(index: number) {
    this.poItems.splice(index, 1);
  }

  onPoProductChange(index: number) {
    const p = this.products.find((x) => x.Id === this.poItems[index].productId);
    if (p) {
      this.poItems[index].productName = p.Name;
      this.poItems[index].unitCost = p.Price;
    }
    this.cdr.detectChanges();
  }

  async submitPo(status: 'draft' | 'pending') {
    if (!this.poForm.supplierId || !this.poItems.length) return;
    this.poSaving = true;
    try {
      await this.api.inventory.createPurchaseOrder({
        companyId: this.companyId,
        branchId: this.branchId,
        supplierId: this.poForm.supplierId,
        invoiceNumber: this.poForm.invoiceNumber,
        expectedDate: this.poForm.expectedDate,
        notes: this.poForm.notes,
        status,
        items: this.poItems.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          unitCost: i.unitCost,
          total: i.qty * i.unitCost,
        })),
      });
      this.poForm = { supplierId: null, invoiceNumber: '', expectedDate: '', notes: '' };
      this.poItems = [{ productId: null, productName: '', qty: 1, unitCost: 0 }];
      this.showPoForm = false;
      await Promise.all([this.loadPurchaseOrders(), this.loadStats()]);
    } catch (e) {
      console.error('submitPo', e);
    } finally {
      this.poSaving = false;
      this.cdr.detectChanges();
    }
  }

  async receivePo(id: number) {
    try {
      await this.api.inventory.receivePurchaseOrder(id, this.companyId);
      await Promise.all([
        this.loadPurchaseOrders(),
        this.loadProducts(),
        this.loadStats(),
        this.loadMovements(),
      ]);
    } catch (e) {
      console.error('receivePo', e);
    }
  }

  // ── expiry filter ──────────────────────────────────────
  async onExpiryFilterChange() {
    await this.loadExpiry();
  }

  // ── movement filter ────────────────────────────────────
  async onMovementFilterChange() {
    await this.loadMovements();
  }

  // ── export ─────────────────────────────────────────────
  async exportMovements() {
    try {
      await this.api.inventory.exportMovements(this.companyId);
    } catch (e) {
      console.error('exportMovements', e);
    }
  }

  daysUntil(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  bd(n: number): string {
    return 'BD ' + n.toFixed(3);
  }
}
// NOTE: add this method to the Inventory class (before the closing brace)
// daysUntil(dateStr: string): number {
//   const diff = new Date(dateStr).getTime() - Date.now();
//   return Math.floor(diff / (1000 * 60 * 60 * 24));
// }
