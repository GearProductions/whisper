/** artifact-clipboard — le presse-papiers de l'arborescence des artefacts, sans le DOM : ce que coller,
 *  déplacer (glisser-déposer) et dupliquer envoient, et les entrées du menu clic droit. Les clés (les
 *  noms) sont gardées ; les ids ne sont lus dans `nodes` qu'au moment d'agir, par idsOf. `folder` est
 *  une clé de dossier ('' : la racine) ; l'id envoyé est son d<i>, absent pour la racine.
 *  Couper dans soi-même (le dossier ou un de ses sous-dossiers) : null. Jamais un chemin dans les args.
 *  Ne connaît pas : le pont, le DOM. Utilisé par : app/panel/vibecoder (artifacts-view). */
import type { VibeArgs } from 'technicals/bridge';
import { idsOf, type TreeNode } from './artifact-tree';

export type Clip = { mode: 'copy' | 'cut'; keys: string[] } | null;
export type MenuEntry = 'rename' | 'trash' | 'copy' | 'cut' | 'paste' | 'duplicate' | 'newFile' | 'newFolder';
export type ClipAction = { action: 'copy-artifacts' | 'move-artifacts' | 'duplicate-artifacts'; args: VibeArgs };

export const pasteArgs = (clip: Clip, nodes: TreeNode[], folder: string): ClipAction | null => {
  if (!clip) return null;
  const artifacts = idsOf(nodes, clip.keys);
  const target = folder ? nodes.find((n) => n.key === folder && n.folder) : undefined;
  if (!artifacts.length || (folder && !target?.id)) return null;   // rien de présent ; dossier inconnu ou sans d<i>
  if (clip.mode === 'cut' && clip.keys.some((k) => folder === k || folder.startsWith(`${k}/`))) return null;
  return {
    action: clip.mode === 'cut' ? 'move-artifacts' : 'copy-artifacts',
    args: { direct: true, artifacts, ...(target ? { folder: target.id } : {}) },
  };
};

export const moveArgs = (nodes: TreeNode[], keys: Iterable<string>, folder: string) =>
  pasteArgs({ mode: 'cut', keys: [...keys] }, nodes, folder);

export const duplicateArgs = (nodes: TreeNode[], keys: Iterable<string>): ClipAction | null => {
  const artifacts = idsOf(nodes, keys);
  return artifacts.length ? { action: 'duplicate-artifacts', args: { direct: true, artifacts } } : null;
};

// Les entrées du menu : renommer et dupliquer pour un seul, coller s'il y a quelque chose, nouveau sur un dossier ou le vide.
export const menuEntries = (target: 'item' | 'folder' | 'blank', count: number, clip: Clip): MenuEntry[] => {
  const on = target !== 'blank';
  const entries: [MenuEntry, boolean][] = [
    ['rename', on && count === 1], ['trash', on], ['copy', on], ['cut', on], ['paste', !!clip],
    ['duplicate', on && count === 1], ['newFile', target !== 'item'], ['newFolder', target !== 'item'],
  ];
  return entries.filter(([, show]) => show).map(([id]) => id);
};
