// @vitest-environment happy-dom
// ModulesView (modules-view.tsx) : le 💬 du commit proposé devenu IconButton comment, même action (cite la
// première ligne du message), absent sans l'action comment ; Valider les modules (step.check) et le menu de diff de la
// vue IDE (note 0.15.0-ecran-statuts).
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
const steps = [{ id: 'modules', status: 'current', facts: '' }];   // la vue IDE lit view.steps (diffRefs)
const draw = (actions: { id: string }[]) => act(() => {
  const view = { lang: 'fr', steps, flow: 'create', actions, modules: [], commits: [],
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
const module = (path: string, touched: boolean) => ({ path, paths: [path], contract: 'Fait `x` · ne connaît pas : y', file: { id: path, path }, touched, commits: [],
  ...(touched ? { files: [{ id: `${path}/0`, path: `${path}/a.ts` }] } : {}) });
const followed: unknown[] = [];
const drawModules = () => act(() => {
  const view = { lang: 'fr', steps, flow: 'create', actions: [{ id: 'module' }], commits: [], outputs: {},
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
    const view = { lang: 'fr', steps, flow: 'review', actions, commits: [], pr: { number: 7 },
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
  const view = { lang: 'fr', steps, flow: 'create', actions, commits: [], outputs: {}, modules, ...extra } as unknown as VibeView;
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
    const view = { lang: 'fr', steps, flow: 'create', actions, commits: [], outputs: {}, modules: two } as unknown as VibeView;
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

// Valider les modules et le menu de diff de la vue IDE (note 0.15.0-ecran-statuts).
const marks: unknown[][] = [];
const drawValidation = async (extra: Record<string, unknown>, step: Record<string, unknown> = steps[0], code: unknown = null) => {
  await act(() => root.render(null));
  await act(() => {
    const view = { lang: 'fr', flow: 'create', actions: [], commits: [], outputs: {}, modules: two, modulesView: 'ide', invariants: [], steps: [step], ...extra } as unknown as VibeView;
    const props = { view, step, t: t('fr'), busy: false, text: '', setText: () => {},
      code, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {},
        follow: (id: unknown) => { followed.push(id); }, save: async () => true, set: () => {}, mark: (...a: unknown[]) => { marks.push(a); } } } as unknown as StepProps;
    root.render(createElement(ModulesView, props));
  });
};
const withCheck = (check: Record<string, unknown>, head?: string) => ({ ...steps[0], head, check });
const validate = () => [...page.querySelectorAll<HTMLButtonElement>('.vc-card-acts .vc-vmark button')];
const select = () => page.querySelector('select.vc-mod-shown') as HTMLSelectElement;
const side = () => [...page.querySelectorAll('.vc-ide-side .vc-tree-row:not([aria-expanded])')].map((e) => e.textContent);

it('Valider les modules : offert si step.check.now, envoie \'modules\' ok ; validé : Annuler envoie null', async () => {
  marks.length = 0;
  await drawValidation({}, withCheck({ state: null, now: 'h1' }));
  expect(validate().map((b) => b.textContent)).toEqual(['Valider les modules']);
  await act(() => validate()[0].click());
  expect(marks).toEqual([['modules', 'ok']]);
  marks.length = 0;
  await drawValidation({}, withCheck({ state: 'ok', now: 'h1' }));
  expect(validate().map((b) => b.textContent)).toEqual(['Annuler']);
  await act(() => validate()[0].click());
  expect(marks).toEqual([['modules', null]]);
  await drawValidation({}, withCheck({ state: 'changed', now: 'h2' }));
  expect(validate().map((b) => b.textContent)).toEqual(['Revalider']);
});

it('Valider les modules : pas offert sans rien à valider (now null) ni sans check ; relecteur : ni validation ni menu de diff', async () => {
  await drawValidation({}, withCheck({ state: null, now: null }));
  expect(validate()).toHaveLength(0);
  await drawValidation({});
  expect(validate()).toHaveLength(0);
  await drawValidation({ flow: 'review' }, withCheck({ state: 'ok', now: 'h1' }));
  expect(page.querySelector('.vc-vmark')).toBeNull();
  expect(select()).toBeNull();
});

it('un fichier modifié depuis la validation : « modifiée depuis la validation » passe sur Depuis la validation, l\'arborescence filtrée et son diff', async () => {
  followed.length = 0;
  const diffs = { head: [], validated: { modules: [{ path: 'src/touche/a.ts' }] } };
  const code = { id: 'src/touche/0', text: 'a\nc', time: 1, at: { base: null, head: null, validations: { modules: 'a\nb' } } };
  const step = withCheck({ state: 'changed', now: 'h2' }, 'modifiée depuis la validation');
  await drawValidation({ diffs, files: [{ id: 'f9', path: 'src/zzz.ts' }], variants: [{ path: 'src/zzz.ts' }] }, step, code);
  expect(side().join('|')).toMatch(/a\.ts.*zzz/);
  await act(() => page.querySelector<HTMLButtonElement>('.vc-step-head .vc-since')!.click());
  expect(select().value).toBe('validated');
  expect(side()).toHaveLength(1);
  expect(side()[0]).toContain('a.ts');
  expect(page.querySelector('.vc-ide-main .cm-deletedChunk')?.textContent).toContain('b');
});

it('un fichier supprimé depuis la validation : dans l\'arborescence, suivi par son r<i>, tout en retraits', async () => {
  followed.length = 0;
  const diffs = { head: [], validated: { modules: [{ path: 'src/old.ts', id: 'r0', deleted: true }] } };
  const code = { id: 'r0', text: null, time: 1, at: { base: null, head: null, validations: { modules: 'x\ny' } } };
  await drawValidation({ diffs }, withCheck({ state: 'changed', now: 'h2' }, 'modifiée depuis la validation'), code);
  await act(() => page.querySelector<HTMLButtonElement>('.vc-step-head .vc-since')!.click());
  expect(side()).toHaveLength(1);
  expect(side()[0]).toContain('old.ts');
  expect(followed.at(-1)).toBe('r0');
  expect(page.querySelector('.vc-ide-main .cm-deletedChunk')?.textContent).toContain('x');
});

// T-20 : la vue IDE ou liste et le module déplié, gardés par agent (KeptScope) ; au départ, le dernier choix enregistré (view.modulesView).
const kept = createKept();
const drawAs = async (agent: string, modulesView: 'ide' | 'list') => {
  await act(() => root.render(null));   // le panneau recrée l'écran à chaque changement d'agent
  await act(() => {
    const view = { lang: 'fr', steps, flow: 'create', actions: [], commits: [], outputs: {}, modules: two, modulesView } as unknown as VibeView;
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

it('review.md étiquetée : ses badges, data-tag sur la ligne ; sans étiquette, comme avant', async () => {
  await act(() => root.render(null));
  await act(() => {
    const view = { lang: 'fr', steps, flow: 'create', actions: [], modules: [], commits: [],
      outputs: { 'review.md': { text: '- [agent] un point\n- [toi] un autre\n- sans', time: 0 } } } as unknown as VibeView;
    const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
      code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {},
        follow: () => {}, save: async () => true } } as unknown as StepProps;
    root.render(createElement(ModulesView, props));
  });
  const items = [...page.querySelectorAll<HTMLElement>('.vc-diff-review li')];
  expect(items.map((li) => li.getAttribute('data-tag'))).toEqual(['agent', 'toi', null]);
  expect([...page.querySelectorAll('.vc-diff-review .vc-tag-badge')].map((b) => b.textContent)).toEqual(['pour l\'agent', 'pour toi']);
  expect(page.querySelector('.vc-diff-review')!.textContent).not.toContain('[');
});

// 0.16.0 : les étapes validées par le système, la preuve à l'écran (docs/tickets/feat/0.16.0-controle-en-trois-points.md).
const runs: unknown[][] = [];
const drawProof = async (over: Record<string, unknown> = {}, step: Record<string, unknown> = steps[0], actions: Record<string, unknown>[] = []) => {
  await act(() => root.render(null));
  await act(() => {
    const view = { lang: 'fr', flow: 'create', actions: actions.map((a) => ({ hidden: false, who: '', hint: '', primary: false, step: 'modules', label: a.id, ...a })),
      commits: [], outputs: {}, modules: two, invariants: [], steps: [step], ...over } as unknown as VibeView;
    const props = { view, step, t: t('fr'), busy: false, text: '', setText: () => {},
      code: null, drafts: [{}, () => {}], act: { run: async (...a: unknown[]) => { runs.push(a); return true; }, prefill: () => {}, open: () => {}, openLink: () => {},
        follow: () => {}, save: async () => true, set: () => {}, mark: () => {} } } as unknown as StepProps;
    root.render(createElement(ModulesView, props));
  });
};
const PROOF = '## [prouvé] « une règle »\n\nle mutant a fait échouer le test\n\n## [toi] « une autre »\n\nle test reste vert\n';

it('preuve.md au relevé : sa carte, ses étiquettes en badges, Relancer relance l\'action prove', async () => {
  runs.length = 0;
  await drawProof({ outputs: { 'preuve.md': { text: PROOF, time: 0 } } }, steps[0], [{ id: 'prove', label: 'Prouver les invariants' }]);
  const card = page.querySelector('.vc-proof')!;
  expect(card.querySelector('.vc-card-title')!.textContent).toBe('Preuve des invariants');
  expect(card.querySelector('.vc-card-file')!.textContent).toBe('preuve.md');
  expect([...card.querySelectorAll('.vc-tag-badge')].map((b) => b.textContent)).toEqual(['pour toi']);
  expect(card.textContent).not.toContain('[toi]');
  const again = [...card.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Relancer')!;
  await act(() => again.click());
  expect(runs).toEqual([['prove']]);
});

it('pas de preuve.md : pas de carte ; relecteur : jamais', async () => {
  await drawProof({}, steps[0], [{ id: 'prove' }]);
  expect(page.querySelector('.vc-proof')).toBeNull();
  await drawProof({ flow: 'review', outputs: { 'preuve.md': { text: PROOF, time: 0 } } });
  expect(page.querySelector('.vc-proof')).toBeNull();
});

it('Prouver les invariants : dans la carte des modules, après Générer les modules, avant Commiter les modules ; pas dans l\'en-tête ; masquée : absente', async () => {
  const actions = [{ id: 'commit-modules', label: 'Commiter les modules' }, { id: 'prove', label: 'Prouver les invariants' }, { id: 'modules', label: 'Générer les modules' }];
  await drawProof({ modules: [{ ...module('src/touche', true), uncommitted: true }] }, steps[0], actions);
  expect([...page.querySelectorAll('.vc-card-acts .vc-run-label')].map((b) => b.textContent)).toEqual(['Générer les modules', 'Prouver les invariants', 'Commiter les modules']);
  expect(page.querySelectorAll('.vc-step-acts button')).toHaveLength(0);
  await drawProof({ modules: [{ ...module('src/touche', true), uncommitted: true }] }, steps[0], actions.map((a) => (a.id === 'prove' ? { ...a, hidden: true } : a)));
  expect([...page.querySelectorAll('.vc-card-acts .vc-run-label')].map((b) => b.textContent)).toEqual(['Générer les modules', 'Commiter les modules']);
  expect(page.textContent).not.toContain('Prouver les invariants');
});

it('modules validés par le système : « validée par le système » et son contrôle dans la carte ; Annuler reste ; à la main : « Modules validés »', async () => {
  await drawProof({}, { ...steps[0], check: { state: 'ok', now: null, by: 'system' } });
  const mark = page.querySelector('.vc-card-acts .vc-vmark')!;
  expect(mark.querySelector('.vc-vstate')!.textContent).toBe('validée par le système');
  expect(mark.querySelector('.vc-vby')!.textContent).toBe('conformité à la forme et preuve par mutation');
  expect([...mark.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Annuler']);
  await drawProof({}, { ...steps[0], check: { state: 'ok', now: null } });
  expect(page.querySelector('.vc-card-acts .vc-vstate')!.textContent).toBe('Modules validés');
});

it('Valider les modules, pas validés : en discret (sans vert ni coche), jamais grisé', async () => {
  await drawProof({}, { ...steps[0], check: { state: null, now: 'h1' } });
  const b = page.querySelector<HTMLButtonElement>('.vc-card-acts .vc-vmark button')!;
  expect([b.textContent, b.disabled, b.getAttribute('data-v'), b.querySelector('svg')]).toEqual(['Valider les modules', false, null, null]);
  // l'étape d'avant n'est pas validée : le bouton n'est pas grisé pour autant
  await drawProof({ steps: [{ id: 'invariants', status: 'done', facts: '', check: { state: null, now: null } }, { ...steps[0], check: { state: null, now: 'h1' } }] }, { ...steps[0], check: { state: null, now: 'h1' } });
  expect(page.querySelector<HTMLButtonElement>('.vc-card-acts .vc-vmark button')!.disabled).toBe(false);
  expect(page.querySelector('.vc-vstate[data-state="waiting"]')).toBeNull();
});

it('Relire le diff : sur la ligne de chaque module touché, à la demande (déplié en liste, toujours en vue IDE)', async () => {
  const actions = [{ id: 'module' }, { id: 'review-diff', label: 'Relire le diff' }];
  await drawProof({ modules: two }, steps[0], actions);
  await toggle(0, true);
  expect([...row(0).querySelectorAll('summary .vc-mod-acts button')].map((b) => b.textContent)).toEqual(['Générer', 'Relire le diff', 'Ouvrir']);
  await drawProof({ modules: two, modulesView: 'ide' }, steps[0], actions);
  expect([...page.querySelectorAll('.vc-ide-main .vc-mod-acts button')].map((b) => b.textContent)).toEqual(['Générer', 'Relire le diff', 'Ouvrir']);
});

it('rien à prouver (view.proof none) : l\'étape le dit en une ligne, sinon rien', async () => {
  await drawProof({ proof: { state: 'none', lines: [] } });
  expect(page.querySelector('.vc-mod-noproof')!.textContent).toBe('rien à prouver');
  await drawProof({ proof: { state: 'ok', lines: [] } });
  expect(page.querySelector('.vc-mod-noproof')).toBeNull();
  await drawProof({});
  expect(page.querySelector('.vc-mod-noproof')).toBeNull();
});
