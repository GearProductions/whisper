// Variants de la dictée et des pièces jointes, côté principal : ce qui a quitté
// invariants/page-text.test.ts au critère de la 0.15.0 (une refonte peut les changer).
//   - le texte rendu à la page est celui que whisper vient de rendre ;
//   - pas de whisper sur du silence ni sur un enregistrement trop court (I-10) ;
//   - les pièces jointes des réponses partent avec Envoyer les réponses.
// Ne connaît pas : le reste du principal que par ses contrôleurs ; whisper-cli et le SDK sont faux.
// Sur le vrai principal et le décor commun (app/tests/harness) ; faux : Electron (le décodeur
// d'images ne lit rien, un GIF passe tel quel), le SDK de Claude Code (chaque message est relevé),
// whisper-cli (ce qu'on lui donne est relevé).
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeElectron, openPanel, profile, repo, repoResources, settle as wait, write, writeConfig } from 'app/tests/harness';

// Ce que whisper rend, la taille de chaque audio qu'il a reçu, chaque message reçu par un agent.
const fake = { whisperSays: '', whisperRuns: [] as number[], prompts: [] as unknown[] };

const electron = fakeElectron({
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

// whisper : installé, il rend `whisperSays` et relève l'audio reçu.
vi.mock('technicals/whisper-cli', async (original) => ({
  ...await original<typeof import('technicals/whisper-cli')>(),
  locateWhisper: () => ({ cli: '/whisper/whisper-cli', model: '/whisper/ggml-base.bin' }),
  runWhisper: async (_dirs: string[], pcm: Buffer) => { fake.whisperRuns.push(pcm.length); return fake.whisperSays; },
}));

// Les actions livrées.
vi.mock('technicals/paths', () => repoResources());

const settle = () => wait(200);
const RATE = 16000;
// Une seconde de parole : un signal franc, bien au-dessus du seuil du silence.
const speech = () => new Int16Array(RATE).fill(0.2 * 0x7fff).buffer;
// Une seconde muette.
const mute = () => new Int16Array(RATE).buffer;
// Une parole trop courte : un dixième de seconde.
const tooShort = () => new Int16Array(RATE / 10).fill(0.2 * 0x7fff).buffer;

let root = '';

beforeEach(() => {
  vi.resetModules();
  fake.whisperSays = '';
  fake.whisperRuns.length = 0;
  fake.prompts.length = 0;
  root = profile('whisper-page-text-');
  // Un agent affiché : une dictée aurait à qui partir (agentReview: false, le pire cas d'avant).
  writeConfig(root, [{ id: 'a1', dir: root, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null }],
    { agentSelected: 'a1', autoPaste: false, agentReview: false });
});

describe('la transcription est rendue à la page, telle que whisper l’a rendue', () => {
  it('le texte rendu à la page est celui que whisper vient de rendre', async () => {
    fake.whisperSays = 'bonjour le monde';
    const { transcribe } = await import('app/controllers');

    const result = await transcribe(speech());

    // Le texte rendu est exactement la sortie de whisper.
    expect(result.text).toBe(fake.whisperSays);
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

describe('les pièces jointes d’une action', () => {
  // Le texte du champ, et ses pièces jointes : une sélection, un fichier par son chemin, une image (un GIF).
  const SELECTION = 'la sélection jointe au champ';
  const FILE = path.join(os.tmpdir(), 'joint', 'document-joint.txt');
  const GIF = Buffer.from('GIF89a une image jointe au champ');
  const pieces = () => ({ selection: SELECTION, files: [FILE], images: [{ name: 'image.gif', type: 'image/gif', data: new Uint8Array(GIF).buffer }] });
  // Ce que les agents ont reçu, en un texte.
  const received = () => JSON.stringify(fake.prompts);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
    // Un dépôt sur une branche dont la note est écrite : la Forme est proposée.
    const dir = path.join(root, 'projet');
    repo(dir, { branch: 'feat/0.14.0-essai', note: '# 0.14.0 — essai\n\n## Ce que ça fait\n\n- un essai\n' });
    writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', pr: null } }], { agentSelected: 'a1' });
  });
  afterEach(closeAll);

  // Envoyer les réponses : son gabarit lit {{answers}}, pas {{text}}.
  it('les pièces jointes des réponses partent avec Envoyer les réponses', async () => {
    // Une question ouverte laissée par la note : Envoyer les réponses est proposé.
    write(path.join(root, 'vibecoder-out', 'a1', 'questions.md'), '## 1. Une question ?\n');
    await openPanel('a1');
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
});
