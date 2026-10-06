/** ipc — chaque fenêtre écoutée sur ses propres canaux, l'expéditeur contrôlé
 *  (I-20) : l'icône, la bulle, le panneau.
 *  Ne connaît pas : ce que font les gestionnaires. Utilisé par : app/lifecycle. */
import { ipcMain } from 'electron';
import { BUBBLE_CHANNELS, ICON_CHANNELS, PANEL_CHANNELS } from 'shared/bridge';
import { listenFrom } from 'technicals/ipc';
import { state } from 'app/state';
import { bubbleHandlers } from './bubble-handlers';
import { iconHandlers } from './icon-handlers';
import { panelHandlers } from './panel-handlers';

export function registerIpc() {
  const ipc = ipcMain;
  listenFrom(ipc, () => state.icon, ICON_CHANNELS, iconHandlers);
  listenFrom(ipc, () => state.bubble, BUBBLE_CHANNELS, bubbleHandlers);
  listenFrom(ipc, () => state.panel, PANEL_CHANNELS, panelHandlers);
}
