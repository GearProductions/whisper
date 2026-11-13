import { describe, expect, it } from 'vitest';
import { runEnv, runKey, runTmpDir, tmpLine } from 'core/vibecoder';

const GO = 1024 ** 3;
const MO = 1024 ** 2;

describe('runTmpDir', () => {
  it('sous out, au nom de la clé', () => {
    expect(runTmpDir('/out/agent', 'forme')).toBe('/out/agent/tmp/forme');
  });

  it('answers reprend la clé de la note : même dossier', () => {
    expect(runTmpDir('/out', runKey('answers'))).toBe('/out/tmp/note');
  });
});

describe('runEnv', () => {
  const base: NodeJS.ProcessEnv = { PATH: '/bin', HOME: '/h' };

  it('CLAUDE_CODE_TMPDIR posé, le reste de base gardé, base intact', () => {
    const env = runEnv(base, { tmp: '/t', forked: false });
    expect(env).toEqual({ PATH: '/bin', HOME: '/h', CLAUDE_CODE_TMPDIR: '/t' });
    expect(base).toEqual({ PATH: '/bin', HOME: '/h' });
    expect(env).not.toBe(base);
  });

  it('forked : la variable des tâches de fond en plus', () => {
    const env = runEnv(base, { tmp: '/t', forked: true });
    expect(env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS).toBe('1');
    expect(env.CLAUDE_CODE_TMPDIR).toBe('/t');
    expect(base).toEqual({ PATH: '/bin', HOME: '/h' });
  });

  it('non forked : sans elle', () => {
    expect('CLAUDE_CODE_DISABLE_BACKGROUND_TASKS' in runEnv(base, { tmp: '/t', forked: false })).toBe(false);
  });

  it('un CLAUDE_CODE_TMPDIR déjà dans base est remplacé', () => {
    const env = runEnv({ ...base, CLAUDE_CODE_TMPDIR: '/ailleurs' }, { tmp: '/t', forked: false });
    expect(env.CLAUDE_CODE_TMPDIR).toBe('/t');
  });
});

describe('tmpLine', () => {
  it('1 Go dit « 1 Go » en fr, « 1 GB » en en', () => {
    expect(tmpLine(GO, 'fr')).toContain('1 Go');
    expect(tmpLine(GO, 'en')).toContain('1 GB');
  });

  it('512 Mo en Mo', () => {
    expect(tmpLine(512 * MO, 'fr')).toContain('512 Mo');
    expect(tmpLine(512 * MO, 'en')).toContain('512 MB');
  });

  it('une borne qui n\'est pas ronde : une décimale, virgule en fr, point en en', () => {
    expect(tmpLine(1.5 * GO, 'fr')).toContain('1,5 Go');
    expect(tmpLine(1.5 * GO, 'en')).toContain('1.5 GB');
    expect(tmpLine(2048 * MO + 100 * MO, 'en')).toContain('2.1 GB');
  });

  it('juste sous 1 Go : en Mo, 1023 Mo', () => {
    expect(tmpLine(GO - MO, 'fr')).toContain('1023 Mo');
  });

  it('une seule ligne, qui dit que la course est arrêtée', () => {
    for (const lang of ['fr', 'en'] as const) {
      const line = tmpLine(GO, lang);
      expect(line).not.toContain('\n');
      expect(line).toMatch(lang === 'fr' ? /arrêtée/ : /stopped/);
    }
  });
});
