/** case-link — sous Garantit d'une carte d'invariant, ce que le cas garde (caseLink, calculé par l'appelant) :
 *  chaque ligne de la note citée, un lien (onGo(ligne) : passer à l'étape Note sur elle ; sans onGo, du texte) ;
 *  un I-… : son numéro, sans lien ; rien : « non rattaché ». stale : la lecture est périmée, le bloc l'est aussi
 *  (data-stale, grisé).
 *  Ne connaît pas : la note, la lecture, le pont.
 *  Utilisé par : invariants-view. */
import type { CaseLink as Link } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';

const S: Record<VibeLang, { keeps: string; none: string; stale: string }> = {
  fr: { keeps: 'Garde', none: 'non rattaché', stale: 'lecture périmée' },
  en: { keeps: 'Keeps', none: 'not attached', stale: 'outdated reading' },
};

export function CaseLinks({ link, stale, lang, onGo }: { link: Link; stale: boolean; lang: VibeLang; onGo?(line: string): void }) {
  const s = S[lang];
  return (
    <div className="vc-case-row vc-case-keeps" data-stale={stale || undefined} title={stale ? s.stale : undefined}>
      <span className="vc-case-label">{s.keeps}</span>
      <ul>
        {link.kind === 'note' ? link.lines.map((l) => (
          <li key={l}>{onGo ? <button type="button" className="vc-case-go" onClick={() => onGo(l)}>{l}</button> : l}</li>
        )) : link.kind === 'spec' ? <li>{link.ids.join(', ')}</li> : <li className="vc-case-none">{s.none}</li>}
      </ul>
    </div>
  );
}
