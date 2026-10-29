import { describe, expect, it } from 'vitest';
import { allApplied, quoteRemark, remark, remarkMark } from 'core/vibecoder';

describe('remark', () => {
  it('la cible et le texte, tels quels', () => {
    expect(remark('34349c1 la note', '- a.ts:3 — dupliqué')).toEqual({ target: '34349c1 la note', text: '- a.ts:3 — dupliqué' });
  });

  it('texte vide ou blanc : la cible', () => {
    expect(remark('Commit 34349c1', ' \n ')).toEqual({ target: 'Commit 34349c1', text: 'Commit 34349c1' });
  });

  it('cible sur une seule ligne, espaces resserrés', () => {
    expect(remark(' a\n b\t c ', 'x').target).toBe('a b c');
  });

  it('cible de plus de 300 caractères : coupée à 300 ; texte de plus de 5 000 : à 5 000', () => {
    const r = remark('c'.repeat(400), 't'.repeat(6000));
    expect(r.target.length).toBe(300);
    expect(r.target.endsWith('…')).toBe(true);
    expect(r.text.length).toBe(5000);
    expect(remark('c'.repeat(300), 't'.repeat(5000))).toEqual({ target: 'c'.repeat(300), text: 't'.repeat(5000) });
  });
});

describe('quoteRemark', () => {
  it('la cible du commit ; le chemin, les lignes en bloc de code, puis la remarque', () => {
    expect(quoteRemark('Commit 34349c1', 'src/a.ts', 'const a = 1;\nconst b = 2;', ' dupliqué ')).toEqual({
      target: 'Commit 34349c1',
      text: 'src/a.ts\n```\nconst a = 1;\nconst b = 2;\n```\ndupliqué',
    });
  });

  it('même cible que la carte du commit (comptée sur elle)', () => {
    expect(quoteRemark(' Commit\n34349c1 ', 'a.ts', 'x', 'y').target).toBe(remark(' Commit\n34349c1 ', '').target);
  });

  it('remarque vide : le chemin et les lignes', () => {
    expect(quoteRemark('Commit 1', 'a.ts', 'x', '  ').text).toBe('a.ts\n```\nx\n```');
  });

  it('des ``` dans les lignes : une clôture plus longue', () => {
    expect(quoteRemark('Commit 1', 'a.md', '```ts\nx\n```', 'y').text).toBe('a.md\n````\n```ts\nx\n```\n````\ny');
  });

  it('coupé à DRAFT_MAX, dans les lignes : la remarque reste', () => {
    const { text } = quoteRemark('Commit 1', 'a.ts', 'x'.repeat(6000), 'y');
    expect(text.length).toBe(5000);
    expect(text.endsWith('…\n```\ny')).toBe(true);
  });
});

describe('remarkMark', () => {
  const applied = new Set(['src/a.ts:L12']);

  it('une remarque appliquée : appliquée, course apply en cours ou pas', () => {
    expect(remarkMark('src/a.ts:L12 — yagni: x — y', applied, null)).toBe('applied');
    expect(remarkMark('src/a.ts:L12-30 — delete: x', applied, 'running')).toBe('applied');
  });

  it('pas appliquée, pas de course apply en cours : Appliquer', () => {
    for (const state of [null, 'done', 'failed', 'kept', 'undone'] as const) expect(remarkMark('src/b.ts:L3 — dead: x', applied, state)).toBe('apply');
    expect(remarkMark('une remarque sans clé', applied, null)).toBe('apply');
  });

  it('pendant une course apply (en cours, en attente, arrêtée non tranchée) : rien', () => {
    for (const state of ['running', 'asking', 'stopped'] as const) expect(remarkMark('src/b.ts:L3 — dead: x', applied, state)).toBeNull();
  });
});

describe('allApplied', () => {
  const md = '- `src/a.ts:L12` — yagni: x\n- src/b.ts:L3 — dead: y\n\nnet: -4 lines possible.';

  it('toutes les lignes de liste appliquées : vrai', () => {
    expect(allApplied(md, new Set(['src/a.ts:L12', 'src/b.ts:L3']))).toBe(true);
  });

  it('une remarque pas appliquée, ou sans clé : faux', () => {
    expect(allApplied(md, new Set(['src/a.ts:L12']))).toBe(false);
    expect(allApplied('- src/a.ts:L12 — x\n- pas de clé', new Set(['src/a.ts:L12']))).toBe(false);
  });

  it('aucune remarque (Lean already. Ship.) : faux', () => {
    expect(allApplied('Lean already. Ship.', new Set(['src/a.ts:L12']))).toBe(false);
  });
});
