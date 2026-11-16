import { describe, expect, it } from 'vitest';
import type { VibeTestFile } from 'shared/bridge';
import {
  caseBlocks, caseHashes, caseMarkState, caseTarget, caseTitles, convertCaseMarks, setCaseMark, type Marks,
} from 'core/vibecoder';

const H = { hash: 'b1', common: 'c1' };
const T = 'case:tests/invariants/a.test.ts:t';

describe('caseTarget', () => {
  it('« case:<chemin>:<clé> »', () => {
    expect(caseTarget('tests/invariants/a.test.ts', 't')).toBe(T);
  });
});

describe('caseMarkState : l\'état d\'un cas', () => {
  const cases: [string, Marks, { hash: string; common: string }, ReturnType<typeof caseMarkState>][] = [
    ['même bloc et même common : le verdict ok', { [T]: { hash: 'b1', common: 'c1', verdict: 'ok' } }, H, 'ok'],
    ['même bloc et même common : le verdict ko', { [T]: { hash: 'b1', common: 'c1', verdict: 'ko' } }, H, 'ko'],
    ['bloc changé : changed', { [T]: { hash: 'b0', common: 'c1', verdict: 'ok' } }, H, 'changed'],
    ['bloc et common changés : changed', { [T]: { hash: 'b0', common: 'c0', verdict: 'ok' } }, H, 'changed'],
    ['common seul changé : common', { [T]: { hash: 'b1', common: 'c0', verdict: 'ok' } }, H, 'common'],
    ['marque sans common : changed', { [T]: { hash: 'b1', verdict: 'ok' } }, H, 'changed'],
    ['sans marque : null', {}, H, null],
    ['la marque d\'un autre cas ne compte pas', { [`${T} n° 2`]: { hash: 'b1', common: 'c1', verdict: 'ok' } }, H, null],
  ];
  it.each(cases)('%s', (_name, marks, hashes, expected) => {
    expect(caseMarkState(marks, T, hashes)).toBe(expected);
  });

  it('une cible héritée d\'Object.prototype n\'est pas une marque', () => {
    expect(caseMarkState({}, 'constructor', H)).toBeNull();
  });
});

describe('setCaseMark', () => {
  it('pose { hash, verdict, common }', () => {
    expect(setCaseMark({}, T, H, 'ko')).toEqual({ [T]: { hash: 'b1', verdict: 'ko', common: 'c1' } });
  });

  it('null oublie la marque, les autres restent', () => {
    const marks: Marks = { [T]: { hash: 'b1', common: 'c1', verdict: 'ok' }, note: { hash: 'n', verdict: 'ok' } };
    expect(setCaseMark(marks, T, H, null)).toEqual({ note: { hash: 'n', verdict: 'ok' } });
  });

  it('sur « t n° 2 » : la marque de « t » est inchangée', () => {
    const t1 = { hash: 'b1', common: 'c1', verdict: 'ok' as const };
    const marks: Marks = { [T]: t1 };
    const next = setCaseMark(marks, caseTarget('tests/invariants/a.test.ts', 't n° 2'), { hash: 'b2', common: 'c1' }, 'ok');
    expect(next[T]).toEqual(t1);
    expect(next['case:tests/invariants/a.test.ts:t n° 2']).toEqual({ hash: 'b2', common: 'c1', verdict: 'ok' });
  });

  it('ne modifie pas son entrée', () => {
    const marks: Marks = { [T]: { hash: 'b0', common: 'c0', verdict: 'ok' } };
    const copy = structuredClone(marks);
    setCaseMark(marks, T, H, 'ko');
    setCaseMark(marks, T, H, null);
    expect(marks).toEqual(copy);
  });
});

describe('caseHashes', () => {
  const file = (path: string, cases: string[], hashes?: VibeTestFile['hashes']) => ({ path, cases, hashes }) as VibeTestFile;
  const a = file('tests/invariants/a.test.ts', ['t', 'u', 't'], { blocks: ['b1', 'b2', 'b3'], common: 'c1' });

  it('la clé d\'un titre unique', () => {
    expect(caseHashes([a], `case:${a.path}:`+'u')).toEqual({ hash: 'b2', common: 'c1' });
  });

  it('un titre en double : « t » le premier, « t n° 2 » le second', () => {
    expect(caseHashes([a], `case:${a.path}:`+'t')).toEqual({ hash: 'b1', common: 'c1' });
    expect(caseHashes([a], `case:${a.path}:`+'t n° 2')).toEqual({ hash: 'b3', common: 'c1' });
  });

  it('une clé qui contient « : »', () => {
    const f = file('x.test.ts', ['a: b'], { blocks: ['b9'], common: 'c' });
    expect(caseHashes([f], caseTarget(f.path, 'a: b'))).toEqual({ hash: 'b9', common: 'c' });
  });

  it('un chemin préfixe d\'un autre : le bon fichier', () => {
    const short = file('a.test.ts', ['x'], { blocks: ['s'], common: 'cs' });
    const long = file('a.test.ts:b', ['x'], { blocks: ['l'], common: 'cl' });
    expect(caseHashes([short, long], caseTarget('a.test.ts:b', 'x'))).toEqual({ hash: 'l', common: 'cl' });
    expect(caseHashes([short, long], caseTarget('a.test.ts', 'x'))).toEqual({ hash: 's', common: 'cs' });
  });

  it('null : clé inconnue, fichier inconnu, fichier sans hashes, pas un « case: »', () => {
    expect(caseHashes([a], `case:${a.path}:`+'zzz')).toBeNull();
    expect(caseHashes([a], caseTarget('autre.test.ts', 't'))).toBeNull();
    expect(caseHashes([file('b.test.ts', ['t'])], caseTarget('b.test.ts', 't'))).toBeNull();
    expect(caseHashes([a], 'note')).toBeNull();
    expect(caseHashes([a], `check:${a.path}:t`)).toBeNull();
  });
});

describe('convertCaseMarks : les validations d\'avant, sur le fichier entier', () => {
  const path = 'tests/invariants/a.test.ts';
  const text = [
    "describe('d', () => {",
    "  it('t', () => {",
    '    expect(1).toBe(1);',
    '  });',
    "  it('u', () => {",
    '    expect(2).toBe(2);',
    '  });',
    "  it('t', () => {",
    '    expect(3).toBe(3);',
    '  });',
    '});',
  ].join('\n');
  const blob = 'blob-of-file';
  const tests = [{ path, blob, text }];
  const { keys, blocks, common } = caseBlocks(text);
  const mark = (i: number, verdict: 'ok' | 'ko') => ({ hash: blocks[i], verdict, common });

  it('fichier inchangé : chaque cas de ce titre reçoit la marque, même verdict', () => {
    expect(keys).toEqual(['t', 'u', 't n° 2']);
    const old: Marks = { [`case:${path}:u`]: { hash: blob, verdict: 'ko' } };
    expect(convertCaseMarks(old, tests)).toEqual({ [`case:${path}:u`]: mark(1, 'ko') });
  });

  it('deux cas de même titre : les deux, sous leurs clés', () => {
    const old: Marks = { [`case:${path}:t`]: { hash: blob, verdict: 'ok' } };
    expect(convertCaseMarks(old, tests)).toEqual({
      [`case:${path}:t`]: mark(0, 'ok'),
      [`case:${path}:t n° 2`]: mark(2, 'ok'),
    });
  });

  it('ko aussi, et les autres marques restent', () => {
    const note = { hash: 'n', verdict: 'ok' as const };
    const old: Marks = { note, [`case:${path}:t`]: { hash: blob, verdict: 'ko' } };
    const next = convertCaseMarks(old, tests);
    expect(next.note).toBe(note);
    expect(next[`case:${path}:t n° 2`].verdict).toBe('ko');
  });

  it('fichier changé : marque laissée', () => {
    const old: Marks = { [`case:${path}:t`]: { hash: 'ancien-blob', verdict: 'ok' } };
    expect(convertCaseMarks(old, tests)).toBe(old);
  });

  it('une marque déjà convertie (common) : inchangée, même objet', () => {
    const old: Marks = { [`case:${path}:t`]: mark(0, 'ok') };
    expect(convertCaseMarks(old, tests)).toBe(old);
  });

  it('un fichier hors relevé, un titre qui n\'y est plus : laissés, même objet', () => {
    const old: Marks = {
      'case:ailleurs.test.ts:t': { hash: blob, verdict: 'ok' },
      [`case:${path}:disparu`]: { hash: blob, verdict: 'ok' },
    };
    expect(convertCaseMarks(old, tests)).toBe(old);
  });

  it('un chemin préfixe d\'un autre : la marque va au bon fichier', () => {
    const other = { path: `${path}.bak`, blob: 'other', text: "it('t', () => {\n  x();\n});" };
    const old: Marks = { [`case:${path}.bak:t`]: { hash: 'other', verdict: 'ok' } };
    const next = convertCaseMarks(old, [...tests, other]);
    expect(next[`case:${path}.bak:t`].hash).toBe(caseBlocks(other.text).blocks[0]);
  });

  it('un titre avec « : »', () => {
    const t = { path, blob, text: "it('a: b', () => {\n  x();\n});" };
    expect(caseTitles(t.text)).toEqual(['a: b']);
    const next = convertCaseMarks({ [`case:${path}:a: b`]: { hash: blob, verdict: 'ok' } }, [t]);
    expect(next[`case:${path}:a: b`].common).toBe(caseBlocks(t.text).common);
  });

  it('ne modifie pas son entrée', () => {
    const old: Marks = { [`case:${path}:t`]: { hash: blob, verdict: 'ok' } };
    const copy = structuredClone(old);
    convertCaseMarks(old, tests);
    expect(old).toEqual(copy);
  });
});
