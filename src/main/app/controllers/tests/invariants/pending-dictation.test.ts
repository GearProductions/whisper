// Invariant de la dictée vers un agent (SPEC F-68, S-20) : ce qui attend la
// page du panneau (le texte dicté, le focus du champ) ne lui est remis
// qu'APRÈS le fil de l'agent auquel il est destiné. Avant, le premier fil reçu
// bascule le brouillon et l'efface : la dictée est perdue.
// Protégé : si ce test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages sur disque) ;
// faux : Electron (fenêtres qui relèvent ce qu'on leur envoie) et le SDK de
// Claude Code (lecture de la session, dont on règle la durée).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  type Handler = (...a: unknown[]) => void;
  class Win {
    sent: [string, unknown][] = [];
    handlers = new Map<string, Handler[]>();
    visible = false;
    webContents = {
      send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); },
      on: () => {}, setWindowOpenHandler: () => {},
    };
    on(ev: string, fn: Handler) { this.handlers.set(ev, [...(this.handlers.get(ev) || []), fn]); return this; }
    once(ev: string, fn: Handler) { return this.on(ev, fn); }
    emit(ev: string) { for (const fn of this.handlers.get(ev) || []) fn(); }
    loadFile() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setResizable() {} setBounds() {}
    getBounds() { return { x: 500, y: 500, width: 64, height: 64 }; }
    isVisible() { return this.visible; } isDestroyed() { return false; } isMinimized() { return false; }
    show() { this.visible = true; } showInactive() { this.visible = true; } hide() { this.visible = false; }
    focus() { this.emit('focus'); } restore() {} minimize() { this.visible = false; }
  }
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], readMs: [] as number[] };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData, getAppMetrics: () => [] },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

// La lecture de la session : chaque appel prend la durée suivante de `readMs`.
vi.mock('technicals/claude', () => ({
  launcher: () => null,
  loadSdk: async () => ({
    getSessionInfo: async () => ({ summary: 'Essai' }),
    getSessionMessages: (sessionId: string) => new Promise((resolve) => setTimeout(() => resolve([
      { type: 'user', timestamp: '2026-10-09T10:00:00Z', sessionId, message: { content: 'bonjour' } },
    ]), fake.readMs.shift() ?? 0)),
  }),
}));

const settle = () => new Promise((r) => setTimeout(r, 200));

beforeEach(() => {
  vi.resetModules();
  fake.windows = [];
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-pending-'));
  fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true, agentSelected: 'a1',
    agents: [{ id: 'a1', dir: fake.userData, name: 'essai', model: '', effort: '', mode: 'default', sessionId: 's1' }],
  }));
});

// Le panneau n'existe pas encore : la dictée vers l'agent le crée (comme
// transcribe : openConversation puis conversationInput), la page se dit prête,
// et la fenêtre neuve reçoit le focus pendant que la session se lit.
async function firstDictation(readMs: number[]) {
  fake.readMs = readMs;
  const { state } = await import('app/state');
  const { conversationFocusInput, conversationInput, openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  const icon = new fake.Win();
  state.icon = icon as never; // pushAgents ne fait rien sans icône
  openConversation('a1');
  conversationInput('texte dicté');
  conversationFocusInput();
  const panel = fake.windows.find((w) => w !== icon)!;
  const ready = panelReady();
  panel.emit('ready-to-show'); // show + focus → pushAgents → un second rafraîchissement
  await ready;
  await settle();
  return panel.sent.map(([ch, payload]) => (ch === 'conv:thread' ? `thread:${(payload as { key: string }).key}` : ch));
}

describe('la dictée arrive après le fil de son agent (F-68)', () => {
  for (const [label, readMs] of [
    ['la relecture du focus finit avant celle de la page prête', [80, 0]],
    ['la relecture du focus finit après celle de la page prête', [0, 80]],
  ] as const) {
    it(label, async () => {
      const sent = await firstDictation([...readMs]);
      const dictation = sent.indexOf('conv:dictation');
      const focus = sent.indexOf('conv:focusInput');
      expect(dictation).toBeGreaterThan(-1);
      expect(sent.slice(0, dictation)).toContain('thread:a1');
      expect(sent.slice(0, focus)).toContain('thread:a1');
      // Aucun fil d'une autre conversation entre-temps : il basculerait le brouillon.
      expect(sent.filter((s) => s.startsWith('thread:') && s !== 'thread:a1')).toEqual([]);
    });
  }
});
