/** ide-view — la vue IDE des étapes Forme et Modules : à gauche l'arborescence des fichiers (tout déplié,
 *  le pliage tenu ici : on retient les dossiers fermés, ceux d'un nouveau scan s'ouvrent donc seuls), à
 *  droite ce que `children` montre du fichier choisi. Le choix est gardé par son chemin tant qu'il est dans
 *  `files`, sinon c'est le premier (null s'il n'y en a aucun). Le point d'état de chaque fichier est son `state`.
 *  N'ajoute aucune action : on plie, on choisit.
 *  Ne connaît pas : le pont, les étapes, les actions.
 *  Utilisé par : forme-view, modules-view. */
import { useMemo, useState, type ReactNode } from 'react';
import { fileTree, visibleRows, type IdeFile } from 'core/vibecoder';
import { FileTreeView } from './file-tree-view';
import './ide-view.css';

export type IdeViewProps = {
  files: IdeFile[];
  children(file: IdeFile | null): ReactNode;
};

export function IdeView({ files, children }: IdeViewProps) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [chosen, setChosen] = useState<string | null>(null);
  const nodes = useMemo(() => fileTree(files.map((f) => f.path)), [files]);
  const open = useMemo(() => new Set(nodes.filter((n) => n.folder && !closed.has(n.key)).map((n) => n.key)), [nodes, closed]);
  const file = files.find((f) => f.path === chosen) ?? files[0] ?? null;
  const toggle = (key: string) => setClosed((c) => { const next = new Set(c); if (!next.delete(key)) next.add(key); return next; });

  return (
    <div className="vc-ide">
      <div className="vc-ide-side">
        <FileTreeView rows={visibleRows(nodes, open)} open={open} selected={file?.path ?? null}
          dot={(key) => files.find((f) => f.path === key)?.state ?? null}
          onToggle={toggle} onSelect={setChosen} />
      </div>
      <div className="vc-ide-main">{children(file)}</div>
    </div>
  );
}
