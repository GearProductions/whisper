// Variants du relevé des artefacts (note 0.13.0, docs/tickets/feat/0.13.0-panneau-artifacts.md) : le relevé que
// la page reçoit liste les artefacts sans leur texte, et un fichier des sorties n'est pas un artefact.
// Déplacés de invariants/artifacts.test.ts (0.15.0, assainissement : un cas déplacé garde son assertion).
// Fichier à part de artifacts.test.ts : celui-ci remplace les contrôleurs par des faux, il ne peut pas servir le
// vrai relevé envoyé au panneau.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur disque, git réel sur un dépôt
// d'essai), par le décor commun (app/tests/harness) ; faux : Electron et le SDK de Claude Code (aucun tour ne
// commence ici).
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeClaude, fakeElectron, openPanel, profile, repo, repoResources, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();   // aucun tour ici ; un message reçu ne fait rien
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

// Ce que la page reçoit : le relevé (conv:vibe).
type Artifact = { id: string; name: string; url: string | null };
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as { artifacts?: Artifact[] };
// Les noms des artefacts du dernier relevé.
const names = () => (survey().artifacts ?? []).map((a) => a.name);

const NOTES = 'NOTES_TEXTE';
const COMMIT = 'COMMIT_HORS_ARTEFACTS';

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  const userData = profile('whisper-artifacts-survey-');
  const dir = path.join(userData, 'projet');
  repo(dir);
  const { projectArtifactsPath } = await import('app/controllers');
  // Ses sorties : un fichier hors des artefacts ; le dossier de son projet : les artefacts.
  write(path.join(userData, 'vibecoder-out', 'a1', 'commit.md'), COMMIT);
  write(path.join(projectArtifactsPath(dir), 'notes.md'), NOTES);
  writeConfig(userData, [
    { id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', autonomy: 'guide', pr: null } },
  ]);
});
afterEach(closeAll);

// Le panneau ouvert sur l'agent a1, en VibeCoder, son premier relevé reçu.
const open = () => openPanel('a1');

describe('afficher un artefact : par son id dans le dernier relevé, rien hors du dossier du projet (I-37)', () => {
  it('le relevé liste les artefacts sans leur texte', async () => {
    await open();

    const sent = JSON.stringify(survey());

    // témoin : l'artefact est bien listé
    expect(names()).toContain('notes.md');
    // son texte n'y est pas
    expect(sent).not.toContain(NOTES);
  });

  it('un fichier des sorties n’est pas un artefact', async () => {
    await open();

    // témoin : les artefacts sont bien listés
    expect(names()).toContain('notes.md');
    // le fichier des sorties n'y est pas
    expect(names()).not.toContain('commit.md');
  });
});
