/** ConCat 主进程 — 当前发行线：PlayStation DS4 皮肤；Xbox / Switch / 键盘专版后续可拆分为独立构建或运行时切换。 */
const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const STORE_PATH = path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = { bounds: { width: 520, height: 450 }, opacity: 0.92, clickThrough: false, alwaysOnTop: true, scale: 1.0, operationCount: 0 };

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

  const isOnTop = store.get('alwaysOnTop');
  win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 260,
    minHeight: 190,
    transparent: true,
    frame: false,
    alwaysOnTop: isOnTop,
    hasShadow: false,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  if (isOnTop) win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.setOpacity(store.get('opacity'));
  win.loadFile('overlay.html');

  if (isClickThrough) {
    win.setIgnoreMouseEvents(true, { forward: true });
  }

  win.webContents.once('did-finish-load', () => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send('click-through-changed', isClickThrough);
  });

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
    win.setIgnoreMouseEvents(isClickThrough, isClickThrough ? { forward: true } : undefined);
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
  if (!globalShortcut.register('F2', () => {
    if (win && !win.isDestroyed()) win.webContents.send('toggle-layout-editor');
  })) console.warn('ConCat: F2 global shortcut not registered (may be in use by another app)');

  try {
    const { spawn } = require('child_process');
    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
public class KBHook {
    private delegate IntPtr LLKProc(int c, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, LLKProc cb, IntPtr hMod, uint tid);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hk, int c, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string n);
    [DllImport("user32.dll")] static extern bool GetMessage(out MSG m, IntPtr h, uint mn, uint mx);
    [StructLayout(LayoutKind.Sequential)] public struct KBDLL { public int vkCode; public int scanCode; public int flags; public int time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] public struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public int x; public int y; }
    static IntPtr hook = IntPtr.Zero;
    static LLKProc proc = HookCB;
    static IntPtr HookCB(int c, IntPtr w, IntPtr l) {
        if (c >= 0) {
            KBDLL k = Marshal.PtrToStructure<KBDLL>(l);
            int wv = w.ToInt32();
            string state = (wv == 0x100 || wv == 0x104) ? "DOWN" : "UP";
            Console.WriteLine(state + "\\t" + k.vkCode);
            Console.Out.Flush();
        }
        return CallNextHookEx(hook, c, w, l);
    }
    public static void Run() {
        using (var p = Process.GetCurrentProcess())
        using (var m = p.MainModule) {
            hook = SetWindowsHookEx(13, proc, GetModuleHandle(m.ModuleName), 0);
        }
        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0)) {}
    }
}
"@ -ReferencedAssemblies System.dll
[KBHook]::Run()
`;
    const keyProc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let lineBuf = '';
    keyProc.stdout.on('data', (data) => {
      lineBuf += data.toString();
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split('\t');
        if (parts.length < 2) continue;
        const state = parts[0];
        const vKey = parseInt(parts[1], 10);
        if (!win || isNaN(vKey)) continue;
        if (state === 'DOWN') win.webContents.send('global-keydown', vKey);
        else if (state === 'UP') win.webContents.send('global-keyup', vKey);
      }
    });
    keyProc.stderr.on('data', (d) => console.error('KeyHook stderr:', d.toString()));
    keyProc.on('error', (err) => console.error('KeyHook error:', err));
    app.on('will-quit', () => { try { keyProc.kill(); } catch {} });
  } catch (err) {
    console.error('global-key-listener init failed:', err);
  }
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
  if (win) win.setIgnoreMouseEvents(val, val ? { forward: true } : undefined);
  updateTrayMenu();
});

ipcMain.handle('get-click-through', () => !!isClickThrough);

/** 渲染进程在锁定模式下根据鼠标是否在可点击 UI 上动态切换穿透，不改变 settings 中的 clickThrough */
ipcMain.on('mouse-ignore-hit', (_e, ignore, forward) => {
  if (!win || win.isDestroyed()) return;
  if (!isClickThrough) return;
  win.setIgnoreMouseEvents(!!ignore, ignore && forward ? { forward: true } : undefined);
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

ipcMain.on('set-always-on-top', (_e, val) => {
  store.set('alwaysOnTop', val);
  if (win) {
    win.setAlwaysOnTop(val, val ? 'screen-saver' : undefined);
  }
});
ipcMain.handle('get-always-on-top', () => store.get('alwaysOnTop'));

let baseSize = null;
ipcMain.on('set-scale', (_e, scale) => {
  store.set('scale', scale);
  if (!win) return;
  if (!baseSize) baseSize = { w: 520, h: 450 };
  const newW = Math.round(baseSize.w * scale);
  const newH = Math.round(baseSize.h * scale);
  const bounds = win.getBounds();
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  win.setBounds({
    x: Math.round(cx - newW / 2),
    y: Math.round(cy - newH / 2),
    width: newW,
    height: newH,
  });
});
ipcMain.handle('get-scale', () => store.get('scale') || 1.0);

ipcMain.handle('get-operation-count', () => Number(store.get('operationCount')) || 0);
ipcMain.handle('add-operation-count', (_e, delta) => {
  const d = Math.max(0, Math.floor(Number(delta) || 0));
  if (d === 0) return Number(store.get('operationCount')) || 0;
  const next = (Number(store.get('operationCount')) || 0) + d;
  store.set('operationCount', next);
  return next;
});
