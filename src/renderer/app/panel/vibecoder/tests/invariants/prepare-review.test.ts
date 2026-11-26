// @vitest-environment happy-dom
// Invariant des lectures de la revue, côté page (note 0.16.0,
// docs/tickets/feat/0.16.0-revue-essentielle.md, « Ce que ça ne doit pas
// faire ») :
//   « Lancer une lecture (dépenser des tokens) sans geste du relecteur :
//     charger une PR, l'ouvrir, changer d'arrêt ou un simple relevé ne lancent
//     rien ; seuls Préparer la revue ou une demande à l'agent le font. »
// Ici : l'écran du relecteur affiché, ses arrêts changés (au fil d'Ariane, au
// clavier), un nouveau relevé, la PR qui vient d'être chargée ne demandent
// aucune action au principal ; le clic sur Préparer la revue, si (témoin).
// Le principal (charger, relever, une lecture finie ou en échec) :
// main/app/controllers/tests/invariants/review-readings.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Le vrai écran (VibeCoder, ses vraies vues d'étape) monté par React
// (createRoot) dans une page happy-dom ; le pont est une suite de rappels, dont
// run (une demande d'action au principal) relève chaque appel.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { createKept } from 'core/vibecoder';
import type { Thread, VibeAction, VibePr, VibeStepId, VibeView } from 'technicals/bridge';
import { VibeCoder } from '../../vibe-coder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Les cinq lectures de la revue, telles que le relevé les donne à lancer, et l'arrêt de chacune.
const READINGS: [string, VibeStepId][] = [['review-note', 'note'], ['read-invariants', 'invariants'], ['align', 'invariants'], ['review-commits', 'pr'], ['screen', 'revue']];
const reading = ([id, step]: [string, VibeStepId]): VibeAction => ({
  id, step, label: id, hint: '', who: 'sonnet', models: [], model: null, kind: 'send', needs: 'none', usesText: false,
  primary: false, disabled: null, hidden: false,
});
const PR: VibePr = { number: 7, title: 'Essai', url: 'https://github.com/o/r/pull/7', author: 'bob', base: 'main', head: 'feat/x', body: '', state: 'OPEN' };
const NOTE_TEXT = ['# 0.16.0 — essai', '', '## Ce que ça fait', '', '- un essai', '', '## Ce que ça ne doit pas faire', '', '- mentir → invariant', ''].join('\n');
const TEST_TEXT = "import { it } from 'vitest';\n\nit('hello ne ment jamais', () => {});\n";

// Le relevé du relecteur : ses quatre arrêts, la PR 7 chargée, sa note, un test d'invariant, les cinq lectures à lancer.
function reviewerView(agentId: string, over: Partial<VibeView> = {}): VibeView {
  return {
    agentId, lang: 'fr', flow: 'review', agent: { model: 'opus', effort: 'high', mode: 'default' },
    repo: { branch: 'feat/x', base: 'main', changed: 2 }, error: null,
    steps: [{ id: 'note', status: 'current', facts: '' }, { id: 'invariants', status: 'todo', facts: '' },
      { id: 'revue', status: 'todo', facts: '' }, { id: 'pr', status: 'todo', facts: '' }],
    note: { id: 'n', path: 'docs/tickets/feat/x.md', text: NOTE_TEXT, before: null, filled: true,
      mustNot: [{ text: 'mentir', mark: 'invariant' }], mark: null, formeMark: null },
    questions: [], modules: [],
    invariants: [{ id: 't0', path: 'src/x/tests/invariants/x.test.ts', blob: '0'.repeat(40), cases: ['hello ne ment jamais'], lines: [3],
      source: TEST_TEXT, base: null, reading: null, marks: {} }],
    variants: [], commits: [], outputs: {}, checklist: [], actions: READINGS.map(reading), skills: [],
    pr: PR, loaded: PR, prs: null, screen: [], draft: [], runs: [], queued: [], processes: [], artifacts: [], artifactDirs: [], files: [],
    prepare: READINGS.map(([id]) => id), time: 1,
    ...over,
  };
}

const thread = { name: 'projet', status: 'idle', tasks: [] } as unknown as Thread;
const noop = () => {};

// L'écran d'un agent monté ; run relève chaque demande d'action ; draw affiche un relevé.
function screen() {
  const page = document.createElement('div');
  document.body.appendChild(page);
  const root = createRoot(page);
  const kept = createKept();
  const run = vi.fn(async (..._args: unknown[]) => true);
  const acts = {
    run, prefill: noop, follow: noop, save: async () => false, drop: noop, set: noop, mark: noop, draft: noop, open: noop,
    openLink: noop, refresh: noop, attach: noop, pieces: async () => [], process: noop, runOp: noop,
  };
  const draw = (view: VibeView) => act(() => {
    root.render(createElement(VibeCoder, {
      view, thread, act: acts as never, tasks: null, tasksOpen: false, contextOpen: false, onGauge: noop, onTasks: noop,
      onSearch: noop, onSettings: noop, historyOpen: false, onHistory: noop, history: null,
      side: { open: true, width: 400 }, onSide: noop, kept, code: null, children: null,
    }));
  });
  // Les arrêts du fil d'Ariane, dans l'ordre.
  const crumbs = () => [...page.querySelectorAll<HTMLButtonElement>('.vc-jstep')];
  // Les boutons du fil d'Ariane hors de ses arrêts : en relecteur, Préparer la revue seul (ni moteur, ni Express, ni « N commits »).
  const prepare = () => [...page.querySelectorAll<HTMLButtonElement>('.vc-crumbs button:not(.vc-jstep)')];
  return { run, draw, crumbs, prepare };
}

// Ctrl + un chiffre, par la touche, comme au clavier.
const ctrl = (digit: number) => act(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { code: `Digit${digit}`, ctrlKey: true, bubbles: true }));
});

describe('sans geste du relecteur, la page ne demande aucune lecture', () => {
  it('afficher l’écran du relecteur, la PR chargée et cinq lectures à lancer : aucune demande', async () => {
    const s = screen();

    await s.draw(reviewerView('aff'));

    // témoin : Préparer la revue est là, actif : il y avait de quoi lancer
    expect(s.prepare().map((b) => b.disabled)).toEqual([false]);
    // aucune demande d'action au principal
    expect(s.run).not.toHaveBeenCalled();
  });

  it('changer d’arrêt au fil d’Ariane, sur chacun des quatre : aucune demande', async () => {
    const s = screen();
    await s.draw(reviewerView('fil'));

    await act(() => s.crumbs()[1].click());
    await act(() => s.crumbs()[2].click());
    await act(() => s.crumbs()[3].click());
    await act(() => s.crumbs()[0].click());

    // témoin : Préparer la revue est là, actif : il y avait de quoi lancer
    expect(s.prepare().map((b) => b.disabled)).toEqual([false]);
    // témoin : le dernier arrêt choisi est affiché
    expect(s.crumbs()[0].getAttribute('aria-current')).toBe('step');
    // aucune demande d'action au principal
    expect(s.run).not.toHaveBeenCalled();
  });

  it('changer d’arrêt au clavier, Ctrl+2, Ctrl+3, Ctrl+4 : aucune demande', async () => {
    const s = screen();
    await s.draw(reviewerView('clavier'));

    await ctrl(2);
    await ctrl(3);
    await ctrl(4);

    // témoin : Préparer la revue est là, actif : il y avait de quoi lancer
    expect(s.prepare().map((b) => b.disabled)).toEqual([false]);
    // témoin : le quatrième arrêt est affiché
    expect(s.crumbs()[3].getAttribute('aria-current')).toBe('step');
    // aucune demande d'action au principal
    expect(s.run).not.toHaveBeenCalled();
  });

  it('un nouveau relevé, d’autres lectures à lancer : aucune demande', async () => {
    const s = screen();
    await s.draw(reviewerView('releve', { prepare: ['review-note'] }));

    await s.draw(reviewerView('releve', { prepare: ['align', 'review-commits', 'screen'], time: 2 }));

    // témoin : Préparer la revue est là, actif
    expect(s.prepare().map((b) => b.disabled)).toEqual([false]);
    // aucune demande d'action au principal
    expect(s.run).not.toHaveBeenCalled();
  });

  // Cas limite : le relevé d'avant n'avait pas de PR ; celui-ci arrive avec la PR chargée et tout à lancer.
  it('la PR qui vient d’être chargée (un relevé sans PR, puis un avec) : aucune demande', async () => {
    const s = screen();
    await s.draw(reviewerView('charge', { pr: null, loaded: null, prepare: [] }));

    await s.draw(reviewerView('charge', { time: 2 }));

    // témoin : Préparer la revue est là, actif
    expect(s.prepare().map((b) => b.disabled)).toEqual([false]);
    // aucune demande d'action au principal
    expect(s.run).not.toHaveBeenCalled();
  });

  // Cas limite : un arrêt changé après un nouveau relevé, l'un et l'autre sans geste de lecture.
  it('un nouveau relevé puis l’arrêt Publier : aucune demande', async () => {
    const s = screen();
    await s.draw(reviewerView('suite'));

    await s.draw(reviewerView('suite', { time: 2 }));
    await act(() => s.crumbs()[3].click());

    // témoin : Préparer la revue est là, actif : il y avait de quoi lancer
    expect(s.prepare().map((b) => b.disabled)).toEqual([false]);
    // témoin : l'arrêt Publier est affiché
    expect(s.crumbs()[3].getAttribute('aria-current')).toBe('step');
    // aucune demande d'action au principal
    expect(s.run).not.toHaveBeenCalled();
  });
});

// Témoin : avec le geste, la demande part ; les absences ci-dessus viennent bien de l'absence de geste.
describe('témoin : le clic sur Préparer la revue demande les lectures', () => {
  it('un clic sur Préparer la revue : une demande au moins part', async () => {
    const s = screen();
    await s.draw(reviewerView('clic'));

    await act(async () => s.prepare()[0]?.click());

    // une demande d'action est partie
    expect(s.run).toHaveBeenCalled();
  });
});
