// Pont de la fenêtre de relecture : la seule à pouvoir envoyer un texte à un
// agent (celui que l'utilisateur vient de relire). La sélection n'y transite
// qu'à l'affichage : à l'envoi, seul le choix de la joindre remonte.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('compose', {
  // { agent: { name, dir, color, busy }, text, selection: { text, cut } | null }
  init: () => ipcRenderer.invoke('compose:init'),
  onAppend: (fn) => ipcRenderer.on('compose:append', (_e, text) => fn(text)),
  onAgent: (fn) => ipcRenderer.on('compose:agent', (_e, agent) => fn(agent)),
  readSelection: () => ipcRenderer.invoke('compose:selection'),
  // { text, withSelection, images: [{ name, type, data }], files: [chemin] } → { ok, error }
  send: (draft) => ipcRenderer.invoke('compose:send', draft),
  cancel: () => ipcRenderer.send('compose:cancel'),
  // Chemin d'un fichier déposé ('' pour une image collée, qui n'en a pas).
  pathFor: (file) => webUtils.getPathForFile(file),
});
