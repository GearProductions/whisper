// Pont de la fenêtre de conversation : elle reçoit les onglets et le fil,
// choisit un onglet, demande l'historique, la lecture d'une réponse par son
// rang. Aucun texte ne remonte au principal (un identifiant de session tout au
// plus, vérifié là-bas).
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('conv', {
  onThread: (fn) => ipcRenderer.on('conv:thread', (_e, data) => fn(data)),
  ready: () => ipcRenderer.send('conv:ready'),
  select: (key) => ipcRenderer.send('conv:select', key),
  closeTab: (key) => ipcRenderer.send('conv:closeTab', key),
  speak: (index) => ipcRenderer.send('conv:speak', index),
  history: () => ipcRenderer.invoke('conv:history'),
  open: (sessionId) => ipcRenderer.send('conv:open', sessionId),
  resume: () => ipcRenderer.send('conv:resume'),
  // Champ de saisie : un message à l'agent de l'onglet affiché, avec ses pièces
  // jointes → { ok, error }. 📎 : menu (fichiers, sélection), le choix revient
  // par onAttached. La dictée, panneau ouvert, arrive par onDictation.
  send: (draft) => ipcRenderer.invoke('conv:send', draft),
  attach: () => ipcRenderer.send('conv:attach'),
  onAttached: (fn) => ipcRenderer.on('conv:attached', (_e, what) => fn(what)),
  onDictation: (fn) => ipcRenderer.on('conv:dictation', (_e, text) => fn(text)),
  onFocusInput: (fn) => ipcRenderer.on('conv:focusInput', () => fn()),
  hide: () => ipcRenderer.send('conv:hide'),                  // la croix du panneau
  pathFor: (file) => webUtils.getPathForFile(file),          // chemin d'un fichier déposé ('' : collé)
  // Demande d'autorisation affichée dans le fil : 'allow', 'always' ou 'deny',
  // pour la demande `key` (celle que l'utilisateur a sous les yeux).
  answer: (decision, key) => ipcRenderer.send('conv:answer', decision, key),
  openLink: (url) => ipcRenderer.send('conv:openLink', url),    // dans le navigateur
  showFile: (file) => ipcRenderer.send('conv:showFile', file),  // dans le gestionnaire de fichiers
});
