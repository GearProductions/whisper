/** ecran-view — la catégorie « Relire à l'écran » de la Revue, pour les deux
 *  rôles : le plan de test (ecran.md, view.screen), une case par chose à essayer
 *  à la main ; cocher la valide (check:<rang>, 'ok'), décocher la refuse ('ko' :
 *  décoche aussi une case cochée dans le fichier). La case suit le clic aussitôt,
 *  le relevé suivant fait foi ; Tout cocher ('ok' sur chaque case pas cochée) ;
 *  Relancer. Pas de plan : Plan de test à l'écran.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : review-view. */
import { useState, type CSSProperties } from 'react';
import type { VibeLang } from 'technicals/bridge';
import { Icon } from './icons';
import { InlineMd } from './markdown-view';
import { Invite, OutputCard, Run } from './step-parts';
import type { StepProps } from './step-views';
import './ecran-view.css';

const fr = {
  none: 'Pas encore de plan de test',
  noneHint: 'Comment lancer la branche, puis ce qu\'il faut essayer à la main et ce qu\'on doit voir.',
  empty: 'Le plan ne contient aucune case.',
  done: (n: number, of: number) => `${n} / ${of}`,
  all: 'Tout cocher',
  allTitle: 'Valider chaque case pas encore cochée',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    none: 'No test plan yet',
    noneHint: 'How to run the branch, then what to try by hand and what must be seen.',
    empty: 'The plan has no checkbox.',
    done: (n, of) => `${n} / ${of}`,
    all: 'Tick all',
    allTitle: 'Approve every box not ticked yet',
  },
};

export function EcranSection(p: StepProps) {
  const { view, t, act, busy } = p;
  const s = S[view.lang];
  const action = view.actions.find((a) => a.id === 'screen');
  const plan = view.outputs['ecran.md'];
  const screen = view.screen ?? [];
  // Ce qu'on vient de cocher ou décocher, jusqu'au relevé suivant.
  const [clicked, setClicked] = useState<{ time: number; done: Record<number, boolean> }>({ time: view.time, done: {} });
  const flipped = clicked.time === view.time ? clicked.done : {};
  const boxes = screen.map((c, i) => flipped[i] ?? !!c.done);
  const ticked = boxes.filter(Boolean).length;
  const toggle = (i: number) => {
    setClicked({ time: view.time, done: { ...flipped, [i]: !boxes[i] } });
    act.mark(`check:${i}`, boxes[i] ? 'ko' : 'ok');
  };
  const tickAll = () => {
    setClicked({ time: view.time, done: { ...flipped, ...Object.fromEntries(boxes.map((_, i) => [i, true])) } });
    boxes.forEach((b, i) => { if (!b) act.mark(`check:${i}`, 'ok'); });
  };
  return plan ? (
    <OutputCard className="vc-plan" title={t.screenTitle} file="ecran.md" time={plan.time} t={t}
      tools={<>
        {boxes.length ? <span className="vc-count">{s.done(ticked, boxes.length)}</span> : null}
        {ticked < boxes.length ? <button type="button" className="vc-vbtn" title={s.allTitle} onClick={tickAll}><Icon name="ok" />{s.all}</button> : null}
        <Run a={action} busy={busy} tone="ghost" label={t.rerun} onRun={() => act.run('screen')} />
      </>}>
      {boxes.length ? (
        <>
          <div className="vc-plan-bar" style={{ '--done': `${(100 * ticked) / boxes.length}%` } as CSSProperties} />
          <ul className="vc-plan-list">
            {screen.map((c, i) => (
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
  ) : <Invite title={s.none} text={s.noneHint}><Run a={action} busy={busy} onRun={() => act.run('screen')} /></Invite>;
}
