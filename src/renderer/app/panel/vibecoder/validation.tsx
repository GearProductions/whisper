/** validation — les validations de l'utilisateur à l'écran : l'état et les
 *  boutons de celle de la note, de la forme, des invariants, des modules (note
 *  0.15.0-ecran-statuts : Valider les invariants, Valider les modules) ou de « Rien à écrire » (étape
 *  Invariants) (Valider ; validée et Annuler ; modifiée depuis et Revalider ;
 *  Relire : Valider ou À revoir), chaque libellé derrière son icône (Icon ok /
 *  ko / warn), le verdict d'un cas d'invariant (deux badges écrits, Validé et
 *  À revoir, gris ; celui donné pressé, allumé de sa couleur, un second clic
 *  l'annule) ; CaseVerdict sert à tout cas ou commit (il ne sait rien d'un
 *  invariant). Sur un « À revoir », onRemark (facultatif) ajoute le bouton
 *  « Ajouter une remarque au brouillon » : il ne fait qu'appeler onRemark.
 *  Le contrôle en trois points (note 0.16.0-controle-en-trois-points) : la note en créateur (onCheck), deux gestes.
 *  Vérifier (l'ancien Revérifier : un bouton ordinaire, couleur neutre, sans coche) ne fait qu'appeler onCheck, toujours
 *  là, relançable ; la course de la vérification (`run`) à côté de lui, comme celle d'un bouton d'action (RunOn,
 *  step-parts : « en cours » et ⏹ → run.onStop ; « en attente » tant qu'elle est en file). Valider la note (ou
 *  Revalider, modifiée depuis la validation), le bouton vert, onMark('ok') : montré seulement quand la dernière
 *  vérification n'a rien trouvé (verified 'clean' ou 'edited'), absent sinon (jamais grisé) ; 'edited' : une ligne dit
 *  que la note a changé depuis la vérification, Valider la note reste, Vérifier à côté. Valider ne lance aucune
 *  vérification, Vérifier ne valide rien. Une étape (forme, invariants, modules) en créateur : son état seul quand
 *  elle est validée — « validée par le système » et ce qui l'a contrôlée (by: 'system' ; forme : les squelettes
 *  posés ; invariants : l'alignement ; modules : la conformité et la preuve par mutation), « validée » à la main
 *  sinon — ; Valider, Revalider et Annuler restent, en discret (un bouton sans couleur ni coche, jamais mis en avant,
 *  jamais grisé). Le relecteur : Valider et À revoir, comme avant.
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : en créateur, MarkControl ne sert plus qu'à la note (Vérifier, Valider la
 *  note, « Note validée » et Annuler) ; la Forme, les invariants, les modules et « Rien à écrire » n'ont plus de
 *  bouton ni d'état ici : leur ✓ est sur le badge de l'étape (StepHead, step-parts), qui le retire ou le rend. Le
 *  relecteur (Valider, À revoir, CaseVerdict) : inchangé.
 *  Ne connaît pas : le pont (rappels passés), le brouillon, ce que porte le cas ; de step-parts, que RunOn.
 *  Utilisé par : note-view ; forme-view, invariants-view (le relecteur). */
import { t } from 'core/vibecoder';
import type { VibeLang, VibeMarkState, VibeNoteCheck } from 'technicals/bridge';
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
  refuse: 'À revoir',
  refuseTitle: 'Refuser : une zone de commentaire s\'ouvre, la remarque va au brouillon de revue',
  undo: 'Annuler',
  undoTitle: 'Oublier cette validation',
  ok: 'Valider', okDone: 'Validé', ko: 'À revoir', koDone: 'Refusé',
  verdictUndo: 'Cliquer de nouveau pour annuler',
  remark: 'Ajouter une remarque au brouillon',
  queued: 'en attente',
  check: 'Vérifier',
  checkTitle: 'Vérifier la conception de la note : ses suggestions vont au questionnaire, rien n\'est validé',
  edited: 'Modifiée depuis la vérification',
  editedTitle: 'La note a changé depuis la dernière vérification : vérifiez-la de nouveau, ou validez-la telle quelle',
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
    refuse: 'Needs rework',
    refuseTitle: 'Reject: a comment box opens, the remark goes to the review draft',
    undo: 'Undo',
    undoTitle: 'Forget this approval',
    ok: 'Approve', okDone: 'Approved', ko: 'Needs rework', koDone: 'Rejected',
    verdictUndo: 'Click again to undo',
    remark: 'Add a remark to the draft',
    queued: 'queued',
    check: 'Check',
    checkTitle: 'Check the note\'s design: its suggestions go to the questions, nothing is approved',
    edited: 'Changed since the check',
    editedTitle: 'The note changed since the last check: check it again, or approve it as it is',
  },
};

// run : la course design-check de la note (en cours, attend une autorisation, arrêtée ; queued : en file) ; absent : aucune.
type DesignRun = { state: 'running' | 'asking' | 'stopped' | 'queued'; onStop?(): void };
type MarkProps = { what: What; state: VibeMarkState; review: boolean; lang: VibeLang; onMark(v: Verdict): void; onRemark?(): void; run?: DesignRun;
  by?: 'system';      // une étape validée par le système (VibeStepCheck.by) ; absent : à la main
  onCheck?(): void;   // la note en créateur : Vérifier (lance la vérification de conception, ne valide rien) ; absent : pas de Vérifier
  verified?: VibeNoteCheck | null;   // avec onCheck : ce qu'a rendu la dernière vérification ; null ou absent : pas de Valider la note
};

// La course de la vérification, comme celle d'une action (step-parts) ; « en attente » : pas encore partie, rien à arrêter.
function Course({ run, lang }: { run?: DesignRun; lang: VibeLang }) {
  if (!run) return null;
  return run.state === 'queued' ? <span className="vc-run-on">{S[lang].queued}</span> : <RunOn state={run.state} t={t(lang)} onStop={run.onStop} />;
}

// La validation de la note, d'une étape ou de « Rien à écrire ». Relire : un verdict, Valider ou À revoir.
// Une étape en créateur (forme, invariants, modules) : Valider en discret, jamais grisé ; validée par le système, elle le dit.
export function MarkControl({ what, state, review, lang, onMark, onRemark, run, by, onCheck, verified }: MarkProps) {
  const s = S[lang];
  const tt = t(lang);
  const quiet = !review && what !== 'note' && what !== 'nothing';
  const label = state === 'changed' ? s.revalidate : s.validate[what];
  const refuse = review ? <button type="button" className="vc-vbtn" data-v="ko" title={s.refuseTitle} onClick={() => onMark('ko')}><Icon name="ko" />{s.refuse}</button> : null;
  if (state === 'ok' || state === 'ko') {
    const step = what === 'forme' || what === 'invariants' || what === 'modules' ? what : null;
    const system = state === 'ok' && by === 'system' && step !== null;
    return (
      <span className="vc-vmark">
        <span className="vc-vstate" data-state={state}><Icon name={state} />{system ? tt.stepCheck.system : state === 'ok' ? s.done[what] : s.refused[what]}</span>
        {system ? <span className="vc-vby">{tt.systemCheck[step!]}</span> : null}
        {state === 'ko' && onRemark ? <button type="button" className="vc-vundo" onClick={onRemark}>{s.remark}</button> : null}
        <button type="button" className="vc-vundo" title={s.undoTitle} onClick={() => onMark(null)}>{s.undo}</button>
      </span>
    );
  }
  const noteCheck = onCheck && !review && what === 'note'; // la note en créateur : Vérifier, puis Valider la note si la vérification n'a rien trouvé
  const validate = (
    <button type="button" className={quiet ? 'vc-vbtn vc-vbtn-plain' : 'vc-vbtn'} data-v={quiet ? undefined : 'ok'} title={s.validateTitle} onClick={() => onMark('ok')}>
      {quiet ? null : <Icon name="ok" />}{label}
    </button>
  );
  return (
    <span className="vc-vmark">
      {state === 'changed' ? <span className="vc-vstate" data-state="changed" title={s.changedTitle}><Icon name="warn" />{s.changed}</span> : null}
      {noteCheck ? (
        <>
          {verified === 'edited' ? <span className="vc-vstate" data-state="changed" title={s.editedTitle}><Icon name="warn" />{s.edited}</span> : null}
          <button type="button" className="vc-vbtn vc-vbtn-plain" title={s.checkTitle} onClick={onCheck}>{s.check}</button>
          <Course run={run} lang={lang} />
          {verified ? validate : null}
        </>
      ) : (
        <>
          {validate}
          <Course run={run} lang={lang} />
        </>
      )}
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
