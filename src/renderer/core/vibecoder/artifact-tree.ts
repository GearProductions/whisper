/** artifact-tree — l'arborescence des artefacts, sans le DOM : bâtie sur file-tree (les nœuds, dossiers
 *  d'abord puis fichiers, par nom ; visibleRows aussi), à laquelle elle ajoute les ids à envoyer pour une
 *  sélection et le problème d'un nom tapé. Un nœud est tenu par son nom (le chemin sous le dossier
 *  d'artefacts), stable d'un relevé à l'autre ; les ids (a<i>, d<i>) ne sont lus qu'au moment d'agir.
 *  Montre ce qu'on lui donne (le relevé s'arrête à 1 000 fichiers), pas les dossiers cachés.
 *  nameProblem double plainName (le principal, qui décide) : mêmes règles, pour l'encart rouge.
 *  artifactResult : le dernier résultat des actions du panneau (dépôt compris), ce que le principal a
 *  refusé ou fait à moitié compris.
 *  Ne connaît pas : le pont, le DOM. Utilisé par : core/vibecoder, app/panel/vibecoder. */
import type { VibeAction, VibeArtifact, VibeArtifactDir } from 'technicals/bridge';
import { fileTree, type FileNode } from './file-tree';

export type TreeNode = FileNode & {
  id: string;         // a<i> ou d<i> du relevé ; '' : dossier impliqué par un chemin, sans d<i>
  artifact?: VibeArtifact;
};

export const artifactTree = (artifacts: VibeArtifact[], dirs: VibeArtifactDir[]): TreeNode[] => {
  const byName = new Map(artifacts.map((a) => [a.name, a]));
  const dirId = new Map(dirs.map((d) => [d.name, d.id]));
  return fileTree([...byName.keys()], dirs.map((d) => d.name)).map((n) => {
    const artifact = n.folder ? undefined : byName.get(n.key);
    return artifact ? { ...n, id: artifact.id, artifact } : { ...n, id: dirId.get(n.key) ?? '' };
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
