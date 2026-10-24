// Invariant du diff d'un fichier de module (note 0.11.0,
// docs/tickets/feat/0.11.0-stabiliser-vibecoder.md, « Ce que ça ne doit pas
// faire ») : le diff ne lit que les fichiers des modules touchés par la
// branche, désignés par leur id, jamais par un chemin venu de la page (I-37).
// Le principal pousse, avec le texte du fichier suivi, son texte à la base de
// la branche et au dernier commit (VibeCode.at) — pour ce seul fichier, d'un
// module touché (m<rang>/<i>), jamais la note ni un test. Le reste d'I-37
// (Voir le code, la note, les tests) : module-code.test.ts,
// note-and-tests-save.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai) ; faux : Electron (fenêtres qui
// relèvent ce qu'on leur envoie) et le SDK de Claude Code (chaque message reçu
// ouvre un tour, sans rien écrire, qui dure jusqu'à interrupt()). Ce que la
// page voit d'un fichier et de ses versions : les conv:vibeCode poussés au
// panneau, tous leurs champs. Même banc que module-code.test.ts.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  type Handler = (...a: unknown[]) => void;
  class Win {
    sent: [string, unknown][] = [];
    handlers = new Map<string, Handler[]>();
    visible = false;
    webContents = {
      send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); },
      on: () => {}, setWindowOpenHandler: () => {},
    };
    on(ev: string, fn: Handler) { this.handlers.set(ev, [...(this.handlers.get(ev) || []), fn]); return this; }
    once(ev: string, fn: Handler) { return this.on(ev, fn); }
    emit(ev: string) { for (const fn of this.handlers.get(ev) || []) fn(); }
    loadFile() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setResizable() {} setBounds() {}
    getBounds() { return { x: 500, y: 500, width: 64, height: 64 }; }
    isVisible() { return this.visible; } isDestroyed() { return false; } isMinimized() { return false; }
    show() { this.visible = true; } showInactive() { this.visible = true; } hide() { this.visible = false; }
    focus() { this.emit('focus'); } restore() {} minimize() { this.visible = false; }
  }
  // Chaque tour reçu par Claude Code : le skill appelé (ou le premier mot du message), et s'il est fini.
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], turns: [] as { skill: string; done: boolean }[] };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

// Claude Code : un tour par message reçu, relevé, qui ne finit qu'à interrupt().
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt }: { prompt: AsyncIterable<{ message: { content: unknown } }> }) => {
      let stop = () => {};
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          const turn = { skill: String(m.message.content).split(' ')[0], done: false };
          fake.turns.push(turn);
          await new Promise<void>((ok) => { stop = ok; });
          turn.done = true;
          yield { type: 'result', subtype: 'error_during_execution', is_error: true };
        }
      }()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => { stop(); } });
    },
  }),
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const settle = () => new Promise((r) => setTimeout(r, 300));
let dir = '';

// Ce que la page reçoit : le relevé (conv:vibe) et un fichier suivi, avec ses versions (conv:vibeCode).
type Survey = {
  note: { id: string } | null;
  invariants: { id: string; path: string }[];
  modules: { path: string; file: { id: string } | null; files: { id: string; path: string }[] }[];
};
type Code = { id: string; text: string | null; at?: { base: string | null; head: string | null } };
const panel = () => fake.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as Survey;
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as Code | null);
// Tout ce que la page a reçu des fichiers suivis : textes et versions.
const pushed = () => JSON.stringify(codes());
// Le dernier fichier poussé à la page sous cet id.
const lastCode = (id: string) => codes().filter((c) => c?.id === id).at(-1);
// L'id que le dernier relevé donne à ce fichier d'un module ; sans id, le cas ne peut pas commencer.
function idOf(rel: string) {
  const f = survey().modules.flatMap((m) => m.files ?? []).find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// L'id que le dernier relevé donne à ce test d'invariant ; sans id, le cas ne peut pas commencer.
function testId(rel: string) {
  const f = survey().invariants.find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// Le texte d'un fichier du dépôt à un commit, d'après git.
const gitText = (ref: string, rel: string) => git(dir, 'show', `${ref}:${rel}`).toString();
// Le commit où la branche part de main.
const forkPoint = () => git(dir, 'merge-base', 'main', 'HEAD').toString().trim();

const HELLO = 'src/core/hello/index.ts';
const GREET = 'src/core/hello/greet.ts';
const NOTE = 'docs/tickets/feat/0.11.0-essai.md';
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const note = (mark: string) => ['# 0.11.0 — essai', '', '## Ce que ça fait', '', `- un essai ${mark}`, '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', 'src/core/autre    autre() · ne connaît pas : le DOM', '```', ''].join('\n');

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.turns = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-module-diff-')));
  // Le dépôt : deux modules sur main ; la branche, sa note (sa Forme les nomme) et un test d'invariant, touche le premier seulement.
  dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  write(path.join(dir, HELLO), 'HELLO_MAIN');
  write(path.join(dir, GREET), 'GREET_MAIN');
  write(path.join(dir, 'src/core/autre/index.ts'), 'AUTRE_TEXTE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', 'feat/0.11.0-essai');
  write(path.join(dir, NOTE), note('NOTE_COMMIT'));
  write(path.join(dir, HELLO), 'HELLO_COMMIT');
  write(path.join(dir, GREET), 'GREET_COMMIT');
  write(path.join(dir, INV), "it('INV_COMMIT', () => {});\n");
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'hello');
  // Sur le disque, pas commité : chaque fichier suivi diffère de son dernier commit.
  write(path.join(dir, NOTE), note('NOTE_DISQUE'));
  write(path.join(dir, HELLO), 'HELLO_DISQUE');
  write(path.join(dir, INV), "it('INV_DISQUE', () => {});\n");
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', autonomy: 'guide', pr: null } }],
  }));
});
afterEach(() => { vi.useRealTimers(); });

// Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
async function open() {
  const { state } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  state.icon = new fake.Win() as never;
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await settle();
}

// La page suit un fichier (l'accordéon déplié sur lui, la note ou un test affichés ; null : replié).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

describe('le diff ne lit que le fichier suivi d’un module touché, désigné par son id (I-37)', () => {
  it('témoin : l’id d’un fichier d’un module touché, ses textes à la base de la branche et au dernier commit sont poussés', async () => {
    await open();

    await follow(idOf(HELLO));

    // la page reçoit son texte au point de départ de la branche
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // et son texte au dernier commit
    expect(lastCode(idOf(HELLO))?.at?.head).toBe(gitText('HEAD', HELLO));
  });

  it('les versions d’un autre fichier du même module ne sont pas lues : seul le suivi l’est', async () => {
    await open();

    await follow(idOf(HELLO));

    // témoin : le diff du fichier suivi est bien poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // le texte de l'autre fichier à la base de la branche n'est jamais poussé
    expect(pushed()).not.toContain('GREET_MAIN');
    // ni son texte au dernier commit
    expect(pushed()).not.toContain('GREET_COMMIT');
  });

  it('un chemin du dépôt à la place d’un id : aucune de ses versions n’est lue', async () => {
    await open();
    await follow(idOf(HELLO));

    await follow(GREET);

    // témoin : le diff du fichier suivi par son id a bien été poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // le texte du chemin à la base de la branche n'est jamais poussé
    expect(pushed()).not.toContain('GREET_MAIN');
    // ni son texte au dernier commit
    expect(pushed()).not.toContain('GREET_COMMIT');
  });

  it('l’id du dossier d’un module que la branche ne touche pas : aucune de ses versions n’est lue', async () => {
    await open();
    await follow(idOf(HELLO));

    await follow(survey().modules.find((m) => m.path === 'src/core/autre')!.file!.id);

    // témoin : le diff du fichier touché a bien été poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // le texte commité du module pas touché n'est jamais poussé
    expect(pushed()).not.toContain('AUTRE_TEXTE');
  });

  // La note se suit par son id (Créer) : son texte oui, ses versions non.
  it('la note suivie : sa version au dernier commit n’est pas lue', async () => {
    await open();
    await follow(idOf(HELLO));

    await follow(survey().note!.id);

    // témoin : le diff du fichier de module a bien été poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // témoin : la note telle qu'elle est sur le disque est poussée
    expect(lastCode(survey().note!.id)?.text).toBe(fs.readFileSync(path.join(dir, NOTE), 'utf8'));
    // sa version commitée n'est jamais poussée
    expect(pushed()).not.toContain('NOTE_COMMIT');
  });

  // Un test d'invariant se suit par son id (Créer) : son texte oui, ses versions non.
  it('un test d’invariant suivi : sa version au dernier commit n’est pas lue', async () => {
    await open();
    await follow(idOf(HELLO));

    await follow(testId(INV));

    // témoin : le diff du fichier de module a bien été poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // témoin : le test tel qu'il est sur le disque est poussé
    expect(lastCode(testId(INV))?.text).toBe(fs.readFileSync(path.join(dir, INV), 'utf8'));
    // sa version commitée n'est jamais poussée
    expect(pushed()).not.toContain('INV_COMMIT');
  });
});
