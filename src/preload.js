// Pont minimal : aucun canal « colle ce texte », « lis ce texte » ni « envoie
// ce texte à l'agent » — seul ce que whisper vient de rendre est collé ou
// envoyé, seules la sélection et la réponse d'un agent sont lues (cf. main.js).
// Le texte relu avant l'envoi à un agent passe par sa propre fenêtre
// (compose-preload.js), pas par l'icône.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getBounds: () => ipcRenderer.invoke('win:getBounds'),
  setPosition: (x, y) => ipcRenderer.send('win:setPosition', x, y),
  savePosition: (x, y) => ipcRenderer.send('win:savePosition', x, y),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setDevice: (id, label) => ipcRenderer.send('config:setDevice', id, label),
  warmUp: () => ipcRenderer.invoke('dictation:warmUp'),
  setRecording: (on) => ipcRenderer.send('dictation:recording', !!on),
  transcribe: (pcm) => ipcRenderer.invoke('dictation:transcribe', pcm),
  openMenu: (devices) => ipcRenderer.send('menu:open', devices),
  // `source` : rien (la sélection) ou { agent: id, index } (le résumé audio de
  // sa dernière réponse, ou de celle de ce rang dans la conversation ouverte).
  speak: (source) => ipcRenderer.invoke('tts:speak', source),
  cancelSpeak: (id) => ipcRenderer.send('tts:cancel', id),
  warmUpSpeak: () => ipcRenderer.send('tts:warmUp'),
  onSpeakState: (cb) => ipcRenderer.on('tts:state', (_e, state) => cb(state)),
  onSpeakChunk: (cb) => ipcRenderer.on('tts:chunk', (_e, id, pcm, rate) => cb(id, pcm, rate)),
  onSpeakEnd: (cb) => ipcRenderer.on('tts:end', (_e, id, error) => cb(id, error)),
  onSpeakAgent: (cb) => ipcRenderer.on('tts:speakAgent', (_e, id, index) => cb(id, index)),
  // Agents Claude Code.
  onAgents: (cb) => ipcRenderer.on('agents:state', (_e, state) => cb(state)),
  agentClick: (id) => ipcRenderer.send('agent:click', id),
  agentMenu: (id) => ipcRenderer.send('agent:menu', id),
  agentAdd: () => ipcRenderer.send('agent:add'),
});
