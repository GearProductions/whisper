import { describe, expect, it } from 'vitest';
import { attentionQuote, caseLink, caseRange, caseSource, casesOf, replaceRange, ruleGroups, withAttention, progress, pseudoLines } from 'core/vibecoder';
import type { MustNotMark, ReadingCase, VibeNote, VibeProof, VibeTestFile, VibeView } from 'technicals/bridge';

const reading = (title: string, warning: string | null = null): ReadingCase => ({ title, pseudo: 'it("x")', edges: [], guarantees: 'g', warning });
const file = (over: Partial<VibeTestFile> = {}): VibeTestFile => ({
  id: 't0', path: 'tests/invariants/a.test.ts', blob: 'b', cases: ['refuse', 'accepte'], lines: [4, 12], source: '', reading: null, marks: {}, ...over,
});

describe('caseSource', () => {
  const source = ['import x;', '', 'it("refuse", () => {', '  expect(1).toBe(1);', '});', '', '', 'it("accepte", () => {});', ''].join('\n');
  const f = file({ lines: [3, 8], source });

  it('de la ligne du cas à celle du suivant, sans les lignes vides de la fin', () => {
    expect(caseSource(f, 0)).toBe('it("refuse", () => {\n  expect(1).toBe(1);\n});');
  });

  it('le dernier cas : jusqu\'à la fin du fichier', () => {
    expect(caseSource(f, 1)).toBe('it("accepte", () => {});');
  });

  it('pas de texte (fichier trop long), ligne inconnue ou pas une ligne : rien', () => {
    expect(caseSource(file({ lines: [3, 8] }), 0)).toBe('');
    expect(caseSource(f, 2)).toBe('');
    expect(caseSource(file({ lines: [0, 8], source }), 0)).toBe('');
  });

  it('ligne suivante incohérente : jusqu\'à la fin', () => {
    expect(caseSource(file({ lines: [8, 3], source }), 0)).toBe('it("accepte", () => {});');
  });
});

describe('caseRange', () => {
  const source = ['import x;', '', 'it("refuse", () => {', '  expect(1).toBe(1);', '});', '', '', 'it("accepte", () => {});', ''].join('\n');
  const f = file({ lines: [3, 8], source });

  it('le premier cas : de sa ligne à la dernière non vide avant le suivant', () => {
    expect(caseRange(f, 0)).toEqual({ from: 3, to: 5 });
  });

  it('le dernier cas : jusqu\'à la fin du fichier, lignes vides de la fin ôtées', () => {
    expect(caseRange(f, 1)).toEqual({ from: 8, to: 8 });
  });

  it('texte vide, ligne inconnue ou pas une ligne, rang inconnu : null', () => {
    expect(caseRange(file({ lines: [3, 8] }), 0)).toBeNull();
    expect(caseRange(file({ lines: [0, 8], source }), 0)).toBeNull();
    expect(caseRange(file({ lines: [2.5, 8], source }), 0)).toBeNull();
    expect(caseRange(f, 2)).toBeNull();
  });

  it('ligne suivante incohérente : jusqu\'à la fin', () => {
    expect(caseRange(file({ lines: [8, 3], source }), 0)).toEqual({ from: 8, to: 8 });
  });

  it('un fichier sans saut de ligne final, ou en \\r\\n : les mêmes lignes', () => {
    expect(caseRange(file({ lines: [3, 8], source: source.trimEnd() }), 1)).toEqual({ from: 8, to: 8 });
    expect(caseRange(file({ lines: [3, 8], source: source.split('\n').join('\r\n') }), 0)).toEqual({ from: 3, to: 5 });
  });

  it('un cas fait de lignes vides jusqu\'à la fin : au moins sa première ligne', () => {
    expect(caseRange(file({ lines: [2], source: 'a\n\n\n' }), 0)).toEqual({ from: 2, to: 2 });
  });

  it('caseSource rend toujours les lignes de caseRange', () => {
    for (const s of [source, source.trimEnd(), source.split('\n').join('\r\n')]) {
      for (const i of [0, 1]) {
        const g = file({ lines: [3, 8], source: s });
        const r = caseRange(g, i)!;
        expect(caseSource(g, i)).toBe(s.split('\n').slice(r.from - 1, r.to).join('\n').trimEnd());
      }
    }
  });
});

describe('replaceRange', () => {
  const text = 'a\nb\nc\nd\n';

  it('un bloc plus long, plus court, vide : seules les lignes de la plage changent', () => {
    expect(replaceRange(text, { from: 2, to: 3 }, 'x\ny\nz')).toBe('a\nx\ny\nz\nd\n');
    expect(replaceRange(text, { from: 2, to: 3 }, 'x')).toBe('a\nx\nd\n');
    expect(replaceRange(text, { from: 2, to: 3 }, '')).toBe('a\nd\n');
  });

  it('la première et la dernière ligne, un fichier sans saut de ligne final', () => {
    expect(replaceRange(text, { from: 1, to: 1 }, 'x')).toBe('x\nb\nc\nd\n');
    expect(replaceRange('a\nb', { from: 2, to: 2 }, 'x\ny')).toBe('a\nx\ny');
  });

  it('un fichier en \\r\\n : les autres lignes gardent leur \\r, le bloc reçoit celui du fichier, donné en \\n ou en \\r\\n', () => {
    const crlf = 'a\r\nb\r\nc\r\nd\r\n';
    expect(replaceRange(crlf, { from: 2, to: 3 }, 'x\ny')).toBe('a\r\nx\r\ny\r\nd\r\n');
    expect(replaceRange(crlf, { from: 2, to: 3 }, 'x\r\ny')).toBe('a\r\nx\r\ny\r\nd\r\n');
  });

  it('un fichier en \\r\\n sans fin de ligne finale, le bloc à la fin : il garde le \\r\\n', () => {
    expect(replaceRange('a\r\nb\r\nc', { from: 2, to: 3 }, 'x\ny')).toBe('a\r\nx\r\ny');
  });

  it('un fichier en \\n, un bloc en \\r\\n : le bloc prend les \\n du fichier', () => {
    expect(replaceRange(text, { from: 2, to: 2 }, 'x\r\ny')).toBe('a\nx\ny\nc\nd\n');
  });

  it('une plage hors du texte, renversée ou avant la première ligne : null', () => {
    expect(replaceRange(text, { from: 4, to: 9 }, 'x')).toBeNull();
    expect(replaceRange(text, { from: 20, to: 21 }, 'x')).toBeNull();
    expect(replaceRange(text, { from: 3, to: 2 }, 'x')).toBeNull();
    expect(replaceRange(text, { from: 0, to: 2 }, 'x')).toBeNull();
    expect(replaceRange(text, { from: 1.5, to: 2 }, 'x')).toBeNull();
    expect(replaceRange('', { from: 1, to: 1 }, 'x')).toBe('x');
  });
});

describe('casesOf', () => {
  it('pas lu : chaque cas sans lecture, sa validation', () => {
    expect(casesOf(file({ marks: { refuse: 'ok' } }))).toEqual([
      { title: 'refuse', key: 'refuse', reading: null, mark: 'ok' }, { title: 'accepte', key: 'accepte', reading: null, mark: null },
    ]);
  });

  describe('par la clé (titres en double, périmé, code commun)', () => {
    const twin = (over: Partial<VibeTestFile> = {}) => file({ cases: ['x', 'x', 'y'], lines: [1, 5, 9], ...over });
    const x2 = { ...reading('x'), guarantees: 'g2' };

    it('deux cas de même titre : la lecture n° 2 au second, chacun sa marque', () => {
      const r = [reading('x'), x2, reading('y')];
      const cs = casesOf(twin({ reading: r, marks: { x: 'ok', 'x n° 2': 'ko' } }));
      expect(cs.map((c) => c.key)).toEqual(['x', 'x n° 2', 'y']);
      expect(cs.map((c) => c.reading)).toEqual(r);
      expect(cs.map((c) => c.mark)).toEqual(['ok', 'ko', null]);
    });

    it('la marque du premier ne passe pas au second de même titre', () => {
      expect(casesOf(twin({ marks: { x: 'ok' } })).map((c) => c.mark)).toEqual(['ok', null, null]);
      expect(casesOf(twin({ marks: { 'x n° 2': 'changed' } })).map((c) => c.mark)).toEqual([null, 'changed', null]);
    });

    it('la lecture est cherchée par clé, quel que soit son rang', () => {
      const r = [reading('y'), x2, reading('x')];
      expect(casesOf(twin({ reading: r })).map((c) => c.reading)).toEqual([r[1], r[2], r[0]]);   // les « x » de la lecture, dans leur ordre : n° 1 puis n° 2
    });

    it('une lecture de moins de cas : les cas sans lecture de cette clé n\'en ont pas', () => {
      const r = [reading('x'), x2];
      expect(casesOf(twin({ reading: r })).map((c) => c.reading)).toEqual([r[0], r[1], null]);
    });

    it('une lecture de plus de cas que le fichier : les cas du fichier trouvent la leur', () => {
      const r = [reading('z'), reading('refuse'), reading('accepte')];
      expect(casesOf(file({ reading: r })).map((c) => c.reading)).toEqual([r[1], r[2]]);
    });

    it('titres réécrits par la lecture, titres en double : celle de même rang', () => {
      const r = [reading('x un'), reading('x deux'), reading('y')];
      expect(casesOf(twin({ reading: r })).map((c) => c.reading)).toEqual([r[0], r[1], r[2]]);
    });

    it('staleCases : stale sur ce cas seul', () => {
      const r = [reading('x'), x2, reading('y')];
      const cs = casesOf(twin({ reading: r, staleCases: ['x n° 2'] }));
      expect(cs.map((c) => !!c.stale)).toEqual([false, true, false]);
    });

    it('staleCases ou commonChanged absents : aucun cas périmé ni changé par le code commun', () => {
      const cs = casesOf(twin({ reading: [reading('x'), x2, reading('y')] }));
      expect(cs.some((c) => c.stale || c.common)).toBe(false);
    });

    it('commonChanged : common sur ces cas', () => {
      const cs = casesOf(twin({ marks: { x: 'changed', 'x n° 2': 'changed', y: 'changed' }, commonChanged: ['x n° 2', 'y'] }));
      expect(cs.map((c) => !!c.common)).toEqual([false, true, true]);
    });

    it('une clé qui est une propriété d\'Object : pas de marque', () => {
      expect(casesOf(file({ cases: ['toString'], lines: [1] }))[0].mark).toBeNull();
    });
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

  it('staleCases : unread ne compte que le cas périmé, seul', () => {
    const r = [reading('refuse'), reading('accepte')];
    expect(progress([file({ reading: r, staleCases: ['refuse'] })]).unread).toBe(1);
    expect(progress([file({ reading: r, staleCases: ['refuse', 'accepte'] })]).unread).toBe(2);
    expect(progress([file({ reading: r })]).unread).toBe(0);
  });

  it('un cas périmé et sans lecture : compté une fois', () => {
    expect(progress([file({ reading: [reading('accepte')], staleCases: ['refuse', 'accepte'] })]).unread).toBe(2);
  });

  it('deux cas de même titre, le second périmé : lui seul est à relire', () => {
    const f = file({ cases: ['x', 'x'], lines: [1, 5], reading: [reading('x'), reading('x')], staleCases: ['x n° 2'] });
    expect(progress([f]).unread).toBe(1);
  });

  it('Tout valider : aucun point d\'attention, un au moins sans verdict, lus ou pas', () => {
    const r = [reading('refuse'), reading('accepte')];
    expect(progress([file({ reading: r })]).all).toBe(true);
    expect(progress([file({ reading: r, marks: { refuse: 'ko', accepte: 'changed' } })]).all).toBe(true);
    expect(progress([file({ reading: r, marks: { refuse: 'ok', accepte: 'ko' } })]).all).toBe(false);
    expect(progress([file({ reading: [reading('refuse', 'mock'), reading('accepte')] })]).all).toBe(false);
    expect(progress([file({ reading: [reading('refuse')] })]).all).toBe(true);
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

  describe('la forme test "…": (prose)', () => {
    const prose = [
      'test "a spend over the cap is refused":',
      '    given 90 already spent and a cap of 100',
      '    when we spend 20 more',
      '    then the spend is refused   # result is null',
      '    and nothing is stored',
    ].join('\n');
    const kinds = (kind: string) => pseudoLines(prose).flatMap((l) => l.parts.filter((p) => p.kind === kind).map((p) => p.text));

    it('bout à bout, les lignes redonnent le code tel quel', () => {
      expect(pseudoLines(prose).map((l) => l.parts.map((p) => p.text).join('')).join('\n')).toBe(prose);
    });

    it('test en mot-clé ; given, when, then, and en tête de ligne repérés ; les autres mots en texte', () => {
      expect(kinds('keyword')).toEqual(['test']);
      expect(kinds('step')).toEqual(['given', 'when', 'then', 'and']);
    });

    it('les assertions : la ligne then, et les and qui la suivent', () => {
      expect(pseudoLines(prose).map((l) => l.assert)).toEqual([false, false, false, true, true]);
      expect(pseudoLines('test "x":\n  given a\n  and b\n  then c').map((l) => l.assert)).toEqual([false, false, false, true]);
    });

    it('le commentaire après # : sa valeur attendue', () => {
      expect(kinds('comment')).toEqual(['# result is null']);
    });
  });

  it('le reste coloré comme tokens : mots-clés, chaînes, nombres', () => {
    const kinds = pseudoLines('const n = "a" // 1').flatMap((l) => l.parts.map((p) => p.kind));
    expect(kinds).toEqual(['keyword', 'text', 'string', 'text', 'comment']);
  });
});

// 0.9.0-rc.4 : valider ne demande plus d'avoir lu (docs/tickets/fix/0.9.0-vibecoder-etape-invariants.md).
describe('progress, un fichier pas lu', () => {
  it('Tout valider s\'offre sur un fichier pas lu, sans verdict', () => {
    const unread = file({ reading: null });

    // Pas lu n'empêche pas de tout valider.
    expect(progress([unread]).all).toBe(true);
  });
});

describe('attentionQuote', () => {
  it('le cas, puis son point d\'attention, à la ligne', () => {
    expect(attentionQuote('refuse', 'ne couvre pas le vide')).toBe('refuse\nne couvre pas le vide');
  });
});

describe('withAttention', () => {
  it('texte vide ou blanc : l\'attention seule', () => {
    expect(withAttention('', 'a')).toBe('a');
    expect(withAttention('  \n', 'a')).toBe('a');
  });

  it('sinon le texte, une ligne vide, l\'attention ; rien d\'effacé', () => {
    expect(withAttention('mon avis\n', 'a')).toBe('mon avis\n\na');
  });

  it('déjà au bout : inchangé (un second clic n\'ajoute rien)', () => {
    const once = withAttention('mon avis', 'a');
    expect(withAttention(once, 'a')).toBe(once);
    expect(withAttention(`${once}\n`, 'a')).toBe(`${once}\n`);
  });
});

describe('caseLink', () => {
  const line = (text: string, mark: MustNotMark = 'invariant') => ({ text: `${text} → ${mark}`, mark });
  const read = (guarantees: string): ReadingCase => ({ ...reading('t'), guarantees });
  const notes = (...texts: string[]): VibeNote['mustNot'] => texts.map((t) => line(t));
  const A = 'ne jamais effacer le disque';

  it('Garantit cite une ligne → invariant entre « » : note, cette ligne (texte tel que dans mustNot)', () => {
    const mustNot = [line(A), line('autre chose', 'variant')];
    expect(caseLink(read(`Garantit « ${A} » (ligne de la note)`), mustNot)).toEqual({ kind: 'note', lines: [mustNot[0].text] });
  });

  it('blancs, guillemets et apostrophes typographiques différents : rattaché quand même', () => {
    const mustNot = notes('n\'écrit "jamais"   rien\nsur le  disque');
    expect(caseLink(read('il garde "n’écrit “jamais” rien sur le disque"'), mustNot)).toEqual({ kind: 'note', lines: [mustNot[0].text] });
    expect(caseLink(read('« n’écrit « jamais » rien sur le disque »'), mustNot).kind).toBe('note');
    expect(caseLink(read('n\'écrit "jamais"\u00a0rien\u202fsur le disque'), mustNot).kind).toBe('note');
  });

  it('deux lignes citées : les deux, dans l\'ordre de la note', () => {
    const mustNot = notes('première ligne', 'seconde ligne', 'jamais citée');
    expect(caseLink(read('seconde ligne, puis première ligne'), mustNot)).toEqual({ kind: 'note', lines: [mustNot[0].text, mustNot[1].text] });
  });

  it('une ligne à la marque en préfixe (« [invariant] … ») : rattachée par son texte, sans le préfixe', () => {
    const mustNot: VibeNote['mustNot'] = [{ text: `[invariant] ${A}`, mark: 'invariant' }];
    expect(caseLink(read(`garde « ${A} »`), mustNot)).toEqual({ kind: 'note', lines: [mustNot[0].text] });
  });

  it('une citée contenue dans une autre citée : la plus longue seule', () => {
    const mustNot = notes('pas de fuite', 'pas de fuite vers la page');
    expect(caseLink(read('pas de fuite vers la page'), mustNot)).toEqual({ kind: 'note', lines: [mustNot[1].text] });
    // la plus courte seule citée (la longue n'y est pas) : elle reste
    expect(caseLink(read('pas de fuite'), notes('pas de fuite vers la page', 'pas de fuite')).kind).toBe('note');
  });

  it('une ligne → variant (ou sans marque) citée : pas rattachée', () => {
    expect(caseLink(read('texte du variant'), [line('texte du variant', 'variant'), line('texte du variant', null)])).toEqual({ kind: 'none' });
  });

  it('« garde I-12, comme I-3 et I-12 » : spec [I-12, I-3]', () => {
    expect(caseLink(read('garde I-12, comme I-3 et I-12'), [])).toEqual({ kind: 'spec', ids: ['I-12', 'I-3'] });
  });

  it('I-1 n\'est pas I-12, et pas de numéro collé à un mot', () => {
    expect(caseLink(read('garde I-12'), [])).toEqual({ kind: 'spec', ids: ['I-12'] });
    expect(caseLink(read('garde I-1 et I-12 et I-123'), [])).toEqual({ kind: 'spec', ids: ['I-1', 'I-12', 'I-123'] });
    expect(caseLink(read('PI-3, I-x, I-'), [])).toEqual({ kind: 'none' });
  });

  it('une ligne de la note et un I-… : note seule', () => {
    const mustNot = notes(A);
    expect(caseLink(read(`« ${A} », I-4`), mustNot)).toEqual({ kind: 'note', lines: [mustNot[0].text] });
  });

  it('pas de lecture, Garantit vide, citation introuvable : none', () => {
    expect(caseLink(null, notes(A))).toEqual({ kind: 'none' });
    expect(caseLink(read(''), notes(A))).toEqual({ kind: 'none' });
    expect(caseLink(read('une phrase qui ne cite rien'), notes(A))).toEqual({ kind: 'none' });
  });

  it('texte vide avant la flèche : jamais cité ; sans flèche : le texte entier', () => {
    expect(caseLink(read('n\'importe quoi'), [{ text: ' → invariant', mark: 'invariant' }, { text: '', mark: 'invariant' }])).toEqual({ kind: 'none' });
    const bare = [{ text: 'ligne sans flèche', mark: 'invariant' as const }];
    expect(caseLink(read('ligne sans flèche'), bare)).toEqual({ kind: 'note', lines: ['ligne sans flèche'] });
  });

  it('la dernière flèche borne le texte (une flèche dans la ligne reste dedans) ; -> aussi', () => {
    const mustNot = [{ text: 'a → b ne change pas -> invariant', mark: 'invariant' as const }];
    expect(caseLink(read('a → b ne change pas'), mustNot).kind).toBe('note');
    expect(caseLink(read('invariant'), mustNot)).toEqual({ kind: 'none' });
  });
});

// 0.16.0-ecran-essentiel : les tests rangés par ligne « → invariant » de la note.
describe('ruleGroups', () => {
  const A = 'ne jamais effacer le disque', B = 'ne rien envoyer à la page';
  const inv = (text: string) => ({ text: `${text} → invariant`, mark: 'invariant' as const });
  const note = (...mustNot: VibeNote['mustNot']) => ({ mustNot }) as VibeNote;
  const cites = (title: string, guarantees: string): ReadingCase => ({ ...reading(title), guarantees });
  const view = (mustNot: VibeNote['mustNot'] | null, invariants: VibeTestFile[], proof?: VibeProof): Pick<VibeView, 'note' | 'invariants' | 'proof'> =>
    ({ note: mustNot && note(...mustNot), invariants, proof });
  const titles = (cs: { file: VibeTestFile; index: number }[]) => cs.map((c) => c.file.cases[c.index]);
  const f = (id: string, cases: string[], r: ReadingCase[] | null, over: Partial<VibeTestFile> = {}) =>
    file({ id, cases, lines: cases.map((_, i) => i + 1), reading: r, ...over });

  it('deux lignes → invariant : deux règles, dans l\'ordre de la note, leur texte tel qu\'écrit', () => {
    const g = ruleGroups(view([inv(B), inv(A)], []));
    expect(g.rules.map((r) => r.line)).toEqual([`${B} → invariant`, `${A} → invariant`]);
  });

  it('une ligne → variant suffit : pas une règle', () => {
    const g = ruleGroups(view([inv(A), { text: 'autre → variant suffit', mark: 'variant' }, { text: 'sans marque', mark: null }], []));
    expect(g.rules.map((r) => r.line)).toEqual([`${A} → invariant`]);
  });

  it('un cas dont la lecture cite une ligne : sous cette ligne, avec son rang, son fichier et sa vue', () => {
    const a = f('a', ['x', 'y'], [cites('x', 'rien'), cites('y', `« ${A} »`)], { marks: { y: 'ok' } });
    const [rule] = ruleGroups(view([inv(A)], [a])).rules;
    expect(rule.cases).toHaveLength(1);
    expect(rule.cases[0].file).toBe(a);
    expect(rule.cases[0].index).toBe(1);
    expect(rule.cases[0].view).toEqual(casesOf(a)[1]);
  });

  it('un cas qui cite deux lignes : sous chacune ; les cas dans l\'ordre des fichiers puis des cas', () => {
    const a = f('a', ['a1', 'a2'], [cites('a1', `${A} et ${B}`), cites('a2', B)]);
    const b = f('b', ['b1'], [cites('b1', A)]);
    const g = ruleGroups(view([inv(A), inv(B)], [a, b]));
    expect(g.rules.map((r) => titles(r.cases))).toEqual([['a1', 'b1'], ['a1', 'a2']]);
    expect(g.others).toEqual([]);
  });

  it('une ligne qu\'aucun cas ne cite : gardée, sans cas', () => {
    const a = f('a', ['x'], [cites('x', A)]);
    const g = ruleGroups(view([inv(A), inv(B)], [a]));
    expect(g.rules.map((r) => r.cases.length)).toEqual([1, 0]);
  });

  it('un cas pas lu, ou qui ne cite aucune ligne : dans les autres tests', () => {
    const a = f('a', ['pas lu', 'rien cité', 'un I-3 seul', 'cité'], [cites('rien cité', 'autre chose'), cites('un I-3 seul', 'I-3'), cites('cité', A)]);
    const g = ruleGroups(view([inv(A)], [a]));
    expect(titles(g.others)).toEqual(['pas lu', 'rien cité', 'un I-3 seul']);
    expect(titles(g.rules[0].cases)).toEqual(['cité']);
  });

  it('un cas dont la lecture est périmée : il garde sa ligne', () => {
    const a = f('a', ['x'], [cites('x', A)], { staleCases: ['x'] });
    const g = ruleGroups(view([inv(A)], [a]));
    expect(titles(g.rules[0].cases)).toEqual(['x']);
    expect(g.rules[0].cases[0].view.stale).toBe(true);
  });

  it('chaque cas de chaque fichier est dans une règle ou dans les autres', () => {
    const a = f('a', ['1', '2', '3'], [cites('1', A), cites('2', 'rien')]);
    const b = f('b', ['x', 'x'], [cites('x', B), cites('x', 'rien')]);
    const g = ruleGroups(view([inv(A), inv(B)], [a, b]));
    const all = [...new Set([...g.rules.flatMap((r) => r.cases), ...g.others])];
    expect(all.map((c) => `${c.file.id}:${c.index}`).sort()).toEqual(['a:0', 'a:1', 'a:2', 'b:0', 'b:1']);
  });

  it('sans note : aucune règle, tous les cas dans les autres tests', () => {
    const a = f('a', ['x', 'y'], [cites('x', A)]);
    const g = ruleGroups(view(null, [a]));
    expect(g.rules).toEqual([]);
    expect(titles(g.others)).toEqual(['x', 'y']);
    expect(ruleGroups(view([inv(A)], [])).others).toEqual([]);
  });

  describe('l\'état d\'après la preuve', () => {
    const lineA = `${A} → invariant`, lineB = `${B} → invariant`;
    const states = (g: ReturnType<typeof ruleGroups>) => g.rules.map((r) => [r.state, r.detail]);

    it('pas de preuve au relevé, ou rien à prouver : chaque ligne « écrite »', () => {
      expect(states(ruleGroups(view([inv(A), inv(B)], [])))).toEqual([['written', ''], ['written', '']]);
      expect(states(ruleGroups(view([inv(A)], [], { state: 'none', lines: [] })))).toEqual([['written', '']]);
    });

    it('une ligne prouvée : « prouvée », le mutant en détail', () => {
      const proof: VibeProof = { state: 'ok', lines: [{ line: lineA, proved: true, detail: 'le mutant : effacer sans vérifier' }] };
      expect(states(ruleGroups(view([inv(A)], [], proof)))).toEqual([['proved', 'le mutant : effacer sans vérifier']]);
    });

    it('une ligne que la preuve remonte à l\'utilisateur : « non prouvée », sa raison en détail', () => {
      const proof: VibeProof = { state: 'blocked', lines: [{ line: lineA, proved: true, detail: 'm' }, { line: lineB, proved: false, detail: 'aucun mutant ne tient' }] };
      expect(states(ruleGroups(view([inv(A), inv(B)], [], proof)))).toEqual([['proved', 'm'], ['unproved', 'aucun mutant ne tient']]);
    });

    it('une ligne ajoutée après la preuve : « écrite », les autres gardent leur état', () => {
      const lines = [{ line: lineA, proved: true, detail: 'm' }, { line: 'autre → invariant', proved: false, detail: 'pourquoi' }];
      // absente des lignes du relevé
      expect(states(ruleGroups(view([inv(A), inv(B), inv('autre')], [], { state: 'missing', lines: lines.slice(0, 1) })))).toEqual([['proved', 'm'], ['written', ''], ['written', '']]);
      // présente, mais sans rubrique (proofOf la rend non prouvée, sans détail, l'état « missing »)
      const proof: VibeProof = { state: 'missing', lines: [lines[0], { line: lineB, proved: false, detail: '' }, lines[1]] };
      expect(states(ruleGroups(view([inv(A), inv(B), inv('autre')], [], proof)))).toEqual([['proved', 'm'], ['written', ''], ['unproved', 'pourquoi']]);
    });

    it('la ligne de la preuve se retrouve à l\'espace près', () => {
      const proof: VibeProof = { state: 'ok', lines: [{ line: `  ${A}  →   invariant `, proved: true, detail: 'm' }] };
      expect(states(ruleGroups(view([inv(A)], [], proof)))).toEqual([['proved', 'm']]);
    });
  });
});
