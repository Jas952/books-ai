const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;
const iconPath = path.resolve(__dirname, '..', 'assets', 'image.icns');

let aiServerProcess = null;

function startAIServer() {
  const projectRoot = path.resolve(__dirname, '..');

  // В dev — запускаем через `go run`, в prod — ищем бинарник
  let command, args, cwd;

  if (isDev) {
    command = 'go';
    args = ['run', '.'];
    cwd = path.join(projectRoot, 'src', 'ai', 'main');
  } else {
    // В production бинарник должен лежать рядом с app в resources
    const binaryName = process.platform === 'win32' ? 'ai-server.exe' : 'ai-server';
    command = path.join(process.resourcesPath, binaryName);
    args = [];
    cwd = process.resourcesPath;
  }

  console.log(`[AI Server] Запускаю: ${command} ${args.join(' ')} (cwd: ${cwd})`);

  aiServerProcess = spawn(command, args, {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  aiServerProcess.stdout.on('data', (data) => {
    console.log(`[AI Server] ${data.toString().trim()}`);
  });

  aiServerProcess.stderr.on('data', (data) => {
    console.error(`[AI Server ERR] ${data.toString().trim()}`);
  });

  aiServerProcess.on('exit', (code) => {
    console.log(`[AI Server] Завершён с кодом ${code}`);
    aiServerProcess = null;
  });
}

function stopAIServer() {
  if (aiServerProcess) {
    console.log('[AI Server] Останавливаю...');
    aiServerProcess.kill();
    aiServerProcess = null;
  }
}

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
  autoUpdater.autoRunAppAfterInstall = true;

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-status', `Доступно обновление: v${info.version}`);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    win.webContents.send('update-status', `Загрузка: ${Math.round(progressObj.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('update-status', `✅ v${info.version} скачана — перезапустите`);
    dialog.showMessageBox(win, {
      type: 'info',
      title: `Обновление v${info.version} готово`,
      message: `Новая версия загружена.\n\nНажмите «Установить» — приложение закроется, установите новый DMG и запустите снова.`,
      buttons: ['Установить', 'Позже'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        // На macOS без code signing quitAndInstall не работает —
        // открываем страницу релиза на GitHub для ручной установки
        if (process.platform === 'darwin') {
          const { shell } = require('electron');
          shell.openExternal('https://github.com/Jas952/books-ai/releases/latest');
          // Даём секунду чтобы браузер открылся, потом закрываем приложение
          setTimeout(() => {
            app.quit();
          }, 1500);
        } else {
          // На Windows/Linux работает нормально
          win.webContents.send('update-status', 'Устанавливаю обновление...');
          setImmediate(() => {
            autoUpdater.quitAndInstall(false, true);
          });
        }
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
    win.webContents.send('update-status', `Ошибка обновления: ${err.message}`);
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

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  setupAutoUpdater(win);
}

// Регистрируем обработчики IPC только один раз
ipcMain.handle('get-books-path', () => getBooksPath());

ipcMain.handle('list-books', async () => {
  const booksDir = getBooksPath();
  if (!fs.existsSync(booksDir)) {
    await fsp.mkdir(booksDir, { recursive: true });
  }
  const files = await fsp.readdir(booksDir);
  return files
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => ({ name: f, path: path.join(booksDir, f) }));
});

ipcMain.handle('read-pdf', async (event, filePath) => {
  return fsp.readFile(filePath);
});

// Версия приложения для отображения в UI
ipcMain.handle('get-app-version', () => app.getVersion());

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(iconPath);
    } catch (err) {
      console.error('Failed to set dock icon:', err.message);
    }
  }
  startAIServer();
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

app.on('before-quit', () => {
  stopAIServer();
});
