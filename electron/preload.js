const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (data) => ipcRenderer.invoke('login', data),
  getSession: () => ipcRenderer.invoke('get-session'),
  logout: () => ipcRenderer.invoke('logout'),

  // Weather
  getWeather: () => ipcRenderer.invoke('get-weather'),

  // Online status
  onOnlineStatus: (callback) => ipcRenderer.on('online-status', (_, status) => callback(status)),

  // Products
  products: {
    getAll: (args) => ipcRenderer.invoke('products:getAll', args),
    getById: (id) => ipcRenderer.invoke('products:getById', id),
    getByBarcode: (barcode, cid) =>
      ipcRenderer.invoke('products:getByBarcode', { barcode, companyId: cid }),
    create: (data) => ipcRenderer.invoke('products:create', data),
    update: (id, data) => ipcRenderer.invoke('products:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
    //adjustStock: (id, qty, note) => ipcRenderer.invoke('products:adjustStock', { id, qty, note }),
    getStats: (companyId) => ipcRenderer.invoke('products:getStats', companyId),

    getMovements: (companyId) => ipcRenderer.invoke('products:getMovements', companyId),
    adjustStock: (id, qty, note, companyId) =>
      ipcRenderer.invoke('products:adjustStock', id, qty, note, companyId),
    importCSV: (companyId, rows) => ipcRenderer.invoke('products:importCSV', { companyId, rows }),
    exportAll: (companyId, format, categoryId) =>
      ipcRenderer.invoke('products:exportAll', { companyId, format, categoryId }),
  },

  // Categories
  categories: {
    getAll: (companyId) => ipcRenderer.invoke('categories:getAll', companyId),
    create: (companyId, name) => ipcRenderer.invoke('categories:create', { companyId, name }),
    delete: (id) => ipcRenderer.invoke('categories:delete', id),
  },

  // ── Notification listeners (Main → Angular) ───────────
  onLowStock: (cb) => {
    ipcRenderer.removeAllListeners('low-stock');
    ipcRenderer.on('low-stock', (_, v) => cb(v));
  },
  onExpiryAlert: (cb) => {
    ipcRenderer.removeAllListeners('expiry-alert');
    ipcRenderer.on('expiry-alert', (_, v) => cb(v));
  },
  onDeliveryArrived: (cb) => {
    ipcRenderer.removeAllListeners('delivery-arrived');
    ipcRenderer.on('delivery-arrived', (_, v) => cb(v));
  },
  onCashierStatus: (cb) => {
    ipcRenderer.removeAllListeners('cashier-status');
    ipcRenderer.on('cashier-status', (_, v) => cb(v));
  },

  // ── Notification queries (Angular → Main) ─────────────
  getLowStock: (companyId) => ipcRenderer.invoke('get-low-stock', companyId),
  getExpiring: (companyId) => ipcRenderer.invoke('get-expiring', companyId),
  addDelivery: (data) => ipcRenderer.invoke('add-delivery', data),
  updateRegister: (data) => ipcRenderer.invoke('update-register', data),
  triggerNotificationCheck: () => ipcRenderer.invoke('trigger-notification-check'),

  // ── Cleanup ───────────────────────────────────────────
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // ── pos ───────────────────────────────────────────
  checkout: {
    completeSale: (data) => ipcRenderer.invoke('checkout:completeSale', data),
    printReceipt: (saleId) => ipcRenderer.invoke('checkout:printReceipt', saleId),
    getSaleHistory: (args) => ipcRenderer.invoke('checkout:getSaleHistory', args),
    getSaleById: (saleId) => ipcRenderer.invoke('checkout:getSaleById', saleId),
    refund: (data) => ipcRenderer.invoke('checkout:refund', data),
  },

  // ── inventory ───────────────────────────────────────────
  inventory: {
    getStats: (companyId) => ipcRenderer.invoke('inventory:getStats', companyId),
    getExpiryProducts: (companyId, days) =>
      ipcRenderer.invoke('inventory:getExpiryProducts', companyId, days),
    getMovements: (companyId, type) =>
      ipcRenderer.invoke('inventory:getMovements', companyId, type),
    getSuppliers: (companyId) => ipcRenderer.invoke('inventory:getSuppliers', companyId),
    getPurchaseOrders: (companyId) => ipcRenderer.invoke('inventory:getPurchaseOrders', companyId),
    createPurchaseOrder: (data) => ipcRenderer.invoke('inventory:createPurchaseOrder', data),
    receivePurchaseOrder: (poId, companyId) =>
      ipcRenderer.invoke('inventory:receivePurchaseOrder', poId, companyId),
    exportMovements: (companyId) => ipcRenderer.invoke('inventory:exportMovements', companyId),
  },

  // ── reports ───────────────────────────────────────────
  reports: {
    getDaily: (args) => ipcRenderer.invoke('reports:getDaily', args),
    getMonthly: (args) => ipcRenderer.invoke('reports:getMonthly', args),
    getProducts: (args) => ipcRenderer.invoke('reports:getProducts', args),
    getCategory: (args) => ipcRenderer.invoke('reports:getCategory', args),
    getVat: (args) => ipcRenderer.invoke('reports:getVat', args),
    getProfit: (args) => ipcRenderer.invoke('reports:getProfit', args),
    getPayment: (args) => ipcRenderer.invoke('reports:getPayment', args),
    getUsers: (args) => ipcRenderer.invoke('reports:getUsers', args),
    export: (args) => ipcRenderer.invoke('reports:export', args),
  },

  // ── customers ──────────────────────────────────────────────────────────────────
  customers: {
    getAll: (companyId) => ipcRenderer.invoke('customers:getAll', companyId),
    getById: (id) => ipcRenderer.invoke('customers:getById', id),
    search: (companyId, query) => ipcRenderer.invoke('customers:search', companyId, query),
    create: (data) => ipcRenderer.invoke('customers:create', data),
    update: (id, data) => ipcRenderer.invoke('customers:update', id, data),
    delete: (id) => ipcRenderer.invoke('customers:delete', id),
    getStats: (companyId) => ipcRenderer.invoke('customers:getStats', companyId),
    getHistory: (customerId) => ipcRenderer.invoke('customers:getHistory', customerId),
    adjustLoyalty: (id, delta) => ipcRenderer.invoke('customers:adjustLoyalty', id, delta),
    export: (companyId) => ipcRenderer.invoke('customers:export', companyId),
  },

  // ── Suppliers ──────────────────────────────────────────────────────────────────

  suppliers: {
    // CRUD
    getAll: (companyId) => ipcRenderer.invoke('suppliers:getAll', companyId),
    getById: (id) => ipcRenderer.invoke('suppliers:getById', id),
    create: (data) => ipcRenderer.invoke('suppliers:create', data),
    update: (id, data) => ipcRenderer.invoke('suppliers:update', id, data),
    delete: (id) => ipcRenderer.invoke('suppliers:delete', id),
    // Stats
    getStats: (companyId) => ipcRenderer.invoke('suppliers:getStats', companyId),
    // Purchase orders & products
    getPurchaseOrders: (supplierId, companyId) =>
      ipcRenderer.invoke('suppliers:getPurchaseOrders', supplierId, companyId),
    getProducts: (supplierId, companyId) =>
      ipcRenderer.invoke('suppliers:getProducts', supplierId, companyId),
    getAllProducts: (companyId) => ipcRenderer.invoke('suppliers:getAllProducts', companyId),
    // Payments & balance
    getPayments: (supplierId, companyId) =>
      ipcRenderer.invoke('suppliers:getPayments', supplierId, companyId),
    getBalance: (supplierId, companyId) =>
      ipcRenderer.invoke('suppliers:getBalance', supplierId, companyId),
    recordPayment: (data) => ipcRenderer.invoke('suppliers:recordPayment', data),
    deletePayment: (id) => ipcRenderer.invoke('suppliers:deletePayment', id),
    getOutstandingAll: (companyId) => ipcRenderer.invoke('suppliers:getOutstandingAll', companyId),
    // Export
    export: (companyId) => ipcRenderer.invoke('suppliers:export', companyId),
  },

  // ── Receipts ──────────────────────────────────────────────────────────────────
  receipts: {
    getAll: (args) => ipcRenderer.invoke('receipts:getAll', args),
    getById: (id) => ipcRenderer.invoke('receipts:getById', id),
    getStats: (args) => ipcRenderer.invoke('receipts:getStats', args),
    void: (saleId, companyId) => ipcRenderer.invoke('receipts:void', saleId, companyId),
    exportCSV: (companyId, dateFrom, dateTo) =>
      ipcRenderer.invoke('receipts:exportCSV', companyId, dateFrom, dateTo),
    getDailySummary: (args) => ipcRenderer.invoke('receipts:getDailySummary', args),
  },

  // ── Backup ──────────────────────────────────────────────────────────────────
  backup: {
    create: (label) => ipcRenderer.invoke('backup:create', label),
    getHistory: () => ipcRenderer.invoke('backup:getHistory'),
    listFiles: () => ipcRenderer.invoke('backup:listFiles'),
    delete: (filename) => ipcRenderer.invoke('backup:delete', filename),
    export: (filename) => ipcRenderer.invoke('backup:export', filename),
    restore: (filename) => ipcRenderer.invoke('backup:restore', filename),
    restoreFromFile: () => ipcRenderer.invoke('backup:restoreFromFile'),
    getDbInfo: () => ipcRenderer.invoke('backup:getDbInfo'),
    getSchedule: () => ipcRenderer.invoke('backup:getSchedule'),
    saveSchedule: (sched) => ipcRenderer.invoke('backup:saveSchedule', sched),
    openFolder: () => ipcRenderer.invoke('backup:openFolder'),
    clearLog: () => ipcRenderer.invoke('backup:clearLog'),
  },
  // ── Settings ──────────────────────────────────────────────────────────────────
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    setMany: (map) => ipcRenderer.invoke('settings:setMany', map),
    resetSection: (prefix) => ipcRenderer.invoke('settings:resetSection', prefix),
    getUsers: (companyId) => ipcRenderer.invoke('settings:getUsers', companyId),
    createUser: (data) => ipcRenderer.invoke('settings:createUser', data),
    updateUser: (id, data) => ipcRenderer.invoke('settings:updateUser', id, data),
    deleteUser: (id) => ipcRenderer.invoke('settings:deleteUser', id),
    getBranches: (companyId) => ipcRenderer.invoke('settings:getBranches', companyId),
    createBranch: (data) => ipcRenderer.invoke('settings:createBranch', data),
    updateBranch: (id, data) => ipcRenderer.invoke('settings:updateBranch', id, data),
    deleteBranch: (id) => ipcRenderer.invoke('settings:deleteBranch', id),
    getAppInfo: () => ipcRenderer.invoke('settings:getAppInfo'),
  },
});
