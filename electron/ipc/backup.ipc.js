// Handles: manual backup, auto-schedule, restore, export, delete, history log
// No new migration needed — uses a local JSON log file alongside the SQLite DB.

const { ipcMain, app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// ── Paths ──────────────────────────────────────────────────
const USER_DATA = app.getPath('userData');
const BACKUP_DIR = path.join(USER_DATA, 'backups');
const LOG_FILE = path.join(USER_DATA, 'backup-log.json');
const SCHEDULE_FILE = path.join(USER_DATA, 'backup-schedule.json');
const DB_PATH = path.join(USER_DATA, 'pos.db');

// ── Helpers ────────────────────────────────────────────────
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function readLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLog(entries) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2));
}

function appendLog(entry) {
  const log = readLog();
  log.unshift(entry); // newest first
  if (log.length > 100) log.splice(100); // keep last 100
  writeLog(log);
}

function readSchedule() {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) {
      return {
        enabled: false,
        frequency: 'daily',
        time: '02:00',
        retainCount: 7,
        lastRun: null,
        nextRun: null,
      };
    }
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch {
    return {
      enabled: false,
      frequency: 'daily',
      time: '02:00',
      retainCount: 7,
      lastRun: null,
      nextRun: null,
    };
  }
}

function writeSchedule(sched) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(sched, null, 2));
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function calcNextRun(frequency, timeStr) {
  const [h, m] = (timeStr || '02:00').split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);

  if (frequency === 'hourly') {
    next.setTime(now.getTime() + 60 * 60 * 1000);
  } else if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + ((7 - next.getDay()) % 7 || 7));
    if (next <= now) next.setDate(next.getDate() + 7);
  } else if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1, 1);
  }
  return next.toISOString();
}

function pruneOldBackups(retainCount) {
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db') || f.endsWith('.bak'))
      .map((f) => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    const toDelete = files.slice(retainCount);
    toDelete.forEach((f) => {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, f.name));
      } catch {}
    });
    return toDelete.length;
  } catch {
    return 0;
  }
}

// ── Core backup function ───────────────────────────────────
function performBackup(label = 'manual', companyId = null) {
  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${timestamp}-${label}.db`;
  const destPath = path.join(BACKUP_DIR, filename);

  // Use SQLite backup API (online hot-backup — safe while DB is open)
  try {
    // better-sqlite3 backup method (synchronous, safe)
    db.backup(destPath);
  } catch (e) {
    // Fallback: simple file copy (works when DB is not locked)
    try {
      fs.copyFileSync(DB_PATH, destPath);
    } catch (copyErr) {
      throw new Error(`Backup failed: ${copyErr.message}`);
    }
  }

  const stat = fs.statSync(destPath);
  const entry = {
    id: `${timestamp}-${label}`,
    filename,
    path: destPath,
    label,
    size: stat.size,
    sizeLabel: formatBytes(stat.size),
    createdAt: new Date().toISOString(),
    status: 'success',
  };

  appendLog(entry);
  return entry;
}

// ── Scheduler state ────────────────────────────────────────
let scheduleTimer = null;

function stopScheduler() {
  if (scheduleTimer) {
    clearInterval(scheduleTimer);
    scheduleTimer = null;
  }
}

function startScheduler() {
  stopScheduler();
  const sched = readSchedule();
  if (!sched.enabled) return;

  // Check every minute
  scheduleTimer = setInterval(() => {
    const s = readSchedule();
    if (!s.enabled || !s.nextRun) return;
    if (new Date() >= new Date(s.nextRun)) {
      try {
        performBackup('auto');
        pruneOldBackups(s.retainCount || 7);
      } catch (e) {
        appendLog({
          id: Date.now().toString(),
          label: 'auto',
          status: 'failed',
          error: e.message,
          createdAt: new Date().toISOString(),
        });
      }
      const updated = readSchedule();
      updated.lastRun = new Date().toISOString();
      updated.nextRun = calcNextRun(updated.frequency, updated.time);
      writeSchedule(updated);
    }
  }, 60_000);
}

// ── IPC Handlers ──────────────────────────────────────────
module.exports = function registerBackupIPC() {
  // Start scheduler on load
  startScheduler();

  // ── Manual backup ─────────────────────────────────────
  ipcMain.handle('backup:create', (_, label = 'manual') => {
    try {
      const entry = performBackup(label);
      return { success: true, entry };
    } catch (err) {
      console.error('backup:create', err);
      appendLog({
        id: Date.now().toString(),
        label,
        status: 'failed',
        error: err.message,
        createdAt: new Date().toISOString(),
      });
      return { success: false, error: err.message };
    }
  });

  // ── List backup history ───────────────────────────────
  ipcMain.handle('backup:getHistory', () => {
    try {
      const log = readLog();
      // Enrich with current file existence + size
      return log.map((entry) => ({
        ...entry,
        exists: entry.path ? fs.existsSync(entry.path) : false,
      }));
    } catch (err) {
      console.error('backup:getHistory', err);
      return [];
    }
  });

  // ── List backup files on disk ─────────────────────────
  ipcMain.handle('backup:listFiles', () => {
    try {
      ensureBackupDir();
      const files = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith('.db') || f.endsWith('.bak'))
        .map((f) => {
          const fp = path.join(BACKUP_DIR, f);
          const stat = fs.statSync(fp);
          return {
            filename: f,
            path: fp,
            size: stat.size,
            sizeLabel: formatBytes(stat.size),
            createdAt: stat.birthtime.toISOString(),
            modifiedAt: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
      return { success: true, files, dir: BACKUP_DIR };
    } catch (err) {
      console.error('backup:listFiles', err);
      return { success: false, error: err.message, files: [] };
    }
  });

  // ── Delete a backup file ──────────────────────────────
  ipcMain.handle('backup:delete', (_, filename) => {
    try {
      const fp = path.join(BACKUP_DIR, path.basename(filename));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      // Remove from log too
      const log = readLog().filter((e) => e.filename !== filename);
      writeLog(log);
      return { success: true };
    } catch (err) {
      console.error('backup:delete', err);
      return { success: false, error: err.message };
    }
  });

  // ── Export (copy) backup to user-chosen folder ────────
  ipcMain.handle('backup:export', async (_, filename) => {
    try {
      const src = path.join(BACKUP_DIR, path.basename(filename));
      if (!fs.existsSync(src)) return { success: false, error: 'File not found.' };

      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save backup file',
        defaultPath: filename,
        filters: [{ name: 'Database backup', extensions: ['db', 'bak'] }],
      });

      if (canceled || !filePath) return { success: false, error: 'Cancelled.' };

      fs.copyFileSync(src, filePath);
      return { success: true, dest: filePath };
    } catch (err) {
      console.error('backup:export', err);
      return { success: false, error: err.message };
    }
  });

  // ── Restore from a backup file ────────────────────────
  ipcMain.handle('backup:restore', async (_, filename) => {
    try {
      const src = path.join(BACKUP_DIR, path.basename(filename));
      if (!fs.existsSync(src)) return { success: false, error: 'Backup file not found.' };

      // Safety: take a backup BEFORE restore
      try {
        performBackup('pre-restore');
      } catch {}

      // Close the DB, copy, then reopen
      // better-sqlite3: close then re-open after file copy
      db.close();
      fs.copyFileSync(src, DB_PATH);

      // Re-open (the require cache still holds db — reinitialize)
      const Database = require('better-sqlite3');
      const newDb = new Database(DB_PATH);
      // Copy pragmas
      newDb.pragma('journal_mode = WAL');
      newDb.pragma('foreign_keys = ON');

      // Replace module cache reference so all future db calls use new instance
      const dbModule = require.resolve('../db');
      require.cache[dbModule].exports = newDb;

      appendLog({
        id: Date.now().toString(),
        label: 'restore',
        filename,
        status: 'restored',
        createdAt: new Date().toISOString(),
        sizeLabel: formatBytes(fs.statSync(src).size),
      });

      return { success: true };
    } catch (err) {
      console.error('backup:restore', err);
      return { success: false, error: err.message };
    }
  });

  // ── Restore from external file (user picks file) ──────
  ipcMain.handle('backup:restoreFromFile', async () => {
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'Select backup file to restore',
        filters: [{ name: 'Database backup', extensions: ['db', 'bak', 'sqlite'] }],
        properties: ['openFile'],
      });

      if (canceled || !filePaths.length) return { success: false, error: 'Cancelled.' };

      const src = filePaths[0];

      // Safety backup before restore
      try {
        performBackup('pre-restore');
      } catch {}

      db.close();
      fs.copyFileSync(src, DB_PATH);

      const Database = require('better-sqlite3');
      const newDb = new Database(DB_PATH);
      newDb.pragma('journal_mode = WAL');
      newDb.pragma('foreign_keys = ON');
      const dbModule = require.resolve('../db');
      require.cache[dbModule].exports = newDb;

      appendLog({
        id: Date.now().toString(),
        label: 'restore-external',
        filename: path.basename(src),
        status: 'restored',
        createdAt: new Date().toISOString(),
        sizeLabel: formatBytes(fs.statSync(DB_PATH).size),
      });

      return { success: true };
    } catch (err) {
      console.error('backup:restoreFromFile', err);
      return { success: false, error: err.message };
    }
  });

  // ── Get DB info / stats ───────────────────────────────
  ipcMain.handle('backup:getDbInfo', () => {
    try {
      ensureBackupDir();

      let dbSize = 0;
      try {
        dbSize = fs.statSync(DB_PATH).size;
      } catch {}

      // Count records in key tables
      const tables = [
        'ProductMaster',
        'SaleMaster',
        'CustomerMaster',
        'Suppliers',
        'PurchaseOrders',
      ];
      const counts = {};
      for (const t of tables) {
        try {
          counts[t] = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get().n;
        } catch {
          counts[t] = 0;
        }
      }

      // Backup folder size
      let backupDirSize = 0;
      let backupCount = 0;
      try {
        const bfiles = fs
          .readdirSync(BACKUP_DIR)
          .filter((f) => f.endsWith('.db') || f.endsWith('.bak'));
        backupCount = bfiles.length;
        backupDirSize = bfiles.reduce((s, f) => {
          try {
            return s + fs.statSync(path.join(BACKUP_DIR, f)).size;
          } catch {
            return s;
          }
        }, 0);
      } catch {}

      const log = readLog();
      const lastOk = log.find((e) => e.status === 'success' || e.status === 'restored');
      const sched = readSchedule();

      return {
        dbPath: DB_PATH,
        dbSize,
        dbSizeLabel: formatBytes(dbSize),
        backupDir: BACKUP_DIR,
        backupCount,
        backupDirSize,
        backupDirSizeLabel: formatBytes(backupDirSize),
        tableCounts: counts,
        lastBackup: lastOk?.createdAt ?? null,
        totalBackups: log.length,
        schedule: sched,
      };
    } catch (err) {
      console.error('backup:getDbInfo', err);
      return null;
    }
  });

  // ── Get / Save schedule ───────────────────────────────
  ipcMain.handle('backup:getSchedule', () => {
    return readSchedule();
  });

  ipcMain.handle('backup:saveSchedule', (_, sched) => {
    try {
      const next = sched.enabled ? calcNextRun(sched.frequency, sched.time) : null;
      const updated = { ...readSchedule(), ...sched, nextRun: next };
      writeSchedule(updated);
      // Restart scheduler with new settings
      startScheduler();
      return { success: true, schedule: updated };
    } catch (err) {
      console.error('backup:saveSchedule', err);
      return { success: false, error: err.message };
    }
  });

  // ── Open backup folder in file explorer ──────────────
  ipcMain.handle('backup:openFolder', async () => {
    try {
      ensureBackupDir();
      const { shell } = require('electron');
      await shell.openPath(BACKUP_DIR);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Clear backup log (not files) ─────────────────────
  ipcMain.handle('backup:clearLog', () => {
    try {
      writeLog([]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
};
