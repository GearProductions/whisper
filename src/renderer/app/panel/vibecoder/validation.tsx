/** validation — les validations de l'utilisateur à l'écran : l'état et les
 *  boutons de celle de la note ou de la forme (✓ Valider ; validée et
 *  Annuler ; modifiée depuis et Revalider ; Relire : ✓ ou ✗), le verdict d'un
 *  cas d'invariant (✓ / ✗, celui donné pressé, un second clic l'annule), et
 *  la pastille Fable des étapes Note et Forme (Créer).
 *  Ne connaît pas : le pont (rappels passés).
 *  Utilisé par : note-view, forme-view, invariants-view. */
import type { VibeLang, VibeMarkState } from 'technicals/bridge';
import './validation.css';

type Verdict = 'ok' | 'ko' | null;
type What = 'note' | 'forme';

const fr = {
  validate: { note: '✓ Valider la note', forme: '✓ Valider la forme' } as Record<What, string>,
  done: { note: 'Note validée', forme: 'Forme validée' } as Record<What, string>,
  refused: { note: 'Note refusée', forme: 'Forme refusée' } as Record<What, string>,
  validateTitle: 'Valider ce contenu tel qu\'il est : un changement ultérieur l\'affichera « modifié depuis »',
  changed: 'Modifiée depuis la validation',
  changedTitle: 'Le contenu a changé depuis la validation : relisez-le, puis revalidez-le',
  revalidate: '✓ Revalider',
  refuse: '✗ À revoir',
  refuseTitle: 'Refuser : une zone de commentaire s\'ouvre, la remarque va au brouillon de revue',
  undo: 'Annuler',
  undoTitle: 'Oublier cette validation',
  ok: '✓ Valider', okDone: '✓ Validé', ko: '✗ À revoir', koDone: '✗ Refusé',
  verdictUndo: 'Cliquer de nouveau pour annuler',
  fable: 'Fable · élevé',
  pricier: 'plus cher',
  fableTitle: 'Passer l\'agent sur Fable, effort élevé, pour rédiger la note et la forme : le plus soigneux, mais plus cher. Comme son menu.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    validate: { note: '✓ Approve the note', forme: '✓ Approve the shape' },
    done: { note: 'Note approved', forme: 'Shape approved' },
    refused: { note: 'Note rejected', forme: 'Shape rejected' },
    validateTitle: 'Approve this content as it is: a later change will show it as « changed since »',
    changed: 'Changed since the approval',
    changedTitle: 'The content changed since the approval: read it again, then approve it again',
    revalidate: '✓ Approve again',
    refuse: '✗ Needs rework',
    refuseTitle: 'Reject: a comment box opens, the remark goes to the review draft',
    undo: 'Undo',
    undoTitle: 'Forget this approval',
    ok: '✓ Approve', okDone: '✓ Approved', ko: '✗ Needs rework', koDone: '✗ Rejected',
    verdictUndo: 'Click again to undo',
    fable: 'Fable · high',
    pricier: 'pricier',
    fableTitle: 'Switch the agent to Fable, high effort, to write the note and the shape: the most careful, but pricier. As its menu does.',
  },
};

type MarkProps = { what: What; state: VibeMarkState; review: boolean; lang: VibeLang; onMark(v: Verdict): void };

// La validation de la note ou de la forme. Relire : un verdict, ✓ ou ✗.
export function MarkControl({ what, state, review, lang, onMark }: MarkProps) {
  const s = S[lang];
  const refuse = review ? <button type="button" className="vc-vbtn" data-v="ko" title={s.refuseTitle} onClick={() => onMark('ko')}>{s.refuse}</button> : null;
  if (state === 'ok' || state === 'ko') {
    return (
      <span className="vc-vmark">
        <span className="vc-vstate" data-state={state}>{state === 'ok' ? `✓ ${s.done[what]}` : `✗ ${s.refused[what]}`}</span>
        <button type="button" className="vc-vundo" title={s.undoTitle} onClick={() => onMark(null)}>{s.undo}</button>
      </span>
    );
  }
  return (
    <span className="vc-vmark">
      {state === 'changed' ? <span className="vc-vstate" data-state="changed" title={s.changedTitle}>{`⚠ ${s.changed}`}</span> : null}
      <button type="button" className="vc-vbtn" data-v="ok" title={s.validateTitle} onClick={() => onMark('ok')}>
        {state === 'changed' ? s.revalidate : s.validate[what]}
      </button>
      {refuse}
    </span>
  );
}

// Le verdict d'un cas : ✓ et ✗, celui donné pressé ; un second clic l'annule.
export function CaseVerdict({ state, lang, onMark }: { state: VibeMarkState; lang: VibeLang; onMark(v: Verdict): void }) {
  const s = S[lang];
  return (
    <span className="vc-verdict" role="group">
      <button type="button" data-v="ok" aria-pressed={state === 'ok'} title={state === 'ok' ? s.verdictUndo : undefined}
        onClick={() => onMark(state === 'ok' ? null : 'ok')}>{state === 'ok' ? s.okDone : s.ok}</button>
      <button type="button" data-v="ko" aria-pressed={state === 'ko'} title={state === 'ko' ? s.verdictUndo : undefined}
        onClick={() => onMark(state === 'ko' ? null : 'ko')}>{state === 'ko' ? s.koDone : s.ko}</button>
    </span>
  );
}

// Créer, étapes Note et Forme, agent pas sur Fable : y passer, effort élevé (un clic de l'utilisateur, jamais seul).
export function FablePill({ lang, onPick }: { lang: VibeLang; onPick(): void }) {
  const s = S[lang];
  return (
    <button type="button" className="vc-fable" title={s.fableTitle} onClick={onPick}>
      <span aria-hidden="true">✦</span>{s.fable}<span className="vc-fable-cost">{s.pricier}</span>
    </button>
  );
}
