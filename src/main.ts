import { app, BrowserWindow, shell, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import windowStateKeeper from 'electron-window-state';
import path from 'path';

// ─── Config ─────────────────────────────────────────────
const APP_URL = 'https://app.prepwell.de';
const IS_DEV = !app.isPackaged;

// ─── Single Instance Lock ───────────────────────────────
// Prevent multiple instances — focus existing window instead
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ─── Window ─────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Restore previous window size/position
  const windowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  });

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Security: disable node integration in renderer
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false, // Show when ready to avoid flash
  });

  // Track window state (size, position)
  windowState.manage(mainWindow);

  // Show window when content is ready (no white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the web app
  mainWindow.loadURL(APP_URL).catch(() => {
    // Offline: show error page
    mainWindow?.loadFile(path.join(__dirname, '..', 'resources', 'offline.html'));
  });

  // External links → system browser (not in Electron window)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow same-origin navigation (app.prepwell.de)
    if (url.startsWith(APP_URL)) {
      return { action: 'allow' };
    }
    // Everything else → system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Navigation guard: keep window on app domain
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // DevTools only in dev
  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── App Menu ───────────────────────────────────────────
function createMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // Edit menu (copy/paste etc.)
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo', label: 'Rückgängig' },
        { role: 'redo', label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einfügen' },
        { role: 'selectAll', label: 'Alles auswählen' },
      ],
    },
    // View menu
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { role: 'forceReload', label: 'Erzwingen Neu laden' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom zurücksetzen' },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' },
        ...(IS_DEV
          ? [
              { type: 'separator' as const },
              { role: 'toggleDevTools' as const, label: 'Entwicklertools' },
            ]
          : []),
      ],
    },
    // Window menu
    {
      label: 'Fenster',
      submenu: [
        { role: 'minimize', label: 'Minimieren' },
        { role: 'close', label: 'Schließen' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const, label: 'Alle nach vorne bringen' },
            ]
          : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Auto Updater ───────────────────────────────────────
function setupAutoUpdater(): void {
  if (IS_DEV) return; // No auto-update in dev

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    console.log('[Updater] Update available — downloading...');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] Update downloaded — will install on quit.');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
  });

  // Check for updates after launch
  autoUpdater.checkForUpdatesAndNotify();
}

// ─── App Lifecycle ──────────────────────────────────────
app.on('ready', () => {
  createMenu();
  createWindow();
  setupAutoUpdater();
});

// macOS: re-create window when dock icon is clicked
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Single instance: focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
