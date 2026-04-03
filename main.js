const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const STORE_PATH = path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = { bounds: { width: 420, height: 300 }, opacity: 0.92, clickThrough: false };

function loadStore() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
function saveStore(data) {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2)); } catch {}
}

const store = { _d: loadStore(), get(k) { return this._d[k]; }, set(k, v) { this._d[k] = v; saveStore(this._d); } };

let win = null;
let tray = null;
let isClickThrough = store.get('clickThrough');

function createWindow() {
  const saved = store.get('bounds');

  win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 260,
    minHeight: 190,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.setOpacity(store.get('opacity'));
  win.loadFile('overlay.html');

  if (isClickThrough) {
    win.setIgnoreMouseEvents(true, { forward: true });
  }

  win.on('moved', saveBounds);
  win.on('resized', saveBounds);

  win.on('closed', () => { win = null; });
}

function saveBounds() {
  if (win) store.set('bounds', win.getBounds());
}

function toggleClickThrough() {
  isClickThrough = !isClickThrough;
  store.set('clickThrough', isClickThrough);
  if (win) {
    win.setIgnoreMouseEvents(isClickThrough, { forward: true });
    win.webContents.send('click-through-changed', isClickThrough);
  }
  updateTrayMenu();
}

function toggleVisibility() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else win.show();
  updateTrayMenu();
}

function setOpacity(val) {
  store.set('opacity', val);
  if (win) win.setOpacity(val);
}

function createTrayIcon() {
  const iconPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(iconPath)) return nativeImage.createFromPath(iconPath);
  // Fallback: 16x16 pink square
  const img = nativeImage.createEmpty();
  return img.isEmpty() ? nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQ0lEQVQ4y2P4z8BQz0BAwMDAwMDAwPCfgYGBgQEKGBgYGBj+MzD8Z2D4D8OEFTAwMDDAaEYGBgYGmGkMxJuGrBcAMH0PEQqn0pQAAAAASUVORK5CYII='
  ) : img;
}

function updateTrayMenu() {
  if (!tray) return;
  const visible = win && win.isVisible();
  const menu = Menu.buildFromTemplate([
    { label: visible ? 'Hide Overlay' : 'Show Overlay', click: toggleVisibility },
    { label: isClickThrough ? 'Unlock (Interactive)' : 'Lock (Click-through)', click: toggleClickThrough },
    { type: 'separator' },
    { label: 'Opacity', submenu: [
      { label: '100%', click: () => setOpacity(1.0) },
      { label: '90%', click: () => setOpacity(0.90) },
      { label: '80%', click: () => setOpacity(0.80) },
      { label: '70%', click: () => setOpacity(0.70) },
      { label: '60%', click: () => setOpacity(0.60) },
      { label: '50%', click: () => setOpacity(0.50) },
    ]},
    { type: 'separator' },
    { label: 'Reset Position', click: () => {
      if (win) win.setBounds({ x: 100, y: 100, width: 420, height: 300 });
    }},
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  try {
    tray = new Tray(createTrayIcon());
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }
  tray.setToolTip('ConCat');
  updateTrayMenu();
  tray.on('click', toggleVisibility);
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  globalShortcut.register('Ctrl+Shift+G', toggleClickThrough);
  globalShortcut.register('Ctrl+Shift+H', toggleVisibility);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('set-click-through', (_e, val) => {
  isClickThrough = val;
  store.set('clickThrough', val);
  if (win) win.setIgnoreMouseEvents(val, { forward: true });
  updateTrayMenu();
});

let dragStart = null;
ipcMain.on('drag-start', (_e, sx, sy) => {
  if (!win) return;
  const bounds = win.getBounds();
  dragStart = { wx: bounds.x, wy: bounds.y, mx: sx, my: sy };
});
ipcMain.on('drag-move', (_e, mx, my) => {
  if (!win || !dragStart) return;
  const dx = mx - dragStart.mx, dy = my - dragStart.my;
  win.setPosition(dragStart.wx + dx, dragStart.wy + dy);
});
ipcMain.on('drag-end', () => {
  dragStart = null;
  saveBounds();
});
