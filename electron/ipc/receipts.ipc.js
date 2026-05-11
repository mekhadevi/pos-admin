const { ipcMain } = require('electron');
const db = require('../db');

console.log('receipts.ipc.js loaded ✅');

module.exports = function registerReceiptsIPC() {
  console.log('registerReceiptsIPC() called ✅');

  // ── Get receipts (paginated + filtered) ──────────────────
  ipcMain.handle(
    'receipts:getAll',
    (
      _,
      {
        companyId,
        page = 1,
        pageSize = 30,
        search = '',
        dateFrom = '',
        dateTo = '',
        payMethod = '',
        minTotal = null,
        maxTotal = null,
      },
    ) => {
      try {
        const offset = (page - 1) * pageSize;
        let where = `sm.CompanyId = ? AND sm.IsDeleted = 0`;
        const params = [companyId];

        if (search) {
          where += ` AND (sm.Id LIKE ? OR c.Name LIKE ? OR sm.Note LIKE ?)`;
          const q = `%${search}%`;
          params.push(q, q, q);
        }
        if (dateFrom) {
          where += ` AND sm.SaleDate >= ?`;
          params.push(dateFrom);
        }
        if (dateTo) {
          where += ` AND sm.SaleDate <= ?`;
          params.push(dateTo);
        }
        if (payMethod) {
          where += ` AND sm.PayMethod = ?`;
          params.push(payMethod);
        }
        if (minTotal != null) {
          where += ` AND sm.Total >= ?`;
          params.push(minTotal);
        }
        if (maxTotal != null) {
          where += ` AND sm.Total <= ?`;
          params.push(maxTotal);
        }

        const total = db
          .prepare(
            `
        SELECT COUNT(*) as n
        FROM   SaleMaster sm
        LEFT   JOIN CustomerMaster c ON sm.CustomerId = c.Id
        WHERE  ${where}
      `,
          )
          .get(...params).n;

        const rows = db
          .prepare(
            `
        SELECT sm.*,
               c.Name  AS CustomerName,
               c.Phone AS CustomerPhone,
               (SELECT COUNT(*) FROM SaleDetail sd WHERE sd.SaleId = sm.Id) AS ItemCount
        FROM   SaleMaster sm
        LEFT   JOIN CustomerMaster c ON sm.CustomerId = c.Id
        WHERE  ${where}
        ORDER  BY sm.CreatedAt DESC
        LIMIT  ? OFFSET ?
      `,
          )
          .all(...params, pageSize, offset);

        return { rows, total, page, pageSize };
      } catch (err) {
        console.error('receipts:getAll', err);
        return { rows: [], total: 0, page: 1, pageSize };
      }
    },
  );

  // ── Get single receipt with line items ───────────────────
  ipcMain.handle('receipts:getById', (_, saleId) => {
    try {
      const sale = db
        .prepare(
          `
        SELECT sm.*,
               c.Name    AS CustomerName,
               c.Phone   AS CustomerPhone,
               c.Email   AS CustomerEmail,
               co.Name   AS CompanyName,
               co.Address AS CompanyAddress,
               co.Phone  AS CompanyPhone,
               co.VATNumber AS CompanyVAT
        FROM   SaleMaster sm
        LEFT   JOIN CustomerMaster c  ON sm.CustomerId  = c.Id
        LEFT   JOIN CompanyMaster  co ON sm.CompanyId   = co.Id
        WHERE  sm.Id = ?
      `,
        )
        .get(saleId);

      if (!sale) return null;

      const items = db
        .prepare(
          `
        SELECT sd.*,
               p.Name    AS ProductName,
               p.Barcode AS Barcode,
               p.VATRate AS VATRate
        FROM   SaleDetail sd
        LEFT   JOIN ProductMaster p ON sd.ProductId = p.Id
        WHERE  sd.SaleId = ?
      `,
        )
        .all(saleId);

      return { ...sale, items };
    } catch (err) {
      console.error('receipts:getById', err);
      return null;
    }
  });

  // ── Stats for header cards ────────────────────────────────
  ipcMain.handle('receipts:getStats', (_, { companyId, dateFrom, dateTo }) => {
    try {
      let where = `CompanyId = ? AND IsDeleted = 0`;
      const p = [companyId];
      if (dateFrom) {
        where += ` AND SaleDate >= ?`;
        p.push(dateFrom);
      }
      if (dateTo) {
        where += ` AND SaleDate <= ?`;
        p.push(dateTo);
      }

      const row = db
        .prepare(
          `
        SELECT COUNT(*)          AS totalCount,
               COALESCE(SUM(Total), 0)    AS totalRevenue,
               COALESCE(AVG(Total), 0)    AS avgSale,
               COALESCE(SUM(Discount), 0) AS totalDiscount
        FROM   SaleMaster
        WHERE  ${where}
      `,
        )
        .get(...p);

      const refunds = db
        .prepare(
          `
        SELECT COUNT(*) AS n, COALESCE(SUM(Total), 0) AS amount
        FROM   SaleMaster
        WHERE  ${where} AND RefundFor IS NOT NULL
      `,
        )
        .get(...p);

      const byMethod = db
        .prepare(
          `
        SELECT PayMethod, COUNT(*) AS n, SUM(Total) AS total
        FROM   SaleMaster
        WHERE  ${where}
        GROUP  BY PayMethod
      `,
        )
        .all(...p);

      return { ...row, refundCount: refunds.n, refundAmount: refunds.amount, byMethod };
    } catch (err) {
      console.error('receipts:getStats', err);
      return {
        totalCount: 0,
        totalRevenue: 0,
        avgSale: 0,
        totalDiscount: 0,
        refundCount: 0,
        refundAmount: 0,
        byMethod: [],
      };
    }
  });

  // ── Void / delete a receipt ───────────────────────────────
  ipcMain.handle('receipts:void', (_, saleId, companyId) => {
    try {
      // Restore stock
      const items = db.prepare(`SELECT * FROM SaleDetail WHERE SaleId = ?`).all(saleId);
      const restoreStock = db.prepare(`
        UPDATE ProductMaster SET StockQty = StockQty + ?, UpdatedAt = datetime('now','localtime')
        WHERE Id = ? AND CompanyId = ?
      `);
      const insertMovement = db.prepare(`
        INSERT INTO StockMovements (CompanyId, ProductId, Type, Qty, Note, CreatedAt)
        VALUES (?, ?, 'Return', ?, ?, datetime('now','localtime'))
      `);
      const voidSale = db.prepare(`
        UPDATE SaleMaster SET IsDeleted = 1 WHERE Id = ?
      `);

      db.transaction(() => {
        for (const item of items) {
          restoreStock.run(item.Qty, item.ProductId, companyId);
          insertMovement.run(companyId, item.ProductId, item.Qty, `Void receipt #${saleId}`);
        }
        voidSale.run(saleId);
      })();

      return { success: true };
    } catch (err) {
      console.error('receipts:void', err);
      return { success: false, error: err.message };
    }
  });

  // ── Export receipts as CSV ────────────────────────────────
  ipcMain.handle('receipts:exportCSV', (_, companyId, dateFrom, dateTo) => {
    try {
      let where = `sm.CompanyId = ? AND sm.IsDeleted = 0`;
      const p = [companyId];
      if (dateFrom) {
        where += ` AND sm.SaleDate >= ?`;
        p.push(dateFrom);
      }
      if (dateTo) {
        where += ` AND sm.SaleDate <= ?`;
        p.push(dateTo);
      }

      const rows = db
        .prepare(
          `
        SELECT sm.Id, sm.SaleDate, sm.CreatedAt,
               c.Name AS Customer, sm.PayMethod,
               sm.Subtotal, sm.Discount, sm.Total,
               sm.CashAmount, sm.Change, sm.Note
        FROM   SaleMaster sm
        LEFT   JOIN CustomerMaster c ON sm.CustomerId = c.Id
        WHERE  ${where}
        ORDER  BY sm.CreatedAt DESC
      `,
        )
        .all(...p);

      const header = 'Receipt#,Date,Customer,Payment,Subtotal,Discount,Total,Cash,Change,Note';
      const lines = rows.map(
        (r) =>
          `${r.Id},"${r.SaleDate}","${r.Customer || 'Walk-in'}","${r.PayMethod}",${r.Subtotal},${r.Discount},${r.Total},${r.CashAmount || ''},${r.Change || ''},"${r.Note || ''}"`,
      );
      return { success: true, csv: [header, ...lines].join('\n') };
    } catch (err) {
      console.error('receipts:exportCSV', err);
      return { success: false, error: err.message };
    }
  });

  // ── Daily summary breakdown ───────────────────────────────
  ipcMain.handle('receipts:getDailySummary', (_, { companyId, dateFrom, dateTo }) => {
    try {
      let where = `CompanyId = ? AND IsDeleted = 0`;
      const p = [companyId];
      if (dateFrom) {
        where += ` AND SaleDate >= ?`;
        p.push(dateFrom);
      }
      if (dateTo) {
        where += ` AND SaleDate <= ?`;
        p.push(dateTo);
      }

      return db
        .prepare(
          `
        SELECT SaleDate AS date,
               COUNT(*) AS count,
               SUM(Total) AS revenue,
               SUM(Discount) AS discount,
               AVG(Total) AS avgSale
        FROM   SaleMaster
        WHERE  ${where}
        GROUP  BY SaleDate
        ORDER  BY SaleDate DESC
        LIMIT  30
      `,
        )
        .all(...p);
    } catch (err) {
      console.error('receipts:getDailySummary', err);
      return [];
    }
  });
};
