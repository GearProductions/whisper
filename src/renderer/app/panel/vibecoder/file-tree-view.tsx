/** file-tree-view — l'arborescence des fichiers de la vue IDE : les lignes visibles (rows), indentées
 *  selon leur profondeur, un chevron aux dossiers (clic → onToggle), la ligne choisie (selected) marquée,
 *  un clic sur une ligne → onSelect(key). Si `mark` est donné, le nom d'un fichier prend la couleur qu'il
 *  rend (data-mark, comme VS Code : nouveau vert, modifié jaune, supprimé rouge barré, à générer
 *  atténué ; null : commité, la couleur ordinaire) ; si `rank` est donné, le numéro
 *  qu'il rend (vc-tree-rank, l'ordre de génération du module) prend la place du chevron, vide pour un
 *  fichier : le nom reste aligné sur ceux des dossiers voisins. Si `dim` est donné, un fichier pour
 *  lequel il rend vrai est en retrait (data-dim : grisé, toujours lisible et cliquable ; sa couleur gardée).
 *  Les noms sont du texte.
 *  Les classes sont celles de l'arborescence des artefacts (artifact-tree-view.css) : ni renommer, ni
 *  glisser, ni menu.
 *  Ne connaît pas : le pont, les modules, les artefacts.
 *  Utilisé par : ide-view. */
import type { FileMark, FileNode } from 'core/vibecoder';
import './artifact-tree-view.css';
import './modules-view.css';

export type FileTreeViewProps = {
  rows: FileNode[];
  open: ReadonlySet<string>;
  selected: string | null;
  mark?(key: string): FileMark | null;
  rank?(key: string): number | null;
  dim?(key: string): boolean;
  onToggle(key: string): void;
  onSelect(key: string): void;
};

export function FileTreeView({ rows, open, selected, mark, rank, onToggle, onSelect }: FileTreeViewProps) {
  return (
    <div className="vc-tree" role="tree">
      {rows.map((n) => {
        const isOpen = n.folder && open.has(n.key);
        const tone = n.folder ? null : mark?.(n.key) ?? null;
        const num = n.folder ? null : rank?.(n.key) ?? null;
        return (
          <div key={n.key} className="vc-tree-row" role="treeitem" data-key={n.key} data-mark={tone ?? undefined}
            aria-selected={n.key === selected} aria-expanded={n.folder ? isOpen : undefined}
            style={{ paddingLeft: 6 + n.depth * 10 }} title={n.key}
            onClick={() => (n.folder ? onToggle(n.key) : onSelect(n.key))}>
            <span className="vc-tree-chevron" data-open={isOpen || undefined} aria-hidden="true">
              {n.folder ? '›' : num !== null ? <span className="vc-tree-rank">{num}</span> : ''}
            </span>
            <span className="vc-tree-label">{n.label}</span>
          </div>
        );
      })}
    </div>
  );
}
