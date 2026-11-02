/** pr-view — l'étape PR, pour les deux rôles (view.flow).
 *  Créateur : la PR de la branche (lue par gh, sinon pr.json : numéro, titre,
 *  branche et base du dépôt, lien ouvert dans le navigateur) ou l'invitation
 *  à Valider la feature ; l'état de la CI (ci.md, 💬 par bloc, Relancer) ou
 *  Diagnostiquer la CI ; Me retirer de la PR (unassign-pr) si le relevé la montre.
 *  Relecteur : la carte de la PR suivie, S'assigner la PR (assign-pr) si le
 *  relevé la montre, puis le brouillon de revue (draft-view) — aucune action
 *  qui édite, génère ou commite. S'assigner et s'en retirer : actions directes
 *  seulement (F-114), au clic ; le principal prend le numéro et le login de son
 *  relevé, rien n'est envoyé. L'en-tête est rendu ici (Publier, au relecteur,
 *  est dans draft-view : `own`).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import type { VibeLang } from 'technicals/bridge';
import { DraftView } from './draft-view';
import { MarkdownView } from './markdown-view';
import { Invite, OutputCard, PrCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';

const fr = {
  noPr: 'Pas encore de PR pour cette branche',
  noPrHint: 'Valider la feature pousse la branche et ouvre la PR, titre et description selon la convention du projet.',
  noCi: 'CI pas encore lue',
  noCiHint: 'L\'état des vérifications de la PR ; en échec, la cause probable et le correctif proposé.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    noPr: 'No PR for this branch yet',
    noPrHint: 'Approve the feature pushes the branch and opens the PR, title and description following the project\'s convention.',
    noCi: 'CI not read yet',
    noCiHint: 'The state of the PR\'s checks; on failure, the probable cause and the proposed fix.',
  },
};

export function PrView(p: StepProps) {
  const { view, t, act, busy } = p;
  const s = S[view.lang];
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const quote = action('comment') ? (text: string) => act.prefill('comment', text) : undefined;
  const ci = view.outputs['ci.md'];
  // pr.json ne dit pas les branches (gh, si) : celles du dépôt (la base sans « origin/ »).
  const pr = view.pr && {
    ...view.pr, head: view.pr.head || view.repo?.branch || '', base: view.pr.base || view.repo?.base.replace(/^origin\//, '') || '',
  };
  // S'assigner la PR / Me retirer de la PR : un clic, direct, sans argument (le principal lit son relevé).
  const assigns = ['assign-pr', 'unassign-pr'].flatMap((id) => { const a = action(id); return a && !a.hidden ? [a] : []; });
  const assignBar = assigns.length ? (
    <div className="vc-step-acts">{assigns.map((a) => <Run key={a.id} a={a} busy={busy} onRun={(x) => act.run(a.id, x)} />)}</div>
  ) : null;
  if (view.flow === 'review') {
    return (
      <>
        <StepHead p={p} own={['publish']} />
        {view.pr ? <PrCard pr={view.pr} lang={view.lang} onOpenLink={act.openLink} /> : null}
        {assignBar}
        <DraftView {...p} />
      </>
    );
  }
  return (
    <>
      <StepHead p={p} own={[...(pr ? [] : ['pr']), ...(ci || pr ? ['ci'] : [])]} />
      {pr ? <PrCard pr={pr} lang={view.lang} onOpenLink={act.openLink} /> : (
        <Invite title={s.noPr} text={s.noPrHint}><Run a={action('pr')} busy={busy} onRun={() => act.run('pr')} /></Invite>
      )}
      {ci ? (
        <OutputCard title={t.outputs['ci.md']} file="ci.md" time={ci.time} t={t}
          tools={<Run a={action('ci')} busy={busy} tone="ghost" label={t.rerun} onRun={() => act.run('ci')} />}>
          <MarkdownView md={ci.text} t={t} onOpenLink={act.openLink} onQuote={quote} />
        </OutputCard>
      ) : pr ? (
        <Invite title={s.noCi} text={s.noCiHint}><Run a={action('ci')} busy={busy} onRun={() => act.run('ci')} /></Invite>
      ) : null}
      {assignBar}
    </>
  );
}
