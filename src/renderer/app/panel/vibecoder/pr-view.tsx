/** pr-view — l'étape PR, pour les deux rôles (view.flow).
 *  Créateur (note 0.16.0-ecran-essentiel), sans bouton : la carte de la PR de la branche (lue par gh, sinon pr.json :
 *  numéro, titre, branche et base du dépôt, lien ouvert dans le navigateur) et l'état de la CI, celui des checks de sa
 *  tête lu par gh (view.pr.ci ; note 0.16.0-ligne-apres-pr ; ci.md ne sert plus qu'au diagnostic, lu par le moteur) :
 *  une ligne par check en échec, rien quand tout passe, « la CI tourne » en cours ou sans check ; inconnu (gh sans
 *  réponse) : « La PR est ouverte : état de la CI inconnu », la même phrase que la ligne d'état, jamais vert.
 *  Puis la revue reçue (pr.reviews, lue par gh ; demandé le 27 novembre 2026) : la décision, chaque revue ou commentaire mis
 *  en forme, et leurs bulles 💬 qui les citent dans le champ de la conversation (Received). Ni Valider la feature, ni Diagnostiquer la CI, ni Relancer, ni Me
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
import { t } from 'core/vibecoder';
import type { VibeCi, VibeLang, VibeReview, VibeReviews } from 'technicals/bridge';
import { DraftView } from './draft-view';
import { FindingsView } from './findings-view';
import { IconButton } from './icons';
import { MarkdownView } from './markdown-view';
import './pr-view.css';
import { Invite, PrCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';

const fr = {
  noPr: 'Pas encore de PR pour cette branche',
  ciRuns: 'La CI tourne',
  ciKo: 'La CI est en échec',
  received: 'Revue de la PR',
  decision: { APPROVED: 'Approuvée', CHANGES_REQUESTED: 'Changements demandés', REVIEW_REQUIRED: 'En attente de revue' } as Record<string, string>,
  state: { APPROVED: 'a approuvé', CHANGES_REQUESTED: 'demande des changements', COMMENTED: 'a commenté', DISMISSED: 'revue écartée', COMMENT: 'a commenté' } as Record<string, string>,
  inCode: 'commentaires dans le code, à lire sur GitHub',
  quoteOne: 'Citer cette revue dans le champ, pour la donner à l\'agent',
  quoteAll: 'Citer toute la revue dans le champ, pour la donner à l\'agent',
  quoteHead: (n: number) => `La revue de la PR #${n}`,
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    noPr: 'No PR for this branch yet',
    ciRuns: 'The CI is running',
    ciKo: 'The CI is failing',
    received: 'Review of the PR',
    decision: { APPROVED: 'Approved', CHANGES_REQUESTED: 'Changes requested', REVIEW_REQUIRED: 'Review required' },
    state: { APPROVED: 'approved', CHANGES_REQUESTED: 'requests changes', COMMENTED: 'commented', DISMISSED: 'review dismissed', COMMENT: 'commented' },
    inCode: 'comments in the code, to read on GitHub',
    quoteOne: 'Quote this review in the field, to hand it to the agent',
    quoteAll: 'Quote the whole review in the field, to hand it to the agent',
    quoteHead: (n: number) => `The review of PR #${n}`,
  },
};

// L'état de la CI en créateur, d'après gh seul (pr.ci) : rien quand tout passe, inconnu sans réponse de gh.
function CiState({ ci, lang }: { ci: VibeCi | null | undefined; lang: VibeLang }) {
  const s = S[lang];
  if (!ci) return <Invite title={t(lang).statusLine.ciUnknown} />;
  if (ci.state === 'ok') return null;
  if (ci.state === 'pending') return <Invite title={s.ciRuns} />;
  return <Invite title={s.ciKo} text={<ul>{ci.failed.map((f, i) => <li key={i}>{f}</li>)}</ul>} />;
}

// La revue reçue en créateur (demandé le 27 novembre 2026) : la décision de GitHub, puis chaque revue ou commentaire (auteur,
// état, date, texte mis en forme ; une revue sans texte : ses commentaires sont dans le code, sur GitHub). La bulle d'une
// revue la cite dans le champ de la conversation, celle d'en tête toute la revue (quote : seulement si l'action 💬 est au
// relevé) ; rien n'est envoyé ni publié. Sans revue ni décision : rien.
function Received({ n, reviews, lang, quote }: { n: number; reviews: VibeReviews; lang: VibeLang; quote?: (q: string) => void }) {
  const s = S[lang];
  if (!reviews.decision && !reviews.items.length) return null;
  const empty = (r: VibeReview) => !r.body.trim() && (r.state === 'COMMENTED' || r.state === 'CHANGES_REQUESTED');
  const line = (r: VibeReview) => `@${r.author || '?'} (${s.state[r.state] ?? r.state})${r.body.trim() ? ` : « ${r.body.trim()} »` : empty(r) ? ` : ${s.inCode}` : ''}`;
  const all = [`${s.quoteHead(n)}${reviews.decision ? ` (${s.decision[reviews.decision]})` : ''} :`, ...reviews.items.map((r) => `- ${line(r)}`)].join('\n');
  return (
    <section className="vc-received">
      <div className="vc-received-head">
        <h3>{s.received}</h3>
        {reviews.decision ? <span className="vc-received-decision" data-decision={reviews.decision}>{s.decision[reviews.decision]}</span> : null}
        {quote && reviews.items.length ? <IconButton icon="comment" label={s.quoteAll} onClick={() => quote(all)} /> : null}
      </div>
      {reviews.items.map((r, i) => (
        <article key={i} className="vc-received-item" data-state={r.state}>
          <div className="vc-received-meta">
            <b>{r.author || '?'}</b> <span>{s.state[r.state] ?? r.state}</span>
            {r.at ? <time dateTime={r.at}>{new Date(r.at).toLocaleString(lang)}</time> : null}
            {quote ? <IconButton icon="comment" label={s.quoteOne} onClick={() => quote(line(r))} /> : null}
          </div>
          {r.body.trim() ? <div className="vc-received-body"><MarkdownView md={r.body} t={t(lang)} onOpenLink={() => {}} /></div>
            : empty(r) ? <p className="vc-received-empty">{s.inCode}</p> : null}
        </article>
      ))}
    </section>
  );
}

export function PrView(p: StepProps) {
  const { view, act, busy } = p;
  const s = S[view.lang];
  // pr.json ne dit pas les branches (gh, si) : celles du dépôt (la base sans « origin/ »).
  const pr = view.pr && {
    ...view.pr, head: view.pr.head || view.repo?.branch || '', base: view.pr.base || view.repo?.base.replace(/^origin\//, '') || '',
  };
  if (view.flow !== 'review') {
    const quote = view.actions.some((a) => a.id === 'comment') ? (q: string) => act.prefill('comment', q) : undefined;
    return (
      <>
        <StepHead p={p} />
        {pr ? (
          <>
            <PrCard pr={pr} lang={view.lang} onOpenLink={act.openLink} />
            {!pr.state || pr.state === 'OPEN' ? <CiState ci={pr.ci} lang={view.lang} /> : null}   {/* fusionnée ou fermée : la CI n'a plus rien à dire */}
            {pr.reviews ? <Received n={pr.number} reviews={pr.reviews} lang={view.lang} quote={quote} /> : null}
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
