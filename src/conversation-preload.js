// Pont de la fenêtre de conversation : elle reçoit le fil et demande la
// lecture d'une réponse par son rang. Aucun texte ne remonte au principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('conv', {
  onThread: (fn) => ipcRenderer.on('conv:thread', (_e, data) => fn(data)),
  ready: () => ipcRenderer.send('conv:ready'),
  speak: (index) => ipcRenderer.send('conv:speak', index),
});
