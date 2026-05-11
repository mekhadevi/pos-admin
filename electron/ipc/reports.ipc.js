const { ipcMain } = require('electron');
const db = require('../db');

module.exports = function registerReportsIPC() {
  // ── Daily sales ───────────────────────────────────────
  ipcMain.handle('reports:getDaily', (_, { companyId, date }) => {
    try {
      const kpis = db
        .prepare(
          `
        SELECT
          COALESCE(SUM(sm.Total), 0)                        AS sales,
          COUNT(sm.Id)                                       AS transactions,
          COALESCE(AVG(sm.Total), 0)                        AS avgBasket,
          COALESCE(SUM(sd.Qty), 0)                          AS itemsSold
        FROM SalesMaster sm
        LEFT JOIN SaleItemsMaster  sd ON sd.SaleId = sm.Id
        WHERE sm.CompanyId = ?
          AND sm.IsDeleted = 0
          AND DATE(sm.SaleDate) = ?
      `,
        )
        .get(companyId, date);

      const transactions = db
        .prepare(
          `
        SELECT sm.Id, sm.Total, sm.PayMethod, sm.CreatedAt,
               COUNT(sd.Id) AS ItemCount,
               u.Name AS CashierName
        FROM   SalesMaster sm
        LEFT   JOIN SaleItemsMaster  sd ON sd.SaleId = sm.Id
        LEFT   JOIN UsersMaster u ON u.Id = sm.UserId
        WHERE  sm.CompanyId = ? AND sm.IsDeleted = 0
          AND  DATE(sm.SaleDate) = ?
        GROUP  BY sm.Id
        ORDER  BY sm.CreatedAt DESC
        LIMIT  50
      `,
        )
        .all(companyId, date);

      return { kpis, transactions };
    } catch (err) {
      console.error('reports:getDaily', err);
      return { kpis: {}, transactions: [] };
    }
  });

  // ── Monthly / yearly ──────────────────────────────────
  ipcMain.handle('reports:getMonthly', (_, { companyId, year }) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT
          strftime('%Y-%m', SaleDate) AS Month,
          SUM(Total)                  AS Revenue,
          COUNT(Id)                   AS Orders,
          AVG(Total)                  AS AvgOrder
        FROM SalesMaster
        WHERE CompanyId = ? AND IsDeleted = 0
          AND strftime('%Y', SaleDate) = ?
        GROUP BY strftime('%Y-%m', SaleDate)
        ORDER BY Month DESC
      `,
        )
        .all(companyId, String(year));

      const kpis = {
        revenue: rows.reduce((s, r) => s + r.Revenue, 0),
        orders: rows.reduce((s, r) => s + r.Orders, 0),
        avgMonthly: rows.length ? rows.reduce((s, r) => s + r.Revenue, 0) / rows.length : 0,
        bestMonth: rows.length ? rows.reduce((a, b) => (b.Revenue > a.Revenue ? b : a)).Month : '',
      };

      return { kpis, rows };
    } catch (err) {
      console.error('reports:getMonthly', err);
      return { kpis: {}, rows: [] };
    }
  });

  // ── Product sales ─────────────────────────────────────
  ipcMain.handle('reports:getProducts', (_, { companyId, from, to }) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT
          p.Id, p.Name,
          c.Name          AS CategoryName,
          SUM(sd.Qty)     AS QtySold,
          SUM(sd.Total)   AS Revenue
        FROM   SaleItemsMaster  sd
        JOIN   SalesMaster sm  ON sm.Id = sd.SaleId
        JOIN   ProductMaster p ON p.Id = sd.ProductId
        LEFT   JOIN CategoryMaster c ON c.Id = p.CategoryId
        WHERE  sm.CompanyId = ? AND sm.IsDeleted = 0
          AND  DATE(sm.SaleDate) BETWEEN ? AND ?
        GROUP  BY p.Id
        ORDER  BY Revenue DESC
        LIMIT  20
      `,
        )
        .all(companyId, from, to);

      const total = rows.reduce((s, r) => s + r.Revenue, 0);
      return {
        rows: rows.map((r) => ({
          ...r,
          Pct: total > 0 ? Math.round((r.Revenue / total) * 100) : 0,
        })),
      };
    } catch (err) {
      console.error('reports:getProducts', err);
      return { rows: [] };
    }
  });

  // ── Category report ───────────────────────────────────
  ipcMain.handle('reports:getCategory', (_, { companyId, from, to }) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT
          COALESCE(c.Name, 'Uncategorized') AS Category,
          SUM(sd.Total)                     AS Revenue,
          SUM(sd.Qty)                       AS QtySold,
          COUNT(DISTINCT sm.Id)             AS Orders
        FROM   SaleItemsMaster  sd
        JOIN   SalesMaster sm  ON sm.Id = sd.SaleId
        JOIN   ProductMaster p ON p.Id = sd.ProductId
        LEFT   JOIN CategoryMaster c ON c.Id = p.CategoryId
        WHERE  sm.CompanyId = ? AND sm.IsDeleted = 0
          AND  DATE(sm.SaleDate) BETWEEN ? AND ?
        GROUP  BY c.Id
        ORDER  BY Revenue DESC
      `,
        )
        .all(companyId, from, to);

      return { rows };
    } catch (err) {
      console.error('reports:getCategory', err);
      return { rows: [] };
    }
  });

  // ── VAT report ────────────────────────────────────────
  ipcMain.handle('reports:getVat', (_, { companyId, from, to }) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT
          COALESCE(c.Name, 'Uncategorized') AS Category,
          p.VATRate                          AS VatRate,
          SUM(sd.Total / (1 + p.VATRate/100)) AS NetSales,
          SUM(sd.Total - sd.Total / (1 + p.VATRate/100)) AS VatAmount,
          SUM(sd.Total)                       AS Gross
        FROM   SaleItemsMaster  sd
        JOIN   SalesMaster sm   ON sm.Id = sd.SaleId
        JOIN   ProductMaster p ON p.Id  = sd.ProductId
        LEFT   JOIN CategoryMaster c ON c.Id = p.CategoryId
        WHERE  sm.CompanyId = ? AND sm.IsDeleted = 0
          AND  DATE(sm.SaleDate) BETWEEN ? AND ?
        GROUP  BY c.Id, p.VATRate
        ORDER  BY Gross DESC
      `,
        )
        .all(companyId, from, to);

      const kpis = {
        netSales: rows.reduce((s, r) => s + r.NetSales, 0),
        vatCollected: rows.reduce((s, r) => s + r.VatAmount, 0),
        gross: rows.reduce((s, r) => s + r.Gross, 0),
        vatPct: 0,
      };
      kpis.vatPct = kpis.gross > 0 ? (kpis.vatCollected / kpis.gross) * 100 : 0;

      return { kpis, rows };
    } catch (err) {
      console.error('reports:getVat', err);
      return { kpis: {}, rows: [] };
    }
  });

  // ── Profit report ─────────────────────────────────────
  // NOTE: requires a CostPrice column on ProductMaster.
  // Falls back to 62% COGS estimate if CostPrice is 0.
  ipcMain.handle('reports:getProfit', (_, { companyId, from, to }) => {
    try {
      const row = db
        .prepare(
          `
        SELECT
          SUM(sd.Total)                              AS Revenue,
          SUM(COALESCE(p.CostPrice, sd.Price * 0.62) * sd.Qty) AS COGS
        FROM   SaleItemsMaster  sd
        JOIN   SalesMaster sm   ON sm.Id = sd.SaleId
        JOIN   ProductMaster p ON p.Id  = sd.ProductId
        WHERE  sm.CompanyId = ? AND sm.IsDeleted = 0
          AND  DATE(sm.SaleDate) BETWEEN ? AND ?
      `,
        )
        .get(companyId, from, to);

      const revenue = row?.Revenue || 0;
      const cogs = row?.COGS || 0;
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit * 0.735; // rough after operating costs

      return { kpis: { revenue, cogs, grossProfit, netProfit } };
    } catch (err) {
      console.error('reports:getProfit', err);
      return { kpis: {} };
    }
  });

  // ── Payment report ────────────────────────────────────
  ipcMain.handle('reports:getPayment', (_, { companyId, from, to }) => {
    try {
      const totals = db
        .prepare(
          `
        SELECT
          SUM(CASE WHEN PayMethod='cash'   THEN Total ELSE 0 END) AS cash,
          SUM(CASE WHEN PayMethod='card'   THEN Total ELSE 0 END) AS card,
          SUM(CASE WHEN PayMethod='credit' THEN Total ELSE 0 END) AS credit
        FROM SalesMaster
        WHERE CompanyId = ? AND IsDeleted = 0
          AND DATE(SaleDate) BETWEEN ? AND ?
      `,
        )
        .get(companyId, from, to);

      const rows = db
        .prepare(
          `
        SELECT
          DATE(SaleDate) AS Date,
          SUM(CASE WHEN PayMethod='cash'   THEN Total ELSE 0 END) AS Cash,
          SUM(CASE WHEN PayMethod='card'   THEN Total ELSE 0 END) AS Card,
          SUM(CASE WHEN PayMethod='credit' THEN Total ELSE 0 END) AS Credit,
          SUM(Total) AS Total
        FROM SalesMaster
        WHERE CompanyId = ? AND IsDeleted = 0
          AND DATE(SaleDate) BETWEEN ? AND ?
        GROUP BY DATE(SaleDate)
        ORDER BY Date DESC
        LIMIT 30
      `,
        )
        .all(companyId, from, to);

      return {
        kpis: {
          cash: totals?.cash || 0,
          card: totals?.card || 0,
          credit: totals?.credit || 0,
        },
        rows,
      };
    } catch (err) {
      console.error('reports:getPayment', err);
      return { kpis: {}, rows: [] };
    }
  });

  // ── User-wise sales ───────────────────────────────────
  ipcMain.handle('reports:getUsers', (_, { companyId, from, to }) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT
          COALESCE(u.Name, 'Unknown')  AS Name,
          COUNT(sm.Id)                 AS OrderCount,
          SUM(sm.Total)                AS Revenue,
          AVG(sm.Total)                AS AvgOrder,
          ROUND(
            SUM(CASE WHEN sm.PayMethod='cash' THEN 1 ELSE 0 END) * 100.0 / COUNT(sm.Id)
          , 0)                         AS CashPct,
          ROUND(
            SUM(CASE WHEN sm.PayMethod='card' THEN 1 ELSE 0 END) * 100.0 / COUNT(sm.Id)
          , 0)                         AS CardPct
        FROM   SalesMaster sm
        LEFT   JOIN UsersMaster u ON u.Id = sm.UserId
        WHERE  sm.CompanyId = ? AND sm.IsDeleted = 0
          AND  DATE(sm.SaleDate) BETWEEN ? AND ?
        GROUP  BY sm.UserId
        ORDER  BY Revenue DESC
      `,
        )
        .all(companyId, from, to);

      return { rows };
    } catch (err) {
      console.error('reports:getUsers', err);
      return { rows: [] };
    }
  });

  // ── Export CSV ────────────────────────────────────────
  ipcMain.handle('reports:export', (_, { view, companyId, from, to }) => {
    try {
      let rows = [],
        headers = '';

      if (view === 'daily') {
        rows = db
          .prepare(
            `
          SELECT sm.Id, sm.SaleDate, sm.Total, sm.PayMethod,
                 COUNT(sd.Id) AS Items
          FROM SalesMaster sm
          LEFT JOIN SaleItemsMaster  sd ON sd.SaleId = sm.Id
          WHERE sm.CompanyId = ? AND sm.IsDeleted = 0
            AND DATE(sm.SaleDate) BETWEEN ? AND ?
          GROUP BY sm.Id ORDER BY sm.CreatedAt DESC
        `,
          )
          .all(companyId, from, to);
        headers = 'Id,Date,Total,PayMethod,Items';
      }

      if (view === 'products') {
        rows = db
          .prepare(
            `
          SELECT p.Name, c.Name AS Category,
                 SUM(sd.Qty) AS QtySold, SUM(sd.Total) AS Revenue
          FROM SaleItemsMaster  sd
          JOIN SalesMaster sm ON sm.Id = sd.SaleId
          JOIN ProductMaster p ON p.Id = sd.ProductId
          LEFT JOIN CategoryMaster c ON c.Id = p.CategoryId
          WHERE sm.CompanyId = ? AND sm.IsDeleted = 0
            AND DATE(sm.SaleDate) BETWEEN ? AND ?
          GROUP BY p.Id ORDER BY Revenue DESC
        `,
          )
          .all(companyId, from, to);
        headers = 'Product,Category,QtySold,Revenue';
      }

      const lines = rows.map((r) => Object.values(r).join(','));
      const csv = [headers, ...lines].join('\n');
      return { success: true, csv };
    } catch (err) {
      console.error('reports:export', err);
      return { success: false, error: err.message };
    }
  });
};
