/** header — l'en-tête du panneau : pastille, intitulé, agent et dossier, jauge
 *  du contexte, Historique (agrandi), agrandir / réduire, fermer.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import type { CSSProperties, RefObject } from 'react';
import { gauge, titleOf } from 'core/conversation';
import type { Thread } from 'technicals/bridge';

type Props = {
  data: Thread | null;
  onGauge(): void;
  onHistory(): void;
  onMode(): void;
  onHide(): void;
  ref: RefObject<HTMLElement | null>;
};

export function Header({ data, onGauge, onHistory, onMode, onHide, ref }: Props) {
  const g = gauge(data?.context);
  const compact = data?.mode === 'compact';
  return (
    <header ref={ref}>
      <span id="dot" />
      <div id="heading">
        <div id="title">{data && titleOf(data)}</div>
        <div id="sub">{data && (data.dictation ? 'Aucun agent sélectionné : le texte va au curseur' : `${data.name} · ${data.dir}`)}</div>
      </div>
      <button id="context-button" type="button" title={g.title} data-level={g.level}
        style={{ '--pct': g.pct } as CSSProperties} onClick={onGauge}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><circle className="ring-bg" cx="18" cy="18" r="15" /><circle className="ring" cx="18" cy="18" r="15" /></svg>
        <span id="context-label">{g.label}</span>
      </button>
      {/* L'historique : en agrandi seulement. */}
      <button id="history-button" type="button" title="Les conversations passées de ce dossier" hidden={compact} onClick={onHistory}>🕘 Historique</button>
      <button id="mode" type="button" onClick={onMode}
        title={data ? (compact ? 'Agrandir : toute la conversation et l\'historique' : 'Réduire : le dernier échange') : undefined}>
        {data && (compact ? '⤢' : '⤡')}
      </button>
      <button id="hide" type="button" title="Fermer" aria-label="Fermer" onClick={onHide}>×</button>
    </header>
  );
}
