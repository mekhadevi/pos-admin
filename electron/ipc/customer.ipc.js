const { ipcMain } = require('electron');
const db = require('../db');

module.exports = function registerCustomerIPC() {
  // ── List all customers ─────────────────────────────────
  ipcMain.handle('customers:getAll', (_, companyId) => {
    try {
      return db
        .prepare(
          `
        SELECT *,
          COALESCE(TotalOrders,   0) AS TotalOrders,
          COALESCE(TotalSpent,    0) AS TotalSpent,
          COALESCE(LoyaltyPoints, 0) AS LoyaltyPoints
        FROM CustomerMaster
        WHERE CompanyId = ? AND IsDeleted = 0
        ORDER BY Name ASC
      `,
        )
        .all(companyId);
    } catch (err) {
      console.error('customers:getAll', err);
      return [];
    }
  });

  // ── Get single customer ────────────────────────────────
  ipcMain.handle('customers:getById', (_, id) => {
    try {
      return (
        db.prepare(`SELECT * FROM CustomerMaster WHERE Id = ? AND IsDeleted = 0`).get(id) ?? null
      );
    } catch (err) {
      console.error('customers:getById', err);
      return null;
    }
  });

  // ── Search ─────────────────────────────────────────────
  ipcMain.handle('customers:search', (_, companyId, query) => {
    try {
      const q = `%${query}%`;
      return db
        .prepare(
          `
        SELECT * FROM CustomerMaster
        WHERE CompanyId = ? AND IsDeleted = 0
          AND (Name LIKE ? OR Phone LIKE ? OR Email LIKE ?)
        ORDER BY Name ASC LIMIT 20
      `,
        )
        .all(companyId, q, q, q);
    } catch (err) {
      console.error('customers:search', err);
      return [];
    }
  });

  // ── Create ─────────────────────────────────────────────
  ipcMain.handle('customers:create', (_, payload) => {
    const { companyId, branchId, name, phone, email, address, notes } = payload;
    try {
      if (phone) {
        const dup = db
          .prepare(
            `
          SELECT Id FROM CustomerMaster WHERE CompanyId = ? AND Phone = ? AND IsDeleted = 0
        `,
          )
          .get(companyId, phone);
        if (dup)
          return { success: false, error: 'A customer with this phone number already exists.' };
      }
      const r = db
        .prepare(
          `
        INSERT INTO CustomerMaster (CompanyId, BranchId, Name, Phone, Email, Address, Notes, CreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
      `,
        )
        .run(
          companyId,
          branchId ?? null,
          name,
          phone ?? null,
          email ?? null,
          address ?? null,
          notes ?? null,
        );
      return { success: true, id: r.lastInsertRowid };
    } catch (err) {
      console.error('customers:create', err);
      return { success: false, error: err.message };
    }
  });

  // ── Update ─────────────────────────────────────────────
  ipcMain.handle('customers:update', (_, id, payload) => {
    const { name, phone, email, address, notes } = payload;
    try {
      db.prepare(
        `
        UPDATE CustomerMaster
        SET Name = ?, Phone = ?, Email = ?, Address = ?, Notes = ?,
            UpdatedAt = datetime('now','localtime')
        WHERE Id = ?
      `,
      ).run(name, phone ?? null, email ?? null, address ?? null, notes ?? null, id);
      return { success: true };
    } catch (err) {
      console.error('customers:update', err);
      return { success: false, error: err.message };
    }
  });

  // ── Soft delete ────────────────────────────────────────
  ipcMain.handle('customers:delete', (_, id) => {
    try {
      db.prepare(
        `
        UPDATE CustomerMaster SET IsDeleted = 1, UpdatedAt = datetime('now','localtime') WHERE Id = ?
      `,
      ).run(id);
      return { success: true };
    } catch (err) {
      console.error('customers:delete', err);
      return { success: false, error: err.message };
    }
  });

  // ── Stats ──────────────────────────────────────────────
  ipcMain.handle('customers:getStats', (_, companyId) => {
    try {
      const total = db
        .prepare(`SELECT COUNT(*) as n FROM CustomerMaster WHERE CompanyId=? AND IsDeleted=0`)
        .get(companyId).n;
      const newThisMonth = db
        .prepare(
          `
        SELECT COUNT(*) as n FROM CustomerMaster
        WHERE CompanyId=? AND IsDeleted=0
          AND strftime('%Y-%m', CreatedAt) = strftime('%Y-%m','now','localtime')
      `,
        )
        .get(companyId).n;
      const topSpender = db
        .prepare(
          `
        SELECT Name, TotalSpent FROM CustomerMaster WHERE CompanyId=? AND IsDeleted=0
        ORDER BY TotalSpent DESC LIMIT 1
      `,
        )
        .get(companyId);
      const totalRevenue = db
        .prepare(
          `
        SELECT COALESCE(SUM(TotalSpent),0) as v FROM CustomerMaster WHERE CompanyId=? AND IsDeleted=0
      `,
        )
        .get(companyId).v;
      const withLoyalty = db
        .prepare(
          `
        SELECT COUNT(*) as n FROM CustomerMaster WHERE CompanyId=? AND IsDeleted=0 AND LoyaltyPoints > 0
      `,
        )
        .get(companyId).n;
      return { total, newThisMonth, topSpender, totalRevenue, withLoyalty };
    } catch (err) {
      console.error('customers:getStats', err);
      return { total: 0, newThisMonth: 0, topSpender: null, totalRevenue: 0, withLoyalty: 0 };
    }
  });

  // ── Purchase history ───────────────────────────────────
  ipcMain.handle('customers:getHistory', (_, customerId) => {
    try {
      return db
        .prepare(
          `
        SELECT sm.Id, sm.CreatedAt AS SaleDate, sm.Total, sm.PayMethod,
               sm.Subtotal, sm.Discount, COUNT(sd.Id) AS ItemCount
        FROM SaleMaster sm
        LEFT JOIN SaleDetail sd ON sd.SaleId = sm.Id
        WHERE sm.CustomerId = ? AND sm.IsDeleted = 0
        GROUP BY sm.Id
        ORDER BY sm.CreatedAt DESC LIMIT 50
      `,
        )
        .all(customerId);
    } catch (err) {
      console.error('customers:getHistory', err);
      return [];
    }
  });

  // ── Adjust loyalty points ──────────────────────────────
  ipcMain.handle('customers:adjustLoyalty', (_, id, delta) => {
    try {
      db.prepare(
        `
        UPDATE CustomerMaster
        SET LoyaltyPoints = MAX(0, LoyaltyPoints + ?),
            UpdatedAt = datetime('now','localtime')
        WHERE Id = ?
      `,
      ).run(delta, id);
      return { success: true };
    } catch (err) {
      console.error('customers:adjustLoyalty', err);
      return { success: false, error: err.message };
    }
  });

  // ── Export CSV ─────────────────────────────────────────
  ipcMain.handle('customers:export', (_, companyId) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT Name, Phone, Email, Address, LoyaltyPoints, TotalSpent, TotalOrders, CreatedAt
        FROM CustomerMaster WHERE CompanyId=? AND IsDeleted=0 ORDER BY Name ASC
      `,
        )
        .all(companyId);
      const header = 'Name,Phone,Email,Address,Loyalty Points,Total Spent,Total Orders,Joined';
      const lines = rows.map(
        (r) =>
          `"${r.Name}","${r.Phone ?? ''}","${r.Email ?? ''}","${r.Address ?? ''}",${r.LoyaltyPoints},${r.TotalSpent},${r.TotalOrders},"${r.CreatedAt}"`,
      );
      return { success: true, csv: [header, ...lines].join('\n') };
    } catch (err) {
      console.error('customers:export', err);
      return { success: false, error: err.message };
    }
  });
};
