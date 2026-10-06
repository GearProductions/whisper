/** selection — lire le texte sélectionné (ou le presse-papiers).
 *
 *  Sous Wayland, Electron tourne en X11 (XWayland), et le compositeur ne
 *  transmet sélection et presse-papiers à une fenêtre X11 que lorsqu'elle a le
 *  focus — or l'icône ne le prend jamais. On passe donc par `wl-paste`
 *  (wl-clipboard), qui les lit sans focus. Dans une distrobox, celui de l'hôte
 *  (/run/host) fait l'affaire.
 *
 *  Sous KDE, Klipper remplit aussitôt une sélection vidée avec sa dernière
 *  entrée, marquée du type KLIPPER_REFILL : on la tient pour vide, sinon le
 *  bouton ne serait jamais grisé. Pas pour le presse-papiers : ce qu'on a
 *  copié doit rester lisible une fois l'application source fermée.
 *
 *  Windows n'a pas de sélection « primaire » : au clic, on envoie Ctrl+C à
 *  l'application au premier plan (qui garde le focus, l'icône ne le prenant
 *  jamais), on lit le presse-papiers, puis on le rend tel qu'il était. On ne
 *  peut donc pas savoir d'avance s'il y a une sélection : hasText dit oui.
 *
 *  Ailleurs (X11, pas de wl-paste) : le presse-papiers d'Electron, dont la
 *  sélection primaire sous X11.
 *  Ne connaît pas : la lecture à voix haute, les agents.
 *  Utilisé par : app (bouton de lecture, pièces jointes). */
import { execFile } from 'node:child_process';
import * as clipboard from 'technicals/clipboard';
import { which } from 'technicals/paths';
import * as windows from 'technicals/windows-helper';

export type ReadMode = 'selection' | 'clipboard';

const MAX_BYTES = 1024 * 1024;
const KLIPPER_REFILL = 'application/x-kde-onlyReplaceEmpty';
const TEXT_TYPE = /^(text\/plain|UTF8_STRING|STRING|TEXT)\b/;
const HAS_TEXT_MAX = 4096;
const isWin = process.platform === 'win32';
const COPY_WAIT_MS = 600; // le temps que l'application réponde au Ctrl+C
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let wlPaste: string | null | undefined; // chemin, null si absent ; cherché une fois

function findWlPaste() {
  if (wlPaste !== undefined) return wlPaste;
  // /run/host : dans une distrobox, le wl-paste de l'hôte.
  wlPaste = process.platform === 'linux' && process.env.WAYLAND_DISPLAY ? which('wl-paste', ['/run/host/usr/bin']) : null;
  return wlPaste;
}

/* ---- Windows : Ctrl+C simulé -------------------------------------------- */

// Vidé avant : s'il reste vide, rien n'était sélectionné (ou l'application
// n'a pas répondu à temps).
async function copySelection() {
  const snap = clipboard.snapshot();
  clipboard.clear();
  let text = '';
  if (await windows.request('copy') === 'ok') {
    for (let waited = 0; !text && waited < COPY_WAIT_MS; waited += 25) {
      await delay(25);
      text = clipboard.readText();
    }
  }
  clipboard.restore(snap);
  return text;
}

/* ---- wl-paste (Wayland) -------------------------------------------------- */

const textArgs = (mode: ReadMode) => ['--no-newline', '--type', 'text', ...(mode === 'selection' ? ['--primary'] : [])];

// stdout ; '' si wl-paste échoue ; `null` si le texte dépasse `max` octets.
function wlPasteRun(cli: string, args: string[], max = MAX_BYTES) {
  return new Promise<string | null>((resolve) => {
    execFile(cli, args, { timeout: 1500, maxBuffer: max }, (err, stdout) => {
      if (err && (err as NodeJS.ErrnoException).code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') resolve(null);
      else resolve(err ? '' : stdout);
    });
  });
}

// Types proposés, sans les contenus : KLIPPER_REFILL et pas de texte → rien.
async function textOffered(cli: string, mode: ReadMode) {
  const primary = mode === 'selection';
  const types = String(await wlPasteRun(cli, ['--list-types', ...(primary ? ['--primary'] : [])])).split('\n');
  if (primary && types.includes(KLIPPER_REFILL)) return false;
  return types.some((t) => TEXT_TYPE.test(t));
}

// Résout '' si rien (vide, image seule, sélection trop grosse…).
export async function readText(mode: ReadMode): Promise<string> {
  if (isWin && mode === 'selection') return copySelection();
  const cli = findWlPaste();
  if (!cli) return clipboard.readText(mode);
  if (!(await textOffered(cli, mode))) return '';
  return (await wlPasteRun(cli, textArgs(mode))) || '';
}

// Y a-t-il du texte à lire ? Relevé toutes les 500 ms pour le bouton : on
// n'en lit que HAS_TEXT_MAX octets (une sélection peut peser 1 Mo). Les types
// ne suffisent pas : un éditeur (Zed…) peut annoncer du texte vide.
export async function hasText(mode: ReadMode): Promise<boolean> {
  if (isWin && mode === 'selection') return true; // inconnaissable sans Ctrl+C
  const cli = findWlPaste();
  if (!cli) return !!clipboard.readText(mode).trim();
  if (!(await textOffered(cli, mode))) return false;
  const head = await wlPasteRun(cli, textArgs(mode), HAS_TEXT_MAX);
  return head === null || !!head.trim(); // null : plus long que HAS_TEXT_MAX
}

// Pour un simple aperçu (préchargement au survol) : jamais de Ctrl+C simulé.
export function peekText(mode: ReadMode) {
  return isWin && mode === 'selection' ? Promise.resolve('') : readText(mode);
}
