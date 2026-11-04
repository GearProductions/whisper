// Invariants de la dictée et de la lecture à voix haute, côté principal (note
// 0.14.0, « Ce que ça ne doit pas faire »). Protégés : si un test échoue,
// corriger le code.
//   I-2 (réduit) : n'envoyer à un agent que le texte du champ ou ce que
//         whisper vient de rendre ; la transcription est rendue à la page
//         qui l'a demandée, jamais envoyée d'elle-même à un agent.
//         Élargi en 0.14.0 (docs/tickets/feat/0.14.0-allegement-interface-settings.md,
//         accord donné dans la note) : ce qui part pour une action, c'est le
//         texte et les pièces jointes de son champ, plus son gabarit ; une
//         pièce refusée, rien ne part.
//   I-3 (réduit) : aucun canal « lis ce texte » : Écouter désigne une réponse
//         par son rang, le principal lit le résumé qu'il a retenu (F-46).
//   I-10 : pas de whisper sur du silence (F-4).
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages sur disque ;
// pour les actions, git réel sur un dépôt d'essai et les actions livrées dans
// resources/) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie ;
// le décodeur d'images ne lit rien, un GIF passe tel quel), le SDK de
// Claude Code (chaque message reçu par un agent est relevé), whisper-cli et
// Pocket TTS (les modèles : ce qu'on leur donne est relevé).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  shell: {}, dialog: {},
  // Le décodeur d'images d'Electron ne lit rien : un GIF part tel quel, un PNG est refusé.
  nativeImage: { createFromBuffer: () => ({ isEmpty: () => true }) },
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

// Les actions livrées.
vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
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

describe('ce qui part pour une action : le texte et les pièces jointes de son champ, plus son gabarit (I-2 élargi)', () => {
  const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
  // Le texte du champ, et ses pièces jointes : une sélection, un fichier par son chemin, une image (un GIF).
  const FIELD = 'le texte du champ';
  const SELECTION = 'la sélection jointe au champ';
  const FILE = path.join(os.tmpdir(), 'joint', 'document-joint.txt');
  const GIF = Buffer.from('GIF89a une image jointe au champ');
  const pieces = () => ({ selection: SELECTION, files: [FILE], images: [{ name: 'image.gif', type: 'image/gif', data: new Uint8Array(GIF).buffer }] });
  // Ce que les agents ont reçu, en un texte.
  const received = () => JSON.stringify(fake.prompts);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
    // Un dépôt sur une branche dont la note est écrite : la Forme et la ponytail review sont proposées.
    const dir = path.join(fake.userData, 'projet');
    fs.mkdirSync(path.join(dir, 'docs/tickets/feat'), { recursive: true });
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
    git(dir, 'checkout', '-q', '-b', 'feat/0.14.0-essai');
    fs.writeFileSync(path.join(dir, 'docs/tickets/feat/0.14.0-essai.md'), '# 0.14.0 — essai\n\n## Ce que ça fait\n\n- un essai\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'note');
    fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({
      agentsEnabled: true, agentSelected: 'a1',
      agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
        vibe: { flow: 'create', pr: null } }],
    }));
  });
  afterEach(() => { vi.useRealTimers(); });

  // Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
  async function open() {
    const { openConversation } = await import('app/windows');
    const { panelReady } = await import('app/controllers');
    openConversation('a1');
    fake.windows.at(-1)!.emit('ready-to-show');
    await panelReady();
    await settle();
  }

  it('le texte et chaque pièce jointe du champ partent avec son action', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');

    runVibeAction('forme', { text: FIELD, pieces: pieces() });
    await settle();

    // Le texte du champ est parti.
    expect(received()).toContain(FIELD);
    // La sélection jointe est partie.
    expect(received()).toContain(SELECTION);
    // Le chemin du fichier joint est parti.
    expect(received()).toContain(JSON.stringify(FILE).slice(1, -1));
    // L'image jointe est partie.
    expect(received()).toContain(GIF.toString('base64'));
  });

  // Envoyer les réponses : son gabarit lit {{answers}}, pas {{text}}.
  it('les pièces jointes des réponses partent avec Envoyer les réponses', async () => {
    // Une question ouverte laissée par la note : Envoyer les réponses est proposé.
    const out = path.join(fake.userData, 'vibecoder-out', 'a1');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'questions.md'), '## 1. Une question ?\n');
    await open();
    const { runVibeAction } = await import('app/controllers');
    const ANSWER = 'la réponse à la question ouverte';

    runVibeAction('answers', { answers: [ANSWER], pieces: pieces() });
    await settle();

    // La réponse est partie.
    expect(received()).toContain(ANSWER);
    // La sélection jointe est partie.
    expect(received()).toContain(SELECTION);
    // Le chemin du fichier joint est parti.
    expect(received()).toContain(JSON.stringify(FILE).slice(1, -1));
    // L'image jointe est partie.
    expect(received()).toContain(GIF.toString('base64'));
  });

  it('ce que la page ajoute aux pièces jointes, hors du champ, ne part pas', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');

    // Une clé inconnue glissée parmi les pièces jointes, porteuse d'un texte de la page.
    runVibeAction('forme', { text: FIELD, pieces: { ...pieces(), note: PAGE_TEXT } });
    await settle();

    // L'action est bien partie (l'absence qui suit porte sur un envoi).
    expect(received()).toContain(FIELD);
    // Le texte glissé par la page n'est pas parti.
    expect(received()).not.toContain(PAGE_TEXT);
  });

  it('une action dont le gabarit ne lit pas le champ n’envoie ni son texte ni ses pièces jointes', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');

    // La ponytail review : son gabarit n'a pas de {{text}}.
    runVibeAction('ponytail', { text: FIELD, pieces: pieces() });
    await settle();

    // L'action est bien partie : son gabarit a été reçu.
    expect(received()).toContain('/vibecoder:ponytail');
    // Le texte du champ n'est pas parti.
    expect(received()).not.toContain(FIELD);
    // La sélection jointe n'est pas partie.
    expect(received()).not.toContain(SELECTION);
    // L'image jointe n'est pas partie.
    expect(received()).not.toContain(GIF.toString('base64'));
  });

  it('une pièce jointe refusée : rien ne part, ni le texte du champ', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');

    // Une image illisible (un PNG que le décodeur ne lit pas).
    const result = runVibeAction('forme', { text: FIELD, pieces: { ...pieces(), images: [{ name: 'abimee.png', type: 'image/png', data: new Uint8Array(GIF).buffer }] } });
    await settle();

    // L'action est refusée.
    expect(result.ok).toBe(false);
    // Aucun agent n'a rien reçu.
    expect(fake.prompts).toEqual([]);
  });
});
