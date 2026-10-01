// Pont de la fenêtre de conversation : elle reçoit les onglets et le fil,
// choisit un onglet, demande l'historique, la lecture d'une réponse par son
// rang. Aucun texte ne remonte au principal (un identifiant de session tout au
// plus, vérifié là-bas).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('conv', {
  onThread: (fn) => ipcRenderer.on('conv:thread', (_e, data) => fn(data)),
  ready: () => ipcRenderer.send('conv:ready'),
  select: (key) => ipcRenderer.send('conv:select', key),
  closeTab: (key) => ipcRenderer.send('conv:closeTab', key),
  speak: (index) => ipcRenderer.send('conv:speak', index),
  history: () => ipcRenderer.invoke('conv:history'),
  open: (sessionId) => ipcRenderer.send('conv:open', sessionId),
  resume: () => ipcRenderer.send('conv:resume'),
  openLink: (url) => ipcRenderer.send('conv:openLink', url),    // dans le navigateur
  showFile: (file) => ipcRenderer.send('conv:showFile', file),  // dans le gestionnaire de fichiers
});
