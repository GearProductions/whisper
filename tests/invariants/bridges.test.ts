// Invariants des ponts (SPEC I-3, I-20) : chaque page n'a que ses canaux, et le
// principal n'écoute un canal sensible que de la fenêtre qui y a droit.
// Protégé : si ce test échoue, corriger le code. Un canal ajouté se décide
// (SPEC.md, note du ticket) avant d'entrer dans ces listes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (name: string) => readFileSync(resolve(__dirname, '../../src', name), 'utf8');

// Exécute un pont avec un faux `electron` et relève, pour chaque méthode
// exposée, le canal qu'elle emprunte.
function channelsOf(file: string) {
  const exposed: Record<string, Record<string, (...a: unknown[]) => unknown>> = {};
  const used: string[] = [];
  const ipcRenderer = {
    send: (ch: string) => { used.push(ch); },
    invoke: (ch: string) => { used.push(ch); return Promise.resolve(); },
    on: (ch: string) => { used.push(ch); },
  };
  const electron = {
    contextBridge: { exposeInMainWorld: (name: string, api: Record<string, (...a: unknown[]) => unknown>) => { exposed[name] = api; } },
    ipcRenderer,
    webUtils: { getPathForFile: () => '' },
  };
  new Function('require', src(file))((m: string) => (m === 'electron' ? electron : undefined));
  const names = Object.keys(exposed);
  expect(names).toHaveLength(1);
  const api = exposed[names[0]];
  for (const fn of Object.values(api)) fn(() => {}, 0);
  return { name: names[0], methods: Object.keys(api).sort(), channels: [...new Set(used)].sort() };
}

const ICON = ['agent:add', 'agent:click', 'agent:menu', 'agents:state', 'config:get', 'config:setDevice',
  'dictation:recording', 'dictation:transcribe', 'dictation:warmUp', 'menu:open', 'tts:cancel', 'tts:chunk',
  'tts:end', 'tts:speak', 'tts:speakReply', 'tts:state', 'tts:warmUp', 'win:getBounds', 'win:savePosition',
  'win:setPosition'];
const BUBBLE = ['bubble:close', 'bubble:hover', 'bubble:ready', 'bubble:show', 'bubble:volume'];
const PANEL = ['conv:answer', 'conv:attach', 'conv:attached', 'conv:copy', 'conv:current', 'conv:dictation',
  'conv:focusInput', 'conv:height', 'conv:hide', 'conv:history', 'conv:mode', 'conv:notice', 'conv:open',
  'conv:openLink', 'conv:probe', 'conv:ready', 'conv:resume', 'conv:send', 'conv:showFile', 'conv:speak',
  'conv:thread'];

describe('ponts des pages', () => {
  it('l’icône : ses canaux, aucun du panneau', () => {
    const { name, channels } = channelsOf('preload.js');
    expect(name).toBe('api');
    expect(channels).toEqual(ICON);
  });

  it('la bulle : ses canaux seulement', () => {
    const { name, channels } = channelsOf('bubble-preload.js');
    expect(name).toBe('bubble');
    expect(channels).toEqual(BUBBLE);
  });

  it('le panneau : ses canaux seulement', () => {
    const { name, channels } = channelsOf('conversation-preload.js');
    expect(name).toBe('conv');
    expect(channels).toEqual(PANEL);
  });

  it('Copier ne transporte aucun texte : le principal copie le sien (I-3)', () => {
    let sent: unknown[] = [];
    const electron = {
      contextBridge: { exposeInMainWorld: (_n: string, api: { copy: (...a: unknown[]) => unknown }) => { api.copy('texte de la page'); } },
      ipcRenderer: { send() {}, on() {}, invoke: (...a: unknown[]) => { sent = a; return Promise.resolve(); } },
      webUtils: { getPathForFile: () => '' },
    };
    new Function('require', src('conversation-preload.js'))(() => electron);
    expect(sent).toEqual(['conv:copy']);
  });
});

// Chaque gestionnaire d'un canal agent:* ou conv:* commence par vérifier
// l'expéditeur (I-20) : l'icône pour agent:*, le panneau pour conv:*.
describe('principal : contrôle de l’expéditeur', () => {
  const main = src('main.js');
  const handlers = [...main.matchAll(/ipcMain\.(?:on|handle)\('((?:agent|conv):[A-Za-z]+)'([\s\S]*?)(?=\nipcMain\.|\n\/\* ----|$)/g)];

  it('trouve les gestionnaires', () => {
    const names = handlers.map((h) => h[1]);
    expect(names).toEqual(expect.arrayContaining(['agent:click', 'agent:add', 'agent:menu', 'conv:send', 'conv:answer', 'conv:copy']));
  });

  it.each(handlers.map((h) => [h[1], h[2]] as const))('%s vérifie sentBy', (name, body) => {
    const window = name.startsWith('agent:') ? 'win' : 'conv';
    expect(body).toContain(`sentBy(e, ${window})`);
  });
});
