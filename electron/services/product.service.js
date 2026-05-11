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

  if (!includeDeleted) sql += ` AND p.IsDeleted = 0`;
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
    WHERE (Barcode = ? OR Barcode2 = ?) AND CompanyId = ? AND IsDeleted = 0
  `,
    )
    .get(barcode, barcode, companyId);
}

function create(data) {
  const result = db
    .prepare(
      `
    INSERT INTO ProductMaster
      (CompanyId, CategoryId, Name, Barcode, Barcode2, SKU,
       Price, VATRate, IsVATInclusive, StockQty, Log)
    VALUES
      (@companyId, @categoryId, @name, @barcode, @barcode2, @sku,
       @price, @vatRate, @isVATInclusive, @stockQty, @log)
  `,
    )
    .run({
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

// ── Single adjustStock (merged both versions) ─────────────────
function adjustStock(id, qty, note, companyId) {
  db.prepare(
    `
    UPDATE ProductMaster
    SET    StockQty  = StockQty + ?,
           Log       = ?,
           UpdatedAt = datetime('now')
    WHERE  Id = ? AND IsDeleted = 0
  `,
  ).run(qty, note || null, id);

  db.prepare(
    `
    INSERT INTO StockMovements (CompanyId, ProductId, Type, Qty, Note)
    VALUES (?, ?, 'Adjustment', ?, ?)
  `,
  ).run(companyId, id, qty, note || null);

  const product = db
    .prepare(
      `
    SELECT StockQty, LowStockThreshold FROM ProductMaster WHERE Id = ?
  `,
    )
    .get(id);

  if (product && product.StockQty > product.LowStockThreshold) {
    db.prepare(
      `
      DELETE FROM NotificationLog
      WHERE Type = 'stock' AND ReferenceId = ?
    `,
    ).run(String(id));
    console.log(`NotificationLog: cleared stock alert for product ${id}`);
  }

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
      `SELECT COUNT(*) as n FROM ProductMaster
     WHERE CompanyId=? AND IsDeleted=0 AND StockQty < 10 AND StockQty >= 0`,
    )
    .get(companyId).n;

  const outOfStock = db
    .prepare(
      `SELECT COUNT(*) as n FROM ProductMaster
     WHERE CompanyId=? AND IsDeleted=0 AND StockQty = 0`,
    )
    .get(companyId).n;

  const categories = db
    .prepare(`SELECT COUNT(*) as n FROM CategoryMaster WHERE CompanyId=? AND IsDeleted=0`)
    .get(companyId).n;

  return { total, lowStock, outOfStock, categories };
}

// ─── Import CSV ──────────────────────────────────────────────────
function importCSV(companyId, rows) {
  if (!companyId) return { success: false, error: 'Missing companyId' };
  if (!Array.isArray(rows) || rows.length === 0)
    return { success: false, error: 'No rows provided' };

  const findCategory = db.prepare(`
    SELECT Id FROM CategoryMaster
    WHERE CompanyId = ? AND Name = ? AND IsDeleted = 0
    LIMIT 1
  `);

  const createCat = db.prepare(`
    INSERT INTO CategoryMaster (CompanyId, Name) VALUES (?, ?)
  `);

  // Check if product already exists by barcode or name to avoid duplicates
  const findProduct = db.prepare(`
    SELECT Id FROM ProductMaster
    WHERE CompanyId = ? AND IsDeleted = 0
      AND (( Barcode = ? AND Barcode != '' ) OR Name = ?)
    LIMIT 1
  `);

  const insertProduct = db.prepare(`
    INSERT INTO ProductMaster
      (CompanyId, CategoryId, Name, Barcode, SKU,
       Price, VATRate, IsVATInclusive, StockQty, IsDeleted,
       CreatedAt, UpdatedAt)
    VALUES
      (@companyId, @categoryId, @name, @barcode, @sku,
       @price, @vatRate, 0, @stockQty, 0,
       datetime('now','localtime'), datetime('now','localtime'))
  `);

  const updateProduct = db.prepare(`
    UPDATE ProductMaster SET
      CategoryId = @categoryId,
      Name       = @name,
      Barcode    = @barcode,
      SKU        = @sku,
      Price      = @price,
      VATRate    = @vatRate,
      StockQty   = StockQty + @stockQty,
      UpdatedAt  = datetime('now','localtime')
    WHERE Id = @id
  `);

  const insertMovement = db.prepare(`
  INSERT INTO StockMovements (CompanyId, ProductId, Type, Qty, Note, CreatedAt)
  VALUES (?, ?, 'Adjustment', ?, 'CSV import', datetime('now','localtime'))
`);

  // Category cache — avoids hitting DB for every row with the same category
  const catCache = new Map();

  const getCategoryId = (categoryName) => {
    const name = (categoryName || '').trim();
    if (!name) return null;
    if (catCache.has(name)) return catCache.get(name);

    const existing = findCategory.get(companyId, name);
    if (existing) {
      catCache.set(name, existing.Id);
      return existing.Id;
    }
    const created = createCat.run(companyId, name);
    catCache.set(name, created.lastInsertRowid);
    return created.lastInsertRowid;
  };

  const runAll = db.transaction((rows) => {
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const name = (row['Name'] || '').trim();
      const barcode = (row['Barcode'] || '').trim();
      const sku = (row['SKU'] || '').trim();
      const price = parseFloat(row['Price']) || 0;
      const vatRate = parseFloat(row['VATRate']) || 0;
      const stockQty = parseInt(row['StockQty']) || 0;
      const catId = getCategoryId(row['Category']);

      if (!name) {
        skipped++;
        continue;
      }

      const existing = findProduct.get(companyId, barcode || '__no_barcode__', name);

      if (existing) {
        // Update existing product — add incoming stock on top
        updateProduct.run({
          id: existing.Id,
          categoryId: catId,
          name,
          barcode: barcode || null,
          sku: sku || null,
          price,
          vatRate,
          stockQty,
        });
        if (stockQty > 0) insertMovement.run(companyId, existing.Id, stockQty);
      } else {
        // Insert new product
        const result = insertProduct.run({
          companyId,
          categoryId: catId,
          name,
          barcode: barcode || null,
          sku: sku || null,
          price,
          vatRate,
          stockQty,
        });
        if (stockQty > 0) insertMovement.run(companyId, result.lastInsertRowid, stockQty);
      }

      imported++;
    }

    return { imported, skipped };
  });

  try {
    const { imported, skipped } = runAll(rows);
    console.log(`product.service importCSV: imported=${imported} skipped=${skipped}`);
    return { success: true, imported, skipped };
  } catch (err) {
    console.error('product.service importCSV error:', err);
    return { success: false, error: err.message };
  }
}

// ─── Export ──────────────────────────────────────────────────────
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

// ─── Exports ─────────────────────────────────────────────────────

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
  importCSV, // ← was missing
  exportAll, // ← was missing
};
