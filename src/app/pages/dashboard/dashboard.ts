import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { getWeatherIcon } from './weather-icon.util';
import { WeatherIcon } from './weather-icon/weather-icon';
import { AuthService, SessionData } from '../../services/auth.service';

export type NotificationType = 'stock' | 'expiry' | 'delivery' | 'price' | 'cashier' | 'system';

export interface PosNotification {
  id: string;
  type: NotificationType;
  title: string;
  subtitle: string;
  time: Date;
  read: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, WeatherIcon],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  temperature = '';
  condition = '';
  currentTime = '';
  currentDate = '';
  weatherIcon = 'sunny';
  session: SessionData | null = null;
  isOnline = true;

  notifications: PosNotification[] = [];
  showAllNotifications = false;
  userName = '';
  userRole = '';
  userInitial = '';
  private subs: Subscription[] = [];

  readonly menuItems = [
    { label: 'Checkout', route: 'checkout' },
    { label: 'Products', route: 'products' },
    { label: 'Inventory', route: 'inventory' },
    { label: 'Reports', route: 'reports' },
    { label: 'Customers', route: 'customers' },
    { label: 'Suppliers', route: 'suppliers' },
    { label: 'Promotions', route: 'promotions' },
    { label: 'Expiry', route: 'expiry' },
    { label: 'Cash Drawer', route: 'cash' },
    { label: 'Receipts', route: 'receipts' },
    { label: 'Backup', route: 'backup' },
    { label: 'Settings', route: 'settings' },
  ];

  constructor(
    private router: Router,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {}

  async ngOnInit() {
    await this.authService.loadSession();
    this.session = this.authService.getSession();
    const session = this.authService.getSession();
    if (session) {
      this.userName = session.user.name;
      this.userRole = session.user.role;
      this.userInitial = session.user.name.charAt(0).toUpperCase();
    }

    this.updateTime();

    this.subs.push(
      interval(1000).subscribe(() => {
        this.updateTime();
        this.cdr.detectChanges();
      }),
      interval(600_000).subscribe(() => this.getWeather()),
    );

    this.getWeather();
    this.registerElectronListeners();
  }

  private registerElectronListeners() {
    const api = (window as any).electronAPI;

    api.onOnlineStatus?.((status: boolean) => {
      this.zone.run(() => {
        this.isOnline = status;
        this.cdr.detectChanges();
      });
    });

    api.onLowStock?.((item: { name: string; remaining: number; aisle: string }) => {
      this.zone.run(() => {
        this.push({
          type: 'stock',
          title: `Low stock: ${item.name}`,
          subtitle: `${item.remaining} units left · ${item.aisle}`,
        });
        this.cdr.detectChanges();
      });
    });

    api.onExpiryAlert?.((item: { name: string; count: number }) => {
      this.zone.run(() => {
        this.push({
          type: 'expiry',
          title: `Expiry alert: ${item.name}`,
          subtitle: `Expires today · ${item.count} units`,
        });
        this.cdr.detectChanges();
      });
    });

    api.onDeliveryArrived?.((d: { category: string; boxes: number }) => {
      this.zone.run(() => {
        this.push({
          type: 'delivery',
          title: `Delivery arrived: ${d.category}`,
          subtitle: `${d.boxes} boxes · Loading bay`,
        });
        this.cdr.detectChanges();
      });
    });

    api.onPriceUpdate?.((d: { count: number }) => {
      this.zone.run(() => {
        this.push({
          type: 'price',
          title: `Price update: ${d.count} products`,
          subtitle: 'Effective from today',
        });
        this.cdr.detectChanges();
      });
    });

    api.onCashierStatus?.((d: { register: number; message: string }) => {
      this.zone.run(() => {
        this.push({ type: 'cashier', title: `Register ${d.register}: ${d.message}`, subtitle: '' });
        this.cdr.detectChanges();
      });
    });
  }

  private push(partial: Pick<PosNotification, 'type' | 'title' | 'subtitle'>) {
    this.notifications.unshift({
      id: crypto.randomUUID(),
      read: false,
      time: new Date(),
      ...partial,
    });
    if (this.notifications.length > 50) this.notifications.length = 50;
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  get visibleNotifications(): PosNotification[] {
    return this.showAllNotifications ? this.notifications : this.notifications.slice(0, 5);
  }

  markRead(n: PosNotification) {
    n.read = true;
  }
  markAllRead() {
    this.notifications.forEach((n) => (n.read = true));
  }

  updateTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.currentDate = now.toLocaleDateString([], {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  }

  goTo(route: string) {
    this.router.navigate([`/${route}`]);
  }

  getWeather() {
    (window as any).electronAPI.getWeather().then((data: any) => {
      this.zone.run(() => {
        this.temperature = `${data.current.temp_c}°C`;
        this.condition = data.current.condition.text;
        this.weatherIcon = getWeatherIcon(data.current.condition.code, data.current.is_day);
        this.cdr.detectChanges();
      });
    });
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
