const { ipcMain } = require('electron');
const db = require('../db');

module.exports = function registerCheckoutIPC() {
  // ── Complete a sale ───────────────────────────────────────
  // Inserts into SaleMaster + SaleDetail, adjusts stock, returns saleId
  ipcMain.handle('checkout:completeSale', (_, payload) => {
    const {
      companyId,
      branchId,
      customerId,
      items,
      subtotal,
      discount,
      total,
      payMethod,
      cashAmount,
      cardAmount,
      change,
    } = payload;

    const insertSale = db.prepare(`
      INSERT INTO SaleMaster (
        CompanyId, BranchId, CustomerId,
        Subtotal, Discount, Total,
        PayMethod, CashAmount, CardAmount, Change,
        SaleDate, CreatedAt
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        DATE('now','localtime'), datetime('now','localtime')
      )
    `);

    const insertDetail = db.prepare(`
      INSERT INTO SaleDetail (
        SaleId, ProductId, Qty, Price, Discount, Total
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const adjustStock = db.prepare(`
      UPDATE ProductMaster
      SET    StockQty = StockQty - ?
      WHERE  Id = ? AND CompanyId = ?
    `);

    const insertMovement = db.prepare(`
      INSERT INTO StockMovements (
        CompanyId, ProductId, Type, Qty, Note, CreatedAt
      ) VALUES (
        ?, ?, 'sale', ?, ?, datetime('now','localtime')
      )
    `);

    // Run everything in a transaction so it's atomic
    const runSale = db.transaction(() => {
      const saleResult = insertSale.run(
        companyId,
        branchId ?? null,
        customerId ?? null,
        subtotal,
        discount,
        total,
        payMethod,
        cashAmount ?? 0,
        cardAmount ?? 0,
        change ?? 0,
      );
      const saleId = saleResult.lastInsertRowid;

      for (const item of items) {
        insertDetail.run(saleId, item.productId, item.qty, item.price, item.discount, item.total);
        adjustStock.run(item.qty, item.productId, companyId);
        insertMovement.run(companyId, item.productId, item.qty, `Sale #${saleId}`);
      }

      // Update Khata balance if credit payment
      if (payMethod === 'credit' && customerId) {
        db.prepare(
          `
          UPDATE Customers
          SET    Balance = COALESCE(Balance, 0) + ?
          WHERE  Id = ? AND CompanyId = ?
        `,
        ).run(total, customerId, companyId);
      }

      return saleId;
    });

    try {
      const saleId = runSale();
      console.log(`checkout.ipc: sale #${saleId} completed — total BD ${total.toFixed(3)}`);
      return { success: true, saleId };
    } catch (err) {
      console.error('checkout.ipc completeSale error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Print receipt ─────────────────────────────────────────
  ipcMain.handle('checkout:printReceipt', (_, saleId) => {
    try {
      const sale = db
        .prepare(
          `
        SELECT sm.*,
               c.Name AS CustomerName,
               c.Phone AS CustomerPhone
        FROM   SaleMaster sm
        LEFT   JOIN Customers c ON sm.CustomerId = c.Id
        WHERE  sm.Id = ?
      `,
        )
        .get(saleId);

      const items = db
        .prepare(
          `
        SELECT sd.*, p.Name AS ProductName, p.Barcode
        FROM   SaleDetail sd
        JOIN   ProductMaster p ON sd.ProductId = p.Id
        WHERE  sd.SaleId = ?
      `,
        )
        .all(saleId);

      if (!sale) return { success: false, error: 'Sale not found' };

      // Build receipt HTML for thermal printer (58mm or 80mm)
      const receiptHtml = buildReceiptHtml(sale, items);

      // You can send this to electron's print API or a thermal printer library
      // For now we return the data — wire to your printer service
      console.log(`checkout.ipc: receipt ready for sale #${saleId}`);
      return { success: true, receiptHtml, sale, items };
    } catch (err) {
      console.error('checkout.ipc printReceipt error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Get sale history ──────────────────────────────────────
  ipcMain.handle('checkout:getSaleHistory', (_, { companyId, limit = 50, offset = 0 }) => {
    try {
      return db
        .prepare(
          `
        SELECT sm.Id, sm.SaleDate, sm.Total, sm.PayMethod,
               sm.Discount, sm.CreatedAt,
               c.Name AS CustomerName
        FROM   SaleMaster sm
        LEFT   JOIN Customers c ON sm.CustomerId = c.Id
        WHERE  sm.CompanyId = ?
        ORDER  BY sm.Id DESC
        LIMIT  ? OFFSET ?
      `,
        )
        .all(companyId, limit, offset);
    } catch (err) {
      console.error('checkout.ipc getSaleHistory error:', err);
      return [];
    }
  });

  // ── Get sale details (for refund / receipt reprint) ───────
  ipcMain.handle('checkout:getSaleById', (_, saleId) => {
    try {
      const sale = db
        .prepare(
          `
        SELECT sm.*, c.Name AS CustomerName
        FROM   SaleMaster sm
        LEFT   JOIN Customers c ON sm.CustomerId = c.Id
        WHERE  sm.Id = ?
      `,
        )
        .get(saleId);

      const items = db
        .prepare(
          `
        SELECT sd.*, p.Name AS ProductName
        FROM   SaleDetail sd
        JOIN   ProductMaster p ON sd.ProductId = p.Id
        WHERE  sd.SaleId = ?
      `,
        )
        .all(saleId);

      return { sale, items };
    } catch (err) {
      console.error('checkout.ipc getSaleById error:', err);
      return null;
    }
  });

  // ── Refund / return ───────────────────────────────────────
  ipcMain.handle('checkout:refund', (_, { saleId, items, companyId, reason }) => {
    const insertRefund = db.prepare(`
      INSERT INTO SaleMaster (
        CompanyId, BranchId, CustomerId,
        Subtotal, Discount, Total, PayMethod,
        SaleDate, CreatedAt, RefundFor, Note
      )
      SELECT CompanyId, BranchId, CustomerId,
             ?, 0, ?, PayMethod,
             DATE('now','localtime'), datetime('now','localtime'), Id, ?
      FROM   SaleMaster WHERE Id = ?
    `);

    const insertRefundDetail = db.prepare(`
      INSERT INTO SaleDetail (SaleId, ProductId, Qty, Price, Discount, Total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const restoreStock = db.prepare(`
      UPDATE ProductMaster SET StockQty = StockQty + ?
      WHERE Id = ? AND CompanyId = ?
    `);

    const refundTotal = items.reduce((s, i) => s + i.total, 0);

    const runRefund = db.transaction(() => {
      const r = insertRefund.run(-refundTotal, -refundTotal, reason ?? 'Refund', saleId);
      const refundId = r.lastInsertRowid;
      for (const item of items) {
        insertRefundDetail.run(
          refundId,
          item.productId,
          -item.qty,
          item.price,
          item.discount,
          -item.total,
        );
        restoreStock.run(item.qty, item.productId, companyId);
      }
      return refundId;
    });

    try {
      const refundId = runRefund();
      console.log(`checkout.ipc: refund #${refundId} for sale #${saleId}`);
      return { success: true, refundId };
    } catch (err) {
      console.error('checkout.ipc refund error:', err);
      return { success: false, error: err.message };
    }
  });
};

// ── Receipt HTML builder ──────────────────────────────────
function buildReceiptHtml(sale, items) {
  const rows = items
    .map(
      (i) => `
    <tr>
      <td>${i.ProductName}</td>
      <td style="text-align:center">${i.Qty}</td>
      <td style="text-align:right">BD ${Number(i.Price).toFixed(3)}</td>
      <td style="text-align:right">BD ${Number(i.Total).toFixed(3)}</td>
    </tr>`,
    )
    .join('');

  return `
    <!DOCTYPE html><html><head>
    <style>
      body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; }
      h2   { text-align: center; font-size: 14px; margin-bottom: 4px; }
      p    { text-align: center; margin: 2px 0; color: #666; }
      hr   { border: none; border-top: 1px dashed #ccc; margin: 6px 0; }
      table{ width: 100%; border-collapse: collapse; }
      th   { font-size: 11px; color: #999; text-align: left; padding-bottom: 4px; }
      td   { padding: 2px 0; }
      .total-row td { font-weight: bold; border-top: 1px dashed #ccc; padding-top: 4px; }
      .footer { text-align: center; margin-top: 10px; font-size: 11px; color: #999; }
    </style></head><body>
    <h2>POS Receipt</h2>
    <p>Sale #${sale.Id}</p>
    <p>${sale.SaleDate} ${sale.CreatedAt?.split(' ')[1] ?? ''}</p>
    <p>Customer: ${sale.CustomerName ?? 'Walk-in'}</p>
    <hr>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr>
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">BD ${Number(sale.Subtotal).toFixed(3)}</td></tr>
      ${Number(sale.Discount) > 0 ? `<tr><td>Discount</td><td style="text-align:right">−BD ${Number(sale.Discount).toFixed(3)}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td style="text-align:right">BD ${Number(sale.Total).toFixed(3)}</td></tr>
      <tr><td>Payment</td><td style="text-align:right">${sale.PayMethod?.toUpperCase()}</td></tr>
      ${Number(sale.Change) > 0 ? `<tr><td>Change</td><td style="text-align:right">BD ${Number(sale.Change).toFixed(3)}</td></tr>` : ''}
    </table>
    <div class="footer"><p>Thank you for your purchase!</p></div>
    </body></html>`;
}
