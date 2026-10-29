// Les fichiers par défaut quand le disque résiste : un disque en mémoire, dont
// la lecture d'un fichier échoue (EACCES).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { skillVariants, syncDefaults, type Disk } from 'core/vibecoder';

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
    expect(variants.map((v) => v.path)).toEqual(['plugin/skills/relire--haiku/SKILL.md', 'plugin/skills/relire--sonnet/SKILL.md']);
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
    expect(inline).toHaveLength(2);
    expect(inline.every((v) => !v.content.includes('context:'))).toBe(true);
  });

  it('un skill sans modèle (celui de l\'agent) : aucune', () => {
    expect(skillVariants('note', SKILL.replace('model: opus\n', ''))).toEqual([]);
  });

  it('une variante n\'a pas de variante', () => {
    expect(skillVariants('relire--haiku', SKILL)).toEqual([]);
  });

  it('les skills livrés : des variantes sur haiku, sonnet ou opus seulement, aucune ne nomme Fable', () => {
    const root = path.resolve(__dirname, '../../../../../../resources/vibecoder/plugin/skills');
    const all = fs.readdirSync(root).flatMap((name) => skillVariants(name, fs.readFileSync(path.join(root, name, 'SKILL.md'), 'utf8')));
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((v) => !/\nmodel: (haiku|sonnet|opus)\n/.test(v.content) || /fable/i.test(v.content)).map((v) => v.path)).toEqual([]);
  });
});
