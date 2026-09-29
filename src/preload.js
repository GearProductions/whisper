// Pont minimal : aucun canal « colle ce texte » ni « lis ce texte » — seul ce
// que whisper vient de rendre est collé, seule la sélection est lue (cf. main.js).
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
  speak: () => ipcRenderer.invoke('tts:speak'),
  cancelSpeak: () => ipcRenderer.send('tts:cancel'),
  onSpeakState: (cb) => ipcRenderer.on('tts:state', (_e, state) => cb(state)),
});
