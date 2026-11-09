// Variants du dossier d'artefacts d'un projet (note 0.13.0, docs/tickets/fix/0.13.0-fix-and-improvements.md,
// sujet 8) : ce que le panneau en montre : un dossier caché n'y est pas listé, un ancien artefact pas encore
// parti non plus, le robot du worktree voit l'artefact du dépôt, et la page reçoit le dossier du projet de
// l'agent affiché. Déplacés de invariants/project-artifacts.test.ts (0.15.0, assainissement : un cas déplacé
// garde son assertion) ; le reste y est protégé (rien d'effacé en retirant, jamais l'artefact d'un autre projet).
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur disque, git réel sur un dépôt
// d'essai et son worktree), par le décor commun (app/tests/harness) ; faux : Electron et le SDK de Claude
// Code (aucun tour ne commence ici).
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo as initRepo, repoResources, settle, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();   // aucun tour ici ; un message reçu ne fait rien
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

let userData = '';  // le profil d'essai
let repo = '';      // le dossier de a1, un dépôt git
let worktree = '';  // le dossier de a2, un worktree de ce dépôt
let other = '';     // le dossier de a4, un autre dépôt
let project = '';   // le dossier d'artefacts du dépôt et de son worktree
let foreign = '';   // celui de l'autre dépôt

const MINE = 'TEXTE_DU_PROJET';
const THEIRS = 'TEXTE_DE_L_AUTRE_PROJET';

// Ce que la page reçoit : le dernier relevé, et les textes de fichier poussés.
type Artifact = { id: string; name: string; url: string | null };
type View = { artifacts?: Artifact[]; artifactsDir?: string };
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as View;
const names = () => (survey().artifacts ?? []).map((a) => a.name);
const texts = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as { text: string | null } | null).flatMap((c) => (c && c.text !== null ? [c.text] : []));
// L'artefact que le dernier relevé donne sous ce nom ; sans lui, le cas ne peut pas commencer.
function artifact(name: string) {
  const a = (survey().artifacts ?? []).find((x) => x.name === name);
  if (!a) throw new Error(`le relevé ne donne aucun artefact ${name}`);
  return a;
}

const AGENT = { model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder' as const, vibe: { flow: 'create' as const, autonomy: 'guide' as const, pr: null } };

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  userData = profile('whisper-project-artifacts-v-');
  repo = path.join(userData, 'projet');
  worktree = path.join(userData, 'projet-worktrees', 'enfant');
  other = path.join(userData, 'autre');
  for (const d of [repo, other]) initRepo(d);
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/0.13.0-enfant', worktree);
  writeConfig(userData, [
    { ...AGENT, id: 'a1', dir: repo, name: 'parent' },
    { ...AGENT, id: 'a2', dir: worktree, name: 'enfant', parent: { id: 'a1' } },
    { ...AGENT, id: 'a4', dir: other, name: 'autre' },
  ]);
  const { projectArtifactsPath } = await import('app/controllers');
  project = projectArtifactsPath(repo);
  foreign = projectArtifactsPath(other);
  // Le même nom dans les deux projets, deux textes ; et un nom propre à l'autre.
  write(path.join(project, 'notes.md'), MINE);
  write(path.join(foreign, 'notes.md'), THEIRS);
  write(path.join(foreign, 'plan.md'), THEIRS);
});
afterEach(closeAll);

// Le panneau ouvert sur cet agent, en VibeCoder, son premier relevé reçu.
const open = (id: string) => openPanel(id);
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

describe('ce que le panneau montre du dossier du projet', () => {
  it('un dossier caché écrit là : le panneau ne le liste pas', async () => {
    write(path.join(project, '.robot', 'interne.md'), 'CACHE');

    await open('a1');

    // témoin : le relevé liste bien les artefacts
    expect(names()).toContain('notes.md');
    // aucun de ses fichiers n'y est
    expect(names().join()).not.toContain('interne.md');
  });

  it('un ancien artefact pas encore parti n’est pas dans le dossier du projet : il n’est pas montré', async () => {
    write(path.join(userData, 'vibecoder-out', 'a1', 'artifacts', 'ancien.md'), 'ANCIEN');

    await open('a1');

    // témoin : l'artefact du projet est listé
    expect(names()).toContain('notes.md');
    // l'ancien n'y est pas
    expect(names()).not.toContain('ancien.md');
  });
  it('le robot du worktree voit l’artefact du dépôt', async () => {
    await open('a2');

    await follow(artifact('notes.md').id);

    // la page reçoit le texte de l'artefact du projet
    expect(texts()).toContain(MINE);
  });

  // Le @ écrit ce chemin : il doit être celui du projet de l'agent affiché.
  it('le relevé donne à la page le dossier du projet de l’agent affiché', async () => {
    await open('a2');

    // le dossier du projet
    expect(survey().artifactsDir).toBe(project);
    // pas celui d'un autre projet
    expect(survey().artifactsDir).not.toBe(foreign);
  });
});
