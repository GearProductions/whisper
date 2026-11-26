// Invariant des lectures de la revue, côté principal (note 0.16.0,
// docs/tickets/feat/0.16.0-revue-essentielle.md, « Ce que ça ne doit pas
// faire ») :
//   « Lancer une lecture (dépenser des tokens) sans geste du relecteur :
//     charger une PR, l'ouvrir, changer d'arrêt ou un simple relevé ne lancent
//     rien ; seuls Préparer la revue ou une demande à l'agent le font. »
// Ici : ouvrir le panneau sur une PR suivie, la charger, relever (même quand le
// relevé dit qu'il reste des lectures à lancer, après une lecture finie ou en
// échec, après un commit de plus sur la PR) n'envoie rien à Claude Code ; une
// lecture demandée par la page (une des demandes de Préparer la revue) ou par
// l'agent (sa CLI) part bien (témoins). L'avis de fin d'une course à la
// conversation (« VibeCoder : … terminée ») n'est pas une lecture : après une
// course, seuls les tours des cinq skills de lecture sont comptés. Changer d'arrêt est un geste de la page
// seule : tests/invariants/prepare-review.test.ts de app/panel/vibecoder.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai et son origin, un dépôt nu local),
// dans le décor commun (app/tests/harness) : faux Electron, faux SDK de Claude
// Code (chaque message reçu ouvre un tour, relevé, qui dure jusqu'à end()) ; et
// gh, service externe, faux ici (un faux préfixe : git passe au vrai git ; gh
// répond la PR 7 ouverte de bob, et l'identifiant kb : relecteur).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, closeAll, fakeClaude, fakeElectron, git, openPanel, orchestratorAsks, profile, remote, repoResources, settle, write, writeConfig } from 'app/tests/harness';

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

const BRANCH = 'feat/0.16.0-essai';
const NOTE = 'docs/tickets/feat/0.16.0-essai.md';
const HELLO = 'src/core/hello/index.ts';
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const REVIEW_NOTE = '/vibecoder:relire-note';

// Ce que la page reçoit : le relevé (conv:vibe).
type Survey = { flow: string; pr: { number: number } | null; prepare?: string[] };
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)?.[1] as Survey | undefined;
// Les skills (premiers mots) de tous les tours reçus par Claude Code.
const sentToAgent = () => claude.turns.map((t) => t.skill);
// Les skills des tours en cours.
const inProgress = () => claude.turns.filter((t) => !t.done).map((t) => t.skill);
// Les skills des cinq lectures de la revue (relecture de la note, pseudo-code, alignement, relecture du code, plan de test).
const READING_SKILLS = [REVIEW_NOTE, '/vibecoder:lire-invariants', '/vibecoder:aligner', '/vibecoder:relire-commits', '/vibecoder:ecran'];
// Les tours de lecture reçus par Claude Code (pas l'avis de fin de course à la conversation, qui n'est pas une lecture).
const readingsSent = () => sentToAgent().filter((s) => READING_SKILLS.includes(s));

// Les réglages : a1 sur le dépôt, en VibeCoder, derrière le faux préfixe ; `pr` : la PR suivie (null : aucune).
const configure = (pr: number | null) => writeConfig(root, [{ id: 'a1', dir: repoDir, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
  vibe: { flow: 'review', autonomy: 'guide', pr } }], { vibeCommandPrefix: `"${process.execPath}" "${path.join(root, 'faux-prefixe.cjs')}"` });
// La PR 7 déjà chargée : sa fiche dans les sorties, comme l'écrit Charger.
const loaded = () => write(path.join(out, 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: 'bob', base: 'main', head: BRANCH, body: '', state: 'OPEN' }));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  root = profile('whisper-review-readings-');
  out = path.join(root, 'vibecoder-out', 'a1');
  // main a le module ; la branche de la PR, sa note, le module changé et un test d'invariant ; origin : un dépôt nu.
  repoDir = path.join(root, 'projet');
  fs.mkdirSync(repoDir);
  git(repoDir, 'init', '-q', '-b', 'main');
  write(path.join(repoDir, HELLO), 'HELLO_MAIN');
  git(repoDir, 'add', '.');
  git(repoDir, 'commit', '-q', '-m', 'init');
  git(repoDir, 'switch', '-q', '-c', BRANCH);
  write(path.join(repoDir, NOTE), ['# 0.16.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
    '## Ce que ça ne doit pas faire', '', '- mentir → invariant', '',
    '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n'));
  write(path.join(repoDir, HELLO), 'HELLO_TEXTE');
  write(path.join(repoDir, INV), "import { it } from 'vitest';\nit('hello ne ment jamais', () => {});\n");
  git(repoDir, 'add', '.');
  git(repoDir, 'commit', '-q', '-m', 'la PR');
  remote(repoDir);
  // Le faux préfixe : git passe au vrai git ; gh répond la PR 7 de bob, ouverte, et l'identifiant kb.
  write(path.join(root, 'faux-prefixe.cjs'), `const [cmd, ...args] = process.argv.slice(2);
if (cmd !== 'gh') {
  const r = require('child_process').spawnSync(cmd, args, { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
const pr = { number: 7, title: 'Essai', url: 'u', state: 'OPEN', body: '', baseRefName: 'main', headRefName: ${JSON.stringify(BRANCH)},
  isCrossRepository: false, author: { login: 'bob' }, assignees: [], reviewRequests: [] };
if (args[0] === 'api') process.stdout.write('kb\\n');
else if (args[1] === 'list') process.stdout.write(JSON.stringify([pr]));
else if (args[1] === 'view') process.stdout.write(JSON.stringify(pr));
`);
});
afterEach(() => { closeAll(); process.chdir(CWD); });

// Un relevé, comme celui des 4 s, puis l'attente.
async function refresh() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await settle();
}

// Relevé après relevé, jusqu'à ce que `ok` tienne (gh lu en fond, une action directe qui finit), 10 s au plus.
async function until(ok: () => boolean) {
  for (const end = Date.now() + 10000; !ok() && Date.now() < end;) {
    await refresh();
    await wait(200);
  }
}

// Le panneau de a1 ouvert, puis relevé jusqu'à ce que l'appli ait décidé relecteur.
async function openAsReviewer() {
  await openPanel('a1');
  await until(() => survey()?.flow === 'review');
}

describe.skipIf(process.platform === 'win32')('sans geste du relecteur, aucune lecture ne part', () => {
  it('ouvrir le panneau sur la PR suivie, puis relever trois fois : rien n’est envoyé à Claude Code', async () => {
    configure(7);
    loaded();

    await openAsReviewer();
    await until(() => (survey()?.prepare?.length ?? 0) > 0);
    await refresh();
    await refresh();
    await refresh();

    // témoin : l'appli a décidé relecteur
    expect(survey()?.flow).toBe('review');
    // témoin : le relevé dit qu'il reste des lectures à lancer
    expect(survey()?.prepare?.length).toBeGreaterThan(0);
    // aucun tour n'a commencé
    expect(sentToAgent()).toEqual([]);
  }, 30000);

  it('charger la PR (Charger, au clic), puis relever : rien n’est envoyé à Claude Code', async () => {
    configure(null);
    await openAsReviewer();

    await click('load-pr', { direct: true, pr: 7 });
    await until(() => survey()?.pr?.number === 7);
    await until(() => (survey()?.prepare?.length ?? 0) > 0);
    await refresh();

    // témoin : la PR 7 est chargée
    expect(survey()?.pr?.number).toBe(7);
    // témoin : le relevé dit qu'il reste des lectures à lancer
    expect(survey()?.prepare?.length).toBeGreaterThan(0);
    // aucun tour n'a commencé
    expect(sentToAgent()).toEqual([]);
  }, 30000);

  // Cas limite : la lecture a échoué, le relevé la redonne à lancer ; elle ne repart pas d'elle-même.
  it('une lecture en échec, puis deux relevés : elle n’est pas relancée', async () => {
    configure(7);
    loaded();
    await openAsReviewer();
    await click('review-note');
    await settle();
    const before = readingsSent();

    claude.turns[0]?.end(false);
    await settle();
    await refresh();
    await refresh();

    // témoin : la lecture était bien partie, au clic
    expect(before).toEqual([REVIEW_NOTE]);
    // témoin : le relevé la redonne à lancer
    expect(survey()?.prepare).toContain('review-note');
    // aucune lecture de plus que celle du clic
    expect(readingsSent()).toEqual(before);
  }, 30000);

  // Cas limite : la lecture finie sur l'ancienne tête est à refaire ; elle ne repart pas d'elle-même.
  it('une lecture finie, puis un commit de plus sur la PR et deux relevés : elle n’est pas relancée', async () => {
    configure(7);
    loaded();
    await openAsReviewer();
    await click('review-note');
    await settle();
    claude.turns[0]?.end(true);
    await settle();
    await refresh();
    const before = readingsSent();

    write(path.join(repoDir, HELLO), 'HELLO_SUITE');
    git(repoDir, 'commit', '-q', '-am', 'un commit de plus');
    git(repoDir, 'push', '-q', 'origin', BRANCH);
    await refresh();
    await refresh();

    // témoin : la lecture était bien partie, au clic
    expect(before).toEqual([REVIEW_NOTE]);
    // témoin : le relevé la redonne à lancer, lue sur une autre tête
    expect(survey()?.prepare).toContain('review-note');
    // aucune lecture de plus que celle du clic
    expect(readingsSent()).toEqual(before);
  }, 30000);
});

// Témoins : avec un geste, la lecture part ; les absences ci-dessus viennent bien de l'absence de geste.
describe.skipIf(process.platform === 'win32')('témoins : demandée par la page ou par l’agent, une lecture part', () => {
  it('demandée par la page (une demande de Préparer la revue) : la relecture de la note travaille', async () => {
    configure(7);
    loaded();
    await openAsReviewer();

    await click('review-note');
    await settle();

    // la relecture de la note travaille
    expect(inProgress()).toContain(REVIEW_NOTE);
  }, 30000);

  it('demandée par l’agent (sa CLI) : la relecture de la note travaille', async () => {
    configure(7);
    loaded();
    await openAsReviewer();

    await orchestratorAsks(out, 'review-note');

    // la relecture de la note travaille
    expect(inProgress()).toContain(REVIEW_NOTE);
  }, 30000);
});
