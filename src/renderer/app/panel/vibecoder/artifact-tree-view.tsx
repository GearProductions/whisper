/** artifact-tree-view — l'arborescence des artefacts : les lignes visibles (rows), indentées selon
 *  leur profondeur, un chevron aux dossiers (onToggle), la sélection (selected) et la ligne au clavier
 *  (focus) marquées. Clic → onSelect(key, {ctrl, shift}), Ctrl ou Cmd comptant pour ctrl ; menu
 *  contextuel → onMenu(x, y, key), ou null hors de toute ligne ; les touches → onKey (sauf celles du
 *  champ de saisie). `editing` met un RenameField à la place du nom d'une ligne, ou, si sa clé n'est
 *  pas dans rows, sur une ligne neuve juste sous le dossier `parent` (relevé et pliage sont l'affaire
 *  de l'appelant) ; problem, déjà traduit, s'affiche sous le champ.
 *  Glisser une ligne (toute la sélection si elle en fait partie) ne porte que notre type MIME, jamais
 *  un File : le lâcher appelle onMove(clés, dossier). Des fichiers venus du gestionnaire de fichiers
 *  appellent onDropFiles(files, dossier). Le dossier est la ligne dossier visée, le dossier d'une ligne
 *  fichier, '' (la racine) hors de toute ligne. data-own-drop sur toute l'arborescence : panel-app
 *  n'envoie rien de ce qui y tombe à la conversation.
 *  Ne connaît pas : le pont, le disque, les ids du relevé (jamais lus), les règles d'un déplacement.
 *  Utilisé par : artifacts-view. */
import { useEffect, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import type { TreeNode } from 'core/vibecoder';
import { RenameField } from './rename-field';
import './artifact-tree-view.css';

export const TREE_MIME = 'application/x-vibecoder-artifacts';

export type ArtifactTreeViewProps = {
  rows: TreeNode[];
  open: ReadonlySet<string>;
  selected: string[];
  focus: string | null;
  editing: { key: string; folder: boolean; parent: string } | null;
  problem: string | null;
  onToggle(key: string): void;
  onSelect(key: string, mods: { ctrl: boolean; shift: boolean }): void;
  onKey(e: KeyboardEvent): void;
  onMenu(x: number, y: number, key: string | null): void;
  onEdit(name: string): void;
  onEditDone(name: string): void;
  onEditCancel(): void;
  onMove(keys: string[], folder: string): void;
  onDropFiles(files: File[], folder: string): void;
};

const hasType = (e: DragEvent, type: string) => [...(e.dataTransfer?.types ?? [])].includes(type);

export function ArtifactTreeView({ rows, open, selected, focus, editing, problem, onToggle, onSelect, onKey, onMenu, onEdit, onEditDone, onEditCancel, onMove, onDropFiles }: ArtifactTreeViewProps) {
  const [over, setOver] = useState<string | null>(null);   // le dossier qui recevrait le lâcher
  const tree = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus !== null) [...tree.current!.querySelectorAll<HTMLElement>('[data-key]')].find((r) => r.dataset.key === focus)?.scrollIntoView?.({ block: 'nearest' });
  }, [focus]);

  // Les lignes à dessiner : une ligne de saisie neuve s'ajoute sous son dossier.
  const shown: { node: TreeNode; fresh?: boolean }[] = rows.map((node) => ({ node }));
  if (editing && !rows.some((n) => n.key === editing.key)) {
    const at = editing.parent ? rows.findIndex((n) => n.key === editing.parent) + 1 : 0;
    const depth = editing.parent ? (rows[at - 1]?.depth ?? -1) + 1 : 0;
    shown.splice(at, 0, { fresh: true, node: { key: editing.key, label: '', id: '', folder: editing.folder, depth, parent: editing.parent } });
  }

  // Le dossier où tombe un lâcher : celui de la ligne visée ('' hors de toute ligne).
  const targetOf = (e: DragEvent) => {
    const key = (e.target as Element).closest<HTMLElement>('[data-key]')?.dataset.key;
    const n = rows.find((r) => r.key === key);
    return n ? (n.folder ? n.key : n.parent) : '';
  };
  const dropped = (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const folder = targetOf(e);
    if (hasType(e, TREE_MIME)) onMove(JSON.parse(e.dataTransfer.getData(TREE_MIME) || '[]'), folder);
    else if (e.dataTransfer.files.length) onDropFiles([...e.dataTransfer.files], folder);
  };

  return (
    <div ref={tree} className="vc-tree" role="tree" aria-multiselectable="true" tabIndex={0} data-own-drop data-over={over === '' || undefined}
      onKeyDown={(e) => { if (!(e.target instanceof HTMLInputElement)) onKey(e); }}
      onContextMenu={(e) => { e.preventDefault(); onMenu(e.clientX, e.clientY, null); }}
      onDragOver={(e) => {
        if (!hasType(e, TREE_MIME) && !hasType(e, 'Files')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = hasType(e, TREE_MIME) ? 'move' : 'copy';
        setOver(targetOf(e));
      }}
      onDragLeave={(e) => { if (!tree.current!.contains(e.relatedTarget as Node | null)) setOver(null); }}
      onDrop={dropped}>
      {shown.map(({ node: n, fresh }) => {
        const edited = editing?.key === n.key;
        const isOpen = n.folder && open.has(n.key);
        return (
          <div key={fresh ? '\0new' : n.key} className="vc-tree-row" role="treeitem" data-key={n.key} aria-selected={selected.includes(n.key)}
            aria-expanded={n.folder ? isOpen : undefined} data-focus={n.key === focus || undefined} data-over={(n.folder && n.key === over) || undefined}
            style={{ paddingLeft: 6 + n.depth * 14 }} title={n.key} draggable={!edited}
            onClick={(e) => onSelect(n.key, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onMenu(e.clientX, e.clientY, n.key); }}
            onDragStart={(e) => {
              e.dataTransfer.setData(TREE_MIME, JSON.stringify(selected.includes(n.key) ? selected : [n.key]));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => setOver(null)}>
            <span className="vc-tree-chevron" data-open={isOpen || undefined} aria-hidden="true"
              onClick={n.folder ? (e) => { e.stopPropagation(); onToggle(n.key); } : undefined}>{n.folder ? '›' : ''}</span>
            {edited
              ? <RenameField initial={fresh ? '' : n.label} problem={problem} onChange={onEdit} onDone={onEditDone} onCancel={onEditCancel} />
              : <span className="vc-tree-label">{n.label}</span>}
          </div>
        );
      })}
    </div>
  );
}
