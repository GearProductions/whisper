import { describe, expect, it } from 'vitest';
import { caseLine, casesOf, progress, pseudoLines } from 'core/vibecoder';
import type { ReadingCase, VibeTestFile } from 'technicals/bridge';

const reading = (title: string, warning: string | null = null): ReadingCase => ({ title, pseudo: 'it("x")', edges: [], guarantees: 'g', warning });
const file = (over: Partial<VibeTestFile> = {}): VibeTestFile => ({
  id: 't0', path: 'tests/invariants/a.test.ts', blob: 'b', cases: ['refuse', 'accepte'], lines: [4, 12], reading: null, marks: {}, ...over,
});

describe('caseLine', () => {
  it('la ligne du cas, d\'après son rang dans cases', () => {
    expect(caseLine(file(), 'accepte')).toBe(12);
  });

  it('cas inconnu, lignes manquantes ou pas des lignes : undefined', () => {
    expect(caseLine(file(), 'autre')).toBeUndefined();
    expect(caseLine(file({ lines: [4] }), 'accepte')).toBeUndefined();
    expect(caseLine(file({ lines: [0, 2.5] }), 'refuse')).toBeUndefined();
    expect(caseLine(file({ lines: [0, 2.5] }), 'accepte')).toBeUndefined();
  });
});

describe('casesOf', () => {
  it('pas lu : chaque cas sans lecture, sa validation', () => {
    expect(casesOf(file({ marks: { refuse: 'ok' } }))).toEqual([
      { title: 'refuse', reading: null, mark: 'ok' }, { title: 'accepte', reading: null, mark: null },
    ]);
  });

  it('lu : la lecture de même titre, quel que soit son rang', () => {
    const r = [reading('accepte'), reading('refuse')];
    expect(casesOf(file({ reading: r })).map((c) => c.reading)).toEqual([r[1], r[0]]);
  });

  it('titre réécrit par la lecture : celle de même rang, si la lecture a autant de cas', () => {
    const r = [reading('refuse une dépense'), reading('accepte')];
    expect(casesOf(file({ reading: r })).map((c) => c.reading)).toEqual([r[0], r[1]]);
    expect(casesOf(file({ reading: [reading('autre')] })).map((c) => c.reading)).toEqual([null, null]);
  });

  it('une lecture de même rang qui porte le titre d\'un autre cas : pas prise deux fois', () => {
    const r = [reading('accepte'), reading('autre')];
    expect(casesOf(file({ reading: r })).map((c) => c.reading)).toEqual([null, r[0]]);
  });
});

describe('progress', () => {
  it('compte validés, refusés, modifiés depuis, points d\'attention, cas à lire', () => {
    const files = [
      file({ reading: [reading('refuse', 'un seul couple de valeurs'), reading('accepte')], marks: { refuse: 'ko', accepte: 'changed' } }),
      file({ id: 't1', cases: ['x', 'y'], marks: { x: 'ok' } }),
    ];
    expect(progress(files)).toEqual({ total: 4, ok: 1, ko: 1, changed: 1, warnings: 1, unread: 2, all: false });
  });

  it('Tout valider : chaque cas lu, aucun point d\'attention, un au moins sans verdict', () => {
    const r = [reading('refuse'), reading('accepte')];
    expect(progress([file({ reading: r })]).all).toBe(true);
    expect(progress([file({ reading: r, marks: { refuse: 'ko', accepte: 'changed' } })]).all).toBe(true);
    expect(progress([file({ reading: r, marks: { refuse: 'ok', accepte: 'ko' } })]).all).toBe(false);
    expect(progress([file({ reading: [reading('refuse', 'mock'), reading('accepte')] })]).all).toBe(false);
    expect(progress([file({ reading: [reading('refuse')] })]).all).toBe(false);
    expect(progress([]).all).toBe(false);
  });
});

describe('pseudoLines', () => {
  const code = [
    'it("une dépense qui dépasse est refusée", () => {',
    '  // étant donné : solde 90, plafond 100',
    '  // Quand: on dépense 20',
    '  const r = spend(90, 20, 100)',
    '  // alors : refusée',
    '  expect(r).toBeNull()',
    '  await expect(p).rejects.toThrow()',
    '})',
  ].join('\n');

  it('bout à bout, les lignes redonnent le code tel quel', () => {
    for (const c of [code, '', '/* sur\ndeux lignes */ x', 'a\n\nb']) {
      expect(pseudoLines(c).map((l) => l.parts.map((p) => p.text).join('')).join('\n')).toBe(c);
    }
  });

  it('les assertions : les lignes qui commencent par expect (await compris)', () => {
    expect(pseudoLines(code).map((l) => l.assert)).toEqual([false, false, false, false, false, true, true, false]);
  });

  it('« étant donné / quand / alors » en tête d\'un commentaire : repérés, casse comprise', () => {
    const steps = pseudoLines(code).flatMap((l) => l.parts.filter((p) => p.kind === 'step').map((p) => p.text));
    expect(steps).toEqual(['étant donné :', 'Quand:', 'alors :']);
    expect(pseudoLines('// given: x\n// then y\n// whenever z').flatMap((l) => l.parts.filter((p) => p.kind === 'step').map((p) => p.text)))
      .toEqual(['given:', 'then']);
  });

  it('le reste coloré comme tokens : mots-clés, chaînes, nombres', () => {
    const kinds = pseudoLines('const n = "a" // 1').flatMap((l) => l.parts.map((p) => p.kind));
    expect(kinds).toEqual(['keyword', 'text', 'string', 'text', 'comment']);
  });
});
