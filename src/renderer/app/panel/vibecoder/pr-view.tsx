/** pr-view — l'étape PR, pour les deux rôles (view.flow).
 *  Créateur (note 0.16.0-ecran-essentiel), sans bouton : la carte de la PR de la branche (lue par gh, sinon pr.json :
 *  numéro, titre, branche et base du dépôt, lien ouvert dans le navigateur) et l'état de la CI, celui des checks de sa
 *  tête lu par gh (view.pr.ci ; note 0.16.0-ligne-apres-pr ; ci.md ne sert plus qu'au diagnostic, lu par le moteur) :
 *  une ligne par check en échec, rien quand tout passe, « la CI tourne » en cours ou sans check ; inconnu (gh sans
 *  réponse) : « La PR est ouverte : état de la CI inconnu », la même phrase que la ligne d'état, jamais vert.
 *  Ni Valider la feature, ni Diagnostiquer la CI, ni Relancer, ni Me
 *  retirer de la PR (lançables par la CLI) ; pas de PR : une phrase.
 *  Relecteur, inchangé : la carte de la PR suivie, S'assigner la PR (assign-pr) et Me retirer de la PR (unassign-pr) si le relevé les montre, puis le
 *  brouillon de revue (draft-view) — aucune action qui édite, génère ou commite. S'assigner : action directe
 *  seulement (F-114), au clic ; le principal prend le numéro et le login de son relevé, rien n'est envoyé.
 *  L'en-tête est rendu ici (Publier, au relecteur, est dans draft-view).
 *  La revue essentielle (note 0.16.0-revue-essentielle), en relecteur, l'arrêt « publier » : la carte de la PR,
 *  S'assigner la PR / Me retirer de la PR si le relevé les montre, puis les constats de l'agent sur le code
 *  (FindingsView), au-dessus du brouillon de revue, du verdict et de Publier la revue (DraftView, inchangés ; la phrase
 *  du brouillon vide, dans draft-view, ne cite plus les commits). StepHead n'a plus d'actions à écarter (own retiré).
 *  Le créateur : inchangé.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { parseCi } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { DraftView } from './draft-view';
import { FindingsView } from './findings-view';
import { Invite, PrCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';

const fr = {
  noPr: 'Pas encore de PR pour cette branche',
  ciRuns: 'La CI tourne',
  ciKo: 'La CI est en échec',
  ciRaw: 'ci.md',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    noPr: 'No PR for this branch yet',
    ciRuns: 'The CI is running',
    ciKo: 'The CI is failing',
    ciRaw: 'ci.md',
  },
};

// L'état de la CI en créateur : rien quand tout passe.
function CiState({ md, lang }: { md: string | undefined; lang: VibeLang }) {
  const s = S[lang];
  const ci = md === undefined ? { state: 'pending' as const, failed: [] } : parseCi(md);
  if (!ci) return <Invite title={s.ciRaw} text={<pre className="vc-mono">{md}</pre>} />;
  if (ci.state === 'ok') return null;
  if (ci.state === 'pending') return <Invite title={s.ciRuns} />;
  return <Invite title={s.ciKo} text={<ul>{ci.failed.map((f, i) => <li key={i}>{f}</li>)}</ul>} />;
}

export function PrView(p: StepProps) {
  const { view, act, busy } = p;
  const s = S[view.lang];
  // pr.json ne dit pas les branches (gh, si) : celles du dépôt (la base sans « origin/ »).
  const pr = view.pr && {
    ...view.pr, head: view.pr.head || view.repo?.branch || '', base: view.pr.base || view.repo?.base.replace(/^origin\//, '') || '',
  };
  if (view.flow !== 'review') {
    return (
      <>
        <StepHead p={p} />
        {pr ? (
          <>
            <PrCard pr={pr} lang={view.lang} onOpenLink={act.openLink} />
            {!pr.state || pr.state === 'OPEN' ? <CiState md={view.outputs['ci.md']?.text} lang={view.lang} /> : null}   {/* fusionnée ou fermée : la CI n'a plus rien à dire */}
          </>
        ) : <Invite title={s.noPr} />}
      </>
    );
  }
  // S'assigner la PR / Me retirer de la PR : un clic, direct, sans argument (le principal lit son relevé).
  const assigns = view.actions.filter((a) => (a.id === 'assign-pr' || a.id === 'unassign-pr') && !a.hidden);
  return (
    <>
      <StepHead p={p} />
      {view.pr ? <PrCard pr={view.pr} lang={view.lang} onOpenLink={act.openLink} /> : null}
      {assigns.length ? <div className="vc-step-acts">{assigns.map((a) => <Run key={a.id} a={a} busy={busy} onRun={(x) => act.run(a.id, x)} />)}</div> : null}
      <FindingsView {...p} />
      <DraftView {...p} />
    </>
  );
}
