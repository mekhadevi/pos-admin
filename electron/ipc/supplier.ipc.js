// electron/ipc/supplier.ipc.js
// Builds on top of existing Suppliers & PurchaseOrders tables from inventoryMigrations().
// Adds: ContactPerson, Notes, Website, Phone2, WhatsApp, PaymentTerms, LeadTimeDays,
//       Currency, UpdatedAt columns + new SupplierPayments table.

const { ipcMain } = require('electron');
const db = require('../db');

// ── Schema patch (idempotent) ─────────────────────────────
function patchSupplierSchema() {
  const cols = db
    .prepare(`PRAGMA table_info(Suppliers)`)
    .all()
    .map((c) => c.name);

  const addCol = (col, def) => {
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE Suppliers ADD COLUMN ${col} ${def}`);
      console.log(`DB: Suppliers.${col} added`);
    }
  };

  addCol('ContactPerson', 'TEXT');
  addCol('Notes', 'TEXT');
  addCol('Website', 'TEXT');
  addCol('Phone2', 'TEXT');
  addCol('WhatsApp', 'TEXT');
  addCol('PaymentTerms', 'TEXT'); // e.g. "Net 30", "COD"
  addCol('LeadTimeDays', 'INTEGER');
  addCol('Currency', "TEXT DEFAULT 'BHD'");
  addCol('UpdatedAt', 'TEXT');

  // ── SupplierPayments table ────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS SupplierPayments (
      Id              INTEGER PRIMARY KEY AUTOINCREMENT,
      CompanyId       INTEGER NOT NULL,
      SupplierId      INTEGER NOT NULL,
      PurchaseOrderId INTEGER,                         -- optional: link to a PO
      Amount          REAL    NOT NULL,
      Method          TEXT    NOT NULL DEFAULT 'bank', -- bank | cash | cheque | transfer
      Reference       TEXT,                            -- cheque no / transfer ref
      Note            TEXT,
      PaidAt          TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      CreatedAt       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (CompanyId)       REFERENCES CompanyMaster(Id),
      FOREIGN KEY (SupplierId)      REFERENCES Suppliers(Id),
      FOREIGN KEY (PurchaseOrderId) REFERENCES PurchaseOrders(Id)
    );
    CREATE INDEX IF NOT EXISTS idx_spay_supplier ON SupplierPayments(SupplierId);
    CREATE INDEX IF NOT EXISTS idx_spay_company  ON SupplierPayments(CompanyId);
    CREATE INDEX IF NOT EXISTS idx_spay_po       ON SupplierPayments(PurchaseOrderId);
  `);

  console.log('DB: supplier schema ready');
}

// ─────────────────────────────────────────────────────────
module.exports = function registerSupplierIPC() {
  try {
    patchSupplierSchema();
  } catch (e) {
    console.error('patchSupplierSchema', e);
  }

  // ════════════════════════════════════════════════════════
  // SUPPLIERS CRUD
  // ════════════════════════════════════════════════════════

  // ── List all (with aggregates) ─────────────────────────
  ipcMain.handle('suppliers:getAll', (_, companyId) => {
    try {
      return db
        .prepare(
          `
        SELECT
          s.*,
          COUNT(DISTINCT po.Id)                                       AS TotalOrders,
          COALESCE(SUM(CASE WHEN po.Status != 'cancelled' THEN po.TotalAmount ELSE 0 END), 0) AS TotalValue,
          MAX(po.CreatedAt)                                           AS LastOrderAt,
          SUM(CASE WHEN po.Status = 'pending'  THEN 1 ELSE 0 END)    AS PendingOrders,
          SUM(CASE WHEN po.Status = 'received' THEN 1 ELSE 0 END)    AS ReceivedOrders,
          -- Outstanding = total of pending POs minus any payments made
          COALESCE(SUM(CASE WHEN po.Status = 'pending' THEN po.TotalAmount ELSE 0 END), 0)
            - COALESCE((SELECT SUM(sp.Amount) FROM SupplierPayments sp WHERE sp.SupplierId = s.Id AND sp.CompanyId = s.CompanyId), 0)
            AS OutstandingBalance
        FROM Suppliers s
        LEFT JOIN PurchaseOrders po
          ON po.SupplierId = s.Id AND po.CompanyId = s.CompanyId
        WHERE s.CompanyId = ? AND s.IsDeleted = 0
        GROUP BY s.Id
        ORDER BY s.Name ASC
      `,
        )
        .all(companyId);
    } catch (err) {
      console.error('suppliers:getAll', err);
      return [];
    }
  });

  // ── Get single ─────────────────────────────────────────
  ipcMain.handle('suppliers:getById', (_, id) => {
    try {
      return db.prepare(`SELECT * FROM Suppliers WHERE Id = ? AND IsDeleted = 0`).get(id) ?? null;
    } catch (err) {
      console.error('suppliers:getById', err);
      return null;
    }
  });

  // ── Create ─────────────────────────────────────────────
  ipcMain.handle('suppliers:create', (_, payload) => {
    const {
      companyId,
      name,
      phone,
      phone2,
      email,
      address,
      contactPerson,
      website,
      whatsApp,
      paymentTerms,
      leadTimeDays,
      currency,
      notes,
    } = payload;
    try {
      if (!name?.trim()) return { success: false, error: 'Supplier name is required.' };
      const r = db
        .prepare(
          `
        INSERT INTO Suppliers
          (CompanyId, Name, Phone, Phone2, Email, Address, ContactPerson,
           Website, WhatsApp, PaymentTerms, LeadTimeDays, Currency, Notes, CreatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))
      `,
        )
        .run(
          companyId,
          name.trim(),
          phone ?? null,
          phone2 ?? null,
          email ?? null,
          address ?? null,
          contactPerson ?? null,
          website ?? null,
          whatsApp ?? null,
          paymentTerms ?? null,
          leadTimeDays ?? null,
          currency ?? 'BHD',
          notes ?? null,
        );
      return { success: true, id: r.lastInsertRowid };
    } catch (err) {
      console.error('suppliers:create', err);
      return { success: false, error: err.message };
    }
  });

  // ── Update ─────────────────────────────────────────────
  ipcMain.handle('suppliers:update', (_, id, payload) => {
    const {
      name,
      phone,
      phone2,
      email,
      address,
      contactPerson,
      website,
      whatsApp,
      paymentTerms,
      leadTimeDays,
      currency,
      notes,
    } = payload;
    try {
      db.prepare(
        `
        UPDATE Suppliers
        SET Name=?, Phone=?, Phone2=?, Email=?, Address=?, ContactPerson=?,
            Website=?, WhatsApp=?, PaymentTerms=?, LeadTimeDays=?, Currency=?, Notes=?,
            UpdatedAt=datetime('now','localtime')
        WHERE Id=?
      `,
      ).run(
        name,
        phone ?? null,
        phone2 ?? null,
        email ?? null,
        address ?? null,
        contactPerson ?? null,
        website ?? null,
        whatsApp ?? null,
        paymentTerms ?? null,
        leadTimeDays ?? null,
        currency ?? 'BHD',
        notes ?? null,
        id,
      );
      return { success: true };
    } catch (err) {
      console.error('suppliers:update', err);
      return { success: false, error: err.message };
    }
  });

  // ── Soft delete (blocked if pending POs) ───────────────
  ipcMain.handle('suppliers:delete', (_, id) => {
    try {
      const pending = db
        .prepare(`SELECT COUNT(*) as n FROM PurchaseOrders WHERE SupplierId=? AND Status='pending'`)
        .get(id).n;
      if (pending > 0)
        return { success: false, error: `Cannot delete: ${pending} pending order(s) still open.` };
      db.prepare(
        `UPDATE Suppliers SET IsDeleted=1, UpdatedAt=datetime('now','localtime') WHERE Id=?`,
      ).run(id);
      return { success: true };
    } catch (err) {
      console.error('suppliers:delete', err);
      return { success: false, error: err.message };
    }
  });

  // ════════════════════════════════════════════════════════
  // STATS
  // ════════════════════════════════════════════════════════
  ipcMain.handle('suppliers:getStats', (_, companyId) => {
    try {
      const total = db
        .prepare(`SELECT COUNT(*) as n FROM Suppliers WHERE CompanyId=? AND IsDeleted=0`)
        .get(companyId).n;

      const activeThisMonth = db
        .prepare(
          `
        SELECT COUNT(DISTINCT SupplierId) as n FROM PurchaseOrders
        WHERE CompanyId=? AND strftime('%Y-%m',CreatedAt)=strftime('%Y-%m','now','localtime')
      `,
        )
        .get(companyId).n;

      const totalSpend = db
        .prepare(
          `
        SELECT COALESCE(SUM(TotalAmount),0) as v FROM PurchaseOrders
        WHERE CompanyId=? AND Status='received'
      `,
        )
        .get(companyId).v;

      const pendingOrders = db
        .prepare(`SELECT COUNT(*) as n FROM PurchaseOrders WHERE CompanyId=? AND Status='pending'`)
        .get(companyId).n;

      const pendingValue = db
        .prepare(
          `
        SELECT COALESCE(SUM(TotalAmount),0) as v FROM PurchaseOrders
        WHERE CompanyId=? AND Status='pending'
      `,
        )
        .get(companyId).v;

      const totalPaid = db
        .prepare(`SELECT COALESCE(SUM(Amount),0) as v FROM SupplierPayments WHERE CompanyId=?`)
        .get(companyId).v;

      const totalOutstanding = Math.max(0, pendingValue - totalPaid);

      const topSupplier = db
        .prepare(
          `
        SELECT s.Name, COALESCE(SUM(po.TotalAmount),0) AS TotalValue
        FROM Suppliers s
        LEFT JOIN PurchaseOrders po ON po.SupplierId=s.Id AND po.Status='received'
        WHERE s.CompanyId=? AND s.IsDeleted=0
        GROUP BY s.Id ORDER BY TotalValue DESC LIMIT 1
      `,
        )
        .get(companyId);

      return {
        total,
        activeThisMonth,
        totalSpend,
        pendingOrders,
        pendingValue,
        totalPaid,
        totalOutstanding,
        topSupplier,
      };
    } catch (err) {
      console.error('suppliers:getStats', err);
      return {
        total: 0,
        activeThisMonth: 0,
        totalSpend: 0,
        pendingOrders: 0,
        pendingValue: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        topSupplier: null,
      };
    }
  });

  // ════════════════════════════════════════════════════════
  // PURCHASE ORDERS
  // ════════════════════════════════════════════════════════
  ipcMain.handle('suppliers:getPurchaseOrders', (_, supplierId, companyId) => {
    try {
      return db
        .prepare(
          `
        SELECT
          po.*,
          COUNT(poi.Id) AS ItemCount,
          COALESCE(
            (SELECT SUM(sp.Amount) FROM SupplierPayments sp WHERE sp.PurchaseOrderId = po.Id),
            0
          ) AS AmountPaid
        FROM   PurchaseOrders po
        LEFT   JOIN PurchaseOrderItems poi ON poi.PurchaseOrderId = po.Id
        WHERE  po.SupplierId=? AND po.CompanyId=?
        GROUP  BY po.Id
        ORDER  BY po.CreatedAt DESC
      `,
        )
        .all(supplierId, companyId);
    } catch (err) {
      console.error('suppliers:getPurchaseOrders', err);
      return [];
    }
  });

  // ════════════════════════════════════════════════════════
  // PRODUCTS SUPPLIED
  // ════════════════════════════════════════════════════════
  ipcMain.handle('suppliers:getProducts', (_, supplierId, companyId) => {
    try {
      return db
        .prepare(
          `
        SELECT
          p.Id, p.Name, p.SKU, p.Barcode, p.Price AS SalePrice, p.StockQty, p.LowStockThreshold,
          p.VATRate, p.IsVATInclusive,
          c.Name AS CategoryName,
          COUNT(DISTINCT po.Id)     AS OrderCount,
          COALESCE(SUM(poi.Qty), 0) AS TotalQtyOrdered,
          MIN(poi.UnitCost)         AS MinUnitCost,
          MAX(poi.UnitCost)         AS MaxUnitCost,
          AVG(poi.UnitCost)         AS AvgUnitCost,
          MAX(po.CreatedAt)         AS LastOrdered
        FROM PurchaseOrderItems poi
        JOIN PurchaseOrders  po ON po.Id  = poi.PurchaseOrderId
        JOIN ProductMaster   p  ON p.Id   = poi.ProductId
        LEFT JOIN CategoryMaster c ON c.Id = p.CategoryId
        WHERE po.SupplierId=? AND po.CompanyId=? AND p.IsDeleted=0
        GROUP BY p.Id
        ORDER BY OrderCount DESC, p.Name ASC
      `,
        )
        .all(supplierId, companyId);
    } catch (err) {
      console.error('suppliers:getProducts', err);
      return [];
    }
  });

  // ── All products across all suppliers (for products page) ──
  ipcMain.handle('suppliers:getAllProducts', (_, companyId) => {
    try {
      return db
        .prepare(
          `
        SELECT
          p.Id, p.Name, p.SKU, p.Price AS SalePrice, p.StockQty, p.LowStockThreshold,
          s.Id AS SupplierId, s.Name AS SupplierName,
          AVG(poi.UnitCost)         AS AvgUnitCost,
          MAX(po.CreatedAt)         AS LastOrdered,
          COALESCE(SUM(poi.Qty), 0) AS TotalQtyOrdered
        FROM PurchaseOrderItems poi
        JOIN PurchaseOrders po ON po.Id  = poi.PurchaseOrderId
        JOIN ProductMaster  p  ON p.Id   = poi.ProductId
        JOIN Suppliers      s  ON s.Id   = po.SupplierId AND s.IsDeleted=0
        WHERE po.CompanyId=? AND p.IsDeleted=0
        GROUP BY p.Id, s.Id
        ORDER BY p.Name ASC
      `,
        )
        .all(companyId);
    } catch (err) {
      console.error('suppliers:getAllProducts', err);
      return [];
    }
  });

  // ════════════════════════════════════════════════════════
  // PAYMENTS / BALANCE
  // ════════════════════════════════════════════════════════

  // ── Payments for a supplier ────────────────────────────
  ipcMain.handle('suppliers:getPayments', (_, supplierId, companyId) => {
    try {
      return db
        .prepare(
          `
        SELECT sp.*, po.PoNumber
        FROM   SupplierPayments sp
        LEFT   JOIN PurchaseOrders po ON po.Id = sp.PurchaseOrderId
        WHERE  sp.SupplierId=? AND sp.CompanyId=?
        ORDER  BY sp.PaidAt DESC
      `,
        )
        .all(supplierId, companyId);
    } catch (err) {
      console.error('suppliers:getPayments', err);
      return [];
    }
  });

  // ── Balance summary for a supplier ────────────────────
  ipcMain.handle('suppliers:getBalance', (_, supplierId, companyId) => {
    try {
      const totalOrdered = db
        .prepare(
          `
        SELECT COALESCE(SUM(TotalAmount),0) as v FROM PurchaseOrders
        WHERE SupplierId=? AND CompanyId=? AND Status != 'cancelled'
      `,
        )
        .get(supplierId, companyId).v;

      const totalPending = db
        .prepare(
          `
        SELECT COALESCE(SUM(TotalAmount),0) as v FROM PurchaseOrders
        WHERE SupplierId=? AND CompanyId=? AND Status='pending'
      `,
        )
        .get(supplierId, companyId).v;

      const totalReceived = db
        .prepare(
          `
        SELECT COALESCE(SUM(TotalAmount),0) as v FROM PurchaseOrders
        WHERE SupplierId=? AND CompanyId=? AND Status='received'
      `,
        )
        .get(supplierId, companyId).v;

      const totalPaid = db
        .prepare(
          `
        SELECT COALESCE(SUM(Amount),0) as v FROM SupplierPayments
        WHERE SupplierId=? AND CompanyId=?
      `,
        )
        .get(supplierId, companyId).v;

      const outstanding = Math.max(0, totalOrdered - totalPaid);

      // Per-PO balance breakdown
      const poBreakdown = db
        .prepare(
          `
        SELECT
          po.Id, po.PoNumber, po.TotalAmount, po.Status, po.CreatedAt,
          COALESCE(
            (SELECT SUM(sp.Amount) FROM SupplierPayments sp WHERE sp.PurchaseOrderId = po.Id),
            0
          ) AS AmountPaid
        FROM PurchaseOrders po
        WHERE po.SupplierId=? AND po.CompanyId=? AND po.Status != 'cancelled'
        ORDER BY po.CreatedAt DESC
      `,
        )
        .all(supplierId, companyId)
        .map((r) => ({
          ...r,
          Balance: Math.max(0, r.TotalAmount - r.AmountPaid),
        }));

      return { totalOrdered, totalPending, totalReceived, totalPaid, outstanding, poBreakdown };
    } catch (err) {
      console.error('suppliers:getBalance', err);
      return {
        totalOrdered: 0,
        totalPending: 0,
        totalReceived: 0,
        totalPaid: 0,
        outstanding: 0,
        poBreakdown: [],
      };
    }
  });

  // ── Record a payment ───────────────────────────────────
  ipcMain.handle('suppliers:recordPayment', (_, payload) => {
    const { companyId, supplierId, purchaseOrderId, amount, method, reference, note, paidAt } =
      payload;
    try {
      if (!amount || amount <= 0)
        return { success: false, error: 'Amount must be greater than zero.' };
      const r = db
        .prepare(
          `
        INSERT INTO SupplierPayments
          (CompanyId, SupplierId, PurchaseOrderId, Amount, Method, Reference, Note, PaidAt, CreatedAt)
        VALUES (?,?,?,?,?,?,?,?,datetime('now','localtime'))
      `,
        )
        .run(
          companyId,
          supplierId,
          purchaseOrderId ?? null,
          amount,
          method ?? 'bank',
          reference ?? null,
          note ?? null,
          paidAt ?? new Date().toISOString().slice(0, 10),
        );
      console.log(`suppliers: payment recorded id=${r.lastInsertRowid} amount=${amount}`);
      return { success: true, id: r.lastInsertRowid };
    } catch (err) {
      console.error('suppliers:recordPayment', err);
      return { success: false, error: err.message };
    }
  });

  // ── Delete a payment ───────────────────────────────────
  ipcMain.handle('suppliers:deletePayment', (_, id) => {
    try {
      db.prepare(`DELETE FROM SupplierPayments WHERE Id=?`).run(id);
      return { success: true };
    } catch (err) {
      console.error('suppliers:deletePayment', err);
      return { success: false, error: err.message };
    }
  });

  // ── Outstanding balances across all suppliers ──────────
  ipcMain.handle('suppliers:getOutstandingAll', (_, companyId) => {
    try {
      return db
        .prepare(
          `
        SELECT
          s.Id, s.Name, s.Phone, s.Email, s.ContactPerson,
          COALESCE(SUM(CASE WHEN po.Status='pending' THEN po.TotalAmount ELSE 0 END), 0) AS PendingValue,
          COALESCE((SELECT SUM(sp.Amount) FROM SupplierPayments sp WHERE sp.SupplierId=s.Id AND sp.CompanyId=s.CompanyId), 0) AS TotalPaid,
          COALESCE(SUM(CASE WHEN po.Status='pending' THEN po.TotalAmount ELSE 0 END), 0)
            - COALESCE((SELECT SUM(sp.Amount) FROM SupplierPayments sp WHERE sp.SupplierId=s.Id AND sp.CompanyId=s.CompanyId), 0)
            AS Outstanding
        FROM Suppliers s
        LEFT JOIN PurchaseOrders po ON po.SupplierId=s.Id AND po.CompanyId=s.CompanyId
        WHERE s.CompanyId=? AND s.IsDeleted=0
        GROUP BY s.Id
        HAVING Outstanding > 0
        ORDER BY Outstanding DESC
      `,
        )
        .all(companyId);
    } catch (err) {
      console.error('suppliers:getOutstandingAll', err);
      return [];
    }
  });

  // ════════════════════════════════════════════════════════
  // EXPORT
  // ════════════════════════════════════════════════════════
  ipcMain.handle('suppliers:export', (_, companyId) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT s.Name, s.Phone, s.Email, s.Address, s.ContactPerson,
               s.Website, s.PaymentTerms, s.LeadTimeDays,
               COUNT(DISTINCT po.Id)            AS TotalOrders,
               COALESCE(SUM(po.TotalAmount), 0) AS TotalValue,
               COALESCE((SELECT SUM(sp.Amount) FROM SupplierPayments sp WHERE sp.SupplierId=s.Id),0) AS TotalPaid,
               s.CreatedAt
        FROM Suppliers s
        LEFT JOIN PurchaseOrders po ON po.SupplierId=s.Id AND po.Status != 'cancelled'
        WHERE s.CompanyId=? AND s.IsDeleted=0
        GROUP BY s.Id ORDER BY s.Name ASC
      `,
        )
        .all(companyId);

      const header =
        'Name,Phone,Email,Address,Contact Person,Website,Payment Terms,Lead Days,Total Orders,Total Value,Total Paid,Added';
      const lines = rows.map(
        (r) =>
          `"${r.Name}","${r.Phone ?? ''}","${r.Email ?? ''}","${r.Address ?? ''}","${r.ContactPerson ?? ''}","${r.Website ?? ''}","${r.PaymentTerms ?? ''}",${r.LeadTimeDays ?? ''},${r.TotalOrders},${r.TotalValue},${r.TotalPaid},"${r.CreatedAt}"`,
      );
      return { success: true, csv: [header, ...lines].join('\n') };
    } catch (err) {
      console.error('suppliers:export', err);
      return { success: false, error: err.message };
    }
  });
};
