// Variants des actions qui courent à part (note 0.9.0) : l'avis de fin à
// l'orchestrateur (gardé tant que la conversation travaille), l'arrêt demandé au
// processus de la course, les demandes de l'orchestrateur (retenue puis partie,
// invalide, arrêt), answers qui reprend la session de la note.
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, les actions livrées dans resources/) ;
// faux : Electron et le SDK de Claude Code (chaque message reçu ouvre un tour,
// que le cas finit, ou qui finit à interrupt()).
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
  // Chaque tour : son message, les options de son processus, s'il est fini ; finish(texte) le finit.
  type Turn = { text: string; options: Record<string, unknown>; done: boolean; interrupted: boolean; finish: (reply: string) => void };
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], turns: [] as Turn[], session: 0 };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options: Record<string, unknown> }) => {
      let stop = (_reply: string | null) => {};
      let current: (typeof fake.turns)[number] | null = null;
      return Object.assign((async function* run() {
        yield { type: 'system', subtype: 'init', session_id: `s${++fake.session}` };
        for await (const m of prompt) {
          const reply = await new Promise<string | null>((ok) => {
            stop = ok;
            current = { text: String(m.message.content), options, done: false, interrupted: false, finish: (r) => ok(r) };
            fake.turns.push(current);
          });
          current!.done = true;
          yield reply === null ? { type: 'result', subtype: 'error_during_execution', is_error: true }
            : { type: 'result', subtype: 'success', is_error: false, result: reply };
        }
      }()), {
        setPermissionMode: async () => {}, setModel: async () => {},
        interrupt: async () => { if (current) current.interrupted = true; stop(null); },
        rewindFiles: async () => ({ canRewind: true, filesChanged: [] }),
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
const turn = (start: string) => fake.turns.find((t) => t.text.startsWith(start));
const actionsJson = () => JSON.parse(fs.readFileSync(path.join(out, 'actions.json'), 'utf8'));
let out = '';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fake.windows = [];
  fake.turns = [];
  fake.session = 0;
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-runs-v-')));
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

async function open() {
  const { state } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  state.icon = new fake.Win() as never;
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await settle();
  return import('app/controllers');
}

async function orchestratorAsks(name: string, text = '{}') {
  const { refreshVibe } = await import('app/controllers');
  write(path.join(out, 'actions', name), text);
  await refreshVibe({ now: true });
  await settle();
}

describe('la fin d’une course', () => {
  it('l’avis part à la conversation, gardé tant qu’elle travaille ; la course fermée, dans actions.json', async () => {
    const { runVibeAction } = await open();
    runVibeAction('ask', { text: 'une question' });
    runVibeAction('forme', {});
    await settle();

    turn('/vibecoder:forme')!.finish('Forme posée');
    await settle();
    // la conversation travaille : rien de plus ne lui est envoyé
    expect(fake.turns.filter((t) => t.text.startsWith('VibeCoder'))).toEqual([]);
    expect(actionsJson().runs).toMatchObject([{ id: 'forme', state: 'done', reply: 'Forme posée', reads: false }]);

    turn('une question')!.finish('réponse');
    await settle();
    // libre : l'avis part, dans sa conversation (pas de suivi des fichiers : ce n'est pas une course)
    const notice = turn('VibeCoder');
    expect(notice?.text).toMatch(/^VibeCoder : « .+ » terminée — Forme posée\. État : .*\/actions\.json$/);
    expect(notice?.options.enableFileCheckpointing).toBeUndefined();
  });

  it('sa course : un processus à part, suivi des fichiers, modèle et effort de son skill, sinon de l’agent', async () => {
    const { runVibeAction } = await open();
    runVibeAction('forme', {});
    await settle();
    expect(turn('/vibecoder:forme')!.options).toMatchObject({ enableFileCheckpointing: true, model: 'opus', effort: 'high' });
  });
});

describe('arrêter une course', () => {
  it('la demande d’arrêt part à son processus, pas à la conversation ; arrêtée, elle retient encore', async () => {
    const { runVibeAction, vibeRunOp } = await open();
    runVibeAction('ask', { text: 'une question' });
    runVibeAction('forme', {});
    await settle();

    vibeRunOp('forme', 'stop');
    await settle();

    expect(turn('/vibecoder:forme')!.interrupted).toBe(true);
    expect(turn('une question')!.done).toBe(false);
    expect(actionsJson().runs).toMatchObject([{ id: 'forme', state: 'stopped' }]);
    expect(runVibeAction('invariants', {})).toMatchObject({ ok: false });
    expect(turn('VibeCoder')).toBeUndefined();   // arrêtée par l'utilisateur : pas une fin
  });

  it('une opération inconnue, ou une action sans course : rien', async () => {
    const { runVibeAction, vibeRunOp } = await open();
    runVibeAction('forme', {});
    await settle();
    vibeRunOp('forme', 'détruire');
    vibeRunOp('invariants', 'stop');
    await settle();
    expect(turn('/vibecoder:forme')!.interrupted).toBe(false);
  });
});

describe('les demandes de l’orchestrateur', () => {
  it('retenue : en attente avec la raison, le fichier en place ; la voie libre, elle part d’elle-même', async () => {
    const { runVibeAction } = await open();
    runVibeAction('forme', {});
    await settle();

    await orchestratorAsks('invariants.start', '{"text":"les cas"}');
    expect(turn('/vibecoder:invariants')).toBeUndefined();
    expect(actionsJson().waiting).toEqual([{ id: 'invariants', reason: expect.any(String) }]);
    expect(fs.existsSync(path.join(out, 'actions', 'invariants.start'))).toBe(true);

    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(turn('/vibecoder:invariants')?.text).toMatch(/ les cas$/);
    expect(fs.existsSync(path.join(out, 'actions', 'invariants.start'))).toBe(false);
    expect(actionsJson().waiting).toEqual([]);
  });

  it('invalide (une action de la conversation, un JSON illisible, un nom inconnu) : supprimée, rien ne part', async () => {
    await open();
    await orchestratorAsks('vibe.start', '{"text":"tout"}');
    await orchestratorAsks('forme.start', '{pas du json');
    await orchestratorAsks('rien.start');
    expect(fake.turns).toEqual([]);
    expect(fs.readdirSync(path.join(out, 'actions'))).toEqual([]);
  });

  it('un .stop arrête la course et retire un .start de la même action', async () => {
    const { runVibeAction } = await open();
    runVibeAction('forme', {});
    await settle();
    write(path.join(out, 'actions', 'ponytail.start'), '{}');   // retenue par la Forme
    await orchestratorAsks('forme.stop', '');
    await orchestratorAsks('ponytail.stop', '');

    expect(turn('/vibecoder:forme')!.interrupted).toBe(true);
    expect(turn('/vibecoder:ponytail')).toBeUndefined();
    expect(fs.readdirSync(path.join(out, 'actions'))).toEqual([]);
  });
});

it('answers reprend la session de la course de la note', async () => {
  const { runVibeAction } = await open();
  runVibeAction('note', { text: 'une note' });
  await settle();
  const session = `s${fake.session}`;
  turn('/vibecoder:note')!.finish('Note écrite, 1 question.');
  await settle();
  turn('VibeCoder')!.finish('vu');   // l'avis de fin, à la conversation
  write(path.join(out, 'questions.md'), '## 1. Une question ?\n');   // ce que la note a laissé ouvert
  await settle();

  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  expect(runVibeAction('answers', { answers: ['oui'] })).toEqual({ ok: true });
  await settle();
  expect(turn('Réponses')?.options.resume).toBe(session);
});
