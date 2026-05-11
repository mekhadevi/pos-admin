import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Chart, registerables } from 'chart.js';
import { Header } from '../../shared/header/header';

Chart.register(...registerables);

export type ReportView =
  | 'daily'
  | 'monthly'
  | 'products'
  | 'category'
  | 'vat'
  | 'profit'
  | 'payment'
  | 'users';

export type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, Header],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit, AfterViewInit, OnDestroy {
  view: ReportView = 'daily';
  dateRange: DateRange = 'today';
  dateFrom = '';
  dateTo = '';

  companyId: number | null = null;

  // ── KPI data ─────────────────────────────────────────
  dailyKpis = { sales: 0, transactions: 0, avgBasket: 0, itemsSold: 0 };
  monthlyKpis = { revenue: 0, bestMonth: '', orders: 0, avgMonthly: 0 };
  profitKpis = { revenue: 0, cogs: 0, grossProfit: 0, netProfit: 0 };
  vatKpis = { netSales: 0, vatCollected: 0, gross: 0, vatPct: 0 };
  paymentKpis = { cash: 0, card: 0, credit: 0 };

  // ── Table data ────────────────────────────────────────
  recentTransactions: any[] = [];
  monthlyRows: any[] = [];
  productRows: any[] = [];
  vatRows: any[] = [];
  paymentRows: any[] = [];
  userRows: any[] = [];

  // ── Charts map ────────────────────────────────────────
  private charts: Map<string, Chart> = new Map();

  // ── Blue palette ──────────────────────────────────────
  readonly COLORS = {
    blue1: '#1565C0',
    blue2: '#1E88E5',
    blue3: '#42A5F5',
    blue4: '#90CAF9',
    blue5: '#BBDEFB',
    teal: '#00ACC1',
    cyan: '#26C6DA',
    indigo: '#3949AB',
    green: '#00897B',
    amber: '#FFB300',
    red: '#E53935',
    grid: 'rgba(30,136,229,0.08)',
  };

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

    const today = new Date();
    this.dateTo = today.toISOString().split('T')[0];
    this.dateFrom = today.toISOString().split('T')[0];

    await this.loadView();
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderCharts(), 200);
  }

  ngOnDestroy() {
    this.destroyAllCharts();
  }

  // ── Navigation ────────────────────────────────────────
  async setView(v: ReportView) {
    this.view = v;
    this.destroyAllCharts();
    this.cdr.detectChanges();
    await this.loadView();
    setTimeout(() => this.renderCharts(), 150);
  }

  async setDateRange(r: DateRange) {
    this.dateRange = r;
    const today = new Date();
    this.dateTo = today.toISOString().split('T')[0];
    if (r === 'today') this.dateFrom = this.dateTo;
    if (r === 'week')
      this.dateFrom = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
    if (r === 'month')
      this.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
    if (r === 'year')
      this.dateFrom = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    await this.loadView();
    setTimeout(() => this.renderCharts(), 150);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  // ── Data loading ──────────────────────────────────────
  async loadView() {
    try {
      switch (this.view) {
        case 'daily':
          await this.loadDaily();
          break;
        case 'monthly':
          await this.loadMonthly();
          break;
        case 'products':
          await this.loadProducts();
          break;
        case 'category':
          await this.loadCategory();
          break;
        case 'vat':
          await this.loadVat();
          break;
        case 'profit':
          await this.loadProfit();
          break;
        case 'payment':
          await this.loadPayment();
          break;
        case 'users':
          await this.loadUsers();
          break;
      }
    } catch (e) {
      console.error('loadView', e);
    }
    this.cdr.detectChanges();
  }

  async loadDaily() {
    const d = await this.api.reports.getDaily({ companyId: this.companyId, date: this.dateFrom });
    this.dailyKpis = d.kpis ?? this.dailyKpis;
    this.recentTransactions = d.transactions ?? [];
  }

  async loadMonthly() {
    const d = await this.api.reports.getMonthly({
      companyId: this.companyId,
      year: new Date().getFullYear(),
    });
    this.monthlyKpis = d.kpis ?? this.monthlyKpis;
    this.monthlyRows = d.rows ?? [];
  }

  async loadProducts() {
    const d = await this.api.reports.getProducts({
      companyId: this.companyId,
      from: this.dateFrom,
      to: this.dateTo,
    });
    this.productRows = d.rows ?? [];
  }

  async loadCategory() {
    await this.api.reports.getCategory({
      companyId: this.companyId,
      from: this.dateFrom,
      to: this.dateTo,
    });
  }

  async loadVat() {
    const d = await this.api.reports.getVat({
      companyId: this.companyId,
      from: this.dateFrom,
      to: this.dateTo,
    });
    this.vatKpis = d.kpis ?? this.vatKpis;
    this.vatRows = d.rows ?? [];
  }

  async loadProfit() {
    const d = await this.api.reports.getProfit({
      companyId: this.companyId,
      from: this.dateFrom,
      to: this.dateTo,
    });
    this.profitKpis = d.kpis ?? this.profitKpis;
  }

  async loadPayment() {
    const d = await this.api.reports.getPayment({
      companyId: this.companyId,
      from: this.dateFrom,
      to: this.dateTo,
    });
    this.paymentKpis = d.kpis ?? this.paymentKpis;
    this.paymentRows = d.rows ?? [];
  }

  async loadUsers() {
    const d = await this.api.reports.getUsers({
      companyId: this.companyId,
      from: this.dateFrom,
      to: this.dateTo,
    });
    this.userRows = d.rows ?? [];
  }

  // ── Chart helpers ─────────────────────────────────────
  private destroyAllCharts() {
    this.charts.forEach((c) => c.destroy());
    this.charts.clear();
  }

  private makeChart(id: string, config: any): Chart | null {
    const el = document.getElementById(id) as HTMLCanvasElement;
    if (!el) return null;
    if (this.charts.has(id)) {
      this.charts.get(id)!.destroy();
    }
    const chart = new Chart(el, config);
    this.charts.set(id, chart);
    return chart;
  }

  private get baseOpts(): any {
    const C = this.COLORS;
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: C.grid },
          ticks: { font: { size: 11, family: 'Poppins,sans-serif' }, color: '#78909C' },
        },
        y: {
          grid: { color: C.grid },
          ticks: { font: { size: 11, family: 'Poppins,sans-serif' }, color: '#78909C' },
        },
      },
    };
  }

  renderCharts() {
    const C = this.COLORS;
    switch (this.view) {
      case 'daily':
        this.renderDailyCharts();
        break;
      case 'monthly':
        this.renderMonthlyCharts();
        break;
      case 'products':
        this.renderProductCharts();
        break;
      case 'category':
        this.renderCategoryCharts();
        break;
      case 'vat':
        this.renderVatCharts();
        break;
      case 'profit':
        this.renderProfitCharts();
        break;
      case 'payment':
        this.renderPaymentCharts();
        break;
      case 'users':
        this.renderUserCharts();
        break;
    }
  }

  // ── Per-view chart renderers ──────────────────────────
  renderDailyCharts() {
    const C = this.COLORS;

    this.makeChart('c-hourly', {
      type: 'bar',
      data: {
        labels: ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm'],
        datasets: [
          {
            data: [42, 68, 95, 140, 182, 165, 148, 120, 88, 54],
            backgroundColor: C.blue2,
            borderRadius: 5,
            hoverBackgroundColor: C.blue3,
          },
        ],
      },
      options: {
        ...this.baseOpts,
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#78909C' } },
          y: {
            grid: { color: C.grid },
            ticks: { callback: (v: number) => 'BD ' + v, font: { size: 11 }, color: '#78909C' },
          },
        },
      },
    });

    this.makeChart('c-pay-daily', {
      type: 'doughnut',
      data: {
        labels: ['Cash', 'Card', 'Credit'],
        datasets: [
          {
            data: [55, 35, 10],
            backgroundColor: [C.blue1, C.blue3, C.blue5],
            borderWidth: 3,
            borderColor: '#ffffff',
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '60%',
      },
    });
  }

  renderMonthlyCharts() {
    const C = this.COLORS;
    this.makeChart('c-monthly', {
      type: 'bar',
      data: {
        labels: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ],
        datasets: [
          {
            data: [13916, 11200, 12840, 10284, 0, 0, 0, 0, 0, 0, 0, 0],
            backgroundColor: (ctx: any) => (ctx.dataIndex <= 3 ? C.blue2 : C.blue5),
            borderRadius: 5,
            hoverBackgroundColor: C.blue3,
          },
        ],
      },
      options: {
        ...this.baseOpts,
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#78909C' } },
          y: {
            grid: { color: C.grid },
            ticks: {
              callback: (v: number) => 'BD ' + (v / 1000).toFixed(0) + 'k',
              font: { size: 11 },
              color: '#78909C',
            },
          },
        },
      },
    });
  }

  renderProductCharts() {
    const C = this.COLORS;
    this.makeChart('c-products', {
      type: 'bar',
      data: {
        labels: [
          'Lamb Chops',
          'Almarai Milk',
          'Basmati Rice',
          'Chicken',
          'Olive Oil',
          'Orange Juice',
          'Cheddar',
          'White Bread',
          'Eggs',
          'Water',
        ],
        datasets: [
          {
            data: [858, 562, 245, 218, 196, 168, 142, 118, 96, 54],
            backgroundColor: [
              C.blue1,
              C.blue2,
              C.blue2,
              C.blue2,
              C.blue3,
              C.blue3,
              C.blue3,
              C.blue4,
              C.blue4,
              C.blue5,
            ],
            borderRadius: 3,
          },
        ],
      },
      options: {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: C.grid },
            ticks: { callback: (v: number) => 'BD ' + v, font: { size: 10 }, color: '#78909C' },
          },
          y: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#37474F' } },
        },
      },
    });

    this.makeChart('c-cat-pie', {
      type: 'doughnut',
      data: {
        labels: ['Meat', 'Dairy', 'Grains', 'Beverages', 'Other'],
        datasets: [
          {
            data: [28, 22, 18, 16, 16],
            backgroundColor: [C.blue1, C.blue2, C.blue3, C.cyan, C.teal],
            borderWidth: 3,
            borderColor: '#fff',
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '58%',
      },
    });
  }

  renderCategoryCharts() {
    const C = this.COLORS;
    this.makeChart('c-catbar', {
      type: 'bar',
      data: {
        labels: ['Meat', 'Dairy', 'Grains', 'Beverages', 'Bakery', 'Canned', 'Snacks', 'Other'],
        datasets: [
          {
            data: [2840, 2264, 1852, 1648, 980, 620, 480, 320],
            backgroundColor: [
              C.blue1,
              C.blue2,
              C.blue2,
              C.blue3,
              C.blue3,
              C.blue4,
              C.blue4,
              C.blue5,
            ],
            borderRadius: 5,
          },
        ],
      },
      options: {
        ...this.baseOpts,
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#78909C' } },
          y: {
            grid: { color: C.grid },
            ticks: { callback: (v: number) => 'BD ' + v, font: { size: 11 }, color: '#78909C' },
          },
        },
      },
    });

    this.makeChart('c-catdough', {
      type: 'doughnut',
      data: {
        labels: ['Meat', 'Dairy', 'Grains', 'Beverages', 'Bakery', 'Other'],
        datasets: [
          {
            data: [28, 22, 18, 16, 9, 7],
            backgroundColor: [C.blue1, C.blue2, C.blue3, C.cyan, C.teal, C.indigo],
            borderWidth: 3,
            borderColor: '#fff',
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '58%',
      },
    });
  }

  renderVatCharts() {
    const C = this.COLORS;
    this.makeChart('c-vat', {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr'],
        datasets: [
          {
            label: 'Net sales',
            data: [12651, 10182, 11673, 9258],
            backgroundColor: C.blue2,
            borderRadius: 4,
          },
          {
            label: 'VAT',
            data: [1265, 1018, 1167, 926],
            backgroundColor: C.blue4,
            borderRadius: 4,
          },
        ],
      },
      options: {
        ...this.baseOpts,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#78909C' },
          },
          y: {
            stacked: true,
            grid: { color: C.grid },
            ticks: {
              callback: (v: number) => 'BD ' + (v / 1000).toFixed(0) + 'k',
              font: { size: 11 },
              color: '#78909C',
            },
          },
        },
      },
    });
  }

  renderProfitCharts() {
    const C = this.COLORS;
    this.makeChart('c-profit', {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr'],
        datasets: [
          {
            label: 'Revenue',
            data: [13916, 11200, 12840, 10284],
            backgroundColor: C.blue2,
            borderRadius: 4,
          },
          {
            label: 'COGS',
            data: [8680, 6990, 8010, 6420],
            backgroundColor: C.blue4,
            borderRadius: 4,
          },
          {
            label: 'Profit',
            data: [5236, 4210, 4830, 3864],
            backgroundColor: C.cyan,
            borderRadius: 4,
          },
        ],
      },
      options: {
        ...this.baseOpts,
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#78909C' } },
          y: {
            grid: { color: C.grid },
            ticks: {
              callback: (v: number) => 'BD ' + (v / 1000).toFixed(0) + 'k',
              font: { size: 11 },
              color: '#78909C',
            },
          },
        },
      },
    });

    this.makeChart('c-margin', {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr'],
        datasets: [
          {
            data: [37.6, 37.6, 37.6, 37.6],
            borderColor: C.blue2,
            backgroundColor: 'rgba(30,136,229,0.12)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: C.blue1,
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        ...this.baseOpts,
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#78909C' } },
          y: {
            grid: { color: C.grid },
            min: 30,
            max: 45,
            ticks: { callback: (v: number) => v + '%', font: { size: 11 }, color: '#78909C' },
          },
        },
      },
    });
  }

  renderPaymentCharts() {
    const C = this.COLORS;
    this.makeChart('c-paytrend', {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr'],
        datasets: [
          {
            label: 'Cash',
            data: [7654, 6160, 7062, 5656],
            backgroundColor: C.blue1,
            borderRadius: 3,
          },
          {
            label: 'Card',
            data: [4869, 3920, 4494, 3600],
            backgroundColor: C.blue3,
            borderRadius: 3,
          },
          {
            label: 'Credit',
            data: [1393, 1120, 1284, 1028],
            backgroundColor: C.blue5,
            borderRadius: 3,
          },
        ],
      },
      options: {
        ...this.baseOpts,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#78909C' },
          },
          y: {
            stacked: true,
            grid: { color: C.grid },
            ticks: {
              callback: (v: number) => 'BD ' + (v / 1000).toFixed(0) + 'k',
              font: { size: 11 },
              color: '#78909C',
            },
          },
        },
      },
    });

    this.makeChart('c-paysplit', {
      type: 'doughnut',
      data: {
        labels: ['Cash', 'Card', 'Credit'],
        datasets: [
          {
            data: [
              this.paymentKpis.cash || 55,
              this.paymentKpis.card || 35,
              this.paymentKpis.credit || 10,
            ],
            backgroundColor: [C.blue1, C.blue3, C.blue5],
            borderWidth: 3,
            borderColor: '#fff',
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '60%',
      },
    });
  }

  renderUserCharts() {
    const C = this.COLORS;
    this.makeChart('c-users', {
      type: 'bar',
      data: {
        labels: this.userRows.length
          ? this.userRows.map((r) => r.Name)
          : ['Ahmed', 'Sara', 'Khalid'],
        datasets: [
          {
            data: this.userRows.length ? this.userRows.map((r) => r.Revenue) : [541, 379, 294],
            backgroundColor: [C.blue1, C.blue2, C.blue3],
            borderRadius: 6,
            hoverBackgroundColor: C.blue4,
          },
        ],
      },
      options: {
        ...this.baseOpts,
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#78909C' } },
          y: {
            grid: { color: C.grid },
            ticks: { callback: (v: number) => 'BD ' + v, font: { size: 11 }, color: '#78909C' },
          },
        },
      },
    });

    this.makeChart('c-userpie', {
      type: 'doughnut',
      data: {
        labels: this.userRows.length
          ? this.userRows.map((r) => r.Name)
          : ['Ahmed', 'Sara', 'Khalid'],
        datasets: [
          {
            data: this.userRows.length ? this.userRows.map((r) => r.OrderCount) : [42, 31, 27],
            backgroundColor: [C.blue1, C.blue3, C.cyan],
            borderWidth: 3,
            borderColor: '#fff',
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '58%',
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────
  bd(n: number): string {
    return 'BD ' + (n || 0).toFixed(3);
  }

  async exportCsv() {
    try {
      await this.api.reports.export({
        view: this.view,
        companyId: this.companyId,
        from: this.dateFrom,
        to: this.dateTo,
      });
    } catch (e) {
      console.error('exportCsv', e);
    }
  }
}
