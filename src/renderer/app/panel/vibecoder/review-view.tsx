/** review-view — l'étape Revue (Créer) : la liste du § A.3 (cochée par le
 *  relevé : ✓, ✗ ; ce que le dépôt ne dit pas, une case à cocher à la main,
 *  validée pour le commit de tête : `a3:<rang>`) ; les vérifications de
 *  checks.json, une ligne chacune (✓, avertissements en orange, ✗ ; son détail
 *  repliable, déplié en cas d'échec ; Relancer chacune seule, hors d'une
 *  course checks) ; la ponytail review rendue, 💬 et Appliquer par remarque,
 *  Tout appliquer (l'action apply, avec ou sans la remarque). Appliquer n'est
 *  pas proposé pendant une course apply ; une remarque appliquée
 *  (ponytail-applied.json) est marquée ✓ et grisée, toutes : le bandeau
 *  « Appliquée » sur l'encart, sans Tout appliquer. Les vérifications :
 *  Relancer ; sans sortie, leur action. La ponytail review, lancée avec les
 *  vérifications (F-115) : ni Relancer ni bouton, sans sortie l'invitation le dit.
 *  Ne connaît pas : le pont (rappels passés ; l'état des courses par StopRun).
 *  Utilisé par : step-views. */
import { useContext } from 'react';
import { allApplied, appliedRemarks, BULLET, isLive, parseChecks, remarkMark } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { MarkdownView } from './markdown-view';
import { Invite, OutputCard, Run, StepHead, StopRun } from './step-parts';
import type { StepProps } from './step-views';
import './review-view.css';

const fr = {
  a3: 'Avant la PR',
  a3File: 'guide § A.3',
  a3Count: (ok: number, n: number) => `${ok} / ${n}`,
  manual: 'à vérifier',
  manualTitle: 'Le dépôt ne le dit pas : cochez-le une fois vérifié (vaut jusqu\'au prochain commit)',
  manualDone: 'Coché à la main, pour le dernier commit de la branche',
  noCommit: 'Pas encore de commit sur la branche',
  reviewedHelp: 'Cochez une fois chaque module relu (Modules → Relire le diff)',
  warnings: (n: number) => `${n} avertissement${n > 1 ? 's' : ''}`,
  warningPill: 'avertissements',
  applyAll: 'Tout appliquer',
  applyOne: 'Appliquer',
  applyOneTitle: 'L\'agent applique cette remarque seule (en fixup), s\'il la juge juste',
  applied: 'Appliquée',
  appliedTitle: 'Remarque appliquée par la dernière course Appliquer',
  rerunOneTitle: 'Relancer cette vérification seule',
  okTitle: 'Vu dans le dépôt',
  koTitle: 'Pas encore, d\'après le dépôt',
  checksCount: (ok: number, n: number) => (ok === n ? `${n} / ${n} ok` : `${n - ok} en échec`),
  noCommand: 'Aucune commande de vérification trouvée dans le projet.',
  unreadable: 'checks.json illisible : le voici tel quel.',
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
    manualTitle: 'The repository cannot tell: tick it once checked (holds until the next commit)',
    manualDone: 'Ticked by hand, for the branch\'s last commit',
    noCommit: 'No commit on the branch yet',
    reviewedHelp: 'Tick once every module has been reviewed (Modules → Review the diff)',
    warnings: (n) => `${n} warning${n !== 1 ? 's' : ''}`,
    warningPill: 'warnings',
    applyAll: 'Apply all',
    applyOne: 'Apply',
    applyOneTitle: 'The agent applies this remark alone (as a fixup), if it judges it right',
    applied: 'Applied',
    appliedTitle: 'Remark applied by the last Apply run',
    rerunOneTitle: 'Run this check again, alone',
    okTitle: 'Seen in the repository',
    koTitle: 'Not yet, according to the repository',
    checksCount: (ok, n) => (ok === n ? `${n} / ${n} pass` : `${n - ok} failing`),
    noCommand: 'No check command found in the project.',
    unreadable: 'checks.json is unreadable: here it is as is.',
    noChecks: 'No check yet',
    noChecksHint: 'Typecheck, tests, invariants, lint: the project\'s own commands.',
    noPonytail: 'No ponytail review yet',
    noPonytailHint: 'Over-engineering, duplication, note aligned with the code, edge cases, security, dead code.',
  },
};

const STATE = { true: 'ok', false: 'ko', null: 'manual' } as const;
const REVIEWED = 2;   // « Chaque diff a été relu » : son rang dans la liste du § A.3 (core/vibecoder, journey)

export function ReviewView(p: StepProps) {
  const { view, t, act, busy } = p;
  const runState = useContext(StopRun).state;
  const s = S[view.lang];
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const quote = action('comment') ? (text: string) => act.prefill('comment', text) : undefined;
  const checksOut = view.outputs['checks.json'];
  const checks = checksOut ? parseChecks(checksOut.text) : null;
  const passed = checks ? checks.filter((c) => c.ok).length : 0;
  const warned = checks ? checks.filter((c) => c.level === 'warning').length : 0;
  const ponytail = view.outputs['ponytail.md'];
  const again = (id: string) => <Run a={action(id)} busy={busy} tone="ghost" label={t.rerun} onRun={() => act.run(id)} />;
  // Relancer une vérification seule (args.check : son rang) ; pendant une course checks, rien (celle de la carte la montre).
  const checksAct = action('checks');
  const checksLive = isLive(runState('checks'));
  const againOne = (i: number) => checksAct && !checksAct.hidden && !checksLive ? (
    <button type="button" className="vc-mini vc-check-again" disabled={busy || !!checksAct.disabled}
      title={checksAct.disabled || s.rerunOneTitle} onClick={(e) => { e.preventDefault(); act.run('checks', { check: i }); }}>{t.rerun}</button>
  ) : null;
  // Appliquer : l'action apply, avec la remarque (args.text) ou sans (toutes) ; jamais le champ.
  const apply = action('apply');
  const remarks = !!ponytail && ponytail.text.split(/\r?\n/).some((l) => BULLET.test(l));
  const applied = ponytail ? appliedRemarks(view.outputs['ponytail-applied.json'], ponytail.time) : new Set<string>();
  const done = !!ponytail && allApplied(ponytail.text, applied);
  const applyState = runState('apply');
  const remarkEnd = remarks ? (text: string) => {
    const mark = remarkMark(text, applied, applyState);
    if (mark === 'applied') return <span className="vc-remark-applied" title={s.appliedTitle} aria-label={s.applied}>✓</span>;
    return mark && apply ? (
      <button type="button" className="vc-mini vc-apply-one" disabled={busy || !!apply.disabled}
        title={apply.disabled || s.applyOneTitle} onClick={() => act.run('apply', { text })}>{s.applyOne}</button>
    ) : null;
  } : undefined;
  const noHead = !view.commits.length;
  return (
    <>
      <StepHead p={p} own={['checks', 'ponytail', 'apply']} />
      {view.checklist.length ? (
        <OutputCard className="vc-a3" title={s.a3} file={s.a3File} t={t}
          tools={<span className="vc-count">{s.a3Count(view.checklist.filter((c) => c.done === true).length, view.checklist.length)}</span>}>
          <ul className="vc-a3-list">
            {view.checklist.map((c, i) => {
              const state = STATE[String(c.done) as keyof typeof STATE];
              if (c.manual) {
                return (
                  <li key={i} data-state={state} data-manual title={noHead ? s.noCommit : c.done ? s.manualDone : s.manualTitle}>
                    <label className="vc-a3-check">
                      <input type="checkbox" checked={c.done === true} disabled={noHead}
                        onChange={() => act.mark(`a3:${i}`, c.done ? null : 'ok')} />
                      <span className="vc-a3-text">
                        {c.text}
                        {i === REVIEWED ? <span className="vc-a3-help">{s.reviewedHelp}</span> : null}
                      </span>
                    </label>
                    {state === 'manual' ? <span className="vc-a3-manual">{s.manual}</span> : null}
                  </li>
                );
              }
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
          tools={<>{checks?.length ? (
            <span className="vc-count" data-ko={passed < checks.length || undefined} data-warn={(passed === checks.length && warned > 0) || undefined}>
              {passed === checks.length && warned ? s.warnings(warned) : s.checksCount(passed, checks.length)}
            </span>
          ) : null}{again('checks')}</>}>
          {!checks ? (
            <><div className="vc-checks-note">{s.unreadable}</div><pre className="vc-code">{checksOut.text}</pre></>
          ) : !checks.length ? <div className="vc-checks-note">{s.noCommand}</div> : (
            <ul className="vc-check-list">
              {checks.map((c, i) => (
                <li key={i} data-state={c.level === 'warning' ? 'warn' : c.ok ? 'ok' : 'ko'}>
                  {c.detail ? (
                    <details open={!c.ok}>
                      <summary>
                        <span className="vc-mark" aria-hidden="true" /><span className="vc-check-name">{c.name}</span>
                        {c.level === 'warning' ? <span className="vc-check-warn">{s.warningPill}</span> : null}
                        <span className="vc-check-line">{c.detail.split('\n')[0]}</span>
                        {againOne(i)}
                      </summary>
                      <pre className="vc-check-detail">{c.detail}</pre>
                    </details>
                  ) : (
                    <div className="vc-check-row">
                      <span className="vc-mark" aria-hidden="true" /><span className="vc-check-name">{c.name}</span>
                      {c.level === 'warning' ? <span className="vc-check-warn">{s.warningPill}</span> : null}
                      {againOne(i)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </OutputCard>
      ) : <Invite title={s.noChecks} text={s.noChecksHint}><Run a={action('checks')} busy={busy} onRun={() => act.run('checks')} /></Invite>}
      {ponytail ? (
        <OutputCard title={t.outputs['ponytail.md']} file="ponytail.md" time={ponytail.time} t={t}
          tools={done ? <span className="vc-applied-banner">✓ {s.applied}</span>
            : remarks ? <Run a={apply} busy={busy} label={s.applyAll} onRun={() => act.run('apply', { text: '' })} /> : null}>
          <MarkdownView md={ponytail.text} t={t} onOpenLink={act.openLink} onQuote={quote} itemEnd={remarkEnd} />
        </OutputCard>
      ) : <Invite title={s.noPonytail} text={`${t.ponytailWithChecks} ${s.noPonytailHint}`} />}
    </>
  );
}
