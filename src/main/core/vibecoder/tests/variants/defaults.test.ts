// Les fichiers par défaut quand le disque résiste : un disque en mémoire, dont
// la lecture d'un fichier échoue (EACCES).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { removeRetired, skillVariants, syncDefaults, type Disk } from 'core/vibecoder';

const FILE = 'plugin/skills/note/SKILL.md';

describe('syncDefaults : un fichier illisible', () => {
  it('n’est pas pris pour un fichier absent : il n’est pas réécrit', () => {
    const written: string[] = [];
    const disk: Disk = {
      read: (p) => { if (p.endsWith('SKILL.md')) throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); return null; },
      write: (p) => { written.push(p); },
    };
    expect(syncDefaults('/u', [{ path: FILE, content: 'défaut\n' }], disk)).toEqual({ written: [], kept: [FILE] });
    expect(written.filter((p) => p.endsWith('SKILL.md'))).toEqual([]);
  });
});

const SKILL = ['---', 'name: relire', 'description: "Review a diff."', 'argument-hint: "<lang> <out> <commit>"',
  'disable-model-invocation: true', 'context: fork', 'model: opus', 'effort: high', 'allowed-tools: "Read, Bash(git show *)"',
  '---', '', '# relire', ''].join('\n');

describe('skillVariants : un skill qui fixe son modèle, sur un autre', () => {
  const variants = skillVariants('relire', SKILL);

  it('une variante par autre modèle, à côté du skill', () => {
    expect(variants.slice(0, 2).map((v) => v.path)).toEqual(['plugin/skills/relire--haiku/SKILL.md', 'plugin/skills/relire--sonnet/SKILL.md']);
  });

  it('puis une par modèle et par effort, tous (buildMessage nomme le couple choisi) : 15', () => {
    const paths = variants.slice(2).map((v) => v.path.split('/')[2]);
    expect(paths).toHaveLength(15);
    expect(paths).toContain('relire--opus--high');
    expect(paths).toContain('relire--haiku--low');
    expect(paths).toContain('relire--sonnet--medium');
    expect(paths).toContain('relire--opus--max');
    expect(variants.find((v) => v.path.includes('relire--haiku--max'))!.content).toContain('name: relire--haiku--max\n');
    expect(variants.find((v) => v.path.includes('relire--haiku--max'))!.content).toContain('\nmodel: haiku\neffort: max\n');
  });

  it('le même en-tête, son modèle et son effort par défaut, un corps qui renvoie au skill', () => {
    expect(variants[0].content).toBe(['---', 'name: relire--haiku', 'description: "Review a diff."', 'argument-hint: "<lang> <out> <commit>"',
      'disable-model-invocation: true', 'context: fork', 'allowed-tools: "Read, Bash(git show *)"', 'model: haiku', 'effort: low', '---', '',
      'Follow exactly the instructions of `${CLAUDE_SKILL_DIR}/../relire/SKILL.md` with these arguments: $ARGUMENTS', ''].join('\n'));
  });

  it('sonnet : effort moyen', () => {
    expect(variants[1].content).toContain('\nmodel: sonnet\neffort: medium\n');
  });

  it('un skill dans la conversation (sans context: fork) : ses variantes, sans context: fork', () => {
    const inline = skillVariants('modules', SKILL.replace('context: fork\n', ''));
    expect(inline).toHaveLength(17);
    expect(inline.every((v) => !v.content.includes('context:'))).toBe(true);
  });

  it('un skill sans modèle (celui de l\'agent) : aucune', () => {
    expect(skillVariants('note', SKILL.replace('model: opus\n', ''))).toEqual([]);
  });

  it('une variante n\'a pas de variante', () => {
    expect(skillVariants('relire--haiku', SKILL)).toEqual([]);
    expect(skillVariants('relire--haiku--max', SKILL)).toEqual([]);
  });

  it('les skills livrés : des variantes sur haiku, sonnet ou opus seulement, aucune ne nomme Fable', () => {
    const root = path.resolve(__dirname, '../../../../../../resources/vibecoder/plugin/skills');
    const all = fs.readdirSync(root).flatMap((name) => skillVariants(name, fs.readFileSync(path.join(root, name, 'SKILL.md'), 'utf8')));
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((v) => !/\nmodel: (haiku|sonnet|opus)\n/.test(v.content) || /fable/i.test(v.content)).map((v) => v.path)).toEqual([]);
  });
});

// Un disque en mémoire aux chemins POSIX : sous Windows, path.join y mettrait des \. Le vrai disque : vibe-files-retired (invariants).
describe.skipIf(process.platform === 'win32')('removeRetired : un disque en mémoire', () => {
  const memory = (files: Record<string, string>) => {
    const removed: string[] = [];
    const disk = {
      read: (p: string) => files[p] ?? null,
      write: (p: string, c: string) => { files[p] = c; },
      remove: (p: string) => { removed.push(p); delete files[p]; },
    };
    return { disk, removed, files };
  };

  it('un manifeste illisible (lecture en erreur) : rien', () => {
    const { removed } = memory({});
    const disk = { read: () => { throw new Error('EACCES'); }, write: () => {}, remove: (p: string) => { removed.push(p); } };
    removeRetired('/u', [], disk);
    expect(removed).toEqual([]);
  });

  it('un fichier qu’on ne peut supprimer garde son entrée ; une variante en erreur n’arrête rien', () => {
    const { disk, files } = memory({});
    syncDefaults('/u', [{ path: FILE, content: SKILL }, { path: 'b.md', content: 'b' }], disk);
    const stuck = { ...disk, remove: (p: string) => { if (p.endsWith('b.md') || p.includes('--opus')) throw new Error('EBUSY'); disk.remove(p); } };
    files['/u/plugin/skills/relire--opus/SKILL.md'] = 'générée';
    removeRetired('/u', [], stuck);
    expect(files[`/u/${FILE}`]).toBeUndefined();
    expect(JSON.parse(files['/u/.defaults.json'])).toHaveProperty(['b.md']);
    expect(JSON.parse(files['/u/.defaults.json'])).not.toHaveProperty([FILE]);
  });

  it('un SKILL.md retiré emporte les variantes de modèle et d’effort, pas celles d’un voisin', () => {
    const { disk, files } = memory({});
    syncDefaults('/u', [{ path: FILE, content: SKILL }], disk);
    for (const v of skillVariants('note', SKILL.replace('relire', 'note'))) files[`/u/${v.path}`] = v.content;
    files['/u/plugin/skills/note--perso/SKILL.md'] = 'à moi';
    removeRetired('/u', [], disk);
    expect(Object.keys(files).filter((p) => p.includes('/note')).sort()).toEqual(['/u/plugin/skills/note--perso/SKILL.md']);
  });
});
