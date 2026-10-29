/** icons — le petit jeu d'icônes de VibeCoder (à la place des emojis et
 *  caractères Unicode, rendus différemment selon le système) : des tracés
 *  16×16 à traits fins, monochromes (currentColor), écrits ici une seule fois
 *  (PATHS). Icon : le <svg> en React ; iconElement : le même dessin hors React
 *  (createElementNS), pour les boutons de ligne de CodeMirror ; IconButton :
 *  le bouton-icône (classe vc-tool, vibecoder.css), son libellé en title et
 *  aria-label, pressed → aria-pressed, l'événement du clic passé à onClick.
 *  Ne connaît pas : le pont, le relevé, le métier ; aucune dépendance.
 *  Utilisé par : les vues de vibecoder, note-editor ; components (composer :
 *  attach, send). */
import type { MouseEvent } from 'react';

export type IconName = 'close' | 'open' | 'external' | 'diff' | 'comment' | 'ok' | 'ko' | 'warn'
  | 'stop' | 'play' | 'refresh' | 'edit' | 'pull' | 'push' | 'rebase'
  | 'attach' | 'send';

const X = ['M4 4l8 8', 'M12 4l-8 8'];
const PATHS: Record<IconName, string[]> = {
  close: X,
  ko: X,
  open: ['M4 2h5l3 3v9H4z', 'M9 2v3h3'],
  external: ['M9 3h4v4', 'M13 3L7 9', 'M11 9v4H3V5h4'],
  diff: ['M5 2.5v5', 'M2.5 5h5', 'M8.5 12h5'],
  comment: ['M2.5 3h11v7.5h-6l-3 2.5v-2.5h-2z'],
  ok: ['M3 8.5l3 3 7-7'],
  warn: ['M8 2l6.5 11.5h-13z', 'M8 6.5v3', 'M8 11.5v.5'],
  stop: ['M4 4h8v8H4z'],
  play: ['M5 3l8 5-8 5z'],
  refresh: ['M13 8a5 5 0 1 1-1.5-3.5', 'M12 2v3h-3'],
  edit: ['M10.5 2.5l3 3L6 13H3v-3z'],
  pull: ['M8 2v9', 'M4.5 7.5L8 11l3.5-3.5', 'M3 14h10'],
  push: ['M8 14V5', 'M4.5 8.5L8 5l3.5 3.5', 'M3 2h10'],
  rebase: ['M4 14V2', 'M4 10c0-4 8-3 8-7', 'M9.5 3.5L12 2.5l1 2.5'],
  attach: ['M13.5 7.5l-5.6 5.6a3.5 3.5 0 0 1-5-5l5.9-5.9a2.3 2.3 0 0 1 3.3 3.3L6.2 11.4a1.1 1.1 0 0 1-1.6-1.6l5.2-5.2'],
  send: ['M3 8h10', 'M9 4l4 4-4 4'],
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

const NS = 'http://www.w3.org/2000/svg';

export function iconElement(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  const attrs = { viewBox: '0 0 16 16', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  for (const d of PATHS[name]) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function IconButton({ icon, label, onClick, disabled, pressed, className }: {
  icon: IconName; label: string; onClick(e: MouseEvent): void; disabled?: boolean; pressed?: boolean; className?: string;
}) {
  return (
    <button type="button" className={className ? `vc-tool ${className}` : 'vc-tool'} title={label} aria-label={label}
      aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}
