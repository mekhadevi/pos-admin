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
  onLowStock: (cb) => ipcRenderer.on('low-stock', (_, v) => cb(v)),
  onExpiryAlert: (cb) => ipcRenderer.on('expiry-alert', (_, v) => cb(v)),
  onDeliveryArrived: (cb) => ipcRenderer.on('delivery-arrived', (_, v) => cb(v)),
  onCashierStatus: (cb) => ipcRenderer.on('cashier-status', (_, v) => cb(v)),

  // ── Notification queries (Angular → Main) ─────────────
  getLowStock: (companyId) => ipcRenderer.invoke('get-low-stock', companyId),
  getExpiring: (companyId) => ipcRenderer.invoke('get-expiring', companyId),
  addDelivery: (data) => ipcRenderer.invoke('add-delivery', data),
  updateRegister: (data) => ipcRenderer.invoke('update-register', data),
  triggerNotificationCheck: () => ipcRenderer.invoke('trigger-notification-check'),

  // ── Cleanup ───────────────────────────────────────────
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
