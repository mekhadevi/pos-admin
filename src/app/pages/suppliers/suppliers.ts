import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Header } from '../../shared/header/header';

export type SupplierView =
  | 'overview'
  | 'list'
  | 'add'
  | 'detail'
  | 'orders'
  | 'payments'
  | 'products';

export interface Supplier {
  Id: number;
  CompanyId: number;
  Name: string;
  Phone: string | null;
  Phone2: string | null;
  Email: string | null;
  Address: string | null;
  ContactPerson: string | null;
  Website: string | null;
  WhatsApp: string | null;
  PaymentTerms: string | null;
  LeadTimeDays: number | null;
  Currency: string;
  Notes: string | null;
  IsDeleted: number;
  CreatedAt: string;
  // aggregated
  TotalOrders: number;
  TotalValue: number;
  LastOrderAt: string | null;
  PendingOrders: number;
  ReceivedOrders: number;
  OutstandingBalance: number;
}

export interface SupplierStats {
  total: number;
  activeThisMonth: number;
  totalSpend: number;
  pendingOrders: number;
  pendingValue: number;
  totalPaid: number;
  totalOutstanding: number;
  topSupplier: { Name: string; TotalValue: number } | null;
}

export interface SupplierPO {
  Id: number;
  PoNumber: string;
  InvoiceNumber: string | null;
  TotalAmount: number;
  AmountPaid: number;
  Status: string;
  ExpectedDate: string | null;
  ReceivedAt: string | null;
  CreatedAt: string;
  ItemCount: number;
  Notes: string | null;
}

export interface SupplierProduct {
  Id: number;
  Name: string;
  SKU: string | null;
  Barcode: string | null;
  SalePrice: number;
  StockQty: number;
  LowStockThreshold: number;
  CategoryName: string | null;
  OrderCount: number;
  TotalQtyOrdered: number;
  MinUnitCost: number;
  MaxUnitCost: number;
  AvgUnitCost: number;
  LastOrdered: string;
}

export interface SupplierPayment {
  Id: number;
  SupplierId: number;
  PurchaseOrderId: number | null;
  PoNumber: string | null;
  Amount: number;
  Method: string;
  Reference: string | null;
  Note: string | null;
  PaidAt: string;
}

export interface SupplierBalance {
  totalOrdered: number;
  totalPending: number;
  totalReceived: number;
  totalPaid: number;
  outstanding: number;
  poBreakdown: {
    Id: number;
    PoNumber: string;
    TotalAmount: number;
    AmountPaid: number;
    Balance: number;
    Status: string;
    CreatedAt: string;
  }[];
}

export interface OutstandingRow {
  Id: number;
  Name: string;
  Phone: string | null;
  Email: string | null;
  ContactPerson: string | null;
  PendingValue: number;
  TotalPaid: number;
  Outstanding: number;
}

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, Header],
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.scss',
})
export class Suppliers implements OnInit {
  view: SupplierView = 'overview';

  // ── session ────────────────────────────────────────────
  companyId: number | null = null;
  branchId: number | null = null;

  // ── stats ──────────────────────────────────────────────
  stats: SupplierStats = {
    total: 0,
    activeThisMonth: 0,
    totalSpend: 0,
    pendingOrders: 0,
    pendingValue: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    topSupplier: null,
  };

  // ── list ───────────────────────────────────────────────
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  searchQuery = '';
  sortField = 'Name';
  sortDir: 'asc' | 'desc' = 'asc';

  // ── form (add / edit) ──────────────────────────────────
  formMode: 'add' | 'edit' = 'add';
  form = this.emptyForm();
  formSaving = false;
  formSuccess = false;
  formError = '';

  // ── detail ─────────────────────────────────────────────
  selected: Supplier | null = null;
  detailTab: 'orders' | 'products' | 'balance' | 'contact' = 'orders';
  supplierPOs: SupplierPO[] = [];
  supplierProducts: SupplierProduct[] = [];
  supplierPayments: SupplierPayment[] = [];
  balance: SupplierBalance = {
    totalOrdered: 0,
    totalPending: 0,
    totalReceived: 0,
    totalPaid: 0,
    outstanding: 0,
    poBreakdown: [],
  };
  detailLoading = false;

  // ── payment form ───────────────────────────────────────
  payForm = this.emptyPayForm();
  payFormOpen = false;
  paySaving = false;
  paySuccess = false;
  payError = '';

  // ── all orders view ────────────────────────────────────
  allOrders: (SupplierPO & { SupplierName: string })[] = [];
  orderStatusFilter = '';
  orderSearch = '';
  ordersLoading = false;

  // ── payments view ──────────────────────────────────────
  outstandingRows: OutstandingRow[] = [];
  paymentsLoading = false;

  // ── products view ──────────────────────────────────────
  allSupplierProducts: (SupplierProduct & { SupplierName: string; SupplierId: number })[] = [];
  productSearch = '';
  productStockFilter = '';
  productsLoading = false;

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

  // ════════════════════════════════════════════════════════
  // LOADERS
  // ════════════════════════════════════════════════════════
  async loadAll() {
    await Promise.all([this.loadStats(), this.loadSuppliers()]);
  }

  async loadStats() {
    try {
      const s = await this.api.suppliers.getStats(this.companyId);
      this.zone.run(() => {
        this.stats = s;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadStats', e);
    }
  }

  async loadSuppliers() {
    try {
      const rows: Supplier[] = await this.api.suppliers.getAll(this.companyId);
      this.zone.run(() => {
        this.suppliers = rows;
        this.applyFilter();
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadSuppliers', e);
    }
  }

  async loadDetailData(s: Supplier) {
    this.detailLoading = true;
    try {
      const [pos, prods, pays, bal] = await Promise.all([
        this.api.suppliers.getPurchaseOrders(s.Id, this.companyId),
        this.api.suppliers.getProducts(s.Id, this.companyId),
        this.api.suppliers.getPayments(s.Id, this.companyId),
        this.api.suppliers.getBalance(s.Id, this.companyId),
      ]);
      this.zone.run(() => {
        this.supplierPOs = pos;
        this.supplierProducts = prods;
        this.supplierPayments = pays;
        this.balance = bal;
        this.detailLoading = false;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadDetailData', e);
      this.detailLoading = false;
    }
  }

  async loadAllOrders() {
    this.ordersLoading = true;
    try {
      const all: any[] = [];
      for (const s of this.suppliers) {
        const pos = await this.api.suppliers.getPurchaseOrders(s.Id, this.companyId);
        pos.forEach((po: any) => all.push({ ...po, SupplierName: s.Name }));
      }
      all.sort((a, b) => b.CreatedAt.localeCompare(a.CreatedAt));
      this.zone.run(() => {
        this.allOrders = all;
        this.ordersLoading = false;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadAllOrders', e);
      this.ordersLoading = false;
    }
  }

  async loadOutstanding() {
    this.paymentsLoading = true;
    try {
      const rows = await this.api.suppliers.getOutstandingAll(this.companyId);
      this.zone.run(() => {
        this.outstandingRows = rows;
        this.paymentsLoading = false;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadOutstanding', e);
      this.paymentsLoading = false;
    }
  }

  async loadAllProducts() {
    this.productsLoading = true;
    try {
      const rows = await this.api.suppliers.getAllProducts(this.companyId);
      this.zone.run(() => {
        this.allSupplierProducts = rows;
        this.productsLoading = false;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadAllProducts', e);
      this.productsLoading = false;
    }
  }

  // ════════════════════════════════════════════════════════
  // NAVIGATION
  // ════════════════════════════════════════════════════════
  async setView(v: SupplierView) {
    this.view = v;
    if (v === 'orders') await this.loadAllOrders();
    if (v === 'payments') await this.loadOutstanding();
    if (v === 'products') await this.loadAllProducts();
    this.cdr.detectChanges();
  }

  openAdd() {
    this.formMode = 'add';
    this.form = this.emptyForm();
    this.formError = '';
    this.formSuccess = false;
    this.setView('add');
  }

  openEdit(s: Supplier) {
    this.formMode = 'edit';
    this.form = {
      id: s.Id,
      name: s.Name,
      phone: s.Phone ?? '',
      phone2: s.Phone2 ?? '',
      email: s.Email ?? '',
      address: s.Address ?? '',
      contactPerson: s.ContactPerson ?? '',
      website: s.Website ?? '',
      whatsApp: s.WhatsApp ?? '',
      paymentTerms: s.PaymentTerms ?? '',
      leadTimeDays: s.LeadTimeDays ?? null,
      currency: s.Currency ?? 'BHD',
      notes: s.Notes ?? '',
    };
    this.formError = '';
    this.formSuccess = false;
    this.setView('add');
  }

  async openDetail(s: Supplier) {
    this.selected = s;
    this.detailTab = 'orders';
    this.supplierPOs = [];
    this.supplierProducts = [];
    this.supplierPayments = [];
    this.payFormOpen = false;
    this.payForm = this.emptyPayForm();
    this.setView('detail');
    await this.loadDetailData(s);
  }

  // ════════════════════════════════════════════════════════
  // FILTER / SORT
  // ════════════════════════════════════════════════════════
  applyFilter() {
    const q = this.searchQuery.toLowerCase();
    let list = this.suppliers.filter(
      (s) =>
        !q ||
        s.Name.toLowerCase().includes(q) ||
        (s.Phone ?? '').includes(q) ||
        (s.Email ?? '').toLowerCase().includes(q) ||
        (s.ContactPerson ?? '').toLowerCase().includes(q),
    );
    list = list.sort((a, b) => {
      const av = (a as any)[this.sortField] ?? '';
      const bv = (b as any)[this.sortField] ?? '';
      return this.sortDir === 'asc'
        ? av > bv
          ? 1
          : av < bv
            ? -1
            : 0
        : av < bv
          ? 1
          : av > bv
            ? -1
            : 0;
    });
    this.filteredSuppliers = list;
  }

  sortBy(field: string) {
    this.sortDir = this.sortField === field ? (this.sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    this.sortField = field;
    this.applyFilter();
  }

  get filteredAllOrders() {
    const q = this.orderSearch.toLowerCase();
    return this.allOrders.filter(
      (o) =>
        (!this.orderStatusFilter || o.Status === this.orderStatusFilter) &&
        (!q ||
          o.PoNumber.toLowerCase().includes(q) ||
          (o as any).SupplierName.toLowerCase().includes(q)),
    );
  }

  get filteredAllProducts() {
    const q = this.productSearch.toLowerCase();
    return this.allSupplierProducts.filter((p) => {
      const matchQ =
        !q ||
        p.Name.toLowerCase().includes(q) ||
        (p.SKU ?? '').toLowerCase().includes(q) ||
        (p as any).SupplierName.toLowerCase().includes(q);
      const matchS =
        !this.productStockFilter ||
        (this.productStockFilter === 'out' && p.StockQty <= 0) ||
        (this.productStockFilter === 'low' &&
          p.StockQty > 0 &&
          p.StockQty <= p.LowStockThreshold) ||
        (this.productStockFilter === 'ok' && p.StockQty > p.LowStockThreshold);
      return matchQ && matchS;
    });
  }

  // ════════════════════════════════════════════════════════
  // SAVE SUPPLIER
  // ════════════════════════════════════════════════════════
  async saveSupplier() {
    if (!this.form.name.trim()) {
      this.formError = 'Supplier name is required.';
      return;
    }
    this.formSaving = true;
    this.formError = '';
    this.formSuccess = false;
    this.cdr.detectChanges();
    try {
      const payload = {
        name: this.form.name.trim(),
        phone: this.form.phone.trim() || null,
        phone2: this.form.phone2.trim() || null,
        email: this.form.email.trim() || null,
        address: this.form.address.trim() || null,
        contactPerson: this.form.contactPerson.trim() || null,
        website: this.form.website.trim() || null,
        whatsApp: this.form.whatsApp.trim() || null,
        paymentTerms: this.form.paymentTerms.trim() || null,
        leadTimeDays: this.form.leadTimeDays || null,
        currency: this.form.currency || 'BHD',
        notes: this.form.notes.trim() || null,
      };

      const result =
        this.formMode === 'add'
          ? await this.api.suppliers.create({
              companyId: this.companyId,
              branchId: this.branchId,
              ...payload,
            })
          : await this.api.suppliers.update(this.form.id, payload);

      if (!result.success) {
        this.formError = result.error ?? 'Error saving.';
        this.formSaving = false;
        this.cdr.detectChanges();
        return;
      }

      this.formSuccess = true;
      this.formSaving = false;
      this.cdr.detectChanges();
      await this.loadAll();
      setTimeout(() => {
        this.formSuccess = false;
        this.setView('list');
        this.cdr.detectChanges();
      }, 1200);
    } catch (e: any) {
      this.formError = e.message;
      this.formSaving = false;
      this.cdr.detectChanges();
    }
  }

  async deleteSupplier(s: Supplier) {
    if (!confirm(`Delete "${s.Name}"? This cannot be undone.`)) return;
    const result = await this.api.suppliers.delete(s.Id);
    if (!result.success) {
      alert(result.error);
      return;
    }
    await this.loadAll();
    if (this.view === 'detail') this.setView('list');
  }

  // ════════════════════════════════════════════════════════
  // PAYMENTS
  // ════════════════════════════════════════════════════════
  togglePayForm() {
    this.payFormOpen = !this.payFormOpen;
    if (!this.payFormOpen) {
      this.payForm = this.emptyPayForm();
      this.payError = '';
    }
    this.cdr.detectChanges();
  }

  async savePayment() {
    if (!this.payForm.amount || this.payForm.amount <= 0) {
      this.payError = 'Enter a valid amount.';
      return;
    }
    this.paySaving = true;
    this.payError = '';
    this.paySuccess = false;
    this.cdr.detectChanges();
    try {
      const result = await this.api.suppliers.recordPayment({
        companyId: this.companyId,
        supplierId: this.selected!.Id,
        purchaseOrderId: this.payForm.purchaseOrderId || null,
        amount: this.payForm.amount,
        method: this.payForm.method,
        reference: this.payForm.reference || null,
        note: this.payForm.note || null,
        paidAt: this.payForm.paidAt,
      });
      if (!result.success) {
        this.payError = result.error ?? 'Error.';
        this.paySaving = false;
        this.cdr.detectChanges();
        return;
      }
      this.paySuccess = true;
      this.paySaving = false;
      this.payForm = this.emptyPayForm();
      this.payFormOpen = false;
      this.cdr.detectChanges();
      await this.loadDetailData(this.selected!);
      await Promise.all([this.loadStats(), this.loadSuppliers()]);
      setTimeout(() => {
        this.paySuccess = false;
        this.cdr.detectChanges();
      }, 2000);
    } catch (e: any) {
      this.payError = e.message;
      this.paySaving = false;
      this.cdr.detectChanges();
    }
  }

  async deletePayment(id: number) {
    if (!confirm('Delete this payment record?')) return;
    await this.api.suppliers.deletePayment(id);
    await this.loadDetailData(this.selected!);
    await Promise.all([this.loadStats(), this.loadSuppliers()]);
  }

  // ════════════════════════════════════════════════════════
  // EXPORT
  // ════════════════════════════════════════════════════════
  async exportCSV() {
    try {
      const result = await this.api.suppliers.export(this.companyId);
      if (!result.success) return;
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `suppliers_${new Date().toISOString().slice(0, 10)}.csv`,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('export', e);
    }
  }

  // ════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════
  emptyForm() {
    return {
      id: 0,
      name: '',
      phone: '',
      phone2: '',
      email: '',
      address: '',
      contactPerson: '',
      website: '',
      whatsApp: '',
      paymentTerms: '',
      leadTimeDays: null as number | null,
      currency: 'BHD',
      notes: '',
    };
  }

  emptyPayForm() {
    return {
      purchaseOrderId: null as number | null,
      amount: 0,
      method: 'bank',
      reference: '',
      note: '',
      paidAt: new Date().toISOString().slice(0, 10),
    };
  }

  bd(n: number): string {
    return 'BD ' + (n ?? 0).toFixed(3);
  }

  sortIcon(f: string): string {
    if (this.sortField !== f) return '↕';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  poStatusClass(s: string): string {
    return (
      (
        {
          received: 'pill-ok',
          pending: 'pill-pending',
          draft: 'pill-draft',
          cancelled: 'pill-cancelled',
        } as any
      )[s] ?? 'pill-draft'
    );
  }

  stockStatus(p: SupplierProduct): 'out' | 'low' | 'ok' {
    if (p.StockQty <= 0) return 'out';
    if (p.StockQty <= p.LowStockThreshold) return 'low';
    return 'ok';
  }

  stockBarWidth(p: SupplierProduct): number {
    if (!p.LowStockThreshold) return 100;
    return Math.min(100, Math.round((p.StockQty / (p.LowStockThreshold * 2)) * 100));
  }

  stockBarColor(p: SupplierProduct): string {
    if (p.StockQty <= 0) return '#E24B4A';
    if (p.StockQty <= p.LowStockThreshold) return '#EF9F27';
    return '#97C459';
  }

  margin(p: SupplierProduct): string {
    if (!p.AvgUnitCost || !p.SalePrice) return '—';
    const m = ((p.SalePrice - p.AvgUnitCost) / p.SalePrice) * 100;
    return m.toFixed(1) + '%';
  }

  marginClass(p: SupplierProduct): string {
    if (!p.AvgUnitCost || !p.SalePrice) return '';
    const m = ((p.SalePrice - p.AvgUnitCost) / p.SalePrice) * 100;
    if (m < 10) return 'margin-low';
    if (m < 25) return 'margin-mid';
    return 'margin-ok';
  }

  payBalanceOnPO(po: SupplierPO): number {
    return Math.max(0, po.TotalAmount - (po.AmountPaid ?? 0));
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  avatarColor(name: string): string {
    const colors = ['#185fa5', '#0e7c86', '#7c3aed', '#b45309', '#166534', '#9d174d', '#0369a1'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }

  get topSuppliersByValue(): Supplier[] {
    return [...this.suppliers].sort((a, b) => b.TotalValue - a.TotalValue).slice(0, 8);
  }

  get currentMonth(): string {
    return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  get outstandingSuppliers(): Supplier[] {
    return this.suppliers
      .filter((s) => s.OutstandingBalance > 0)
      .sort((a, b) => b.OutstandingBalance - a.OutstandingBalance);
  }

  /** Find a supplier by id — used by the "Pay now" button in the payments view */
  getSupplier(id: number): Supplier {
    return this.suppliers.find((s) => s.Id === id)!;
  }
}
