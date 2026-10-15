/** step-view — la vue générique d'une étape (toute étape sans vue dédiée) :
 *  son nom, son état et ses faits ; à l'étape Note, la note du ticket ; les
 *  sorties des skills qui la concernent, dans des cartes titrées (et depuis
 *  quand). 💬 au survol d'un bloc le cite dans le champ (action 'comment').
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import type { VibeFlow, VibeStepId } from 'technicals/bridge';
import { MarkdownView } from './markdown-view';
import type { StepProps } from './step-views';

// Les sorties que montre chaque étape (noms connus du principal) ; # : le numéro de la PR chargée.
const SHOWS: Record<VibeFlow, Partial<Record<VibeStepId, string[]>>> = {
  create: {
    note: ['questions.md'], invariants: ['align.md'], modules: ['commit.md', 'review.md'], revue: ['checks.json', 'ponytail.md'],
    pr: ['pr.json', 'ci.md'],
  },
  review: {
    pr: ['prs.json', 'pr-#.json'], note: ['pr-#-note.md'], invariants: ['align.md'], commits: ['pr-#-commits.md'],
    ecran: ['pr-#-ecran.md'], revue: ['pr-#-review.json'],
  },
};

// Une sortie JSON, lisible ; illisible : telle quelle.
function pretty(text: string) {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

export function StepView({ view, step, t, act }: StepProps) {
  const quote = view.actions.some((a) => a.id === 'comment') ? (text: string) => act.prefill('comment', text) : undefined;
  const note = step.id === 'note' ? view.note : null;
  const outputs = (SHOWS[view.flow][step.id] || []).flatMap((name) => {
    const file = name.replace('#', String(view.pr?.number));
    const o = view.outputs[file];
    return o ? [{ name, file, ...o }] : [];
  });
  return (
    <>
      <div className="vc-step-head">
        <h2>{t.steps[step.id]}</h2>
        <span className="vc-badge" data-status={step.status}>{t.stepStatus[step.status]}</span>
        <span className="vc-facts">{step.facts}</span>
      </div>
      {note ? (
        <section className="vc-card">
          <div className="vc-card-head">
            <span className="vc-card-title vc-mono">{note.path}</span>
            <button type="button" className="vc-mini" title={t.openTitle} onClick={() => act.open(note.id)}>{t.open}</button>
          </div>
          <div className="vc-card-body"><MarkdownView md={note.text} t={t} onOpenLink={act.openLink} onQuote={quote} /></div>
        </section>
      ) : null}
      {outputs.map((o) => (
        <section key={o.file} className="vc-card">
          <div className="vc-card-head">
            <span className="vc-card-title">{t.outputs[o.name] || o.file}</span>
            <span className="vc-card-file vc-mono">{o.file}</span>
            <span className="vc-card-time" title={new Date(o.time).toLocaleString(t.locale)}>{t.ago(Date.now() - o.time)}</span>
          </div>
          <div className="vc-card-body">
            {o.file.endsWith('.json') ? <pre className="vc-code">{pretty(o.text)}</pre>
              : <MarkdownView md={o.text} t={t} onOpenLink={act.openLink} onQuote={quote} />}
          </div>
        </section>
      ))}
      {note || outputs.length ? null : <div className="vc-empty">{t.emptyStep}</div>}
    </>
  );
}
