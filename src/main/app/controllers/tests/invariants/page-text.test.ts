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
// Le silence non transcrit (I-10), le texte rendu à la page et les pièces
// jointes des réponses : app/controllers/tests/variants/page-text.test.ts.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages sur disque ;
// pour les actions, git réel sur un dépôt d'essai et les actions livrées dans
// resources/), par le décor commun (app/tests/harness) ; faux : Electron
// (fenêtres qui relèvent ce qu'on leur envoie ; le presse-papiers relève tout
// appel ; le décodeur d'images ne lit rien, un GIF passe tel quel), le SDK de
// Claude Code (chaque message reçu par un agent est relevé), whisper-cli et
// Pocket TTS (les modèles : ce qu'on leur donne est relevé).
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeElectron, FakeWin, openPanel, profile, repoResources, repo, settle as wait, writeConfig } from 'app/tests/harness';

// Ce que whisper rend ; chaque texte que Pocket TTS a reçu à lire ; chaque message reçu par un agent ;
// chaque appel au presse-papiers (la méthode et ses arguments).
const fake = { whisperSays: '', spoken: [] as unknown[], prompts: [] as unknown[], copied: [] as [string, unknown[]][] };

const electron = fakeElectron({
  // Le presse-papiers relève tout appel ; il ne rend que du vide.
  clipboard: new Proxy({}, { get: (_t, name) => (...a: unknown[]) => { fake.copied.push([String(name), a]); return ''; } }),
  // Le décodeur d'images d'Electron ne lit rien : un GIF part tel quel, un PNG est refusé.
  nativeImage: { createFromBuffer: () => ({ isEmpty: () => true }) },
});
vi.mock('electron', () => electron.module);

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

// whisper : installé, il rend `whisperSays`.
vi.mock('technicals/whisper-cli', async (original) => ({
  ...await original<typeof import('technicals/whisper-cli')>(),
  locateWhisper: () => ({ cli: '/whisper/whisper-cli', model: '/whisper/ggml-base.bin' }),
  runWhisper: async () => fake.whisperSays,
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
vi.mock('technicals/paths', () => repoResources());

const settle = () => wait(200);
const RATE = 16000;
// Une seconde de parole : un signal franc, bien au-dessus du seuil du silence.
const speech = () => new Int16Array(RATE).fill(0.2 * 0x7fff).buffer;
// Un texte que la page voudrait faire lire.
const PAGE_TEXT = 'texte fourni par la page';

let root = '';

beforeEach(() => {
  vi.resetModules();
  fake.whisperSays = '';
  fake.spoken.length = 0;
  fake.prompts.length = 0;
  fake.copied.length = 0;
  root = profile('whisper-page-text-');
  // Un agent affiché : une dictée aurait à qui partir. agentReview: false, le
  // pire cas d'avant (la dictée partait aussitôt chez l'agent), une clé
  // ignorée une fois le réglage retiré.
  writeConfig(root, [{ id: 'a1', dir: root, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null }],
    { agentSelected: 'a1', autoPaste: false, agentReview: false });
});

describe('la transcription est rendue à la page, telle que whisper l’a rendue (I-2)', () => {
  it('une transcription ne part chez aucun agent, même quand un agent est affiché', async () => {
    fake.whisperSays = 'bonjour le monde';
    const { transcribe } = await import('app/controllers');

    await transcribe(speech());
    await settle();

    // Aucun agent n'a reçu de message : seule la page décide d'envoyer son champ.
    expect(fake.prompts).toEqual([]);
  });
});

describe('aucun canal « lis ce texte » ou « copie ce texte » (I-3)', () => {
  // Le balayage qui suit reste vert si aucun gestionnaire n'est branché : ce témoin échoue alors.
  it('témoin : chaque canal du panneau est écouté, et un canal connu répond', async () => {
    const { registerIpc } = await import('app/ipc');
    const { state } = await import('app/state');
    const { PANEL_CHANNELS } = await import('shared/bridge');
    const panel = new FakeWin();
    state.panel = panel as never;
    registerIpc();

    // chaque canal d'envoi et d'appel du panneau a un gestionnaire
    expect([...PANEL_CHANNELS.send, ...PANEL_CHANNELS.invoke].filter((ch) => !electron.ipc.has(ch))).toEqual([]);
    // un canal connu répond à la fenêtre du panneau
    expect(await electron.ipc.get('config:get')!({ sender: panel.webContents })).toMatchObject({ lang: expect.any(String) });
  });

  // Un balayage, pas une table de cas : la propriété porte sur tous les canaux du
  // panneau à la fois, ceux d'aujourd'hui comme ceux qu'on ajoutera.
  it('un texte donné à chaque canal du panneau n’arrive ni au presse-papiers ni à la lecture', async () => {
    const { registerIpc } = await import('app/ipc');
    const { state } = await import('app/state');
    const { PANEL_CHANNELS } = await import('shared/bridge');
    const panel = new FakeWin();
    state.panel = panel as never;
    registerIpc();

    for (const ch of [...PANEL_CHANNELS.send, ...PANEL_CHANNELS.invoke]) {
      const handler = electron.ipc.get(ch)!;
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
    const dir = path.join(root, 'projet');
    repo(dir, { branch: 'feat/0.14.0-essai', note: '# 0.14.0 — essai\n\n## Ce que ça fait\n\n- un essai\n' });
    writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', pr: null } }], { agentSelected: 'a1' });
  });
  afterEach(closeAll);

  // Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
  const open = () => openPanel('a1');

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
    const result = await runVibeAction('forme', { text: FIELD, pieces: { ...pieces(), images: [{ name: 'abimee.png', type: 'image/png', data: new Uint8Array(GIF).buffer }] } });
    await settle();

    // L'action est refusée.
    expect(result.ok).toBe(false);
    // Aucun agent n'a rien reçu.
    expect(fake.prompts).toEqual([]);
  });
});
