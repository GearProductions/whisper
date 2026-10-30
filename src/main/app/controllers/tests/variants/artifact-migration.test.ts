// Le déplacement des anciens artefacts (artifact-migration.ts), cas hors des invariants : un
// artifacts-left.json qui ne se lit pas (ici un dossier : EISDIR) ne bloque pas le déplacement de
// ceux de la config. Sur le vrai principal (réglages et fichiers sur disque) ; faux : Electron et le SDK.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ cwd: process.cwd(), userData: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class {},
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  protocol: { registerSchemesAsPrivileged: () => {}, handle: () => {} },
  dialog: {}, shell: {}, clipboard: {}, nativeImage: {},
}));

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: () => Object.assign((async function* run() {}()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => {} }),
  }),
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${fake.cwd}/resources/${name}`,
}));

const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
let project = '';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-migration-v-')));
  project = path.join(fake.userData, 'seul');
  fs.mkdirSync(project, { recursive: true });
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir: project, name: 'seul', model: 'opus', effort: 'high', mode: 'default', sessionId: null }],
  }));
});
afterEach(() => { vi.useRealTimers(); });

it('artifacts-left.json illisible (un dossier) : la config est servie, le déplacement va au bout', async () => {
  write(path.join(fake.userData, 'vibecoder-out', 'a1', 'artifacts', 'rapport.md'), 'DEPOT');
  fs.mkdirSync(path.join(fake.userData, 'artifacts-left.json'));

  const { moveLegacyArtifacts, projectArtifactsPath } = await import('app/controllers');
  await moveLegacyArtifacts();

  expect(fs.readFileSync(path.join(projectArtifactsPath(project), 'rapport.md'), 'utf8')).toBe('DEPOT');
  expect(fs.existsSync(path.join(fake.userData, 'vibecoder-out', 'a1', 'artifacts', 'rapport.md'))).toBe(false);
});
