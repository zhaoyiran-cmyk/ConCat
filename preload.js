const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onClickThroughChanged: (cb) => ipcRenderer.on('click-through-changed', (_e, val) => cb(val)),
  setClickThrough: (val) => ipcRenderer.send('set-click-through', val),
  startDrag: (x, y) => ipcRenderer.send('drag-start', x, y),
  dragMove: (x, y) => ipcRenderer.send('drag-move', x, y),
  dragEnd: () => ipcRenderer.send('drag-end'),
});
