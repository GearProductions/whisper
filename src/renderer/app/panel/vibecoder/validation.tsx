/** validation — les validations de l'utilisateur à l'écran : l'état et les
 *  boutons de celle de la note, de la forme ou de « Rien à écrire » (étape
 *  Invariants) (Valider ; validée et Annuler ; modifiée depuis et Revalider ;
 *  Relire : Valider ou À revoir), chaque libellé derrière son icône (Icon ok /
 *  ko / warn), le verdict d'un cas d'invariant (deux badges écrits, Validé et
 *  À revoir, gris ; celui donné pressé, allumé de sa couleur, un second clic
 *  l'annule) ; CaseVerdict sert à tout cas ou commit (il ne sait rien d'un
 *  invariant). Sur un « À revoir », onRemark (facultatif) ajoute le bouton
 *  « Ajouter une remarque au brouillon » : il ne fait qu'appeler onRemark.
 *  Ne connaît pas : le pont (rappels passés), le brouillon, ce que porte le cas.
 *  Utilisé par : note-view, forme-view, invariants-view, commits-view. */
import type { VibeLang, VibeMarkState } from 'technicals/bridge';
import { Icon } from './icons';
import './validation.css';

type Verdict = 'ok' | 'ko' | null;
type What = 'note' | 'forme' | 'nothing';

const fr = {
  validate: { note: 'Valider la note', forme: 'Valider la forme', nothing: 'Rien à écrire' } as Record<What, string>,
  done: { note: 'Note validée', forme: 'Forme validée', nothing: 'Rien à écrire : validé' } as Record<What, string>,
  refused: { note: 'Note refusée', forme: 'Forme refusée', nothing: 'Rien à écrire : refusé' } as Record<What, string>,
  validateTitle: 'Valider ce contenu tel qu\'il est : un changement ultérieur l\'affichera « modifié depuis »',
  changed: 'Modifiée depuis la validation',
  changedTitle: 'Le contenu a changé depuis la validation : relisez-le, puis revalidez-le',
  revalidate: 'Revalider',
  refuse: 'À revoir',
  refuseTitle: 'Refuser : une zone de commentaire s\'ouvre, la remarque va au brouillon de revue',
  undo: 'Annuler',
  undoTitle: 'Oublier cette validation',
  ok: 'Valider', okDone: 'Validé', ko: 'À revoir', koDone: 'Refusé',
  verdictUndo: 'Cliquer de nouveau pour annuler',
  remark: 'Ajouter une remarque au brouillon',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    validate: { note: 'Approve the note', forme: 'Approve the shape', nothing: 'Nothing to write' },
    done: { note: 'Note approved', forme: 'Shape approved', nothing: 'Nothing to write: approved' },
    refused: { note: 'Note rejected', forme: 'Shape rejected', nothing: 'Nothing to write: rejected' },
    validateTitle: 'Approve this content as it is: a later change will show it as « changed since »',
    changed: 'Changed since the approval',
    changedTitle: 'The content changed since the approval: read it again, then approve it again',
    revalidate: 'Approve again',
    refuse: 'Needs rework',
    refuseTitle: 'Reject: a comment box opens, the remark goes to the review draft',
    undo: 'Undo',
    undoTitle: 'Forget this approval',
    ok: 'Approve', okDone: 'Approved', ko: 'Needs rework', koDone: 'Rejected',
    verdictUndo: 'Click again to undo',
    remark: 'Add a remark to the draft',
  },
};

type MarkProps = { what: What; state: VibeMarkState; review: boolean; lang: VibeLang; onMark(v: Verdict): void; onRemark?(): void };

// La validation de la note, de la forme ou de « Rien à écrire ». Relire : un verdict, Valider ou À revoir.
export function MarkControl({ what, state, review, lang, onMark, onRemark }: MarkProps) {
  const s = S[lang];
  const refuse = review ? <button type="button" className="vc-vbtn" data-v="ko" title={s.refuseTitle} onClick={() => onMark('ko')}><Icon name="ko" />{s.refuse}</button> : null;
  if (state === 'ok' || state === 'ko') {
    return (
      <span className="vc-vmark">
        <span className="vc-vstate" data-state={state}><Icon name={state} />{state === 'ok' ? s.done[what] : s.refused[what]}</span>
        {state === 'ko' && onRemark ? <button type="button" className="vc-vundo" onClick={onRemark}>{s.remark}</button> : null}
        <button type="button" className="vc-vundo" title={s.undoTitle} onClick={() => onMark(null)}>{s.undo}</button>
      </span>
    );
  }
  return (
    <span className="vc-vmark">
      {state === 'changed' ? <span className="vc-vstate" data-state="changed" title={s.changedTitle}><Icon name="warn" />{s.changed}</span> : null}
      <button type="button" className="vc-vbtn" data-v="ok" title={s.validateTitle} onClick={() => onMark('ok')}>
        <Icon name="ok" />{state === 'changed' ? s.revalidate : s.validate[what]}
      </button>
      {refuse}
    </span>
  );
}

// Le verdict d'un cas : deux badges gris, celui donné allumé (pressé) ; un second clic l'annule.
export function CaseVerdict({ state, lang, onMark, onRemark }: { state: VibeMarkState; lang: VibeLang; onMark(v: Verdict): void; onRemark?(): void }) {
  const s = S[lang];
  return (
    <span className="vc-verdict" role="group">
      {(['ok', 'ko'] as const).map((v) => (
        <button key={v} type="button" className={`vc-verdict-${v}`} aria-pressed={state === v}
          title={state === v ? `${s[`${v}Done`]} — ${s.verdictUndo}` : s[v]} onClick={() => onMark(state === v ? null : v)}>
          {v === 'ok' ? s.okDone : s.ko}
        </button>
      ))}
      {state === 'ko' && onRemark ? <button type="button" onClick={onRemark}>{s.remark}</button> : null}
    </span>
  );
}
