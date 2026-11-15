import { describe, expect, it } from 'vitest';
import { diffFiles, filesText, parseFiles, versionName, type FileBlobs } from 'core/vibecoder';

const HASH = 'a'.repeat(40);
const H2 = 'b'.repeat(40);

describe('versionName : le nom d\'une version retenue ne sort jamais de validated/', () => {
  it('une empreinte : validated/<empreinte>', () => {
    expect(versionName(HASH)).toBe(`validated/${HASH}`);
  });

  it.each([
    ['avec « / »', `${'a'.repeat(20)}/${'a'.repeat(19)}`],
    ['avec « .. »', `../..${'a'.repeat(36)}`],
    ['un chemin qui remonte', '../../etc/passwd'],
    ['trop courte', 'a'.repeat(39)],
    ['trop longue', 'a'.repeat(41)],
    ['pas hexadécimale', 'g'.repeat(40)],
    ['vide', ''],
    ['avec un retour à la ligne', `${HASH}\n`],
  ])('%s : null', (_, hash) => {
    expect(versionName(hash)).toBeNull();
  });
});

describe('filesText et parseFiles : la liste en texte, et relue', () => {
  it('une ligne « <empreinte> <chemin> » par fichier, triée par chemin', () => {
    expect(filesText({ 'b.ts': H2, 'a.ts': HASH })).toBe(`${HASH} a.ts\n${H2} b.ts`);
  });

  it('filesText puis parseFiles : la même liste', () => {
    const files = { 'src/b.ts': H2, 'src/a.ts': HASH, 'un dossier/avec espaces.ts': HASH };
    expect(parseFiles(filesText(files))).toEqual(files);
  });

  it('{} : \'\' puis {}', () => {
    expect(filesText({})).toBe('');
    expect(parseFiles('')).toEqual({});
  });

  it('un retour à la ligne final et des CRLF sont tolérés', () => {
    expect(parseFiles(`${HASH} a.ts\r\n${H2} b.ts\r\n`)).toEqual({ 'a.ts': HASH, 'b.ts': H2 });
    expect(parseFiles(`${HASH} a.ts\n`)).toEqual({ 'a.ts': HASH });
  });

  it.each([
    ['une empreinte courte', `${'a'.repeat(39)} a.ts`],
    ['une empreinte trop longue', `${'a'.repeat(41)} a.ts`],
    ['une empreinte pas hexadécimale', `${'g'.repeat(40)} a.ts`],
    ['un chemin vide', `${HASH} `],
    ['pas de chemin ni d\'espace', HASH],
    ['une ligne vide au milieu', `${HASH} a.ts\n\n${H2} b.ts`],
    ['un chemin en double', `${HASH} a.ts\n${H2} a.ts`],
    ['un texte quelconque', 'pas une liste'],
  ])('%s : null', (_, text) => {
    expect(parseFiles(text)).toBeNull();
  });

  it('un nom de propriété d\'objet comme chemin reste un chemin', () => {
    expect(parseFiles(`${HASH} constructor`)).toEqual({ constructor: HASH });
    expect(parseFiles(`${HASH} __proto__`)?.['__proto__' as string]).toBe(HASH);
  });
});

describe('diffFiles : les fichiers qui diffèrent de leur référence', () => {
  const f = (path: string, disk: string | null, head: string | null): FileBlobs => ({ path, disk, head });

  it.each([
    ['identique à head : absent', [f('a', 'h1', 'h1')], 'head', []],
    ['modifié depuis head', [f('a', 'h2', 'h1')], 'head', [{ path: 'a' }]],
    ['nouveau (head null) : added', [f('a', 'h1', null)], 'head', [{ path: 'a', added: true }]],
    ['disk null : deleted', [f('a', null, 'h1')], 'head', [{ path: 'a', deleted: true }]],
    ['absent des deux : rien', [f('a', null, null)], 'head', []],
    ['identique à sa version validée : absent', [f('a', 'h2', 'h1')], { a: 'h2' }, []],
    ['modifié depuis la validation', [f('a', 'h3', 'h1')], { a: 'h2' }, [{ path: 'a' }]],
    ['validé puis supprimé (disk null) : deleted', [f('a', null, 'h1')], { a: 'h2' }, [{ path: 'a', deleted: true }]],
    ['validé puis supprimé (absent de files) : deleted', [], { a: 'h2' }, [{ path: 'a', deleted: true }]],
    ['nouveau depuis la validation : added', [f('b', 'h1', 'h1')], { a: 'h2' }, [{ path: 'a', deleted: true }, { path: 'b', added: true }]],
    ['commité tel quel mais jamais validé : absent de la liste, added', [f('a', 'h1', 'h1')], {}, [{ path: 'a', added: true }]],
    ['une validation vide, un fichier absent : rien', [f('a', null, 'h1')], {}, []],
  ] as [string, FileBlobs[], 'head' | Record<string, string>, unknown[]][])('%s', (_, files, ref, expected) => {
    expect(diffFiles(files, ref)).toEqual(expected);
  });

  it('triés par chemin, sans id', () => {
    const out = diffFiles([f('z', 'x', 'h'), f('c', 's', 's'), f('b', 'x', 'h'), f('a', 'n', null)], 'head');
    expect(out.map((d) => d.path)).toEqual(['a', 'b', 'z']);
    expect(out.every((d) => !('id' in d))).toBe(true);
  });

  it('un nom de propriété d\'objet comme chemin n\'est pas dans la liste validée', () => {
    expect(diffFiles([f('constructor', 'h1', 'h1')], {})).toEqual([{ path: 'constructor', added: true }]);
  });
});
