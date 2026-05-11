// electron/ipc/settings.ipc.js
// Stores all settings as key/value rows in SettingsMaster table.
// Export settingsMigrations and call it from main.js before registerSettingsIPC.

const { ipcMain, app } = require('electron');
const db = require('../db');

// ── Migration ──────────────────────────────────────────────
function settingsMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS SettingsMaster (
      Key       TEXT PRIMARY KEY,
      Value     TEXT,
      UpdatedAt TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  const DEFAULTS = {
    // Company
    'company.name': 'My POS Store',
    'company.tagline': '',
    'company.vatNumber': '',
    'company.crNumber': '',
    'company.phone': '',
    'company.email': '',
    'company.address': '',
    'company.website': '',
    'company.currency': 'BHD',
    'company.currencySymbol': 'BD',
    'company.decimalPlaces': '3',
    // Receipt
    'receipt.header': '',
    'receipt.footer': 'Thank you for your visit!',
    'receipt.showLogo': 'true',
    'receipt.showVAT': 'true',
    'receipt.showBarcode': 'false',
    'receipt.copies': '1',
    'receipt.paperSize': '80mm',
    // Tax / VAT
    'tax.vatEnabled': 'false',
    'tax.vatRate': '10',
    'tax.vatInclusive': 'false',
    'tax.vatLabel': 'VAT',
    'tax.vatNumber': '',
    // POS / Sales
    'pos.allowDiscount': 'true',
    'pos.maxDiscountPct': '100',
    'pos.allowRefund': 'true',
    'pos.requireReason': 'false',
    'pos.defaultPayment': 'cash',
    'pos.loyaltyEnabled': 'false',
    'pos.loyaltyRate': '1',
    // Inventory
    'inventory.lowStockDefault': '10',
    'inventory.trackExpiry': 'true',
    'inventory.expiryAlertDays': '7',
    'inventory.autoDeductStock': 'true',
    // Notifications
    'notify.lowStock': 'true',
    'notify.expiry': 'true',
    'notify.delivery': 'true',
    'notify.sound': 'false',
    // Appearance
    'app.language': 'en',
    'app.dateFormat': 'DD MMM YYYY',
    'app.timeFormat': '12h',
    // Security
    'security.sessionTimeout': '480',
    'security.requirePin': 'false',
    'security.pin': '',
  };

  const insert = db.prepare(`INSERT OR IGNORE INTO SettingsMaster (Key, Value) VALUES (?, ?)`);
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(DEFAULTS)) insert.run(k, v);
  });
  tx();

  console.log('DB: SettingsMaster ready');
}

// ── Helpers ────────────────────────────────────────────────
function getAllSettings() {
  return Object.fromEntries(
    db
      .prepare(`SELECT Key, Value FROM SettingsMaster`)
      .all()
      .map((r) => [r.Key, r.Value]),
  );
}

function setMany(map) {
  const upsert = db.prepare(`
    INSERT INTO SettingsMaster (Key, Value, UpdatedAt)
    VALUES (?, ?, datetime('now','localtime'))
    ON CONFLICT(Key) DO UPDATE
      SET Value = excluded.Value, UpdatedAt = excluded.UpdatedAt
  `);
  db.transaction(() => {
    for (const [k, v] of Object.entries(map)) upsert.run(k, String(v ?? ''));
  })();
}

// Section default maps (used by resetSection)
const SECTION_DEFAULTS = {
  company: {
    'company.name': 'My POS Store',
    'company.tagline': '',
    'company.vatNumber': '',
    'company.crNumber': '',
    'company.phone': '',
    'company.email': '',
    'company.address': '',
    'company.website': '',
    'company.currency': 'BHD',
    'company.currencySymbol': 'BD',
    'company.decimalPlaces': '3',
  },
  receipt: {
    'receipt.header': '',
    'receipt.footer': 'Thank you for your visit!',
    'receipt.showLogo': 'true',
    'receipt.showVAT': 'true',
    'receipt.showBarcode': 'false',
    'receipt.copies': '1',
    'receipt.paperSize': '80mm',
  },
  tax: {
    'tax.vatEnabled': 'false',
    'tax.vatRate': '10',
    'tax.vatInclusive': 'false',
    'tax.vatLabel': 'VAT',
    'tax.vatNumber': '',
  },
  pos: {
    'pos.allowDiscount': 'true',
    'pos.maxDiscountPct': '100',
    'pos.allowRefund': 'true',
    'pos.requireReason': 'false',
    'pos.defaultPayment': 'cash',
    'pos.loyaltyEnabled': 'false',
    'pos.loyaltyRate': '1',
  },
  inventory: {
    'inventory.lowStockDefault': '10',
    'inventory.trackExpiry': 'true',
    'inventory.expiryAlertDays': '7',
    'inventory.autoDeductStock': 'true',
  },
  notify: {
    'notify.lowStock': 'true',
    'notify.expiry': 'true',
    'notify.delivery': 'true',
    'notify.sound': 'false',
  },
  app: { 'app.language': 'en', 'app.dateFormat': 'DD MMM YYYY', 'app.timeFormat': '12h' },
  security: {
    'security.sessionTimeout': '480',
    'security.requirePin': 'false',
    'security.pin': '',
  },
};

// ── IPC Registration ───────────────────────────────────────
function registerSettingsIPC() {
  // ── Settings CRUD ─────────────────────────────────────
  ipcMain.handle('settings:getAll', () => {
    try {
      return { success: true, data: getAllSettings() };
    } catch (err) {
      console.error('settings:getAll', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:setMany', (_, map) => {
    try {
      setMany(map);
      return { success: true };
    } catch (err) {
      console.error('settings:setMany', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:resetSection', (_, prefix) => {
    try {
      const defs = SECTION_DEFAULTS[prefix] ?? {};
      setMany(defs);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Users ─────────────────────────────────────────────
  ipcMain.handle('settings:getUsers', (_, companyId) => {
    try {
      return db
        .prepare(
          `
        SELECT Id, Name, Username, Role, BranchId, CreatedAt, UpdatedAt
        FROM UsersMaster WHERE CompanyId=? ORDER BY Name ASC
      `,
        )
        .all(companyId);
    } catch (err) {
      console.error('settings:getUsers', err);
      return [];
    }
  });

  ipcMain.handle('settings:createUser', (_, payload) => {
    const { companyId, branchId, name, username, password, role } = payload;
    try {
      if (!name?.trim()) return { success: false, error: 'Name is required.' };
      if (!username?.trim()) return { success: false, error: 'Username is required.' };
      if (!password?.trim()) return { success: false, error: 'Password is required.' };
      const dup = db.prepare(`SELECT Id FROM UsersMaster WHERE Username=?`).get(username.trim());
      if (dup) return { success: false, error: 'Username already exists.' };
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      const r = db
        .prepare(
          `
        INSERT INTO UsersMaster (CompanyId,BranchId,Name,Username,PasswordHash,Role,CreatedAt)
        VALUES (?,?,?,?,?,?,datetime('now','localtime'))
      `,
        )
        .run(companyId, branchId ?? null, name.trim(), username.trim(), hash, role ?? 'cashier');
      return { success: true, id: r.lastInsertRowid };
    } catch (err) {
      console.error('settings:createUser', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updateUser', (_, id, payload) => {
    const { name, username, role, password } = payload;
    try {
      if (password?.trim()) {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        db.prepare(
          `UPDATE UsersMaster SET Name=?,Username=?,Role=?,PasswordHash=?,UpdatedAt=datetime('now','localtime') WHERE Id=?`,
        ).run(name, username, role, hash, id);
      } else {
        db.prepare(
          `UPDATE UsersMaster SET Name=?,Username=?,Role=?,UpdatedAt=datetime('now','localtime') WHERE Id=?`,
        ).run(name, username, role, id);
      }
      return { success: true };
    } catch (err) {
      console.error('settings:updateUser', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:deleteUser', (_, id) => {
    try {
      db.prepare(`DELETE FROM UsersMaster WHERE Id=?`).run(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Branches ──────────────────────────────────────────
  ipcMain.handle('settings:getBranches', (_, companyId) => {
    try {
      return db
        .prepare(`SELECT * FROM BranchMaster WHERE CompanyId=? AND IsDeleted=0 ORDER BY Name ASC`)
        .all(companyId);
    } catch (err) {
      console.error('settings:getBranches', err);
      return [];
    }
  });

  ipcMain.handle('settings:createBranch', (_, payload) => {
    const { companyId, name, location } = payload;
    try {
      const r = db
        .prepare(
          `INSERT INTO BranchMaster (CompanyId,Name,Location,CreatedAt) VALUES (?,?,?,datetime('now','localtime'))`,
        )
        .run(companyId, name.trim(), location ?? null);
      return { success: true, id: r.lastInsertRowid };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updateBranch', (_, id, payload) => {
    try {
      db.prepare(
        `UPDATE BranchMaster SET Name=?,Location=?,UpdatedAt=datetime('now','localtime') WHERE Id=?`,
      ).run(payload.name, payload.location ?? null, id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:deleteBranch', (_, id) => {
    try {
      db.prepare(
        `UPDATE BranchMaster SET IsDeleted=1,UpdatedAt=datetime('now','localtime') WHERE Id=?`,
      ).run(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── App info ──────────────────────────────────────────
  ipcMain.handle('settings:getAppInfo', () => {
    try {
      return {
        version: app.getVersion(),
        name: app.getName(),
        userData: app.getPath('userData'),
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        node: process.versions.node,
      };
    } catch {
      return {};
    }
  });
}

module.exports = registerSettingsIPC;
module.exports.settingsMigrations = settingsMigrations;
