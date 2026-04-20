const db = require('../db');

// ─── Products ────────────────────────────────────────────────────
function getAll({ companyId, categoryId, search, includeDeleted = false }) {
  let sql = `
    SELECT p.*, c.Name AS CategoryName
    FROM   ProductMaster p
    LEFT   JOIN CategoryMaster c ON p.CategoryId = c.Id
    WHERE  p.CompanyId = ?
  `;
  const params = [companyId];

  if (!includeDeleted) {
    sql += ` AND p.IsDeleted = 0`;
  }
  if (categoryId) {
    sql += ` AND p.CategoryId = ?`;
    params.push(categoryId);
  }
  if (search) {
    sql += ` AND (p.Name LIKE ? OR p.Barcode LIKE ? OR p.SKU LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  sql += ` ORDER BY p.Name`;
  return db.prepare(sql).all(...params);
}

function getById(id) {
  return db
    .prepare(
      `
    SELECT p.*, c.Name AS CategoryName
    FROM   ProductMaster p
    LEFT   JOIN CategoryMaster c ON p.CategoryId = c.Id
    WHERE  p.Id = ? AND p.IsDeleted = 0
  `,
    )
    .get(id);
}

function getByBarcode(barcode, companyId) {
  return db
    .prepare(
      `
    SELECT * FROM ProductMaster
    WHERE  (Barcode = ? OR Barcode2 = ?) AND CompanyId = ? AND IsDeleted = 0
  `,
    )
    .get(barcode, barcode, companyId);
}

function create(data) {
  const stmt = db.prepare(`
    INSERT INTO ProductMaster
      (CompanyId, CategoryId, Name, Barcode, Barcode2, SKU, Price, VATRate, IsVATInclusive, StockQty, Log)
    VALUES
      (@companyId, @categoryId, @name, @barcode, @barcode2, @sku, @price, @vatRate, @isVATInclusive, @stockQty, @log)
  `);
  const result = stmt.run({
    companyId: data.companyId,
    categoryId: data.categoryId || null,
    name: data.name,
    barcode: data.barcode || null,
    barcode2: data.barcode2 || null,
    sku: data.sku || null,
    price: data.price || 0,
    vatRate: data.vatRate || 0,
    isVATInclusive: data.isVATInclusive ? 1 : 0,
    stockQty: data.stockQty || 0,
    log: data.log || null,
  });
  return { success: true, id: result.lastInsertRowid };
}

function update(id, data) {
  db.prepare(
    `
    UPDATE ProductMaster SET
      CategoryId     = @categoryId,
      Name           = @name,
      Barcode        = @barcode,
      Barcode2       = @barcode2,
      SKU            = @sku,
      Price          = @price,
      VATRate        = @vatRate,
      IsVATInclusive = @isVATInclusive,
      StockQty       = @stockQty,
      Log            = @log,
      UpdatedAt      = datetime('now')
    WHERE Id = @id AND IsDeleted = 0
  `,
  ).run({
    id,
    categoryId: data.categoryId || null,
    name: data.name,
    barcode: data.barcode || null,
    barcode2: data.barcode2 || null,
    sku: data.sku || null,
    price: data.price || 0,
    vatRate: data.vatRate || 0,
    isVATInclusive: data.isVATInclusive ? 1 : 0,
    stockQty: data.stockQty || 0,
    log: data.log || null,
  });
  return { success: true };
}

function softDelete(id) {
  db.prepare(
    `UPDATE ProductMaster SET IsDeleted = 1, UpdatedAt = datetime('now') WHERE Id = ?`,
  ).run(id);
  return { success: true };
}
function getMovements(companyId) {
  return db
    .prepare(
      `
    SELECT sm.*, p.Name AS ProductName
    FROM   StockMovements sm
    LEFT   JOIN ProductMaster p ON sm.ProductId = p.Id
    WHERE  sm.CompanyId = ?
    ORDER  BY sm.CreatedAt DESC
    LIMIT  200
  `,
    )
    .all(companyId);
}

function adjustStock(id, qty, note, companyId) {
  db.prepare(
    `
    UPDATE ProductMaster
    SET StockQty  = StockQty + ?,
        Log       = ?,
        UpdatedAt = datetime('now')
    WHERE Id = ? AND IsDeleted = 0
  `,
  ).run(qty, note || null, id);

  db.prepare(
    `
    INSERT INTO StockMovements (CompanyId, ProductId, Type, Qty, Note)
    VALUES (?, ?, 'Adjustment', ?, ?)
  `,
  ).run(companyId, id, qty, note || null);

  return { success: true };
}

// ─── Categories ──────────────────────────────────────────────────
function getCategories(companyId) {
  return db
    .prepare(`SELECT * FROM CategoryMaster WHERE CompanyId = ? AND IsDeleted = 0 ORDER BY Name`)
    .all(companyId);
}

function createCategory(companyId, name) {
  const r = db
    .prepare(`INSERT INTO CategoryMaster (CompanyId, Name) VALUES (?, ?)`)
    .run(companyId, name);
  return { success: true, id: r.lastInsertRowid };
}

function deleteCategory(id) {
  db.prepare(`UPDATE CategoryMaster SET IsDeleted = 1 WHERE Id = ?`).run(id);
  return { success: true };
}

// ─── Stats ───────────────────────────────────────────────────────
function getStats(companyId) {
  const total = db
    .prepare(`SELECT COUNT(*) as n FROM ProductMaster WHERE CompanyId=? AND IsDeleted=0`)
    .get(companyId).n;
  const lowStock = db
    .prepare(
      `SELECT COUNT(*) as n FROM ProductMaster WHERE CompanyId=? AND IsDeleted=0 AND StockQty < 10 AND StockQty >= 0`,
    )
    .get(companyId).n;
  const outOfStock = db
    .prepare(
      `SELECT COUNT(*) as n FROM ProductMaster WHERE CompanyId=? AND IsDeleted=0 AND StockQty = 0`,
    )
    .get(companyId).n;
  const categories = db
    .prepare(`SELECT COUNT(*) as n FROM CategoryMaster WHERE CompanyId=? AND IsDeleted=0`)
    .get(companyId).n;
  return { total, lowStock, outOfStock, categories };
}
// ─── import / export ───────────────────────────────────────────────────────
function importCSV(companyId, rows) {
  const insert = db.prepare(`
    INSERT INTO ProductMaster
      (CompanyId, CategoryId, Name, Barcode, SKU, Price, VATRate, StockQty, IsDeleted)
    VALUES
      (@companyId, @categoryId, @name, @barcode, @sku, @price, @vatRate, @stockQty, 0)
  `);

  const findCategory = db.prepare(`
    SELECT Id FROM CategoryMaster
    WHERE CompanyId = ? AND Name = ? AND IsDeleted = 0
    LIMIT 1
  `);

  const createCategory = db.prepare(`
    INSERT INTO CategoryMaster (CompanyId, Name) VALUES (?, ?)
  `);

  const runAll = db.transaction((rows) => {
    let imported = 0;
    for (const row of rows) {
      // Auto-create category if it doesn't exist
      let categoryId = null;
      if (row.Category) {
        let cat = findCategory.get(companyId, row.Category);
        if (!cat) {
          const r = createCategory.run(companyId, row.Category);
          categoryId = r.lastInsertRowid;
        } else {
          categoryId = cat.Id;
        }
      }
      insert.run({
        companyId,
        categoryId,
        name: row.Name || '',
        barcode: row.Barcode || null,
        sku: row.SKU || null,
        price: parseFloat(row.Price) || 0,
        vatRate: parseFloat(row.VATRate) || 0,
        stockQty: parseFloat(row.StockQty) || 0,
      });
      imported++;
    }
    return imported;
  });

  const count = runAll(rows);
  return { success: true, imported: count };
}

function exportAll(companyId, format, categoryId) {
  let sql = `
    SELECT p.*, c.Name AS CategoryName
    FROM   ProductMaster p
    LEFT   JOIN CategoryMaster c ON p.CategoryId = c.Id
    WHERE  p.CompanyId = ? AND p.IsDeleted = 0
  `;
  const params = [companyId];
  if (categoryId) {
    sql += ` AND p.CategoryId = ?`;
    params.push(categoryId);
  }
  sql += ` ORDER BY p.Name`;
  const rows = db.prepare(sql).all(...params);
  return { success: true, rows, format };
}
function adjustStock(id, qty, note, companyId) {
  // existing stock update
  db.prepare(
    `
    UPDATE ProductMaster
    SET    StockQty  = StockQty + ?,
           Log       = ?,
           UpdatedAt = datetime('now')
    WHERE  Id = ? AND IsDeleted = 0
  `,
  ).run(qty, note || null, id);

  // existing movement log
  db.prepare(
    `
    INSERT INTO StockMovements (CompanyId, ProductId, Type, Qty, Note)
    VALUES (?, ?, 'Adjustment', ?, ?)
  `,
  ).run(companyId, id, qty, note || null);

  // NEW: clear low-stock notification log if stock
  // is back above threshold so it can re-alert later
  const product = db
    .prepare(
      `
    SELECT StockQty, LowStockThreshold
    FROM   ProductMaster
    WHERE  Id = ?
  `,
    )
    .get(id);

  if (product && product.StockQty > product.LowStockThreshold) {
    db.prepare(
      `
      DELETE FROM NotificationLog
      WHERE  Type        = 'stock'
        AND  ReferenceId = ?
    `,
    ).run(String(id));

    console.log(`NotificationLog: cleared stock alert for product ${id}`);
  }

  return { success: true };
}
module.exports = {
  getAll,
  getById,
  getByBarcode,
  create,
  update,
  softDelete,
  adjustStock,
  getCategories,
  createCategory,
  deleteCategory,
  getStats,
  getMovements,
};
