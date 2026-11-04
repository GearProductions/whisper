// settingsOp : null → la page ; une écriture acceptée est écrite puis la page relue ; une refusée n'écrit
// rien ; chaque commande appelle son effet ; rétablir le son refusé pendant une dictée ; commande inconnue : rien.
// Vrai : core/settings et la configuration sur disque. Faux : Electron, les contrôleurs voisins (leurs effets
// sont relevés), whisper et Pocket TTS.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ userData: '', calls: [] as string[] }));
const call = (name: string) => (...a: unknown[]) => { fake.calls.push([name, ...a.map((x) => typeof x === 'string' ? x : JSON.stringify(x))].join(' ')); };

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData, getVersion: () => '1.2.3', isPackaged: true, quit: call('quit'), getAppMetrics: () => [] },
  shell: { openPath: call('openPath'), openExternal: call('openExternal') },
  BrowserWindow: class {}, Menu: {}, dialog: {}, clipboard: {}, nativeImage: {}, screen: {},
}));
vi.mock('app/controllers/agents', () => ({ agents: { isAvailable: () => true } }));
vi.mock('app/controllers/dictation', () => ({ forceRestoreSound: call('restoreSound') }));
vi.mock('app/controllers/speech', () => ({ installPocket: call('installPocket') }));
vi.mock('app/controllers/vibecoder', () => ({ refreshVibe: call('refreshVibe') }));
vi.mock('app/controllers/runs', () => ({ skillMd: () => null }));
vi.mock('technicals/whisper-cli', () => ({ locateWhisper: () => ({ cli: '/w/cli', model: '/w/ggml-base.bin' }) }));
vi.mock('technicals/editor', () => ({ findEditor: () => ({ name: 'Zed' }) }));
vi.mock('technicals/pocket-tts', async (orig) => ({ ...await orig<object>(), isInstalled: () => false, canInstall: () => true }));

const configFile = () => path.join(fake.userData, 'config.json');
const config = () => JSON.parse(fs.readFileSync(configFile(), 'utf8'));
type View = { categories: { id: string; items: { key?: string; value?: unknown; disabled?: boolean }[] }[] };
const item = (v: View, key: string) => v.categories.flatMap((c) => c.items).find((i) => i.key === key);

beforeEach(() => {
  vi.resetModules();
  fake.calls = [];
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-settings-op-'));
  fs.writeFileSync(configFile(), JSON.stringify({ vibeLang: 'fr' }));
});

async function op(arg: unknown, recording = false) {
  const { state } = await import('app/state');
  state.recording = recording;
  const { settingsOp } = await import('app/controllers/settings');
  return await settingsOp(arg) as unknown as View;
}

describe('settingsOp', () => {
  it('null : la page, avec les faits lus', async () => {
    const view = await op(null);
    expect(item(view, 'whisperModel')?.value).toBe('ggml-base.bin');
    expect(item(view, 'version')?.value).toBe('1.2.3');
    expect(item(view, 'editor')?.value).toBe('Zed');
    expect(item(view, 'installTts')).toBeDefined();
    expect(fake.calls).toEqual([]);
  });

  it('un réglage accepté : écrit, page relue, relevé de VibeCoder refait', async () => {
    const view = await op({ set: 'agentLang', value: 'en' });
    expect(config().agentLang).toBe('en');
    expect(item(view, 'agentLang')?.value).toBe('en');
    expect(fake.calls).toEqual(['refreshVibe {"now":true}']);
  });

  it('un volume : écrit', async () => {
    await op({ set: 'speakVolume', value: 0.5 });
    expect(config().speakVolume).toBe(0.5);
  });

  it.each([
    ['une valeur refusée', { set: 'agentLang', value: 'de' }],
    ['une clé que la page ne montre pas', { set: 'deviceId', value: 'x' }],
    ['un volume hors bornes', { set: 'speakVolume', value: 2 }],
    ['un modèle Fable', { set: 'model:note', value: 'fable' }],
  ])('%s : rien d\'écrit', async (_name, arg) => {
    const before = fs.readFileSync(configFile(), 'utf8');
    await op(arg);
    expect(fs.readFileSync(configFile(), 'utf8')).toBe(before);
    expect(fake.calls).toEqual([]);
  });

  it.each([
    ['installTts', 'installPocket'],
    ['restoreSound', 'restoreSound'],
    ['whisperDir', '/whisper'],
    ['configFile', '/config.json'],
    ['instructions', 'openPath '],
    ['journal', 'openPath '],
    ['vibeDir', 'openPath '],
    ['releases', 'openExternal https://github.com/GearProductions/whisper/releases/tag/v1.2.3'],
    ['quit', 'quit'],
  ])('la commande %s appelle son effet', async (run, effect) => {
    await op({ run });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toContain(effect);
  });

  it('rétablir le son : refusé pendant une dictée', async () => {
    const view = await op({ run: 'restoreSound' }, true);
    expect(fake.calls).toEqual([]);
    expect(item(view, 'restoreSound')?.disabled).toBe(true);
  });

  it.each([null, 'quit', 3, { run: 'rm' }, { set: 7, value: 1 }, {}])('une demande inconnue (%j) : la page, rien d\'autre', async (arg) => {
    const before = fs.readFileSync(configFile(), 'utf8');
    const view = await op(arg);
    expect(view.categories.length).toBeGreaterThan(0);
    expect(fake.calls).toEqual([]);
    expect(fs.readFileSync(configFile(), 'utf8')).toBe(before);
  });
});
