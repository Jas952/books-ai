const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const isDev = !app.isPackaged;
const iconPath = path.resolve(__dirname, '..', 'assets', 'image.icns');

function getBooksPath() {
  if (isDev) {
    return path.resolve(__dirname, '..', 'books');
  } else {
    return path.join(process.resourcesPath, 'books');
  }
}

function setupAutoUpdater(win) {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-status', `Доступно обновление: v${info.version}. Загрузка...`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Обновление готово',
      message: `Версия ${info.version} загружена. Перезапустить приложение?`,
      buttons: ['Перезапустить', 'Позже']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
  });

  autoUpdater.checkForUpdatesAndNotify();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Books Agent',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  ipcMain.handle('get-books-path', () => getBooksPath());

  ipcMain.handle('list-books', () => {
    const booksDir = getBooksPath();
    if (!fs.existsSync(booksDir)) {
      fs.mkdirSync(booksDir, { recursive: true });
    }
    const files = fs.readdirSync(booksDir);
    return files
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => ({ name: f, path: path.join(booksDir, f) }));
  });

  ipcMain.handle('read-pdf', (event, filePath) => {
    return fs.readFileSync(filePath);
  });

  // Версия приложения для отображения в UI
  ipcMain.handle('get-app-version', () => app.getVersion());

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  setupAutoUpdater(win);
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(iconPath);
    } catch (err) {
      console.error('Failed to set dock icon:', err.message);
    }
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
