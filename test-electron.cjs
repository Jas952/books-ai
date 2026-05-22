const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 800, height: 600, webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false } });
  win.loadFile('dist/index.html');
  win.webContents.on('console-message', (e, level, msg) => {
    console.log('[Browser Console]', msg);
  });
});
