/** icon — le pont de l'icône (window.api). Aucun canal « colle ce texte »,
 *  « lis ce texte » ni « envoie ce texte à l'agent » : seul ce que whisper vient
 *  de rendre est collé ou envoyé, seules la sélection et la réponse d'un agent
 *  sont lues (cf. le principal). Le texte relu avant l'envoi à un agent passe
 *  par le panneau des conversations, pas par l'icône.
 *  Ne connaît pas : le principal (seulement ses canaux). Chargé par la fenêtre de l'icône. */
import { contextBridge, ipcRenderer } from 'electron';
import type { IconApi } from 'shared/bridge';

const api: IconApi = {
  getBounds: () => ipcRenderer.invoke('win:getBounds'),
  setPosition: (x, y) => ipcRenderer.send('win:setPosition', x, y),
  savePosition: (x, y) => ipcRenderer.send('win:savePosition', x, y),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setDevice: (id, label) => ipcRenderer.send('config:setDevice', id, label),
  warmUp: () => ipcRenderer.invoke('dictation:warmUp'),
  setRecording: (on) => ipcRenderer.send('dictation:recording', !!on),
  transcribe: (pcm) => ipcRenderer.invoke('dictation:transcribe', pcm),
  openMenu: (devices) => ipcRenderer.send('menu:open', devices),
  // `source` : rien (la sélection) ou 'reply' (le résumé audio de la réponse
  // choisie par ▶ dans le panneau des conversations).
  speak: (source) => ipcRenderer.invoke('tts:speak', source),
  cancelSpeak: (id) => ipcRenderer.send('tts:cancel', id),
  warmUpSpeak: () => ipcRenderer.send('tts:warmUp'),
  onSpeakState: (cb) => { ipcRenderer.on('tts:state', (_e, state) => cb(state)); },
  onSpeakChunk: (cb) => { ipcRenderer.on('tts:chunk', (_e, id, pcm, rate) => cb(id, pcm, rate)); },
  onSpeakEnd: (cb) => { ipcRenderer.on('tts:end', (_e, id, error) => cb(id, error)); },
  onSpeakReply: (cb) => { ipcRenderer.on('tts:speakReply', () => cb()); },
  // Agents Claude Code.
  onAgents: (cb) => { ipcRenderer.on('agents:state', (_e, state) => cb(state)); },
  agentClick: (id) => ipcRenderer.send('agent:click', id),
  agentMenu: (id) => ipcRenderer.send('agent:menu', id),
  agentAdd: () => ipcRenderer.send('agent:add'),
};

contextBridge.exposeInMainWorld('api', api);
