// Variants de module-code (note 0.11.0) : le fichier suivi poussé à chaque
// changement (écriture directe ou par renommage), trop gros → text null, un
// seul suivi à la fois, Enregistrer refusé pour un texte invalide ; un fichier
// supprimé (par la branche, sans veilleur, ou pendant qu'il est suivi) et, en Relire, un fichier
// d'un commit (note 0.13.0) : lus par git ; un fichier que change la branche (`b<i>`), lu
// avec at comme un fichier de module, supprimé : text null et at, sans veilleur.
// Puis (0.15.0), déplacés de invariants/module-code.test.ts : la forme du relevé, l'id de la
// note (Créer, Relire), l'id du dossier d'un module, un autre fichier ou l'accordéon replié,
// et le refus d'Enregistrer renvoyé à la page par sorte de course.
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le SDK de Claude Code
// factices, git réel sur un dépôt d'essai).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  click as press, closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, write, writeConfig,
} from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

// un poussé de ce fichier arrivé (ses lectures git, lentes sur un runner Windows)
const pushedFor = (id: string) => vi.waitFor(() => expect(codes().at(-1)).toMatchObject({ id }), { timeout: 10_000 });
const HELLO = 'src/core/hello/index.ts';
const GREET = 'src/core/hello/greet.ts';
const BRANCH = 'feat/0.11.0-essai';
const NOTE = `docs/tickets/${BRANCH}.md`;
const NOTE_TEXT = '# 0.11.0 — essai\n\n## Forme\n\n```\nsrc/core/hello    hello() · ne connaît pas : le DOM\nsrc/core/autre    autre() · ne connaît pas : le DOM\n```\n';
let root = '';
let dir = '';

type Survey = {
  note: { id: string } | null;
  modules: { path: string; file: { id: string } | null; files: { id: string; path: string }[] }[];
};
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as Survey;
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as { id: string; text: string | null } | null);
const idOf = (rel: string) => survey().modules.flatMap((m) => m.files ?? []).find((f) => f.path === rel)!.id;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  root = profile('whisper-module-code-v-');
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: NOTE_TEXT });
  git(dir, 'checkout', '-q', 'main');
  write(path.join(dir, HELLO), 'HELLO_MAIN');
  write(path.join(dir, GREET), 'GREET_MAIN');
  write(path.join(dir, 'src/core/autre/index.ts'), 'AUTRE_TEXTE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'main');
  git(dir, 'checkout', '-q', BRANCH);
  git(dir, 'rebase', '-q', 'main');
  write(path.join(dir, HELLO), 'HELLO_TEXTE');
  write(path.join(dir, GREET), 'GREET_TEXTE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'hello');
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null,
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
  await openPanel('a1');
});
afterEach(async () => { (await import('app/controllers')).followCode(null); closeAll(); });

it('le fichier suivi est poussé à chaque changement, écrit directement ou par renommage', async () => {
  const { followCode } = await import('app/controllers');
  followCode(idOf(HELLO));
  await pushedFor(idOf(HELLO));
  write(path.join(dir, HELLO), 'HELLO_DIRECT');
  await settle();
  write(path.join(dir, 'src/core/hello/.tmp'), 'HELLO_RENOMME');
  fs.renameSync(path.join(dir, 'src/core/hello/.tmp'), path.join(dir, HELLO));
  await settle();
  const texts = codes().map((c) => c?.text);
  expect(texts[0]).toBe('HELLO_TEXTE');
  expect(texts).toContain('HELLO_DIRECT');
  expect(texts.at(-1)).toBe('HELLO_RENOMME');
});

it('suivre un autre fichier : l’ancien n’est plus lu', async () => {
  const { followCode } = await import('app/controllers');
  followCode(idOf(HELLO));
  followCode(idOf(GREET));
  await pushedFor(idOf(GREET));   // le nouveau poussé d'abord, puis l'ancien changé
  write(path.join(dir, HELLO), 'HELLO_CHANGE');
  await settle();
  expect(JSON.stringify(codes())).not.toContain('HELLO_CHANGE');
  expect(codes().at(-1)).toMatchObject({ id: idOf(GREET), text: 'GREET_TEXTE' });
});

it('un fichier plus gros que READ_MAX : text null', async () => {
  const { followCode, READ_MAX } = await import('app/controllers');
  write(path.join(dir, HELLO), 'x'.repeat(READ_MAX + 1));
  followCode(idOf(HELLO));
  await pushedFor(idOf(HELLO));
  expect(codes().at(-1)).toMatchObject({ id: idOf(HELLO), text: null });
});

it('un id qui ne désigne rien : null poussé', async () => {
  const { followCode } = await import('app/controllers');
  followCode('m99/0');
  expect(codes().at(-1)).toBeNull();
});

it('Enregistrer : refusé pour un texte qui n’est pas une chaîne ou trop gros ; accepté sinon', async () => {
  const { followCode, saveCode, READ_MAX } = await import('app/controllers');
  followCode(idOf(HELLO));
  expect(saveCode(idOf(HELLO), 42).ok).toBe(false);
  expect(saveCode(idOf(HELLO), 'x'.repeat(READ_MAX + 1)).ok).toBe(false);
  expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_TEXTE');
  expect(saveCode(idOf(HELLO), 'HELLO_OK')).toEqual({ ok: true });
  expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_OK');
});

it('Enregistrer : le fichier suivi supprimé n’est pas recréé', async () => {
  const { followCode, saveCode } = await import('app/controllers');
  followCode(idOf(HELLO));
  fs.rmSync(path.join(dir, HELLO));
  expect(saveCode(idOf(HELLO), 'HELLO_RECREE').ok).toBe(false);
  expect(fs.existsSync(path.join(dir, HELLO))).toBe(false);
});

// Le dernier relevé redemandé, après un changement du dépôt ou des réglages.
const resurvey = async () => { await (await import('app/controllers')).refreshVibe({ now: true }); await settle(); };

it('un fichier de module supprimé par la branche : text null, ses versions par git, pas de veilleur', async () => {
  const { followCode } = await import('app/controllers');
  git(dir, 'rm', '-q', GREET);
  git(dir, 'commit', '-q', '-m', 'sans greet');
  await resurvey();
  followCode(idOf(GREET));
  await pushedFor(idOf(GREET));
  expect(codes().at(-1)).toMatchObject({ id: idOf(GREET), text: null, at: { base: 'GREET_MAIN', head: null } });
  const n = codes().length;
  write(path.join(dir, GREET), 'GREET_REVENU');
  await settle();
  expect(codes().length).toBe(n);
});

it('un fichier de module supprimé pendant qu’il est suivi : text null, ses versions par git', async () => {
  const { followCode } = await import('app/controllers');
  followCode(idOf(HELLO));
  await pushedFor(idOf(HELLO));
  fs.rmSync(path.join(dir, HELLO));
  await vi.waitFor(() => expect(codes().at(-1)).toMatchObject({ id: idOf(HELLO), text: null, at: { base: 'HELLO_MAIN', head: 'HELLO_TEXTE' } }), { timeout: 10_000 });
});

it('en Relire, un fichier ajouté par un commit : avant null, après et tête par git, le disque jamais lu', async () => {
  const { followCode } = await import('app/controllers');
  const NEW = 'src/core/hello/new.ts';
  write(path.join(dir, NEW), 'NEW_COMMIT');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'new');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  write(path.join(root, 'vibecoder-out', 'a1', 'pr-7.json'),
    JSON.stringify({ number: 7, title: 'Essai', base: 'main', head: 'feat/0.11.0-essai', state: 'OPEN' }));
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null,
    vibe: { flow: 'review', autonomy: 'guide', pr: 7 } }]);
  await resurvey();
  const view = panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as { commits: { subject: string; files: string[] }[] };
  const rank = view.commits.findIndex((c) => c.subject === 'new');
  const id = `c${rank}/${view.commits[rank].files.indexOf(NEW)}`;
  write(path.join(dir, NEW), 'NEW_DISQUE');
  followCode(id);
  await pushedFor(id);
  expect(codes().at(-1)).toMatchObject({
    id, text: 'NEW_COMMIT', at: { base: null, head: 'NEW_COMMIT', commit: { before: null, after: 'NEW_COMMIT' } },
  });
  write(path.join(dir, NEW), 'NEW_DISQUE_2');
  await settle();
  expect(JSON.stringify(codes())).not.toContain('NEW_DISQUE');
});

// L'id `b<i>` du fichier que change la branche, dans le dernier relevé.
const branchId = (rel: string) => {
  const view = panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as { files: { id: string; path: string }[] };
  return view.files.find((f) => f.path === rel)!.id;
};

it('un fichier b<i> de la branche : lu avec at (base, tête), enregistrable en créateur', async () => {
  const { followCode, saveCode } = await import('app/controllers');
  const OTHER = 'src/other/x.ts';
  write(path.join(dir, OTHER), 'X_BRANCHE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'other');
  await resurvey();
  const id = branchId(OTHER);
  followCode(id);
  await pushedFor(id);
  expect(codes().at(-1)).toMatchObject({ id, text: 'X_BRANCHE', at: { base: null, head: 'X_BRANCHE' } });
  expect(saveCode(id, 'X_OK')).toEqual({ ok: true });
  expect(fs.readFileSync(path.join(dir, OTHER), 'utf8')).toBe('X_OK');
});

it('un fichier b<i> supprimé par la branche : text null, ses versions par git, pas de veilleur', async () => {
  const { followCode } = await import('app/controllers');
  const OTHER = 'src/other/y.ts';
  git(dir, 'checkout', '-q', 'main');
  write(path.join(dir, OTHER), 'Y_MAIN');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'y');
  git(dir, 'checkout', '-q', 'feat/0.11.0-essai');
  git(dir, 'rebase', '-q', 'main');
  git(dir, 'rm', '-q', OTHER);
  git(dir, 'commit', '-q', '-m', 'sans y');
  await resurvey();
  const id = branchId(OTHER);
  followCode(id);
  await pushedFor(id);
  expect(codes().at(-1)).toMatchObject({ id, text: null, at: { base: 'Y_MAIN', head: null } });
  const n = codes().length;
  write(path.join(dir, OTHER), 'Y_REVENU');
  await settle();
  expect(codes().length).toBe(n);
});

it('en Relire, un fichier b<i> se lit mais saveCode le refuse', async () => {
  const { followCode, saveCode } = await import('app/controllers');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  write(path.join(root, 'vibecoder-out', 'a1', 'pr-7.json'),
    JSON.stringify({ number: 7, title: 'Essai', base: 'main', head: 'feat/0.11.0-essai', state: 'OPEN' }));
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null,
    vibe: { flow: 'review', autonomy: 'guide', pr: 7 } }]);
  await resurvey();
  const id = branchId(HELLO);
  followCode(id);
  await pushedFor(id);
  expect(codes().at(-1)).toMatchObject({ id, text: 'HELLO_TEXTE', at: { base: 'HELLO_MAIN', head: 'HELLO_TEXTE' } });
  expect(saveCode(id, 'HELLO_REVIEW').ok).toBe(false);
  expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_TEXTE');
});

// ── Déplacés de invariants/module-code.test.ts (0.15.0) ──
// Le panneau est déjà ouvert (beforeEach) : `resurvey` relit le relevé après un changement de réglages.

// L'id que le dernier relevé donne à la note ; sans id, le cas ne peut pas commencer.
function noteId() {
  const n = survey().note;
  if (!n) throw new Error('le relevé ne donne aucune note');
  return n.id;
}
// Les textes de fichier poussés à la page (null : trop gros ou illisible, pas un texte).
const texts = () => codes().flatMap((c) => (c && c.text !== null ? [c.text] : []));
// Le rang d'un module dans le dernier relevé (VibeArgs.module).
const rankOf = (modulePath: string) => survey().modules.findIndex((m) => m.path === modulePath);

// L'agent en Relire, sur la PR 7 : la branche d'essai, chargée à sa référence
// locale (comme par le skill charger-pr), sa fiche dans les sorties de l'agent.
function review() {
  git(dir, 'update-ref', 'refs/vibecoder/pr/7', 'HEAD');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  write(path.join(root, 'vibecoder-out', 'a1', 'pr-7.json'),
    JSON.stringify({ number: 7, title: 'Essai', base: 'main', head: BRANCH, state: 'OPEN' }));
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null,
    vibe: { flow: 'review', autonomy: 'guide', pr: 7 } }]);
}

// La page suit un fichier (l'accordéon déplié sur lui ; null : replié).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

// Un clic sur une action de l'écran (Générer ce module, Générer les modules restants…).
async function click(id: string, args: object = {}) {
  await press(id, args);
  await settle();
}

// Un message envoyé à la conversation par le champ : un tour commence.
async function ask(text: string) {
  const { sendDraft } = await import('app/controllers');
  sendDraft({ text });
  await settle();
}

it('le relevé ne donne aucun fichier à un module que la branche ne touche pas', async () => {

  const autre = survey().modules.find((m) => m.path === 'src/core/autre')!;

  // aucun id à suivre pour ce module
  expect(autre.files).toEqual([]);
});

it('le relevé liste les fichiers d’un module touché, sans leur texte', async () => {

  const sent = JSON.stringify(survey());

  // témoin : le fichier touché est bien listé, par son chemin
  expect(survey().modules.flatMap((m) => m.files ?? []).map((f) => f.path)).toContain(HELLO);
  // son texte n'y est pas
  expect(sent).not.toContain('HELLO_TEXTE');
  // celui de l'autre fichier touché non plus
  expect(sent).not.toContain('GREET_TEXTE');
});

it('l’id de la note, en Créer : son texte est poussé à la page', async () => {

  await follow(survey().note!.id);

  // la page reçoit la note telle qu'elle est sur le disque
  expect(texts()).toContain(fs.readFileSync(path.join(dir, NOTE), 'utf8'));
});

// Relire : la PR d'un autre, sa note ne se lit pas pour être modifiée.
it('l’id de la note, en Relire : rien n’est lu', async () => {
  review();
  await resurvey();

  await follow(noteId());

  // aucun texte de fichier poussé
  expect(texts()).toEqual([]);
});

it('l’id du dossier d’un module que la branche ne touche pas : rien n’est lu', async () => {

  await follow(survey().modules.find((m) => m.path === 'src/core/autre')!.file!.id);

  // aucun texte de fichier poussé
  expect(texts()).toEqual([]);
});

it('un autre fichier du module, changé sur le disque, n’est pas lu : seul l’ouvert l’est', async () => {
  await follow(idOf(HELLO));

  write(path.join(dir, GREET), 'GREET_CHANGE');
  await settle();

  // le nouveau texte de l'autre fichier n'est jamais poussé
  expect(JSON.stringify(codes())).not.toContain('GREET_CHANGE');
  // son ancien texte non plus
  expect(JSON.stringify(codes())).not.toContain('GREET_TEXTE');
});

it('l’accordéon replié (null) : le fichier changé sur le disque n’est plus lu', async () => {
  await follow(idOf(HELLO));
  await follow(null);

  write(path.join(dir, HELLO), 'HELLO_CHANGE');
  await settle();

  // le nouveau texte n'est jamais poussé
  expect(JSON.stringify(codes())).not.toContain('HELLO_CHANGE');
});

it('une course qui génère ce module : Enregistrer est refusé', async () => {
  const { saveCode } = await import('app/controllers');
  await follow(idOf(HELLO));
  await click('module', { module: rankOf('src/core/hello') });

  const result = await saveCode(idOf(HELLO), 'HELLO_ENREGISTRE');

  // la page apprend que rien n'a été enregistré
  expect(result.ok).toBe(false);
});

it('une course qui génère les modules restants : Enregistrer est refusé', async () => {
  const { saveCode } = await import('app/controllers');
  await follow(idOf(HELLO));
  await click('modules');

  const result = await saveCode(idOf(HELLO), 'HELLO_ENREGISTRE');

  // la page apprend que rien n'a été enregistré
  expect(result.ok).toBe(false);
});

it('un tour de la conversation en cours : Enregistrer est refusé', async () => {
  const { saveCode } = await import('app/controllers');
  await follow(idOf(HELLO));
  await ask('corrige hello');

  const result = await saveCode(idOf(HELLO), 'HELLO_ENREGISTRE');

  // la page apprend que rien n'a été enregistré
  expect(result.ok).toBe(false);
});
