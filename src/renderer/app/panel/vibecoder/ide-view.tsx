/** ide-view — la vue IDE des étapes Forme et Modules : à gauche l'arborescence des fichiers (tout déplié,
 *  le pliage tenu ici : on retient les dossiers fermés, ceux d'un nouveau scan s'ouvrent donc seuls), à
 *  droite ce que `children` montre du fichier choisi. Entre les deux, une poignée : glisser (ou ← / →)
 *  change la largeur de l'arborescence (160 px → 60 % de la vue), gardée pour toutes les vues IDE tant
 *  que la page vit (sideWidth), pas enregistrée. Le choix est gardé par son chemin tant qu'il est dans
 *  `files`, sinon c'est le premier (null s'il n'y en a aucun). Le point d'état de chaque fichier est son `state`,
 *  son numéro son `rank` + 1 (l'ordre de génération de son module, rien pour un fichier de la branche).
 *  N'ajoute aucune action : on plie, on choisit.
 *  Ne connaît pas : le pont, les étapes, les actions.
 *  Utilisé par : forme-view, modules-view. */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { fileTree, visibleRows, type IdeFile } from 'core/vibecoder';
import { FileTreeView } from './file-tree-view';
import './ide-view.css';

export type IdeViewProps = {
  files: IdeFile[];
  children(file: IdeFile | null): ReactNode;
};

// La largeur de l'arborescence, commune aux vues IDE de la page (Forme, Modules), bornée à la vue.
let sideWidth = 240;
const clampWidth = (w: number, total: number) => Math.round(Math.max(160, Math.min(w, total * 0.6 || w)));

export function IdeView({ files, children }: IdeViewProps) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidthState] = useState(sideWidth);
  const setWidth = (w: number) => { sideWidth = clampWidth(w, root.current?.getBoundingClientRect().width ?? 0); setWidthState(sideWidth); };
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [chosen, setChosen] = useState<string | null>(null);
  const nodes = useMemo(() => fileTree(files.map((f) => f.path)), [files]);
  const open = useMemo(() => new Set(nodes.filter((n) => n.folder && !closed.has(n.key)).map((n) => n.key)), [nodes, closed]);
  const file = files.find((f) => f.path === chosen) ?? files[0] ?? null;
  const at = (key: string) => files.find((f) => f.path === key);
  const toggle = (key: string) => setClosed((c) => { const next = new Set(c); if (!next.delete(key)) next.add(key); return next; });

  return (
    <div className="vc-ide" ref={root}>
      <div className="vc-ide-side" style={{ width }}>
        <FileTreeView rows={visibleRows(nodes, open)} open={open} selected={file?.path ?? null}
          dot={(key) => at(key)?.state ?? null}
          rank={(key) => { const r = at(key)?.rank; return r == null ? null : r + 1; }}
          onToggle={toggle} onSelect={setChosen} />
      </div>
      <div className="vc-ide-resize" role="separator" aria-orientation="vertical" aria-valuenow={width} tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          const move = (m: PointerEvent) => { const r = root.current?.getBoundingClientRect(); if (r) setWidth(m.clientX - r.left); };
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0;
          if (!step) return;
          e.preventDefault();
          setWidth(width + step);
        }} />
      <div className="vc-ide-main">{children(file)}</div>
    </div>
  );
}
