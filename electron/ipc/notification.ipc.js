const { ipcMain } = require('electron');
const db = require('../db');

// getNotificationService is a getter fn so we always
// get the live instance even if it starts after registration
module.exports = function registerNotificationIPC(getNotificationService) {
  // ── Get low stock list ──────────────────────────────────
  ipcMain.handle('get-low-stock', (_, companyId) => {
    return db
      .prepare(
        `
      SELECT p.Id,
             p.Name,
             p.StockQty,
             p.LowStockThreshold,
             c.Name AS CategoryName
      FROM   ProductMaster p
      LEFT   JOIN CategoryMaster c ON p.CategoryId = c.Id
      WHERE  p.CompanyId  = ?
        AND  p.IsDeleted  = 0
        AND  p.StockQty   <= p.LowStockThreshold
      ORDER  BY p.StockQty ASC
    `,
      )
      .all(companyId);
  });

  // ── Get expiring products ───────────────────────────────
  ipcMain.handle('get-expiring', (_, companyId) => {
    return db
      .prepare(
        `
      SELECT Id,
             Name,
             StockQty,
             ExpiryDate,
             CAST(julianday(ExpiryDate) - julianday('now') AS INTEGER) AS DaysLeft
      FROM   ProductMaster
      WHERE  CompanyId   = ?
        AND  IsDeleted   = 0
        AND  ExpiryDate  IS NOT NULL
        AND  julianday(ExpiryDate) - julianday('now') <= 3
        AND  julianday(ExpiryDate) >= julianday('now')
      ORDER  BY ExpiryDate ASC
    `,
      )
      .all(companyId);
  });

  // ── Add a delivery ──────────────────────────────────────
  ipcMain.handle('add-delivery', (_, { companyId, branchId, category, boxes, note }) => {
    db.prepare(
      `
      INSERT INTO Deliveries (CompanyId, BranchId, Category, Boxes, Note, Status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `,
    ).run(companyId, branchId ?? null, category, boxes, note ?? null);

    // Trigger immediate check without waiting 30s
    getNotificationService()?.checkAll();

    return { success: true };
  });

  // ── Update register / cashier status ───────────────────
  ipcMain.handle(
    'update-register',
    (_, { companyId, branchId, number, status, cashier, message }) => {
      db.prepare(
        `
      INSERT INTO Registers (CompanyId, BranchId, Number, Status, Cashier, Message, UpdatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(CompanyId, Number) DO UPDATE SET
        Status    = excluded.Status,
        Cashier   = excluded.Cashier,
        Message   = excluded.Message,
        UpdatedAt = datetime('now')
    `,
      ).run(companyId, branchId ?? null, number, status, cashier ?? null, message ?? null);

      getNotificationService()?.checkAll();

      return { success: true };
    },
  );

  // ── Force trigger a check ───────────────────────────────
  // Call this after any stock adjustment from Angular
  ipcMain.handle('trigger-notification-check', () => {
    getNotificationService()?.checkAll();
    return { success: true };
  });
};
