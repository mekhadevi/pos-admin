import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Header } from '../../shared/header/header';

export type SettingsView =
  | 'company'
  | 'receipt'
  | 'tax'
  | 'pos'
  | 'inventory'
  | 'notifications'
  | 'users'
  | 'branches'
  | 'about';

export interface AppUser {
  Id: number;
  Name: string;
  Username: string;
  Role: string;
  BranchId: number | null;
  CreatedAt: string;
  UpdatedAt: string | null;
}

export interface Branch {
  Id: number;
  Name: string;
  Location: string | null;
  CreatedAt: string;
}

export interface AppInfo {
  version: string;
  name: string;
  userData: string;
  platform: string;
  arch: string;
  electron: string;
  node: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, Header],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit, OnDestroy {
  view: SettingsView = 'company';

  // ── session ────────────────────────────────────────────
  companyId: number | null = null;
  branchId: number | null = null;

  // ── raw settings map from DB ───────────────────────────
  raw: Record<string, string> = {};

  // ── section models (two-way bound to form fields) ──────
  company = {
    name: '',
    tagline: '',
    vatNumber: '',
    crNumber: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    currency: 'BHD',
    currencySymbol: 'BD',
    decimalPlaces: '3',
  };

  receipt = {
    header: '',
    footer: 'Thank you for your visit!',
    showLogo: true,
    showVAT: true,
    showBarcode: false,
    copies: 1,
    paperSize: '80mm',
  };

  tax = {
    vatEnabled: false,
    vatRate: 10,
    vatInclusive: false,
    vatLabel: 'VAT',
    vatNumber: '',
  };

  pos = {
    allowDiscount: true,
    maxDiscountPct: 100,
    allowRefund: true,
    requireReason: false,
    defaultPayment: 'cash',
    loyaltyEnabled: false,
    loyaltyRate: 1,
  };

  inventory = {
    lowStockDefault: 10,
    trackExpiry: true,
    expiryAlertDays: 7,
    autoDeductStock: true,
  };

  notify = {
    lowStock: true,
    expiry: true,
    delivery: true,
    sound: false,
  };

  // ── users ──────────────────────────────────────────────
  users: AppUser[] = [];
  userForm = this.emptyUserForm();
  userFormMode: 'add' | 'edit' = 'add';
  userSaving = false;
  userSuccess = false;
  userError = '';
  showUserForm = false;
  showPassword = false;

  // ── branches ───────────────────────────────────────────
  branches: Branch[] = [];
  branchForm = { id: 0, name: '', location: '' };
  branchFormMode: 'add' | 'edit' = 'add';
  branchSaving = false;
  branchSuccess = false;
  branchError = '';
  showBranchForm = false;

  // ── about ──────────────────────────────────────────────
  appInfo: AppInfo | null = null;

  // ── ui state ───────────────────────────────────────────
  saving = false;
  saveSuccess = false;
  saveError = '';
  toastMsg = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  private toastTimer: any;

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
    await this.loadSettings();
  }

  ngOnDestroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── load all settings from DB ──────────────────────────
  async loadSettings() {
    try {
      const res = await this.api.settings.getAll();
      if (!res.success) return;
      this.zone.run(() => {
        this.raw = res.data;
        this.mapToModels();
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadSettings', e);
    }
  }

  mapToModels() {
    const r = this.raw;
    const b = (k: string, def = true) => (r[k] ?? String(def)) === 'true';
    const n = (k: string, def = 0) => parseFloat(r[k] ?? String(def)) || def;
    const s = (k: string, def = '') => r[k] ?? def;

    this.company = {
      name: s('company.name', 'My POS Store'),
      tagline: s('company.tagline'),
      vatNumber: s('company.vatNumber'),
      crNumber: s('company.crNumber'),
      phone: s('company.phone'),
      email: s('company.email'),
      address: s('company.address'),
      website: s('company.website'),
      currency: s('company.currency', 'BHD'),
      currencySymbol: s('company.currencySymbol', 'BD'),
      decimalPlaces: s('company.decimalPlaces', '3'),
    };

    this.receipt = {
      header: s('receipt.header'),
      footer: s('receipt.footer', 'Thank you for your visit!'),
      showLogo: b('receipt.showLogo'),
      showVAT: b('receipt.showVAT'),
      showBarcode: b('receipt.showBarcode', false),
      copies: n('receipt.copies', 1),
      paperSize: s('receipt.paperSize', '80mm'),
    };

    this.tax = {
      vatEnabled: b('tax.vatEnabled', false),
      vatRate: n('tax.vatRate', 10),
      vatInclusive: b('tax.vatInclusive', false),
      vatLabel: s('tax.vatLabel', 'VAT'),
      vatNumber: s('tax.vatNumber'),
    };

    this.pos = {
      allowDiscount: b('pos.allowDiscount'),
      maxDiscountPct: n('pos.maxDiscountPct', 100),
      allowRefund: b('pos.allowRefund'),
      requireReason: b('pos.requireReason', false),
      defaultPayment: s('pos.defaultPayment', 'cash'),
      loyaltyEnabled: b('pos.loyaltyEnabled', false),
      loyaltyRate: n('pos.loyaltyRate', 1),
    };

    this.inventory = {
      lowStockDefault: n('inventory.lowStockDefault', 10),
      trackExpiry: b('inventory.trackExpiry'),
      expiryAlertDays: n('inventory.expiryAlertDays', 7),
      autoDeductStock: b('inventory.autoDeductStock'),
    };

    this.notify = {
      lowStock: b('notify.lowStock'),
      expiry: b('notify.expiry'),
      delivery: b('notify.delivery'),
      sound: b('notify.sound', false),
    };
  }

  modelsToMap(): Record<string, string> {
    return {
      'company.name': this.company.name,
      'company.tagline': this.company.tagline,
      'company.vatNumber': this.company.vatNumber,
      'company.crNumber': this.company.crNumber,
      'company.phone': this.company.phone,
      'company.email': this.company.email,
      'company.address': this.company.address,
      'company.website': this.company.website,
      'company.currency': this.company.currency,
      'company.currencySymbol': this.company.currencySymbol,
      'company.decimalPlaces': this.company.decimalPlaces,
      'receipt.header': this.receipt.header,
      'receipt.footer': this.receipt.footer,
      'receipt.showLogo': String(this.receipt.showLogo),
      'receipt.showVAT': String(this.receipt.showVAT),
      'receipt.showBarcode': String(this.receipt.showBarcode),
      'receipt.copies': String(this.receipt.copies),
      'receipt.paperSize': this.receipt.paperSize,
      'tax.vatEnabled': String(this.tax.vatEnabled),
      'tax.vatRate': String(this.tax.vatRate),
      'tax.vatInclusive': String(this.tax.vatInclusive),
      'tax.vatLabel': this.tax.vatLabel,
      'tax.vatNumber': this.tax.vatNumber,
      'pos.allowDiscount': String(this.pos.allowDiscount),
      'pos.maxDiscountPct': String(this.pos.maxDiscountPct),
      'pos.allowRefund': String(this.pos.allowRefund),
      'pos.requireReason': String(this.pos.requireReason),
      'pos.defaultPayment': this.pos.defaultPayment,
      'pos.loyaltyEnabled': String(this.pos.loyaltyEnabled),
      'pos.loyaltyRate': String(this.pos.loyaltyRate),
      'inventory.lowStockDefault': String(this.inventory.lowStockDefault),
      'inventory.trackExpiry': String(this.inventory.trackExpiry),
      'inventory.expiryAlertDays': String(this.inventory.expiryAlertDays),
      'inventory.autoDeductStock': String(this.inventory.autoDeductStock),
      'notify.lowStock': String(this.notify.lowStock),
      'notify.expiry': String(this.notify.expiry),
      'notify.delivery': String(this.notify.delivery),
      'notify.sound': String(this.notify.sound),
    };
  }

  // ── navigation ─────────────────────────────────────────
  async setView(v: SettingsView) {
    this.view = v;
    this.saveSuccess = false;
    this.saveError = '';
    this.cdr.detectChanges();
    if (v === 'users') await this.loadUsers();
    if (v === 'branches') await this.loadBranches();
    if (v === 'about') await this.loadAppInfo();
    this.cdr.detectChanges();
  }

  // ── save current section ───────────────────────────────
  async save() {
    this.saving = true;
    this.saveSuccess = false;
    this.saveError = '';
    this.cdr.detectChanges();
    try {
      const result = await this.api.settings.setMany(this.modelsToMap());
      if (result.success) {
        this.saveSuccess = true;
        this.toast('Settings saved!', 'success');
        await this.loadSettings();
        setTimeout(() => {
          this.saveSuccess = false;
          this.cdr.detectChanges();
        }, 2000);
      } else {
        this.saveError = result.error ?? 'Failed to save.';
        this.toast(this.saveError, 'error');
      }
    } catch (e: any) {
      this.saveError = e.message;
      this.toast(e.message, 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  // ── reset section to defaults ──────────────────────────
  async resetSection(section: string) {
    if (!confirm(`Reset ${section} settings to defaults? Your current values will be lost.`))
      return;
    try {
      const result = await this.api.settings.resetSection(section);
      if (result.success) {
        await this.loadSettings();
        this.toast('Section reset to defaults', 'info');
      }
    } catch (e: any) {
      this.toast(e.message, 'error');
    }
  }

  // ── users ──────────────────────────────────────────────
  async loadUsers() {
    try {
      const rows = await this.api.settings.getUsers(this.companyId);
      this.zone.run(() => {
        this.users = rows;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadUsers', e);
    }
  }

  openAddUser() {
    this.userFormMode = 'add';
    this.userForm = this.emptyUserForm();
    this.userError = '';
    this.userSuccess = false;
    this.showPassword = false;
    this.showUserForm = true;
    this.cdr.detectChanges();
  }

  openEditUser(u: AppUser) {
    this.userFormMode = 'edit';
    this.userForm = {
      id: u.Id,
      name: u.Name,
      username: u.Username,
      role: u.Role,
      password: '',
      branchId: u.BranchId,
    };
    this.userError = '';
    this.userSuccess = false;
    this.showPassword = false;
    this.showUserForm = true;
    this.cdr.detectChanges();
  }

  async saveUser() {
    if (!this.userForm.name.trim() || !this.userForm.username.trim()) {
      this.userError = 'Name and username are required.';
      return;
    }
    if (this.userFormMode === 'add' && !this.userForm.password.trim()) {
      this.userError = 'Password is required for new users.';
      return;
    }
    this.userSaving = true;
    this.userError = '';
    this.userSuccess = false;
    this.cdr.detectChanges();
    try {
      let result: any;
      if (this.userFormMode === 'add') {
        result = await this.api.settings.createUser({
          companyId: this.companyId,
          branchId: this.userForm.branchId,
          name: this.userForm.name.trim(),
          username: this.userForm.username.trim(),
          password: this.userForm.password,
          role: this.userForm.role,
        });
      } else {
        result = await this.api.settings.updateUser(this.userForm.id, {
          name: this.userForm.name.trim(),
          username: this.userForm.username.trim(),
          role: this.userForm.role,
          password: this.userForm.password,
        });
      }
      if (result.success) {
        this.userSuccess = true;
        this.showUserForm = false;
        this.toast(this.userFormMode === 'add' ? 'User created!' : 'User updated!', 'success');
        await this.loadUsers();
        setTimeout(() => {
          this.userSuccess = false;
          this.cdr.detectChanges();
        }, 2000);
      } else {
        this.userError = result.error ?? 'Failed to save user.';
      }
    } catch (e: any) {
      this.userError = e.message;
    } finally {
      this.userSaving = false;
      this.cdr.detectChanges();
    }
  }

  async deleteUser(u: AppUser) {
    if (!confirm(`Delete user "${u.Name}"? This cannot be undone.`)) return;
    try {
      const result = await this.api.settings.deleteUser(u.Id);
      if (result.success) {
        this.toast('User deleted', 'info');
        await this.loadUsers();
      } else this.toast(result.error ?? 'Delete failed', 'error');
    } catch (e: any) {
      this.toast(e.message, 'error');
    }
  }

  // ── branches ───────────────────────────────────────────
  async loadBranches() {
    try {
      const rows = await this.api.settings.getBranches(this.companyId);
      this.zone.run(() => {
        this.branches = rows;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadBranches', e);
    }
  }

  openAddBranch() {
    this.branchFormMode = 'add';
    this.branchForm = { id: 0, name: '', location: '' };
    this.branchError = '';
    this.showBranchForm = true;
    this.cdr.detectChanges();
  }

  openEditBranch(b: Branch) {
    this.branchFormMode = 'edit';
    this.branchForm = { id: b.Id, name: b.Name, location: b.Location ?? '' };
    this.branchError = '';
    this.showBranchForm = true;
    this.cdr.detectChanges();
  }

  async saveBranch() {
    if (!this.branchForm.name.trim()) {
      this.branchError = 'Branch name is required.';
      return;
    }
    this.branchSaving = true;
    this.branchError = '';
    this.branchSuccess = false;
    this.cdr.detectChanges();
    try {
      let result: any;
      if (this.branchFormMode === 'add') {
        result = await this.api.settings.createBranch({
          companyId: this.companyId,
          name: this.branchForm.name.trim(),
          location: this.branchForm.location.trim() || null,
        });
      } else {
        result = await this.api.settings.updateBranch(this.branchForm.id, {
          name: this.branchForm.name.trim(),
          location: this.branchForm.location.trim() || null,
        });
      }
      if (result.success) {
        this.branchSuccess = true;
        this.showBranchForm = false;
        this.toast(
          this.branchFormMode === 'add' ? 'Branch created!' : 'Branch updated!',
          'success',
        );
        await this.loadBranches();
        setTimeout(() => {
          this.branchSuccess = false;
          this.cdr.detectChanges();
        }, 2000);
      } else {
        this.branchError = result.error ?? 'Failed.';
      }
    } catch (e: any) {
      this.branchError = e.message;
    } finally {
      this.branchSaving = false;
      this.cdr.detectChanges();
    }
  }

  async deleteBranch(b: Branch) {
    if (!confirm(`Delete branch "${b.Name}"?`)) return;
    try {
      const result = await this.api.settings.deleteBranch(b.Id);
      if (result.success) {
        this.toast('Branch deleted', 'info');
        await this.loadBranches();
      } else this.toast(result.error ?? 'Failed', 'error');
    } catch (e: any) {
      this.toast(e.message, 'error');
    }
  }

  // ── about / app info ───────────────────────────────────
  async loadAppInfo() {
    try {
      const info = await this.api.settings.getAppInfo();
      this.zone.run(() => {
        this.appInfo = info;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadAppInfo', e);
    }
  }

  // ── toast ──────────────────────────────────────────────
  toast(msg: string, type: 'success' | 'error' | 'info' = 'success') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.zone.run(() => {
      this.toastMsg = msg;
      this.toastType = type;
      this.cdr.detectChanges();
      this.toastTimer = setTimeout(() => {
        this.toastMsg = '';
        this.cdr.detectChanges();
      }, 3500);
    });
  }

  // ── helpers ────────────────────────────────────────────
  emptyUserForm() {
    return {
      id: 0,
      name: '',
      username: '',
      password: '',
      role: 'cashier',
      branchId: null as number | null,
    };
  }

  roleLabel(role: string): string {
    const m: Record<string, string> = {
      admin: 'Admin',
      manager: 'Manager',
      cashier: 'Cashier',
      viewer: 'Viewer',
    };
    return m[role] ?? role;
  }

  roleClass(role: string): string {
    const m: Record<string, string> = {
      admin: 'role-admin',
      manager: 'role-manager',
      cashier: 'role-cashier',
      viewer: 'role-viewer',
    };
    return m[role] ?? 'role-cashier';
  }

  platformLabel(p: string): string {
    const m: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
    return m[p] ?? p;
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
}
