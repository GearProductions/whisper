/** module-code — le fichier ouvert dans l'accordéon Voir le code de l'étape
 *  Modules, ou, en Créer seulement, la note de la branche ou un de ses tests
 *  d'invariants ; un à la fois, de l'agent affiché : followCode le suit (id du
 *  dernier relevé traduit par codeFile — `m<rang>/<i>`, `n`, `t<i>` —,
 *  safePath ; lu jusqu'à READ_MAX, au-delà text null ; surveillé par fs.watch
 *  de son dossier, filtré sur son nom — une écriture par renommage compte —,
 *  poussé à la page par conv:vibeCode à l'ouverture et à chaque changement ;
 *  un id qui ne désigne rien : null poussé, rien lu ; un fichier de module,
 *  lu : avec at, son texte au commit où la branche part de repo.base
 *  (forkPoint) et à HEAD (gitReader.show), relus à chaque poussée, null là où
 *  il manque ou dépasse READ_MAX ; la note et les tests : sans at) ; saveCode l'enregistre
 *  au geste de l'utilisateur, seulement le fichier suivi, s'il est encore dans
 *  le relevé, que codeLock (recalculé ici, sans se fier à la page : isBusy,
 *  lockingRuns ; sans module, la note ou un test, toute course retient) ne le
 *  grise pas et qu'il existe déjà (exception à I-39), puis refreshVibe.
 *  Ne connaît pas : la page (seulement ses canaux) ; git (technicals/git). La fenêtre : seulement
 *  state.panel pour pousser conv:vibeCode, comme controllers/vibecoder pour
 *  conv:vibe (aucun assistant d'envoi au panneau n'existe).
 *  Utilisé par : app/ipc (panel-handlers). */
import fs from 'node:fs';
import path from 'node:path';
import type { SendResult, VibeCode, VibeLang } from 'shared/bridge';
import { vibeLang } from 'core/config';
import { codeFile, codeLock, safePath } from 'core/vibecoder';
import { gitReader, gitRun } from 'technicals/git';
import { loadConfig } from 'app/settings';
import { state } from 'app/state';
import { isBusy } from './agents';
import { lockingRuns } from './runs';
import { READ_MAX, readTimed } from './processes';
import { lastView, refreshVibe, vibeAgent } from './vibecoder';

const ERRORS: Record<VibeLang, Record<'file' | 'text' | 'write', string>> = {
  fr: { file: 'Ce fichier n’est plus affiché.', text: 'Texte invalide ou trop gros.', write: 'Enregistrement impossible.' },
  en: { file: 'This file is no longer shown.', text: 'Invalid or too large text.', write: 'Could not save.' },
};

// Le fichier suivi : l'agent, l'id, son chemin dans le dépôt, son veilleur.
let followed: { agentId: string; id: string; rel: string; module: boolean; watcher: fs.FSWatcher | null } | null = null;

const push = (code: VibeCode | null) => {
  if (state.panel && !state.panel.isDestroyed()) state.panel.webContents.send('conv:vibeCode', code);
};

// Le fichier, s'il reste dans le dossier de l'agent (`..` et liens résolus).
const fileOf = (dir: string, rel: string) => safePath(dir, rel, fs.realpathSync.native);

// Ses textes à la base de la branche et à HEAD (null : absent là, trop gros, pas de base).
async function versions(dir: string, agentId: string, rel: string): Promise<NonNullable<VibeCode['at']>> {
  const git = gitReader(gitRun(dir));
  const base = lastView(agentId)?.repo?.base;
  const fork = base ? await git.forkPoint(base) : null;
  const small = (t: string | null) => (t !== null && Buffer.byteLength(t) <= READ_MAX ? t : null);
  const [atBase, atHead] = await Promise.all([fork ? git.show(fork, rel) : null, git.show('HEAD', rel)]);
  return { base: small(atBase), head: small(atHead) };
}

// Pousse le fichier suivi : son texte (null : trop gros, illisible, sorti du
// dossier) et, d'un module, ses versions. Seule la dernière lancée pousse
// (des lectures git plus lentes ne passent pas derrière), le disque lu après git.
let pushes = 0;
async function pushFollowed(dir: string) {
  const me = followed;
  if (!me) return;
  const n = ++pushes;
  const at = me.module && fileOf(dir, me.rel) ? await versions(dir, me.agentId, me.rel) : undefined;
  if (followed !== me || n !== pushes) return;
  const file = fileOf(dir, me.rel);
  const read = file ? readTimed(file) : null;
  push({ id: me.id, text: read?.text ?? null, time: read?.time ?? 0, ...(at && read && { at }) });
}

// Suit le fichier de cet id (null : ne plus suivre).
export function followCode(id: unknown): void {
  followed?.watcher?.close();
  followed = null;
  if (id === null) return;
  const agent = vibeAgent();
  const found = agent && typeof id === 'string' ? codeFile(lastView(agent.id), id) : null;
  const file = found && fileOf(agent!.dir, found.path);
  if (!agent || !found || !file) { push(null); return; }
  const me = { agentId: agent.id, id: id as string, rel: found.path, module: found.module !== null, watcher: null as fs.FSWatcher | null };
  followed = me;
  try {
    const name = path.basename(file);
    me.watcher = fs.watch(path.dirname(file), (_ev, changed) => {
      if (followed === me && (!changed || changed.toString() === name)) void pushFollowed(agent.dir);
    });
    me.watcher.on('error', () => me.watcher?.close());
    me.watcher.unref();
  } catch { /* dossier non surveillable : lu une fois */ }
  void pushFollowed(agent.dir);
}

// Enregistre `text` dans le fichier suivi, désigné par son id.
export function saveCode(id: unknown, text: unknown): SendResult {
  const cfg = loadConfig();
  const lang = vibeLang(cfg);
  const T = ERRORS[lang];
  const agent = vibeAgent(cfg);
  if (!agent || !followed || followed.agentId !== agent.id || id !== followed.id) return { ok: false, error: T.file };
  const found = codeFile(lastView(agent.id), followed.id);
  if (!found || found.path !== followed.rel) return { ok: false, error: T.file };
  const locked = codeLock(found.module?.path ?? null, isBusy(agent.id), lockingRuns(agent.id), lang);
  if (locked) return { ok: false, error: locked };
  if (typeof text !== 'string' || Buffer.byteLength(text) > READ_MAX) return { ok: false, error: T.text };
  const file = fileOf(agent.dir, found.path);
  try {
    if (!file || !fs.lstatSync(file).isFile()) return { ok: false, error: T.write };
    fs.writeFileSync(file, text);
  } catch { return { ok: false, error: T.write }; }
  refreshVibe({ now: true });
  return { ok: true };
}
