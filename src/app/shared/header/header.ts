import { ChangeDetectorRef, Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header implements OnInit, OnDestroy {
  @Input() pageTitle = '';

  isOnline = true;
  temperature = '';
  userName = '';
  userRole = '';
  userInitial = '';

  constructor(
    private router: Router,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    const session = this.authService.getSession();
    if (session) {
      this.userName = session.user.name;
      this.userRole = session.user.role;
      this.userInitial = session.user.name.charAt(0).toUpperCase();
    }

    (window as any).electronAPI.onOnlineStatus((status: boolean) => {
      this.zone.run(() => {
        this.isOnline = status;
        this.cdr.detectChanges();
      });
    });

    (window as any).electronAPI.getWeather().then((data: any) => {
      this.zone.run(() => {
        this.temperature = data?.current?.temp_c + '°C';
        this.cdr.detectChanges();
      });
    });
  }

  ngOnDestroy() {}

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
