/** ipc — la fenêtre de l'appli (le panneau, seule fenêtre) écoutée sur ses
 *  propres canaux, l'expéditeur contrôlé (I-20).
 *  Ne connaît pas : ce que font les gestionnaires. Utilisé par : app/lifecycle. */
import { ipcMain } from 'electron';
import { PANEL_CHANNELS } from 'shared/bridge';
import { listenFrom } from 'technicals/ipc';
import { state } from 'app/state';
import { panelHandlers } from './panel-handlers';

export function registerIpc() {
  const ipc = ipcMain;
  listenFrom(ipc, () => state.panel, PANEL_CHANNELS, panelHandlers);
}
