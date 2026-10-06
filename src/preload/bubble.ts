/** bubble — le pont de la bulle (window.bubble) : elle ne fait qu'afficher (et
 *  régler le volume).
 *  Ne connaît pas : le principal (seulement ses canaux). Chargé par la bulle. */
import { contextBridge, ipcRenderer } from 'electron';
import type { BubbleApi } from 'shared/bridge';

const bubble: BubbleApi = {
  onShow: (fn) => { ipcRenderer.on('bubble:show', (_e, text, kind, size) => fn(text, kind, size)); },
  ready: (height) => ipcRenderer.send('bubble:ready', height),
  hover: (inside) => ipcRenderer.send('bubble:hover', inside),
  close: () => ipcRenderer.send('bubble:close'),
  setVolume: (value) => ipcRenderer.send('bubble:volume', value),
};

contextBridge.exposeInMainWorld('bubble', bubble);
