/** review-view — l'étape Revue, pour les deux rôles. Créateur : la liste du § A.3 (cochée par le
 *  relevé : ✓, ✗ ; ce que le dépôt ne dit pas, une case à cocher à la main,
 *  validée pour le commit de tête : `a3:<rang>`) ; les vérifications de
 *  checks.json, une ligne chacune (✓, avertissements en orange, ✗ ; son détail
 *  repliable, déplié en cas d'échec ; Relancer chacune seule, hors d'une
 *  course checks : IconButton refresh, en bout de ligne, aligné que la ligne
 *  ait un détail ou non ; l'étiquette en tête du détail (tagOf) : son badge, et le texte d'une ligne
 *  [agent] en retrait, sa marque d'échec gardée en couleur) ; la ponytail review rendue (MarkdownView
 *  tagged : le badge après l'adresse, le grisé ; l'adresse reste lue en tête), 💬 et Appliquer par
 *  remarque (un vc-mini texte), une case devant chaque remarque pas appliquée,
 *  cochée par défaut (les décochées tenues ici par leur remarkId, oubliées à
 *  une nouvelle review) : Tout appliquer quand toutes le sont (l'action apply,
 *  sans texte), sinon Appliquer la sélection (n) (les cochées, applySelection ;
 *  grisé sans aucune). Appliquer n'est pas proposé pendant une course apply ; une
 *  remarque appliquée (ponytail-applied.json) est marquée (Icon ok) et
 *  grisée, toutes : le bandeau « Appliquée » (Icon ok) sur l'encart, sans
 *  Tout appliquer. Les vérifications :
 *  Relancer ; sans sortie, leur action. La ponytail review, lancée avec les
 *  vérifications (F-115) : ni Relancer ni bouton, sans sortie l'invitation le dit.
 *  Puis, pour le créateur comme pour le relecteur (qui ne voit qu'elle), « Relire à
 *  l'écran » (EcranSection) ; l'en-tête n'y répète pas l'action screen.
 *  Ne connaît pas : le pont (rappels passés ; l'état des courses par StopRun).
 *  Utilisé par : step-views. */
import { useContext, useState } from 'react';
import { allApplied, appliedRemarks, applySelection, BULLET, isLive, parseChecks, remarkId, remarkMark } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { Icon, IconButton } from './icons';
import { MarkdownView } from './markdown-view';
import { Invite, OutputCard, Run, StepHead, StopRun } from './step-parts';
import { EcranSection } from './ecran-view';
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
  applyPicked: (n: number) => `Appliquer la sélection (${n})`,
  pickTitle: 'Décochez les remarques à ne pas appliquer',
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
    applyPicked: (n) => `Apply the selection (${n})`,
    pickTitle: 'Untick the remarks not to apply',
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

// Ce que seul le créateur voit : A.3, vérifications, ponytail review.
function CreatorParts(p: StepProps) {
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
  // preventDefault : dans le <summary>, le clic ne replie pas le détail.
  const againOne = (i: number) => checksAct && !checksAct.hidden && !checksLive ? (
    <IconButton icon="refresh" className="vc-check-again" label={checksAct.disabled || s.rerunOneTitle} disabled={busy || !!checksAct.disabled}
      onClick={(e) => { e.preventDefault(); act.run('checks', { check: i }); }} />
  ) : null;
  // Appliquer : l'action apply, avec la remarque (args.text) ou sans (toutes) ; jamais le champ.
  const apply = action('apply');
  const remarks = !!ponytail && ponytail.text.split(/\r?\n/).some((l) => BULLET.test(l));
  const applied = ponytail ? appliedRemarks(view.outputs['ponytail-applied.json'], ponytail.time) : new Set<string>();
  const done = !!ponytail && allApplied(ponytail.text, applied);
  const applyState = runState('apply');
  // Les remarques décochées, par remarkId, pour cette review-ci (sa date) : une nouvelle review les recoche toutes.
  const [unchecked, setUnchecked] = useState<{ time: number; ids: ReadonlySet<string> }>({ time: 0, ids: new Set() });
  const off = ponytail && unchecked.time === ponytail.time ? unchecked.ids : new Set<string>();
  const pick = ponytail && remarks ? applySelection(ponytail.text, applied, off) : null;
  const toggle = (id: string) => {
    const ids = new Set(off);
    if (!ids.delete(id)) ids.add(id);
    setUnchecked({ time: ponytail!.time, ids });
  };
  const remarkStart = remarks && apply ? (text: string) => (remarkMark(text, applied, applyState) === 'applied' ? null : (
    <input type="checkbox" className="vc-remark-pick" checked={!off.has(remarkId(text))} disabled={busy || isLive(applyState)}
      title={s.pickTitle} aria-label={s.pickTitle} onChange={() => toggle(remarkId(text))} />
  )) : undefined;
  const remarkEnd = remarks ? (text: string) => {
    const mark = remarkMark(text, applied, applyState);
    if (mark === 'applied') return <span className="vc-remark-applied" role="img" title={s.appliedTitle} aria-label={s.applied}><Icon name="ok" /></span>;
    return mark && apply ? (
      <button type="button" className="vc-mini vc-apply-one" disabled={busy || !!apply.disabled}
        title={apply.disabled || s.applyOneTitle} onClick={() => act.run('apply', { text })}>{s.applyOne}</button>
    ) : null;
  } : undefined;
  const noHead = !view.commits.length;
  return (
    <>
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
          tools={done ? <span className="vc-applied-banner"><Icon name="ok" />{s.applied}</span>
            : pick ? (
              <Run a={apply && !pick.count ? { ...apply, disabled: apply.disabled ?? s.pickTitle } : apply} busy={busy}
                label={pick.all ? s.applyAll : s.applyPicked(pick.count)} onRun={() => act.run('apply', { text: pick.text })} />
            ) : null}>
          <MarkdownView md={ponytail.text} t={t} onOpenLink={act.openLink} onQuote={quote} itemStart={remarkStart} itemEnd={remarkEnd} />
        </OutputCard>
      ) : <Invite title={s.noPonytail} text={`${t.ponytailWithChecks} ${s.noPonytailHint}`} />}
    </>
  );
}

// La Revue des deux rôles ; le relecteur n'a que « Relire à l'écran » (ni vérification, ni ponytail, ni Appliquer).
export function ReviewView(p: StepProps) {
  return (
    <>
      <StepHead p={p} own={['checks', 'ponytail', 'apply', 'screen']} />
      {p.view.flow === 'create' ? <CreatorParts {...p} /> : null}
      <EcranSection {...p} />
    </>
  );
}
