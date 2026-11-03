// Invariants des ponts (SPEC I-20) : la page n'a que ses canaux, et le
// principal n'écoute la fenêtre que sur les siens, en contrôlant l'expéditeur.
// 0.14.0 : une seule fenêtre, le panneau de VibeCoder (l'icône, la bulle et
// leurs ponts retirés) ; Copier et conv:copy partis avec le contexte Dictée,
// I-3 réduit gardé par src/main/app/controllers/tests/invariants/page-text.test.ts.
// Protégé : si ce test échoue, corriger le code. Un canal ajouté se décide
// (SPEC.md, note du ticket) avant d'entrer dans ces listes.
//
// Le reste du contrat est vérifié par le typage : la table de gestionnaires de
// chaque fenêtre (HandlerTable) couvre exactement ses canaux.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PANEL_CHANNELS } from '../../src/shared/bridge/channels';

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

describe('pont du panneau', () => {
  it('le panneau : ses canaux, et seulement eux', async () => {
    const b = await bridge('panel');

    // Le pont s'expose sous le nom attendu par la page.
    expect(b.name).toBe('conv');
    // Il n'emprunte que les canaux du panneau, et tous.
    expect(b.send).toEqual(sorted(PANEL_CHANNELS.send));
    expect(b.invoke).toEqual(sorted(PANEL_CHANNELS.invoke));
    expect(b.events).toEqual(sorted(PANEL_CHANNELS.events));
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

  it('seul le panneau est écouté, sur ses propres canaux', () => {
    const listen = sources(MAIN).map(([, s]) => s).join('\n');

    const calls = [...listen.matchAll(/listenFrom\(\s*\w+,\s*\(\)\s*=>\s*state\.(\w+),\s*(\w+_CHANNELS)/g)].map((m) => `${m[1]}:${m[2]}`).sort();

    // Une seule écoute : la fenêtre du panneau, sur les canaux du panneau.
    expect(calls).toEqual(['panel:PANEL_CHANNELS']);
  });
});
