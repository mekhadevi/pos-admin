import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  Pipe,
  PipeTransform,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Header } from '../../shared/header/header';

@Pipe({ name: 'dbName', standalone: true })
export class DbNamePipe implements PipeTransform {
  transform(p: string | null | undefined): string {
    if (!p) return '';
    return p.split(/[\\/]/).pop() ?? p;
  }
}

export type BackupView = 'overview' | 'history' | 'restore' | 'schedule' | 'database';

export interface BackupEntry {
  id: string;
  filename: string;
  path: string;
  label: string;
  size: number;
  sizeLabel: string;
  createdAt: string;
  status: 'success' | 'failed' | 'restored' | 'restore-external';
  error?: string;
  exists: boolean;
}

export interface BackupFile {
  filename: string;
  path: string;
  size: number;
  sizeLabel: string;
  createdAt: string;
  modifiedAt: string;
}

export interface DbInfo {
  dbPath: string;
  dbSize: number;
  dbSizeLabel: string;
  backupDir: string;
  backupCount: number;
  backupDirSize: number;
  backupDirSizeLabel: string;
  tableCounts: Record<string, number>;
  lastBackup: string | null;
  totalBackups: number;
  schedule: BackupSchedule;
}

export interface BackupSchedule {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time: string;
  retainCount: number;
  lastRun: string | null;
  nextRun: string | null;
}

@Component({
  selector: 'app-backup',
  standalone: true,
  imports: [CommonModule, FormsModule, Header, DbNamePipe],
  templateUrl: './backup.html',
  styleUrl: './backup.scss',
})
export class Backup implements OnInit, OnDestroy {
  view: BackupView = 'overview';

  // ── data ───────────────────────────────────────────────
  dbInfo: DbInfo | null = null;
  history: BackupEntry[] = [];
  files: BackupFile[] = [];
  schedule: BackupSchedule = {
    enabled: false,
    frequency: 'daily',
    time: '02:00',
    retainCount: 7,
    lastRun: null,
    nextRun: null,
  };

  // ── ui state ───────────────────────────────────────────
  creating = false;
  createSuccess = false;
  createLabel = '';

  restoring = false;
  restoreTarget: BackupFile | null = null;
  restoreConfirm = false;

  schedSaving = false;
  schedSuccess = false;

  toastMsg = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  toastTimer: any;

  loading = false;

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
    await this.loadAll();
  }

  ngOnDestroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── loaders ────────────────────────────────────────────
  async loadAll() {
    this.loading = true;
    this.cdr.detectChanges();
    await Promise.all([
      this.loadDbInfo(),
      this.loadHistory(),
      this.loadFiles(),
      this.loadSchedule(),
    ]);
    this.loading = false;
    this.cdr.detectChanges();
  }

  async loadDbInfo() {
    try {
      const info = await this.api.backup.getDbInfo();
      this.zone.run(() => {
        this.dbInfo = info;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadDbInfo', e);
    }
  }

  async loadHistory() {
    try {
      const rows = await this.api.backup.getHistory();
      this.zone.run(() => {
        this.history = rows;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadHistory', e);
    }
  }

  async loadFiles() {
    try {
      const res = await this.api.backup.listFiles();
      this.zone.run(() => {
        this.files = res.files ?? [];
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadFiles', e);
    }
  }

  async loadSchedule() {
    try {
      const s = await this.api.backup.getSchedule();
      this.zone.run(() => {
        this.schedule = s;
        this.cdr.detectChanges();
      });
    } catch (e) {
      console.error('loadSchedule', e);
    }
  }

  // ── navigation ─────────────────────────────────────────
  async setView(v: BackupView) {
    this.view = v;
    this.restoreConfirm = false;
    this.restoreTarget = null;
    this.cdr.detectChanges();
    if (v === 'history') await this.loadHistory();
    if (v === 'restore') await this.loadFiles();
    if (v === 'database') await this.loadDbInfo();
    if (v === 'schedule') await this.loadSchedule();
    this.cdr.detectChanges();
  }

  // ── create backup ──────────────────────────────────────
  async createBackup() {
    this.creating = true;
    this.createSuccess = false;
    this.cdr.detectChanges();
    try {
      const label = this.createLabel.trim() || 'manual';
      const result = await this.api.backup.create(label);
      if (result.success) {
        this.createSuccess = true;
        this.createLabel = '';
        this.toast('Backup created successfully!', 'success');
        await this.loadAll();
        setTimeout(() => {
          this.createSuccess = false;
          this.cdr.detectChanges();
        }, 2500);
      } else {
        this.toast(result.error ?? 'Backup failed', 'error');
      }
    } catch (e: any) {
      this.toast(e.message ?? 'Unexpected error', 'error');
    } finally {
      this.creating = false;
      this.cdr.detectChanges();
    }
  }

  // ── delete backup ──────────────────────────────────────
  async deleteBackup(file: BackupFile) {
    if (!confirm(`Delete backup "${file.filename}"? This cannot be undone.`)) return;
    try {
      const result = await this.api.backup.delete(file.filename);
      if (result.success) {
        this.toast('Backup deleted', 'info');
        await this.loadFiles();
        await this.loadHistory();
      } else {
        this.toast(result.error ?? 'Delete failed', 'error');
      }
    } catch (e: any) {
      this.toast(e.message, 'error');
    }
  }

  // ── export backup ──────────────────────────────────────
  async exportBackup(file: BackupFile) {
    try {
      const result = await this.api.backup.export(file.filename);
      if (result.success) {
        this.toast('Backup exported successfully!', 'success');
      } else if (result.error !== 'Cancelled.') {
        this.toast(result.error ?? 'Export failed', 'error');
      }
    } catch (e: any) {
      this.toast(e.message, 'error');
    }
  }

  // ── restore from list ──────────────────────────────────
  selectRestore(file: BackupFile) {
    this.restoreTarget = file;
    this.restoreConfirm = false;
    this.cdr.detectChanges();
  }

  async confirmRestore() {
    if (!this.restoreTarget) return;
    this.restoring = true;
    this.cdr.detectChanges();
    try {
      const result = await this.api.backup.restore(this.restoreTarget.filename);
      if (result.success) {
        this.toast('Database restored! Please restart the app.', 'success');
        this.restoreTarget = null;
        this.restoreConfirm = false;
        await this.loadAll();
      } else {
        this.toast(result.error ?? 'Restore failed', 'error');
      }
    } catch (e: any) {
      this.toast(e.message, 'error');
    } finally {
      this.restoring = false;
      this.cdr.detectChanges();
    }
  }

  // ── restore from external file ─────────────────────────
  async restoreFromFile() {
    if (
      !confirm(
        'This will replace your current database with the selected file. A safety backup will be created first. Continue?',
      )
    )
      return;
    this.restoring = true;
    this.cdr.detectChanges();
    try {
      const result = await this.api.backup.restoreFromFile();
      if (result.success) {
        this.toast('Database restored from file! Please restart the app.', 'success');
        await this.loadAll();
      } else if (result.error !== 'Cancelled.') {
        this.toast(result.error ?? 'Restore failed', 'error');
      }
    } catch (e: any) {
      this.toast(e.message, 'error');
    } finally {
      this.restoring = false;
      this.cdr.detectChanges();
    }
  }

  // ── open folder ────────────────────────────────────────
  async openFolder() {
    try {
      await this.api.backup.openFolder();
    } catch {}
  }

  // ── schedule ───────────────────────────────────────────
  async saveSchedule() {
    this.schedSaving = true;
    this.schedSuccess = false;
    this.cdr.detectChanges();
    try {
      const result = await this.api.backup.saveSchedule(this.schedule);
      if (result.success) {
        this.schedule = result.schedule;
        this.schedSuccess = true;
        this.toast('Schedule saved!', 'success');
        setTimeout(() => {
          this.schedSuccess = false;
          this.cdr.detectChanges();
        }, 2000);
      } else {
        this.toast(result.error ?? 'Save failed', 'error');
      }
    } catch (e: any) {
      this.toast(e.message, 'error');
    } finally {
      this.schedSaving = false;
      this.cdr.detectChanges();
    }
  }

  // ── clear log ──────────────────────────────────────────
  async clearLog() {
    if (!confirm('Clear all backup history logs? Backup files on disk are not affected.')) return;
    try {
      await this.api.backup.clearLog();
      await this.loadHistory();
      this.toast('Log cleared', 'info');
    } catch {}
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
  statusClass(s: string): string {
    const m: Record<string, string> = {
      success: 'pill-ok',
      restored: 'pill-blue',
      'restore-external': 'pill-blue',
      failed: 'pill-out',
    };
    return m[s] ?? 'pill-draft';
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      success: 'Success',
      restored: 'Restored',
      'restore-external': 'Restored',
      failed: 'Failed',
    };
    return m[s] ?? s;
  }

  labelClass(l: string): string {
    const m: Record<string, string> = {
      manual: 'label-manual',
      auto: 'label-auto',
      'pre-restore': 'label-warn',
      restore: 'label-blue',
      'restore-external': 'label-blue',
    };
    return m[l] ?? 'label-manual';
  }

  get lastBackupAgo(): string {
    if (!this.dbInfo?.lastBackup) return 'Never';
    const diff = Date.now() - new Date(this.dbInfo.lastBackup).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  }

  get healthStatus(): 'good' | 'warn' | 'bad' {
    if (!this.dbInfo?.lastBackup) return 'bad';
    const diff = Date.now() - new Date(this.dbInfo.lastBackup).getTime();
    const hrs = diff / 3600000;
    if (hrs <= 24) return 'good';
    if (hrs <= 72) return 'warn';
    return 'bad';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByFile(_: number, f: BackupFile) {
    return f.filename;
  }
}
