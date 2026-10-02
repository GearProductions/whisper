// Pont du panneau des conversations : il reçoit la conversation affichée,
// demande l'historique, la lecture d'une réponse par son rang, et envoie à
// l'agent affiché ce qu'on écrit dans son champ (le principal vérifie à qui).
// Répondre à une demande d'autorisation ne vaut que pour celle affichée.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('conv', {
  onThread: (fn) => ipcRenderer.on('conv:thread', (_e, data) => fn(data)),
  ready: () => ipcRenderer.send('conv:ready'),
  speak: (index) => ipcRenderer.send('conv:speak', index),
  history: () => ipcRenderer.invoke('conv:history'),
  // Détail du contexte et commandes de l'agent : { context, commands } ou { error }.
  probe: () => ipcRenderer.invoke('conv:probe'),
  open: (sessionId) => ipcRenderer.send('conv:open', sessionId),
  resume: () => ipcRenderer.send('conv:resume'),
  current: () => ipcRenderer.send('conv:current'),            // ancienne conversation → celle en cours
  setMode: (mode) => ipcRenderer.send('conv:mode', mode),     // 'compact' (⤡) ou 'full' (⤢)
  height: (h) => ipcRenderer.send('conv:height', h),          // réduit : la hauteur de son contenu
  // Message à la place de la bulle (texte dicté pour ailleurs, message de
  // l'appli) ; `copyNotice` copie le texte dicté, connu du principal.
  onNotice: (fn) => ipcRenderer.on('conv:notice', (_e, notice) => fn(notice)),
  copyNotice: () => ipcRenderer.invoke('conv:copyNotice'),
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
