/** validation — les validations de l'utilisateur à l'écran : l'état et les
 *  boutons de celle de la note ou de la forme (✓ Valider ; validée et
 *  Annuler ; modifiée depuis et Revalider ; Relire : ✓ ou ✗), le verdict d'un
 *  cas d'invariant (✓ / ✗, celui donné pressé, un second clic l'annule), ce
 *  que la prochaine étape propose quand l'étape en cours attend une
 *  validation, et la pastille Fable des étapes Note et Forme (Créer).
 *  Ne connaît pas : le pont (rappels passés).
 *  Utilisé par : note-view, forme-view, invariants-view, vibe-coder (prochaine étape). */
import type { Awaiting } from 'core/vibecoder';
import type { VibeLang, VibeMarkState, VibeStepId } from 'technicals/bridge';
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
  you: 'vous',
  hint: {
    note: 'La note est rédigée, sans question ouverte : relisez-la, puis validez-la.',
    forme: 'Relisez les modules et leurs contrats, puis validez la forme.',
    noteReview: 'Relisez la note de la PR : ✓ pour la valider, ou ✗ dans la note (au brouillon de revue).',
  },
  cases: (n: number) => (n > 1 ? `Voir les ${n} cas à valider` : 'Voir le cas à valider'),
  casesHere: (n: number) => `${n} cas à valider : ✓ ou ✗ sur chaque carte, ou « Tout valider » sur un fichier sans point d'attention.`,
  casesHint: 'Les invariants sont lus en pseudo-code : chaque cas attend votre verdict.',
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
    you: 'you',
    hint: {
      note: 'The note is written, with no open question: read it, then approve it.',
      forme: 'Read the modules and their contracts, then approve the shape.',
      noteReview: 'Read the PR\'s note: ✓ to approve it, or ✗ in the note (to the review draft).',
    },
    cases: (n) => (n > 1 ? `See the ${n} cases to approve` : 'See the case to approve'),
    casesHere: (n) => `${n} case${n > 1 ? 's' : ''} to approve: ✓ or ✗ on each card, or « Approve all » on a file with no warning.`,
    casesHint: 'The invariants are read as pseudo-code: each case awaits your verdict.',
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

type AwaitProps = {
  wait: Awaiting;
  review: boolean;
  lang: VibeLang;
  shown: VibeStepId | null;    // l'étape affichée
  onMark(target: What): void;
  onPick(id: VibeStepId): void;
};

// À la place de « Rien à lancer » : la validation qu'attend l'étape en cours, au format du bouton principal.
export function AwaitValidation({ wait, review, lang, shown, onMark, onPick }: AwaitProps) {
  const s = S[lang];
  if (wait.kind === 'cases' && shown === 'invariants') return <div className="vc-next-none vc-await-here">{s.casesHere(wait.count)}</div>;
  const cases = wait.kind === 'cases';
  return (
    <>
      <button type="button" className="vc-primary vc-await" data-kind={wait.kind}
        onClick={() => (cases ? onPick('invariants') : onMark(wait.kind))}>
        <span className="vc-label">{cases ? s.cases(wait.count) : s.validate[wait.kind]}</span>
        <span className="vc-who">{s.you}</span>
      </button>
      <div className="vc-next-why">{cases ? s.casesHint : review ? s.hint.noteReview : s.hint[wait.kind]}</div>
    </>
  );
}
