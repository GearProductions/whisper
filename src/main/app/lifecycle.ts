/** lifecycle — démarrage et sortie de l'appli. Une seule instance ; au
 *  lancement, aucun agent sélectionné (I-8) ; le micro, seule permission
 *  accordée, et à nos pages seulement (I-9). Quittée en pleine dictée ou
 *  pendant un tour d'agent : on rend d'abord le son et le micro Discord, on
 *  interrompt les agents et on attend la fin de leurs tours (I-11, I-19).
 *  Ne connaît pas : le détail des fenêtres et des contrôleurs.
 *  Utilisé par : src/main/index.ts. */
import { app, session } from 'electron';
import { agentList, startupPatch } from 'core/config';
import { allowPermission, allowPermissionCheck } from 'core/guards';
import { binDir } from 'technicals/paths';
import * as paste from 'technicals/paste';
import * as tts from 'technicals/pocket-tts';
import * as windows from 'technicals/windows-helper';
import {
  agents, ensureFolderColors, ensureModel, isBusy, muter, pollSpeak, pushAgents, resetSpeakState, SPEAK_POLL_MS,
} from 'app/controllers';
import { registerIpc } from 'app/ipc';
import { loadConfig, saveConfig } from 'app/settings';
import { state } from 'app/state';
import { createBubble, createIconWindow } from 'app/windows';

// Seule permission accordée : le micro, pour nos propres pages.
function setupPermissions(ses: Electron.Session) {
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const d = details as { requestingUrl?: string; mediaTypes?: string[] };
    callback(allowPermission(permission, d.requestingUrl, d.mediaTypes || []));
  });
  ses.setPermissionCheckHandler((_wc, permission, origin, details) => (
    allowPermissionCheck(permission, origin, details && (details as { mediaType?: string }).mediaType)));
}

export function start() {
  // Fenêtre transparente sous Linux (X11) : sans ce drapeau, fond noir.
  if (process.platform === 'linux') app.commandLine.appendSwitch('enable-transparent-visuals');
  if (!app.requestSingleInstanceLock()) app.quit();
  registerIpc();

  app.whenReady().then(() => {
    setupPermissions(session.defaultSession);
    createIconWindow(() => { resetSpeakState(); pushAgents(); });
    createBubble();
    ensureFolderColors();
    // Au lancement, la dictée va au curseur : un agent sélectionné la veille ne
    // doit pas recevoir (et envoyer à Claude) ce qu'on croit dicter pour soi.
    const patch = startupPatch(loadConfig());
    if (patch) saveConfig(patch);
    setInterval(pollSpeak, SPEAK_POLL_MS);
    // Windows : l'assistant PowerShell sert au premier collage comme à la
    // coupure du micro Discord en début de dictée ; il met ~1 s à démarrer.
    paste.warmUp();
    tts.setDirs({ data: app.getPath('userData'), bin: binDir() });
    // Après le chargement de la bulle, qui affiche la progression.
    state.bubble!.webContents.once('did-finish-load', ensureModel);
  });
  app.on('window-all-closed', () => app.quit());

  // Quittée en pleine dictée : on rend d'abord le son et le micro Discord. Un
  // agent au travail : on lui demande d'arrêter son tour et on attend qu'il l'ait
  // fait (quelques secondes au plus) — tué net, il pourrait survivre dans son
  // conteneur et continuer seul.
  let quitting = false;
  app.on('before-quit', (e) => {
    const agentsBusy = agentList(loadConfig()).some((a) => isBusy(a.id));
    if (quitting || (!state.recording && !agentsBusy)) return;
    e.preventDefault();
    quitting = true;
    Promise.all([muter.restore('others'), muter.restore('discord'), agents.stop()]).finally(() => app.quit());
  });
  app.on('will-quit', () => { windows.stop(); tts.stop(); agents.stop(); });
}
