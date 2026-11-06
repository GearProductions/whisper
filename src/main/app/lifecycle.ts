/** lifecycle — démarrage et sortie de l'appli. Une seule instance ; au
 *  lancement, l'agent affiché la dernière fois l'est de nouveau (sinon le premier ;
 *  aucun : l'accueil) ; le micro, seule permission
 *  accordée, et à nos pages seulement (I-9). Quittée en pleine dictée ou
 *  pendant un tour d'agent : on rend d'abord le son et le micro Discord, on
 *  interrompt les agents et on attend la fin de leurs tours (I-11, I-19) ;
 *  les processus lancés par l'onglet Processus de VibeCoder sont arrêtés.
 *  Au lancement, les familles d'agents sont relues par git (syncFamilies) ;
 *  après ensureVibeFiles, les anciens artefacts sont déplacés (moveLegacyArtifacts)
 *  sans bloquer le démarrage, puis VibeCoder est relu (refreshVibe).
 *  Le schéma vibe-artifact (les artefacts de VibeCoder, F-95) : déclaré
 *  avant ready, servi à ready (resolveArtifact). Lancée depuis les sources :
 *  ce qui est reconstruit dans out/ est suivi (app/dev), le relevé de
 *  VibeCoder le montre.
 *  La fenêtre classique est créée au lancement (createWindow) ; ensureModel
 *  part après son chargement (le message en tête de la fenêtre).
 *  Le socket (la porte de l'écran, controllers/socket) s'ouvre à ready, avant
 *  la fenêtre et sans l'attendre, sur commandFromSocket ; fermé, live.json
 *  supprimé, à will-quit (I-43).
 *  Ne connaît pas : le détail des fenêtres et des contrôleurs.
 *  Utilisé par : src/main/index.ts. */
import { app, session } from 'electron';
import { ARTIFACT_SCHEME } from 'core/vibecoder';
import { agentList } from 'core/config';
import { allowPermission, allowPermissionCheck } from 'core/guards';
import { registerScheme, serveFiles } from 'technicals/file-scheme';
import { binDir } from 'technicals/paths';
import * as tts from 'technicals/pocket-tts';
import * as windows from 'technicals/windows-helper';
import {
  agents, closeSocket, commandFromSocket, ensureFolderColors, ensureModel, moveLegacyArtifacts, muter, openSocket, processesRunning,
  refreshVibe, resolveArtifact, startHealing, stopProcesses, syncFamilies,
} from 'app/controllers';
import { startDev } from 'app/dev';
import { registerIpc } from 'app/ipc';
import { ensureVibeFiles, loadConfig } from 'app/settings';
import { state } from 'app/state';
import { createWindow, openConversation } from 'app/windows';

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
  if (!app.requestSingleInstanceLock()) app.quit();
  registerIpc();
  registerScheme(ARTIFACT_SCHEME);

  app.whenReady().then(() => {
    setupPermissions(session.defaultSession);
    serveFiles(ARTIFACT_SCHEME, resolveArtifact);
    // Le socket : mes boutons passent par lui ; un échec est journalisé, l'appli reste ouverte (openSocket ne rejette pas).
    void openSocket(commandFromSocket);
    createWindow();
    ensureFolderColors();
    // L'agent affiché la dernière fois, sinon le premier ; aucun agent : l'accueil.
    const cfg = loadConfig();
    const list = agentList(cfg);
    const first = list.find((a) => a.id === cfg.agentSelected) ?? list[0];
    if (first) openConversation(first.id);
    // Les familles d'agents (un dépôt, ses worktrees), relues par git.
    syncFamilies();
    // VibeCoder : ses fichiers par défaut, sans écraser une retouche ; un échec ne bloque rien (I-29).
    ensureVibeFiles();
    // Les anciens artefacts rejoignent le dossier de leur projet (ne rejette jamais), puis la vue est relue ; le démarrage n'attend pas.
    void moveLegacyArtifacts().then(() => refreshVibe());
    // Depuis les sources : recharger ou redémarrer, d'après ce qui est reconstruit (rien en version empaquetée).
    startDev(() => { void refreshVibe({ now: true }); });
    // Une application restée muette après une dictée passée : rétablie dès qu'elle rejoue.
    startHealing();
    tts.setDirs({ data: app.getPath('userData'), bin: binDir() });
    // Après le chargement de la fenêtre, qui affiche la progression en tête.
    state.panel!.webContents.once('did-finish-load', ensureModel);
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
  app.on('will-quit', () => { closeSocket(); windows.stop(); tts.stop(); agents.stop(); stopProcesses(); });
}
