import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export type PayMethod = 'cash' | 'card' | 'split' | 'credit';

export interface CartItem {
  id: number;
  name: string;
  barcode: string;
  cat: string;
  price: number;
  stock: number;
  qty: number;
  discount: number;
}

export interface HeldOrder {
  id: string;
  customer: string;
  customerId: number | null;
  items: CartItem[];
  subtotal: number;
  time: Date;
}

export interface Customer {
  Id: number;
  Name: string;
  Phone: string;
  LoyaltyPoints: number;
}

export interface Product {
  Id: number;
  Name: string;
  CategoryName: string;
  Price: number;
  StockQty: number;
  Barcode: string;
}

@Component({
  selector: 'app-pos',
  imports: [CommonModule, FormsModule],
  templateUrl: './pos.html',
  styleUrl: './pos.scss',
})
export class Pos implements OnInit, OnDestroy {
  @ViewChild('barcodeInput') barcodeInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('cashInput') cashInputRef!: ElementRef<HTMLInputElement>;

  // ── Session ──────────────────────────────────────────────
  companyId: number | null = null;
  branchId: number | null = null;
  companyName = '';
  cashierName = '';

  // ── Clock ────────────────────────────────────────────────
  currentTime = new Date();
  private clockTimer: any;

  // ── Invoice ──────────────────────────────────────────────
  invoiceNumber = '';
  private invoiceSeq = 0;

  // ── Products ─────────────────────────────────────────────
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  categories: string[] = [];
  activeCategory = 'All';
  searchQuery = '';

  // ── Cart ─────────────────────────────────────────────────
  cart: CartItem[] = [];
  heldOrders: HeldOrder[] = [];
  globalDiscount = 0;
  globalDiscountCode = '';
  discountApplied = false;
  discountInput: number | null = null;

  // ── Customer ─────────────────────────────────────────────
  allCustomers: Customer[] = [];
  customerSearch = '';
  customerResults: Customer[] = [];
  selectedCustomerId: number | null = null;
  selectedCustomerName = 'Walk-in Customer';
  selectedCustomerPhone = '';
  selectedCustomerLoyalty = 0;

  // ── Payment ──────────────────────────────────────────────
  payMethod: PayMethod = 'cash';
  cashAmount = 0;
  cardAmount = 0;

  // ── VAT ──────────────────────────────────────────────────
  vatRate = 0; // set from company settings if needed

  // ── UI state ─────────────────────────────────────────────
  showHeldPanel = false;
  showCalculator = false;
  showDiscountPanel = false;
  showPromoPanel = false;
  loading = false;
  saleComplete = false;

  // ── Calculator ───────────────────────────────────────────
  calcDisplay = '0';
  calcExpression = '';

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
    this.companyName = session.company.name || 'SuperMart';
    this.cashierName = session.user?.name || 'Cashier';

    this.generateInvoice();
    this.clockTimer = setInterval(() => {
      this.currentTime = new Date();
      this.cdr.detectChanges();
    }, 1000);

    await Promise.all([this.loadProducts(), this.loadCustomers()]);
  }

  ngOnDestroy() {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  // ── Invoice number ───────────────────────────────────────
  generateInvoice() {
    this.invoiceSeq++;
    const pad = (n: number, len: number) => String(n).padStart(len, '0');
    this.invoiceNumber = `INV-${pad(this.invoiceSeq, 6)}`;
  }

  // ── Data loading ─────────────────────────────────────────
  async loadProducts() {
    try {
      const rows: Product[] = await this.api.products.getAll({ companyId: this.companyId });
      this.allProducts = rows.filter((p) => (p as any).IsDeleted === 0);
      this.categories = [
        'All',
        ...new Set(this.allProducts.map((p) => p.CategoryName).filter(Boolean)),
      ];
      this.filterProducts();
      this.cdr.detectChanges();
    } catch (e) {
      console.error('loadProducts', e);
    }
  }

  async loadCustomers() {
    try {
      this.allCustomers = (await this.api.customers?.getAll(this.companyId)) ?? [];
      this.cdr.detectChanges();
    } catch (e) {
      console.error('loadCustomers', e);
    }
  }

  // ── Customer search ──────────────────────────────────────
  onCustomerSearch() {
    const q = this.customerSearch.trim().toLowerCase();
    if (!q) {
      this.customerResults = [];
      return;
    }
    this.customerResults = this.allCustomers
      .filter((c) => c.Name?.toLowerCase().includes(q) || c.Phone?.includes(q))
      .slice(0, 6);
    this.cdr.detectChanges();
  }

  selectCustomer(c: Customer) {
    this.selectedCustomerId = c.Id;
    this.selectedCustomerName = c.Name;
    this.selectedCustomerPhone = c.Phone || '';
    this.selectedCustomerLoyalty = c.LoyaltyPoints || 0;
    this.customerSearch = c.Name;
    this.customerResults = [];
    this.cdr.detectChanges();
  }

  clearCustomer() {
    this.selectedCustomerId = null;
    this.selectedCustomerName = 'Walk-in Customer';
    this.selectedCustomerPhone = '';
    this.selectedCustomerLoyalty = 0;
    this.customerSearch = '';
    this.customerResults = [];
    this.cdr.detectChanges();
  }

  // ── Product filtering ────────────────────────────────────
  filterProducts() {
    const q = this.searchQuery.toLowerCase();
    this.filteredProducts = this.allProducts.filter((p) => {
      const matchCat = this.activeCategory === 'All' || p.CategoryName === this.activeCategory;
      const matchQ = !q || p.Name.toLowerCase().includes(q) || p.Barcode?.includes(q);
      return matchCat && matchQ;
    });
  }

  setCategory(cat: string) {
    this.activeCategory = cat;
    this.filterProducts();
  }

  onBarcodeEnter(e: KeyboardEvent) {
    if (e.key === 'Enter') this.addByBarcode();
  }

  addByBarcode() {
    const q = this.searchQuery.trim();
    if (!q) return;
    const p = this.allProducts.find((x) => x.Barcode === q);
    if (p) {
      this.addToCart(p);
      this.searchQuery = '';
      this.filterProducts();
    }
  }

  // ── Category icon ────────────────────────────────────────
  getCatIcon(cat: string): string {
    const map: Record<string, string> = {
      All: '⊞',
      'all items': '⊞',
      all: '⊞',
      fruits: '🍎',
      'fruits & veg': '🍎',
      vegetables: '🥦',
      dairy: '🥛',
      bakery: '🥖',
      beverages: '🧃',
      snacks: '🍪',
      household: '🏠',
      meat: '🥩',
      frozen: '🧊',
      'personal care': '🧴',
      cleaning: '🧹',
    };
    return map[cat.toLowerCase()] || '📦';
  }

  // ── Product emoji ────────────────────────────────────────
  getProductEmoji(p: Product): string {
    const n = p.Name.toLowerCase();
    if (n.includes('milk')) return '🥛';
    if (n.includes('bread')) return '🍞';
    if (n.includes('banana')) return '🍌';
    if (n.includes('apple')) return '🍎';
    if (n.includes('egg')) return '🥚';
    if (n.includes('oil')) return '🫙';
    if (n.includes('sugar')) return '🍚';
    if (n.includes('rice')) return '🌾';
    if (n.includes('juice')) return '🧃';
    if (n.includes('water')) return '💧';
    if (n.includes('chips') || n.includes('crisp')) return '🍟';
    if (n.includes('detergent') || n.includes('soap')) return '🧴';
    if (n.includes('chicken')) return '🍗';
    if (n.includes('coffee')) return '☕';
    if (n.includes('tea')) return '🍵';
    if (n.includes('cheese')) return '🧀';
    if (n.includes('butter')) return '🧈';
    if (n.includes('tomato')) return '🍅';
    if (n.includes('potato')) return '🥔';
    if (n.includes('onion')) return '🧅';
    const catIcon = this.getCatIcon(p.CategoryName || '');
    return catIcon === '⊞' ? '📦' : catIcon;
  }

  // ── Cart operations ──────────────────────────────────────
  addToCart(p: Product) {
    if (p.StockQty <= 0) return;
    const ex = this.cart.find((c) => c.id === p.Id);
    if (ex) {
      ex.qty++;
    } else {
      this.cart.push({
        id: p.Id,
        name: p.Name,
        barcode: p.Barcode || '',
        cat: p.CategoryName,
        price: p.Price,
        stock: p.StockQty,
        qty: 1,
        discount: 0,
      });
    }
    this.cdr.detectChanges();
  }

  changeQty(index: number, delta: number) {
    this.cart[index].qty += delta;
    if (this.cart[index].qty <= 0) this.cart.splice(index, 1);
    this.cdr.detectChanges();
  }

  removeItem(index: number) {
    this.cart.splice(index, 1);
    this.cdr.detectChanges();
  }

  clearCart() {
    this.cart = [];
    this.globalDiscount = 0;
    this.globalDiscountCode = '';
    this.discountApplied = false;
    this.cashAmount = 0;
    this.cardAmount = 0;
    this.cdr.detectChanges();
  }

  // ── Totals ───────────────────────────────────────────────
  get subtotal(): number {
    return this.cart.reduce((s, c) => s + c.price * c.qty * (1 - c.discount / 100), 0);
  }
  get discountAmount(): number {
    return this.subtotal * (this.globalDiscount / 100);
  }
  get vatAmount(): number {
    return (this.subtotal - this.discountAmount) * (this.vatRate / 100);
  }
  get grandTotal(): number {
    return this.subtotal - this.discountAmount + this.vatAmount;
  }
  get change(): number {
    if (this.payMethod === 'cash') return Math.max(0, this.cashAmount - this.grandTotal);
    if (this.payMethod === 'split')
      return Math.max(0, this.cashAmount + this.cardAmount - this.grandTotal);
    return 0;
  }
  get cartItemCount(): number {
    return this.cart.reduce((s, c) => s + c.qty, 0);
  }

  // ── Discount ─────────────────────────────────────────────
  applyDiscountDirect() {
    const v = Number(this.discountInput);
    if (!isNaN(v) && v >= 0 && v <= 100) {
      this.globalDiscount = v;
      this.discountApplied = v > 0;
      this.showDiscountPanel = false;
    }
    this.cdr.detectChanges();
  }

  applyDiscount() {
    const code = this.globalDiscountCode.trim().toUpperCase();
    const CODES: Record<string, number> = { SAVE10: 10, SAVE20: 20, STAFF: 15 };
    if (CODES[code]) {
      this.globalDiscount = CODES[code];
      this.discountApplied = true;
      this.showPromoPanel = false;
    } else if (!isNaN(Number(code)) && Number(code) > 0 && Number(code) <= 100) {
      this.globalDiscount = Number(code);
      this.discountApplied = true;
      this.showPromoPanel = false;
    } else {
      alert('Invalid promo code.');
    }
    this.cdr.detectChanges();
  }

  removeDiscount() {
    this.globalDiscount = 0;
    this.globalDiscountCode = '';
    this.discountApplied = false;
    this.discountInput = null;
    this.cdr.detectChanges();
  }

  // ── Hold / Recall ────────────────────────────────────────
  holdOrder() {
    if (!this.cart.length) return;
    this.heldOrders.push({
      id: crypto.randomUUID(),
      customer: this.selectedCustomerName,
      customerId: this.selectedCustomerId,
      items: this.cart.map((c) => ({ ...c })),
      subtotal: this.grandTotal,
      time: new Date(),
    });
    this.clearCart();
    this.cdr.detectChanges();
  }

  recallOrder(held: HeldOrder) {
    this.cart = held.items.map((c) => ({ ...c }));
    this.selectedCustomerId = held.customerId;
    this.heldOrders = this.heldOrders.filter((h) => h.id !== held.id);
    this.showHeldPanel = false;
    this.cdr.detectChanges();
  }

  deleteHeld(id: string) {
    this.heldOrders = this.heldOrders.filter((h) => h.id !== id);
    this.cdr.detectChanges();
  }

  // ── Payment ──────────────────────────────────────────────
  setPayMethod(m: PayMethod) {
    this.payMethod = m;
    this.cdr.detectChanges();
  }
  calcChange() {
    this.cdr.detectChanges();
  }

  // ── Complete sale ────────────────────────────────────────
  async completeSale() {
    if (!this.cart.length) return;
    this.loading = true;
    try {
      const payload = {
        companyId: this.companyId,
        branchId: this.branchId,
        customerId: this.selectedCustomerId,
        items: this.cart.map((c) => ({
          productId: c.id,
          qty: c.qty,
          price: c.price,
          discount: c.discount,
          total: c.price * c.qty * (1 - c.discount / 100),
        })),
        subtotal: this.subtotal,
        discount: this.discountAmount,
        total: this.grandTotal,
        payMethod: this.payMethod,
        cashAmount: this.cashAmount,
        cardAmount: this.cardAmount,
        change: this.change,
      };
      const result = await this.api.checkout?.completeSale(payload);
      if (result?.success) {
        await this.api.checkout?.printReceipt(result.saleId);
        this.saleComplete = true;
        this.clearCart();
        this.clearCustomer();
        this.generateInvoice();
        setTimeout(() => {
          this.saleComplete = false;
          this.cdr.detectChanges();
        }, 2500);
        this.loadProducts();
      }
    } catch (e) {
      console.error('completeSale', e);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  // ── Calculator ───────────────────────────────────────────
  calcPress(key: string) {
    if (key === 'C') {
      this.calcDisplay = '0';
      this.calcExpression = '';
      return;
    }
    if (key === '⌫') {
      this.calcDisplay = this.calcDisplay.length > 1 ? this.calcDisplay.slice(0, -1) : '0';
      return;
    }
    if (key === '=') {
      try {
        const expr = this.calcExpression + this.calcDisplay;
        const r = Function('"use strict"; return (' + expr + ')')();
        this.calcExpression = '';
        this.calcDisplay = parseFloat(r.toFixed(6)).toString();
      } catch {
        this.calcDisplay = 'Error';
      }
      return;
    }
    if (['+', '-', '×', '÷', '%'].includes(key)) {
      const op = key === '×' ? '*' : key === '÷' ? '/' : key;
      this.calcExpression += this.calcDisplay + op;
      this.calcDisplay = '0';
      return;
    }
    if (key === '.') {
      if (!this.calcDisplay.includes('.')) this.calcDisplay += '.';
      return;
    }
    this.calcDisplay = this.calcDisplay === '0' ? key : this.calcDisplay + key;
  }

  calcUseResult() {
    const v = parseFloat(this.calcDisplay);
    if (!isNaN(v)) {
      this.cashAmount = v;
      this.showCalculator = false;
      this.cdr.detectChanges();
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
  bd(n: number) {
    return 'BD ' + (n || 0).toFixed(3);
  }
}
