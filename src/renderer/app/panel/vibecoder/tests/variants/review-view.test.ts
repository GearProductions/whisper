// @vitest-environment happy-dom
// ReviewView (review-view.tsx), l'écran de l'essentiel (note 0.16.0-ecran-essentiel) : en créateur, une seule carte (avant la
// revue, une ligne qui dit quand elle part ; après, une ligne par vérification en échec, la ponytail review par
// FeedbackView) ; aucun bouton, ni « Avant la PR », ni carte vide ; le relecteur : Relire à l'écran seul, comme avant.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibeView } from 'technicals/bridge';
import { ReviewView } from '../../review-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const action = (id: string) => ({ id, label: id, hint: '', kind: 'run', step: 'revue', who: 'haiku', models: [],
  hidden: false, disabled: null, primary: false }) as unknown as VibeAction;
const out = (text: string, time = 1) => ({ text, time });
const checks = (...items: unknown[]) => out(JSON.stringify({ items }));
const pass = { name: 'lint', ok: true };
const fail = (name: string, detail = '') => ({ name, ok: false, level: 'error', detail });

type Draw = { outputs?: Record<string, { text: string; time: number }>; flow?: string; express?: boolean; lang?: 'fr' | 'en' };
const draw = ({ outputs = {}, flow = 'create', express, lang = 'fr' }: Draw = {}) => act(() => {
  const view = { lang, flow, express, actions: [action('checks'), action('apply'), action('screen')], commits: [{ hash: 'h1', subject: 's', files: [] }],
    checklist: [{ text: 'La note est à jour', done: true }, { text: 'Chaque diff a été relu', done: false }], steps: [], draft: [], screen: [], outputs } as unknown as VibeView;
  const props = { view, step: { id: 'revue', status: 'current', facts: '', open: true }, t: t(lang), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: () => {}, follow: () => {}, mark: () => {}, prefill: () => {},
      draft: () => {}, open: () => {}, openLink: () => {}, save: async () => true } } as unknown as StepProps;
  root.render(createElement(ReviewView, props));
});
const rows = () => [...page.querySelectorAll<HTMLElement>('.vc-check-list li')];
const body = () => page.querySelector('.vc-revue')?.textContent ?? '';

it('avant la revue : une ligne qui dit quand elle part, selon le rythme', async () => {
  await draw();
  expect(body()).toContain('La revue part après votre essai');
  await draw({ express: true });
  expect(body()).toContain('La revue part après les modules');
  expect(body()).not.toContain('votre essai');
  await draw({ lang: 'en', express: true });
  expect(body()).toContain('The review starts after the modules');
  await draw({ lang: 'en' });
  expect(body()).toContain('The review starts after your try');
});

it('la revue faite : plus de ligne d\'attente', async () => {
  await draw({ outputs: { 'checks.json': checks(pass) } });
  expect(page.textContent).not.toContain('revue part');
});

it('toutes les vérifications passent : aucune ligne de vérification, pas de carte vide', async () => {
  await draw({ outputs: { 'checks.json': checks(pass, { name: 'tsc', ok: true }), 'ponytail.md': out('Aligné.') } });
  expect(rows()).toHaveLength(0);
  expect(page.querySelector('.vc-revue')).toBeNull();
});

it('deux vérifications en échec : deux lignes, leur nom, la première ligne de leur détail', async () => {
  await draw({ outputs: { 'checks.json': checks(fail('tsc', 'erreur\nligne 2'), pass, fail('tests')) } });
  expect(rows().map((li) => li.querySelector('.vc-check-name')!.textContent)).toEqual(['tsc', 'tests']);
  expect(rows()[0].getAttribute('data-state')).toBe('ko');
  expect(rows()[0].querySelector('.vc-check-line')!.textContent).toBe('erreur');
  expect(rows()[1].querySelector('.vc-check-line')).toBeNull();
});

it('un avertissement : pas une ligne d\'échec', async () => {
  await draw({ outputs: { 'checks.json': checks({ name: 'lint', ok: true, level: 'warning', detail: 'attention' }, fail('tsc')) } });
  expect(rows().map((li) => li.querySelector('.vc-check-name')!.textContent)).toEqual(['tsc']);
  await draw({ outputs: { 'checks.json': checks({ name: 'lint', ok: true, level: 'warning', detail: 'attention' }) } });
  expect(rows()).toHaveLength(0);
});

it('un checks.json illisible : la carte le dit ; sans commande : rien d\'autre', async () => {
  await draw({ outputs: { 'checks.json': out('{pas du json') } });
  expect(body()).toContain('checks.json illisible');
  expect(rows()).toHaveLength(0);
  await draw({ outputs: { 'checks.json': checks() } });
  expect(page.querySelector('.vc-revue')).toBeNull();
});

it('une vérification en échec `[agent]` : son badge, data-tag, sans l\'étiquette dans le texte', async () => {
  await draw({ outputs: { 'checks.json': checks(fail('tsc', '[agent] erreur\nligne 2'), fail('inv', '[toi]')) } });
  const [tsc, inv] = rows();
  expect(tsc.getAttribute('data-tag')).toBe('agent');
  expect(tsc.querySelector('.vc-tag-badge')!.textContent).toBe('pour l\'agent');
  expect(tsc.querySelector('.vc-check-line')!.textContent).toBe('erreur');
  expect(tsc.textContent).not.toContain('[agent]');
  expect(inv.getAttribute('data-tag')).toBe('toi');
  expect(inv.querySelector('.vc-tag-badge')!.textContent).toBe('pour toi');
});

it('une remarque [toi] : en avant, sans bouton', async () => {
  await draw({ outputs: { 'checks.json': checks(pass), 'ponytail.md': out('- `a.ts:L1` [toi] — contrat à trancher') } });
  expect(body()).toContain('contrat à trancher');
  expect(page.querySelector('details')).toBeNull();
  expect(page.querySelector('button')).toBeNull();
});

it('quatre remarques [agent] : repliées, « 4 »', async () => {
  const md = [1, 2, 3, 4].map((n) => `- \`a.ts:L${n}\` [agent] — remarque ${n}`).join('\n');
  await draw({ outputs: { 'checks.json': checks(pass), 'ponytail.md': out(md) } });
  const fold = page.querySelector('details')!;
  expect(fold.querySelector('summary')!.textContent).toBe('4 pour l\'agent');
  expect(fold.hasAttribute('open')).toBe(false);
});

it('la ponytail review seule, sans checks.json : montrée, sans ligne d\'attente', async () => {
  await draw({ outputs: { 'ponytail.md': out('- [toi] une question') } });
  expect(body()).toContain('une question');
  expect(body()).not.toContain('revue part');
});

it('aucun bouton, aucune case ; ni « Avant la PR », ni carte vide', async () => {
  const md = '- `a.ts:L1` [toi] — q\n- `b.ts:L2` [agent] — a';
  for (const outputs of [{} as Record<string, { text: string; time: number }>, { 'checks.json': checks(fail('tsc', 'x'), pass), 'ponytail.md': out(md), 'ponytail-applied.json': out('{"applied":[]}', 2) }]) {
    await draw({ outputs });
    expect(page.querySelector('button, input')).toBeNull();
    expect(page.querySelector('.vc-a3, .vc-apply-one, .vc-check-again, .vc-remark-pick, .vc-run, .vc-invite')).toBeNull();
    for (const text of ['Avant la PR', 'Pas encore de vérification', 'Pas encore de ponytail review', 'Pas encore de plan de test', 'Relancer', 'Appliquer'])
      expect(page.textContent).not.toContain(text);
  }
});

it('aucun plan de test : rien (EcranSection)', async () => {
  await draw({ outputs: { 'checks.json': checks(pass) } });
  expect(page.querySelector('.vc-plan')).toBeNull();
});

it('le relecteur : Relire à l\'écran seul, comme avant', async () => {
  await draw({ flow: 'review', outputs: { 'checks.json': checks(fail('tsc')), 'ponytail.md': out('- [toi] q') } });
  expect(page.querySelector('.vc-revue')).toBeNull();
  expect(rows()).toHaveLength(0);
  expect(page.querySelector('.vc-invite')!.textContent).toContain('Pas encore de plan de test');
  expect(page.textContent).not.toContain('revue part');
  await draw({ flow: 'review', outputs: { 'ecran.md': out('- [ ] cliquer') } });
  expect(page.querySelector('.vc-plan')).not.toBeNull();
});
