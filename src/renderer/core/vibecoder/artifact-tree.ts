/** artifact-tree — l'arborescence des artefacts, sans le DOM : les nœuds (dossiers d'abord, puis
 *  fichiers, par nom), ceux qu'on voit selon les dossiers dépliés, les ids à envoyer pour une
 *  sélection, le problème d'un nom tapé. Un nœud est tenu par son nom (le chemin sous le dossier
 *  d'artefacts), stable d'un relevé à l'autre ; les ids (a<i>, d<i>) ne sont lus qu'au moment d'agir.
 *  Montre ce qu'on lui donne (le relevé s'arrête à 1 000 fichiers), pas les dossiers cachés.
 *  nameProblem double plainName (le principal, qui décide) : mêmes règles, pour l'encart rouge.
 *  artifactResult : le dernier résultat des actions du panneau (dépôt compris), ce que le principal a
 *  refusé ou fait à moitié compris.
 *  Ne connaît pas : le pont, le DOM. Utilisé par : core/vibecoder, app/panel/vibecoder. */
import type { VibeAction, VibeArtifact, VibeArtifactDir } from 'technicals/bridge';

export type TreeNode = {
  key: string;        // le nom : le chemin sous le dossier d'artefacts
  label: string;      // son dernier segment
  id: string;         // a<i> ou d<i> du relevé ; '' : dossier impliqué par un chemin, sans d<i>
  folder: boolean;
  depth: number;
  parent: string;     // la clé du dossier qui le contient ; '' : la racine
  artifact?: VibeArtifact;
};

const parentOf = (key: string) => key.slice(0, Math.max(key.lastIndexOf('/'), 0));

// Les dossiers qui contiennent `path` : a, a/b pour a/b/c.
const ancestors = (path: string) => {
  const parts = path.split('/');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
};

export const artifactTree = (artifacts: VibeArtifact[], dirs: VibeArtifactDir[]): TreeNode[] => {
  const folders = new Map<string, string>();   // clé → id
  for (const d of dirs) {
    for (const a of ancestors(d.name)) if (!folders.has(a)) folders.set(a, '');
    folders.set(d.name, d.id);
  }
  for (const a of artifacts) for (const p of ancestors(a.name)) if (!folders.has(p)) folders.set(p, '');

  const all: TreeNode[] = [
    ...[...folders].map(([key, id]) => ({ key, id, folder: true })),
    ...artifacts.map((artifact) => ({ key: artifact.name, id: artifact.id, folder: false, artifact })),
  ].map((n) => ({ ...n, label: n.key.slice(n.key.lastIndexOf('/') + 1), depth: n.key.split('/').length - 1, parent: parentOf(n.key) }));

  const children = new Map<string, TreeNode[]>();
  for (const n of all) children.set(n.parent, [...(children.get(n.parent) ?? []), n]);
  const walk = (parent: string): TreeNode[] =>
    (children.get(parent) ?? [])
      .sort((a, b) => Number(b.folder) - Number(a.folder) || a.label.localeCompare(b.label))
      .flatMap((n) => (n.folder ? [n, ...walk(n.key)] : [n]));
  return walk('');
};

// Les nœuds dont tous les dossiers parents sont dans `open`.
export const visibleRows = (nodes: TreeNode[], open: ReadonlySet<string>): TreeNode[] => {
  const shown = new Set<string>(['']);   // les dossiers dont le contenu se voit
  return nodes.filter((n) => {
    if (!shown.has(n.parent)) return false;
    if (n.folder && open.has(n.key)) shown.add(n.key);
    return true;
  });
};

// Les ids des nœuds dont la clé est dans `keys` : ceux du relevé, sans un descendant d'un dossier déjà pris.
export const idsOf = (nodes: TreeNode[], keys: Iterable<string>): string[] => {
  const wanted = new Set(keys);
  const covered = new Set<string>();   // les dossiers pris ou sous un dossier pris
  return nodes.flatMap((n) => {
    const under = covered.has(n.parent);
    const take = wanted.has(n.key) && !under && !!n.id;
    if (n.folder && (under || take)) covered.add(n.key);
    return take ? [n.id] : [];
  });
};

export type NameProblem = 'empty' | 'dots' | 'separator' | 'hidden' | 'long' | 'windows' | 'taken';

// Ni `: * ? " < > |`, ni contrôle, ni espace ou point final, ni nom réservé de Windows (comme plainName).
const WINDOWS = /[:*?"<>|\x00-\x1f]|[ .]$|^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

// Ce qui cloche dans un nom seul tapé (les règles de plainName) ; `siblings` : les noms déjà pris à côté, d'après le relevé.
export const nameProblem = (name: string, siblings: string[], folder: boolean): NameProblem | null => {
  if (!name) return 'empty';
  if (name === '.' || name === '..') return 'dots';
  if (/[/\\\0]/.test(name)) return 'separator';
  if (folder && name.startsWith('.')) return 'hidden';
  if (new TextEncoder().encode(name).length > 255) return 'long';
  if (WINDOWS.test(name)) return 'windows';
  return siblings.includes(name) ? 'taken' : null;
};

// Les actions du panneau Artefacts, le dépôt compris (add-artifact).
export const ARTIFACT_ACTIONS = ['add-artifact', 'copy-artifact', 'rename-artifact', 'new-artifact-file', 'new-artifact-folder',
  'trash-artifacts', 'move-artifacts', 'copy-artifacts', 'duplicate-artifacts'];
export type ArtifactResult = { running: boolean; last: { ok: boolean; line: string; detail: string; time: number } | null };

// Leur résultat à l'écran : l'une tourne, et la plus récente des dernières lignes.
export const artifactResult = (actions: Pick<VibeAction, 'id' | 'direct'>[]): ArtifactResult => {
  const mine = actions.filter((a) => ARTIFACT_ACTIONS.includes(a.id) && a.direct);
  const last = mine.map((a) => a.direct!.last).reduce<ArtifactResult['last']>((best, l) => (l && (!best || l.time > best.time) ? l : best), null);
  return { running: mine.some((a) => a.direct!.running), last };
};
