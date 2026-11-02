/** file-tree-view — l'arborescence des fichiers de la vue IDE : les lignes visibles (rows), indentées
 *  selon leur profondeur, un chevron aux dossiers (clic → onToggle), la ligne choisie (selected) marquée,
 *  un clic sur une ligne → onSelect(key). Si `dot` est donné, un point d'état (vc-mod-dot, coloré par le
 *  data-state de la ligne) précède le nom des fichiers que `dot` connaît. Les noms sont du texte.
 *  Les classes sont celles de l'arborescence des artefacts (artifact-tree-view.css) : ni renommer, ni
 *  glisser, ni menu.
 *  Ne connaît pas : le pont, les modules, les artefacts.
 *  Utilisé par : ide-view. */
import type { FileNode, ModuleState } from 'core/vibecoder';
import './artifact-tree-view.css';
import './modules-view.css';

export type FileTreeViewProps = {
  rows: FileNode[];
  open: ReadonlySet<string>;
  selected: string | null;
  dot?(key: string): ModuleState | null;
  onToggle(key: string): void;
  onSelect(key: string): void;
};

export function FileTreeView({ rows, open, selected, dot, onToggle, onSelect }: FileTreeViewProps) {
  return (
    <div className="vc-tree" role="tree">
      {rows.map((n) => {
        const isOpen = n.folder && open.has(n.key);
        const state = n.folder ? null : dot?.(n.key) ?? null;
        return (
          <div key={n.key} className="vc-tree-row" role="treeitem" data-key={n.key} data-state={state ?? undefined}
            aria-selected={n.key === selected} aria-expanded={n.folder ? isOpen : undefined}
            style={{ paddingLeft: 6 + n.depth * 10 }} title={n.key}
            onClick={() => (n.folder ? onToggle(n.key) : onSelect(n.key))}>
            <span className="vc-tree-chevron" data-open={isOpen || undefined} aria-hidden="true">{n.folder ? '›' : ''}</span>
            {state && <span className="vc-mod-dot" aria-hidden="true" />}
            <span className="vc-tree-label">{n.label}</span>
          </div>
        );
      })}
    </div>
  );
}
