import { describe, expect, it } from 'vitest';
import { commitReviews, commitTitle, failedChecks, parseChecks, parseCi, parseReview, sections, webUrl, withoutApplied } from 'core/vibecoder';
import type { VibeCommit } from 'technicals/bridge';

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

describe('commitTitle', () => {
  it('« <hash court> <sujet> »', () => {
    expect(commitTitle('34349c1 main/core/vibecoder : la note')).toEqual({ hash: '34349c1', subject: 'main/core/vibecoder : la note' });
  });

  it('hash entre accents graves, en majuscules, séparateur, ou sans sujet', () => {
    expect(commitTitle('`34349C1` — la note')).toEqual({ hash: '34349c1', subject: 'la note' });
    expect(commitTitle('94a45d6c0ffee: fixup! x')).toEqual({ hash: '94a45d6c0ffee', subject: 'fixup! x' });
    expect(commitTitle('94a45d6')).toEqual({ hash: '94a45d6', subject: '' });
  });

  it('pas un hash en tête : null', () => {
    for (const t of ['Remarques générales', 'abc12 trop court', 'zzzzzzz pas hexa', '', ' 1234567x collé']) expect(commitTitle(t)).toBeNull();
  });
});

describe('commitReviews', () => {
  const commit = (hash: string, subject = 's'): VibeCommit => ({ hash, subject, fixup: false, files: [] });
  const commits = [commit('5d6e7f8aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), commit('9a0b1c2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')];

  it('une rubrique par commit, rangée par son hash complet', () => {
    const md = '## 5d6e7f8 vad\n- a\n\n## `9A0B1C2`: dictée\n- b';
    const { byHash, others } = commitReviews(md, commits);
    expect(byHash.get(commits[0].hash)).toBe('- a');
    expect(byHash.get(commits[1].hash)).toBe('- b');
    expect(others).toEqual([]);
  });

  it('l\'ensemble, un commit inconnu du relevé, un second titre du même commit : à part, dans l\'ordre', () => {
    const md = 'Intro\n## Ensemble\n- e\n## 1234567 inconnu\n- i\n## 5d6e7f8 vad\n- a\n## 5d6e7f8 encore\n- x';
    const { byHash, others } = commitReviews(md, commits);
    expect([...byHash.keys()]).toEqual([commits[0].hash]);
    expect(others.map((s) => s.title)).toEqual(['', 'Ensemble', '1234567 inconnu', '5d6e7f8 encore']);
  });

  it('pas de commit au relevé : tout à part', () => {
    expect(commitReviews('## 5d6e7f8 vad\n- a', []).others).toHaveLength(1);
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

describe('parseCi', () => {
  it('une première ligne ✓ : verte, aucun échec', () => {
    expect(parseCi('✓ 5/5 checks passed')).toEqual({ state: 'ok', failed: [] });
  });

  it('une première ligne ✗ et deux titres : en échec, leurs deux noms sans étiquette', () => {
    const text = '[agent] ✗ 2/5 failed\n\n## [agent] typecheck\nCause.\n\n## [toi] tests\nCause.';
    expect(parseCi(text)).toEqual({ state: 'ko', failed: ['typecheck', 'tests'] });
  });

  it('une première ligne ⏳ : en cours', () => {
    expect(parseCi('⏳ 3/5 pending')).toEqual({ state: 'pending', failed: [] });
  });

  it('une étiquette [agent] devant la marque : ignorée', () => {
    expect(parseCi('[agent] ✓ 5/5')?.state).toBe('ok');
    expect(parseCi('[toi] ⏳ 1/2')?.state).toBe('pending');
  });

  it('un titre dans un bloc de code : pas un échec', () => {
    const text = '✗ 1/2\n## [agent] lint\n```md\n## pas un échec\n```';
    expect(parseCi(text)?.failed).toEqual(['lint']);
  });

  it('une première ligne sans marque connue, un texte vide : illisible', () => {
    for (const text of ['', ' \n\n', 'all good', '## [agent] lint\n✗ 1/1', '[agent] 5/5']) expect(parseCi(text)).toBeNull();
  });

  it('après une marque de liste, des lignes vides en tête, des fins de ligne Windows', () => {
    expect(parseCi('\n\n- [agent] ✗ 1/2\r\n## [agent] `lint`  \r\ncause')).toEqual({ state: 'ko', failed: ['`lint`'] });
  });

  it('un titre sans nom, ou seulement une étiquette : écarté ; verte avec des titres : les garde', () => {
    expect(parseCi('✗ 1/2\n## [agent]\n##\n## [toi] a b')?.failed).toEqual(['a b']);
    expect(parseCi('✓ ok\n## [agent] x')?.failed).toEqual(['x']);
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
