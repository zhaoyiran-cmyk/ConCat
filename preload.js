const { contextBridge, ipcRenderer } = require('electron');

/** 与主进程 !app.isPackaged 一致：仅未打包（electron . / 开发）为 true */
const layoutEditorEnabled = process.defaultApp === true;

contextBridge.exposeInMainWorld('overlay', {
  layoutEditorEnabled,
  onClickThroughChanged: (cb) => ipcRenderer.on('click-through-changed', (_e, val) => cb(val)),
  setClickThrough: (val) => ipcRenderer.send('set-click-through', val),
  getClickThrough: () => ipcRenderer.invoke('get-click-through'),
  /** 仅在已锁定时由渲染进程调用：临时开关鼠标穿透，便于点到标题栏/菜单/解锁键 */
  setMouseIgnoreHit: (ignore, forward) => ipcRenderer.send('mouse-ignore-hit', !!ignore, !!forward),
  startDrag: (x, y) => ipcRenderer.send('drag-start', x, y),
  dragMove: (x, y) => ipcRenderer.send('drag-move', x, y),
  dragEnd: () => ipcRenderer.send('drag-end'),
  setAlwaysOnTop: (val) => ipcRenderer.send('set-always-on-top', val),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  setScale: (scale) => ipcRenderer.send('set-scale', scale),
  getScale: () => ipcRenderer.invoke('get-scale'),
  onGlobalKeyDown: (cb) => ipcRenderer.on('global-keydown', (_e, keycode) => cb(keycode)),
  onGlobalKeyUp: (cb) => ipcRenderer.on('global-keyup', (_e, keycode) => cb(keycode)),
  onToggleLayoutEditor: (cb) => ipcRenderer.on('toggle-layout-editor', () => cb()),
  getOperationCount: () => ipcRenderer.invoke('get-operation-count'),
  addOperationCount: (delta) => ipcRenderer.invoke('add-operation-count', delta),
});
