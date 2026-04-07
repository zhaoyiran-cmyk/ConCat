const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onClickThroughChanged: (cb) => ipcRenderer.on('click-through-changed', (_e, val) => cb(val)),
  setClickThrough: (val) => ipcRenderer.send('set-click-through', val),
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
