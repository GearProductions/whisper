import { describe, expect, it } from 'vitest';
import { DRAFT_MAX, findingDraft, findingTarget, proposedVerdict, remark, remarksAt, reviewSent } from 'core/vibecoder';
import { draftText } from 'shared/review';
import type { VibeCommit, VibeMarkState, VibeView } from 'technicals/bridge';

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

describe('findingTarget', () => {
  it('« code: <titre> », une ligne, la même pour le même constat', () => {
    expect(findingTarget('Doublon dans a.ts')).toBe('code: Doublon dans a.ts');
    expect(findingTarget(' Deux\n lignes\t ')).toBe('code: Deux lignes');
    expect(findingTarget('x')).toBe(findingTarget('x'));
  });

  it('un titre très long : coupé à la borne de la cible (300), et retrouvé par remarksAt', () => {
    const long = 't'.repeat(400);
    const target = findingTarget(long);
    expect(target.length).toBe(300);
    expect(target.startsWith('code: ttt')).toBe(true);
    expect(remarksAt([{ id: 1, target, text: 'a' }], target)).toHaveLength(1);
  });
});

describe('findingDraft', () => {
  it('son titre, puis son détail', () => {
    expect(findingDraft({ title: 'Doublon', body: 'a.ts:3 répète b.ts:9' })).toBe('Doublon\na.ts:3 répète b.ts:9');
  });

  it('sans détail : le titre seul ; blancs de bord retirés', () => {
    expect(findingDraft({ title: ' Doublon ', body: ' \n' })).toBe('Doublon');
    expect(findingDraft({ title: 'T', body: '\n\n détail \n\n' })).toBe('T\ndétail');
  });

  it('un constat très long : coupé à DRAFT_MAX', () => {
    const text = findingDraft({ title: 'T', body: 'x'.repeat(6000) });
    expect(text.length).toBe(DRAFT_MAX);
    expect(text.startsWith('T\nxxx')).toBe(true);
    expect(text.endsWith('…')).toBe(true);
  });
});

const comments = [{ id: 1, target: 'Commit 1', text: 'a' }, { id: 2, target: 'La note', text: 'b' }, { id: 3, target: 'Commit 1', text: 'c' }];

describe('remarksAt', () => {
  it('les remarques de la cible, dans l\'ordre du brouillon ; une cible longue comparée coupée', () => {
    expect(remarksAt(comments, 'Commit 1').map((c) => c.id)).toEqual([1, 3]);
    expect(remarksAt(comments, 'Autre')).toEqual([]);
    const long = 'x'.repeat(400);
    const cut = [{ id: 9, target: remark(long, '').target, text: 't' }];
    expect(remarksAt(cut, long)).toEqual(cut);
  });
});

describe('draftText', () => {
  it('« - [cible] texte » par ligne ; la même fonction pour le principal et la page', () => {
    expect(draftText(comments)).toBe('- [Commit 1] a\n- [La note] b\n- [Commit 1] c');
    expect(draftText([])).toBe('');
  });
});

const commit = (mark?: VibeMarkState): VibeCommit => ({ hash: 'h', subject: 's', fixup: false, files: [], mark });
const verdictView = (note: VibeMarkState, cases: VibeMarkState[], commits: VibeMarkState[]) => ({
  note: { mark: note },
  invariants: [{ cases: cases.map((_, i) => `c${i}`), marks: Object.fromEntries(cases.map((m, i) => [`c${i}`, m])) }],
  commits: commits.map(commit),
}) as unknown as VibeView;

describe('proposedVerdict', () => {
  it('un À revoir sur la note ou un test → request-changes', () => {
    expect(proposedVerdict(verdictView('ok', ['ok', 'ko'], []))).toBe('request-changes');
    expect(proposedVerdict(verdictView('ko', ['ok'], []))).toBe('request-changes');
    expect(proposedVerdict(verdictView('ok', [null, 'ko'], []))).toBe('request-changes');
  });

  it('la note et chaque test validés → approve ; un élément pas jugé ou modifié depuis → null', () => {
    expect(proposedVerdict(verdictView('ok', ['ok', 'ok'], []))).toBe('approve');
    expect(proposedVerdict(verdictView('ok', ['ok', null], []))).toBeNull();
    expect(proposedVerdict(verdictView('changed', ['ok'], []))).toBeNull();
    expect(proposedVerdict(verdictView(null, [], []))).toBeNull();
  });

  it('un commit À revoir resté au relevé : ne compte plus', () => {
    expect(proposedVerdict(verdictView('ok', ['ok'], ['ko']))).toBe('approve');
    expect(proposedVerdict(verdictView('ok', [null], ['ko']))).toBeNull();
    expect(proposedVerdict(verdictView('ok', ['ok'], [null as unknown as VibeMarkState, undefined as unknown as VibeMarkState]))).toBe('approve');
  });

  it('rien de jugé : aucun verdict proposé, même avec des commits', () => {
    expect(proposedVerdict(verdictView(null, [null], ['ok']))).toBeNull();
    expect(proposedVerdict(verdictView(null, [], ['ko']))).toBeNull();
    expect(proposedVerdict({ note: null, invariants: [], commits: [commit('ko')] } as unknown as VibeView)).toBeNull();
  });
});

describe('proposedVerdict, deux cas de même titre', () => {
  const dup = (marks: Record<string, VibeMarkState>) => ({
    note: { mark: 'ok' }, invariants: [{ cases: ['t', 't'], marks }], commits: [],
  }) as unknown as VibeView;

  it('un seul ✓ : pas approve ; les deux : approve ; le second À revoir : request-changes', () => {
    expect(proposedVerdict(dup({ t: 'ok', 't n° 2': null }))).toBeNull();
    expect(proposedVerdict(dup({ t: 'ok', 't n° 2': 'ok' }))).toBe('approve');
    expect(proposedVerdict(dup({ t: 'ok', 't n° 2': 'ko' }))).toBe('request-changes');
  });
});

describe('reviewSent', () => {
  const body = '- [Commit 1] a\n- [La note] b\n- [Commit 1] c';
  const sent = { state: 'CHANGES_REQUESTED', url: null, verdict: 'request-changes' as const, body, at: 1 };

  it('même verdict et même brouillon → true ; un autre verdict seul → false ; une remarque de plus → false', () => {
    expect(reviewSent(sent, comments, 'request-changes')).toBe(true);
    expect(reviewSent(sent, comments, 'approve')).toBe(false);
    expect(reviewSent(sent, [...comments, { id: 4, target: 'x', text: 'y' }], 'request-changes')).toBe(false);
  });

  it('publiée par l\'agent : un saut de ligne final ou des fins de ligne \\r\\n ne changent rien', () => {
    expect(reviewSent({ ...sent, body: `${body}\n` }, comments, 'request-changes')).toBe(true);
    expect(reviewSent({ ...sent, body: `${body}\r\n` }, comments, 'request-changes')).toBe(true);
    expect(reviewSent({ ...sent, body: body.replaceAll('\n', '\r\n') }, comments, 'request-changes')).toBe(true);
    expect(reviewSent({ ...sent, body: `${body}\n` }, comments, 'approve')).toBe(false);
    expect(reviewSent({ ...sent, body: `${body}\n` }, [...comments, { id: 4, target: 'x', text: 'y' }], 'request-changes')).toBe(false);
  });

  it('une revue d\'avant (sans verdict ni texte), ou aucune → false', () => {
    expect(reviewSent({ ...sent, verdict: null, body: null, at: null }, [], 'comment')).toBe(false);
    expect(reviewSent(null, comments, 'request-changes')).toBe(false);
  });
});
