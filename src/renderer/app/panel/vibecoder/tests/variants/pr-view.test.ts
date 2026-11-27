// @vitest-environment happy-dom
// PrView (pr-view.tsx) : en créateur, la carte de la PR et l'état de la CI, sans bouton (note 0.16.0-ecran-essentiel) ;
// en relecteur, comme avant (S'assigner la PR, le brouillon, Publier).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { PrView } from '../../pr-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);

const pr = { number: 7, title: 'Ajouter x', url: 'https://github.com/o/r/pull/7' };
const action = (id: string, label: string, extra: object = {}) => ({ id, label, kind: 'send', step: 'pr', hint: '', ...extra });
const all = [action('pr', 'Valider la feature'), action('ci', 'Diagnostiquer la CI'), action('unassign-pr', 'Me retirer de la PR'),
  action('assign-pr', 'S\'assigner la PR'), action('publish', 'Publier la revue')];

async function show(over: Record<string, unknown>, acts: object = {}) {
  const view = { lang: 'fr', flow: 'create', actions: all, commits: [], draft: [], outputs: {}, ...over } as unknown as VibeView;
  const props = { view, step: { id: 'pr', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    verdict: 'comment', onVerdict: () => {},
    code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {}, mark: () => {}, ...acts } } as unknown as StepProps;
  await act(() => root.render(createElement(PrView, props)));
}
const ci = (text: string) => ({ 'ci.md': { text, time: 0 } });
const buttons = () => [...page.querySelectorAll('button')].map((b) => b.textContent);
const lines = () => [...page.querySelectorAll('li')].map((li) => li.textContent);

it('créateur, une PR : sa carte, son lien', async () => {
  await show({ pr });
  expect(page.querySelector('.vc-pr-number')!.textContent).toBe('#7');
  expect(page.querySelector('.vc-pr-title')!.textContent).toBe('Ajouter x');
  expect(page.querySelector('.vc-pr button[title*="https://github.com/o/r/pull/7"]')).not.toBeNull();
});

const UNKNOWN = 'La PR est ouverte : état de la CI inconnu';
const withCi = (c: unknown, state?: string) => ({ ...pr, ci: c, ...(state ? { state } : {}) });

it('créateur, pr.ci ko : ses checks en échec, un par ligne', async () => {
  await show({ pr: withCi({ state: 'ko', failed: ['lint', 'tests'] }) });
  expect(lines()).toEqual(['lint', 'tests']);
  expect(page.textContent).not.toContain(UNKNOWN);
});

it('créateur, pr.ci ok : rien', async () => {
  await show({ pr: withCi({ state: 'ok', failed: [] }), outputs: ci('✗ x\n\n## lint\n') });
  expect(lines()).toEqual([]);
  expect(page.querySelector('.vc-invite')).toBeNull();
  expect(page.textContent).not.toContain(UNKNOWN);
});

it('créateur, pr.ci pending : « La CI tourne »', async () => {
  await show({ pr: withCi({ state: 'pending', failed: [] }) });
  expect(page.textContent).toContain('La CI tourne');
  expect(lines()).toEqual([]);
});

it('créateur, pr.ci absent ou null : la phrase de la ligne, même avec un ci.md ✓, jamais vert', async () => {
  for (const c of [undefined, null]) {
    for (const outputs of [{}, ci('✓ Tout passe\n'), ci('⏳ en cours\n')]) {
      await show({ pr: withCi(c), outputs });
      expect(page.textContent).toContain(UNKNOWN);
      expect(page.textContent).not.toContain('La CI tourne');
      expect(lines()).toEqual([]);
    }
  }
  await show({ pr: withCi(undefined), lang: 'en' });
  expect(page.textContent).toContain('The PR is open: CI state unknown');
});

it('créateur, une PR fusionnée ou fermée : rien sur la CI', async () => {
  for (const state of ['MERGED', 'CLOSED']) {
    for (const c of [undefined, { state: 'pending', failed: [] }, { state: 'ko', failed: ['lint'] }]) {
      await show({ pr: withCi(c, state), outputs: ci('⏳ en cours\n') });
      expect(page.querySelector('.vc-invite')).toBeNull();
      expect(page.textContent).not.toMatch(/La CI|inconnu/);
      expect(lines()).toEqual([]);
    }
  }
  await show({ pr: withCi({ state: 'pending', failed: [] }, 'OPEN') });
  expect(page.textContent).toContain('La CI tourne');
});

it('créateur : ni Valider la feature, ni Diagnostiquer la CI, ni Relancer, ni Me retirer de la PR', async () => {
  for (const over of [{ pr, outputs: ci('✗ x\n\n## lint\n') }, { pr }, {}, { pr: withCi({ state: 'ko', failed: ['lint'] }) }]) {
    await show(over);
    expect(buttons().filter((b) => /Valider|Diagnostiquer|Relancer|retirer/.test(b ?? ''))).toEqual([]);
    expect(page.textContent).not.toMatch(/Valider la feature|Diagnostiquer|Relancer|Me retirer/);
  }
});

it('créateur, pas de PR : une phrase, sans bouton', async () => {
  await show({});
  expect(page.textContent).toContain('Pas encore de PR');
  expect(page.querySelector('.vc-pr')).toBeNull();
  expect(page.querySelectorAll('.vc-invite button')).toHaveLength(0);
});

it('relecteur : S\'assigner la PR, le brouillon, Publier, comme avant', async () => {
  await show({ flow: 'review', pr });
  expect(buttons()).toEqual(expect.arrayContaining(['S\'assigner la PR']));
  expect(buttons().some((b) => b?.includes('Publier'))).toBe(true);
  expect(page.querySelector('.vc-pr-number')!.textContent).toBe('#7');
});

// ---- La revue essentielle (note 0.16.0-revue-essentielle) : les constats au-dessus du brouillon ----
const MD = 'Intro de la relecture.\n\n## Fuite du jeton\nle jeton part dans le journal';
const review = (over: Record<string, unknown> = {}, runs: unknown[][] = []) => show({ flow: 'review', pr, outputs: { 'pr-7-commits.md': { text: MD, time: 0 } }, ...over },
  { run: async (...a: unknown[]) => { runs.push(a); return true; }, draft: () => {} });

it('relecteur : les constats au-dessus du brouillon', async () => {
  await review();
  const findings = page.querySelector('.vc-findings')!;
  const draft = page.querySelector('.vc-draft')!;
  expect(findings.textContent).toContain('Fuite du jeton');
  expect(findings.compareDocumentPosition(draft) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(page.querySelector('.vc-publish')).not.toBeNull();
});

it('relecteur : le brouillon vide ne cite plus les commits', async () => {
  await review();
  expect(page.querySelector('.vc-draft-empty')!.textContent).toBe(t('fr').essentialReview.draftEmpty);
  expect(page.querySelector('.vc-draft-empty')!.textContent).not.toMatch(/commit/);
});

it('relecteur : le brouillon, le verdict, Publier la revue, comme avant', async () => {
  await review({ draft: [{ id: 1, target: 'note', text: 'bof' }] });
  expect(page.querySelector('.vc-draft')!.textContent).toContain('1 remarque');
  expect([...page.querySelectorAll('.vc-verdicts button')].map((b) => b.textContent)).toEqual(['Approuver', 'Commenter', 'Demander des changements']);
  expect(buttons().some((b) => b?.includes('Publier'))).toBe(true);
});

it('relecteur : S\'assigner la PR lance assign-pr, Me retirer quand le relevé le montre', async () => {
  const runs: unknown[][] = [];
  await review({ actions: [action('assign-pr', 'S\'assigner la PR'), action('publish', 'Publier la revue')] }, runs);
  await act(() => [...page.querySelectorAll('button')].find((b) => b.textContent === 'S\'assigner la PR')!.click());
  expect(runs.map((r) => r[0])).toEqual(['assign-pr']);
  await review({ actions: [action('unassign-pr', 'Me retirer de la PR', { hidden: true }), action('publish', 'Publier la revue')] }, runs);
  expect(buttons()).not.toContain('Me retirer de la PR');
});

it('rien n\'est publié sans le clic sur Publier la revue', async () => {
  const runs: unknown[][] = [];
  await review({}, runs);
  expect(runs).toEqual([]);
  await act(() => [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Publier'))!.click());
  expect(runs.map((r) => r[0])).toEqual(['publish']);
});

it('créateur : ni constats, ni brouillon, même avec une relecture', async () => {
  await show({ pr, outputs: { 'pr-7-commits.md': { text: MD, time: 0 } } });
  expect(page.querySelector('.vc-findings')).toBeNull();
  expect(page.querySelector('.vc-draft')).toBeNull();
});

// La revue reçue (demandé le 27 novembre 2026), en créateur : la décision, puis chaque revue ou commentaire, sa bulle qui le
// cite dans le champ de la conversation (pour le donner à l'agent), et une bulle qui cite toute la revue.
const reviews = {
  decision: 'CHANGES_REQUESTED',
  items: [
    { author: 'bob', state: 'CHANGES_REQUESTED', body: 'Renomme **x**', at: '2026-11-27T10:00:00Z' },
    { author: 'ana', state: 'COMMENTED', body: '', at: '2026-11-27T11:00:00Z' },
  ],
};

it('créateur, une PR relue : la décision, chaque revue (auteur, état, texte mis en forme), une revue sans texte renvoie à GitHub', async () => {
  await show({ pr: { ...pr, state: 'OPEN', ci: { state: 'ok', failed: [] }, reviews } });
  const box = page.querySelector('.vc-received')!;
  expect(box.querySelector('.vc-received-decision')!.textContent).toBe('Changements demandés');
  const items = [...box.querySelectorAll('.vc-received-item')];
  expect(items).toHaveLength(2);
  expect(items[0].textContent).toContain('bob');
  expect(items[0].textContent).toContain('demande des changements');
  expect(items[0].querySelector('strong')!.textContent).toBe('x');
  expect(items[1].textContent).toContain('commentaires dans le code');
});

it('créateur : la bulle d’une revue la cite dans le champ ; celle d’en tête cite toute la revue', async () => {
  const calls: unknown[][] = [];
  await show({ pr: { ...pr, state: 'OPEN', reviews }, actions: [...all, action('comment', '💬', { kind: 'prefill' })] }, { prefill: (...a: unknown[]) => calls.push(a) });
  const bubbles = [...page.querySelectorAll<HTMLButtonElement>('.vc-received button.vc-tool')];
  expect(bubbles).toHaveLength(3);   // en tête, puis une par revue
  await act(() => bubbles[1].click());
  expect(calls[0][0]).toBe('comment');
  expect(calls[0][1]).toContain('bob');
  expect(calls[0][1]).toContain('Renomme **x**');
  await act(() => bubbles[0].click());
  expect(calls[1][1]).toContain('bob');
  expect(calls[1][1]).toContain('ana');
});

it('créateur : sans revue ni décision, rien ; en attente de revue, la décision seule ; sans l’action 💬, pas de bulle', async () => {
  await show({ pr: { ...pr, state: 'OPEN', reviews: { decision: null, items: [] } } });
  expect(page.querySelector('.vc-received')).toBeNull();
  await show({ pr: { ...pr, state: 'OPEN', reviews: { decision: 'REVIEW_REQUIRED', items: [] } } });
  expect(page.querySelector('.vc-received-decision')!.textContent).toBe('En attente de revue');
  await show({ pr: { ...pr, state: 'OPEN', reviews } });
  expect(page.querySelectorAll('.vc-received button.vc-tool')).toHaveLength(0);
});
