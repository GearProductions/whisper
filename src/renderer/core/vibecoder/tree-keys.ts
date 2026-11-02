/** tree-keys — ce que fait une touche dans l'arborescence des artefacts, comme l'explorateur de VS
 *  Code : ↑ ↓ Début Fin déplacent le focus (Maj : étendent la sélection), ← plie le dossier ou
 *  remonte au parent, → déplie ou descend au premier enfant, F2 renomme, Suppr supprime.
 *  `rows` : les lignes visibles ; `open` : les dossiers dépliés ; `focus` : la clé de la ligne
 *  active. Rend ce qui change (jamais `open` modifié en place), null : la touche n'est pas à nous.
 *  Ne connaît pas : le pont, le DOM, la sélection. Utilisé par : app/panel/vibecoder (artifact-tree-view). */
import type { TreeNode } from './artifact-tree';

export type TreeKeyResult = { focus?: string; open?: Set<string>; extend?: true; command?: 'rename' | 'trash' };

export const treeKey = (
  rows: TreeNode[], open: ReadonlySet<string>, focus: string | null, key: string, shift: boolean,
): TreeKeyResult | null => {
  const i = rows.findIndex((r) => r.key === focus);
  const node = rows[i];
  const go = (to: number): TreeKeyResult | null => {
    const row = rows[Math.min(Math.max(to, 0), rows.length - 1)];
    return row ? { focus: row.key, ...(shift && { extend: true as const }) } : null;
  };
  switch (key) {
    case 'ArrowDown': return go(i + 1);   // sans focus (i = -1) : la première ligne
    case 'ArrowUp': return go(i < 0 ? rows.length - 1 : i - 1);
    case 'Home': return go(0);
    case 'End': return go(rows.length - 1);
    case 'F2': return node ? { command: 'rename' } : null;
    case 'Delete': return node ? { command: 'trash' } : null;
    case 'ArrowLeft': {
      if (!node) return null;
      if (node.folder && open.has(node.key)) {
        const next = new Set(open);
        next.delete(node.key);
        return { open: next };
      }
      return node.parent ? { focus: node.parent } : null;
    }
    case 'ArrowRight': {
      if (!node?.folder) return null;
      if (!open.has(node.key)) return { open: new Set(open).add(node.key) };
      return rows[i + 1]?.parent === node.key ? { focus: rows[i + 1].key } : null;
    }
    default: return null;
  }
};
