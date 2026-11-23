// Invariant de la note, validée par l'utilisateur seul (note 0.16.0, docs/tickets/feat/0.16.0-controle-en-trois-points.md,
// « Ce que ça ne doit pas faire ») :
//   - I-67 « Valider la note à la place de l'utilisateur, ou changer sa conception, quel que soit le rythme ».
// Au rythme par défaut, le moteur parti : une note changée autrement que par un « Accepter » perd son ✓. En express :
// aucun relevé ne valide une note jamais validée, l'orchestrateur ne la valide pas par sa CLI, une note
// validée puis changée autrement que par un « Accepter » perd son ✓, et rien de l'appli n'écrit la note sur le disque.
// Chaque absence a son témoin (le rythme est bien l'express, la note bien validée avant le changement).
// Les fonctions pures (vibeView, vibeMarks, keepNote, acceptedTexts) : core/vibecoder/tests/invariants/note-by-user.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le SDK de Claude Code factices — chaque
// tour finit aussitôt, sans rien écrire —, git réel sur un dépôt d'essai). Le rythme se règle comme l'écran le règle
// (setVibe({ express })) ; Valider la note par le ✓ que la page envoie (markVibe) ; l'orchestrateur par le socket, à la
// porte du robot (commandFromSocket) ; ce que la page voit : le dernier conv:vibe poussé.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import {
  closeAll, fakeClaude, fakeElectron, openPanel, profile, repo, repoResources, settle, slow, write, writeConfig,
} from 'app/tests/harness';

vi.setConfig({ testTimeout: slow(20000) });

const electron = fakeElectron();
const claude = fakeClaude({ finish: true });
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

const BRANCH = 'feat/0.16.0-essai';
const NOTE = `docs/tickets/${BRANCH}.md`;
const NOTE_TEXT = ['# 0.16.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
// La même note dont la conception a changé : une ligne que personne n'a acceptée.
const NOTE_REDESIGNED = NOTE_TEXT.replace('- un essai\n', '- un essai\n- une ligne ajoutée depuis\n');

let root = '';
let dir = '';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  root = profile('whisper-note-by-user-');
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: NOTE_TEXT });
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], { agentSelected: 'a1' });
});
afterEach(closeAll);

// Le dernier relevé poussé à la page.
const view = () => electron.windows.at(-1)!.sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as VibeView;
// Où en est la validation de la note : 'ok' (cochée), 'changed', 'cascade', null (jamais validée).
const noteChecked = () => view().steps.find((s) => s.id === 'note')?.check?.state;
// Le texte de la note sur le disque.
const noteOnDisk = () => fs.readFileSync(path.join(dir, NOTE), 'utf8');

// Un relevé, comme celui des 4 s.
async function survey() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await settle();
}
// Le rythme réglé par l'écran.
async function express() {
  const { setVibe } = await import('app/controllers');
  setVibe({ express: true });
  await settle();
  await survey();
}
// Valider la note : la vérification de conception part, finit aussitôt sans question, et la note est validée.
async function validateNote() {
  const { markVibe } = await import('app/controllers');
  markVibe('note', 'ok');
  await settle();
  await survey();
  await survey();
}

describe('I-67 : au rythme par défaut, la note n’est validée que par l’utilisateur', () => {
  // Le moteur part seul quand la note vient d'être validée ; la note change ensuite pendant le parcours.
  it('le moteur parti, la note changée autrement que par un « Accepter » : son ✓ tombe', async () => {
    await openPanel('a1');
    await validateNote();
    // témoin : la note est bien validée avant le changement
    expect(noteChecked()).toBe('ok');

    write(path.join(dir, NOTE), NOTE_REDESIGNED);
    await survey();
    await survey();

    // témoin : le moteur est bien parti
    expect(claude.turns.map((t) => t.skill)).toContain('/vibecoder:vibe');
    // la note n'est plus validée
    expect(noteChecked()).not.toBe('ok');
  });
});

describe('I-67 : en express, la note n’est validée que par l’utilisateur', () => {
  it('la note jamais validée : aucun relevé ne la valide', async () => {
    await openPanel('a1');
    await express();

    await survey();
    await survey();

    // témoin : le rythme est bien l'express
    expect(view().express).toBe(true);
    // la note n'est pas validée
    expect(noteChecked()).not.toBe('ok');
  });

  // La CLI n'a pas l'étape note parmi celles qu'elle valide : la demande est faite quand même.
  it('l’orchestrateur demande step.validate de la note : refusé, la note pas validée', async () => {
    await openPanel('a1');
    await express();
    const { commandFromSocket } = await import('app/controllers');

    const res = await commandFromSocket({ cmd: 'step.validate', args: { step: 'note', verdict: 'ok' }, token: '', target: '' }, 'a1');
    await settle();
    await survey();

    // témoin : le rythme est bien l'express
    expect(view().express).toBe(true);
    // la demande est refusée
    expect(res.ok).toBe(false);
    // la note n'est pas validée
    expect(noteChecked()).not.toBe('ok');
  });

  it('la note validée puis sa conception changée autrement que par un « Accepter » : son ✓ tombe', async () => {
    await openPanel('a1');
    await validateNote();
    await express();
    // témoin : la note est bien validée avant le changement
    expect(noteChecked()).toBe('ok');

    write(path.join(dir, NOTE), NOTE_REDESIGNED);
    await survey();
    await survey();

    // témoin : le rythme est bien l'express
    expect(view().express).toBe(true);
    // la note n'est plus validée
    expect(noteChecked()).not.toBe('ok');
  });

  it('la note validée, en express, des relevés : le texte de la note sur le disque reste le même', async () => {
    await openPanel('a1');
    const before = noteOnDisk();

    await validateNote();
    await express();
    await survey();
    await survey();

    // témoin : la note est bien validée, en express
    expect(noteChecked()).toBe('ok');
    expect(view().express).toBe(true);
    // la note sur le disque n'a pas changé
    expect(noteOnDisk()).toEqual(before);
  });
});
