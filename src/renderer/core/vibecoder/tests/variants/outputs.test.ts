import { describe, expect, it } from 'vitest';
import { commitTitle, parseChecks, parseReview, sections, webUrl } from 'core/vibecoder';

describe('parseChecks', () => {
  it('les items, dans leur ordre', () => {
    const text = '{"items":[{"name":"typecheck","ok":true,"detail":"0 erreur"},{"name":"tests","ok":false,"detail":"a.test.ts:3 attendu 2"}],"time":1}';
    expect(parseChecks(text)).toEqual([
      { name: 'typecheck', ok: true, detail: '0 erreur' },
      { name: 'tests', ok: false, detail: 'a.test.ts:3 attendu 2' },
    ]);
  });

  it('ok qui n\'est pas true : en échec', () => {
    const text = '{"items":[{"name":"a","ok":"true"},{"name":"b","ok":1},{"name":"c"}]}';
    expect(parseChecks(text)?.map((c) => c.ok)).toEqual([false, false, false]);
  });

  it('item sans nom, ou pas un objet : écarté ; détail manquant : vide', () => {
    const text = '{"items":[null,3,"lint",{"ok":true},{"name":"  ","ok":true},{"name":" lint ","ok":true,"detail":42}]}';
    expect(parseChecks(text)).toEqual([{ name: 'lint', ok: true, detail: '' }]);
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
