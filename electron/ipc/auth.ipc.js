// electron/ipc/auth.ipc.js
const { ipcMain } = require('electron');
const authService = require('../services/auth.service');

let session = null;

module.exports = function registerAuthIPC() {
  ipcMain.handle('login', (event, data) => {
    const result = authService.login(data);
    if (result.success) {
      session = result;
    }
    return result;
  });

  ipcMain.handle('get-session', () => {
    return session;
  });

  ipcMain.handle('logout', () => {
    session = null;
    return { success: true };
  });
};
