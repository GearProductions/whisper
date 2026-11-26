// Variants du relecteur (note 0.13.0, docs/tickets/feat/0.13.0-fusionner-creer-relire.md ;
// l'invariant, seulement au clic : invariants/reviewer.test.ts) : ce que le clic sur S'assigner la PR,
// Me retirer de la PR ou Me demander en relecture lance, et ce que la page n'y choisit pas. La commande
// exacte et ses refus : technicals/direct/tests/invariants/assign.test.ts.
// Note 0.16.0 (docs/tickets/feat/0.16.0-revue-essentielle.md ; l'invariant : invariants/review-readings.test.ts) :
// en relecteur, l'alignement est une lecture (ses sorties seules, avec les autres lectures), et chaque lecture de la
// revue finie pose sa marque « read:<pr>:<action> » pour le commit de tête d'où elle est partie.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur disque, git réel sur un
// dépôt d'essai et son origin), dans le décor commun (app/tests/harness) ; gh, service externe, est faux
// ici (un faux préfixe : git passe au vrai git ; gh relève ses arguments et répond la PR 7 ouverte, son
// auteur, ses assignés, ses relecteurs demandés et l'identifiant, lus dans gh.json).
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
let out = '';

const BRANCH = 'feat/0.13.0-essai';
const NOTE = 'docs/tickets/feat/0.13.0-essai.md';
const HELLO = 'src/core/hello/index.ts';
const OTHER = 'src/core/autre/index.ts';
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
const configure = (stored: 'create' | 'review', pr: number | null = null) => writeConfig(root, [{ id: 'a1', dir: repoDir, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
  vibe: { flow: stored, autonomy: 'guide', pr } }], { vibeCommandPrefix: `"${process.execPath}" "${path.join(root, 'faux-prefixe.cjs')}"` });

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

// ---- Note 0.16.0 : l'alignement est une lecture, chaque lecture retient sa tête --------------------------------------------

// Les skills des cinq lectures de la revue, dans l'ordre où Préparer la revue les demande.
const READINGS = ['review-note', 'read-invariants', 'align', 'review-commits', 'screen'];
const SKILLS = ['/vibecoder:relire-note', '/vibecoder:lire-invariants', '/vibecoder:aligner', '/vibecoder:relire-commits', '/vibecoder:ecran'];
const ALIGN = '/vibecoder:aligner';
const REVIEW_NOTE = '/vibecoder:relire-note';

// La PR 7 chargée (sa fiche dans les sorties, comme l'écrit Charger), suivie par l'agent.
const loaded = () => write(path.join(out, 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: 'bob', base: 'main', head: BRANCH, body: '', state: 'OPEN' }));
// Ce que la page reçoit, en entier (l'écran reçoit aussi les actions et ce qu'il reste à préparer).
type Full = { flow: string; prepare?: string[]; actions: { id: string; disabled: string | null }[] };
const full = () => survey() as unknown as Full | undefined;
// Les tours reçus par Claude Code : leurs skills, ceux qui travaillent encore, et ce que chacun a reçu à son lancement.
const skills = () => claude.turns.map((t) => t.skill);
const working = () => claude.turns.filter((t) => !t.done).map((t) => t.skill);
const turnOf = (skill: string) => claude.turns.filter((t) => t.skill === skill).at(-1)!;   // le dernier : une lecture relancée
// Le commit de tête de la PR, et les validations rangées dans le profil (marque « read:<pr>:<action> » : { hash, verdict }).
const head = () => git(repoDir, 'rev-parse', 'HEAD').trim();
const marks = (): Record<string, { hash: string; verdict: string }> => {
  const file = path.join(root, 'vibecoder-state.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).marks?.a1 ?? {} : {};
};
const readMarks = () => Object.fromEntries(Object.entries(marks()).filter(([k]) => k.startsWith('read:')));
// Un commit de plus sur la PR.
const commitMore = (text: string) => { write(path.join(repoDir, HELLO), text); git(repoDir, 'commit', '-q', '-am', text); };

// Le relecteur de la PR 7 déjà chargée, le panneau relevé jusque-là ; ou le créateur (auteur : moi).
async function reviewer() {
  people({ login: 'kb', author: 'bob' });
  configure('review', 7);
  loaded();
  await openUntil('review');
  expect(survey()?.flow).toBe('review');   // témoin : l'appli a décidé relecteur
}
async function creator() {
  people({ login: 'kb', author: 'kb' });
  configure('create');
  await openUntil('create');
  expect(survey()?.flow).toBe('create');   // témoin : l'appli a décidé créateur
}
async function refresh() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await settle();
}

// Ce que décide le contrôle des fichiers de la course pour l'appel `tool(input)`, appelé comme le SDK l'appelle avant l'outil :
// chaque crochet PreToolUse dont le filtre vise cet outil. Un refus : 'deny' ; sinon 'pass'.
type Hook = (input: Record<string, unknown>, id: string | undefined, o: { signal: AbortSignal }) => Promise<Record<string, unknown> | undefined>;
async function verdict(skill: string, tool: string, input: Record<string, unknown>): Promise<'deny' | 'pass'> {
  const groups = ((turnOf(skill).options.hooks as Record<string, unknown> | undefined)?.PreToolUse ?? []) as { matcher?: string; hooks: Hook[] }[];
  const answers: (Record<string, unknown> | undefined)[] = [];
  for (const group of groups) {
    if (group.matcher && group.matcher !== '*' && !new RegExp(`^(?:${group.matcher})$`).test(tool)) continue;
    for (const hook of group.hooks) {
      answers.push(await hook({ hook_event_name: 'PreToolUse', session_id: 's1', transcript_path: '', cwd: repoDir, tool_name: tool, tool_input: input, tool_use_id: 't1' },
        't1', { signal: new AbortController().signal }));
    }
  }
  const denies = (a: Record<string, unknown> | undefined) =>
    (a?.hookSpecificOutput as Record<string, unknown> | undefined)?.permissionDecision === 'deny' || a?.decision === 'block';
  return answers.some(denies) ? 'deny' : 'pass';
}

describe.skipIf(process.platform === 'win32')('relecteur : l’alignement est une lecture', () => {
  it('relecteur, l’alignement demandé pendant qu’une lecture court : il part', async () => {
    await reviewer();
    await click('review-note');

    await click('align');

    // témoin : la lecture court encore
    expect(working()).toContain(REVIEW_NOTE);
    // l’alignement est parti, avec elle
    expect(working()).toContain(ALIGN);
  }, 30000);

  it('relecteur, une lecture demandée pendant que l’alignement court : elle part', async () => {
    await reviewer();
    await click('align');

    await click('review-note');

    // l’alignement court encore
    expect(working()).toContain(ALIGN);
    // la lecture est partie, avec lui
    expect(working()).toContain(REVIEW_NOTE);
  }, 30000);

  // Cas limite : les cinq lectures de Préparer la revue, demandées l’une après l’autre sans qu’aucune ait fini, courent ensemble.
  it('relecteur, les cinq lectures demandées de suite : les cinq courent ensemble', async () => {
    await reviewer();

    for (const id of READINGS) await click(id);

    // aucune n’en a retenu une autre
    expect(working()).toEqual(SKILLS);
  }, 30000);

  it('relecteur, l’alignement en cours : le relevé ne grise aucune lecture, et l’alignement n’est pas grisé par une lecture', async () => {
    await reviewer();
    await click('review-note');
    await refresh();
    const during = full()!.actions.find((a) => a.id === 'align');

    await click('align');
    await refresh();

    // témoin : l’alignement est proposé
    expect(during).toBeDefined();
    // une lecture qui court ne le grise pas
    expect(during!.disabled).toBeNull();
    // l’alignement qui court ne grise pas la relecture du code
    expect(full()!.actions.find((a) => a.id === 'review-commits')!.disabled).toBeNull();
  }, 30000);

  it('relecteur, l’alignement : un fichier du projet lui est refusé, ses sorties lui sont permises', async () => {
    await reviewer();
    await click('align');
    const proj = fs.realpathSync(repoDir);

    // un fichier du projet, qu’il existe ou non
    expect(await verdict(ALIGN, 'Write', { file_path: path.join(proj, OTHER), content: 'x' })).toBe('deny');
    expect(await verdict(ALIGN, 'Edit', { file_path: path.join(proj, HELLO), old_string: 'HELLO_TEXTE', new_string: 'x' })).toBe('deny');
    expect(await verdict(ALIGN, 'Write', { file_path: path.join(proj, INV), content: 'x' })).toBe('deny');
    // ses sorties : align.md et liens.md
    expect(await verdict(ALIGN, 'Write', { file_path: path.join(fs.realpathSync(out), 'align.md'), content: 'x' })).toBe('pass');
    expect(await verdict(ALIGN, 'Write', { file_path: path.join(fs.realpathSync(out), 'liens.md'), content: 'x' })).toBe('pass');
  }, 30000);

  it('créateur, l’alignement : il modifie toujours, aucune marque de lecture', async () => {
    await creator();
    await click('align');
    const proj = fs.realpathSync(repoDir);

    // le fichier d’un module de la branche lui est permis (il corrige les nouveaux tests)
    expect(await verdict(ALIGN, 'Write', { file_path: path.join(proj, 'src/core/hello/tests/variants/nouveau.test.ts'), content: 'x' })).toBe('pass');
    turnOf(ALIGN).end(true);
    await settle();
    await refresh();
    await refresh();

    // finie, aucune marque de lecture
    expect(readMarks()).toEqual({});
  }, 30000);

  it('créateur, une lecture en cours : l’alignement reste retenu (il modifie la branche)', async () => {
    await creator();
    await click('read-invariants');

    await click('align');

    // témoin : la lecture court
    expect(working()).toContain('/vibecoder:lire-invariants');
    // l’alignement, qui modifie, attend
    expect(skills()).not.toContain(ALIGN);
  }, 30000);
});

describe.skipIf(process.platform === 'win32')('relecteur : une lecture finie retient la tête d’où elle est partie', () => {
  it('une lecture finie : au relevé suivant, sa marque porte la tête d’où elle est partie', async () => {
    await reviewer();
    const from = head();
    await click('review-note');
    commitMore('HELLO_SUITE');   // un commit de plus pendant qu’elle travaille

    turnOf(REVIEW_NOTE).end(true);
    await settle();
    await refresh();

    // témoin : la PR a bien une autre tête
    expect(head()).not.toBe(from);
    // la tête du départ, pas celle d’aujourd’hui
    expect(readMarks()).toEqual({ 'read:7:review-note': { hash: from, verdict: 'ok' } });
  }, 30000);

  it('chaque lecture finie pose sa marque, quelle qu’elle soit : une par action (sauf le pseudo-code des tests)', async () => {
    await reviewer();
    const from = head();
    for (const id of READINGS) await click(id);

    for (const t of claude.turns) t.end(true);
    await settle();
    await refresh();

    // la même tête, une marque par lecture
    expect(readMarks()).toEqual(Object.fromEntries(READINGS.filter((id) => id !== 'read-invariants').map((id) => [`read:7:${id}`, { hash: from, verdict: 'ok' }])));
  }, 30000);

  it('lancée par la CLI : la même marque', async () => {
    await reviewer();
    const from = head();
    await orchestratorAsks(out, 'review-note');

    turnOf(REVIEW_NOTE).end(true);
    await settle();
    await refresh();

    // la même marque que pour le clic
    expect(readMarks()).toEqual({ 'read:7:review-note': { hash: from, verdict: 'ok' } });
  }, 30000);

  it('une lecture en échec : pas de marque', async () => {
    await reviewer();
    await click('review-note');

    turnOf(REVIEW_NOTE).end(false);
    await settle();
    await refresh();

    // témoin : la lecture est bien finie, le relevé la redonne à lancer
    expect(claude.turns[0].done).toBe(true);
    expect(full()?.prepare).toContain('review-note');
    // aucune marque
    expect(readMarks()).toEqual({});
  }, 30000);

  it('une lecture arrêtée : pas de marque', async () => {
    await reviewer();
    await click('review-note');
    const { vibeRunOp } = await import('app/controllers');

    await vibeRunOp('review-note', 'stop');
    await settle();
    await refresh();

    // témoin : le tour est fini, arrêté
    expect(claude.turns[0].done).toBe(true);
    // aucune marque
    expect(readMarks()).toEqual({});
  }, 30000);

  // Cas limite : l’échec ne retient rien pour la suivante : relancée sur la tête d’aujourd’hui, elle pose la sienne.
  it('en échec, puis relancée et finie sur une autre tête : la marque porte la tête de la seconde', async () => {
    await reviewer();
    await click('review-note');
    turnOf(REVIEW_NOTE).end(false);
    await settle();
    await refresh();
    commitMore('HELLO_SUITE');
    const second = head();
    await refresh();

    await click('review-note');
    turnOf(REVIEW_NOTE).end(true);
    await settle();
    await refresh();

    // la seconde seule compte
    expect(readMarks()).toEqual({ 'read:7:review-note': { hash: second, verdict: 'ok' } });
  }, 30000);

  // Cas limite : sa fin n’est rangée qu’au premier relevé qui la voit ; une marque retirée depuis n’est pas reposée.
  it('deux relevés après sa fin : rangée une seule fois', async () => {
    await reviewer();
    await click('review-note');
    turnOf(REVIEW_NOTE).end(true);
    await settle();
    await refresh();
    // témoin : rangée au premier relevé
    expect(Object.keys(readMarks())).toEqual(['read:7:review-note']);

    // la marque ôtée du profil, comme si une autre étape l’avait retirée
    const file = path.join(root, 'vibecoder-state.json');
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete state.marks.a1['read:7:review-note'];
    fs.writeFileSync(file, JSON.stringify(state));
    await refresh();
    await refresh();

    // deux relevés de plus : rien n’est reposé
    expect(readMarks()).toEqual({});
  }, 30000);

  it('la page envoie elle-même cette marque : refusée', async () => {
    await reviewer();
    const { markVibe } = await import('app/controllers');

    markVibe('read:7:review-note', 'ok');
    markVibe('read:7:align', 'ok');
    markVibe('read:review-note', 'ok');
    await settle();

    // ni l’une ni l’autre, quelle que soit la tête
    expect(readMarks()).toEqual({});
    // et le relevé redonne la lecture à lancer
    expect(full()?.prepare).toContain('review-note');
  }, 30000);
});

describe.skipIf(process.platform === 'win32')('relecteur : rien n’est lancé sans geste, rien n’édite', () => {
  it('relecteur, charger une PR puis relever : rien n’est envoyé à l’agent', async () => {
    people({ login: 'kb', author: 'bob' });
    configure('review');
    await openUntil('review');

    await click('load-pr', { direct: true, pr: 7 });
    await refresh();
    await refresh();

    // témoin : la PR est chargée
    expect(fs.existsSync(path.join(out, 'pr-7.json'))).toBe(true);
    // aucun tour n’a commencé
    expect(claude.turns).toEqual([]);
  }, 30000);

  it('relecteur, une action qui édite, génère ou commite : toujours refusée', async () => {
    await reviewer();

    for (const id of ['note', 'forme', 'invariants', 'module', 'modules', 'commit', 'commit-modules', 'apply', 'fixups', 'pr', 'base']) await click(id, id === 'module' ? { module: 'src/core/hello' } : {});
    await refresh();

    // aucune course ne part, aucun message à l’agent
    expect(claude.turns).toEqual([]);
  }, 30000);
});
