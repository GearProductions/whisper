// Variants du pur de la commande vibecoder (note 0.15.0, docs/tickets/feat/0.15.0-cli.md) :
// plugin/bin/cli.mjs, en JS lancé par node sans construction ; chargé tel quel.
// Les invariants (un robot ne lit jamais live.json) : tests/invariants/cli-robot-env.test.ts.
// Ne connaissent pas : le réseau, le disque. Utilisés par npm test.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

type Parsed = { cmd: string; args: Record<string, unknown>; json: boolean } | { local: 'commands' | 'schema'; name?: string; json: boolean } | { usage: string };
type Answer = { ok: true; result: unknown } | { ok: false; error: { code: string; message: string; todo: string } };
const cli = await import(pathToFileURL(path.resolve(__dirname, '../../resources/vibecoder/plugin/bin/cli.mjs')).href) as {
  livePath(env: Record<string, string | undefined>, platform: string, home: string): string;
  readLive(text: string | null): { port: number; token?: string } | null;
  callFrom(env: Record<string, string | undefined>, readLiveFile: () => string | null): { port: number; token: string } | { error: string };
  parseCommandLine(argv: string[]): Parsed;
  render(answer: Answer, json: boolean): string;
  exitCode(answer: Answer): 0 | 1;
};
const { livePath, readLive, callFrom, parseCommandLine: parse, render, exitCode } = cli;

describe('readLive', () => {
  it('le port, et le jeton quand il y est', () => {
    expect(readLive('{"port":4000,"pid":1}')).toEqual({ port: 4000 });
    expect(readLive('{"port":4000,"pid":1,"token":"t"}')).toEqual({ port: 4000, token: 't' });
  });
  it.each([[null], ['pas du json'], ['{}'], ['{"port":"4000"}'], ['{"port":40.5}'], ['[4000]'], ['null']])('%s : null', (text) => {
    expect(readLive(text)).toBeNull();
  });
});

describe('callFrom', () => {
  it('avec VIBECODER_PORT et VIBECODER_TOKEN, live.json n’est jamais lu', () => {
    const read = vi.fn(() => null);
    expect(callFrom({ VIBECODER_PORT: '4002', VIBECODER_TOKEN: 'r' }, read)).toEqual({ port: 4002, token: 'r' });
    expect(read).not.toHaveBeenCalled();
  });
  it('sans eux, le port et le jeton de live.json', () => {
    expect(callFrom({}, () => '{"port":4001,"token":"o"}')).toEqual({ port: 4001, token: 'o' });
  });
  it('live.json sans jeton : l’erreur nomme le réglage', () => {
    const call = callFrom({}, () => '{"port":4001}');
    expect(call).toHaveProperty('error', expect.stringContaining('Autoriser les agents extérieurs'));
  });
  it('ni l’un ni l’autre : l’appli n’est pas lancée', () => {
    const call = callFrom({}, () => null);
    expect(call).toHaveProperty('error', expect.stringMatching(/not running/i));
  });
});

describe('parseCommandLine', () => {
  it.each([
    [['status'], 'status', {}],
    [['next'], 'next', {}],
    [['run', 'start', 'write-invariants'], 'run.start', { action: 'write-invariants' }],
    [['run', 'start', 'module', 'module=src/a.ts'], 'run.start', { action: 'module', module: 'src/a.ts' }],
    [['run', 'stop', 'a'], 'run.stop', { action: 'a' }],
    [['run', 'list'], 'runs', {}],
    [['run', 'wait', 'a'], 'run.wait', { action: 'a' }],
    [['proc', 'list'], 'procs', {}],
    [['proc', 'restart', 'front'], 'proc.restart', { name: 'front' }],
    [['proc', 'stop', 'front'], 'proc.stop', { name: 'front' }],
    [['proc', 'logs', 'front'], 'logs', { name: 'front' }],
  ])('%j', (argv, cmd, args) => {
    expect(parse(argv)).toEqual({ cmd, args, json: false });
  });
  it('la forme générale : une valeur est du texte', () => {
    expect(parse(['draft.add', 'target=a', 'text=b c'])).toEqual({ cmd: 'draft.add', args: { target: 'a', text: 'b c' }, json: false });
    expect(parse(['draft.add', 'target=a', 'text=x=y'])).toMatchObject({ args: { text: 'x=y' } });
  });
  it('une valeur qui commence par { ou [ est lue en JSON', () => {
    expect(parse(['new-artifact-folder', 'name=n', 'x={"a":[1]}', 'y=["p"]'])).toMatchObject({ args: { name: 'n', x: { a: [1] }, y: ['p'] } });
    expect(parse(['status', 'x={pas du json'])).toHaveProperty('usage');
  });
  it('un argument sans = : usage', () => {
    expect(parse(['draft.add', 'target'])).toHaveProperty('usage');
    expect(parse(['draft.add', '=a'])).toHaveProperty('usage');
  });
  it('un raccourci sans son nom, ou inconnu : usage', () => {
    for (const argv of [['run'], ['run', 'start'], ['run', 'stop'], ['run', 'x'], ['proc', 'logs'], ['proc', 'list', 'x']]) {
      expect(parse(argv)).toHaveProperty('usage');
    }
  });
  it('--json à toute place', () => {
    expect(parse(['--json', 'status'])).toEqual({ cmd: 'status', args: {}, json: true });
    expect(parse(['run', 'start', '--json', 'a'])).toEqual({ cmd: 'run.start', args: { action: 'a' }, json: true });
    expect(parse(['status', '--json'])).toEqual({ cmd: 'status', args: {}, json: true });
  });
  it('rien : usage', () => {
    expect(parse([])).toHaveProperty('usage');
    expect(parse(['--json'])).toHaveProperty('usage');
  });
  it('commands, schema <commande> : local', () => {
    expect(parse(['commands'])).toEqual({ local: 'commands', json: false });
    expect(parse(['schema', 'run.start', '--json'])).toEqual({ local: 'schema', name: 'run.start', json: true });
    expect(parse(['schema'])).toHaveProperty('usage');
  });
});

describe('render et exitCode', () => {
  const ok: Answer = { ok: true, result: { branch: 'main' } };
  const queued: Answer = { ok: true, result: { queued: true, by: 'write-invariants' } };
  const refused: Answer = { ok: false, error: { code: 'busy', message: 'Another action holds the folder.', todo: 'Wait for it.' } };

  it('ok : 0', () => {
    expect(exitCode(ok)).toBe(0);
    expect(render(ok, false)).toContain('main');
  });
  it('en attente : 0, et le texte le dit', () => {
    expect(exitCode(queued)).toBe(0);
    expect(render(queued, false)).toMatch(/queued|waits/i);
    expect(render(queued, false)).toContain('write-invariants');
  });
  it('un refus : 1, son code, son message et son todo', () => {
    expect(exitCode(refused)).toBe(1);
    const text = render(refused, false);
    for (const part of ['busy', 'Another action holds the folder.', 'Wait for it.']) expect(text).toContain(part);
  });
  it('--json : la réponse sur une ligne', () => {
    for (const a of [ok, queued, refused]) {
      const text = render(a, true);
      expect(text).not.toContain('\n');
      expect(JSON.parse(text)).toEqual(a);
    }
  });
});

describe('livePath', () => {
  it('Linux, avec XDG_CONFIG_HOME', () => {
    expect(livePath({ XDG_CONFIG_HOME: '/x/cfg' }, 'linux', '/home/u')).toBe('/x/cfg/whisper-dictation/live.json');
  });
  it('Linux, sans XDG_CONFIG_HOME', () => {
    expect(livePath({}, 'linux', '/home/u')).toBe('/home/u/.config/whisper-dictation/live.json');
  });
  it('Windows : APPDATA', () => {
    expect(livePath({ APPDATA: 'C:\\Users\\u\\AppData\\Roaming' }, 'win32', 'C:\\Users\\u'))
      .toBe('C:\\Users\\u\\AppData\\Roaming\\whisper-dictation\\live.json');
  });
});
