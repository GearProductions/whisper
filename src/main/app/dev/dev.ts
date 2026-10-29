/** dev — l'appli lancée depuis les sources (whisper-dev ; jamais empaquetée) : ce qui a été reconstruit dans
 *  out/ depuis qu'elle tourne. Empreinte du principal et de ses ponts (out/main/*.js) au lancement, des pages
 *  (out/renderer/**.html, qui nomment leurs fichiers par leur contenu) à leur dernier chargement ; relue
 *  toutes les 2 s, un changement d'état signalé (onChange). Recharger les fenêtres (les pages seulement : le
 *  principal et les agents continuent) ; relancer l'appli (app.relaunch, puis quitter : before-quit arrête
 *  les agents proprement) ; l'un et l'autre d'après out/ relu à l'instant. Rien hors du développement.
 *  Ne connaît pas : VibeCoder, les agents, les pages. Utilisé par : app/lifecycle (startDev),
 *  app/controllers/vibecoder (devState, reloadPages, restartApp). */
import { app, BrowserWindow } from 'electron';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildState, type Builds, type BuildState } from 'helpers';

const POLL_MS = 2000;
let out: string | null = null;           // out/ de l'appli lancée depuis les sources ; null : pas en dev
let loaded: Builds = { main: null, pages: null };
let state: BuildState = null;

// L'empreinte des fichiers de `dir` (récursif) que `keep` retient ; null : aucun (pas construit, ou en cours).
function digest(dir: string, keep: (file: string) => boolean): string | null {
  let files: string[];
  try { files = (fs.readdirSync(dir, { recursive: true }) as string[]).filter(keep).sort(); } catch { return null; }
  const hash = createHash('sha1');
  let read = 0;
  for (const f of files) {
    try { hash.update(f).update(fs.readFileSync(path.join(dir, f))); read++; } catch { /* effacé pendant une construction */ }
  }
  return read ? hash.digest('hex') : null;
}

const built = (root: string): Builds => ({
  main: digest(path.join(root, 'main'), (f) => f.endsWith('.js')),
  pages: digest(path.join(root, 'renderer'), (f) => f.endsWith('.html')),
});

// Lancée depuis les sources : l'empreinte de ce qui est chargé, puis relue toutes les 2 s.
export function startDev(onChange: () => void) {
  if (app.isPackaged) return;
  const root = path.join(app.getAppPath(), 'out');
  out = root;
  loaded = built(root);
  setInterval(() => {
    const next = buildState(loaded, built(root));
    if (next !== state) { state = next; onChange(); }
  }, POLL_MS).unref();
}

// 'restart' : le principal a été reconstruit ; 'reload' : les pages seulement ; null : rien, ou pas en dev.
export const devState = (): BuildState => state;

// Chaque fenêtre rechargée avec les pages reconstruites ; elles deviennent celles qui sont chargées.
export function reloadPages() {
  if (!out) return;
  const now = built(out);   // relu à l'instant : le principal reconstruit (ou en cours) depuis le dernier relevé → rien
  if (now.main === null || buildState(loaded, now) !== 'reload') return;
  for (const w of BrowserWindow.getAllWindows()) w.webContents.reloadIgnoringCache();
  loaded = { ...loaded, pages: now.pages };
  state = buildState(loaded, now);
}

// L'appli relancée, avec le principal reconstruit.
export function restartApp() {
  if (!out || built(out).main === null) return;   // out/main en cours de construction : la relance ne trouverait rien
  app.relaunch();
  app.quit();
}
