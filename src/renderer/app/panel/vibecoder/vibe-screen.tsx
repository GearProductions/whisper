/** vibe-screen — l'écran Vibe (Créer), à la place du parcours et de l'étape :
 *  le fil d'Ariane, la zone Vibe (le texte du bandeau ; sans note, le champ
 *  de la note ; un bouton par action de vibeScreenActions — Rédiger la note
 *  sans note, Valider et développer, base et release — chacune telle que le
 *  relevé la donne : grisée, en cours, mise en avant),
 *  puis, la note posée, la vue Note (la note, ses questions et Envoyer les
 *  réponses).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import { vibeScreenActions } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { Breadcrumb } from './breadcrumb';
import { NoteView } from './note-view';
import { Run, StepField } from './step-parts';
import type { StepProps } from './step-views';

const S: Record<VibeLang, string> = {
  fr: 'Mode Vibe : la demande, puis les questions de la note ; ensuite l\'agent développe seul, vous testez et approuvez à la fin.',
  en: 'Vibe mode: the request, then the note\'s questions; then the agent develops on its own, you test and approve at the end.',
};

// p : les props de l'étape Note (son champ porte la demande de Rédiger la note).
export function VibeScreen(p: StepProps) {
  const { view, t, act, busy } = p;
  const run = (id: string) => {
    const a = view.actions.find((x) => x.id === id);
    return <Run key={id} a={a} busy={busy} tone={a?.primary ? 'accent' : 'plain'} onRun={(x) => act.run(id, x)} />;
  };
  return (
    <>
      <Breadcrumb view={view} t={t} />
      <div className="vc-vibe-banner" role="note">
        <span aria-hidden="true">⚡</span>{S[view.lang]}
        {view.note ? null : <StepField name="note" text={p.text} setText={p.setText} hint={t.vibeFieldHint} />}
        {vibeScreenActions(view).map(run)}
      </div>
      {view.note ? <NoteView {...p} /> : null}
    </>
  );
}
