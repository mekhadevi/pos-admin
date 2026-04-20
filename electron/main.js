const { app, BrowserWindow, net } = require('electron');
const path = require('path');
const db = require('./db');

const { runMigrations } = require('./db/migrate');
const { NotificationService } = require('./services/notification.service');

const authService = require('./services/auth.service');
const registerWeatherIPC = require('./ipc/weather');
const registerProductIPC = require('./ipc/product.ipc');
const registerAuthIPC = require('./ipc/auth.ipc');
const registerNotificationIPC = require('./ipc/notification.ipc'); // ← new

let mainWindow;
let notificationService;

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
  // 1. Run migrations first
  runMigrations();

  // 2. Init services
  authService.initialize();

  // 3. Register IPC handlers
  registerWeatherIPC();
  registerProductIPC();
  registerAuthIPC();

  // 4. Create window
  createWindow();

  // 5. Register notification IPC
  // (needs mainWindow — so after createWindow)
  registerNotificationIPC(() => notificationService);
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

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
  } else {
    const indexPath = path.join(__dirname, '../dist/pos-admin/browser/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    // Internet check
    checkInternet();
    setInterval(checkInternet, 5000);

    // Start notification polling AFTER Angular loads
    notificationService = new NotificationService(mainWindow);
    notificationService.start(30_000); // every 30 seconds

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
