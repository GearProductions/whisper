// Pont de la bulle. `copy` ne prend AUCUN texte : le principal copie la
// dernière transcription qu'il a lui-même reçue de whisper.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bubble', {
  onShow: (fn) => ipcRenderer.on('bubble:show', (_e, text, kind, size) => fn(text, kind, size)),
  ready: (height) => ipcRenderer.send('bubble:ready', height),
  copy: () => ipcRenderer.invoke('bubble:copy'),
  hover: (inside) => ipcRenderer.send('bubble:hover', inside),
  close: () => ipcRenderer.send('bubble:close'),
  setVolume: (value) => ipcRenderer.send('bubble:volume', value),
  // Bulle d'un agent : 'speak' (écouter sa réponse), 'expand' (toute la
  // conversation dans une fenêtre), 'allow' / 'always' / 'deny' (répondre à sa
  // demande d'autorisation). Le principal sait de quel agent il s'agit.
  action: (name) => ipcRenderer.send('bubble:action', name),
});
