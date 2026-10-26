/** diff-view — un diff de lignes affiché (DiffLine[], de lineDiff) : replié
 *  autour des changements (foldDiff), ajouts en vert, retraits barrés, en
 *  texte, jamais en HTML (I-40). Le diff brut de la note (Voir les
 *  modifications) ; celui d'un fichier de module : module-diff-view.
 *  Ne connaît pas : le pont, le relevé.
 *  Utilisé par : note-view. */
import { useMemo, type ReactElement } from 'react';
import { foldDiff, type DiffLine } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import './diff-view.css';

const S: Record<VibeLang, { skip: (n: number) => string }> = {
  fr: { skip: (n) => `⋯ ${n} ligne${n > 1 ? 's' : ''} inchangée${n > 1 ? 's' : ''}` },
  en: { skip: (n) => `⋯ ${n} unchanged line${n === 1 ? '' : 's'}` },
};

export function DiffView({ diff, lang }: { diff: DiffLine[]; lang: VibeLang }): ReactElement {
  const folded = useMemo(() => foldDiff(diff), [diff]);
  return (
    <div className="vc-rawdiff scroll">
      {folded.map((l, i) => {
        if (l.kind === 'skip') return <div key={i} className="vc-dl-skip">{S[lang].skip(l.count)}</div>;
        const Line = l.kind === 'added' ? 'ins' : l.kind === 'removed' ? 'del' : 'div';
        return (
          <Line key={i} className="vc-dl" data-kind={l.kind}>
            <span className="vc-dl-sign" aria-hidden="true">{l.kind === 'added' ? '+' : l.kind === 'removed' ? '−' : ' '}</span>
            <span className="vc-dl-text">{l.text || ' '}</span>
          </Line>
        );
      })}
    </div>
  );
}
