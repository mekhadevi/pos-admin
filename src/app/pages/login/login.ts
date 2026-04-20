import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { loginAnimations } from '../login.animations';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  animations: [loginAnimations],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  constructor(private router: Router) {}

  username = signal('');
  password = signal('');
  error = signal('');

  async onSignIn() {
    const result = await (window as any).electronAPI.login({
      username: this.username(),
      password: this.password(),
    });
    console.log(result);
    if (result.success) {
      localStorage.setItem('user', JSON.stringify(result.user));
      this.router.navigate(['/dashboard']);
    } else {
      this.error.set(result.message);
    }
  }
}
