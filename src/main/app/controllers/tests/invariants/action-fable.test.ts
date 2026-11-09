// Invariant du coût (note 0.14.0,
// docs/tickets/feat/0.14.0-allegement-interface-settings.md, « Ce que ça ne
// doit pas faire ») : faire travailler Fable par le choix d'une action, même
// écrit à la main dans config.json (SPEC I-36). La page n'écrit jamais Fable
// (settings-patch.test.ts) ; ici, la lecture : un choix « fable » glissé à la
// main dans actionModels ne part pas chez l'agent.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages sur disque, git
// réel sur un dépôt d'essai, les actions et skills livrés dans resources/), par
// le décor commun (app/tests/harness) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie), le SDK de
// Claude Code (chaque message, les options de chaque session et chaque
// changement de modèle sont relevés).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeElectron, openPanel, profile, repo, repoResources, settle as wait, writeConfig } from 'app/tests/harness';

// Tout ce que le SDK a reçu : chaque message, les options de chaque session, chaque setModel.
const toSdk: unknown[] = [];

const electron = fakeElectron();
vi.mock('electron', () => electron.module);

// Claude Code : les options de la session, chaque message et chaque changement de modèle sont relevés.
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options?: unknown }) => {
      toSdk.push(options);
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          toSdk.push(m.message.content);
          yield { type: 'result', subtype: 'success', is_error: false };
        }
      }()), { setPermissionMode: async () => {}, setModel: async (m: unknown) => { toSdk.push(m); }, interrupt: async () => {} });
    },
  }),
}));

// Les actions et les skills livrés.
vi.mock('technicals/paths', () => repoResources());

let root = '';
const settle = () => wait(200);
// Ce que le SDK a reçu, en un texte.
const sent = () => JSON.stringify(toSdk);

// Un agent en VibeCoder sur une branche dont la note est écrite ; config.json
// porte, écrit à la main, le choix d'une action : Fable.
function project(actionModels: Record<string, string>) {
  const dir = `${root}/projet`;
  repo(dir, { branch: 'feat/0.14.0-essai', note: '# 0.14.0 — essai\n\n## Ce que ça fait\n\n- un essai\n' });
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', pr: null } }], { agentSelected: 'a1', actionModels });
}

// Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
const open = () => openPanel('a1');

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  toSdk.length = 0;
  root = profile('whisper-action-model-');
});
afterEach(closeAll);

describe('jamais Fable par le choix d’une action, même écrit à la main dans config.json (I-36)', () => {
  it('la Forme, choisie sur Fable à la main, ne fait pas travailler Fable', async () => {
    project({ forme: 'fable' });
    await open();
    const { runVibeAction } = await import('app/controllers');

    runVibeAction('forme', { text: 'le texte du champ' });
    await settle();

    // L'action est bien partie (l'absence qui suit porte sur un envoi).
    expect(sent()).toContain('/vibecoder:forme');
    // Rien de ce que le SDK a reçu (message, session, changement de modèle) ne nomme Fable.
    expect(sent()).not.toMatch(/fable/i);
  });

  // Une action dont le skill fixe son modèle (opus) : celle dont la page propose le choix.
  it('une action au modèle fixé par son skill, choisie sur Fable à la main, ne fait pas travailler Fable', async () => {
    project({ invariants: 'fable' });
    await open();
    const { runVibeAction } = await import('app/controllers');

    runVibeAction('invariants', { text: 'le texte du champ' });
    await settle();

    // L'action est bien partie (l'absence qui suit porte sur un envoi).
    expect(sent()).toContain('/vibecoder:invariants');
    // Rien de ce que le SDK a reçu (message, session, changement de modèle) ne nomme Fable.
    expect(sent()).not.toMatch(/fable/i);
  });
});
