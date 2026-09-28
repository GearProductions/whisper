// Pont de la bulle. `copy` ne prend AUCUN texte : le principal copie la
// dernière transcription qu'il a lui-même reçue de whisper.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bubble', {
  onShow: (fn) => ipcRenderer.on('bubble:show', (_e, text, kind) => fn(text, kind)),
  ready: (height) => ipcRenderer.send('bubble:ready', height),
  copy: () => ipcRenderer.invoke('bubble:copy'),
  hover: (inside) => ipcRenderer.send('bubble:hover', inside),
});
