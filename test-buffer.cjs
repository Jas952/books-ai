const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');

ipcMain.handle('read-pdf-sync', () => fs.readFileSync('package.json'));
ipcMain.handle('read-pdf-async', async () => fsp.readFile('package.json'));

app.whenReady().then(() => {
  const win = new BrowserWindow({ webPreferences: { nodeIntegration: true, contextIsolation: false } });
  win.loadURL('data:text/html,<html><body><script>
    const { ipcRenderer } = require("electron");
    (async () => {
      const syncBuf = await ipcRenderer.invoke("read-pdf-sync");
      const asyncBuf = await ipcRenderer.invoke("read-pdf-async");
      console.log("SYNC isBuffer:", Buffer.isBuffer(syncBuf), "type:", syncBuf.constructor.name);
      console.log("ASYNC isBuffer:", Buffer.isBuffer(asyncBuf), "type:", asyncBuf.constructor.name);
      require("electron").ipcRenderer.send("done");
    })();
  </script></body></html>');
  win.webContents.on('console-message', (e, level, msg) => console.log('[Browser]', msg));
  ipcMain.on('done', () => app.quit());
});
