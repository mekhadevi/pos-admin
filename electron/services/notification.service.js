// src/electron/notification.service.js
const db = require('../db');

class NotificationService {
  constructor(win) {
    this.win = win;
    this.timer = null;
  }

  start(intervalMs = 30_000) {
    console.log('NotificationService: started');
    this.checkAll();
    this.timer = setInterval(() => this.checkAll(), intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      console.log('NotificationService: stopped');
    }
  }

  checkAll() {
    try {
      this.checkLowStock();
      this.checkExpiry();
      this.checkDeliveries();
      this.checkRegisters();
    } catch (err) {
      console.error('NotificationService checkAll error:', err);
    }
  }

  // ── 1. LOW STOCK ─────────────────────────────────────────
  // Uses LowStockThreshold column (already in ProductMaster)
  checkLowStock() {
    const items = db
      .prepare(
        `
      SELECT p.Id,
             p.Name,
             p.StockQty,
             p.LowStockThreshold,
             c.Name AS CategoryName
      FROM   ProductMaster p
      LEFT   JOIN CategoryMaster c ON p.CategoryId = c.Id
      WHERE  p.IsDeleted  = 0
        AND  p.StockQty   >= 0
        AND  p.StockQty   <= p.LowStockThreshold
        AND  NOT EXISTS (
          SELECT 1 FROM NotificationLog nl
          WHERE  nl.Type         = 'stock'
            AND  nl.ReferenceId  = CAST(p.Id AS TEXT)
            AND  DATE(nl.SentAt) = DATE('now')
        )
    `,
      )
      .all();

    for (const item of items) {
      this.send('low-stock', {
        name: item.Name,
        remaining: item.StockQty,
        threshold: item.LowStockThreshold,
        category: item.CategoryName ?? 'Uncategorized',
      });

      db.prepare(
        `
        INSERT OR IGNORE INTO NotificationLog (Type, ReferenceId)
        VALUES ('stock', ?)
      `,
      ).run(String(item.Id));

      console.log(`NotificationService: low-stock → ${item.Name} (${item.StockQty} left)`);
    }
  }

  // ── 2. EXPIRY ALERT ──────────────────────────────────────
  // Uses ExpiryDate column (already in ProductMaster)
  checkExpiry() {
    const items = db
      .prepare(
        `
      SELECT p.Id,
             p.Name,
             p.StockQty,
             p.ExpiryDate,
             CAST(julianday(p.ExpiryDate) - julianday('now') AS INTEGER) AS DaysLeft
      FROM   ProductMaster p
      WHERE  p.IsDeleted  = 0
        AND  p.ExpiryDate IS NOT NULL
        AND  julianday(p.ExpiryDate) - julianday('now') <= 3
        AND  julianday(p.ExpiryDate) >= julianday('now')
        AND  NOT EXISTS (
          SELECT 1 FROM NotificationLog nl
          WHERE  nl.Type         = 'expiry'
            AND  nl.ReferenceId  = CAST(p.Id AS TEXT)
            AND  DATE(nl.SentAt) = DATE('now')
        )
    `,
      )
      .all();

    for (const item of items) {
      const label =
        item.DaysLeft === 0
          ? 'Expires today'
          : `Expires in ${item.DaysLeft} day${item.DaysLeft > 1 ? 's' : ''}`;

      this.send('expiry-alert', {
        name: item.Name,
        count: item.StockQty,
        daysLeft: item.DaysLeft,
        label,
      });

      db.prepare(
        `
        INSERT OR IGNORE INTO NotificationLog (Type, ReferenceId)
        VALUES ('expiry', ?)
      `,
      ).run(String(item.Id));

      console.log(`NotificationService: expiry-alert → ${item.Name} (${label})`);
    }
  }

  // ── 3. DELIVERY ARRIVED ──────────────────────────────────
  checkDeliveries() {
    const rows = db
      .prepare(
        `
      SELECT Id, Category, Boxes
      FROM   Deliveries
      WHERE  Status = 'pending'
    `,
      )
      .all();

    for (const d of rows) {
      this.send('delivery-arrived', {
        category: d.Category,
        boxes: d.Boxes,
      });

      db.prepare(
        `
        UPDATE Deliveries
        SET    Status = 'notified'
        WHERE  Id     = ?
      `,
      ).run(d.Id);

      console.log(`NotificationService: delivery-arrived → ${d.Category} (${d.Boxes} boxes)`);
    }
  }

  // ── 4. CASHIER / REGISTER STATUS ─────────────────────────
  checkRegisters() {
    const rows = db
      .prepare(
        `
      SELECT Id, Number, Status, Cashier, Message, UpdatedAt
      FROM   Registers
      WHERE  Status != 'open'
        AND  NOT EXISTS (
          SELECT 1 FROM NotificationLog nl
          WHERE  nl.Type        = 'cashier'
            AND  nl.ReferenceId = (CAST(Id AS TEXT) || '_' || UpdatedAt)
        )
    `,
      )
      .all();

    for (const reg of rows) {
      this.send('cashier-status', {
        register: reg.Number,
        cashier: reg.Cashier ?? 'Unknown',
        message: reg.Message ?? reg.Status,
        status: reg.Status,
      });

      db.prepare(
        `
        INSERT OR IGNORE INTO NotificationLog (Type, ReferenceId)
        VALUES ('cashier', ?)
      `,
      ).run(`${reg.Id}_${reg.UpdatedAt}`);

      console.log(`NotificationService: cashier-status → Register ${reg.Number} (${reg.Status})`);
    }
  }

  // ── IPC send helper ──────────────────────────────────────
  send(channel, payload) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(channel, payload);
    }
  }
}

module.exports = { NotificationService };
