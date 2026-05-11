import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Header } from '../../shared/header/header';

export type ReceiptsView = 'list' | 'detail' | 'summary';

export interface Receipt {
  Id: number;
  SaleDate: string;
  CreatedAt: string;
  CustomerName: string | null;
  CustomerPhone: string | null;
  PayMethod: string;
  Subtotal: number;
  Discount: number;
  Total: number;
  CashAmount: number;
  CardAmount: number;
  Change: number;
  Note: string | null;
  ItemCount: number;
  RefundFor: number | null;
}

export interface ReceiptDetail extends Receipt {
  CustomerEmail: string | null;
  CompanyName: string;
  CompanyAddress: string;
  CompanyPhone: string;
  CompanyVAT: string;
  items: ReceiptItem[];
}

export interface ReceiptItem {
  Id: number;
  ProductId: number;
  ProductName: string;
  Barcode: string;
  Qty: number;
  Price: number;
  Discount: number;
  Total: number;
  VATRate: number;
}

export interface ReceiptStats {
  totalCount: number;
  totalRevenue: number;
  avgSale: number;
  totalDiscount: number;
  refundCount: number;
  refundAmount: number;
  byMethod: { PayMethod: string; n: number; total: number }[];
}

export interface DailySummary {
  date: string;
  count: number;
  revenue: number;
  discount: number;
  avgSale: number;
}

@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [CommonModule, FormsModule, Header],
  templateUrl: './receipts.html',
  styleUrl: './receipts.scss',
})
export class Receipts implements OnInit {
  view: ReceiptsView = 'list';

  // ── session ────────────────────────────────────────────
  companyId: number | null = null;

  // ── list state ─────────────────────────────────────────
  receipts: Receipt[] = [];
  totalReceipts = 0;
  page = 1;
  pageSize = 30;
  isLoading = false;

  // ── filters ────────────────────────────────────────────
  search = '';
  dateFrom = '';
  dateTo = '';
  payMethodFilter = '';
  minTotal: number | null = null;
  maxTotal: number | null = null;

  // ── detail ─────────────────────────────────────────────
  selectedReceipt: ReceiptDetail | null = null;
  detailLoading = false;

  // ── stats ──────────────────────────────────────────────
  stats: ReceiptStats = {
    totalCount: 0,
    totalRevenue: 0,
    avgSale: 0,
    totalDiscount: 0,
    refundCount: 0,
    refundAmount: 0,
    byMethod: [],
  };

  // ── daily summary ──────────────────────────────────────
  dailySummary: DailySummary[] = [];

  // ── void confirmation ──────────────────────────────────
  voidTarget: Receipt | null = null;
  voidConfirmText = '';
  voidSaving = false;

  // ── date preset ────────────────────────────────────────
  datePreset = 'today';

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
    this.applyPreset('today');
    await this.loadAll();
  }

  // ── loaders ────────────────────────────────────────────
  async loadAll() {
    await Promise.all([this.loadReceipts(), this.loadStats(), this.loadDailySummary()]);
  }

  async loadReceipts() {
    this.isLoading = true;
    this.cdr.detectChanges();
    try {
      const result = await this.api.receipts.getAll({
        companyId: this.companyId,
        page: this.page,
        pageSize: this.pageSize,
        search: this.search,
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
        payMethod: this.payMethodFilter,
        minTotal: this.minTotal,
        maxTotal: this.maxTotal,
      });
      this.zone.run(() => {
        this.receipts = result.rows;
        this.totalReceipts = result.total;
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadReceipts', e);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async loadStats() {
    try {
      const s = await this.api.receipts.getStats({
        companyId: this.companyId,
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
      });
      this.zone.run(() => {
        this.stats = s;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadStats', e);
    }
  }

  async loadDailySummary() {
    try {
      const rows = await this.api.receipts.getDailySummary({
        companyId: this.companyId,
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
      });
      this.zone.run(() => {
        this.dailySummary = rows;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadDailySummary', e);
    }
  }

  // ── view receipt detail ────────────────────────────────
  async openDetail(receipt: Receipt) {
    this.detailLoading = true;
    this.view = 'detail';
    this.cdr.detectChanges();
    try {
      const detail = await this.api.receipts.getById(receipt.Id);
      this.zone.run(() => {
        this.selectedReceipt = detail;
        this.detailLoading = false;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('openDetail', e);
      this.detailLoading = false;
    }
  }

  closeDetail() {
    this.view = 'list';
    this.selectedReceipt = null;
    this.cdr.detectChanges();
  }

  // ── filters ────────────────────────────────────────────
  applyPreset(preset: string) {
    this.datePreset = preset;
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      this.dateFrom = fmt(today);
      this.dateTo = fmt(today);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      this.dateFrom = fmt(y);
      this.dateTo = fmt(y);
    } else if (preset === 'week') {
      const w = new Date(today);
      w.setDate(w.getDate() - 6);
      this.dateFrom = fmt(w);
      this.dateTo = fmt(today);
    } else if (preset === 'month') {
      this.dateFrom = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      this.dateTo = fmt(today);
    } else if (preset === 'custom') {
      // keep existing dateFrom/dateTo
    }
  }

  async applyFilters() {
    this.page = 1;
    await this.loadAll();
  }

  async resetFilters() {
    this.search = '';
    this.payMethodFilter = '';
    this.minTotal = null;
    this.maxTotal = null;
    this.datePreset = 'today';
    this.applyPreset('today');
    this.page = 1;
    await this.loadAll();
  }

  async nextPage() {
    if (this.page * this.pageSize < this.totalReceipts) {
      this.page++;
      await this.loadReceipts();
    }
  }

  async prevPage() {
    if (this.page > 1) {
      this.page--;
      await this.loadReceipts();
    }
  }

  // ── void receipt ───────────────────────────────────────
  promptVoid(r: Receipt) {
    this.voidTarget = r;
    this.voidConfirmText = '';
  }

  cancelVoid() {
    this.voidTarget = null;
    this.voidConfirmText = '';
  }

  async confirmVoid() {
    if (!this.voidTarget || this.voidConfirmText !== 'VOID') return;
    this.voidSaving = true;
    try {
      await this.api.receipts.void(this.voidTarget.Id, this.companyId);
      this.voidTarget = null;
      this.voidConfirmText = '';
      await this.loadAll();
    } catch (e) {
      console.error('confirmVoid', e);
    } finally {
      this.voidSaving = false;
      this.cdr.detectChanges();
    }
  }

  // ── print ──────────────────────────────────────────────
  async printReceipt(saleId: number) {
    try {
      await this.api.checkout.printReceipt(saleId);
    } catch (e) {
      console.error('printReceipt', e);
    }
  }

  // ── export CSV ─────────────────────────────────────────
  async exportCSV() {
    try {
      const result = await this.api.receipts.exportCSV(this.companyId, this.dateFrom, this.dateTo);
      if (result.success) {
        const blob = new Blob([result.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipts-${this.dateFrom}-to-${this.dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('exportCSV', e);
    }
  }

  // ── helpers ────────────────────────────────────────────
  setView(v: ReceiptsView) {
    this.view = v;
    if (v === 'list') this.selectedReceipt = null;
    this.cdr.detectChanges();
  }

  bd(n: number): string {
    return 'BD ' + (n || 0).toFixed(3);
  }

  get totalPages(): number {
    return Math.ceil(this.totalReceipts / this.pageSize);
  }

  payMethodLabel(m: string): string {
    const map: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      split: 'Split',
      online: 'Online',
    };
    return map[m] || m;
  }

  payMethodIcon(m: string): string {
    return m === 'cash' ? '💵' : m === 'card' ? '💳' : m === 'split' ? '⚡' : '🌐';
  }

  receiptLabel(r: Receipt): string {
    return `#${String(r.Id).padStart(5, '0')}`;
  }

  maxRevenue(): number {
    return Math.max(...this.dailySummary.map((d) => d.revenue), 1);
  }

  vatAmount(item: ReceiptItem): number {
    const rate = item.VATRate || 0;
    return item.Total * (rate / (100 + rate));
  }

  receiptVATTotal(): number {
    if (!this.selectedReceipt) return 0;
    return this.selectedReceipt.items.reduce((s, i) => s + this.vatAmount(i), 0);
  }
}
