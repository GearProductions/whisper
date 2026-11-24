// @vitest-environment happy-dom
// FormeView (forme-view.tsx), en vue IDE : l'arborescence liste les modules ; Structure montre le contrat,
// Code montre ModuleCode ou « ne change pas ce module » ; les outils en IconButton (comment → act.prefill,
// open → act.open), l'état « touché » avec Icon ok ; hors du code act.follow(null) ; sans note : l'Invite,
// puis les fichiers de la branche ; le commit proposé (ProposedCommit) sous l'en-tête ; le menu de diff de la vue
// (useIdeDiff 'forme' : l'arborescence filtrée, un supprimé depuis la référence, « modifiée depuis la validation »
// → Depuis la validation) et Valider la forme d'après step.check (note 0.15.0-ecran-statuts).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { createKept, scoped, t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { FormeView } from '../../forme-view';
import { KeptScope } from '../../kept-scope';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const calls: unknown[][] = [];
let scope: ReturnType<typeof scoped> | null = null; // l'état retenu de l'agent affiché (aucun : un état ordinaire)
const modules = [
  { path: 'src/a.ts', paths: ['src/a.ts'], contract: 'le contrat de a', file: { id: 'm0', path: 'src/a.ts' }, touched: true, commits: [],
    files: [{ id: 'm0/0', path: 'src/a.ts' }] },
  { path: 'src/b.ts', paths: ['src/b.ts'], contract: 'le contrat de b', file: null, touched: false, commits: [] },
];
const plain = { id: 'forme', status: 'current', facts: '', open: true };
const draw = (over: Partial<VibeView> & { actions?: { id: string }[] } = {}, step: Record<string, unknown> = plain, code: unknown = null) => act(() => {
  const view = { lang: 'fr', flow: 'create', actions: [], outputs: {}, modules, commits: [{ hash: 'h1', subject: 's', files: [] }], draft: [], note: { formeMark: null },
    agent: { model: 'fable' }, steps: [step], ...over } as unknown as VibeView;
  const props = { view, step, t: t('fr'), busy: false, text: '', setText: () => {},
    code, drafts: [{}, () => {}],
    act: { run: async (...a: unknown[]) => { calls.push(['run', ...a]); return true; }, mark: (...a: unknown[]) => { calls.push(['mark', ...a]); }, set: () => {}, prefill: (...a: unknown[]) => { calls.push(['prefill', ...a]); },
      open: (id: string) => { calls.push(['open', id]); }, openLink: () => {}, follow: (id: unknown) => { calls.push(['follow', id]); },
      save: async () => true, draft: (op: unknown) => { calls.push(['draft', op]); } } } as unknown as StepProps;
  root.render(createElement(KeptScope.Provider, { value: scope }, createElement(FormeView, props)));
});
const tool = (label: string) => page.querySelectorAll<HTMLButtonElement>(`.vc-ftools button[aria-label="${label}"]`);
const rows = () => [...page.querySelectorAll('.vc-ide-side [role="treeitem"], .vc-ide-side li')].map((e) => e.textContent);
const choose = (name: string) => act(() => {
  [...page.querySelectorAll<HTMLElement>('.vc-ide-side button, .vc-ide-side [role="treeitem"]')].find((e) => e.textContent?.includes(name))!.click();
});
const swap = (label: string) => act(() => {
  [...page.querySelectorAll<HTMLButtonElement>('.vc-seg button')].find((b) => b.textContent === label)!.click();
});

it('l\'arborescence liste les modules ; le premier est choisi, Structure montre son contrat', async () => {
  await draw();
  expect(rows().join('|')).toMatch(/a\.ts/);
  expect(rows().join('|')).toMatch(/b\.ts/);
  expect(page.querySelector('.vc-fcontract')!.textContent).toContain('le contrat de a');
  await choose('b.ts');
  expect(page.querySelector('.vc-fcontract')!.textContent).toContain('le contrat de b');
  expect(page.querySelector('.vc-fstate')!.textContent).toBe('à créer');
});

it('les outils en IconButton, même action ; Icon ok devant « touché » ; sans glyphes', async () => {
  await choose('a.ts');
  await draw({ actions: [{ id: 'comment' }] as never });
  expect(page.textContent).not.toMatch(/[💬✓]/u);
  expect(tool('Citer ce module dans le champ')).toHaveLength(1);
  expect(tool('Ouvrir dans l\'éditeur')).toHaveLength(1);
  for (const b of page.querySelectorAll('.vc-ftools button')) {
    expect(b.className).toBe('vc-tool');
    expect(b.getAttribute('title')).toBe(b.getAttribute('aria-label'));
    expect(b.querySelector('svg')).not.toBeNull();
  }
  calls.length = 0;
  tool('Citer ce module dans le champ')[0].click();
  tool('Ouvrir dans l\'éditeur')[0].click();
  expect(calls).toEqual([['prefill', 'comment', 'src/a.ts'], ['open', 'm0']]);
  const touched = page.querySelector('.vc-fstate[data-state="touched"]')!;
  expect(touched.textContent).toBe('touché');
  expect(touched.querySelector('svg')).not.toBeNull();
  await draw();
  expect(tool('Citer ce module dans le champ')).toHaveLength(0);
});

it('Code : ModuleCode d\'un module touché, « ne change pas » sinon ; hors du code, follow(null)', async () => {
  await choose('a.ts');
  calls.length = 0;
  await swap('Code');
  expect(page.querySelector('.vc-fcontract')).toBeNull();
  expect(calls).toContainEqual(['follow', 'm0/0']);
  await swap('Structure');
  expect(calls.at(-1)).toEqual(['follow', null]);
  await choose('b.ts');
  await swap('Code');
  expect(page.textContent).toContain('la branche ne change pas ce module');
});

it('sans note : l\'Invite, puis les fichiers de la branche et leur code', async () => {
  calls.length = 0;
  await draw({ note: null, modules: [], files: [{ id: 'f0', path: 'src/x.ts' }] } as never);
  expect(page.textContent).toContain('Pas encore de note');
  expect(page.querySelector('.vc-fcontract')).toBeNull();
  expect(rows().join('|')).toMatch(/x\.ts/);
  expect(calls).toContainEqual(['follow', 'f0']);
  await draw({ note: null, modules: [], files: [] } as never);
  expect(page.querySelector('.vc-ide')).toBeNull();
});

it('le commit proposé (un fixup de la note) : sa carte sous l\'en-tête, ✓ Commiter dans la carte, pas dans l\'en-tête ; aucune carte sans commit.md', async () => {
  const actions = [{ id: 'commit', label: '✓ Commiter' }, { id: 'commit-prepare', label: 'Préparer le commit' }]
    .map((a) => ({ hidden: false, who: '', hint: '', primary: false, step: 'modules', models: [], kind: 'send', ...a }));
  await draw({ actions, outputs: { 'commit.md': { text: 'fixup! 0.13.0 : note\n', time: 1 } } } as unknown as Partial<VibeView>);
  expect(page.querySelector('.vc-proposed .vc-commit-msg')?.textContent).toBe('fixup! 0.13.0 : note');
  expect(page.querySelector('.vc-proposed .vc-commit-foot .vc-run-label')?.textContent).toBe('✓ Commiter');
  expect(page.querySelector('.vc-step-acts')).toBeNull();
  await draw({ actions } as unknown as Partial<VibeView>);
  expect(page.querySelector('.vc-proposed')).toBeNull();
});

it('sans Forme : le texte d\'aide ne cite plus de champ, en français et en anglais', async () => {
  await draw({ modules: [], files: [] } as never);
  expect(page.textContent).toContain('Pas encore de forme');
  expect(page.textContent).toContain('« Poser la forme » rédige');
  expect(page.textContent).not.toContain('champ');
  await draw({ modules: [], files: [], lang: 'en' } as never);
  expect(page.textContent).toContain('No shape yet');
  expect(page.textContent).not.toContain('field');
});

const remarks = [{ id: 7, target: 'forme: src/a.ts', text: 'ce contrat est flou' }, { id: 8, target: 'forme: src/b.ts', text: 'pour b' }];

it('une remarque sur un module : sous lui, grisée, modifiable sur place ; pas en créateur', async () => {
  calls.length = 0;
  await draw({ flow: 'review', draft: remarks } as never);
  await choose('a.ts');
  await swap('Structure');
  const list = page.querySelector('.vc-fmain .vc-draft-list')!;
  expect(list.classList.contains('vc-remarks-muted')).toBe(true);
  expect([...list.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['ce contrat est flou']);
  expect(page.querySelector('.vc-fcontract')!.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await act(() => page.querySelector<HTMLButtonElement>('.vc-draft-list button[aria-label="Modifier cette remarque"]')!.click());
  const ta = page.querySelector<HTMLTextAreaElement>('.vc-fmain textarea')!;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, 'plus net');
  await act(async () => { ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(() => [...page.querySelectorAll<HTMLButtonElement>('button.vc-run')].find((b) => b.textContent === 'Enregistrer')!.click());
  expect(calls).toContainEqual(['draft', { edit: { id: 7, text: 'plus net' } }]);
  await act(() => page.querySelector<HTMLButtonElement>('.vc-draft-list button[aria-label="Retirer du brouillon"]')!.click());
  expect(calls).toContainEqual(['draft', { remove: 7 }]);
  await draw({ draft: remarks } as never);
  expect(page.querySelector('.vc-draft-list')).toBeNull();
});

it('Poser une question sur un module : son chemin cité dans le champ, rien d\'envoyé ; absent en créateur', async () => {
  calls.length = 0;
  await draw({ flow: 'review' } as never);
  const ask = tool('Poser une question à l\'agent');
  expect(ask).toHaveLength(1);
  await act(() => ask[0].click());
  expect(calls).toEqual([['prefill', 'comment', 'src/a.ts']]);
  expect(tool('Commenter ce module (brouillon de revue)')).toHaveLength(1);
  await draw();
  expect(tool('Poser une question à l\'agent')).toHaveLength(0);
});

// Le menu de diff de la vue IDE et la validation de la forme (note 0.15.0-ecran-statuts).
const since = { ...plain, head: 'modifiée depuis la validation', check: { state: 'changed', now: 'h2' } };
const diffs = (validated: unknown[], head: unknown[] = []) => ({ diffs: { head, validated: { forme: validated } } });
const select = () => page.querySelector('select.vc-mod-shown') as HTMLSelectElement;
const pick = (v: string) => act(() => { select().value = v; select().dispatchEvent(new Event('change', { bubbles: true })); });
const side = () => [...page.querySelectorAll('.vc-ide-side .vc-tree-row:not([aria-expanded])')].map((e) => e.textContent);

it('« modifiée depuis la validation » cliqué : Depuis la validation, l\'arborescence ne liste que les fichiers modifiés', async () => {
  await draw(diffs([{ path: 'src/a.ts' }]) as never, since);
  expect(side().join('|')).toMatch(/a\.ts.*b\.ts/);
  expect(select().value).toBe('base');
  await act(() => page.querySelector<HTMLButtonElement>('.vc-step-head .vc-since')!.click());
  expect(select().value).toBe('validated');
  expect(side()).toHaveLength(1);
  expect(side()[0]).toContain('a.ts');
});

it('Depuis le dernier commit : ses fichiers ; rien de modifié : grisé, retour à la base', async () => {
  await draw(diffs([], [{ path: 'src/b.ts' }]) as never);
  await pick('head');
  expect(side()).toHaveLength(1);
  expect(side()[0]).toContain('b.ts');
  await draw(diffs([]) as never);
  expect(page.querySelector('.vc-ide-side .vc-empty')).toBeNull();
  expect(page.textContent).toContain('Depuis le dernier commit (rien de modifié)');
});

it('un supprimé depuis la référence : dans l\'arborescence (r<i> suivi), son diff tout en retraits', async () => {
  calls.length = 0;
  const gone = { path: 'src/old.ts', id: 'r0', deleted: true };
  const code = { id: 'r0', text: null, time: 1, at: { base: null, head: null, validations: { forme: 'x\ny' } } };
  await draw(diffs([gone]) as never, since, code);
  await act(() => page.querySelector<HTMLButtonElement>('.vc-step-head .vc-since')!.click());
  expect(side()).toHaveLength(1);
  expect(side()[0]).toContain('old.ts');
  expect(calls).toContainEqual(['follow', 'r0']);
  expect(page.querySelector('.vc-ide-main .cm-deletedChunk')?.textContent).toContain('x');
});

it('relecteur : ni menu de diff, ni validation', async () => {
  await draw({ flow: 'review', ...diffs([{ path: 'src/a.ts' }]) } as never, since);
  expect(select()).toBeNull();
  expect(page.querySelector('.vc-ide-bar')).toBeNull();
  expect(side().join('|')).toMatch(/a\.ts.*b\.ts/);
  expect(page.querySelector('.vc-vmark')).toBeNull();
});

const valider = () => [...page.querySelectorAll<HTMLButtonElement>('.vc-forme .vc-vmark button')].map((b) => b.textContent);

it('Valider la forme suit step.check : ok → Annuler (envoie null) ; changed ou cascade → Revalider ; jamais validée → Valider', async () => {
  calls.length = 0;
  await draw({}, { ...plain, check: { state: null, now: 'h1' } });
  expect(valider()).toEqual(['Valider la forme']);
  await act(() => page.querySelector<HTMLButtonElement>('.vc-forme .vc-vmark button')!.click());
  expect(calls).toEqual([['mark', 'forme', 'ok']]);
  calls.length = 0;
  await draw({}, { ...plain, check: { state: 'ok', now: 'h1' } });
  expect(valider()).toEqual(['Annuler']);
  await act(() => page.querySelector<HTMLButtonElement>('.vc-forme .vc-vmark button')!.click());
  expect(calls).toEqual([['mark', 'forme', null]]);
  await draw({}, { ...plain, check: { state: 'cascade', cause: 'note', now: null } });
  expect(valider()).toEqual(['Revalider']);
});

it('l\'onglet choisi, la vue recréée sous le même agent : le même ; un autre agent : Structure', async () => {
  const kept = createKept();
  const pressed = () => page.querySelector('.vc-fline .vc-seg [aria-pressed="true"]')!.textContent;
  scope = scoped(kept, 'a1', 'forme');
  await act(() => root.render(null));
  await draw();
  await swap('Code');
  await act(() => root.render(null));
  await draw();
  expect(pressed()).toBe('Code');
  scope = scoped(kept, 'a2', 'forme');
  await act(() => root.render(null));
  await draw();
  expect(pressed()).toBe('Structure');
  scope = null;
});

// 0.16.0 : la Forme validée par le système (docs/tickets/feat/0.16.0-controle-en-trois-points.md).
it('Forme validée par le système : « validée par le système » et son contrôle ; Annuler reste ; à la main : « Forme validée »', async () => {
  await draw({}, { ...plain, check: { state: 'ok', now: null, by: 'system' } });
  expect(page.querySelector('.vc-forme .vc-vstate')!.textContent).toBe('validée par le système');
  expect(page.querySelector('.vc-forme .vc-vby')!.textContent).toBe('squelettes posés');
  expect(valider()).toEqual(['Annuler']);
  await draw({}, { ...plain, check: { state: 'ok', now: null } });
  expect(page.querySelector('.vc-forme .vc-vstate')!.textContent).toBe('Forme validée');
  expect(page.querySelector('.vc-forme .vc-vby')).toBeNull();
});

it('Forme pas validée : Valider la forme en discret (sans vert ni coche), jamais grisé, même si la note attend', async () => {
  const note = { id: 'note', status: 'done', facts: '', check: { state: null, now: null } };
  await draw({ steps: [note, { ...plain, check: { state: null, now: null } }] } as never, { ...plain, check: { state: null, now: null } });
  const b = page.querySelector<HTMLButtonElement>('.vc-forme .vc-vmark button')!;
  expect([b.textContent, b.disabled, b.getAttribute('data-v'), b.querySelector('svg')]).toEqual(['Valider la forme', false, null, null]);
  expect(page.querySelector('.vc-vstate[data-state="waiting"]')).toBeNull();
});
