// Variants du fichier d'un commit en Relire, et des versions de base (note 0.13.0,
// docs/tickets/feat/0.13.0-ameliorations-interface.md) : le fichier d'un commit ne se suit
// pas en Créer ni hors du dernier relevé ; ses versions (son parent, la base de la PR, sa tête)
// et celles d'un fichier supprimé ou d'un test d'invariant (la base) sont celles que git donne,
// jamais celles du disque. Déplacés tels quels de invariants/commit-file.test.ts (0.15.0), qui
// garde les chemins à la place d'un id, les liens et le refus d'Enregistrer en Relire.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le SDK de Claude
// Code factices, git réel sur un dépôt d'essai). Ce que la page voit : le relevé (conv:vibe) et
// les conv:vibeCode poussés au panneau, tous leurs champs.
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
let c2 = '';

// Ce que la page reçoit : le relevé (conv:vibe) et un fichier suivi, avec ses versions (conv:vibeCode).
type Survey = {
  invariants: { id: string; path: string; base?: string | null }[];
  modules: { path: string; files?: { id: string; path: string }[] }[];
  commits: { hash: string; subject: string; files: string[] }[];
};
type Code = {
  id: string;
  text: string | null;
  at?: { base: string | null; head: string | null; commit?: { before: string | null; after: string | null } };
};
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
// L'id que le dernier relevé donne à ce fichier d'un module ; sans id, le cas ne peut pas commencer.
function idOf(rel: string) {
  const f = survey().modules.flatMap((m) => m.files ?? []).find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// Ce que le dernier relevé dit de ce test d'invariant ; sans lui, le cas ne peut pas commencer.
function testOf(rel: string) {
  const f = survey().invariants.find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne pas le test ${rel}`);
  return f;
}
// Le texte d'un fichier du dépôt à un commit, d'après git.
const gitText = (ref: string, rel: string) => git(dir, 'show', `${ref}:${rel}`);
// Le commit où la branche part de main.
const forkPoint = () => git(dir, 'merge-base', 'main', 'HEAD').trim();

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
  root = profile('whisper-commit-file-v-');
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
  c2 = git(dir, 'rev-parse', 'HEAD').trim();
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

describe('un fichier d’un commit ne se suit qu’en Relire, par son id c<rang>/<i> du dernier relevé (I-37 étendu)', () => {
  // Créer : sa propre branche, ses commits ne se suivent pas dans le panneau.
  it('en Créer, l’id d’un fichier d’un commit : rien n’est lu', async () => {
    await open();

    await follow(commitId('c2', HELLO));

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
    // sa version à ce commit n'est jamais poussée
    expect(pushed()).not.toContain('HELLO_C2');
  });

  it('en Relire, un id de commit absent du dernier relevé (c99/0) : rien n’est lu', async () => {
    review();
    await open();

    await follow('c99/0');

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });
});

describe('les versions d’un fichier d’un commit ne se lisent que par git, jamais sur le disque (I-37)', () => {
  it('son texte au parent du commit et au commit : ceux que git donne', async () => {
    review();
    await open();

    await follow(commitId('c2', HELLO));

    // avant le commit : le texte que git donne au parent du commit
    expect(lastCode(commitId('c2', HELLO))?.at?.commit?.before).toBe(gitText(`${c2}^`, HELLO));
    // après : le texte que git donne au commit
    expect(lastCode(commitId('c2', HELLO))?.at?.commit?.after).toBe(gitText(c2, HELLO));
  });

  it('son texte à la base de la PR et à sa tête : ceux que git donne', async () => {
    review();
    await open();

    await follow(commitId('c2', HELLO));

    // à la base : le texte que git donne au point de départ de la PR
    expect(lastCode(commitId('c2', HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // à la tête : le texte que git donne au dernier commit de la PR
    expect(lastCode(commitId('c2', HELLO))?.at?.head).toBe(gitText('HEAD', HELLO));
  });

  // Une copie de travail changée, pas commitée : le disque diffère de la tête de la PR.
  it('le fichier changé sur le disque : son texte sur le disque n’est jamais poussé', async () => {
    review();
    await open();
    write(path.join(dir, HELLO), 'HELLO_DISQUE');

    await follow(commitId('c2', HELLO));

    // témoin : le texte à la tête de la PR est bien poussé
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // le texte du disque n'est jamais poussé
    expect(pushed()).not.toContain('HELLO_DISQUE');
  });
});

describe('la version de base d’un fichier supprimé ne se lit que par git (I-37)', () => {
  it('un fichier du module supprimé par la branche : son texte à la base est celui que git donne', async () => {
    await open();

    await follow(idOf(GREET));

    // la page reçoit le texte que git donne au fichier au point de départ de la branche
    expect(lastCode(idOf(GREET))?.at?.base).toBe(gitText(forkPoint(), GREET));
  });
});

describe('la version de base d’un test d’invariant ne se lit que par git (I-37)', () => {
  // Le test changé sur le disque, pas commité : ni le disque ni le dernier commit ne sont sa base.
  it('en Créer, un test que la branche modifie : sa base est le texte que git lui donne au départ de la branche', async () => {
    write(path.join(dir, INV), "it('INV_DISQUE', () => {});\n");
    await open();

    const base = testOf(INV).base;

    // le relevé porte le texte que git donne au test au point de départ de la branche
    expect(base).toBe(gitText(forkPoint(), INV));
  });

  // Absent à la base : git n'a rien à donner, le disque n'est pas lu à sa place.
  it('en Créer, un test ajouté par la branche : pas de base', async () => {
    await open();

    const base = testOf(INV_ADDED).base;

    // aucun texte de base pour un test que la base n'a pas
    expect(base ?? null).toBeNull();
  });

  it('en Relire, un test que la PR modifie : sa base est le texte que git lui donne au départ de la PR', async () => {
    review();
    await open();

    const base = testOf(INV).base;

    // le relevé porte le texte que git donne au test au point de départ de la PR
    expect(base).toBe(gitText(forkPoint(), INV));
  });
});
