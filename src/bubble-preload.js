// Pont de la bulle : elle ne fait qu'afficher (et régler le volume).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bubble', {
  onShow: (fn) => ipcRenderer.on('bubble:show', (_e, text, kind, size) => fn(text, kind, size)),
  ready: (height) => ipcRenderer.send('bubble:ready', height),
  hover: (inside) => ipcRenderer.send('bubble:hover', inside),
  close: () => ipcRenderer.send('bubble:close'),
  setVolume: (value) => ipcRenderer.send('bubble:volume', value),
});
