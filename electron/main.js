const { app, BrowserWindow, net } = require('electron');
const path = require('path');
const db = require('./db');

const { runMigrations, inventoryMigrations, customerMigrations } = require('./db/migrate');
const { NotificationService } = require('./services/notification.service');

const authService = require('./services/auth.service');
const registerWeatherIPC = require('./ipc/weather');
const registerProductIPC = require('./ipc/product.ipc');
const registerAuthIPC = require('./ipc/auth.ipc');
const registerNotificationIPC = require('./ipc/notification.ipc');
const registerCheckoutIPC = require('./ipc/checkout.ipc');
const registerInventoryIPC = require('./ipc/inventory.ipc');
const registerReportsIPC = require('./ipc/reports.ipc');
const registerCustomerIPC = require('./ipc/customer.ipc');
const registerSupplierIPC = require('./ipc/supplier.ipc');
const registerReceiptsIPC = require('./ipc/receipts.ipc');
const registerBackupIPC = require('./ipc/backup.ipc');
const registerSettingsIPC = require('./ipc/settings.ipc');
const { settingsMigrations } = require('./ipc/settings.ipc');

let mainWindow;
let notificationService;

// ── Global rejection catcher — logs exact file + line ───
process.on('unhandledRejection', (reason) => {
  console.error('═══ UNHANDLED REJECTION ═══');
  console.error(reason?.stack || reason);
  console.error('═══════════════════════════');
});

// ── Internet check ───────────────────────────────────────
async function checkInternet() {
  try {
    await fetch('https://dns.google', { method: 'HEAD' });
    mainWindow.webContents.send('online-status', true);
  } catch {
    mainWindow.webContents.send('online-status', false);
  }
}

// ── App ready ────────────────────────────────────────────
app.whenReady().then(() => {
  // 1. Run migrations first — this creates ALL tables including SaleMaster
  runMigrations();

  // 2. Init services
  authService.initialize();

  // DEBUG: verify importCSV is properly exported
  try {
    const svc = require('./services/product.service');
    console.log('importCSV type:', typeof svc.importCSV);
    console.log('exportAll type:', typeof svc.exportAll);
    if (typeof svc.importCSV !== 'function') {
      console.error('❌ importCSV is not a function — check module.exports in product.service.js');
    } else {
      console.log('✅ importCSV is ready');
    }
  } catch (e) {
    console.error('❌ Failed to load product.service:', e.message);
  }

  // 3. Register IPC handlers
  try {
    registerWeatherIPC();
    console.log('✅ weatherIPC registered');
  } catch (e) {
    console.error('❌ weatherIPC failed:', e.message);
  }

  try {
    registerProductIPC();
    console.log('✅ productIPC registered');
  } catch (e) {
    console.error('❌ productIPC failed:', e.message);
  }

  try {
    registerAuthIPC();
    console.log('✅ authIPC registered');
  } catch (e) {
    console.error('❌ authIPC failed:', e.message);
  }

  try {
    registerCheckoutIPC();
    console.log('✅ checkoutIPC registered');
  } catch (e) {
    console.error('❌ checkoutIPC failed:', e.message);
  }

  // 4. Create window
  createWindow();

  // 5. Register notification IPC (needs mainWindow — so after createWindow)
  try {
    registerNotificationIPC(() => notificationService);
    console.log('✅ notificationIPC registered');
  } catch (e) {
    console.error('❌ notificationIPC failed:', e.message);
  }

  inventoryMigrations();
  registerInventoryIPC();
  registerReportsIPC();
  customerMigrations();
  registerCustomerIPC();
  registerSupplierIPC();

  try {
    registerReceiptsIPC();
    console.log('✅ receiptsIPC registered');
  } catch (e) {
    console.error('❌ receiptsIPC failed:', e.message);
  }
  registerBackupIPC();
  console.log('✅ backupIPC registered');
  settingsMigrations();
  registerSettingsIPC();
  console.log('✅ settingsIPC registered');
});

// ── Window ───────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.maximize();
  mainWindow.webContents.openDevTools();

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
  } else {
    const indexPath = path.join(__dirname, '../dist/pos-admin/browser/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    checkInternet();
    setInterval(checkInternet, 5000);

    notificationService = new NotificationService(mainWindow);
    notificationService.start(30_000);

    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    notificationService?.stop();
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
