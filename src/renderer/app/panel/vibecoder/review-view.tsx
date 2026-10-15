/** review-view — l'étape Revue (Créer) : la liste du § A.3 (cochée par le
 *  relevé : ✓, ✗, ou « à vérifier » à la main ; pas cliquable) ; les
 *  vérifications de checks.json, une ligne chacune (✓ / ✗, son détail
 *  repliable, déplié en cas d'échec) ; la ponytail review rendue, 💬 par
 *  remarque. Sans sortie : l'action qui la produit.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { parseChecks } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { MarkdownView } from './markdown-view';
import { Invite, OutputCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './review-view.css';

const fr = {
  a3: 'Avant la PR',
  a3File: 'guide § A.3',
  a3Count: (ok: number, n: number) => `${ok} / ${n}`,
  manual: 'à vérifier',
  manualTitle: 'Le dépôt ne le dit pas : à vérifier à la main',
  okTitle: 'Vu dans le dépôt',
  koTitle: 'Pas encore, d\'après le dépôt',
  checksCount: (ok: number, n: number) => (ok === n ? `${n} / ${n} ok` : `${n - ok} en échec`),
  noCommand: 'Aucune commande de vérification trouvée dans le projet.',
  unreadable: 'checks.json illisible : le voici tel quel.',
  again: 'Relancer',
  noChecks: 'Pas encore de vérification',
  noChecksHint: 'Typage, tests, invariants, lint : les commandes du projet.',
  noPonytail: 'Pas encore de ponytail review',
  noPonytailHint: 'Sur-ingénierie, duplication, note alignée avec le code, cas limites, sécurité, code mort.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    a3: 'Before the PR',
    a3File: 'guide § A.3',
    a3Count: (ok, n) => `${ok} / ${n}`,
    manual: 'to check',
    manualTitle: 'The repository cannot tell: check it by hand',
    okTitle: 'Seen in the repository',
    koTitle: 'Not yet, according to the repository',
    checksCount: (ok, n) => (ok === n ? `${n} / ${n} pass` : `${n - ok} failing`),
    noCommand: 'No check command found in the project.',
    unreadable: 'checks.json is unreadable: here it is as is.',
    again: 'Run again',
    noChecks: 'No check yet',
    noChecksHint: 'Typecheck, tests, invariants, lint: the project\'s own commands.',
    noPonytail: 'No ponytail review yet',
    noPonytailHint: 'Over-engineering, duplication, note aligned with the code, edge cases, security, dead code.',
  },
};

const STATE = { true: 'ok', false: 'ko', null: 'manual' } as const;

export function ReviewView({ view, step, t, act, busy }: StepProps) {
  const s = S[view.lang];
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const quote = action('comment') ? (text: string) => act.prefill('comment', text) : undefined;
  const checksOut = view.outputs['checks.json'];
  const checks = checksOut ? parseChecks(checksOut.text) : null;
  const passed = checks ? checks.filter((c) => c.ok).length : 0;
  const ponytail = view.outputs['ponytail.md'];
  const again = (id: string) => <Run a={action(id)} busy={busy} tone="ghost" label={s.again} onRun={() => act.run(id)} />;
  return (
    <>
      <StepHead step={step} t={t} />
      {view.checklist.length ? (
        <OutputCard className="vc-a3" title={s.a3} file={s.a3File} t={t}
          tools={<span className="vc-count">{s.a3Count(view.checklist.filter((c) => c.done === true).length, view.checklist.length)}</span>}>
          <ul className="vc-a3-list">
            {view.checklist.map((c, i) => {
              const state = STATE[String(c.done) as keyof typeof STATE];
              return (
                <li key={i} data-state={state} title={state === 'ok' ? s.okTitle : state === 'ko' ? s.koTitle : s.manualTitle}>
                  <span className="vc-mark" aria-hidden="true" />
                  <span className="vc-a3-text">{c.text}</span>
                  {state === 'manual' ? <span className="vc-a3-manual">{s.manual}</span> : null}
                </li>
              );
            })}
          </ul>
        </OutputCard>
      ) : null}
      {checksOut ? (
        <OutputCard className="vc-checks" title={t.outputs['checks.json']} file="checks.json" time={checksOut.time} t={t}
          tools={<>{checks?.length ? <span className="vc-count" data-ko={passed < checks.length || undefined}>{s.checksCount(passed, checks.length)}</span> : null}{again('checks')}</>}>
          {!checks ? (
            <><div className="vc-checks-note">{s.unreadable}</div><pre className="vc-code">{checksOut.text}</pre></>
          ) : !checks.length ? <div className="vc-checks-note">{s.noCommand}</div> : (
            <ul className="vc-check-list">
              {checks.map((c, i) => (
                <li key={i} data-state={c.ok ? 'ok' : 'ko'}>
                  {c.detail ? (
                    <details open={!c.ok}>
                      <summary>
                        <span className="vc-mark" aria-hidden="true" /><span className="vc-check-name">{c.name}</span>
                        <span className="vc-check-line">{c.detail.split('\n')[0]}</span>
                      </summary>
                      <pre className="vc-check-detail">{c.detail}</pre>
                    </details>
                  ) : <div className="vc-check-row"><span className="vc-mark" aria-hidden="true" /><span className="vc-check-name">{c.name}</span></div>}
                </li>
              ))}
            </ul>
          )}
        </OutputCard>
      ) : <Invite title={s.noChecks} text={s.noChecksHint}><Run a={action('checks')} busy={busy} onRun={() => act.run('checks')} /></Invite>}
      {ponytail ? (
        <OutputCard title={t.outputs['ponytail.md']} file="ponytail.md" time={ponytail.time} t={t} tools={again('ponytail')}>
          <MarkdownView md={ponytail.text} t={t} onOpenLink={act.openLink} onQuote={quote} />
        </OutputCard>
      ) : <Invite title={s.noPonytail} text={s.noPonytailHint}><Run a={action('ponytail')} busy={busy} onRun={() => act.run('ponytail')} /></Invite>}
    </>
  );
}
