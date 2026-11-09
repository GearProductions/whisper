// Invariants du relecteur, rôle décidé par l'appli (note 0.13.0,
// docs/tickets/feat/0.13.0-fusionner-creer-relire.md, « Ce que ça ne doit pas
// faire ») :
//   - « En relecteur, écrire un fichier (le code d'un module, la note, un
//     test) ou lancer une action qui édite, génère ou commite, même à la
//     demande d'une page : le principal recalcule le rôle d'après le dernier
//     relevé, sans se fier à la page » (I-37 / I-39 étendus) ;
//   - « S'assigner une PR, ou s'en retirer, autrement qu'à son clic (jamais
//     par l'agent ni à la suite d'une autre action) » (F-114, I-39) : ici,
//     côté contrôleur ; la commande exacte et ses refus :
//     technicals/direct/tests/invariants/assign.test.ts. Ici : seulement au clic ;
//     ce que le clic lance (la commande gh) est un variant : variants/reviewer.test.ts.
// Le rôle n'est jamais écrit à la main : chaque cas range dans les réglages le
// rôle contraire de celui que gh fait décider, et attend que le relevé le
// corrige (témoin en tête de chaque cas).
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai et son origin, un dépôt nu local),
// dans le décor commun (app/tests/harness) : faux Electron, faux SDK de Claude
// Code (chaque message reçu ouvre un tour, sans rien écrire, qui dure jusqu'à
// interrupt()) ; et gh, service externe, faux ici (un faux préfixe : git passe au
// vrai git ; gh relève ses arguments et répond la PR 7 ouverte, son auteur,
// ses assignés, ses relecteurs demandés et l'identifiant, lus dans gh.json).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click as press, closeAll, fakeClaude, fakeElectron, git, openPanel, orchestratorAsks, profile, remote, repoResources, settle, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

const CWD = process.cwd();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let root = '';
let repoDir = '';

const BRANCH = 'feat/0.13.0-essai';
const NOTE = 'docs/tickets/feat/0.13.0-essai.md';
const HELLO = 'src/core/hello/index.ts';
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const MODULE = '/vibecoder:module';
let out = '';

// Ce que la page reçoit : le relevé (conv:vibe).
type Survey = {
  flow: string;
  note: { id: string } | null;
  modules: { path: string; files: { id: string; path: string }[] }[];
  invariants: { id: string; path: string }[];
};
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)?.[1] as Survey | undefined;
// L'id que le dernier relevé donne à ce fichier d'un module ; sans id, le cas ne peut pas commencer.
function fileId(rel: string) {
  const f = survey()?.modules.flatMap((m) => m.files ?? []).find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// L'id que le dernier relevé donne à la note ; sans id, le cas ne peut pas commencer.
function noteId() {
  const n = survey()?.note;
  if (!n) throw new Error('le relevé ne donne aucune note');
  return n.id;
}
// L'id que le dernier relevé donne à ce test d'invariant ; sans id, le cas ne peut pas commencer.
function testId(rel: string) {
  const f = survey()?.invariants.find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// Le rang d'un module dans le dernier relevé (VibeArgs.module).
const rankOf = (modulePath: string) => survey()?.modules.findIndex((m) => m.path === modulePath) ?? -1;
// Le texte d'un fichier du dépôt.
const onDisk = (rel: string) => fs.readFileSync(path.join(repoDir, rel), 'utf8');
// Les skills (ou premiers mots) de tous les tours reçus par Claude Code.
const sentToAgent = () => claude.turns.map((t) => t.skill);
// Les skills des tours en cours.
const inProgress = () => claude.turns.filter((t) => !t.done).map((t) => t.skill);
// Chaque gh pr edit lancé, ses arguments après « gh ».
const edits = () => (fs.existsSync(path.join(root, 'gh.jsonl')) ? fs.readFileSync(path.join(root, 'gh.jsonl'), 'utf8').trim().split('\n').filter(Boolean) : [])
  .map((l) => JSON.parse(l) as string[]).filter((a) => a[0] === 'pr' && a[1] === 'edit');

// Ce que gh répond : l'identifiant de l'utilisateur, l'auteur de la PR 7, ses assignés, ses relecteurs demandés.
const people = (p: { login: string; author: string; assignees?: string[]; reviewers?: string[] }) =>
  write(path.join(root, 'gh.json'), JSON.stringify({ assignees: [], reviewers: [], ...p }));
// Les réglages : a1 sur le dépôt, en VibeCoder, derrière le faux préfixe ; `stored` : le rôle rangé.
const configure = (stored: 'create' | 'review') => writeConfig(root, [{ id: 'a1', dir: repoDir, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
  vibe: { flow: stored, autonomy: 'guide', pr: null } }], { vibeCommandPrefix: `"${process.execPath}" "${path.join(root, 'faux-prefixe.cjs')}"` });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  root = profile('whisper-reviewer-');
  out = path.join(root, 'vibecoder-out', 'a1');
  // main a le module, la branche de la PR sa note, le module changé et un test d'invariant ; origin : un dépôt nu.
  repoDir = path.join(root, 'projet');
  fs.mkdirSync(repoDir);
  git(repoDir, 'init', '-q', '-b', 'main');
  write(path.join(repoDir, HELLO), 'HELLO_MAIN');
  write(path.join(repoDir, 'src/core/autre/index.ts'), 'AUTRE_MAIN');
  git(repoDir, 'add', '.');
  git(repoDir, 'commit', '-q', '-m', 'init');
  git(repoDir, 'switch', '-q', '-c', BRANCH);
  write(path.join(repoDir, NOTE), ['# 0.13.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
    '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', 'src/core/autre    autre() · ne connaît pas : le DOM', '```', ''].join('\n'));
  write(path.join(repoDir, HELLO), 'HELLO_TEXTE');
  write(path.join(repoDir, INV), "import { it } from 'vitest';\nit('hello ne ment jamais', () => {});\n");
  git(repoDir, 'add', '.');
  git(repoDir, 'commit', '-q', '-m', 'la PR');
  remote(repoDir);
  // Le faux préfixe : git passe au vrai git ; gh relève ses arguments et répond d'après gh.json.
  write(path.join(root, 'faux-prefixe.cjs'), `const fs = require('fs');
const [cmd, ...args] = process.argv.slice(2);
if (cmd !== 'gh') {
  const r = require('child_process').spawnSync(cmd, args, { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
fs.appendFileSync(${JSON.stringify(path.join(root, 'gh.jsonl'))}, JSON.stringify(args) + '\\n');
const s = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(root, 'gh.json'))}, 'utf8'));
const pr = { number: 7, title: 'Essai', url: 'u', state: 'OPEN', body: '', baseRefName: 'main', headRefName: ${JSON.stringify(BRANCH)},
  isCrossRepository: false, author: { login: s.author }, assignees: s.assignees.map((login) => ({ login })),
  reviewRequests: s.reviewers.map((login) => ({ __typename: 'User', login })) };
if (args[0] === 'api') process.stdout.write(s.login + '\\n');
else if (args[1] === 'list') process.stdout.write(JSON.stringify([pr]));
else if (args[1] === 'view') process.stdout.write(JSON.stringify(pr));
`);
});
afterEach(() => { closeAll(); process.chdir(CWD); });

// Le panneau de a1 ouvert, puis relevé après relevé jusqu'à ce que le rôle soit `role` (gh lu en fond), 8 s au plus.
async function openUntil(role: 'create' | 'review') {
  const { refreshVibe } = await import('app/controllers');
  await openPanel('a1');
  for (const end = Date.now() + 8000; survey()?.flow !== role && Date.now() < end;) {
    await refreshVibe({ now: true });
    await wait(200);
  }
}

// La page suit un fichier (affiché ; null : plus rien).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

// Enregistrer, tel que la page l'envoie ; ce que la page apprend.
async function save(id: unknown, text: unknown) {
  const { saveCode } = await import('app/controllers');
  const result = await saveCode(id, text);
  await settle();
  return result;
}

// Un clic sur une action de l'écran, tel que la page l'envoie.
async function click(id: string, args: object = {}) {
  await press(id, args);
  await settle();
}

// La page se dit créatrice, comme le faisait la bascule Créer / Relire, puis un relevé.
async function pageClaimsCreator() {
  const { setVibe, refreshVibe } = await import('app/controllers');
  setVibe({ flow: 'create' });
  await settle();
  await refreshVibe({ now: true });
  await settle();
}

describe.skipIf(process.platform === 'win32')('en relecteur, le principal n’écrit aucun fichier, quoi que dise la page', () => {
  beforeEach(() => {
    // la PR de bob ; je suis kb, ni auteur ni assigné : relecteur. Rangé : créateur.
    people({ login: 'kb', author: 'bob' });
    configure('create');
  });

  it('le code d’un module, affiché puis enregistré : refusé, le fichier inchangé', async () => {
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');
    await follow(fileId(HELLO));

    const result = await save(fileId(HELLO), 'HELLO_ENREGISTRE');

    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
    // le fichier sur le disque est inchangé
    expect(onDisk(HELLO)).toBe('HELLO_TEXTE');
  }, 30000);

  it('la note, affichée puis enregistrée : le fichier inchangé', async () => {
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');
    const before = onDisk(NOTE);
    await follow(noteId());

    await save(noteId(), 'NOTE_ENREGISTREE');

    // la note sur le disque est inchangée
    expect(onDisk(NOTE)).toBe(before);
  }, 30000);

  it('un test d’invariant, affiché puis enregistré : le fichier inchangé', async () => {
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');
    const before = onDisk(INV);
    await follow(testId(INV));

    await save(testId(INV), 'TEST_ENREGISTRE');

    // le test sur le disque est inchangé
    expect(onDisk(INV)).toBe(before);
  }, 30000);

  // La page envoie l'ancien flow « create » (VibePatch.flow) : le rôle reste celui de gh.
  it('la page se dit créatrice, puis enregistre le code d’un module : le fichier inchangé', async () => {
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');
    await follow(fileId(HELLO));

    await pageClaimsCreator();
    await save(fileId(HELLO), 'HELLO_ENREGISTRE');

    // le fichier sur le disque est inchangé
    expect(onDisk(HELLO)).toBe('HELLO_TEXTE');
  }, 30000);
});

describe.skipIf(process.platform === 'win32')('en relecteur, aucune action qui édite, génère ou commite ne part, quoi que dise la page', () => {
  beforeEach(() => {
    // la PR de bob ; je suis kb, ni auteur ni assigné : relecteur. Rangé : créateur.
    people({ login: 'kb', author: 'bob' });
    configure('create');
  });

  // Éditer : Rédiger la note.
  it('note : rien n’est envoyé à Claude Code', async () => {
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');

    await click('note', { text: 'réécris la note' });

    // aucun tour n'a commencé
    expect(sentToAgent()).toEqual([]);
  }, 30000);

  // Générer : Écrire les invariants.
  it('invariants : rien n’est envoyé à Claude Code', async () => {
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');

    await click('invariants');

    // aucun tour n'a commencé
    expect(sentToAgent()).toEqual([]);
  }, 30000);

  // Générer : Générer ce module.
  it('module : rien n’est envoyé à Claude Code', async () => {
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');

    await click('module', { module: rankOf('src/core/hello') });

    // aucun tour n'a commencé
    expect(sentToAgent()).toEqual([]);
  }, 30000);

  // Commiter : ✓ Commiter, l'action directe, sur un changement indexé et un message préparé.
  it('commit (direct) : aucun commit n’est créé', async () => {
    write(path.join(repoDir, 'src/core/hello/extra.ts'), 'EXTRA');
    git(repoDir, 'add', '.');
    write(path.join(out, 'commit.md'), 'feat: extra\n');
    const head = git(repoDir, 'rev-parse', 'HEAD');
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');

    await click('commit', { direct: true });
    await wait(1500);

    // la branche n'a pas bougé
    expect(git(repoDir, 'rev-parse', 'HEAD')).toBe(head);
  }, 30000);

  // La page envoie l'ancien flow « create » (VibePatch.flow) : le rôle reste celui de gh.
  it('la page se dit créatrice, puis module : rien n’est envoyé à Claude Code', async () => {
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');

    await pageClaimsCreator();
    await click('module', { module: rankOf('src/core/hello') });

    // aucun tour n'a commencé
    expect(sentToAgent()).toEqual([]);
  }, 30000);

  // Pas une page, l'agent : l'orchestrateur demande Écrire les invariants.
  it('demandée par l’orchestrateur, invariants : rien n’est envoyé à Claude Code', async () => {
    await openUntil('review');
    // témoin : l'appli a décidé relecteur, malgré le rôle rangé
    expect(survey()?.flow).toBe('review');

    await orchestratorAsks(out, 'invariants');

    // aucun tour n'a commencé
    expect(sentToAgent()).toEqual([]);
  }, 30000);
});

// Témoins : les mêmes gestes, l'appli décidant créateur, agissent ; les refus ci-dessus viennent bien du rôle.
describe.skipIf(process.platform === 'win32')('témoins : en créateur (décidé par l’appli), les mêmes gestes agissent', () => {
  beforeEach(() => {
    // la PR de kb, et je suis kb : créateur. Rangé : relecteur.
    people({ login: 'kb', author: 'kb' });
    configure('review');
  });

  it('le code d’un module, affiché puis enregistré : écrit', async () => {
    await openUntil('create');
    // témoin : l'appli a décidé créateur, malgré le rôle rangé
    expect(survey()?.flow).toBe('create');
    await follow(fileId(HELLO));

    await save(fileId(HELLO), 'HELLO_ENREGISTRE');

    // le fichier sur le disque porte le texte enregistré
    expect(onDisk(HELLO)).toBe('HELLO_ENREGISTRE');
  }, 30000);

  it('module : la génération du module part', async () => {
    await openUntil('create');
    // témoin : l'appli a décidé créateur, malgré le rôle rangé
    expect(survey()?.flow).toBe('create');

    await click('module', { module: rankOf('src/core/hello') });

    // la génération du module travaille
    expect(inProgress()).toContain(MODULE);
  }, 30000);
});

describe.skipIf(process.platform === 'win32')('S’assigner la PR, s’en retirer : seulement au clic de son bouton', () => {
  it('relecteur : ouvrir le panneau et relever, sans clic, ne lance aucun gh pr edit', async () => {
    people({ login: 'kb', author: 'bob' });
    configure('create');
    await openUntil('review');
    // témoin : l'appli a décidé relecteur
    expect(survey()?.flow).toBe('review');

    const { refreshVibe } = await import('app/controllers');
    await refreshVibe({ now: true });
    await settle();

    // aucun gh pr edit
    expect(edits()).toEqual([]);
  }, 30000);

  // Par l'agent : S'assigner la PR n'est qu'une action directe (DIRECT_ONLY).
  it('relecteur : S’assigner la PR envoyée sans le clic direct (la voie de l’agent) ne lance aucun gh pr edit ni aucun tour', async () => {
    people({ login: 'kb', author: 'bob' });
    configure('create');
    await openUntil('review');
    // témoin : l'appli a décidé relecteur
    expect(survey()?.flow).toBe('review');

    await click('assign-pr');
    await wait(1500);

    // aucun gh pr edit
    expect(edits()).toEqual([]);
    // rien n'est envoyé à Claude Code
    expect(sentToAgent()).toEqual([]);
  }, 30000);

  it('relecteur : S’assigner la PR demandée par l’orchestrateur ne lance aucun gh pr edit', async () => {
    people({ login: 'kb', author: 'bob' });
    configure('create');
    await openUntil('review');
    // témoin : l'appli a décidé relecteur
    expect(survey()?.flow).toBe('review');

    await orchestratorAsks(out, 'assign-pr');
    await wait(1500);

    // aucun gh pr edit
    expect(edits()).toEqual([]);
  }, 30000);

  it('créateur assigné : Me retirer de la PR demandée par l’orchestrateur ne lance aucun gh pr edit', async () => {
    people({ login: 'kb', author: 'bob', assignees: ['kb'] });
    configure('review');
    await openUntil('create');
    // témoin : l'appli a décidé créateur (assigné)
    expect(survey()?.flow).toBe('create');

    await orchestratorAsks(out, 'unassign-pr');
    await wait(1500);

    // aucun gh pr edit
    expect(edits()).toEqual([]);
  }, 30000);
});
