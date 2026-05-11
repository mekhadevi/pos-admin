const { ipcMain } = require('electron');
const db = require('../db');

module.exports = function registerInventoryIPC() {
  // ── Stats ─────────────────────────────────────────────
  ipcMain.handle('inventory:getStats', (_, companyId) => {
    try {
      const total = db
        .prepare(`SELECT COUNT(*) as n FROM ProductMaster WHERE CompanyId=? AND IsDeleted=0`)
        .get(companyId).n;

      const lowStock = db
        .prepare(
          `SELECT COUNT(*) as n FROM ProductMaster
         WHERE CompanyId=? AND IsDeleted=0 AND StockQty <= LowStockThreshold AND StockQty > 0`,
        )
        .get(companyId).n;

      const outOfStock = db
        .prepare(
          `SELECT COUNT(*) as n FROM ProductMaster
         WHERE CompanyId=? AND IsDeleted=0 AND StockQty <= 0`,
        )
        .get(companyId).n;

      const categories = db
        .prepare(`SELECT COUNT(*) as n FROM CategoryMaster WHERE CompanyId=? AND IsDeleted=0`)
        .get(companyId).n;

      const expiringCount = db
        .prepare(
          `SELECT COUNT(*) as n FROM ProductMaster
         WHERE CompanyId=? AND IsDeleted=0
           AND ExpiryDate IS NOT NULL
           AND julianday(ExpiryDate) - julianday('now','localtime') <= 7
           AND julianday(ExpiryDate) >= julianday('now','localtime')`,
        )
        .get(companyId).n;

      return { total, lowStock, outOfStock, categories, expiringCount };
    } catch (err) {
      console.error('inventory:getStats', err);
      return { total: 0, lowStock: 0, outOfStock: 0, categories: 0, expiringCount: 0 };
    }
  });

  // ── Expiry products ───────────────────────────────────
  ipcMain.handle('inventory:getExpiryProducts', (_, companyId, days = 7) => {
    try {
      return db
        .prepare(
          `
        SELECT p.Id, p.Name, c.Name AS CategoryName,
               p.StockQty, p.ExpiryDate,
               CAST(julianday(p.ExpiryDate) - julianday('now','localtime') AS INTEGER) AS DaysLeft
        FROM   ProductMaster p
        LEFT   JOIN CategoryMaster c ON p.CategoryId = c.Id
        WHERE  p.CompanyId = ? AND p.IsDeleted = 0
          AND  p.ExpiryDate IS NOT NULL
          AND  julianday(p.ExpiryDate) - julianday('now','localtime') <= ?
          AND  julianday(p.ExpiryDate) >= julianday('now','localtime')
        ORDER  BY p.ExpiryDate ASC
      `,
        )
        .all(companyId, days);
    } catch (err) {
      console.error('inventory:getExpiryProducts', err);
      return [];
    }
  });

  // ── Stock movements ───────────────────────────────────
  ipcMain.handle('inventory:getMovements', (_, companyId, type) => {
    try {
      let sql = `
      SELECT sm.Id, sm.Type, sm.Qty, sm.Note, sm.CreatedAt,
             p.Name AS ProductName,
             p.StockQty AS StockAfter,
             'System' AS CreatedBy
      FROM   StockMovements sm
      LEFT   JOIN ProductMaster p ON sm.ProductId = p.Id
      WHERE  sm.CompanyId = ?
    `;
      const params = [companyId];
      if (type) {
        sql += ` AND sm.Type = ?`;
        params.push(type);
      }
      sql += ` ORDER BY sm.CreatedAt DESC LIMIT 300`;
      return db.prepare(sql).all(...params);
    } catch (err) {
      console.error('inventory:getMovements', err);
      return [];
    }
  });

  // ── Suppliers ─────────────────────────────────────────
  ipcMain.handle('inventory:getSuppliers', (_, companyId) => {
    try {
      return db
        .prepare(`SELECT * FROM Suppliers WHERE CompanyId = ? AND IsDeleted = 0 ORDER BY Name`)
        .all(companyId);
    } catch (err) {
      console.error('inventory:getSuppliers', err);
      return [];
    }
  });

  // ── Purchase orders ───────────────────────────────────
  ipcMain.handle('inventory:getPurchaseOrders', (_, companyId) => {
    try {
      return db
        .prepare(
          `
        SELECT po.*,
               s.Name AS SupplierName,
               COUNT(poi.Id) AS ItemCount
        FROM   PurchaseOrders po
        LEFT   JOIN Suppliers s ON po.SupplierId = s.Id
        LEFT   JOIN PurchaseOrderItems poi ON poi.PurchaseOrderId = po.Id
        WHERE  po.CompanyId = ?
        GROUP  BY po.Id
        ORDER  BY po.CreatedAt DESC
      `,
        )
        .all(companyId);
    } catch (err) {
      console.error('inventory:getPurchaseOrders', err);
      return [];
    }
  });

  // ── Create purchase order ─────────────────────────────
  ipcMain.handle('inventory:createPurchaseOrder', (_, payload) => {
    const {
      companyId,
      branchId,
      supplierId,
      invoiceNumber,
      expectedDate,
      notes,
      status = 'pending',
      items = [],
    } = payload;

    try {
      const totalAmount = items.reduce((s, i) => s + i.qty * i.unitCost, 0);

      // Generate PO number: PO-YYYY-NNN
      const year = new Date().getFullYear();
      const lastPo = db
        .prepare(`SELECT PoNumber FROM PurchaseOrders WHERE CompanyId=? ORDER BY Id DESC LIMIT 1`)
        .get(companyId);
      let seq = 1;
      if (lastPo) {
        const parts = lastPo.PoNumber.split('-');
        seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
      }
      const poNumber = `PO-${year}-${String(seq).padStart(3, '0')}`;

      const insertPo = db.prepare(`
        INSERT INTO PurchaseOrders
          (CompanyId, BranchId, SupplierId, PoNumber, InvoiceNumber,
           TotalAmount, Status, ExpectedDate, Notes, CreatedAt)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
      `);

      const insertItem = db.prepare(`
        INSERT INTO PurchaseOrderItems
          (PurchaseOrderId, ProductId, Qty, UnitCost, Total)
        VALUES (?, ?, ?, ?, ?)
      `);

      const run = db.transaction(() => {
        const r = insertPo.run(
          companyId,
          branchId ?? null,
          supplierId,
          poNumber,
          invoiceNumber || null,
          totalAmount,
          status,
          expectedDate || null,
          notes || null,
        );
        const poId = r.lastInsertRowid;
        for (const item of items) {
          insertItem.run(poId, item.productId, item.qty, item.unitCost, item.total);
        }
        return poId;
      });

      const poId = run();
      console.log(`inventory: PO ${poNumber} created (id=${poId})`);
      return { success: true, poId, poNumber };
    } catch (err) {
      console.error('inventory:createPurchaseOrder', err);
      return { success: false, error: err.message };
    }
  });

  // ── Receive purchase order ────────────────────────────
  // Marks PO as received and adds stock for each item
  ipcMain.handle('inventory:receivePurchaseOrder', (_, poId, companyId) => {
    try {
      const items = db
        .prepare(`SELECT * FROM PurchaseOrderItems WHERE PurchaseOrderId = ?`)
        .all(poId);

      const updateStock = db.prepare(`
        UPDATE ProductMaster
        SET    StockQty  = StockQty + ?,
               UpdatedAt = datetime('now','localtime')
        WHERE  Id = ? AND CompanyId = ?
      `);

      const insertMovement = db.prepare(`
        INSERT INTO StockMovements (CompanyId, ProductId, Type, Qty, Note, CreatedAt)
        VALUES (?, ?, 'Purchase', ?, ?, datetime('now','localtime'))
      `);

      const updatePo = db.prepare(`
        UPDATE PurchaseOrders
        SET Status = 'received', ReceivedAt = datetime('now','localtime')
        WHERE Id = ?
      `);

      const run = db.transaction(() => {
        for (const item of items) {
          updateStock.run(item.Qty, item.ProductId, companyId);
          insertMovement.run(companyId, item.ProductId, item.Qty, `PO received #${poId}`);
        }
        updatePo.run(poId);
      });

      run();
      console.log(`inventory: PO ${poId} received — ${items.length} products restocked`);
      return { success: true };
    } catch (err) {
      console.error('inventory:receivePurchaseOrder', err);
      return { success: false, error: err.message };
    }
  });

  // ── Export movements as CSV ───────────────────────────
  ipcMain.handle('inventory:exportMovements', (_, companyId) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT sm.CreatedAt, p.Name AS Product, sm.Type, sm.Qty, sm.Note
        FROM   StockMovements sm
        LEFT   JOIN ProductMaster p ON sm.ProductId = p.Id
        WHERE  sm.CompanyId = ?
        ORDER  BY sm.CreatedAt DESC
      `,
        )
        .all(companyId);

      const header = 'Date,Product,Type,Qty,Note';
      const lines = rows.map(
        (r) => `"${r.CreatedAt}","${r.Product}","${r.Type}",${r.Qty},"${r.Note || ''}"`,
      );
      const csv = [header, ...lines].join('\n');
      return { success: true, csv };
    } catch (err) {
      console.error('inventory:exportMovements', err);
      return { success: false, error: err.message };
    }
  });
};
