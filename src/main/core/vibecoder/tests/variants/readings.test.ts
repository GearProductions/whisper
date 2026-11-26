// Variants de readings (note 0.16.0-revue-essentielle) : readEnd pose la marque « read:<action> » d'une lecture finie,
// toPrepare dit celles que « Préparer la revue » lancerait.
import { describe, expect, it } from 'vitest';
import { READINGS, readEnd, toPrepare, type PrepareInput } from 'core/vibecoder';

const H1 = 'a'.repeat(40);
const H2 = 'b'.repeat(40);
const mark = (hash: string) => ({ hash, verdict: 'ok' as const });
const ALL_OUT = ['pr-7-note.md', 'align.md', 'liens.md', 'pr-7-commits.md', 'ecran.md'];
const ALL_MARKS = { 'read:review-note': mark(H1), 'read:align': mark(H1), 'read:review-commits': mark(H1), 'read:screen': mark(H1) };

// Tout lu à la tête H1 : rien à lancer.
const done = (over: Partial<PrepareInput> = {}): PrepareInput => ({
  pr: 7, head: H1, marks: ALL_MARKS, outputs: ALL_OUT, note: true, tests: 1, unread: false, live: [], ...over,
});

describe('readEnd', () => {
  it('une lecture finie : sa marque porte la tête d’où elle est partie', () => {
    expect(readEnd({}, { action: 'screen', state: 'done', head: H1 })).toEqual({ 'read:screen': mark(H1) });
  });

  it('une lecture en échec, ou arrêtée : aucune marque posée', () => {
    for (const state of ['failed', 'stopped'] as const) {
      const marks = { other: mark('x') };
      expect(readEnd(marks, { action: 'screen', state, head: H1 })).toBe(marks);
    }
  });

  it('la tête pas retenue : aucune marque', () => {
    const marks = {};
    expect(readEnd(marks, { action: 'screen', state: 'done', head: null })).toBe(marks);
  });

  it('relue sur une nouvelle tête : la marque d’avant est remplacée', () => {
    expect(readEnd({ 'read:screen': mark(H1) }, { action: 'screen', state: 'done', head: H2 })).toEqual({ 'read:screen': mark(H2) });
  });

  it('les autres marques : inchangées', () => {
    const marks = { note: mark('n'), 'read:align': mark(H1) };
    expect(readEnd(marks, { action: 'screen', state: 'done', head: H2 })).toEqual({ ...marks, 'read:screen': mark(H2) });
  });

  it('une action qui n’est pas une lecture : marks tel quel', () => {
    const marks = {};
    expect(readEnd(marks, { action: 'commit', state: 'done', head: H1 })).toBe(marks);
  });
});

describe('toPrepare', () => {
  it('rien de lu : les cinq, dans l’ordre', () => {
    expect(toPrepare(done({ marks: {}, outputs: [], unread: true }))).toEqual(READINGS);
  });

  it('tout lu à la tête d’aujourd’hui : aucune', () => {
    expect(toPrepare(done())).toEqual([]);
  });

  it('un commit de plus sur la PR : les lectures marquées à l’ancienne tête, pas le pseudo-code des tests inchangés', () => {
    expect(toPrepare(done({ head: H2 }))).toEqual(['review-note', 'align', 'review-commits', 'screen']);
  });

  it('un test changed depuis sa lecture : le pseudo-code à relancer', () => {
    expect(toPrepare(done({ unread: true }))).toEqual(['read-invariants']);
  });

  it('une sortie là sans marque (la lecture a échoué) : à relancer', () => {
    const { 'read:align': _, ...marks } = ALL_MARKS;
    expect(toPrepare(done({ marks }))).toEqual(['align']);
  });

  it('une marque sans sa sortie : à relancer ; align veut align.md et liens.md', () => {
    expect(toPrepare(done({ outputs: ['pr-7-note.md', 'align.md', 'pr-7-commits.md', 'ecran.md'] }))).toEqual(['align']);
    expect(toPrepare(done({ outputs: ALL_OUT.filter((o) => o !== 'ecran.md') }))).toEqual(['screen']);
  });

  it('la sortie d’une autre PR ne compte pas', () => {
    expect(toPrepare(done({ outputs: ALL_OUT.map((o) => o.replace('pr-7', 'pr-8')) }))).toEqual(['review-note', 'review-commits']);
  });

  it('une lecture en cours ou en file : pas relancée (même en double)', () => {
    expect(toPrepare(done({ marks: {}, outputs: [], unread: true, live: ['align', 'align', 'screen', 'read-invariants'] })))
      .toEqual(['review-note', 'review-commits']);
  });

  it('une PR sans note : pas la relecture de la note', () => {
    expect(toPrepare(done({ marks: {}, outputs: [], unread: true, note: false }))).toEqual(['read-invariants', 'align', 'review-commits', 'screen']);
  });

  it('une PR sans test d’invariant : pas le pseudo-code', () => {
    expect(toPrepare(done({ marks: {}, outputs: [], unread: true, tests: 0 }))).toEqual(['review-note', 'align', 'review-commits', 'screen']);
  });

  it('pas de PR chargée : aucune', () => {
    expect(toPrepare(done({ pr: null, marks: {}, outputs: [], unread: true }))).toEqual([]);
  });

  it('la tête inconnue : aucune marque ne la porte, les lectures sont à relancer', () => {
    expect(toPrepare(done({ head: null }))).toEqual(['review-note', 'align', 'review-commits', 'screen']);
  });
});
