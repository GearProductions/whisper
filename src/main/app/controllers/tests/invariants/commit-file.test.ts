// Invariants du fichier d'un commit en Relire, et des versions de base (note
// 0.13.0, docs/tickets/feat/0.13.0-ameliorations-interface.md, « Ce que ça ne
// doit pas faire ») :
//   - écrire un fichier en Relire : le principal refuse Enregistrer pour un
//     fichier d'un commit, sans se fier à la page (I-37 / I-39 étendus) ;
//   - suivre un fichier d'un commit hors de Relire, ou désigné autrement que
//     par son id `c<rang>/<i>` du dernier relevé (I-37 étendu) ;
//   - lire la version de base d'un test ou d'un fichier supprimé, ou celles
//     d'un fichier d'un commit (son parent, la base de la PR), autrement que
//     par git, ou d'après un chemin fourni par une page (I-37).
// Les cas du rôle (Créer, Relire), des versions que git donne et de la base
// d'un test : variants/commit-file.test.ts (0.15.0). commitFile seul, sur un
// relevé écrit à la main : core/vibecoder/tests/invariants/commit-file.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le
// SDK de Claude Code factices, git réel sur un dépôt d'essai, un lien réel qui
// sort du dossier de l'agent). Ce que la page voit : le relevé (conv:vibe) et
// les conv:vibeCode poussés au panneau, tous leurs champs.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from 'core/agents';
import { closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

let root = '';
let dir = '';
let secret = '';

// Ce que la page reçoit : le relevé (conv:vibe) et un fichier suivi, avec ses versions (conv:vibeCode).
type Survey = { commits: { hash: string; subject: string; files: string[] }[] };
type Code = { id: string; text: string | null };
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as Survey;
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as Code | null);
// Les textes de fichier poussés à la page (null : absent, trop gros ou illisible).
const texts = () => codes().flatMap((c) => (c && c.text !== null ? [c.text] : []));
// Tout ce que la page a reçu des fichiers suivis : textes et versions.
const pushed = () => JSON.stringify(codes());
// Le dernier fichier poussé à la page sous cet id.
const lastCode = (id: string) => codes().filter((c) => c?.id === id).at(-1);
// L'id `c<rang>/<i>` que le dernier relevé donne à ce fichier de ce commit ; sans id, le cas ne peut pas commencer.
function commitId(subject: string, rel: string) {
  const rank = survey().commits.findIndex((c) => c.subject === subject);
  const i = rank < 0 ? -1 : survey().commits[rank].files.indexOf(rel);
  if (i < 0) throw new Error(`le relevé ne donne aucun id à ${rel} dans le commit ${subject}`);
  return `c${rank}/${i}`;
}
// Le texte d'un fichier du dépôt à un commit, d'après git.
const gitText = (ref: string, rel: string) => git(dir, 'show', `${ref}:${rel}`);
// Ce que git voit changé dans le dépôt de l'agent.
const changed = () => git(dir, 'status', '--porcelain');
// Un fichier remplacé par un lien qui mène hors du dossier de l'agent.
const linkOut = (rel: string) => { fs.rmSync(path.join(dir, rel)); fs.symlinkSync(secret, path.join(dir, rel)); };

const HELLO = 'src/core/hello/index.ts';
const GREET = 'src/core/hello/greet.ts';
const BRANCH = 'feat/0.13.0-essai';
const NOTE_TEXT = ['# 0.13.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const INV_ADDED = 'src/core/hello/tests/invariants/added.test.ts';

const agent = (vibe: AgentConfig['vibe']) => ({ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder' as const, vibe });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  root = profile('whisper-commit-file-');
  // Hors du dossier de l'agent : un secret.
  secret = path.join(root, 'secret.ts');
  write(secret, 'SECRET_DEHORS');
  // Le dépôt : un module et son test d'invariant sur main.
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: NOTE_TEXT });
  git(dir, 'checkout', '-q', 'main');
  write(path.join(dir, HELLO), 'HELLO_MAIN');
  write(path.join(dir, GREET), 'GREET_MAIN');
  write(path.join(dir, INV), "it('INV_MAIN', () => {});\n");
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'main');
  // La branche (sa note, rebasée sur main), puis trois commits : c1 (hello changé, le test modifié, un test
  // ajouté, greet supprimé), c2 et c3 (hello changé à chaque fois) ; le fichier d'un commit suivi ici : hello dans c2.
  git(dir, 'checkout', '-q', BRANCH);
  git(dir, 'rebase', '-q', 'main');
  write(path.join(dir, HELLO), 'HELLO_C1');
  write(path.join(dir, INV), "it('INV_BRANCHE', () => {});\n");
  write(path.join(dir, INV_ADDED), "it('INV_AJOUT', () => {});\n");
  git(dir, 'rm', '-q', GREET);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'c1');
  write(path.join(dir, HELLO), 'HELLO_C2');
  git(dir, 'commit', '-q', '-am', 'c2');
  write(path.join(dir, HELLO), 'HELLO_C3');
  git(dir, 'commit', '-q', '-am', 'c3');
  writeConfig(root, [agent({ flow: 'create', autonomy: 'guide', pr: null })]);
});
afterEach(closeAll);

// L'agent en Relire, sur la PR 7 : la branche d'essai, chargée à sa référence
// locale (comme par le skill charger-pr), sa fiche dans les sorties de l'agent.
function review() {
  git(dir, 'update-ref', 'refs/vibecoder/pr/7', 'HEAD');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  write(path.join(root, 'vibecoder-out', 'a1', 'pr-7.json'),
    JSON.stringify({ number: 7, title: 'Essai', base: 'main', head: BRANCH, state: 'OPEN' }));
  writeConfig(root, [agent({ flow: 'review', autonomy: 'guide', pr: 7 })]);
}

// Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
const open = () => openPanel('a1');

// La page suit un fichier (ouvert sous sa carte ; null : fermé).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

// Enregistrer (Ctrl+S ou le bouton), tel que la page l'envoie.
async function save(id: unknown, text: unknown) {
  const { saveCode } = await import('app/controllers');
  await saveCode(id, text);
  await settle();
}

describe('un fichier d’un commit ne se suit qu’en Relire, par son id c<rang>/<i> du dernier relevé (I-37 étendu)', () => {
  it('témoin : en Relire, l’id d’un fichier d’un commit, son texte à la tête de la PR est poussé à la page', async () => {
    review();
    await open();

    await follow(commitId('c2', HELLO));

    // la page reçoit le texte que git donne à ce fichier à la tête de la PR
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
  });

  it('en Relire, le chemin du fichier d’un commit à la place de son id : rien n’est lu', async () => {
    review();
    await open();

    await follow(HELLO);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
    // sa version à un commit n'est jamais poussée
    expect(pushed()).not.toContain('HELLO_C2');
  });

  it('en Relire, un id qui commence comme celui d’un fichier d’un commit puis sort du dossier : le dehors n’est pas lu', async () => {
    review();
    await open();

    await follow(`${commitId('c2', HELLO)}/../../../secret.ts`);

    // le secret du dehors n'est jamais poussé
    expect(pushed()).not.toContain('SECRET_DEHORS');
    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });
});

describe('en Relire, le principal refuse Enregistrer pour un fichier d’un commit, sans se fier à la page (I-37 / I-39 étendus)', () => {
  it('le fichier d’un commit affiché, son id : rien n’est écrit', async () => {
    review();
    await open();
    await follow(commitId('c2', HELLO));

    await save(commitId('c2', HELLO), 'ECRIT_EN_RELIRE');

    // témoin : le fichier du commit est bien affiché
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('le fichier d’un commit affiché, son id : Enregistrer est refusé', async () => {
    const { saveCode } = await import('app/controllers');
    review();
    await open();
    await follow(commitId('c2', HELLO));

    const result = await saveCode(commitId('c2', HELLO), 'ECRIT_EN_RELIRE');

    // témoin : le fichier du commit est bien affiché
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  it('le fichier d’un commit affiché, son chemin à la place de l’id : rien n’est écrit', async () => {
    review();
    await open();
    await follow(commitId('c2', HELLO));

    await save(HELLO, 'ECRIT_EN_RELIRE');

    // témoin : le fichier du commit est bien affiché
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // le dépôt est inchangé
    expect(changed()).toBe('');
  });
});

describe('les versions d’un fichier d’un commit ne se lisent que par git, jamais sur le disque (I-37)', () => {
  it('le fichier remplacé sur le disque par un lien qui sort du dossier : le dehors n’est pas lu', async () => {
    review();
    await open();
    linkOut(HELLO);

    await follow(commitId('c2', HELLO));

    // témoin : le texte à la tête de la PR est bien poussé
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // le secret du dehors n'est jamais poussé
    expect(pushed()).not.toContain('SECRET_DEHORS');
  });
});

describe('la version de base d’un fichier supprimé ne se lit que par git (I-37)', () => {
  it('le chemin d’un fichier supprimé à la place de son id : sa version à la base n’est pas lue', async () => {
    await open();

    await follow(GREET);

    // son texte à la base de la branche n'est jamais poussé
    expect(pushed()).not.toContain('GREET_MAIN');
  });
});
