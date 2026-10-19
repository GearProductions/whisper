// Invariant des actions qui courent à part (note 0.9.0, « Ce que ça ne doit
// pas faire ») : avoir en cours en même temps deux actions qui modifient la
// branche, ou une lecture pendant une modification, qu'elles viennent d'un
// clic ou de l'orchestrateur. Une action arrêtée dont l'utilisateur n'a pas
// encore choisi Garder ou Annuler compte comme en cours.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, les actions livrées dans resources/) ;
// faux : Electron (fenêtres qui relèvent ce qu'on leur envoie) et le SDK de
// Claude Code (chaque message reçu ouvre un tour, qui dure jusqu'à interrupt()).
// L'orchestrateur demande une action comme le fait son skill : un fichier
// <sorties>/actions/<id>.start, lu au relevé.
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
  // Chaque tour reçu par Claude Code : le skill appelé, et s'il est fini ; chaque
  // rewindFiles demandé : le skill du premier message du processus qui l'a reçu.
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], turns: [] as { skill: string; done: boolean }[], rewound: [] as string[] };
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
      let first = '';   // le skill du premier message de ce processus
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          const turn = { skill: String(m.message.content).split(' ')[0], done: false };
          first ||= turn.skill;
          fake.turns.push(turn);
          await new Promise<void>((ok) => { stop = ok; });
          turn.done = true;
          yield { type: 'result', subtype: 'error_during_execution', is_error: true };
        }
      }()), {
        setPermissionMode: async () => {}, setModel: async () => {},
        interrupt: async () => { stop(); },
        rewindFiles: async () => { fake.rewound.push(first); return { canRewind: true, filesChanged: [] }; },
      });
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
// Les skills des tours en cours.
const inProgress = () => fake.turns.filter((t) => !t.done).map((t) => t.skill);
let out = '';

// Deux actions qui modifient la branche, une lecture (resources/vibecoder/actions.fr.json).
const FORME = '/vibecoder:forme';
const INVARIANTS = '/vibecoder:invariants';
const PONYTAIL = '/vibecoder:ponytail';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.turns = [];
  fake.rewound = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-runs-')));
  // Un dépôt sur une branche dont la note est écrite : la Forme, les invariants et la revue sont possibles.
  const dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', 'feat/0.9.0-essai');
  write(path.join(dir, 'docs/tickets/feat/0.9.0-essai.md'), '# 0.9.0 — essai\n\n## Ce que ça fait\n\n- un essai\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'note');
  out = path.join(fake.userData, 'vibecoder-out', 'a1');
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

// Un clic sur une action de l'écran.
async function click(id: string, args: object = {}) {
  const { runVibeAction } = await import('app/controllers');
  runVibeAction(id, args);
}

// L'orchestrateur demande des actions (son skill écrit <sorties>/actions/<id>.start), puis un relevé.
async function orchestratorAsks(...ids: string[]) {
  const { refreshVibe } = await import('app/controllers');
  for (const id of ids) write(path.join(out, 'actions', `${id}.start`), '{}');
  await refreshVibe({ now: true });
  await settle();
}

describe('deux actions qui modifient la branche ne sont jamais en cours ensemble', () => {
  it('deux clics de suite, sans relevé entre eux : seule la première travaille', async () => {
    await open();

    await click('forme');
    await click('invariants');
    await settle();

    // la Forme travaille, les invariants ne sont pas partis
    expect(inProgress()).toEqual([FORME]);
  });

  it('demandée par l’orchestrateur puis cliquée : seule la première travaille', async () => {
    await open();

    await orchestratorAsks('forme');
    await click('invariants');
    await settle();

    // la Forme de l'orchestrateur travaille, le clic n'a rien lancé
    expect(inProgress()).toEqual([FORME]);
  });

  it('deux demandes de l’orchestrateur lues au même relevé : une seule travaille', async () => {
    await open();

    await orchestratorAsks('forme', 'invariants');

    // une des deux, pas les deux (laquelle part, et ce que devient l'autre, ne relèvent pas de l'invariant)
    expect(inProgress()).toHaveLength(1);
  });

  // Arrêtée sans que l'utilisateur ait choisi Garder ou Annuler : ce qu'elle a écrit peut encore être annulé.
  it('une action arrêtée, pas encore tranchée : une autre modification ne part pas', async () => {
    const { vibeRunOp } = await import('app/controllers');
    await open();
    await click('forme');
    await settle();

    vibeRunOp('forme', 'stop');
    await settle();
    await click('invariants');
    await settle();

    // les invariants n'ont jamais été envoyés à Claude Code
    expect(fake.turns.map((t) => t.skill)).not.toContain(INVARIANTS);

    // témoin : une fois la Forme gardée, le même clic part (c'était bien elle qui retenait)
    vibeRunOp('forme', 'keep');
    await settle();
    await click('invariants');
    await settle();
    expect(inProgress()).toEqual([INVARIANTS]);
  });
});

describe('une lecture n’est jamais en cours pendant une modification', () => {
  it('une modification puis une lecture, au clic : seule la modification travaille', async () => {
    await open();

    await click('forme');
    await click('ponytail');
    await settle();

    // la Forme travaille, Ponytail review n'est pas partie
    expect(inProgress()).toEqual([FORME]);
  });

  it('une lecture puis une modification, au clic : seule la lecture travaille', async () => {
    await open();

    await click('ponytail');
    await click('forme');
    await settle();

    // Ponytail review travaille, la Forme n'est pas partie
    expect(inProgress()).toEqual([PONYTAIL]);
  });

  it('une modification au clic, une lecture demandée par l’orchestrateur : seule la modification travaille', async () => {
    await open();

    await click('forme');
    await settle();
    await orchestratorAsks('ponytail');

    // la Forme travaille, Ponytail review n'est pas partie
    expect(inProgress()).toEqual([FORME]);
  });

  // Arrêtée sans que l'utilisateur ait choisi Garder ou Annuler : ce qu'elle a écrit peut encore être annulé.
  it('une modification arrêtée, pas encore tranchée : une lecture ne part pas', async () => {
    const { vibeRunOp } = await import('app/controllers');
    await open();
    await click('forme');
    await settle();

    vibeRunOp('forme', 'stop');
    await settle();
    await click('ponytail');
    await settle();

    // Ponytail review n'a jamais été envoyée à Claude Code
    expect(fake.turns.map((t) => t.skill)).not.toContain(PONYTAIL);

    // témoin : une fois la Forme gardée, le même clic part
    vibeRunOp('forme', 'keep');
    await settle();
    await click('ponytail');
    await settle();
    expect(inProgress()).toEqual([PONYTAIL]);
  });

  it('une modification et une lecture demandées par l’orchestrateur au même relevé : une seule travaille', async () => {
    await open();

    await orchestratorAsks('forme', 'ponytail');

    // l'une ou l'autre, pas les deux (laquelle part ne relève pas de l'invariant)
    expect(inProgress()).toHaveLength(1);
  });
});

// Invariant voisin (même note) : annuler, à l'arrêt d'une action, autre chose que
// ce qu'elle a écrit. Ici, le chemin de l'écran : vibeRunOp(id, 'undo') ramène le
// processus de CETTE action, jamais la conversation ni une autre course.
describe('Annuler, depuis l’écran, ne ramène que l’action annulée', () => {
  it('la conversation travaille, une lecture a été gardée : Annuler la Forme ne ramène que la Forme', async () => {
    const { vibeRunOp } = await import('app/controllers');
    await open();
    // la conversation travaille (une question, sans étape : elle reste dans la conversation)
    await click('ask', { text: 'où en est la forme ?' });
    // une lecture, arrêtée et gardée
    await click('ponytail');
    await settle();
    vibeRunOp('ponytail', 'stop');
    await settle();
    vibeRunOp('ponytail', 'keep');
    await settle();
    // la Forme, arrêtée puis annulée
    await click('forme');
    await settle();
    vibeRunOp('forme', 'stop');
    await settle();

    vibeRunOp('forme', 'undo');
    await settle();

    // un seul retour en arrière, demandé au processus de la Forme
    expect(fake.rewound).toEqual([FORME]);
  });
});
