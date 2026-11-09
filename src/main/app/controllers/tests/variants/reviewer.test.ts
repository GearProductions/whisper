// Variants du relecteur (note 0.13.0, docs/tickets/feat/0.13.0-fusionner-creer-relire.md ;
// l'invariant, seulement au clic : invariants/reviewer.test.ts) : ce que le clic sur S'assigner la PR,
// Me retirer de la PR ou Me demander en relecture lance, et ce que la page n'y choisit pas. La commande
// exacte et ses refus : technicals/direct/tests/invariants/assign.test.ts.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur disque, git réel sur un
// dépôt d'essai et son origin), dans le décor commun (app/tests/harness) ; gh, service externe, est faux
// ici (un faux préfixe : git passe au vrai git ; gh relève ses arguments et répond la PR 7 ouverte, son
// auteur, ses assignés, ses relecteurs demandés et l'identifiant, lus dans gh.json).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click as press, closeAll, fakeClaude, fakeElectron, git, openPanel, profile, remote, repoResources, settle, write, writeConfig } from 'app/tests/harness';

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

// Ce que la page reçoit : le relevé (conv:vibe).
type Survey = { flow: string };
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)?.[1] as Survey | undefined;
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

// Un clic sur une action de l'écran, tel que la page l'envoie.
async function click(id: string, args: object = {}) {
  await press(id, args);
  await settle();
}

describe.skipIf(process.platform === 'win32')('S’assigner la PR, s’en retirer : ce que le clic lance', () => {
  it('relecteur : le clic sur S’assigner la PR lance gh pr edit 7 --add-assignee <mon identifiant>, rien d’autre', async () => {
    people({ login: 'kb', author: 'bob' });
    configure('create');
    await openUntil('review');
    // témoin : l'appli a décidé relecteur
    expect(survey()?.flow).toBe('review');

    await click('assign-pr', { direct: true });
    await wait(1500);

    // un seul gh pr edit : la PR du relevé, l'identifiant lu par gh
    expect(edits()).toEqual([['pr', 'edit', '7', '--add-assignee', 'kb']]);
  }, 30000);

  it('créateur assigné : le clic sur Me retirer de la PR lance gh pr edit 7 --remove-assignee <mon identifiant>, rien d’autre', async () => {
    people({ login: 'kb', author: 'bob', assignees: ['kb'] });
    configure('review');
    await openUntil('create');
    // témoin : l'appli a décidé créateur (assigné)
    expect(survey()?.flow).toBe('create');

    await click('unassign-pr', { direct: true });
    await wait(1500);

    // un seul gh pr edit : la PR du relevé, l'identifiant lu par gh
    expect(edits()).toEqual([['pr', 'edit', '7', '--remove-assignee', 'kb']]);
  }, 30000);

  // La page ne choisit ni la PR ni la personne : la PR du dernier relevé, l'identifiant lu par gh.
  it('relecteur : le clic sur S’assigner la PR avec une autre PR et un autre nom dans ses arguments ne les passe pas à gh', async () => {
    people({ login: 'kb', author: 'bob' });
    configure('create');
    await openUntil('review');
    // témoin : l'appli a décidé relecteur
    expect(survey()?.flow).toBe('review');

    await click('assign-pr', { direct: true, pr: 8, text: 'mallory' });
    await wait(1500);

    // la PR donnée par la page n'est jamais éditée
    expect(edits().flat()).not.toContain('8');
    // le nom donné par la page n'est jamais passé
    expect(edits().flat()).not.toContain('mallory');
  }, 30000);

  // À la suite d'une autre action : Me demander en relecture n'assigne pas.
  it('relecteur : le clic sur Me demander en relecture ne lance aucun --add-assignee', async () => {
    people({ login: 'kb', author: 'bob' });
    configure('create');
    await openUntil('review');
    // témoin : l'appli a décidé relecteur
    expect(survey()?.flow).toBe('review');

    await click('request-review', { direct: true });
    await wait(1500);

    // aucun argument --add-assignee passé à gh
    expect(edits().flat()).not.toContain('--add-assignee');
  }, 30000);
});
