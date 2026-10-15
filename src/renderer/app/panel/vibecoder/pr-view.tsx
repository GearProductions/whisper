/** pr-view — l'étape PR (Créer) : la PR ouverte (pr.json : numéro, titre,
 *  branche et base du dépôt, lien ouvert dans le navigateur) ou l'invitation
 *  à Valider la feature ;
 *  l'état de la CI (ci.md, 💬 par bloc) ou Diagnostiquer la CI.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import type { VibeLang } from 'technicals/bridge';
import { MarkdownView } from './markdown-view';
import { Invite, OutputCard, PrCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';

const fr = {
  noPr: 'Pas encore de PR pour cette branche',
  noPrHint: 'Valider la feature pousse la branche et ouvre la PR, titre et description selon la convention du projet.',
  noCi: 'CI pas encore lue',
  noCiHint: 'L\'état des vérifications de la PR ; en échec, la cause probable et le correctif proposé.',
  again: 'Relire',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    noPr: 'No PR for this branch yet',
    noPrHint: 'Approve the feature pushes the branch and opens the PR, title and description following the project\'s convention.',
    noCi: 'CI not read yet',
    noCiHint: 'The state of the PR\'s checks; on failure, the probable cause and the proposed fix.',
    again: 'Read again',
  },
};

export function PrView({ view, step, t, act, busy }: StepProps) {
  const s = S[view.lang];
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const quote = action('comment') ? (text: string) => act.prefill('comment', text) : undefined;
  const ci = view.outputs['ci.md'];
  // pr.json ne dit pas les branches : celles du dépôt (la base sans « origin/ »).
  const pr = view.pr && {
    ...view.pr, head: view.pr.head || view.repo?.branch || '', base: view.pr.base || view.repo?.base.replace(/^origin\//, '') || '',
  };
  return (
    <>
      <StepHead step={step} t={t} />
      {pr ? <PrCard pr={pr} lang={view.lang} onOpenLink={act.openLink} /> : (
        <Invite title={s.noPr} text={s.noPrHint}><Run a={action('pr')} busy={busy} onRun={() => act.run('pr')} /></Invite>
      )}
      {ci ? (
        <OutputCard title={t.outputs['ci.md']} file="ci.md" time={ci.time} t={t}
          tools={<Run a={action('ci')} busy={busy} tone="ghost" label={s.again} onRun={() => act.run('ci')} />}>
          <MarkdownView md={ci.text} t={t} onOpenLink={act.openLink} onQuote={quote} />
        </OutputCard>
      ) : pr ? (
        <Invite title={s.noCi} text={s.noCiHint}><Run a={action('ci')} busy={busy} onRun={() => act.run('ci')} /></Invite>
      ) : null}
    </>
  );
}
