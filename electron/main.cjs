const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;
const iconPath = path.resolve(__dirname, '..', 'assets', 'image.icns');

// Force app name for macOS menu bar (otherwise shows "Electron" in dev)
app.name = 'Books Agent';

let aiServerProcess = null;

function startAIServer() {
  const projectRoot = path.resolve(__dirname, '..');

  let command, args, cwd, extraEnv = {};

  if (isDev) {
    command = 'go';
    args = ['run', '.'];
    cwd = path.join(projectRoot, 'src', 'ai', 'main');
  } else {
    // В production бинарник должен лежать в Resources/
    const binaryName = process.platform === 'win32' ? 'ai-server.exe' : 'ai-server';
    command = path.join(process.resourcesPath, binaryName);
    args = [];
    cwd = process.resourcesPath;

    // Проверяем что бинарник существует
    if (!fs.existsSync(command)) {
      console.warn(`[AI Server] Бинарник не найден: ${command}`);
      console.warn('[AI Server] AI-чат будет недоступен. Пересоберите приложение с Go-бинарником.');
      return; // Не крашим приложение, просто чат не работает
    }

    // Читаем .env из папки ресурсов (будет скопирован при сборке)
    const envPath = path.join(process.resourcesPath, '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      lines.forEach(line => {
        const [key, ...vals] = line.replace(/^export\s+/, '').split('=');
        if (key && vals.length) {
          extraEnv[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
        }
      });
    }
  }

  console.log(`[AI Server] Запускаю: ${command} ${args.join(' ')} (cwd: ${cwd})`);

  // Kill any stale process on port 8765 before starting (dev restart safety)
  try {
    const { execSync } = require('child_process');
    const pids = execSync('lsof -ti:8765 2>/dev/null', { encoding: 'utf8' }).trim();
    if (pids) {
      console.log(`[AI Server] Убиваю старый процесс на порту 8765: ${pids}`);
      execSync(`kill -9 ${pids.split('\n').join(' ')}`, { encoding: 'utf8' });
    }
  } catch (_) { /* no process on port — ok */ }

  try {
    aiServerProcess = spawn(command, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    aiServerProcess.stdout.on('data', (data) => {
      console.log(`[AI Server] ${data.toString().trim()}`);
    });

    aiServerProcess.stderr.on('data', (data) => {
      console.error(`[AI Server ERR] ${data.toString().trim()}`);
    });

    aiServerProcess.on('error', (err) => {
      console.error(`[AI Server] Ошибка запуска: ${err.message}`);
      aiServerProcess = null;
    });

    aiServerProcess.on('exit', (code) => {
      console.log(`[AI Server] Завершён с кодом ${code}`);
      aiServerProcess = null;
    });
  } catch (err) {
    console.error(`[AI Server] Не удалось запустить: ${err.message}`);
    aiServerProcess = null;
  }
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
    minWidth: 1000,
    minHeight: 700,
    title: 'Books Agent',
    icon: iconPath,
    titleBarStyle: 'hiddenInset',
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
    win.webContents.on("console-message", (e, level, msg) => console.log("[Browser]", msg));
  }

  setupAutoUpdater(win);
}

function setupApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // { role: 'appMenu' }
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' },
                  { role: 'stopSpeaking' }
                ]
              }
            ]
          : [
              { role: 'delete' },
              { type: 'separator' },
              { role: 'selectAll' }
            ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [
              { role: 'close' }
            ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://github.com/Jas952/books-ai')
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Регистрируем обработчики IPC только один раз
ipcMain.handle('get-books-path', () => getBooksPath());

// List books and folders in a given relative path within books dir
ipcMain.handle('list-books', async (_event, relPath = '') => {
  const booksDir = getBooksPath();
  const targetDir = relPath ? path.join(booksDir, relPath) : booksDir;

  if (!fs.existsSync(targetDir)) {
    await fsp.mkdir(targetDir, { recursive: true });
  }

  const entries = await fsp.readdir(targetDir, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip hidden files

    if (entry.isDirectory()) {
      items.push({
        type: 'folder',
        name: entry.name,
        path: path.join(targetDir, entry.name),
        relPath: relPath ? `${relPath}/${entry.name}` : entry.name
      });
    } else if (entry.name.toLowerCase().endsWith('.pdf')) {
      items.push({
        type: 'file',
        name: entry.name,
        path: path.join(targetDir, entry.name),
        relPath: relPath ? `${relPath}/${entry.name}` : entry.name
      });
    }
  }

  // Sort: folders first, then files
  items.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  return items;
});

ipcMain.handle('read-pdf', async (event, filePath) => {
  return fsp.readFile(filePath);
});

// Create a new folder inside books dir
ipcMain.handle('create-folder', async (_event, relParentPath, folderName) => {
  const booksDir = getBooksPath();
  const parentDir = relParentPath ? path.join(booksDir, relParentPath) : booksDir;
  const newDir = path.join(parentDir, folderName);

  // Security: prevent directory traversal
  if (!newDir.startsWith(booksDir)) {
    throw new Error('Invalid folder path');
  }

  await fsp.mkdir(newDir, { recursive: true });
  return { success: true, path: newDir };
});

// Move a book (PDF) to a different folder
ipcMain.handle('move-book', async (_event, bookAbsPath, targetRelPath) => {
  const booksDir = getBooksPath();
  const targetDir = targetRelPath ? path.join(booksDir, targetRelPath) : booksDir;
  const fileName = path.basename(bookAbsPath);
  const destPath = path.join(targetDir, fileName);

  // Security checks
  if (!bookAbsPath.startsWith(booksDir)) throw new Error('Invalid source path');
  if (!destPath.startsWith(booksDir)) throw new Error('Invalid destination path');
  if (bookAbsPath === destPath) return { success: true };

  // Ensure target dir exists
  if (!fs.existsSync(targetDir)) {
    await fsp.mkdir(targetDir, { recursive: true });
  }

  await fsp.rename(bookAbsPath, destPath);
  return { success: true, newPath: destPath };
});

// Delete an empty folder
ipcMain.handle('delete-folder', async (_event, folderRelPath) => {
  const booksDir = getBooksPath();
  const folderPath = path.join(booksDir, folderRelPath);

  // Security check
  if (!folderPath.startsWith(booksDir) || folderPath === booksDir) {
    throw new Error('Invalid folder path');
  }

  const entries = await fsp.readdir(folderPath);
  if (entries.length > 0) {
    throw new Error('Folder is not empty. Move or delete contents first.');
  }

  await fsp.rmdir(folderPath);
  return { success: true };
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
  setupApplicationMenu();
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
