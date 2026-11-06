// @vitest-environment happy-dom
// ModulesView (modules-view.tsx) : le 💬 du commit proposé devenu IconButton comment, même action (cite la
// première ligne du message), absent sans l'action comment.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { createKept, scoped, t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { KeptScope } from '../../kept-scope';
import { ModulesView } from '../../modules-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const prefills: unknown[][] = [];
const draw = (actions: { id: string }[]) => act(() => {
  const view = { lang: 'fr', flow: 'create', actions, modules: [], commits: [],
    outputs: { 'commit.md': { text: 'feat : sujet\n\ncorps\n', time: 0 } } } as unknown as VibeView;
  const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: (...a: unknown[]) => { prefills.push(a); }, open: () => {},
      openLink: () => {}, follow: () => {}, save: async () => true } } as unknown as StepProps;
  root.render(createElement(ModulesView, props));
});
const quote = () => page.querySelector<HTMLButtonElement>('button[aria-label="Citer le message dans le champ"]');

it('commit proposé : IconButton comment, cite le sujet ; absent sans l\'action', async () => {
  await draw([{ id: 'comment' }]);
  expect(page.textContent).not.toContain('💬');
  expect(quote()!.className).toBe('vc-tool');
  expect(quote()!.title).toBe('Citer le message dans le champ');
  expect(quote()!.querySelector('svg')).not.toBeNull();
  quote()!.click();
  expect(prefills).toEqual([['comment', 'feat : sujet']]);
  await draw([]);
  expect(quote()).toBeNull();
});

// Le module : un accordéon ; replié, sa ligne et Générer (Commiter s'il a des fichiers pas commités) ; déplié, tous ses
// outils sur sa ligne et son contrat par rubrique.
const module = (path: string, touched: boolean) => ({ path, contract: 'Fait `x` · ne connaît pas : y', file: { id: path, path }, touched, commits: [],
  ...(touched ? { files: [{ id: `${path}/0`, path: `${path}/a.ts` }] } : {}) });
const followed: unknown[] = [];
const drawModules = () => act(() => {
  const view = { lang: 'fr', flow: 'create', actions: [{ id: 'module' }], commits: [], outputs: {},
    modules: [module('src/touche', true), module('src/autre', false)] } as unknown as VibeView;
  const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {},
      follow: (id: unknown) => { followed.push(id); }, save: async () => true } } as unknown as StepProps;
  root.render(createElement(ModulesView, props));
});
const row = (i: number) => page.querySelectorAll<HTMLDetailsElement>('details.vc-mod-main')[i];
const toggle = (i: number, open: boolean) => act(async () => { row(i).open = open; });

it('un module : replié, Générer seul, sans fichiers ; déplié, tous ses outils sur sa ligne, contrat par rubrique, le fichier suivi ; un seul déplié, sans code ou replié : plus aucun fichier suivi', async () => {
  await drawModules();
  const acts = (i: number) => [...row(i).querySelectorAll('summary .vc-mod-acts button')].map((b) => b.textContent);
  expect(row(0).open).toBe(false);
  expect(acts(0)).toEqual(['Générer']);
  await toggle(0, true);
  expect(acts(0)).toEqual(['Générer', 'Ouvrir']);
  expect(row(0).querySelector('.vc-fcontract code')?.textContent).toBe('x');
  expect(row(0).querySelector('.vc-mod-tree')).not.toBeNull();
  expect(followed).toEqual(['src/touche/0']);
  // un seul déplié ; déplier un module sans code, ou replier : plus aucun fichier suivi
  await toggle(1, true);
  expect([row(0).open, row(1).open]).toEqual([false, true]);
  expect(row(1).querySelector('.vc-mod-tree')).toBeNull();
  expect(followed).toEqual(['src/touche/0', null]);
  await toggle(1, false);
  expect(followed).toEqual(['src/touche/0', null, null]);
});

// Relecteur : les modules en lecture, sans commit.md ni review.md ; son relevé n'a que 'review-commits' (laissé à CommitsSection),
// donc ni Générer ni Commiter ; le code en lecture seule, sans Enregistrer.
it('relecteur : ni commit.md, review.md, Générer, Commiter, Enregistrer ; l\'en-tête ne répète pas Relire les commits', async () => {
  const actions = ['review-commits'].map((id) => ({ id, step: 'modules', hidden: false, who: '', hint: '', label: id }));
  await act(() => {
    const view = { lang: 'fr', flow: 'review', actions, commits: [], pr: { number: 7 },
      outputs: { 'commit.md': { text: 'x', time: 0 }, 'review.md': { text: 'y', time: 0 } },
      modules: [{ ...module('src/touche', true), uncommitted: true }] } as unknown as VibeView;
    const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
      code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {},
        follow: () => {}, save: async () => true } } as unknown as StepProps;
    root.render(createElement(ModulesView, props));
  });
  await toggle(0, true);
  expect(page.querySelector('.vc-proposed, .vc-diff-review')).toBeNull();
  expect([...page.querySelectorAll('.vc-mod-acts button')].map((b) => b.textContent)).toEqual(['Ouvrir']);
  const labels = [...page.querySelectorAll('button')].map((b) => b.textContent);
  expect(labels).not.toContain('Commiter');
  expect(labels).not.toContain('Enregistrer');
  expect(page.querySelector('.vc-step-head .vc-step-acts')).toBeNull();
  expect(page.querySelectorAll('.vc-commit-list')).toHaveLength(1);
});

// Deux vues (view.modulesView) : liste par défaut ; IDE : l'arborescence des fichiers des modules, la couleur du nom de chaque
// fichier, à droite les outils du module du fichier choisi ; l'interrupteur envoie act.set({ modulesView }).
const sets: unknown[] = [];
const drawView = async (extra: Record<string, unknown>, modules: unknown[]) => {
  await act(() => root.render(null));   // la vue et le module déplié sont tenus par le composant : chaque tracé repart de la vue de départ
  await act(() => {
  const actions = ['module', 'review-diff'].map((id) => ({ id, hidden: false, who: '', hint: '', label: id }));
  const view = { lang: 'fr', flow: 'create', actions, commits: [], outputs: {}, modules, ...extra } as unknown as VibeView;
  const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {},
      follow: (id: unknown) => { followed.push(id); }, save: async () => true, set: (x: unknown) => { sets.push(x); } } } as unknown as StepProps;
  root.render(createElement(ModulesView, props));
  });
};
const two = [{ ...module('src/touche', true), uncommitted: true }, module('src/autre', false)];
const pressed = () => [...page.querySelectorAll('.vc-card-end .vc-seg button')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

it('liste par défaut : l\'accordéon d\'aujourd\'hui, l\'interrupteur sur Vue liste', async () => {
  await drawView({}, two);
  expect(page.querySelector('.vc-ide')).toBeNull();
  expect(page.querySelectorAll('details.vc-mod-main')).toHaveLength(2);
  expect(pressed()).toEqual(['Vue liste']);
});

it('vue IDE : arborescence aux noms colorés, outils du module du fichier choisi, code ; sans code, plus aucun fichier suivi ; l\'interrupteur demande modulesView', async () => {
  followed.length = 0;
  await drawView({ modulesView: 'ide' }, two);
  expect(page.querySelector('details.vc-mod-main')).toBeNull();
  expect(pressed()).toEqual(['Vue IDE']);
  const side = page.querySelector('.vc-ide-side')!;
  expect(side.textContent).toContain('a.ts');
  expect(side.textContent).toContain('autre');
  expect(side.querySelector('[data-mark="todo"]')?.textContent).toContain('autre');   // pas touché : à générer
  expect([...page.querySelectorAll('.vc-ide-main .vc-mod-acts button')].map((b) => b.textContent)).toEqual(['Générer', 'Relire le diff', 'Ouvrir']);
  expect(page.querySelector('.vc-ide-main .vc-mod-head > .vc-mod-acts')).not.toBeNull();   // sur la ligne du sélecteur
  expect(followed).toEqual(['src/touche/0']);
  // le fichier d'un module pas touché : ses outils seuls (Générer, Ouvrir), plus aucun fichier suivi
  const other = [...side.querySelectorAll<HTMLElement>('button, [role="treeitem"]')].find((b) => b.textContent?.includes('autre'))!;
  await act(async () => { other.click(); });
  expect([...page.querySelectorAll('.vc-ide-main .vc-mod-acts button')].map((b) => b.textContent)).toEqual(['Générer', 'Ouvrir']);
  expect(followed.at(-1)).toBeNull();
  // l'interrupteur
  sets.length = 0;
  await act(async () => { [...page.querySelectorAll<HTMLButtonElement>('.vc-card-end .vc-seg button')].find((b) => b.textContent === 'Vue liste')!.click(); });
  expect(sets).toEqual([{ modulesView: 'list' }]);
});

it('sans module : les fichiers de la branche, dans les deux vues, sans interrupteur', async () => {
  for (const modulesView of ['list', 'ide']) {
    await drawView({ modulesView, files: [{ id: 'f0', path: 'src/x/b.ts' }] }, []);
    expect(page.querySelector('.vc-ide-side')!.textContent).toContain('b.ts');
    expect(page.querySelector('.vc-card-end .vc-seg')).toBeNull();
    expect(page.querySelector('.vc-ide-main .vc-mod-acts')).toBeNull();
  }
});

it('le numéro d\'ordre de chaque module, celui de la Forme, en liste comme en vue IDE ; aucun sans module', async () => {
  await drawView({}, two);
  expect([...page.querySelectorAll('.vc-mod-rank')].map((r) => r.textContent)).toEqual(['1', '2']);
  expect(page.querySelector('.vc-mod-rank')!.getAttribute('title')).toBe('Ordre de génération : 1 sur 2');
  await drawView({ modulesView: 'ide' }, two);
  const side = page.querySelector('.vc-ide-side')!;
  const rankOf = (name: string) => [...side.querySelectorAll('.vc-tree-row')].find((r) => r.textContent?.includes(name))?.querySelector('.vc-tree-rank')?.textContent;
  expect(rankOf('a.ts')).toBe('1');
  expect(rankOf('autre')).toBe('2');
  await drawView({ modulesView: 'ide', files: [{ id: 'f0', path: 'src/x/b.ts' }] }, []);
  expect(page.querySelector('.vc-tree-rank')).toBeNull();
});

it('créateur : l\'en-tête vide ; dans la carte, Générer les modules et Commiter les modules (un module pas commité) ; sur chaque ligne, Générer seul, sans Commiter', async () => {
  const actions = [{ id: 'module', label: 'Générer ce module' }, { id: 'commit-modules', label: 'Commiter les modules' }, { id: 'review-diff', label: 'Relire le diff' },
    { id: 'commit-prepare', label: 'Préparer le commit' }, { id: 'modules', primary: true, label: 'Générer les modules' }]
    .map((a) => ({ hidden: false, who: '', hint: '', primary: false, step: 'modules', ...a }));
  await act(() => root.render(null));   // tout replié
  await act(() => {
    const view = { lang: 'fr', flow: 'create', actions, commits: [], outputs: {}, modules: two } as unknown as VibeView;
    const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
      code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {}, follow: () => {}, save: async () => true } } as unknown as StepProps;
    root.render(createElement(ModulesView, props));
  });
  expect(page.querySelectorAll('.vc-step-acts button')).toHaveLength(0);   // ni Générer ce module, ni Préparer le commit, ni Relire le diff
  expect([...page.querySelectorAll('.vc-card-acts .vc-run-label')].map((b) => b.textContent)).toEqual(['Générer les modules', 'Commiter les modules']);
  expect(page.querySelector('.vc-card-acts .vc-run')!.getAttribute('data-tone')).toBe('accent');   // la prochaine action
  const line = (i: number) => [...page.querySelectorAll('.vc-mod')[i].querySelectorAll('summary .vc-mod-acts button')].map((b) => b.textContent);
  expect([line(0), line(1)]).toEqual([['Générer'], ['Générer']]);   // pas de Commiter, même pas commité
});

// T-20 : la vue IDE ou liste et le module déplié, gardés par agent (KeptScope) ; au départ, le dernier choix enregistré (view.modulesView).
const kept = createKept();
const drawAs = async (agent: string, modulesView: 'ide' | 'list') => {
  await act(() => root.render(null));   // le panneau recrée l'écran à chaque changement d'agent
  await act(() => {
    const view = { lang: 'fr', flow: 'create', actions: [], commits: [], outputs: {}, modules: two, modulesView } as unknown as VibeView;
    const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
      code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {},
        follow: () => {}, save: async () => true, set: () => {} } } as unknown as StepProps;
    root.render(createElement(KeptScope.Provider, { value: scoped(kept, agent, 'modules') }, createElement(ModulesView, props)));
  });
};
const press = (label: string) => act(async () => { [...page.querySelectorAll<HTMLButtonElement>('.vc-card-end .vc-seg button')].find((b) => b.textContent === label)!.click(); });

it('la vue IDE choisie, un autre agent jamais vu : la vue de départ', async () => {
  await drawAs('a', 'list');
  await press('Vue IDE');
  expect(page.querySelector('.vc-ide')).not.toBeNull();
  await drawAs('b', 'list');
  expect(page.querySelector('.vc-ide')).toBeNull();
  expect(pressed()).toEqual(['Vue liste']);
});

it('revenu au premier agent : sa vue IDE et son module déplié', async () => {
  await drawAs('c', 'list');
  await toggle(0, true);
  await press('Vue IDE');
  await drawAs('d', 'list');
  await toggle(1, true);
  await drawAs('c', 'list');
  expect(page.querySelector('.vc-ide')).not.toBeNull();
  await press('Vue liste');
  expect([row(0).open, row(1).open]).toEqual([true, false]);
  await drawAs('d', 'list');
  expect([row(0).open, row(1).open]).toEqual([false, true]);
});
