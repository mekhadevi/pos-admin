const db = require('../db');

const migrations = [
  {
    version: 1,
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS CompanyMaster (
          Id         INTEGER PRIMARY KEY AUTOINCREMENT,
          Name       TEXT    NOT NULL,
          VATNumber  TEXT,
          Address    TEXT,
          Email      TEXT,
          Phone      TEXT,
          IsActive   INTEGER  DEFAULT 1,
          Log        TEXT,
          IsDeleted  INTEGER  DEFAULT 0,
          CreatedAt  DATETIME DEFAULT (datetime('now')),
          UpdatedAt  DATETIME
        );

        CREATE TABLE IF NOT EXISTS BranchMaster (
          Id        INTEGER PRIMARY KEY AUTOINCREMENT,
          CompanyId INTEGER NOT NULL,
          Name      TEXT    NOT NULL,
          Location  TEXT,
          IsDeleted INTEGER  DEFAULT 0,
          Log       TEXT,
          CreatedAt DATETIME DEFAULT (datetime('now')),
          UpdatedAt DATETIME,
          FOREIGN KEY (CompanyId) REFERENCES CompanyMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS TerminalMaster (
          Id           INTEGER PRIMARY KEY AUTOINCREMENT,
          BranchId     INTEGER,
          TerminalCode TEXT,
          FOREIGN KEY (BranchId) REFERENCES BranchMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS UsersMaster (
          Id           INTEGER PRIMARY KEY AUTOINCREMENT,
          CompanyId    INTEGER,
          BranchId     INTEGER,
          Name         TEXT,
          Username     TEXT UNIQUE,
          PasswordHash TEXT,
          Role         TEXT,
          Log          TEXT,
          CreatedAt    DATETIME DEFAULT (datetime('now')),
          UpdatedAt    DATETIME,
          FOREIGN KEY (CompanyId) REFERENCES CompanyMaster(Id),
          FOREIGN KEY (BranchId)  REFERENCES BranchMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS CategoryMaster (
          Id        INTEGER PRIMARY KEY AUTOINCREMENT,
          CompanyId INTEGER NOT NULL,
          Name      TEXT    NOT NULL,
          IsDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (CompanyId) REFERENCES CompanyMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS ProductMaster (
          Id                INTEGER  PRIMARY KEY AUTOINCREMENT,
          CompanyId         INTEGER  NOT NULL,
          CategoryId        INTEGER,
          Name              TEXT     NOT NULL,
          Barcode           TEXT,
          Barcode2          TEXT,
          SKU               TEXT,
          Price             REAL     NOT NULL DEFAULT 0,
          VATRate           REAL     NOT NULL DEFAULT 0,
          IsVATInclusive    INTEGER  NOT NULL DEFAULT 0,
          StockQty          REAL     DEFAULT 0,
          LowStockThreshold INTEGER  NOT NULL DEFAULT 10,
          ExpiryDate        DATE,
          Log               TEXT,
          IsDeleted         INTEGER  NOT NULL DEFAULT 0,
          CreatedAt         DATETIME DEFAULT (datetime('now')),
          UpdatedAt         DATETIME DEFAULT (datetime('now')),
          FOREIGN KEY (CompanyId)  REFERENCES CompanyMaster(Id),
          FOREIGN KEY (CategoryId) REFERENCES CategoryMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS SalesMaster (
          Id         INTEGER PRIMARY KEY AUTOINCREMENT,
          CompanyId  INTEGER,
          BranchId   INTEGER,
          TerminalId INTEGER,
          InvoiceNo  TEXT UNIQUE,
          CustomerId INTEGER,
          UserId     INTEGER,
          Total      REAL,
          VATAmount  REAL,
          GrandTotal REAL,
          IsSynced   INTEGER  DEFAULT 0,
          CreatedAt  DATETIME DEFAULT (datetime('now')),
          FOREIGN KEY (CompanyId)  REFERENCES CompanyMaster(Id),
          FOREIGN KEY (BranchId)   REFERENCES BranchMaster(Id),
          FOREIGN KEY (TerminalId) REFERENCES TerminalMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS SaleItemsMaster (
          Id        INTEGER PRIMARY KEY AUTOINCREMENT,
          SaleId    INTEGER,
          ProductId INTEGER,
          Qty       REAL,
          UnitPrice REAL,
          Total     REAL,
          FOREIGN KEY (SaleId)    REFERENCES SalesMaster(Id),
          FOREIGN KEY (ProductId) REFERENCES ProductMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS Payments (
          Id        INTEGER PRIMARY KEY AUTOINCREMENT,
          CompanyId INTEGER,
          SaleId    INTEGER,
          Method    TEXT,
          Amount    REAL,
          PaidAt    DATETIME DEFAULT (datetime('now')),
          FOREIGN KEY (CompanyId) REFERENCES CompanyMaster(Id),
          FOREIGN KEY (SaleId)    REFERENCES SalesMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS StockMovements (
          Id          INTEGER PRIMARY KEY AUTOINCREMENT,
          CompanyId   INTEGER NOT NULL,
          ProductId   INTEGER NOT NULL,
          Type        TEXT    NOT NULL
                              CHECK(Type IN ('Sale','Purchase','Adjustment','Return')),
          Qty         REAL    NOT NULL,
          Note        TEXT,
          CreatedBy   INTEGER,
          CreatedAt   DATETIME DEFAULT (datetime('now')),
          FOREIGN KEY (CompanyId)  REFERENCES CompanyMaster(Id),
          FOREIGN KEY (ProductId)  REFERENCES ProductMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS NotificationLog (
          Id          INTEGER PRIMARY KEY AUTOINCREMENT,
          CompanyId   INTEGER,
          Type        TEXT     NOT NULL,
          ReferenceId TEXT     NOT NULL,
          SentAt      DATETIME DEFAULT (datetime('now')),
          UNIQUE(Type, ReferenceId),
          FOREIGN KEY (CompanyId) REFERENCES CompanyMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS Deliveries (
          Id        INTEGER  PRIMARY KEY AUTOINCREMENT,
          CompanyId INTEGER  NOT NULL,
          BranchId  INTEGER,
          Category  TEXT     NOT NULL,
          Boxes     INTEGER  NOT NULL DEFAULT 0,
          Status    TEXT     NOT NULL DEFAULT 'pending'
                             CHECK(Status IN ('pending','notified','cancelled')),
          Note      TEXT,
          ArrivedAt DATETIME DEFAULT (datetime('now')),
          FOREIGN KEY (CompanyId) REFERENCES CompanyMaster(Id),
          FOREIGN KEY (BranchId)  REFERENCES BranchMaster(Id)
        );

        CREATE TABLE IF NOT EXISTS Registers (
          Id        INTEGER  PRIMARY KEY AUTOINCREMENT,
          CompanyId INTEGER  NOT NULL,
          BranchId  INTEGER,
          Number    INTEGER  NOT NULL,
          Status    TEXT     NOT NULL DEFAULT 'open'
                             CHECK(Status IN ('open','closed','break')),
          Cashier   TEXT,
          Message   TEXT,
          CreatedAt DATETIME DEFAULT (datetime('now')),
          UpdatedAt DATETIME DEFAULT (datetime('now')),
          UNIQUE(CompanyId, Number),
          FOREIGN KEY (CompanyId) REFERENCES CompanyMaster(Id),
          FOREIGN KEY (BranchId)  REFERENCES BranchMaster(Id)
        );
      `);
    },
  },
];

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

  const runAll = db.transaction(() => {
    for (const migration of pending) {
      console.log(`DB: applying migration v${migration.version}...`);
      migration.up();
      db.prepare(`INSERT INTO _migrations (version) VALUES (?)`).run(migration.version);
      console.log(`DB: migration v${migration.version} done`);
    }
  });

  runAll();
  console.log(`DB: ${pending.length} migration(s) applied successfully`);
}

module.exports = { runMigrations };
