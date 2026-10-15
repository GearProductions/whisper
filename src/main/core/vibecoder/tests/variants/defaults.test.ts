// Les fichiers par défaut quand le disque résiste : un disque en mémoire, dont
// la lecture d'un fichier échoue (EACCES).
import { describe, expect, it } from 'vitest';
import { syncDefaults, type Disk } from 'core/vibecoder';

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
