import { describe, expect, it } from 'vitest';
import { appliedRemarks, commitReviews, commitTitle, parseChecks, parseReview, remarkKey, sections, webUrl } from 'core/vibecoder';
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
      .toEqual({ state: 'APPROVED', url: 'https://github.com/o/r/pull/3#pullrequestreview-1' });
  });

  it('état en minuscules : en majuscules ; inconnu : tel quel', () => {
    expect(parseReview('{"state":"changes_requested"}')?.state).toBe('CHANGES_REQUESTED');
    expect(parseReview('{"state":"DISMISSED"}')?.state).toBe('DISMISSED');
  });

  it('état manquant : vide ; lien manquant ou pas en http(s) : null', () => {
    expect(parseReview('{}')).toEqual({ state: '', url: null });
    expect(parseReview('{"state":3,"url":"javascript:alert(1)"}')).toEqual({ state: '', url: null });
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

describe('remarkKey', () => {
  it('« <fichier>:L<ligne> » en tête, accents graves ou non ; d\'une plage, la première ligne', () => {
    expect(remarkKey('src/a.ts:L12 — yagni: x — y')).toBe('src/a.ts:L12');
    expect(remarkKey('`src/a.ts:L12-38` — shrink: x')).toBe('src/a.ts:L12');
    expect(remarkKey('  src/c.ts:L3: dead')).toBe('src/c.ts:L3');
  });

  it('pas en tête, sans ligne, ou ligne suivie d\'une lettre : null', () => {
    expect(remarkKey('voir src/a.ts:L12')).toBeNull();
    expect(remarkKey('src/a.ts — note: x')).toBeNull();
    expect(remarkKey('src/a.ts:L12a')).toBeNull();
    expect(remarkKey('net: -4 lines possible.')).toBeNull();
  });
});

describe('appliedRemarks', () => {
  const out = (text: string, time: number) => ({ text, time });
  it('les clés appliquées, si le fichier n\'est pas plus vieux que ponytail.md', () => {
    const a = out('{"applied":["src/a.ts:L12","`src/b.ts:L3-9`",4,"rien"]}', 10);
    expect([...appliedRemarks(a, 10)]).toEqual(['src/a.ts:L12', 'src/b.ts:L3']);
  });

  it('absent, plus vieux, illisible ou sans applied : vide', () => {
    expect(appliedRemarks(undefined, 1).size).toBe(0);
    expect(appliedRemarks(out('{"applied":["src/a.ts:L1"]}', 9), 10).size).toBe(0);
    expect(appliedRemarks(out('{', 10), 1).size).toBe(0);
    expect(appliedRemarks(out('{"applied":"src/a.ts:L1"}', 10), 1).size).toBe(0);
    expect(appliedRemarks(out('null', 10), 1).size).toBe(0);
  });
});
