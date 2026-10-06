// Invariants des ponts (SPEC I-3, I-20) : chaque page n'a que ses canaux, et le
// principal n'écoute une fenêtre que sur les siens, en contrôlant l'expéditeur.
// Protégé : si ce test échoue, corriger le code. Un canal ajouté se décide
// (SPEC.md, note du ticket) avant d'entrer dans ces listes.
//
// Le reste du contrat est vérifié par le typage : la table de gestionnaires de
// chaque fenêtre (HandlerTable) couvre exactement ses canaux.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUBBLE_CHANNELS, ICON_CHANNELS, PANEL_CHANNELS } from '../../src/shared/bridge/channels';

// Un faux `electron` pour les ponts : relève le nom exposé et les canaux empruntés.
const fake = vi.hoisted(() => ({
  exposed: {} as Record<string, Record<string, (...a: unknown[]) => unknown>>,
  used: [] as [string, string, unknown[]][],
}));
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: (name: string, api: Record<string, (...a: unknown[]) => unknown>) => { fake.exposed[name] = api; } },
  ipcRenderer: {
    send: (ch: string, ...a: unknown[]) => { fake.used.push(['send', ch, a]); },
    invoke: (ch: string, ...a: unknown[]) => { fake.used.push(['invoke', ch, a]); return Promise.resolve(); },
    on: (ch: string) => { fake.used.push(['events', ch, []]); },
  },
  webUtils: { getPathForFile: () => '' },
}));

beforeEach(() => { fake.exposed = {}; fake.used = []; });

async function bridge(file: string) {
  vi.resetModules();
  await import(`../../src/preload/${file}`);
  const names = Object.keys(fake.exposed);
  expect(names).toHaveLength(1);
  for (const fn of Object.values(fake.exposed[names[0]])) fn(() => {}, 0);
  const by = (kind: string) => [...new Set(fake.used.filter(([k]) => k === kind).map(([, ch]) => ch))].sort();
  return { name: names[0], send: by('send'), invoke: by('invoke'), events: by('events') };
}
const sorted = (l: readonly string[]) => [...l].sort();

describe('ponts des pages', () => {
  it.each([
    ['icon', 'api', ICON_CHANNELS, /^(win|config|dictation|menu|tts|agent|agents):/],
    ['bubble', 'bubble', BUBBLE_CHANNELS, /^bubble:/],
    ['panel', 'conv', PANEL_CHANNELS, /^conv:/],
  ] as const)('%s : ses canaux, et seulement eux', async (file, name, channels, prefix) => {
    const b = await bridge(file);
    expect(b.name).toBe(name);
    expect(b.send).toEqual(sorted(channels.send));
    expect(b.invoke).toEqual(sorted(channels.invoke));
    expect(b.events).toEqual(sorted(channels.events));
    for (const ch of [...b.send, ...b.invoke, ...b.events]) expect(ch).toMatch(prefix);
  });

  it('Copier ne transporte aucun texte : le principal copie le sien (I-3)', async () => {
    vi.resetModules();
    await import('../../src/preload/panel');
    fake.used = [];
    fake.exposed.conv.copy('texte de la page');
    expect(fake.used).toEqual([['invoke', 'conv:copy', []]]);
  });
});

// Tout le code du principal, sauf le module qui contrôle l'expéditeur.
function sources(dir: string): [string, string][] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'tests' ? [] : sources(p);
    return /\.ts$/.test(n) ? [[p, readFileSync(p, 'utf8')] as [string, string]] : [];
  });
}
const MAIN = resolve(__dirname, '../../src/main');

describe('principal : contrôle de l’expéditeur', () => {
  it('seul technicals/ipc écoute les pages', () => {
    const outside = sources(MAIN).filter(([p, s]) => !p.includes(join('technicals', 'ipc')) && /ipcMain\s*\.\s*(on|handle|once)\b/.test(s));
    expect(outside.map(([p]) => p)).toEqual([]);
  });

  it('chaque fenêtre est écoutée sur ses propres canaux', () => {
    const listen = sources(MAIN).map(([, s]) => s).join('\n');
    const calls = [...listen.matchAll(/listenFrom\(\s*\w+,\s*\(\)\s*=>\s*state\.(\w+),\s*(\w+_CHANNELS)/g)].map((m) => `${m[1]}:${m[2]}`).sort();
    expect(calls).toEqual(['bubble:BUBBLE_CHANNELS', 'icon:ICON_CHANNELS', 'panel:PANEL_CHANNELS']);
  });
});
