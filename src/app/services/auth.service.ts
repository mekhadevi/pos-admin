import { Injectable } from '@angular/core';

export interface SessionData {
  user: { id: number; name: string; role: string };
  company: { id: number; name: string };
  branch: { id: number; name: string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private session: SessionData | null = null;

  async loadSession(): Promise<void> {
    const result = await (window as any).electronAPI.getSession();
    if (result?.success) {
      this.session = result;
    }
  }

  getSession(): SessionData | null {
    return this.session;
  }
  async logout(): Promise<void> {
    await (window as any).electronAPI.logout();
    this.session = null;
  }
}
