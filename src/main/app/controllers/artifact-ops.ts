/** artifact-ops — gérer les artefacts du projet comme des fichiers, au clic : renameArtifact,
 *  newArtifact (fichier vide ouvert en 'wx', dossier par mkdir non récursif), trashArtifacts,
 *  moveArtifacts, copyArtifacts (coller), duplicateArtifacts (chacun dans son dossier).
 *  La page ne donne que des ids du dernier relevé de l'agent affiché (a<i> fichier, d<i> dossier,
 *  absent : la racine), jamais lus comme des chemins (I-37), et un nom tapé (plainName). Chaque
 *  élément passe par noLinkPath : sous le dossier du projet, aucun lien sur le chemin. Jamais
 *  d'écrasement ni de rename : copie exclusive puis effacement, un nom pris prend le premier
 *  numéro libre (copyInto, moveInto), sauf renommer (refusé). Supprimer : les noms confirmés
 *  doivent être, un à un, ceux des ids dans le dernier relevé, sinon rien ne part ; puis la
 *  corbeille du système, jamais unlink ni rm. Les réponses (la forme de DirectResult) sont en
 *  anglais, comme celles de artifacts (F-108) ; un refus ou un échec porte sa clé (reason) :
 *  'unknown-artifact' (un id inconnu du relevé, élément ou dossier d'arrivée), 'name' (un nom
 *  refusé par plainName), 'failed' (le disque a échoué), 'refused' (tout autre : un nom pris, un
 *  dossier dans lui-même, des noms confirmés qui diffèrent, une partie refusée ou en échec).
 *  Ne connaît pas : la page (ses canaux), les libellés de l'écran.
 *  Utilisé par : controllers/vibecoder (runDirect). */
import fs from 'node:fs';
import path from 'node:path';
import { shell } from 'electron';
import type { AgentConfig } from 'core/agents';
import { artifactItem, folderOf, noLinkPath, within } from 'core/vibecoder';
import { plainName } from 'helpers';
import { copyInto, moveInto, renameItem } from 'technicals/file-tree';
import type { TreeReport } from 'technicals/file-tree';
import { projectArtifactsDir, projectArtifactsPath, type ArtifactRefusal } from './artifacts';
import { viewAgent } from './agents';
import { lastView } from './vibecoder';

// La forme de DirectResult (technicals/direct, que seul controllers/vibecoder importe) : il la passe telle quelle ;
// reason : la clé d'un refus ou d'un échec, que runDirect rend à la commande.
type DirectResult = { ok: boolean; line: string; detail: string; reason?: ArtifactRefusal };
export type Trash = (file: string) => Promise<void>;

type Scope = NonNullable<ReturnType<typeof scope>>;
type Item = { name: string; folder: boolean };

const refused = (line: string, reason: ArtifactRefusal = 'refused'): DirectResult =>
  ({ ok: false, line: `Refused: ${line}`, detail: '', reason });
const unknown = (what: string) => refused(`unknown ${what}.`, 'unknown-artifact');
const lstat = (p: string) => fs.lstatSync(p, { throwIfNoEntry: false });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
// Le dossier d'un élément du relevé : '' pour la racine.
const parentOf = (name: string) => path.posix.dirname(name).replace(/^\.$/, '');

// L'agent affiché, son dossier d'artefacts et son dernier relevé ; null pour un autre agent.
// create : le dossier créé au besoin (un premier fichier à la racine), seulement pour l'agent affiché.
function scope(agent: AgentConfig, create = false) {
  if (viewAgent()?.id !== agent.id) return null;
  return { root: create ? projectArtifactsDir(agent.dir) : projectArtifactsPath(agent.dir), view: lastView(agent.id) };
}

// Les éléments du relevé de ces ids ; null si ce n'est pas une liste non vide d'ids connus.
function items(s: Scope, ids: unknown): Item[] | null {
  if (!Array.isArray(ids) || !ids.length) return null;
  const list = ids.map((id) => artifactItem(s.view, id));
  return list.every(Boolean) ? (list as Item[]) : null;
}

// Sans ceux qui sont sous un dossier de la liste : il part (ou se déplace) avec lui.
const top = (list: Item[]) => list.filter((i) => !list.some((f) => f.folder && f !== i && within(i.name, f.name)));

// Le dossier d'arrivée d'un id (absent : la racine) : son nom dans le relevé et son chemin, sans lien ; null sinon.
function target(s: Scope, folder: unknown) {
  const name = folderOf(s.view, folder);
  const dir = name === null ? null : noLinkPath(s.root, name, lstat);
  return dir === null || name === null ? null : { name, dir };
}
type Into = NonNullable<ReturnType<typeof target>>;

// Ce que le rapport d'un élément dit : son premier échec, ou rien.
const failure = (r: TreeReport) => r.failed[0]?.error;
// Un déplacement qui a laissé des dossiers cachés ou des liens : la source reste, à dire.
const LEFT = 'hidden folders or links stayed in the old place.';
const leftover = (r: TreeReport) => failure(r) ?? (r.hidden.length || r.links.length ? LEFT : undefined);

// Fait `job` pour chaque élément, sur son chemin sans lien ; job rend un problème (refusé, échec), null si
// rien à faire, rien si c'est fait. Un échec n'arrête pas les suivants (le tout est alors refused).
// `to` : le dossier d'arrivée de la page (folder absent : la racine) ; un id inconnu est refusé avant le premier élément.
type Job<I> = (item: Item, src: string, into: I) => Promise<string | null | void>;
// Avec `to`, le job reçoit son dossier d'arrivée (jamais null : un dossier inconnu est refusé avant) ; sans, rien.
function each(agent: AgentConfig, ids: unknown, verb: string, job: Job<undefined>): Promise<DirectResult>;
function each(agent: AgentConfig, ids: unknown, verb: string, job: Job<Into>, to: { folder: unknown }): Promise<DirectResult>;
async function each(
  agent: AgentConfig, ids: unknown, verb: string,
  job: Job<Into> | Job<undefined>,
  to?: { folder: unknown },
): Promise<DirectResult> {
  const s = scope(agent);
  const list = s && items(s, ids);
  if (!s || !list) return unknown('artifact');
  const into = to ? target(s, to.folder) ?? undefined : undefined;
  if (to && !into) return unknown('destination folder');
  const problems: string[] = [];
  let done = 0;
  for (const item of top(list)) {
    const src = noLinkPath(s.root, item.name, lstat);
    const problem = src ? await (job as Job<Into | undefined>)(item, src, into).catch(message) : 'not a plain file or folder under the artifacts folder.';
    if (problem) problems.push(`${item.name}: ${problem}`);
    else if (problem === undefined) done++;
  }
  const line = `${verb} ${done}${problems.length ? `, ${problems.length} refused or failed` : ''}.`;
  return problems.length ? { ok: false, line, detail: problems.join('\n'), reason: 'refused' } : { ok: true, line, detail: '' };
}

export async function renameArtifact(agent: AgentConfig, id: unknown, name: unknown): Promise<DirectResult> {
  const s = scope(agent);
  const item = s && artifactItem(s.view, id);
  if (!s || !item) return unknown('artifact');
  const to = plainName(name, item.folder);
  if (!to) return refused('invalid name.', 'name');
  const src = noLinkPath(s.root, item.name, lstat);
  if (!src) return refused('not a plain file or folder under the artifacts folder.');
  if (to === path.basename(src)) return { ok: true, line: 'Nothing to rename.', detail: '' };
  try {
    const done = await renameItem(src, to);
    if (done === 'taken') return refused(`"${to}" already exists.`);
    if (done === 'left') return { ok: false, line: `Renamed to ${to}, but ${LEFT}`, detail: '', reason: 'refused' };
  } catch (e) { return { ok: false, line: `Rename failed: ${message(e)}`, detail: '', reason: 'failed' }; }
  return { ok: true, line: `Renamed to ${to}.`, detail: '' };
}

// Un fichier vide ou un dossier dans le dossier visé (absent : la racine), créé au besoin ; le nom pris : refusé.
export async function newArtifact(agent: AgentConfig, folder: unknown, name: unknown, dir: boolean): Promise<DirectResult> {
  const s = scope(agent, true);
  const into = s && target(s, folder);
  if (!into) return unknown('folder');
  const n = plainName(name, dir);
  if (!n) return refused('invalid name.', 'name');
  const file = path.join(into.dir, n);
  try {
    if (dir) await fs.promises.mkdir(file);
    else await (await fs.promises.open(file, 'wx')).close();
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EEXIST'
      ? refused(`"${n}" already exists.`) : { ok: false, line: `Create failed: ${message(e)}`, detail: '', reason: 'failed' };
  }
  return { ok: true, line: `Created ${n}.`, detail: '' };
}

// Supprimer : `names` doit être, un à un et dans l'ordre, les noms des ids dans le dernier relevé, sinon rien ne
// part ; ils ne sont jamais lus comme des chemins. Puis chaque élément à la corbeille, jamais effacé.
export async function trashArtifacts(
  agent: AgentConfig, ids: unknown, names: unknown, trash: Trash = (f) => shell.trashItem(f),
): Promise<DirectResult> {
  const s = scope(agent);
  const list = s && items(s, ids);
  if (!list) return unknown('artifact');
  if (!Array.isArray(names) || names.length !== list.length || list.some((i, k) => i.name !== names[k]))
    return refused('the confirmed names differ from the artifacts.');
  return each(agent, ids, 'Moved to trash', async (_item, src) => { await trash(src); });
}

// Déplacer vers un dossier (absent : la racine) : pas dans soi ni dessous, rien s'il y est déjà.
export const moveArtifacts = (agent: AgentConfig, ids: unknown, folder: unknown) =>
  each(agent, ids, 'Moved', async (item, src, into) => {
    if (item.folder && within(into.name, item.name)) return 'a folder cannot move into itself.';
    if (parentOf(item.name) === into.name) return null;
    return leftover(await moveInto(src, into.dir));
  }, { folder });

// Coller : copier vers un dossier (absent : la racine), le nom pris prend un numéro.
export const copyArtifacts = (agent: AgentConfig, ids: unknown, folder: unknown) =>
  each(agent, ids, 'Copied', async (_item, src, into) => failure(await copyInto(src, into.dir)), { folder });

// Dupliquer : chacun dans son dossier, sous un numéro.
export const duplicateArtifacts = (agent: AgentConfig, ids: unknown) =>
  each(agent, ids, 'Duplicated', async (_item, src) => failure(await copyInto(src, path.dirname(src))));
