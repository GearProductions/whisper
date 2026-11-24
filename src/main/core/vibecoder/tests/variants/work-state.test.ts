import { describe, expect, it } from 'vitest';
import { touched, touchedLine, workState } from 'core/vibecoder';

const H1 = 'a'.repeat(40);
const H2 = 'b'.repeat(40);
const Z = '\0';
const SHA = (c: string) => c.repeat(40);

type Disk = Record<string, string>;
// status : des entrées déjà au format -z ("XY chemin", le renommage : "XY vers", puis "origine") ; staged : des
// lignes brutes (méta, puis les chemins).
const state = (disk: Disk, status: string[] = [], staged: string[][] = [], head = H1) =>
  workState({ head, status: status.map((s) => s + Z).join(''), staged: staged.map((e) => `${e[0]}${Z}${e.slice(1).join(Z)}${Z}`).join('') }, (p) => disk[p] ?? null);
const meta = (letter: string, sha = SHA('1')) => `:100644 100644 ${SHA('0')} ${sha} ${letter}`;

describe('workState / touched', () => {
  it('deux états identiques : aucun fichier', () => {
    const s = () => state({ 'a.ts': 'x', 'new.ts': 'y' }, [' M a.ts', '?? new.ts'], [[meta('M'), 'b.ts']]);
    expect(touched(s(), s())).toEqual([]);
  });
  it('rien de changé nulle part : un état propre, deux fois', () => {
    expect(touched(state({}), state({}))).toEqual([]);
    expect(state({})).toEqual({ HEAD: H1 });
  });
  it('un fichier suivi modifié entre les deux : nommé', () => {
    expect(touched(state({}), state({ 'src/a.ts': 'x' }, [' M src/a.ts']))).toEqual(['src/a.ts']);
  });
  it('un fichier déjà modifié avant, modifié encore : nommé', () => {
    expect(touched(state({ 'a.ts': 'x' }, [' M a.ts']), state({ 'a.ts': 'xy' }, [' M a.ts']))).toEqual(['a.ts']);
  });
  it('un fichier pas suivi apparu (une copie), ou disparu : nommé', () => {
    const copy = state({ 'a.copy.ts': 'x' }, ['?? a.copy.ts']);
    expect(touched(state({}), copy)).toEqual(['a.copy.ts']);
    expect(touched(copy, state({}))).toEqual(['a.copy.ts']);
  });
  it('un fichier pas suivi dont le contenu change : nommé', () => {
    expect(touched(state({ 'n.ts': '1' }, ['?? n.ts']), state({ 'n.ts': '2' }, ['?? n.ts']))).toEqual(['n.ts']);
  });
  it('un fichier ajouté à l’index, ou retiré de l’index : nommé', () => {
    const before = state({ 'a.ts': 'x' }, [' M a.ts']);
    const after = state({ 'a.ts': 'x' }, ['M  a.ts'], [[meta('M'), 'a.ts']]);
    expect(touched(before, after)).toEqual(['a.ts']);
    expect(touched(after, before)).toEqual(['a.ts']);
  });
  it('un fichier indexé dont le contenu indexé change (contenu du disque identique) : nommé', () => {
    const a = state({ 'a.ts': 'x' }, ['M  a.ts'], [[meta('M', SHA('1')), 'a.ts']]);
    const b = state({ 'a.ts': 'x' }, ['M  a.ts'], [[meta('M', SHA('2')), 'a.ts']]);
    expect(touched(a, b)).toEqual(['a.ts']);
  });
  it('un fichier modifié avant, remis comme à HEAD : nommé', () => {
    expect(touched(state({ 'a.ts': 'x' }, [' M a.ts']), state({}))).toEqual(['a.ts']);
  });
  it('un fichier supprimé du disque : nommé', () => {
    expect(touched(state({}), state({}, [' D a.ts']))).toEqual(['a.ts']);
  });
  it('un commit de plus : HEAD en tête', () => {
    const before = state({ 'b.ts': 'x' }, [' M b.ts']);
    const after = state({ 'a.ts': 'x', 'b.ts': 'x' }, [' M b.ts', '?? a.ts'], [], H2);
    expect(touched(before, after)).toEqual(['HEAD', 'a.ts']);
  });
  it('un renommage : ses deux chemins', () => {
    const renamed = state({ 'new.ts': 'x' }, ['R  new.ts', 'old.ts'], [[meta('R100'), 'old.ts', 'new.ts']]);
    expect(Object.keys(renamed).sort()).toEqual(['HEAD', 'new.ts', 'old.ts']);
    expect(touched(state({}), renamed)).toEqual(['new.ts', 'old.ts']);
  });
  it('une copie indexée (C) : ses deux chemins, et le suivant n’est pas pris pour un chemin', () => {
    const s = state({ 'c.ts': 'x', 'z.ts': 'y' }, ['C  c.ts', 'o.ts', ' M z.ts'], [[meta('C100'), 'o.ts', 'c.ts']]);
    expect(touched(state({}), s)).toEqual(['c.ts', 'o.ts', 'z.ts']);
  });
  it('un renommage déjà en place, inchangé : rien', () => {
    const s = () => state({ 'new.ts': 'x' }, ['R  new.ts', 'old.ts'], [[meta('R100'), 'old.ts', 'new.ts']]);
    expect(touched(s(), s())).toEqual([]);
  });
  it('plusieurs fichiers : triés', () => {
    const after = state({ 'z.ts': '1', 'a.ts': '1', 'm/x.ts': '1' }, ['?? z.ts', ' M a.ts', '?? m/x.ts']);
    expect(touched(state({}), after)).toEqual(['a.ts', 'm/x.ts', 'z.ts']);
  });
  it('un chemin avec des espaces, des accents, des guillemets : tel quel', () => {
    const p = 'dossier x/é "q".ts';
    expect(touched(state({}), state({ [p]: 'x' }, [`?? ${p}`]))).toEqual([p]);
  });
  it('les fichiers que git ignore (!!) ne sont pas regardés', () => {
    expect(state({ 'dist/a.js': 'x' }, ['!! dist/a.js'])).toEqual({ HEAD: H1 });
  });
  it('des sorties vides : un état avec HEAD seul', () => {
    expect(workState({ head: `${H1}\n`, status: '', staged: '' }, () => null)).toEqual({ HEAD: H1 });
  });
});

describe('touchedLine', () => {
  it('en français : les fichiers nommés', () => {
    const line = touchedLine(['a.ts', 'dossier x/b.ts'], 'fr');
    expect(line).toContain('a.ts');
    expect(line).toContain('dossier x/b.ts');
    expect(line).toMatch(/fichiers/);
  });
  it('en anglais : les fichiers nommés', () => {
    const line = touchedLine(['a.ts', 'HEAD'], 'en');
    expect(line).toContain('a.ts');
    expect(line).toContain('HEAD');
    expect(line).toMatch(/files/);
  });
  it('l’état illisible : elle le dit, dans la langue', () => {
    expect(touchedLine(null, 'fr')).toMatch(/lu|lisible/);
    expect(touchedLine(null, 'en')).toMatch(/read/);
    expect(touchedLine(null, 'fr')).not.toBe(touchedLine(null, 'en'));
  });
  it('une longue liste : bornée, avec le reste compté', () => {
    const files = Array.from({ length: 500 }, (_, i) => `f${i}.ts`);
    const line = touchedLine(files, 'en');
    expect(line).toContain('f0.ts');
    expect(line).not.toContain('f499.ts');
    expect(line).toContain('480');
  });
});
