const db = require('../db');
// NOTE: pragmas (foreign_keys etc.) belong in db.js only — not here

const migrations = [
  /* =========================================================
     v1 — Core schema
  ========================================================= */
  {
    version: 1,
    up: () =>
      db.exec(`

      CREATE TABLE IF NOT EXISTS CompanyMaster (
        Id         INTEGER PRIMARY KEY AUTOINCREMENT,
        Name       TEXT    NOT NULL,
        VATNumber  TEXT,
        Address    TEXT,
        Email      TEXT,
        Phone      TEXT,
        IsActive   INTEGER NOT NULL DEFAULT 1,
        AuditLog   TEXT,
        IsDeleted  INTEGER NOT NULL DEFAULT 0,
        CreatedAt  DATETIME DEFAULT (datetime('now')),
        UpdatedAt  DATETIME
      );

      CREATE TABLE IF NOT EXISTS BranchMaster (
        Id        INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        Name      TEXT    NOT NULL,
        Location  TEXT,
        IsDeleted INTEGER NOT NULL DEFAULT 0,
        AuditLog  TEXT,
        CreatedAt DATETIME DEFAULT (datetime('now')),
        UpdatedAt DATETIME
      );

      CREATE TABLE IF NOT EXISTS TerminalMaster (
        Id           INTEGER PRIMARY KEY AUTOINCREMENT,
        BranchId     INTEGER REFERENCES BranchMaster(Id),
        TerminalCode TEXT
      );

      CREATE TABLE IF NOT EXISTS UsersMaster (
        Id           INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId    INTEGER REFERENCES CompanyMaster(Id),
        BranchId     INTEGER REFERENCES BranchMaster(Id),
        Name         TEXT,
        Username     TEXT NOT NULL UNIQUE,
        PasswordHash TEXT,
        Role         TEXT,
        AuditLog     TEXT,
        CreatedAt    DATETIME DEFAULT (datetime('now')),
        UpdatedAt    DATETIME
      );

      CREATE TABLE IF NOT EXISTS CategoryMaster (
        Id        INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        Name      TEXT    NOT NULL,
        IsDeleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ProductMaster (
        Id                INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId         INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        CategoryId        INTEGER REFERENCES CategoryMaster(Id),
        Name              TEXT    NOT NULL,
        Barcode           TEXT    UNIQUE,
        Barcode2          TEXT,
        SKU               TEXT    UNIQUE,
        Price             REAL    NOT NULL DEFAULT 0 CHECK(Price >= 0),
        VATRate           REAL    NOT NULL DEFAULT 0 CHECK(VATRate >= 0),
        IsVATInclusive    INTEGER NOT NULL DEFAULT 0,
        StockQty          REAL    NOT NULL DEFAULT 0,
        LowStockThreshold INTEGER NOT NULL DEFAULT 10,
        ExpiryDate        DATE,
        AuditLog          TEXT,
        IsDeleted         INTEGER NOT NULL DEFAULT 0,
        CreatedAt         DATETIME DEFAULT (datetime('now')),
        UpdatedAt         DATETIME DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_product_company  ON ProductMaster(CompanyId);
      CREATE INDEX IF NOT EXISTS idx_product_barcode  ON ProductMaster(Barcode);
      CREATE INDEX IF NOT EXISTS idx_product_category ON ProductMaster(CategoryId);

      -- Qty has no CHECK(Qty > 0) so negative adjustments (removals) are allowed
      CREATE TABLE IF NOT EXISTS StockMovements (
        Id        INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        ProductId INTEGER NOT NULL REFERENCES ProductMaster(Id),
        Type      TEXT    NOT NULL
                          CHECK(Type IN ('Sale','Purchase','Adjustment','Return')),
        Qty       REAL    NOT NULL,
        Note      TEXT,
        CreatedBy INTEGER,
        CreatedAt DATETIME DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_stock_product ON StockMovements(ProductId);
      CREATE INDEX IF NOT EXISTS idx_stock_company  ON StockMovements(CompanyId);

      CREATE TABLE IF NOT EXISTS Payments (
        Id        INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId INTEGER REFERENCES CompanyMaster(Id),
        SaleId    INTEGER,
        Method    TEXT,
        Amount    REAL,
        PaidAt    DATETIME DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS NotificationLog (
        Id          INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId   INTEGER REFERENCES CompanyMaster(Id),
        Type        TEXT NOT NULL,
        ReferenceId TEXT NOT NULL,
        SentAt      DATETIME DEFAULT (datetime('now','localtime')),
        UNIQUE(Type, ReferenceId, SentAt)
      );

      CREATE TABLE IF NOT EXISTS Deliveries (
        Id        INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        BranchId  INTEGER REFERENCES BranchMaster(Id),
        Category  TEXT    NOT NULL,
        Boxes     INTEGER NOT NULL DEFAULT 0,
        Status    TEXT    NOT NULL DEFAULT 'pending'
                          CHECK(Status IN ('pending','notified','cancelled')),
        Note      TEXT,
        ArrivedAt DATETIME DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS Registers (
        Id        INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        BranchId  INTEGER REFERENCES BranchMaster(Id),
        Number    INTEGER NOT NULL,
        Status    TEXT    NOT NULL DEFAULT 'open'
                          CHECK(Status IN ('open','closed','break')),
        Cashier   TEXT,
        Message   TEXT,
        CreatedAt DATETIME DEFAULT (datetime('now')),
        UpdatedAt DATETIME DEFAULT (datetime('now')),
        UNIQUE(CompanyId, BranchId, Number)
      );
    `),
  },

  /* =========================================================
     v2 — Customers
           Must come BEFORE v3 because SaleMaster has a FK to CustomerMaster
  ========================================================= */
  {
    version: 2,
    up: () =>
      db.exec(`

      CREATE TABLE IF NOT EXISTS CustomerMaster (
        Id            INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId     INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        BranchId      INTEGER REFERENCES BranchMaster(Id),
        Name          TEXT    NOT NULL,
        Phone         TEXT,
        Email         TEXT,
        Address       TEXT,
        LoyaltyPoints INTEGER NOT NULL DEFAULT 0,
        TotalSpent    REAL    NOT NULL DEFAULT 0,
        TotalOrders   INTEGER NOT NULL DEFAULT 0,
        Notes         TEXT,
        IsDeleted     INTEGER NOT NULL DEFAULT 0,
        CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        UpdatedAt     TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_customer_company ON CustomerMaster(CompanyId);
      CREATE INDEX IF NOT EXISTS idx_customer_phone   ON CustomerMaster(Phone);
      CREATE INDEX IF NOT EXISTS idx_customer_email   ON CustomerMaster(Email);
    `),
  },

  /* =========================================================
     v3 — POS Sales
           Requires CustomerMaster (v2) to exist first
           Column is named "Change" (not "ChangeAmount") to match
           checkout.ipc.js and receipts.ipc.js
  ========================================================= */
  {
    version: 3,
    up: () =>
      db.exec(`

      CREATE TABLE IF NOT EXISTS SaleMaster (
        Id          INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId   INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        BranchId    INTEGER REFERENCES BranchMaster(Id),
        CustomerId  INTEGER REFERENCES CustomerMaster(Id),
        Subtotal    REAL    NOT NULL DEFAULT 0,
        Discount    REAL    NOT NULL DEFAULT 0,
        Total       REAL    NOT NULL DEFAULT 0,
        PayMethod   TEXT    NOT NULL DEFAULT 'cash',
        CashAmount  REAL    DEFAULT 0,
        CardAmount  REAL    DEFAULT 0,
        Change      REAL    DEFAULT 0,
        SaleDate    TEXT    NOT NULL,
        CreatedAt   TEXT    NOT NULL,
        RefundFor   INTEGER,
        Note        TEXT,
        IsDeleted   INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sale_company   ON SaleMaster(CompanyId, SaleDate);
      CREATE INDEX IF NOT EXISTS idx_sale_customer  ON SaleMaster(CustomerId);
      CREATE INDEX IF NOT EXISTS idx_sale_paymethod ON SaleMaster(CompanyId, PayMethod);
      CREATE INDEX IF NOT EXISTS idx_sale_refundfor ON SaleMaster(RefundFor);

      CREATE TABLE IF NOT EXISTS SaleDetail (
        Id        INTEGER PRIMARY KEY AUTOINCREMENT,
        SaleId    INTEGER NOT NULL REFERENCES SaleMaster(Id),
        ProductId INTEGER NOT NULL REFERENCES ProductMaster(Id),
        Qty       REAL    NOT NULL CHECK(Qty > 0),
        Price     REAL    NOT NULL CHECK(Price >= 0),
        Discount  REAL    NOT NULL DEFAULT 0,
        Total     REAL    NOT NULL CHECK(Total >= 0)
      );
      CREATE INDEX IF NOT EXISTS idx_detail_sale    ON SaleDetail(SaleId);
      CREATE INDEX IF NOT EXISTS idx_detail_product ON SaleDetail(ProductId);
    `),
  },

  /* =========================================================
     v4 — Inventory (Suppliers, Purchase Orders)
  ========================================================= */
  {
    version: 4,
    up: () =>
      db.exec(`

      CREATE TABLE IF NOT EXISTS Suppliers (
        Id        INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        Name      TEXT    NOT NULL,
        Phone     TEXT,
        Email     TEXT,
        Address   TEXT,
        IsDeleted INTEGER NOT NULL DEFAULT 0,
        CreatedAt TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_suppliers_company ON Suppliers(CompanyId);

      CREATE TABLE IF NOT EXISTS PurchaseOrders (
        Id            INTEGER PRIMARY KEY AUTOINCREMENT,
        CompanyId     INTEGER NOT NULL REFERENCES CompanyMaster(Id),
        BranchId      INTEGER REFERENCES BranchMaster(Id),
        SupplierId    INTEGER REFERENCES Suppliers(Id),
        PoNumber      TEXT    NOT NULL UNIQUE,
        InvoiceNumber TEXT,
        TotalAmount   REAL    NOT NULL DEFAULT 0,
        Status        TEXT    NOT NULL DEFAULT 'draft'
                              CHECK(Status IN ('draft','pending','received','cancelled')),
        ExpectedDate  TEXT,
        ReceivedAt    TEXT,
        Notes         TEXT,
        CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_po_company  ON PurchaseOrders(CompanyId);
      CREATE INDEX IF NOT EXISTS idx_po_supplier ON PurchaseOrders(SupplierId);

      CREATE TABLE IF NOT EXISTS PurchaseOrderItems (
        Id              INTEGER PRIMARY KEY AUTOINCREMENT,
        PurchaseOrderId INTEGER NOT NULL REFERENCES PurchaseOrders(Id),
        ProductId       INTEGER NOT NULL REFERENCES ProductMaster(Id),
        Qty             REAL    NOT NULL CHECK(Qty > 0),
        UnitCost        REAL    NOT NULL DEFAULT 0,
        Total           REAL    NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_poi_po      ON PurchaseOrderItems(PurchaseOrderId);
      CREATE INDEX IF NOT EXISTS idx_poi_product ON PurchaseOrderItems(ProductId);
    `),
  },

  /* =========================================================
     v5 — Images for products and categories
  ========================================================= */
  {
    version: 5,
    up: () =>
      db.exec(`
      ALTER TABLE ProductMaster  ADD COLUMN ImagePath TEXT;
      ALTER TABLE CategoryMaster ADD COLUMN ImagePath TEXT;
    `),
  },
];

/* =========================================================
   RUN ALL PENDING MIGRATIONS
========================================================= */
function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version   INTEGER PRIMARY KEY,
      appliedAt DATETIME DEFAULT (datetime('now'))
    )
  `);

  const applied = db
    .prepare(`SELECT version FROM _migrations`)
    .all()
    .map((r) => r.version);
  const pending = migrations.filter((m) => !applied.includes(m.version));

  if (pending.length === 0) {
    console.log('DB: all migrations up to date');
    return;
  }

  db.transaction(() => {
    for (const m of pending) {
      console.log(`DB: applying migration v${m.version}…`);
      m.up();
      db.prepare(`INSERT INTO _migrations (version) VALUES (?)`).run(m.version);
      console.log(`DB: migration v${m.version} done`);
    }
  })();

  console.log(`DB: ${pending.length} migration(s) applied`);
}

/* =========================================================
   SEED — idempotent, safe to call every startup
========================================================= */
function seedData() {
  try {
    if (db.prepare(`SELECT COUNT(*) as n FROM Suppliers`).get().n === 0) {
      db.prepare(`INSERT INTO Suppliers (CompanyId, Name) VALUES (1, 'Default Supplier')`).run();
      console.log('DB: seeded default supplier');
    }
  } catch (e) {
    console.warn('seedData Suppliers:', e.message);
  }

  try {
    if (
      db
        .prepare(
          `SELECT COUNT(*) as n FROM CustomerMaster WHERE CompanyId=1 AND Name='Walk-in Customer'`,
        )
        .get().n === 0
    ) {
      db.prepare(
        `INSERT INTO CustomerMaster (CompanyId, Name, Notes) VALUES (1,'Walk-in Customer','Default walk-in')`,
      ).run();
      console.log('DB: seeded walk-in customer');
    }
  } catch (e) {
    console.warn('seedData CustomerMaster:', e.message);
  }
}

module.exports = { runMigrations, seedData };
