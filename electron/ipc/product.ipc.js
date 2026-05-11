const { ipcMain } = require('electron');
const svc = require('../services/product.service');

module.exports = function registerProductIPC() {
  // ── Products ─────────────────────────────────────────────
  ipcMain.handle('products:getAll', (_, args) => svc.getAll(args));

  ipcMain.handle('products:getById', (_, id) => svc.getById(id));

  ipcMain.handle('products:getByBarcode', (_, { barcode, companyId }) =>
    svc.getByBarcode(barcode, companyId),
  );

  //  undefined `productService` instead of `svc`
  ipcMain.handle('products:getMovements', (_, companyId) => svc.getMovements(companyId));

  ipcMain.handle('products:create', (_, data) => svc.create(data));

  ipcMain.handle('products:update', (_, { id, data }) => svc.update(id, data));

  ipcMain.handle('products:delete', (_, id) => svc.softDelete(id));

  ipcMain.handle('products:adjustStock', (_, id, qty, note, companyId) =>
    svc.adjustStock(id, qty, note, companyId),
  );

  ipcMain.handle('products:getStats', (_, companyId) => svc.getStats(companyId));

  ipcMain.handle('products:importCSV', (_, { companyId, rows }) => svc.importCSV(companyId, rows));

  ipcMain.handle('products:exportAll', (_, { companyId, format, categoryId }) =>
    svc.exportAll(companyId, format, categoryId),
  );

  // ── Categories ───────────────────────────────────────────
  ipcMain.handle('categories:getAll', (_, companyId) => svc.getCategories(companyId));

  ipcMain.handle('categories:create', (_, { companyId, name }) =>
    svc.createCategory(companyId, name),
  );

  ipcMain.handle('categories:delete', (_, id) => svc.deleteCategory(id));
};
