// Le ménage des fichiers par défaut (removeRetired), sur du réel : un dossier temporaire,
// un disque sur node:fs. Un fichier retiré part avec les variantes de son skill, un fichier
// encore livré reste. Le reste : tests/invariants/defaults-retired.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { removeRetired, skillVariants, syncDefaults, type DefaultFile } from 'core/vibecoder';

const disk = {
  read: (p: string) => {
    try { return fs.readFileSync(p, 'utf8'); } catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err; }
  },
  write: (p: string, content: string) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); },
  remove: (p: string) => { fs.rmSync(p); },
};

const FILE = 'plugin/skills/note/SKILL.md';
const SKILL = '---\nname: note\nmodel: opus\neffort: high\n---\nle skill\n';
const KEPT = 'plugin/skills/garde/SKILL.md';
const OLD: DefaultFile[] = [{ path: FILE, content: SKILL }, { path: KEPT, content: 'gardé\n' }];
// La version suivante de l'appli : `note` n'est plus livré.
const NEW: DefaultFile[] = [{ path: KEPT, content: 'gardé\n' }];

let tmp = '';
let dir = '';
const at = (rel: string) => path.join(dir, rel);
// Les défauts écrits par la version d'avant, comme au démarrage.
const installed = () => { syncDefaults(dir, OLD, disk); };
// Les variantes du skill, écrites comme au démarrage, hors manifeste.
const withVariants = () => {
  const variants = skillVariants('note', SKILL);
  for (const v of variants) disk.write(at(v.path), v.content);
  return variants.map((v) => v.path);
};

beforeEach(() => {
  tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'vibecoder-retires-')));
  dir = path.join(tmp, 'vibecoder');
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('un fichier du manifeste, plus livré, jamais retouché : il part', () => {
  it('témoin : un SKILL.md part avec ses variantes', () => {
    installed();
    const variants = withVariants();

    removeRetired(dir, NEW, disk);

    // témoin : le skill a bien des variantes
    expect(variants.length).toBeGreaterThan(0);
    // aucune ne reste
    expect(variants.filter((v) => fs.existsSync(at(v)))).toEqual([]);
  });

  it('un fichier encore livré : il reste', () => {
    installed();

    removeRetired(dir, NEW, disk);

    // il est toujours là, avec son texte
    expect(fs.readFileSync(at(KEPT), 'utf8')).toBe('gardé\n');
  });
});
