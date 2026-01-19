const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const Database = require('./database');
const { registerIpcHandlers } = require('./ipc-handlers');

const isDev = process.env.ELECTRON_DEV === 'true';

let mainWindow = null;
let db = null;
let updateDialogWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    fullscreen: !isDev,
    kiosk: !isDev,
    autoHideMenuBar: true,
    frame: isDev,
    resizable: isDev,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
      sandbox: false
    },
    backgroundColor: '#1a1a2e',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isDev) {
      if (input.key === 'F11' || input.key === 'Escape') {
        event.preventDefault();
      }
      if (input.control && input.shift && input.key === 'I') {
        event.preventDefault();
      }
      if (input.control && input.key === 'r') {
        event.preventDefault();
      }
      if (input.alt && input.key === 'F4') {
        event.preventDefault();
      }
    }
  });
}

function showUpdateDialog(updateInfo) {
  if (updateDialogWindow) {
    updateDialogWindow.focus();
    return;
  }

  updateDialogWindow = new BrowserWindow({
    width: 550,
    height: 450,
    resizable: false,
    frame: false,
    transparent: false,
    modal: true,
    parent: mainWindow,
    backgroundColor: '#0a2d2e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  updateDialogWindow.loadFile(path.join(__dirname, '../renderer/update-dialog.html'));

  updateDialogWindow.once('ready-to-show', () => {
    updateDialogWindow.show();
    updateDialogWindow.webContents.send('update-info', updateInfo);
  });

  updateDialogWindow.on('closed', () => {
    updateDialogWindow = null;
    // Clean up listeners
    ipcMain.removeAllListeners('install-update');
    ipcMain.removeAllListeners('close-update-dialog');
  });

  // Handle IPC events from update dialog
  ipcMain.once('install-update', () => {
    if (updateDialogWindow) {
      updateDialogWindow.close();
    }
    autoUpdater.quitAndInstall();
  });

  ipcMain.once('close-update-dialog', () => {
    if (updateDialogWindow) {
      updateDialogWindow.close();
    }
  });
}

function setupAutoUpdater() {
  if (isDev) {
    console.log('Auto-updater disabled in development mode');
    return;
  }

  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('No updates available');
  });

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
    console.log(message);
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    if (mainWindow) {
      showUpdateDialog(info);
    }
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000);
}

app.whenReady().then(async () => {
  try {
    db = new Database();
    await db.initialize();

    registerIpcHandlers(ipcMain, db, mainWindow, dialog);

    createWindow();
    setupAutoUpdater();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    dialog.showErrorBox('Initialization Error',
      `Failed to start the application: ${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (db) {
    db.close();
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
