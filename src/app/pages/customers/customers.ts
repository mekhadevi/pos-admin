import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Header } from '../../shared/header/header';

export type CustomerView = 'overview' | 'list' | 'add' | 'detail' | 'loyalty';

export interface Customer {
  Id: number;
  CompanyId: number;
  Name: string;
  Phone: string | null;
  Email: string | null;
  Address: string | null;
  LoyaltyPoints: number;
  TotalSpent: number;
  TotalOrders: number;
  Notes: string | null;
  CreatedAt: string;
}

export interface CustomerStats {
  total: number;
  newThisMonth: number;
  topSpender: { Name: string; TotalSpent: number } | null;
  totalRevenue: number;
  withLoyalty: number;
}

export interface SaleHistory {
  Id: number;
  SaleDate: string;
  Total: number;
  Subtotal: number;
  Discount: number;
  PayMethod: string;
  ItemCount: number;
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, Header],
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
})
export class Customers implements OnInit {
  view: CustomerView = 'overview';

  // ── session ────────────────────────────────────────────
  companyId: number | null = null;
  branchId: number | null = null;

  // ── stats ──────────────────────────────────────────────
  stats: CustomerStats = {
    total: 0,
    newThisMonth: 0,
    topSpender: null,
    totalRevenue: 0,
    withLoyalty: 0,
  };

  // ── list ───────────────────────────────────────────────
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  searchQuery = '';
  sortField = 'Name';
  sortDir: 'asc' | 'desc' = 'asc';

  // ── add / edit form ────────────────────────────────────
  formMode: 'add' | 'edit' = 'add';
  form = this.emptyForm();
  formSaving = false;
  formSuccess = false;
  formError = '';

  // ── detail / history ───────────────────────────────────
  selectedCustomer: Customer | null = null;
  saleHistory: SaleHistory[] = [];
  historyLoading = false;

  // ── loyalty adjustment ─────────────────────────────────
  loyaltyDelta = 0;
  loyaltyNote = '';
  loyaltySaving = false;
  loyaltySuccess = false;

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
    await Promise.all([this.loadStats(), this.loadCustomers()]);
  }

  async loadStats() {
    try {
      const s = await this.api.customers.getStats(this.companyId);
      this.zone.run(() => {
        this.stats = s;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadStats', e);
    }
  }

  async loadCustomers() {
    try {
      const rows: Customer[] = await this.api.customers.getAll(this.companyId);
      this.zone.run(() => {
        this.customers = rows;
        this.applyFilter();
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadCustomers', e);
    }
  }

  async loadHistory(customerId: number) {
    this.historyLoading = true;
    try {
      const rows = await this.api.customers.getHistory(customerId);
      this.zone.run(() => {
        this.saleHistory = rows;
        this.historyLoading = false;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadHistory', e);
      this.historyLoading = false;
    }
  }

  // ── navigation ─────────────────────────────────────────
  setView(v: CustomerView) {
    this.view = v;
    this.cdr.detectChanges();
  }

  openAdd() {
    this.formMode = 'add';
    this.form = this.emptyForm();
    this.formError = '';
    this.formSuccess = false;
    this.setView('add');
  }

  openEdit(c: Customer) {
    this.formMode = 'edit';
    this.form = {
      id: c.Id,
      name: c.Name,
      phone: c.Phone ?? '',
      email: c.Email ?? '',
      address: c.Address ?? '',
      notes: c.Notes ?? '',
    };
    this.formError = '';
    this.setView('add');
  }

  async openDetail(c: Customer) {
    this.selectedCustomer = c;
    this.loyaltyDelta = 0;
    this.loyaltyNote = '';
    this.loyaltySuccess = false;
    this.setView('detail');
    await this.loadHistory(c.Id);
  }

  // ── filter / sort ──────────────────────────────────────
  applyFilter() {
    const q = this.searchQuery.toLowerCase();
    let list = this.customers.filter(
      (c) =>
        !q ||
        c.Name.toLowerCase().includes(q) ||
        (c.Phone ?? '').toLowerCase().includes(q) ||
        (c.Email ?? '').toLowerCase().includes(q),
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
    this.filteredCustomers = list;
  }

  sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
    this.applyFilter();
  }

  // ── save customer ──────────────────────────────────────
  async saveCustomer() {
    if (!this.form.name.trim()) {
      this.formError = 'Name is required.';
      return;
    }
    this.formSaving = true;
    this.formError = '';
    this.formSuccess = false;
    this.cdr.detectChanges();

    try {
      let result: any;
      if (this.formMode === 'add') {
        result = await this.api.customers.create({
          companyId: this.companyId,
          branchId: this.branchId,
          name: this.form.name.trim(),
          phone: this.form.phone.trim() || null,
          email: this.form.email.trim() || null,
          address: this.form.address.trim() || null,
          notes: this.form.notes.trim() || null,
        });
      } else {
        result = await this.api.customers.update(this.form.id, {
          name: this.form.name.trim(),
          phone: this.form.phone.trim() || null,
          email: this.form.email.trim() || null,
          address: this.form.address.trim() || null,
          notes: this.form.notes.trim() || null,
        });
      }

      if (!result.success) {
        this.formError = result.error ?? 'Something went wrong.';
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
      this.formError = e.message ?? 'Unexpected error.';
      this.formSaving = false;
      this.cdr.detectChanges();
    }
  }

  // ── delete ─────────────────────────────────────────────
  async deleteCustomer(c: Customer) {
    if (!confirm(`Delete "${c.Name}"? This cannot be undone.`)) return;
    try {
      await this.api.customers.delete(c.Id);
      await this.loadAll();
      if (this.view === 'detail') this.setView('list');
    } catch (e) {
      console.error('delete', e);
    }
  }

  // ── loyalty ────────────────────────────────────────────
  async saveLoyalty() {
    if (!this.selectedCustomer || this.loyaltyDelta === 0) return;
    this.loyaltySaving = true;
    this.loyaltySuccess = false;
    this.cdr.detectChanges();
    try {
      await this.api.customers.adjustLoyalty(this.selectedCustomer.Id, this.loyaltyDelta);
      await this.loadCustomers();
      // refresh selectedCustomer reference
      const updated = this.customers.find((c) => c.Id === this.selectedCustomer!.Id);
      if (updated) this.selectedCustomer = updated;
      this.loyaltyDelta = 0;
      this.loyaltyNote = '';
      this.loyaltySuccess = true;
      this.loyaltySaving = false;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.loyaltySuccess = false;
        this.cdr.detectChanges();
      }, 2000);
    } catch (e) {
      this.loyaltySaving = false;
      this.cdr.detectChanges();
    }
  }

  // ── export ─────────────────────────────────────────────
  async exportCSV() {
    try {
      const result = await this.api.customers.export(this.companyId);
      if (!result.success) return;
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('export', e);
    }
  }

  // ── helpers ────────────────────────────────────────────
  emptyForm() {
    return { id: 0, name: '', phone: '', email: '', address: '', notes: '' };
  }

  bd(n: number): string {
    return 'BD ' + (n ?? 0).toFixed(3);
  }

  tierLabel(points: number): string {
    if (points >= 1000) return 'Gold';
    if (points >= 500) return 'Silver';
    if (points >= 100) return 'Bronze';
    return 'Standard';
  }

  tierClass(points: number): string {
    if (points >= 1000) return 'gold';
    if (points >= 500) return 'silver';
    if (points >= 100) return 'bronze';
    return 'standard';
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
    const colors = ['#185fa5', '#0e7c86', '#7c3aed', '#b45309', '#166534', '#9d174d'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }

  sortIcon(field: string): string {
    if (this.sortField !== field) return '↕';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  get currentMonth(): string {
    return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  get loyaltyCustomers(): Customer[] {
    return [...this.customers]
      .filter((c) => c.LoyaltyPoints > 0)
      .sort((a, b) => b.LoyaltyPoints - a.LoyaltyPoints);
  }

  get goldCount(): number {
    return this.customers.filter((c) => c.LoyaltyPoints >= 1000).length;
  }
  get silverCount(): number {
    return this.customers.filter((c) => c.LoyaltyPoints >= 500 && c.LoyaltyPoints < 1000).length;
  }
  get bronzeCount(): number {
    return this.customers.filter((c) => c.LoyaltyPoints >= 100 && c.LoyaltyPoints < 500).length;
  }

  topBySpend(n = 8): Customer[] {
    return [...this.customers].sort((a, b) => b.TotalSpent - a.TotalSpent).slice(0, n);
  }
}
