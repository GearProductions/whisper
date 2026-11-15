/** validation — les validations de l'utilisateur à l'écran : l'état et les
 *  boutons de celle de la note, de la forme, des invariants, des modules (note
 *  0.15.0-ecran-statuts : Valider les invariants, Valider les modules) ou de « Rien à écrire » (étape
 *  Invariants) (Valider ; validée et Annuler ; modifiée depuis et Revalider ;
 *  Relire : Valider ou À revoir ; la note en créateur (onRecheck) : pas vérifiée,
 *  Valider et vérifier ; vérifiée, Revérifier d'abord, en couleur neutre, sans coche (il ne fait
 *  qu'appeler onRecheck), puis Revalider ; `run` : la course de la vérification, à côté du bouton,
 *  comme celle d'un bouton d'action (RunOn, step-parts : « en cours » et ⏹ → run.onStop ; « en attente » tant
 *  qu'elle est en file)), chaque libellé derrière son icône (Icon ok /
 *  ko / warn), le verdict d'un cas d'invariant (deux badges écrits, Validé et
 *  À revoir, gris ; celui donné pressé, allumé de sa couleur, un second clic
 *  l'annule) ; CaseVerdict sert à tout cas ou commit (il ne sait rien d'un
 *  invariant). Sur un « À revoir », onRemark (facultatif) ajoute le bouton
 *  « Ajouter une remarque au brouillon » : il ne fait qu'appeler onRemark.
 *  Ne connaît pas : le pont (rappels passés), le brouillon, ce que porte le cas ; de step-parts, que RunOn.
 *  Utilisé par : note-view, forme-view, invariants-view, modules-view, commits-view. */
import { t, waitingFor } from 'core/vibecoder';
import type { VibeLang, VibeMarkState, VibeStepId, VibeView } from 'technicals/bridge';
import { Icon } from './icons';
import { RunOn } from './step-parts';
import './validation.css';

type Verdict = 'ok' | 'ko' | null;
type What = 'note' | 'forme' | 'invariants' | 'modules' | 'nothing';

const fr = {
  validate: { note: 'Valider la note', forme: 'Valider la forme', invariants: 'Valider les invariants', modules: 'Valider les modules', nothing: 'Rien à écrire' } as Record<What, string>,
  done: { note: 'Note validée', forme: 'Forme validée', invariants: 'Invariants validés', modules: 'Modules validés', nothing: 'Rien à écrire : validé' } as Record<What, string>,
  refused: { note: 'Note refusée', forme: 'Forme refusée', invariants: 'Invariants refusés', modules: 'Modules refusés', nothing: 'Rien à écrire : refusé' } as Record<What, string>,
  validateTitle: 'Valider ce contenu tel qu\'il est : un changement ultérieur l\'affichera « modifié depuis »',
  changed: 'Modifiée depuis la validation',
  changedTitle: 'Le contenu a changé depuis la validation : relisez-le, puis revalidez-le',
  revalidate: 'Revalider',
  validateCheck: 'Valider et vérifier',
  recheck: 'Revérifier',
  recheckTitle: 'Relancer la vérification de conception de la note, sans la valider',
  refuse: 'À revoir',
  refuseTitle: 'Refuser : une zone de commentaire s\'ouvre, la remarque va au brouillon de revue',
  undo: 'Annuler',
  undoTitle: 'Oublier cette validation',
  ok: 'Valider', okDone: 'Validé', ko: 'À revoir', koDone: 'Refusé',
  verdictUndo: 'Cliquer de nouveau pour annuler',
  remark: 'Ajouter une remarque au brouillon',
  queued: 'en attente',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    validate: { note: 'Approve the note', forme: 'Approve the shape', invariants: 'Approve the invariants', modules: 'Approve the modules', nothing: 'Nothing to write' },
    done: { note: 'Note approved', forme: 'Shape approved', invariants: 'Invariants approved', modules: 'Modules approved', nothing: 'Nothing to write: approved' },
    refused: { note: 'Note rejected', forme: 'Shape rejected', invariants: 'Invariants rejected', modules: 'Modules rejected', nothing: 'Nothing to write: rejected' },
    validateTitle: 'Approve this content as it is: a later change will show it as « changed since »',
    changed: 'Changed since the approval',
    changedTitle: 'The content changed since the approval: read it again, then approve it again',
    revalidate: 'Approve again',
    validateCheck: 'Approve and check',
    recheck: 'Check again',
    recheckTitle: 'Run the note\'s design check again, without approving it',
    refuse: 'Needs rework',
    refuseTitle: 'Reject: a comment box opens, the remark goes to the review draft',
    undo: 'Undo',
    undoTitle: 'Forget this approval',
    ok: 'Approve', okDone: 'Approved', ko: 'Needs rework', koDone: 'Rejected',
    verdictUndo: 'Click again to undo',
    remark: 'Add a remark to the draft',
    queued: 'queued',
  },
};

// run : la course design-check de la note (en cours, attend une autorisation, arrêtée ; queued : en file) ; absent : aucune.
type DesignRun = { state: 'running' | 'asking' | 'stopped' | 'queued'; onStop?(): void };
type MarkProps = { what: What; state: VibeMarkState; review: boolean; lang: VibeLang; onMark(v: Verdict): void; onRemark?(): void; checked?: boolean; onRecheck?(): void; run?: DesignRun;
  waiting?: string;   // la raison qui grise Valider (l'étape d'avant n'est pas validée) ; absent : actif
};

// La course de la vérification, comme celle d'une action (step-parts) ; « en attente » : pas encore partie, rien à arrêter.
function Course({ run, lang }: { run?: DesignRun; lang: VibeLang }) {
  if (!run) return null;
  return run.state === 'queued' ? <span className="vc-run-on">{S[lang].queued}</span> : <RunOn state={run.state} t={t(lang)} onStop={run.onStop} />;
}

// La validation de la note, de la forme ou de « Rien à écrire ». Relire : un verdict, Valider ou À revoir.
export function MarkControl({ what, state, review, lang, onMark, onRemark, checked, onRecheck, run, waiting }: MarkProps) {
  const s = S[lang];
  const check = what === 'note' && !!onRecheck; // la note, en créateur : sa vérification de conception
  const label = check && !checked ? s.validateCheck : state === 'changed' || check ? s.revalidate : s.validate[what];
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
      {check && checked ? <><button type="button" className="vc-vbtn vc-vbtn-plain" title={s.recheckTitle} onClick={onRecheck}>{s.recheck}</button><Course run={run} lang={lang} /></> : null}
      {waiting ? <span className="vc-vstate" data-state="waiting">{waiting}</span> : null}
      <button type="button" className="vc-vbtn" data-v="ok" title={waiting ?? s.validateTitle} disabled={!!waiting} onClick={() => onMark('ok')}>
        <Icon name="ok" />{label}
      </button>
      {check && !checked ? <Course run={run} lang={lang} /> : null}
      {refuse}
    </span>
  );
}

// Le verdict d'un cas : deux badges gris, celui donné allumé (pressé) ; un second clic l'annule.
// off : la raison qui grise Validé et À revoir (une lecture périmée : relire d'abord) ; absent : actifs.
export function CaseVerdict({ state, lang, onMark, onRemark, off }: { state: VibeMarkState; lang: VibeLang; onMark(v: Verdict): void; onRemark?(): void; off?: string }) {
  const s = S[lang];
  return (
    <span className="vc-verdict" role="group">
      {(['ok', 'ko'] as const).map((v) => (
        <button key={v} type="button" className={`vc-verdict-${v}`} aria-pressed={state === v} disabled={!!off}
          title={off ?? (state === v ? `${s[`${v}Done`]} — ${s.verdictUndo}` : s[v])} onClick={() => onMark(state === v ? null : v)}>
          {v === 'ok' ? s.okDone : s.ko}
        </button>
      ))}
      {state === 'ko' && onRemark ? <button type="button" onClick={onRemark}>{s.remark}</button> : null}
    </span>
  );
}

// La raison qui grise Valider d'une étape : l'étape d'avant qu'elle attend (waitingFor), en toutes lettres ; undefined : rien.
export function waitText(view: Pick<VibeView, 'steps' | 'lang'>, step: VibeStepId): string | undefined {
  const prev = waitingFor(view.steps, step);
  const tt = t(view.lang);
  return prev ? tt.waitingFor(tt.steps[prev]) : undefined;
}
