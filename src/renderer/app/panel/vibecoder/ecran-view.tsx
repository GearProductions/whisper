/** ecran-view — l'étape À l'écran (Relire) : le plan de test de la PR
 *  (pr-<n>-ecran.md, la liste du relevé), une case par chose à essayer à la
 *  main ; cocher la valide (check:<pr>:<rang>, 'ok'), décocher la refuse
 *  ('ko' : décoche aussi une case cochée dans le fichier). La case suit le
 *  clic aussitôt, le relevé suivant fait foi. Pas de plan : Plan de test à
 *  l'écran.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useState, type CSSProperties } from 'react';
import type { VibeLang } from 'technicals/bridge';
import { InlineMd } from './markdown-view';
import { Invite, OutputCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './ecran-view.css';

const fr = {
  again: 'Refaire le plan',
  none: 'Pas encore de plan de test',
  noneHint: 'Comment lancer la PR, puis ce qu\'il faut essayer à la main et ce qu\'on doit voir.',
  empty: 'Le plan ne contient aucune case.',
  done: (n: number, of: number) => `${n} / ${of}`,
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    again: 'Redo the plan',
    none: 'No test plan yet',
    noneHint: 'How to run the PR, then what to try by hand and what must be seen.',
    empty: 'The plan has no checkbox.',
    done: (n, of) => `${n} / ${of}`,
  },
};

export function EcranView({ view, step, t, act, busy }: StepProps) {
  const s = S[view.lang];
  const action = view.actions.find((a) => a.id === 'screen');
  const n = view.pr?.number;
  const file = n ? `pr-${n}-ecran.md` : '';
  const plan = view.outputs[file];
  // Ce qu'on vient de cocher ou décocher, jusqu'au relevé suivant.
  const [clicked, setClicked] = useState<{ time: number; done: Record<number, boolean> }>({ time: view.time, done: {} });
  const flipped = clicked.time === view.time ? clicked.done : {};
  const boxes = view.checklist.map((c, i) => flipped[i] ?? !!c.done);
  const ticked = boxes.filter(Boolean).length;
  const toggle = (i: number) => {
    setClicked({ time: view.time, done: { ...flipped, [i]: !boxes[i] } });
    act.mark(`check:${n}:${i}`, boxes[i] ? 'ko' : 'ok');
  };
  return (
    <>
      <StepHead step={step} t={t} />
      {plan && n ? (
        <OutputCard className="vc-plan" title={t.outputs['pr-#-ecran.md']} file={file} time={plan.time} t={t}
          tools={<>{boxes.length ? <span className="vc-count">{s.done(ticked, boxes.length)}</span> : null}<Run a={action} busy={busy} tone="ghost" label={s.again} onRun={() => act.run('screen')} /></>}>
          {boxes.length ? (
            <>
              <div className="vc-plan-bar" style={{ '--done': `${(100 * ticked) / boxes.length}%` } as CSSProperties} />
              <ul className="vc-plan-list">
                {view.checklist.map((c, i) => (
                  <li key={i}>
                    <label data-done={boxes[i] || undefined}>
                      <input type="checkbox" checked={boxes[i]} onChange={() => toggle(i)} />
                      <span className="vc-plan-text"><InlineMd text={c.text} t={t} onOpenLink={act.openLink} /></span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : <div className="vc-plan-empty">{s.empty}</div>}
        </OutputCard>
      ) : <Invite title={s.none} text={s.noneHint}><Run a={action} busy={busy} onRun={() => act.run('screen')} /></Invite>}
    </>
  );
}
