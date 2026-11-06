// Variantes de app/settings : ensureVibeFiles (le ménage des fichiers retirés ; le détail
// des cas est dans tests/invariants/vibe-files-retired.test.ts), vibeCommands (la table livrée).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData } }));
vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${fake.userData}/livre/${name}`,
}));

const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const shipped = (rel: string) => path.join(fake.userData, 'livre', 'vibecoder', rel);
const installed = (rel: string) => path.join(fake.userData, 'vibecoder', rel);
const settings = async () => import('app/settings');
const start = async () => (await import('app/settings')).ensureVibeFiles();

beforeEach(() => { vi.resetModules(); fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-settings-')); });
afterEach(() => { fs.rmSync(fake.userData, { recursive: true, force: true }); });

describe('ensureVibeFiles', () => {
  it('un fichier plus livré part avec son dossier vide, pas un dossier qui garde un fichier', async () => {
    write(shipped('plugin/agents/a.md'), 'a\n');
    write(shipped('plugin/agents/b.md'), 'b\n');
    write(shipped('plugin/skills/garde/SKILL.md'), 'garde\n');
    await start();
    fs.rmSync(shipped('plugin/agents/a.md'));
    fs.rmSync(shipped('plugin/agents/b.md'));
    fs.rmSync(shipped('plugin/skills/garde/SKILL.md'));
    write(installed('plugin/skills/garde/a-moi.md'), 'à moi\n');

    await start();

    expect(fs.existsSync(installed('plugin/agents'))).toBe(false);
    expect(fs.existsSync(installed('plugin/skills/garde/SKILL.md'))).toBe(false);
    expect(fs.existsSync(installed('plugin/skills/garde/a-moi.md'))).toBe(true);
  });
});

describe('vibeCommands', () => {
  const table = fs.readFileSync(path.resolve('resources/vibecoder/commands.json'), 'utf8');

  it('rend la table livrée, parsée', async () => {
    write(shipped('commands.json'), table);
    const { parseCommands } = await import('core/commands');
    expect((await settings()).vibeCommands()).toEqual(parseCommands(table));
  });

  it("ignore une copie de l'utilisateur : c'est le contrat, pas un réglage", async () => {
    write(shipped('commands.json'), table);
    write(installed('commands.json'), '{ pas une table');
    expect((await settings()).vibeCommands().commands.length).toBeGreaterThan(0);
  });

  it('lève devant une table fautive', async () => {
    write(shipped('commands.json'), '{ pas une table');
    expect((await settings()).vibeCommands).toThrow(/illisible/);
  });
});

describe('liveFile', () => {
  it("live.json, dans le dossier de l'appli", async () => {
    expect((await settings()).liveFile()).toBe(path.join(fake.userData, 'live.json'));
  });
});
