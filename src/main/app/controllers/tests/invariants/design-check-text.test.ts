// Invariant de ce qui part chez l'agent pour la vérification de conception de la
// note (docs/tickets/feat/0.15.0-skills-humain-ia.md, « Ce que ça ne doit pas
// faire » : « Envoyer à un agent autre chose que le texte du champ, ce que
// whisper vient de rendre, ou le gabarit d'une action : la nouvelle action
// comprise → invariant (I-2, existant) »). Protégé : si un test échoue,
// corriger le code.
//   I-2 : la nouvelle action design-check, lancée par le premier Valider la
//   note (conv:vibeMark) ou par Revérifier, n'envoie que son gabarit : ni le
//   texte de la note, ni un texte glissé par la page avec le clic, ni le texte
//   ou les pièces jointes du champ (son gabarit ne lit pas le champ).
// Les autres actions et la dictée : app/controllers/tests/invariants/page-text.test.ts.
//
// Sur le vrai principal (contrôleurs, canaux de la page, état, réglages sur
// disque, git réel sur un dépôt d'essai, les actions livrées dans resources/),
// par le décor commun (app/tests/harness) ; faux : Electron (fenêtres qui
// relèvent ce qu'on leur envoie ; le décodeur d'images ne lit rien, un GIF
// passe tel quel) et le SDK de Claude Code (chaque message reçu par un agent
// est relevé, chaque tour finit aussitôt).
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeElectron, openPanel, profile, repo, repoResources, settle as wait, write, writeConfig } from 'app/tests/harness';

// Chaque message reçu par un agent.
const fake = { prompts: [] as unknown[] };

const electron = fakeElectron({
  // Le décodeur d'images d'Electron ne lit rien : un GIF part tel quel.
  nativeImage: { createFromBuffer: () => ({ isEmpty: () => true }) },
});
vi.mock('electron', () => electron.module);

// Claude Code : chaque message reçu par un agent est relevé, et le tour finit aussitôt.
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

// Les actions livrées.
vi.mock('technicals/paths', () => repoResources());

const settle = () => wait(200);
// La commande du skill de la vérification de conception, en tête de son gabarit.
const SKILL = '/vibecoder:conception';
// Une phrase de la note, que seul le disque porte.
const NOTE_LINE = 'une ligne que seule la note porte';
// Un texte que la page glisserait avec le clic.
const PAGE_TEXT = 'texte fourni par la page';
// Le texte du champ, et ses pièces jointes : une sélection, un fichier par son chemin, une image (un GIF).
const FIELD = 'le texte du champ';
const SELECTION = 'la sélection jointe au champ';
const FILE = path.join(os.tmpdir(), 'joint', 'document-joint.txt');
const GIF = Buffer.from('GIF89a une image jointe au champ');
const pieces = () => ({ selection: SELECTION, files: [FILE], images: [{ name: 'image.gif', type: 'image/gif', data: new Uint8Array(GIF).buffer }] });
// Ce que les agents ont reçu, en un texte.
const received = () => JSON.stringify(fake.prompts);

let root = '';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.prompts.length = 0;
  root = profile('whisper-design-check-text-');
  // Un dépôt sur une branche dont la note est écrite, l'agent en VibeCoder, créateur.
  const dir = path.join(root, 'projet');
  repo(dir, { branch: 'feat/0.15.0-essai', note: `# 0.15.0 — essai\n\n## Ce que ça fait\n\n- ${NOTE_LINE}\n` });
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', pr: null } }], { agentSelected: 'a1' });
  // Une question au questionnaire : la vérification finie, la note reste à valider (Revalider, Revérifier).
  write(path.join(root, 'vibecoder-out', 'a1', 'questions.md'), '## 1. Une question ?\n');
});
afterEach(closeAll);

describe('la vérification de conception n’envoie que son gabarit (I-2, la nouvelle action comprise)', () => {
  it('le premier Valider la note envoie le gabarit de la vérification, sans le texte de la note', async () => {
    await openPanel('a1');
    const { markVibe } = await import('app/controllers');

    markVibe('note', 'ok');
    await settle();

    // La vérification est bien partie : son gabarit a été reçu (l'absence qui suit porte sur un envoi).
    expect(received()).toContain(SKILL);
    // Le texte de la note n'est pas parti : l'agent la lit sur le disque.
    expect(received()).not.toContain(NOTE_LINE);
  });

  it('un texte que la page glisse avec le clic Valider la note ne part pas', async () => {
    const panel = await openPanel('a1');

    // Le clic Valider la note par son canal, envoyé par la fenêtre du panneau, un texte de la page en plus.
    electron.ipc.get('conv:vibeMark')!({ sender: panel.webContents }, 'note', 'ok', PAGE_TEXT);
    await settle();

    // La vérification est bien partie : son gabarit a été reçu.
    expect(received()).toContain(SKILL);
    // Le texte glissé par la page n'est pas parti.
    expect(received()).not.toContain(PAGE_TEXT);
  });

  it('Revérifier n’envoie ni le texte du champ ni ses pièces jointes', async () => {
    await openPanel('a1');
    const { markVibe, refreshVibe, runVibeAction } = await import('app/controllers');
    // La note vérifiée une première fois (sa course finie, puis un relevé) : Revérifier est proposé.
    markVibe('note', 'ok');
    await settle();
    await refreshVibe({ now: true });
    await settle();
    fake.prompts.length = 0;

    runVibeAction('design-check', { text: FIELD, pieces: pieces() });
    await settle();

    // La vérification est bien repartie : son gabarit a été reçu.
    expect(received()).toContain(SKILL);
    // Le texte du champ n'est pas parti.
    expect(received()).not.toContain(FIELD);
    // La sélection jointe n'est pas partie.
    expect(received()).not.toContain(SELECTION);
    // Le chemin du fichier joint n'est pas parti.
    expect(received()).not.toContain(JSON.stringify(FILE).slice(1, -1));
    // L'image jointe n'est pas partie.
    expect(received()).not.toContain(GIF.toString('base64'));
  });
});
