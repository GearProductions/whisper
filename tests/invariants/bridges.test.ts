// Invariants des ponts (SPEC I-20) : la page n'a que ses canaux, et le
// principal n'écoute la fenêtre que sur les siens, en contrôlant l'expéditeur.
// 0.14.0 : une seule fenêtre, le panneau de VibeCoder (l'icône, la bulle et
// leurs ponts retirés) ; Copier et conv:copy partis avec le contexte Dictée,
// I-3 réduit gardé par src/main/app/controllers/tests/invariants/page-text.test.ts.
// 0.14.0, la page des réglages (docs/tickets/feat/0.14.0-allegement-interface-settings.md,
// accord donné dans la note) : le canal `settings` (invoke) entre, `menu:settings`
// sort avec le menu natif ; son expéditeur contrôlé sur le vrai principal :
// src/main/app/controllers/tests/invariants/settings-sender.test.ts.
// Protégé : si ce test échoue, corriger le code. Un canal ajouté se décide
// (SPEC.md, note du ticket) avant d'entrer dans ces listes.
//
// Les règles de structure (qui écoute les pages, sur quels canaux : lecture du
// code) sont dans tests/structure/bridges.test.ts.
//
// Le reste du contrat est vérifié par le typage : la table de gestionnaires de
// chaque fenêtre (HandlerTable) couvre exactement ses canaux.
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

  it('la page des réglages a son canal, settings, avec réponse', () => {
    const invoke: readonly string[] = PANEL_CHANNELS.invoke;

    // settings est un canal invoke du panneau : écouté par listenFrom avec les autres.
    expect(invoke).toContain('settings');
  });

  it('le menu natif des réglages n’a plus de canal', () => {
    const send: readonly string[] = PANEL_CHANNELS.send;

    // menu:settings n'est plus un canal du panneau.
    expect(send).not.toContain('menu:settings');
  });
});
