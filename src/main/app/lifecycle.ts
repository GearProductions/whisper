/** lifecycle — démarrage et sortie de l'appli. Une seule instance ; au
 *  lancement, aucun agent sélectionné (I-8) ; le micro, seule permission
 *  accordée, et à nos pages seulement (I-9). Quittée en pleine dictée ou
 *  pendant un tour d'agent : on rend d'abord le son et le micro Discord, on
 *  interrompt les agents et on attend la fin de leurs tours (I-11, I-19) ;
 *  les processus lancés par l'onglet Processus de VibeCoder sont arrêtés.
 *  Au lancement, les familles d'agents sont relues par git (syncFamilies).
 *  Le schéma vibe-artifact (les artefacts de VibeCoder, F-95) : déclaré
 *  avant ready, servi à ready (resolveArtifact). Lancée depuis les sources :
 *  ce qui est reconstruit dans out/ est suivi (app/dev), le relevé de
 *  VibeCoder le montre.
 *  Ne connaît pas : le détail des fenêtres et des contrôleurs.
 *  Utilisé par : src/main/index.ts. */
import { app, session } from 'electron';
import { startupPatch } from 'core/config';
import { ARTIFACT_SCHEME } from 'core/vibecoder';
import { allowPermission, allowPermissionCheck } from 'core/guards';
import { registerScheme, serveFiles } from 'technicals/file-scheme';
import { binDir } from 'technicals/paths';
import * as paste from 'technicals/paste';
import * as tts from 'technicals/pocket-tts';
import * as windows from 'technicals/windows-helper';
import {
  agents, ensureFolderColors, ensureModel, muter, pollSpeak, processesRunning, pushAgents, refreshVibe, resetSpeakState, resolveArtifact, SPEAK_POLL_MS,
  startHealing, stopProcesses, syncFamilies,
} from 'app/controllers';
import { startDev } from 'app/dev';
import { registerIpc } from 'app/ipc';
import { ensureVibeFiles, loadConfig, saveConfig } from 'app/settings';
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
  registerScheme(ARTIFACT_SCHEME);

  app.whenReady().then(() => {
    setupPermissions(session.defaultSession);
    serveFiles(ARTIFACT_SCHEME, resolveArtifact);
    createIconWindow(() => { resetSpeakState(); pushAgents(); });
    createBubble();
    ensureFolderColors();
    // Au lancement, la dictée va au curseur : un agent sélectionné la veille ne
    // doit pas recevoir (et envoyer à Claude) ce qu'on croit dicter pour soi.
    const patch = startupPatch(loadConfig());
    if (patch) saveConfig(patch);
    // Les familles d'agents (un dépôt, ses worktrees), relues par git.
    syncFamilies();
    // VibeCoder : ses fichiers par défaut, sans écraser une retouche ; un échec ne bloque rien (I-29).
    ensureVibeFiles();
    setInterval(pollSpeak, SPEAK_POLL_MS);
    // Depuis les sources : recharger ou redémarrer, d'après ce qui est reconstruit (rien en version empaquetée).
    startDev(() => { void refreshVibe({ now: true }); });
    // Une application restée muette après une dictée passée : rétablie dès qu'elle rejoue.
    startHealing();
    // Windows : l'assistant PowerShell sert au premier collage comme à la
    // coupure du micro Discord en début de dictée ; il met ~1 s à démarrer.
    paste.warmUp();
    tts.setDirs({ data: app.getPath('userData'), bin: binDir() });
    // Après le chargement de la bulle, qui affiche la progression.
    state.bubble!.webContents.once('did-finish-load', ensureModel);
  });
  app.on('window-all-closed', () => app.quit());

  // Quittée en pleine dictée : on rend d'abord le son et le micro Discord. Un
  // processus d'agent vivant : on ferme son entrée (au travail, on lui demande
  // d'abord d'arrêter son tour) et on attend qu'il soit sorti (quelques
  // secondes au plus) — tué net, il pourrait survivre dans son conteneur et
  // continuer seul. Ce que l'onglet Processus a lancé : arrêté (SIGKILL après
  // 5 s), rien ne survit à l'appli.
  let quitting = false;
  app.on('before-quit', (e) => {
    if (quitting || (!state.recording && !agents.active() && !processesRunning())) return;
    e.preventDefault();
    quitting = true;
    Promise.all([muter.restore('others'), muter.restore('discord'), agents.stop(), stopProcesses()]).finally(() => app.quit());
  });
  app.on('will-quit', () => { windows.stop(); tts.stop(); agents.stop(); stopProcesses(); });
}
