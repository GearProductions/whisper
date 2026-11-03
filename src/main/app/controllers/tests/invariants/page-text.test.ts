// Invariants de la dictée et de la lecture à voix haute, côté principal (note
// 0.14.0, « Ce que ça ne doit pas faire »). Protégés : si un test échoue,
// corriger le code.
//   I-2 (réduit) : n'envoyer à un agent que le texte du champ ou ce que
//         whisper vient de rendre ; la transcription est rendue à la page
//         qui l'a demandée, jamais envoyée d'elle-même à un agent.
//   I-3 (réduit) : aucun canal « lis ce texte » : Écouter désigne une réponse
//         par son rang, le principal lit le résumé qu'il a retenu (F-46).
//   I-10 : pas de whisper sur du silence (F-4).
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages sur disque) ;
// faux : Electron (fenêtres qui relèvent ce qu'on leur envoie), le SDK de
// Claude Code (chaque message reçu par un agent est relevé), whisper-cli et
// Pocket TTS (les modèles : ce qu'on leur donne est relevé).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { slow } from '../slow';

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
    getBounds() { return { x: 500, y: 500, width: 900, height: 700 }; }
    isVisible() { return this.visible; } isDestroyed() { return false; } isMinimized() { return false; }
    isFocused() { return this.visible; }
    show() { this.visible = true; } showInactive() { this.visible = true; } hide() { this.visible = false; }
    focus() { this.emit('focus'); } restore() {} minimize() { this.visible = false; }
  }
  return {
    Win, userData: '', windows: [] as InstanceType<typeof Win>[],
    // Ce que whisper rend, et la taille de chaque audio qu'il a reçu.
    whisperSays: '', whisperRuns: [] as number[],
    // Chaque texte que Pocket TTS a reçu à lire.
    spoken: [] as unknown[],
    // Chaque message reçu par un agent.
    prompts: [] as unknown[],
    // Chaque appel au presse-papiers : la méthode et ses arguments.
    copied: [] as [string, unknown[]][],
    // Les gestionnaires posés sur ipcMain, par canal.
    ipc: new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>(),
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData, getAppMetrics: () => [], getVersion: () => '0.0.0' },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  ipcMain: {
    on: (ch: string, fn: (e: { sender: unknown }, ...a: unknown[]) => unknown) => { fake.ipc.set(ch, fn); },
    handle: (ch: string, fn: (e: { sender: unknown }, ...a: unknown[]) => unknown) => { fake.ipc.set(ch, fn); },
  },
  // Le presse-papiers relève tout appel ; il ne rend que du vide.
  clipboard: new Proxy({}, { get: (_t, name) => (...a: unknown[]) => { fake.copied.push([String(name), a]); return ''; } }),
  // Un menu s'ouvre sans rien faire ; une notification du système ne montre rien.
  Menu: { buildFromTemplate: () => ({ popup: () => {} }), setApplicationMenu: () => {} },
  Notification: class { static isSupported() { return false; } on() {} show() {} },
  shell: {}, dialog: {}, nativeImage: {},
}));

// Claude Code : chaque message reçu par un agent est relevé.
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt }: { prompt: AsyncIterable<{ message: { content: unknown } }> }) => Object.assign((async function* run() {
      for await (const m of prompt) {
        fake.prompts.push(m.message.content);
        yield { type: 'result', subtype: 'success', is_error: false };
      }
    }()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => {} }),
  }),
}));

// whisper : installé, il rend `whisperSays` et relève l'audio reçu.
vi.mock('technicals/whisper-cli', async (original) => ({
  ...await original<typeof import('technicals/whisper-cli')>(),
  locateWhisper: () => ({ cli: '/whisper/whisper-cli', model: '/whisper/ggml-base.bin' }),
  runWhisper: async (_dirs: string[], pcm: Buffer) => { fake.whisperRuns.push(pcm.length); return fake.whisperSays; },
}));

// Pocket TTS : installé, il relève le texte qu'on lui donne à lire.
vi.mock('technicals/pocket-tts', async (original) => ({
  ...await original<typeof import('technicals/pocket-tts')>(),
  isInstalled: () => true,
  speak: (text: unknown) => { fake.spoken.push(text); return 1; },
  warmUp: () => {},
  cancel: () => {},
}));

const settle = () => new Promise((r) => setTimeout(r, slow(200)));
const RATE = 16000;
// Une seconde de parole : un signal franc, bien au-dessus du seuil du silence.
const speech = () => new Int16Array(RATE).fill(0.2 * 0x7fff).buffer;
// Une seconde muette.
const mute = () => new Int16Array(RATE).buffer;
// Une parole trop courte : un dixième de seconde.
const tooShort = () => new Int16Array(RATE / 10).fill(0.2 * 0x7fff).buffer;
// Un texte que la page voudrait faire lire.
const PAGE_TEXT = 'texte fourni par la page';

beforeEach(() => {
  vi.resetModules();
  fake.windows = [];
  fake.whisperSays = '';
  fake.whisperRuns = [];
  fake.spoken = [];
  fake.prompts = [];
  fake.copied = [];
  fake.ipc = new Map();
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-page-text-')));
  // Un agent affiché : une dictée aurait à qui partir. agentReview: false, le
  // pire cas d'avant (la dictée partait aussitôt chez l'agent), une clé
  // ignorée une fois le réglage retiré.
  fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true, agentSelected: 'a1', autoPaste: false, agentReview: false,
    agents: [{ id: 'a1', dir: fake.userData, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null }],
  }));
});

describe('la transcription est rendue à la page, telle que whisper l’a rendue (I-2)', () => {
  it('le texte rendu à la page est celui que whisper vient de rendre', async () => {
    fake.whisperSays = 'bonjour le monde';
    const { transcribe } = await import('app/controllers');

    const result = await transcribe(speech());

    // Le texte rendu est exactement la sortie de whisper.
    expect(result.text).toBe(fake.whisperSays);
  });

  it('une transcription ne part chez aucun agent, même quand un agent est affiché', async () => {
    fake.whisperSays = 'bonjour le monde';
    const { transcribe } = await import('app/controllers');

    await transcribe(speech());
    await settle();

    // Aucun agent n'a reçu de message : seule la page décide d'envoyer son champ.
    expect(fake.prompts).toEqual([]);
  });
});

describe('pas de whisper sur du silence (I-10)', () => {
  it('un enregistrement muet n’est pas donné à whisper', async () => {
    fake.whisperSays = 'texte inventé sur du silence';
    const { transcribe } = await import('app/controllers');

    await transcribe(mute());

    // whisper n'a reçu aucun audio.
    expect(fake.whisperRuns).toEqual([]);
  });

  it('un enregistrement trop court n’est pas donné à whisper', async () => {
    fake.whisperSays = 'texte inventé sur du silence';
    const { transcribe } = await import('app/controllers');

    await transcribe(tooShort());

    // whisper n'a reçu aucun audio.
    expect(fake.whisperRuns).toEqual([]);
  });
});

describe('aucun canal « lis ce texte » ou « copie ce texte » (I-3)', () => {
  // Un balayage, pas une table de cas : la propriété porte sur tous les canaux du
  // panneau à la fois, ceux d'aujourd'hui comme ceux qu'on ajoutera.
  it('un texte donné à chaque canal du panneau n’arrive ni au presse-papiers ni à la lecture', async () => {
    const { registerIpc } = await import('app/ipc');
    const { state } = await import('app/state');
    const { PANEL_CHANNELS } = await import('shared/bridge');
    const panel = new fake.Win();
    state.panel = panel as never;
    registerIpc();

    for (const ch of [...PANEL_CHANNELS.send, ...PANEL_CHANNELS.invoke]) {
      const handler = fake.ipc.get(ch)!;
      // Chaque argument est le texte de la page, envoyé par la fenêtre du panneau ; un refus est permis.
      try { await Promise.race([handler({ sender: panel.webContents }, PAGE_TEXT, PAGE_TEXT, PAGE_TEXT), settle()]); } catch { /* refusé */ }
    }
    await settle();

    // Le presse-papiers n'a jamais reçu le texte de la page.
    expect(JSON.stringify(fake.copied)).not.toContain(PAGE_TEXT);
    // Pocket TTS ne l'a jamais reçu à lire.
    expect(JSON.stringify(fake.spoken)).not.toContain(PAGE_TEXT);
  });

  it('Écouter avec un objet portant un texte, à la place du rang, ne le lit pas', async () => {
    const { speakReply } = await import('app/controllers');

    await speakReply({ text: PAGE_TEXT } as never);
    await settle();

    // Rien de ce que Pocket TTS a reçu ne contient le texte de la page.
    expect(JSON.stringify(fake.spoken)).not.toContain(PAGE_TEXT);
  });
});
