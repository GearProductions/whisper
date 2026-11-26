import { describe, expect, it } from 'vitest';
import { failedChecks, findings, parseChecks, parseReview, sections, webUrl, withoutApplied } from 'core/vibecoder';

describe('parseChecks', () => {
  it('les items, dans leur ordre', () => {
    const text = '{"items":[{"name":"typecheck","ok":true,"detail":"0 erreur"},{"name":"tests","ok":false,"detail":"a.test.ts:3 attendu 2"}],"time":1}';
    expect(parseChecks(text)).toEqual([
      { name: 'typecheck', ok: true, level: 'ok', detail: '0 erreur' },
      { name: 'tests', ok: false, level: 'error', detail: 'a.test.ts:3 attendu 2' },
    ]);
  });

  it('ok qui n\'est pas true : en échec', () => {
    const text = '{"items":[{"name":"a","ok":"true"},{"name":"b","ok":1},{"name":"c"}]}';
    expect(parseChecks(text)?.map((c) => c.ok)).toEqual([false, false, false]);
  });

  it('item sans nom, ou pas un objet : écarté ; détail manquant : vide', () => {
    const text = '{"items":[null,3,"lint",{"ok":true},{"name":"  ","ok":true},{"name":" lint ","ok":true,"detail":42}]}';
    expect(parseChecks(text)).toEqual([{ name: 'lint', ok: true, level: 'ok', detail: '' }]);
  });

  it('level : warning passe (ok true) même si ok est false ; error échoue même si ok est true', () => {
    const text = '{"items":[{"name":"lint","ok":false,"level":"warning"},{"name":"tests","ok":true,"level":"error"},{"name":"t","ok":true,"level":"ok"}]}';
    expect(parseChecks(text)?.map((c) => [c.level, c.ok])).toEqual([['warning', true], ['error', false], ['ok', true]]);
  });

  it('level absent ou inconnu (ancien format) : d\'après ok', () => {
    const text = '{"items":[{"name":"a","ok":true},{"name":"b","ok":false},{"name":"c","ok":true,"level":"WARN"}]}';
    expect(parseChecks(text)?.map((c) => c.level)).toEqual(['ok', 'error', 'ok']);
  });

  it('aucune vérification : liste vide', () => {
    expect(parseChecks('{"items":[],"time":1}')).toEqual([]);
  });

  it('pas du JSON, pas d\'items, items pas en liste : null', () => {
    for (const text of ['', '{"items":', 'null', '[]', '{"time":1}', '{"items":{"name":"a"}}', '"items"']) {
      expect(parseChecks(text)).toBeNull();
    }
  });
});

describe('parseReview', () => {
  it('l\'état et le lien', () => {
    expect(parseReview('{"state":"APPROVED","url":"https://github.com/o/r/pull/3#pullrequestreview-1"}'))
      .toMatchObject({ state: 'APPROVED', url: 'https://github.com/o/r/pull/3#pullrequestreview-1' });
  });

  it('un fichier complet : verdict, texte, date', () => {
    expect(parseReview('{"state":"CHANGES_REQUESTED","url":"https://github.com/o/r/pull/3#r1","verdict":"request-changes","body":"A revoir","at":"2026-11-06T10:00:00.000Z"}'))
      .toEqual({ state: 'CHANGES_REQUESTED', url: 'https://github.com/o/r/pull/3#r1', verdict: 'request-changes', body: 'A revoir', at: Date.parse('2026-11-06T10:00:00.000Z') });
  });

  it('un fichier d\'avant (state et url seuls) : verdict, texte et date null', () => {
    expect(parseReview('{"state":"APPROVED","url":"https://github.com/o/r/pull/3#r1"}'))
      .toEqual({ state: 'APPROVED', url: 'https://github.com/o/r/pull/3#r1', verdict: null, body: null, at: null });
  });

  it('un verdict inconnu : null', () => {
    expect(parseReview('{"state":"APPROVED","verdict":"merge","body":"x","at":"pas une date"}'))
      .toEqual({ state: 'APPROVED', url: null, verdict: null, body: 'x', at: null });
  });

  it('état en minuscules : en majuscules ; inconnu : tel quel', () => {
    expect(parseReview('{"state":"changes_requested"}')?.state).toBe('CHANGES_REQUESTED');
    expect(parseReview('{"state":"DISMISSED"}')?.state).toBe('DISMISSED');
  });

  it('état manquant : vide ; lien manquant ou pas en http(s) : null', () => {
    expect(parseReview('{}')).toMatchObject({ state: '', url: null });
    expect(parseReview('{"state":3,"url":"javascript:alert(1)"}')).toMatchObject({ state: '', url: null });
    expect(parseReview('{"url":"file:///etc/passwd"}')?.url).toBeNull();
  });

  it('pas un objet : null', () => {
    for (const text of ['', 'pas du json', 'null', '[]', '"APPROVED"', '12']) expect(parseReview(text)).toBeNull();
  });
});

describe('webUrl', () => {
  it('http et https seulement, sans espace', () => {
    expect(webUrl(' https://x.y/z ')).toBe('https://x.y/z');
    expect(webUrl('HTTP://x.y')).toBe('HTTP://x.y');
    for (const v of ['javascript:alert(1)', 'file:///a', 'https://a b', '', null, 3, { url: 'https://x' }]) expect(webUrl(v)).toBeNull();
  });
});

describe('sections', () => {
  it('une rubrique par titre ##, son corps sans les lignes vides du bord', () => {
    expect(sections('## a1b2c3d Premier\n\n- ok\n\n## e4f5a6b Second\n- trop long\n')).toEqual([
      { title: 'a1b2c3d Premier', body: '- ok' },
      { title: 'e4f5a6b Second', body: '- trop long' },
    ]);
  });

  it('ce qui précède le premier titre : une rubrique sans titre', () => {
    expect(sections('# Revue\nIntro.\n## a Un\nx')).toEqual([{ title: '', body: '# Revue\nIntro.' }, { title: 'a Un', body: 'x' }]);
  });

  it('rien avant le premier titre : pas de rubrique sans titre ; titre sans corps : gardé', () => {
    expect(sections('\n\n## Seul\n\n')).toEqual([{ title: 'Seul', body: '' }]);
  });

  it('### et # ne coupent pas ; ## sans espace non plus', () => {
    expect(sections('## A\n### sous-titre\n# grand\n##collé')).toEqual([{ title: 'A', body: '### sous-titre\n# grand\n##collé' }]);
  });

  it('un ## dans un bloc de code ne coupe pas, jusqu\'à sa fermeture', () => {
    const md = '## A\n```md\n## pas un titre\n```\n## B\n~~~~\n```\n## toujours du code\n~~~~\nfin';
    expect(sections(md).map((s) => s.title)).toEqual(['A', 'B']);
    expect(sections(md)[1].body).toBe('~~~~\n```\n## toujours du code\n~~~~\nfin');
  });

  it('bloc de code jamais fermé : jusqu\'à la fin', () => {
    expect(sections('## A\n```\n## B').map((s) => s.title)).toEqual(['A']);
  });

  it('dièses de fin et espaces retirés du titre ; fins de ligne Windows', () => {
    expect(sections('  ##   Titre ##  \r\ncorps\r\n')).toEqual([{ title: 'Titre', body: 'corps' }]);
  });

  it('texte vide : aucune rubrique', () => {
    expect(sections('')).toEqual([]);
    expect(sections(' \n\n')).toEqual([]);
  });
});

describe('findings', () => {
  it('trois titres : trois constats, dans l\'ordre, leur détail', () => {
    expect(findings('## a.ts:L1 un\ndétail 1\n\n## b.ts:L2 deux\n- x\n- y\n\n## c\n')).toEqual({
      list: [{ title: 'a.ts:L1 un', body: 'détail 1' }, { title: 'b.ts:L2 deux', body: '- x\n- y' }, { title: 'c', body: '' }],
      intro: '',
    });
  });

  it('un texte avant le premier titre : l\'introduction', () => {
    expect(findings('# Relecture\nTrois remarques.\n\n## a\nx')).toEqual({ list: [{ title: 'a', body: 'x' }], intro: '# Relecture\nTrois remarques.' });
  });

  it('un fichier d\'une ligne sans titre : aucun constat, la ligne gardée', () => {
    expect(findings('Rien à signaler.')).toEqual({ list: [], intro: 'Rien à signaler.' });
  });

  it('un titre dans un bloc de code : pas un constat', () => {
    const md = 'Avant\n```md\n## pas un constat\n```\n## vrai\nx';
    expect(findings(md)).toEqual({ list: [{ title: 'vrai', body: 'x' }], intro: 'Avant\n```md\n## pas un constat\n```' });
    expect(findings('```\n## code\n```').list).toEqual([]);
  });

  it('un fichier vide : aucun constat, rien', () => {
    expect(findings('')).toEqual({ list: [], intro: '' });
    expect(findings(' \n\n')).toEqual({ list: [], intro: '' });
  });

  it('rien de perdu : chaque ligne est dans un constat ou dans l\'introduction', () => {
    const md = 'intro 1\nintro 2\n## T1\nl1\n### sous\n```\n## faux\n```\n## T2\nl2\nl3\n';
    const { list, intro } = findings(md);
    const text = [intro, ...list.map((s) => `${s.title}\n${s.body}`)].join('\n');
    for (const line of md.split('\n').filter((l) => l.trim() && !/^## (T\d)$/.test(l))) expect(text).toContain(line);
    expect(list.map((s) => s.title)).toEqual(['T1', 'T2']);
  });

  it('fins de ligne Windows, titre sans détail au milieu', () => {
    expect(findings('## a\r\n## b\r\ndétail\r\n')).toEqual({ list: [{ title: 'a', body: '' }, { title: 'b', body: 'détail' }], intro: '' });
  });
});

describe('fichiers de retour étiquetés [toi] / [agent] : la lecture de la page tient', () => {
  it('parseChecks d\'un detail étiqueté : l\'item lu, son detail tel quel', () => {
    expect(parseChecks('{"items":[{"name":"tests","ok":false,"detail":"[toi] a.test.ts:3 attendu 2"}]}'))
      .toEqual([{ name: 'tests', ok: false, level: 'error', detail: '[toi] a.test.ts:3 attendu 2' }]);
  });

  it('sections d\'un align.md aux titres étiquetés : une rubrique par titre', () => {
    expect(sections('## [toi] le contrat\ntexte\n\n## [agent] un détail\nautre')).toEqual([
      { title: '[toi] le contrat', body: 'texte' },
      { title: '[agent] un détail', body: 'autre' },
    ]);
  });
});

describe('failedChecks', () => {
  const c = (name: string, level: 'ok' | 'warning' | 'error') => ({ name, ok: level !== 'error', level, detail: '' });

  it('des vérifications ok, en avertissement et en échec : les seules en échec, dans l\'ordre', () => {
    const list = [c('a', 'ok'), c('b', 'error'), c('c', 'warning'), c('d', 'error')];
    expect(failedChecks(list)).toEqual([list[1], list[3]]);
  });

  it('aucune : liste vide', () => {
    expect(failedChecks([])).toEqual([]);
    expect(failedChecks([c('a', 'warning')])).toEqual([]);
  });
});

describe('withoutApplied', () => {
  const md = '- `a.ts:L1` [agent] — un\n- a.ts:L2 [agent] — deux\n  suite de deux\n- `b.ts:L3` [toi] — trois\n- `c.ts:L4-9` [agent] — quatre\n\nnet : -2 lignes possibles.';
  const ponytail = { text: md, time: 10 };
  const applied = (list: string[], time = 10) => ({ text: JSON.stringify({ applied: list }), time });

  it('une remarque [agent] dont l\'adresse est appliquée : retirée, avec ses lignes de suite ; les autres restent', () => {
    expect(withoutApplied(ponytail, applied(['a.ts:L2', 'c.ts:L4-9']))).toBe('- `a.ts:L1` [agent] — un\n- `b.ts:L3` [toi] — trois\n\nnet : -2 lignes possibles.');
  });

  it('une remarque [toi] n\'est jamais retirée, même si son adresse est appliquée', () => {
    expect(withoutApplied(ponytail, applied(['b.ts:L3']))).toBe(md);
  });

  it('un fichier plus vieux que ponytail.md, absent, illisible ou sans liste : rien n\'est retiré', () => {
    expect(withoutApplied(ponytail, applied(['a.ts:L1'], 9))).toBe(md);
    expect(withoutApplied(ponytail, undefined)).toBe(md);
    expect(withoutApplied(ponytail, { text: '{pas du json', time: 11 })).toBe(md);
    expect(withoutApplied(ponytail, { text: '{"applied":"a.ts:L1"}', time: 11 })).toBe(md);
  });

  it('un fichier aussi récent que ponytail.md compte', () => {
    expect(withoutApplied(ponytail, applied(['a.ts:L1'], 10))).not.toContain('a.ts:L1');
  });
});
