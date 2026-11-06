// Invariant de l'entrée des commandes (runCommand), note 0.15.0
// (docs/tickets/feat/0.15.0-executeur.md), « Ce que ça ne doit pas faire » :
// exécuter une commande sans les gardes de l'écran — deux actions qui écrivent
// en même temps (I-44), une action pas proposée ou grisée au relevé, un
// argument que l'écran refuserait. À la porte agent comme à la porte écran.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, les actions et la table des commandes
// livrées dans resources/) ; faux : Electron (fenêtres qui relèvent ce qu'on
// leur envoie) et le SDK de Claude Code (chaque message reçu ouvre un tour, qui
// dure jusqu'à interrupt()). Le harnais est celui de runs.test.ts (I-44 au clic
// et par l'orchestrateur).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Les boutons de l'écran passent par le socket (0.15.0) : ouvert comme au lancement, fermé après chaque cas.
let closeSocket = () => {};
import { slow } from '../slow';

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
const settle = () => new Promise((r) => setTimeout(r, slow(300)));
// Les skills des tours en cours.
const inProgress = () => fake.turns.filter((t) => !t.done).map((t) => t.skill);

// Deux actions qui modifient la branche, une lecture (resources/vibecoder/actions.fr.json).
const FORME = '/vibecoder:forme';
const INVARIANTS = '/vibecoder:invariants';
const PONYTAIL = '/vibecoder:ponytail';
// La branche du dépôt d'essai ; le commit d'une branche d'un dépôt.
const head = () => git(path.join(fake.userData, 'projet'), 'rev-parse', '--abbrev-ref', 'HEAD').toString().trim();
const commit = (dir: string, ref = 'HEAD') => git(dir, 'rev-parse', ref).toString().trim();

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
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', autonomy: 'guide', pr: null } }],
  }));
});
afterEach(() => { closeSocket(); closeSocket = () => {}; vi.useRealTimers(); });

// Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
async function open() {
  const { openConversation } = await import('app/windows');
  const { panelReady, openSocket, commandFromSocket, closeSocket: close } = await import('app/controllers');
  await openSocket(commandFromSocket);
  closeSocket = close;
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

// Une commande passée à l'entrée pour le robot a1, comme le fera une porte.
async function command(name: string, args: object = {}, door: 'agent' | 'screen' = 'agent') {
  const { runCommand } = await import('app/controllers');
  const { loadConfig } = await import('app/settings');
  const agent = loadConfig().agents.find((a) => a.id === 'a1')!;
  const res = await runCommand(agent, { command: name, args, door });
  await settle();
  return res;
}

// Une action du dernier relevé du robot.
async function shown(id: string) {
  const { lastView } = await import('app/controllers');
  return lastView('a1')?.actions.find((a) => a.id === id);
}

describe('par l’entrée, deux actions qui écrivent ne sont jamais en cours ensemble (I-44)', () => {
  it('deux run.start de suite à la porte agent : seule la première travaille', async () => {
    await open();

    await command('run.start', { action: 'forme' });
    const second = await command('run.start', { action: 'invariants' });

    // la seconde est refusée
    expect(second.ok).toBe(false);
    // la Forme travaille, les invariants ne sont pas partis
    expect(inProgress()).toEqual([FORME]);
  });

  it('deux run.start de suite à la porte écran : seule la première travaille', async () => {
    await open();

    await command('run.start', { action: 'forme' }, 'screen');
    const second = await command('run.start', { action: 'invariants' }, 'screen');

    // la seconde est refusée
    expect(second.ok).toBe(false);
    // la Forme travaille, les invariants ne sont pas partis
    expect(inProgress()).toEqual([FORME]);
  });

  it('cliquée à l’écran puis demandée à l’entrée : seule la première travaille', async () => {
    await open();

    await click('forme');
    await settle();
    const asked = await command('run.start', { action: 'invariants' });

    // la demande est refusée
    expect(asked.ok).toBe(false);
    // la Forme du clic travaille, les invariants ne sont pas partis
    expect(inProgress()).toEqual([FORME]);
  });

  it('demandée à l’entrée puis cliquée à l’écran : seule la première travaille', async () => {
    await open();

    await command('run.start', { action: 'forme' });
    await click('invariants');
    await settle();

    // la Forme de l'entrée travaille, le clic n'a rien lancé
    expect(inProgress()).toEqual([FORME]);
  });

  it('une modification puis une lecture, à l’entrée : seule la modification travaille', async () => {
    await open();

    await command('run.start', { action: 'forme' });
    const read = await command('run.start', { action: 'ponytail' });

    // la lecture est refusée
    expect(read.ok).toBe(false);
    // la Forme travaille, Ponytail review n'est pas partie
    expect(inProgress()).toEqual([FORME]);
  });

  it('une lecture puis une modification, à l’entrée : seule la lecture travaille', async () => {
    await open();

    await command('run.start', { action: 'ponytail' });
    const write = await command('run.start', { action: 'forme' });

    // la modification est refusée
    expect(write.ok).toBe(false);
    // Ponytail review travaille, la Forme n'est pas partie
    expect(inProgress()).toEqual([PONYTAIL]);
  });

  // Arrêtée sans que l'utilisateur ait choisi Garder ou Annuler : ce qu'elle a écrit peut encore être annulé.
  it('une course arrêtée à l’entrée, pas encore tranchée : une autre modification ne part pas', async () => {
    await open();
    await command('run.start', { action: 'forme' });
    await command('run.stop', { action: 'forme' });

    const asked = await command('run.start', { action: 'invariants' });

    // la demande est refusée
    expect(asked.ok).toBe(false);
    // les invariants n'ont jamais été envoyés à Claude Code
    expect(fake.turns.map((t) => t.skill)).not.toContain(INVARIANTS);

    // témoin : une fois la Forme gardée, la même demande part (c'était bien elle qui retenait)
    await command('run.keep', { action: 'forme' });
    await command('run.start', { action: 'invariants' });
    expect(inProgress()).toEqual([INVARIANTS]);
  });

  it('une course qui modifie la branche en cours : un changement de branche demandé à l’entrée ne se fait pas', async () => {
    await open();
    await command('run.start', { action: 'forme' });
    const before = head();

    const asked = await command('switch-branch', { branch: 'main' });

    // la demande est refusée
    expect(asked.ok).toBe(false);
    // le dossier est resté sur la branche de la Forme
    expect(head()).toBe(before);
  });

  // Une action directe tient le dépôt tant que sa commande git tourne : ici un changement de branche que le hook
  // post-checkout du dépôt d'essai fait durer.
  it('une action directe en cours (changer de branche) : une course qui modifie la branche, demandée à l’entrée, ne part pas', async () => {
    const dir = path.join(fake.userData, 'projet');
    write(path.join(dir, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\nsleep 3\n');
    fs.chmodSync(path.join(dir, '.git', 'hooks', 'post-checkout'), 0o755);
    await open();
    // témoin : au relevé, Aller sur la branche est proposée et pas grisée
    expect(await shown('switch-branch')).toMatchObject({ hidden: false, disabled: null });

    // la Forme demandée pendant que git change de branche
    const [, asked] = await Promise.all([
      command('switch-branch', { branch: 'main' }),
      settle().then(() => command('run.start', { action: 'forme' })),
    ]);

    // la demande est refusée
    expect(asked.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(fake.turns).toEqual([]);
  }, slow(10_000));   // le hook tient git 3 s
});

describe('par l’entrée, une action pas proposée ou grisée au relevé ne part pas', () => {
  it('une action absente du relevé (une lecture du relecteur, en créateur) : rien n’est envoyé', async () => {
    await open();
    // témoin : le relevé du créateur ne la propose pas
    expect(await shown('review-note')).toBeUndefined();

    const res = await command('run.start', { action: 'review-note' });

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(fake.turns).toEqual([]);
  });

  it('une action masquée au relevé (les réponses, sans question ouverte) : rien n’est envoyé', async () => {
    await open();
    // témoin : le relevé la masque
    expect((await shown('answers'))?.hidden).toBe(true);

    const res = await command('run.start', { action: 'answers', answers: ['oui'] });

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(fake.turns).toEqual([]);
  });

  it('Vibe grisée au relevé (la note pas validée) : rien n’est envoyé, le mode Vibe ne démarre pas', async () => {
    const { vibeOn } = await import('app/controllers');
    await open();
    // témoin : le relevé la grise
    expect((await shown('vibe'))?.disabled).toBeTruthy();

    const res = await command('vibe');

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(fake.turns).toEqual([]);
    // le mode Vibe n'est pas en cours
    expect(vibeOn('a1')).toBe(false);
  });

  it('Tirer grisée au relevé (déjà à jour) : un commit poussé depuis n’est pas tiré', async () => {
    const dir = path.join(fake.userData, 'projet');
    const remote = path.join(fake.userData, 'origine.git');
    git(fake.userData, 'init', '-q', '--bare', remote);
    git(dir, 'remote', 'add', 'origin', remote);
    git(dir, 'push', '-q', '-u', 'origin', 'feat/0.9.0-essai');
    await open();
    // témoin : au relevé, la branche est à jour, Tirer est grisée
    expect((await shown('pull'))?.disabled).toBeTruthy();
    // un commit poussé sur l'origine après le relevé
    const other = path.join(fake.userData, 'autre');
    git(fake.userData, 'clone', '-q', '-b', 'feat/0.9.0-essai', remote, other);
    git(other, 'commit', '-q', '--allow-empty', '-m', 'ailleurs');
    git(other, 'push', '-q');
    const before = commit(dir);

    const res = await command('pull');

    // refusée
    expect(res.ok).toBe(false);
    // la branche locale n'a pas bougé
    expect(commit(dir)).toBe(before);
  });

  it('Pousser masquée au relevé : rien n’arrive sur l’origine', async () => {
    const dir = path.join(fake.userData, 'projet');
    const remote = path.join(fake.userData, 'origine.git');
    git(fake.userData, 'init', '-q', '--bare', remote);
    git(dir, 'remote', 'add', 'origin', remote);
    git(dir, 'push', '-q', '-u', 'origin', 'feat/0.9.0-essai');
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'à pousser');
    await open();
    // témoin : le relevé la masque
    expect((await shown('push'))?.hidden).toBe(true);
    const before = commit(remote, 'feat/0.9.0-essai');

    const res = await command('push');

    // refusée
    expect(res.ok).toBe(false);
    // l'origine n'a rien reçu
    expect(commit(remote, 'feat/0.9.0-essai')).toBe(before);
  });
});

describe('par l’entrée, un argument que l’écran refuserait ne passe pas', () => {
  it('le rang d’un module que la Forme n’a pas : rien n’est envoyé', async () => {
    await open();

    const res = await command('run.start', { action: 'module', module: 99 });

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(fake.turns).toEqual([]);
  });

  it('un texte au-delà de la borne de la table : rien n’est envoyé', async () => {
    const { parseCommands } = await import('core/commands');
    const table = parseCommands(fs.readFileSync(path.join(process.cwd(), 'resources/vibecoder/commands.json'), 'utf8'));
    const max = table.commands.find((c) => c.name === 'run.start')!.args.properties!.text.maxLength!;
    await open();

    // un caractère de trop
    const res = await command('run.start', { action: 'note', text: 'x'.repeat(max + 1) });

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(fake.turns).toEqual([]);
  });

  it('une branche qui n’est pas au relevé : le dossier ne change pas de branche', async () => {
    const dir = path.join(fake.userData, 'projet');
    await open();
    // créée après le relevé : git la connaît, le relevé non
    git(dir, 'branch', 'apres');
    const before = head();

    const res = await command('switch-branch', { branch: 'apres' });

    // refusée
    expect(res.ok).toBe(false);
    // le dossier est resté sur sa branche
    expect(head()).toBe(before);
  });

  it('une option à la place d’une branche : le dossier ne change pas de branche', async () => {
    await open();
    const before = head();

    const res = await command('switch-branch', { branch: '--orphan=x' });

    // refusée
    expect(res.ok).toBe(false);
    // le dossier est resté sur sa branche
    expect(head()).toBe(before);
  });
});
