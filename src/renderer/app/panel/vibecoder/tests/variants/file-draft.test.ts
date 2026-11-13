// @vitest-environment happy-dom
// useFileDraft (file-draft.tsx) : le disque suivi, la modification gardée,
// périmée si le disque change, abandonnée ou enregistrée ; grisé, le disque.
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { VibeCode } from 'technicals/bridge';
import { useFileDraft, type Drafts, type FileDraft } from '../../file-draft';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const file = { id: 'm1/0', path: 'src/a.ts' };

function mount(onSave: (id: string, text: string) => Promise<boolean> = async () => true) {
  let d!: FileDraft;
  const root = createRoot(document.createElement('div'));
  const Probe = ({ code, locked }: { code: VibeCode | null; locked: string | null }) => {
    d = useFileDraft(file, code, locked, onSave, useState<Drafts>({}));
    return null;
  };
  const render = (code: VibeCode | null, locked: string | null = null) =>
    act(() => { root.render(createElement(Probe, { code, locked })); });
  return { render, get d() { return d; } };
}

it('suit le disque, garde la modification, périmée quand le disque change, abandonnée', async () => {
  const v = mount();
  await v.render({ id: 'm1/0', text: 'a', time: 1 });
  expect(v.d.text).toBe('a');
  await act(() => v.d.change('b'));
  expect(v.d).toMatchObject({ text: 'b', draft: true, stale: false });
  await v.render({ id: 'm1/0', text: 'c', time: 2 });
  expect(v.d).toMatchObject({ text: 'b', draft: true, stale: true });
  await v.render({ id: 'm1/0', text: 'c', time: 2 }, 'verrou');
  expect(v.d.text).toBe('c');
  await v.render({ id: 'm1/0', text: 'c', time: 2 });
  await act(() => v.d.drop());
  expect(v.d).toMatchObject({ text: 'c', draft: false, stale: false });
});

it('enregistrée : écrite par onSave, supprimée quand le disque la rejoint', async () => {
  const saved: string[] = [];
  const v = mount(async (_, text) => { saved.push(text); return true; });
  await v.render({ id: 'm1/0', text: 'a', time: 1 });
  await act(() => v.d.change('b'));
  await act(() => v.d.save());
  expect(saved).toEqual(['b']);
  await v.render({ id: 'm1/0', text: 'b', time: 2 });
  expect(v.d).toMatchObject({ text: 'b', draft: false });
});

it('un texte poussé pour un autre fichier est ignoré ; sans texte : trop gros', async () => {
  const v = mount();
  await v.render({ id: 'm1/1', text: 'x', time: 1 });
  expect(v.d).toMatchObject({ text: null, tooBig: false });
  await v.render({ id: 'm1/0', text: null, time: 1 });
  expect(v.d).toMatchObject({ text: null, tooBig: true });
});

it('DraftEditor : le pied sous le code, ou dans la rangée d\'outils de CodeView (footInTools)', async () => {
  const { DraftEditor } = await import('../../file-draft');
  const { t } = await import('core/vibecoder');
  const d = { text: 'a', draft: true, stale: false, tooBig: false, change() {}, save: async () => {}, drop() {} } as FileDraft;
  const render = async (footInTools?: boolean) => {
    const div = document.createElement('div');
    await act(() => { createRoot(div).render(createElement(DraftEditor, { d, file, locked: null, t: t('fr'), onQuote: () => {}, footInTools })); });
    return div;
  };
  const under = await render();
  expect(under.querySelector('.vc-src-tools .vc-mod-code-foot')).toBeNull();
  expect(under.querySelector('.vc-mod-code-foot')).not.toBeNull();
  const inTools = await render(true);
  expect(inTools.querySelector('.vc-src-tools .vc-mod-code-foot')).not.toBeNull();
  expect(inTools.querySelectorAll('.vc-mod-code-foot')).toHaveLength(1);
});

// ── useCaseDraft : le bloc d'un cas, modifiable seul ──
import { caseRange } from 'core/vibecoder';
import type { VibeTestFile } from 'technicals/bridge';
import { useCaseDraft } from '../../file-draft';

const DISK = ["describe('x', () => {", "  it('a', () => {", '    expect(1).toBe(1);', '  });', '', "  it('b', () => {", '    expect(2).toBe(2);', '  });', '});', ''].join('\n');
const tfile = (source: string): VibeTestFile => ({
  id: 'i0', path: 'src/x.test.ts', blob: '0'.repeat(40), cases: ['a', 'b'], lines: [2, 6], source, reading: null, marks: {},
});
const BLOCK_A = ["  it('a', () => {", '    expect(1).toBe(1);', '  });'].join('\n');
const BLOCK_B = ["  it('b', () => {", '    expect(2).toBe(2);', '  });', '});'].join('\n');

type CaseProps = { f: VibeTestFile; code: VibeCode | null; locked: string | null; range?: 'auto' | null };

// Deux éditeurs (cas 0 et 1) du même fichier, qui partagent leurs modifications gardées.
function mountCases(onSave: (id: string, text: string) => Promise<boolean>) {
  let a!: FileDraft, b!: FileDraft, all!: Drafts;
  const root = createRoot(document.createElement('div'));
  const Probe = ({ f, code, locked, range = 'auto' }: CaseProps) => {
    const drafts = useState<Drafts>({});
    all = drafts[0];
    a = useCaseDraft(f, 'a', range === null ? null : caseRange(f, 0), code, locked, onSave, drafts);
    b = useCaseDraft(f, 'b', caseRange(f, 1), code, locked, onSave, drafts);
    return null;
  };
  const render = (f: VibeTestFile, code: VibeCode | null, locked: string | null = null, range: 'auto' | null = 'auto') =>
    act(() => { root.render(createElement(Probe, { f, code, locked, range })); });
  return { render, get a() { return a; }, get b() { return b; }, get all() { return all; } };
}

const disk = (text: string | null, time = 1): VibeCode => ({ id: 'i0', text, time });

it('useCaseDraft : le bloc seul est montré', async () => {
  const v = mountCases(async () => true);
  await v.render(tfile(DISK), disk(DISK));
  expect(v.a).toMatchObject({ text: BLOCK_A, draft: false, stale: false, tooBig: false });
  expect(v.b.text).toBe(BLOCK_B);
});

it('useCaseDraft : modifié puis enregistré, onSave reçoit le fichier dont seul le bloc change', async () => {
  const saved: [string, string][] = [];
  const v = mountCases(async (id, text) => { saved.push([id, text]); return true; });
  await v.render(tfile(DISK), disk(DISK));
  await act(() => v.a.change("  it('a', () => {\n    expect(0).toBe(0);\n  });"));
  expect(v.a).toMatchObject({ draft: true, stale: false });
  await act(() => v.a.save());
  expect(saved).toEqual([['i0', DISK.replace('expect(1).toBe(1)', 'expect(0).toBe(0)')]]);
});

it('useCaseDraft : le disque changé depuis l\'ouverture (≠ file.source) : stale, rien d\'envoyé', async () => {
  const saved: string[] = [];
  const v = mountCases(async (_, text) => { saved.push(text); return true; });
  await v.render(tfile(DISK), disk('// ajouté\n' + DISK, 2));
  await act(() => v.a.change('x'));
  expect(v.a.stale).toBe(true);
  await act(() => v.a.save());
  expect(saved).toEqual([]);
  await act(() => v.a.drop());
  expect(v.a).toMatchObject({ draft: false, stale: false });
});

it('useCaseDraft : le disque changé depuis le début de la modification : stale, rien d\'envoyé', async () => {
  const saved: string[] = [];
  const v = mountCases(async (_, text) => { saved.push(text); return true; });
  await v.render(tfile(DISK), disk(DISK, 1));
  await act(() => v.a.change('x'));
  await v.render(tfile(DISK), disk(DISK, 2));
  expect(v.a.stale).toBe(true);
  await act(() => v.a.save());
  expect(saved).toEqual([]);
});

it('useCaseDraft : deux cas du même fichier, deux modifications gardées à part', async () => {
  const v = mountCases(async () => true);
  await v.render(tfile(DISK), disk(DISK));
  await act(() => v.a.change('A'));
  await act(() => v.b.change('B'));
  expect(Object.keys(v.all).sort()).toEqual(['src/x.test.ts#a', 'src/x.test.ts#b']);
  expect([v.a.text, v.b.text]).toEqual(['A', 'B']);
  await act(() => v.a.drop());
  expect([v.a.text, v.b.text]).toEqual([BLOCK_A, 'B']);
});

it('useCaseDraft : enregistré, le bloc est supprimé quand le disque le rejoint', async () => {
  const v = mountCases(async () => true);
  await v.render(tfile(DISK), disk(DISK));
  const block = "  it('a', () => {\n    expect(0).toBe(0);\n  });";
  await act(() => v.a.change(block));
  await act(() => v.a.save());
  const next = DISK.replace('expect(1).toBe(1)', 'expect(0).toBe(0)');
  await v.render(tfile(next), disk(next, 2));
  expect(v.a).toMatchObject({ text: block, draft: false, stale: false });
});

it('useCaseDraft : plage inconnue : rien à montrer ; texte du disque absent : trop gros ; pas de texte poussé : rien', async () => {
  const v = mountCases(async () => true);
  await v.render(tfile(DISK), disk(DISK), null, null);
  expect(v.a).toMatchObject({ text: null, tooBig: false });
  await v.render(tfile(DISK), disk(null));
  expect(v.a).toMatchObject({ text: null, tooBig: true });
  const w = mountCases(async () => true);
  await w.render(tfile(DISK), null);
  expect(w.a).toMatchObject({ text: null, tooBig: false });
});

it('useCaseDraft : grisé, le bloc du disque, rien d\'envoyé ; rien modifié, rien d\'envoyé', async () => {
  const saved: string[] = [];
  const v = mountCases(async (_, text) => { saved.push(text); return true; });
  await v.render(tfile(DISK), disk(DISK));
  await act(() => v.a.save());
  await act(() => v.a.change('x'));
  await v.render(tfile(DISK), disk(DISK), 'verrou');
  expect(v.a.text).toBe(BLOCK_A);
  await act(() => v.a.save());
  expect(saved).toEqual([]);
  await v.render(tfile(DISK), disk(DISK));
  expect(v.a.text).toBe('x');
});

it('useCaseDraft : un fichier en \\r\\n : le bloc est montré en \\n, le fichier rendu garde ses \\r\\n', async () => {
  const crlf = DISK.replace(/\n/g, '\r\n');
  const saved: string[] = [];
  const v = mountCases(async (_, text) => { saved.push(text); return true; });
  await v.render(tfile(crlf), disk(crlf));
  expect(v.a.text).toBe(BLOCK_A);
  await act(() => v.a.change("  it('a', () => {\n    expect(0).toBe(0);\n  });"));
  await act(() => v.a.save());
  expect(saved).toEqual([crlf.replace('expect(1).toBe(1)', 'expect(0).toBe(0)')]);
});
