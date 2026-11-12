// Variants des actions qui courent à part (note 0.9.0) : l'avis de fin à
// l'orchestrateur (gardé tant que la conversation travaille), une course finie
// seulement quand ses tâches de fond le sont (sans limite de temps) et, tombées à 0 hors
// tour, après le délai de grâce ou le tour qu'elles réveillent (note fix/0.9.0-reveil-
// apres-tache-de-fond, F-115 ; horloge simulée), l'arrêt demandé au
// processus de la course, la boîte aux lettres retirée (0.15.0 : <sorties>/actions/ plus lu, actions.json plus écrit ; la
// demande en file part au relevé ou à la fin de la course qui retenait), answers qui reprend la session de la note, le module qu'une
// course retient (note 0.11.0), le signal des courses sur le robot, effacé par l'onglet
// Actions, vu d'office quand il est ouvert (note fix/0.11.0-vibecoder-invariants-existants-et-courses) ;
// le mode Vibe (note 0.12.0) : arrêté, la course finit, rien de nouveau ne part ; une question de
// questions.md le garde ; un relevé forcé avant de le quitter (les ✓) ; ⏹ le met au repos ; en mémoire.
// Deux avis d'un coup : le second attend que le premier soit parti.
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, les actions livrées dans resources/) ;
// faux : Electron et le SDK de Claude Code (chaque message reçu ouvre un tour,
// que le cas finit, ou qui finit à interrupt()).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  // Chaque tour : son message, les options de son processus, s'il est fini ; finish(texte) le finit ; emit(m)
  // fait sortir un message du flux de son processus (une tâche de fond…), pendant le tour ou après.
  type Turn = {
    text: string; options: Record<string, unknown>; done: boolean; interrupted: boolean;
    finish: (reply: string) => void; emit: (m: Record<string, unknown>) => void;
  };
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], turns: [] as Turn[], session: 0 };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

// Le flux d'un processus : ce qui est mis dans sa boîte (null : son entrée fermée, il sort).
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options: Record<string, unknown> }) => {
      const inbox: (Record<string, unknown> | null)[] = [];
      let wake = () => {};
      const push = (m: Record<string, unknown> | null) => { inbox.push(m); wake(); };
      let current: (typeof fake.turns)[number] | null = null;
      void (async () => {
        for await (const m of prompt) {
          current = {
            text: String(m.message.content), options, done: false, interrupted: false, emit: push,
            finish: (r) => push({ type: 'result', subtype: 'success', is_error: false, result: r }),
          };
          fake.turns.push(current);
        }
        push(null);
      })();
      return Object.assign((async function* run() {
        yield { type: 'system', subtype: 'init', session_id: `s${++fake.session}` };
        for (;;) {
          while (!inbox.length) await new Promise<void>((ok) => { wake = ok; });
          const m = inbox.shift()!;
          if (m === null) return;
          if (m.type === 'result') current!.done = true;
          yield m;
        }
      }()), {
        setPermissionMode: async () => {}, setModel: async () => {},
        interrupt: async () => {
          if (!current || current.done) return;
          current.interrupted = true;
          push({ type: 'result', subtype: 'error_during_execution', is_error: true });
        },
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
// Le vrai setTimeout, pris avant toute horloge simulée : attendre les fichiers même quand elle est posée.
const realSetTimeout = globalThis.setTimeout;
const settle = () => new Promise((r) => realSetTimeout(r, slow(300)));
const turn = (start: string) => fake.turns.find((t) => t.text.startsWith(start));
// Le tour d'une nouvelle demande (une action de la conversation qui lit {{text}}, sans étape) : son gabarit finit par le texte.
const request = (text: string) => fake.turns.find((t) => t.text.startsWith('/vibecoder:nouvelle-demande') && t.text.endsWith(` ${text}`));
// Les courses de l'agent, comme le relevé les montre (runsOf).
const runsNow = async () => (await import('app/controllers')).runsOf({ id: 'a1' });
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
    agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null,
      vibe: { flow: 'create', autonomy: 'guide', pr: null } }],
  }));
});
// Chaque cas recharge les modules, mais le relevé retardé (THROTTLE_MS) des anciens reste armé : il lirait la
// config du cas suivant (même fake.userData) et traiterait ses demandes, ses avis perdus dans l'ancienne
// conversation. Il tombe ici, dans son cas.
afterEach(async () => { closeSocket(); closeSocket = () => {}; vi.useRealTimers(); await new Promise((r) => realSetTimeout(r, 1100)); });

// Les boutons de l'écran passent par le socket (0.15.0) : ouvert comme au lancement, sur la vraie porte de l'écran.
let closeSocket = () => {};
async function open() {
  const { openConversation } = await import('app/windows');
  const { panelReady, openSocket, commandFromSocket, closeSocket: close } = await import('app/controllers');
  await openSocket(commandFromSocket);
  closeSocket = close;
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await settle();
  return import('app/controllers');
}

// L'orchestrateur demande par la porte de son robot (le jeton du robot a1 : l'appelant) ; rend la réponse de l'exécuteur.
async function ask(command: string, args: object = {}) {
  const { commandFromSocket } = await import('app/controllers');
  const res = await commandFromSocket({ cmd: command, args, token: '', target: '' }, 'a1');
  await settle();
  return res;
}

describe('la fin d’une course', () => {
  it('l’avis part à la conversation, gardé tant qu’elle travaille ; la course fermée, aucun actions.json écrit', async () => {
    const { runVibeAction, runsOf } = await open();
    runVibeAction('new-request', { text: 'une question' });
    runVibeAction('forme', {});
    await settle();

    turn('/vibecoder:forme')!.finish('Forme posée');
    await settle();
    // la conversation travaille : rien de plus ne lui est envoyé
    expect(fake.turns.filter((t) => t.text.startsWith('VibeCoder'))).toEqual([]);
    expect(runsOf({ id: 'a1' })).toMatchObject([{ id: 'forme', state: 'done', reply: 'Forme posée', reads: false }]);
    expect(fs.existsSync(path.join(out, 'actions.json'))).toBe(false);

    request('une question')!.finish('réponse');
    await settle();
    // libre : l'avis part, dans sa conversation (pas de suivi des fichiers : ce n'est pas une course)
    const notice = turn('VibeCoder');
    expect(notice?.text).toMatch(/^VibeCoder : « .+ » terminée — Forme posée\.$/);
    expect(notice?.options.enableFileCheckpointing).toBeUndefined();
  });

  it('deux fins d’un coup : le second avis attend que le premier soit parti, aucun perdu', async () => {
    const { startRun } = await open();
    const { loadConfig, vibeActions } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    const cfg = loadConfig();
    const defs = vibeActions(vibeLang(cfg));
    const agent = agentList(cfg)[0];
    for (const id of ['ponytail', 'ci']) startRun(agent, defs.find((d) => d.id === id)!, { text: `/vibecoder:${id}`, images: [] }, cfg);
    await settle();
    turn('/vibecoder:ponytail')!.finish('a');
    turn('/vibecoder:ci')!.finish('b');
    await settle();
    const notices = () => fake.turns.filter((t) => t.text.startsWith('VibeCoder'));
    expect(notices()).toHaveLength(1);

    notices()[0].finish('vu');
    await settle();
    expect(notices()).toHaveLength(2);
    expect(notices().map((t) => t.text).join('\n')).toMatch(/— a\.[\s\S]*— b\.|— b\.[\s\S]*— a\./);
  });

  it('sa course : un processus à part, suivi des fichiers, modèle et effort de son skill, sinon de l’agent', async () => {
    const { runVibeAction } = await open();
    runVibeAction('forme', {});
    await settle();
    expect(turn('/vibecoder:forme')!.options).toMatchObject({ enableFileCheckpointing: true, model: 'opus', effort: 'high' });
  });

  it('elle retient le module qu’elle génère (note 0.11.0), null par défaut', async () => {
    const { startRun, lockingRuns } = await open();
    const { loadConfig, vibeActions } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    const cfg = loadConfig();
    const defs = vibeActions(vibeLang(cfg));
    const agent = agentList(cfg)[0];
    expect(startRun(agent, defs.find((d) => d.id === 'module')!, { text: '/vibecoder:module src/a.ts', images: [] }, cfg, 'src/a.ts')).toEqual({ ok: true });
    expect(lockingRuns('a1')).toEqual([{ id: 'module', reads: false, module: 'src/a.ts' }]);
  });

  it('sans module donné : null', async () => {
    const { startRun, lockingRuns } = await open();
    const { loadConfig, vibeActions } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    const cfg = loadConfig();
    const def = vibeActions(vibeLang(cfg)).find((d) => d.id === 'forme')!;
    expect(startRun(agentList(cfg)[0], def, { text: '/vibecoder:forme', images: [] }, cfg)).toEqual({ ok: true });
    expect(lockingRuns('a1')).toEqual([{ id: 'forme', reads: false, module: null }]);
  });
});

// commit.md : effacé par l'appli à la fin d'une course Commit dont le commit est passé (HEAD a bougé), plus par une règle du skill.
describe('Commit : commit.md effacé par l’appli', () => {
  async function commitRun() {
    const { startRun } = await open();
    const { loadConfig, vibeActions } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    const cfg = loadConfig();
    const agent = agentList(cfg)[0];
    write(path.join(out, 'commit.md'), 'feat: x\n');
    startRun(agent, vibeActions(vibeLang(cfg)).find((d) => d.id === 'commit')!, { text: '/vibecoder:commit fr out', images: [] }, cfg);
    await settle();
    return agent.dir;
  }

  it('le commit est passé : commit.md effacé à la fin de la course', async () => {
    const dir = await commitRun();
    write(path.join(dir, 'x.txt'), 'x');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'feat: x');
    turn('/vibecoder:commit')!.finish('abc feat: x');
    await settle();
    expect(fs.existsSync(path.join(out, 'commit.md'))).toBe(false);
  });

  it('rien commité (un hook a refusé) : commit.md reste', async () => {
    await commitRun();
    turn('/vibecoder:commit')!.finish('hook refusé');
    await settle();
    expect(fs.readFileSync(path.join(out, 'commit.md'), 'utf8')).toBe('feat: x\n');
  });

  it('une autre course qui finit : commit.md reste, même si HEAD a bougé', async () => {
    const { runVibeAction } = await open();
    write(path.join(out, 'commit.md'), 'feat: x\n');
    runVibeAction('forme', {});
    await settle();
    git(path.join(fake.userData, 'projet'), 'commit', '-q', '--allow-empty', '-m', 'autre');
    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(fs.existsSync(path.join(out, 'commit.md'))).toBe(true);
  });
});

// Une course refusée par une autre rend la clé de son refus (note 0.15.0) : reason (lockCode) et by, à côté de son texte.
describe('startRun retenue : reason et by', () => {
  const refused = async (first: string, second: string) => {
    const { startRun } = await open();
    const { loadConfig, vibeActions } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    const cfg = loadConfig();
    const defs = vibeActions(vibeLang(cfg));
    const agent = agentList(cfg)[0];
    const go = (id: string) => startRun(agent, defs.find((d) => d.id === id)!, { text: `/vibecoder:${id}`, images: [] }, cfg);
    expect(go(first)).toEqual({ ok: true });
    return go(second);
  };

  it('same : la même action ; by, elle', async () => {
    expect(await refused('forme', 'forme')).toEqual({ ok: false, error: 'Cette action est déjà en cours', reason: 'same', by: 'forme' });
  });

  it('busy : une modification devant une course ; by, celle qui court', async () => {
    expect(await refused('ponytail', 'forme')).toEqual({ ok: false, error: 'Une autre action est en cours', reason: 'busy', by: 'ponytail' });
  });

  it('changing : une lecture devant une modification ; by, la modification', async () => {
    expect(await refused('forme', 'checks')).toEqual({ ok: false, error: 'Une action modifie la branche', reason: 'changing', by: 'forme' });
  });

  it('partie : ni reason ni by', async () => {
    expect(await refused('ponytail', 'checks')).toEqual({ ok: true });
  });
});

// Une course en sous-contexte (note fix/0.13.0-fix-and-improvements, sujet 11) : rien en arrière-plan, et le dire si ça arrive.
describe('une course dont le skill a context: fork', () => {
  const start = async (id: string, head: string) => {
    const { startRun } = await open();
    const { loadConfig, vibeActions, vibePluginDir } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    write(path.join(vibePluginDir(), 'skills', id, 'SKILL.md'), `---\nname: ${id}\n${head}---\n`);
    const cfg = loadConfig();
    const def = vibeActions(vibeLang(cfg)).find((d) => d.id === id)!;
    expect(startRun(agentList(cfg)[0], def, { text: `/vibecoder:${id}`, images: [] }, cfg)).toEqual({ ok: true });
    await settle();
    return turn(`/vibecoder:${id}`)!;
  };
  // La commande de fond finit (son état final) une fois le tour fini, puis le délai de grâce passe.
  const endsWith = async (ci: Awaited<ReturnType<typeof start>>, status: string) => {
    const { GRACE_MS } = await import('core/vibecoder');
    ci.emit({ type: 'system', subtype: 'task_started', task_id: 'b1', task_type: 'local_bash', description: 'les mutants' });
    ci.finish('Les mutants tournent encore');
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    ci.emit({ type: 'system', subtype: 'task_notification', task_id: 'b1', status });
    await settle();
    vi.advanceTimersByTime(GRACE_MS + 1);
    vi.useRealTimers();
    await settle();
  };

  it('part sans tâches de fond, le reste de l’environnement gardé', async () => {
    const env = (await start('ci', 'context: fork\n')).options.env as Record<string, string>;
    expect(env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS).toBe('1');
    expect(env.PATH).toBe(process.env.PATH);
    expect(env.VIBECODER_TOKEN).toBe((await import('app/controllers')).robotToken('a1'));   // le jeton de son robot, aussi
  });

  it('sans fork : l’environnement du robot (son jeton), sans cette variable', async () => {
    const { robotToken } = await import('app/controllers');
    // Le robot recopie process.env : lancé depuis une action forkée, il porte déjà la variable. Départ d'un environnement propre.
    const had = process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS;
    delete process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS;
    try {
      const env = (await start('ci', '')).options.env as Record<string, string>;
      expect(env.VIBECODER_TOKEN).toBe(robotToken('a1'));
      expect(env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS).toBeUndefined();
    } finally {
      if (had !== undefined) process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS = had;
    }
  });

  it('une commande de fond coupée à sa fin : en échec, sa réponse le dit en tête', async () => {
    const { cutLine } = await import('core/vibecoder');
    await endsWith(await start('ci', 'context: fork\n'), 'stopped');
    expect((await runsNow())).toMatchObject([{ id: 'ci', state: 'failed', reply: `${cutLine(1, 'fr')}\nLes mutants tournent encore` }]);
  });

  it('une commande de fond finie normalement : la course finit bien', async () => {
    await endsWith(await start('ci', 'context: fork\n'), 'completed');
    expect((await runsNow())).toMatchObject([{ id: 'ci', state: 'done', reply: 'Les mutants tournent encore' }]);
  });

  it('sans fork, une commande de fond coupée : la course finit comme avant', async () => {
    await endsWith(await start('ci', ''), 'stopped');
    expect((await runsNow())).toMatchObject([{ id: 'ci', state: 'done' }]);
  });
});

// Le flux d'une tâche de fond, comme le SDK l'émet.
const taskStarted = { type: 'system', subtype: 'task_started', task_id: 'k1', task_type: 'local_agent', description: 'sous-agent' };
const taskDone = { type: 'system', subtype: 'task_notification', task_id: 'k1', status: 'completed' };

describe('une course n’est finie que quand son travail l’est', () => {
  it('son tour fini, des tâches de fond encore en cours : en cours, sans limite de temps', async () => {
    const { runVibeAction, runsOf } = await open();
    runVibeAction('forme', {});
    await settle();
    const forme = turn('/vibecoder:forme')!;

    forme.emit(taskStarted);
    forme.finish('Wave 1 is running');
    await settle();
    // une heure passe : rien ne la coupe
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    vi.advanceTimersByTime(60 * 60 * 1000);
    vi.useRealTimers();
    await settle();

    // toujours en cours : pas de fin, ni d'avis à la conversation (pourtant libre)
    expect(runsOf({ id: 'a1' })).toMatchObject([{ id: 'forme', state: 'running', end: null }]);
    expect(turn('VibeCoder')).toBeUndefined();
    // elle retient encore
    expect(await runVibeAction('invariants', {})).toMatchObject({ ok: false });
  });

  it('ses tâches de fond finies sans tour qui suive : en cours pendant le délai de grâce, finie après avec la réponse de son tour', async () => {
    const { GRACE_MS } = await import('core/vibecoder');
    const { runVibeAction } = await open();
    runVibeAction('forme', {});
    await settle();
    const forme = turn('/vibecoder:forme')!;
    forme.emit({ ...taskStarted, task_type: 'local_bash' });   // une commande de fond : un sous-agent fini sans tour qui le relise ferait échouer la course (unreadAgents)
    forme.finish('Wave 1 is running');
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    forme.emit(taskDone);
    await settle();
    // l'agent ne repart pas : le délai de grâce s'écoule, à une milliseconde près
    vi.advanceTimersByTime(GRACE_MS - 1);
    await settle();

    // avant la fin du délai : toujours en cours, sans avis à la conversation
    expect((await runsNow())).toMatchObject([{ id: 'forme', state: 'running', end: null }]);
    expect(turn('VibeCoder')).toBeUndefined();

    vi.advanceTimersByTime(1);
    vi.useRealTimers();
    await settle();

    // le délai passé : finie, avec la réponse de son dernier tour
    expect((await runsNow())).toMatchObject([{ id: 'forme', state: 'done', reply: 'Wave 1 is running' }]);
    // l'avis de fin part à la conversation, avec cette réponse
    expect(turn('VibeCoder')?.text).toMatch(/terminée — Wave 1 is running\./);
  });

  it('ses tâches de fond finies, l’agent repart : en cours jusqu’à la fin de ce tour, puis finie avec sa réponse', async () => {
    const { GRACE_MS } = await import('core/vibecoder');
    const { runVibeAction } = await open();
    runVibeAction('forme', {});
    await settle();
    const forme = turn('/vibecoder:forme')!;
    forme.emit(taskStarted);
    forme.finish('Wave 1 is running');
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    // la tâche finit et l'agent repart aussitôt de lui-même (un nouveau tour)
    forme.emit(taskDone);
    forme.emit({ type: 'assistant', message: { content: [{ type: 'text', text: 'Je regarde la CI' }] } });
    await settle();
    // le tour réveillé dure plus que le délai de grâce
    vi.advanceTimersByTime(GRACE_MS * 2);
    vi.useRealTimers();
    await settle();

    // pendant ce tour : toujours en cours, sans avis à la conversation
    expect((await runsNow())).toMatchObject([{ id: 'forme', state: 'running', end: null }]);
    expect(turn('VibeCoder')).toBeUndefined();

    forme.finish('La CI a échoué');
    await settle();

    // ce tour fini, sans tâche de fond : finie, avec la réponse de ce tour (son processus a vécu jusque-là)
    expect((await runsNow())).toMatchObject([{ id: 'forme', state: 'done', reply: 'La CI a échoué' }]);
    // l'avis de fin porte cette réponse
    expect(turn('VibeCoder')?.text).toMatch(/terminée — La CI a échoué\./);
  });

  it('une course ne demande rien, tâches de fond ou non : mode dontAsk, en cours, aucune demande dans le relevé', async () => {
    const { runVibeAction } = await open();
    runVibeAction('forme', {});
    await settle();
    const forme = turn('/vibecoder:forme')!;
    forme.emit(taskStarted);
    await settle();

    expect(forme.options.permissionMode).toBe('dontAsk');
    expect(await runsNow()).toMatchObject([{ id: 'forme', state: 'running' }]);
  });
});

describe('l’avancement d’une course (note 0.13.0)', () => {
  it('modules : la vague, les sous-agents finis et le total d’au départ, gardés après sa fin ; une autre action : aucun', async () => {
    const { GRACE_MS } = await import('core/vibecoder');
    const { startRun, runsOf } = await open();
    const { loadConfig, vibeActions } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    const cfg = loadConfig();
    const defs = vibeActions(vibeLang(cfg));
    const agent = agentList(cfg)[0];
    expect(startRun(agent, defs.find((d) => d.id === 'modules')!, { text: '/vibecoder:modules', images: [] }, cfg)).toEqual({ ok: true });
    await settle();
    const modules = turn('/vibecoder:modules')!;

    modules.emit({ type: 'assistant', message: { id: 'm1', content: [{ type: 'tool_use', id: 't1', name: 'Agent', input: { model: 'opus' } }] } });
    modules.emit(taskStarted);
    modules.finish('fini');
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    modules.emit(taskDone);
    await settle();
    vi.advanceTimersByTime(GRACE_MS);
    vi.useRealTimers();
    await settle();

    // en échec : son sous-agent a fini sans qu'aucun tour relise sa réponse (unreadAgents)
    expect(runsOf(agent)).toMatchObject([{ id: 'modules', state: 'failed', total: 0, progress: { wave: 1, done: 1, total: 0, fixes: 0, opus: true } }]);

    expect(startRun(agent, defs.find((d) => d.id === 'forme')!, { text: '/vibecoder:forme', images: [] }, cfg)).toEqual({ ok: true });
    expect(runsOf(agent).find((r) => r.id === 'forme')?.progress).toBeUndefined();
  });

  it('modules : le processus meurt en cours de course, l’avancement atteint reste', async () => {
    const { GRACE_MS } = await import('core/vibecoder');
    const { startRun, runsOf } = await open();
    const { loadConfig, vibeActions } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    const cfg = loadConfig();
    const agent = agentList(cfg)[0];
    expect(startRun(agent, vibeActions(vibeLang(cfg)).find((d) => d.id === 'modules')!, { text: '/vibecoder:modules', images: [] }, cfg)).toEqual({ ok: true });
    await settle();
    const modules = turn('/vibecoder:modules')!;
    modules.emit({ type: 'assistant', message: { id: 'm1', content: [{ type: 'tool_use', id: 't1', name: 'Agent', input: {} }] } });
    modules.emit(taskStarted);
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    modules.emit(null as never); // le flux se ferme : le processus est mort, ses tâches avec lui
    await settle();
    vi.advanceTimersByTime(GRACE_MS);
    vi.useRealTimers();
    await settle();
    expect(runsOf(agent)).toMatchObject([{ id: 'modules', state: 'failed', progress: { wave: 1, done: 0 } }]);
  });
});

describe('arrêter une course', () => {
  it('la demande d’arrêt part à son processus, pas à la conversation ; arrêtée, elle retient encore', async () => {
    const { runVibeAction, vibeRunOp } = await open();
    runVibeAction('new-request', { text: 'une question' });
    runVibeAction('forme', {});
    await settle();

    vibeRunOp('forme', 'stop');
    await settle();

    expect(turn('/vibecoder:forme')!.interrupted).toBe(true);
    expect(request('une question')!.done).toBe(false);
    expect((await runsNow())).toMatchObject([{ id: 'forme', state: 'stopped' }]);
    expect(await runVibeAction('invariants', {})).toMatchObject({ ok: false });
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

describe('la boîte aux lettres retirée', () => {
  it('un <out>/actions/forme.start posé : rien ne part, le fichier reste', async () => {
    const { refreshVibe } = await open();
    write(path.join(out, 'actions', 'forme.start'), '{}');
    await refreshVibe({ now: true });
    await settle();
    expect(turn('/vibecoder:forme')).toBeUndefined();
    expect(fs.existsSync(path.join(out, 'actions', 'forme.start'))).toBe(true);
  });

  it('une demande en file : partie au relevé qui suit la fin de la course qui retenait', async () => {
    const { runVibeAction } = await open();
    runVibeAction('forme', {});
    await settle();

    expect(await ask('run.start', { action: 'invariants', text: 'les cas' })).toEqual({ ok: true, result: { queued: true, by: 'forme' } });
    expect(turn('/vibecoder:invariants')).toBeUndefined();

    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(turn('/vibecoder:invariants')?.text).toMatch(/ les cas$/);
  });

  it('une demande en file, le mode Vibe arrêté après coup : elle ne part pas à la fin de la course', async () => {
    const { runVibeAction, queueStart, queuedOf, vibeStart, vibeStop, vibeHalted } = await open();
    vibeStart({ id: 'a1' });
    runVibeAction('forme', {});
    await settle();
    vibeStop({ id: 'a1' });
    expect(vibeHalted('a1')).toBe(true);
    queueStart({ id: 'a1' }, 'invariants', {}, 'forme');   // glissée dans la file après l'arrêt

    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(turn('/vibecoder:invariants')).toBeUndefined();
    expect(queuedOf('a1')).toEqual([]);
  });

  it('une demande qui n’a pas à attendre (une action inconnue) : refusée tout de suite, jamais en file', async () => {
    const { queuedOf } = await open();
    expect(await ask('run.start', { action: 'rien' })).toMatchObject({ ok: false });
    expect(queuedOf('a1')).toEqual([]);
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
  expect(await runVibeAction('answers', { answers: ['oui'] })).toEqual({ ok: true });
  await settle();
  expect(turn('Réponses')?.options.resume).toBe(session);
});

// L'utilisateur est parti sur un autre écran : l'agent n'est plus l'affiché (ses courses finies ne sont plus vues d'office).
const away = async () => { (await import('app/state')).state.convView = null; };

describe('le signal des courses', () => {
  it('finie onglet fermé, agent pas affiché : signale, jusqu’à l’ouverture de l’onglet Actions', async () => {
    const { runVibeAction, runSignalOf, runsTab } = await open();
    runVibeAction('forme', {});
    await settle();
    expect(runSignalOf('a1')).toBe('working');   // en cours : travaille
    await away();
    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(runSignalOf('a1')).toBe('done');
    runsTab('a1');
    expect(runSignalOf('a1')).toBeNull();
  });

  it('onglet ouvert sur l’agent : vue d’office, pas de signal ; arrêtée : pas de signal', async () => {
    const { runVibeAction, runSignalOf, runsTab, vibeRunOp } = await open();
    runsTab('a1');
    runVibeAction('forme', {});
    await settle();
    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(runSignalOf('a1')).toBeNull();

    runsTab(null);
    runVibeAction('invariants', {});
    await settle();
    vibeRunOp('invariants', 'stop');
    await settle();
    expect(runSignalOf('a1')).toBeNull();
  });
});

// Le questionnaire sur le signal (note 0.15.0) : <sorties>/questions.md, lu à chaque appel, met le « ? » tant qu'il a une question.
describe('le signal des courses : le questionnaire', () => {
  const file = () => path.join(out, 'questions.md');

  it('une question dans questions.md, aucune course : asking', async () => {
    const { runSignalOf } = await open();
    expect(runSignalOf('a1')).toBeNull();
    write(file(), '## 1. Une question ?\n');
    expect(runSignalOf('a1')).toBe('asking');
  });

  it('plusieurs questions : asking', async () => {
    const { runSignalOf } = await open();
    write(file(), '## 1. Une ?\n- oui\n\n## 2. Deux ?\n');
    expect(runSignalOf('a1')).toBe('asking');
  });

  it('une course qui écrit une question et finit terminée : asking, pas done', async () => {
    const { runVibeAction, runSignalOf } = await open();
    runVibeAction('forme', {});
    await settle();
    await away();
    write(file(), '## 1. Une question ?\n');
    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(runSignalOf('a1')).toBe('asking');
  });

  it('questions.md vidé : le signal d’avant, done si la course finie n’est pas vue', async () => {
    const { runVibeAction, runSignalOf } = await open();
    runVibeAction('forme', {});
    await settle();
    await away();
    write(file(), '## 1. Une question ?\n');
    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    write(file(), '');
    expect(runSignalOf('a1')).toBe('done');
  });

  it('questions.md vidé sans course : rien', async () => {
    const { runSignalOf } = await open();
    write(file(), '## 1. Une question ?\n');
    expect(runSignalOf('a1')).toBe('asking');
    write(file(), '');
    expect(runSignalOf('a1')).toBeNull();
  });

  it('absent, vide, sans titre de question, ou illisible (un dossier) : aucune question', async () => {
    const { runSignalOf } = await open();
    expect(runSignalOf('a1')).toBeNull();
    write(file(), '');
    expect(runSignalOf('a1')).toBeNull();
    write(file(), 'du texte sans question\n- une puce\n');
    expect(runSignalOf('a1')).toBeNull();
    fs.rmSync(file());
    fs.mkdirSync(file());
    expect(runSignalOf('a1')).toBeNull();
  });

  it('une course qui travaille : le « ? » prime sur elle', async () => {
    const { runVibeAction, runSignalOf } = await open();
    runVibeAction('forme', {});
    await settle();
    expect(runSignalOf('a1')).toBe('working');
    write(file(), '## 1. Une question ?\n');
    expect(runSignalOf('a1')).toBe('asking');
  });

  it('le robot suit : une question écrite pendant un tour de la conversation, il le dit à la fin du tour, et plus quand elle est vidée', async () => {
    const { runVibeAction } = await open();
    const activity = () => {
      const sent = fake.windows.at(-1)!.sent.filter(([ch]) => ch === 'agents:state');
      return ((sent.at(-1)![1] as { agents: { id: string; activity: string }[] }).agents.find((a) => a.id === 'a1'))!.activity;
    };
    runVibeAction('new-request', { text: 'une question' });
    await settle();
    write(file(), '## 1. Une question ?\n');
    request('une question')!.finish('ok');
    await settle();
    expect(activity()).toBe('asking');

    turn('VibeCoder')?.finish('vu');
    runVibeAction('new-request', { text: 'encore' });
    await settle();
    write(file(), '');
    request('encore')!.finish('ok');
    await settle();
    expect(activity()).not.toBe('asking');
  });
});

describe('le signal des courses : T-18, une pastille que rien à l’écran n’efface', () => {
  it('l’agent affiché : une course qui finit sous ses yeux ne laisse pas de pastille verte, l’onglet Actions jamais ouvert', async () => {
    const { runVibeAction, runSignalOf } = await open();   // a1 est l'agent affiché
    runVibeAction('forme', {});
    await settle();
    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(runSignalOf('a1')).toBeNull();
  });

  it('garde de non-régression : une course oubliée (closeRuns) puis finie : aucun signal, ni de course', async () => {
    const { runVibeAction, runSignalOf, runsOf, closeRuns } = await open();
    runVibeAction('forme', {});
    await settle();
    closeRuns({ id: 'a1' });
    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(runsOf({ id: 'a1' })).toEqual([]);
    expect(runSignalOf('a1')).toBeNull();
  });
});

describe('afficher l’agent, lire sa conversation (runsShown)', () => {
  it('ses courses finies vues : la pastille verte s’efface ; une course en échec garde son signal', async () => {
    const { runVibeAction, runSignalOf, runsShown } = await open();
    runVibeAction('forme', {});
    await settle();
    await away();
    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(runSignalOf('a1')).toBe('done');
    runsShown('a1');
    expect(runSignalOf('a1')).toBeNull();

    (await import('app/state')).state.convView = { agentId: 'a1', sessionId: null };   // de retour : l'action part de l'agent affiché
    runVibeAction('forme', {});
    await settle();
    await away();
    const forme = fake.turns.filter((x) => x.text.startsWith('/vibecoder:forme')).at(-1)!;
    forme.emit({ type: 'result', subtype: 'error_during_execution', is_error: true });   // son tour échoue
    await settle();
    expect(runSignalOf('a1')).toBe('failed');
    runsShown('a1');
    expect(runSignalOf('a1')).toBe('failed');
  });

  it('une course qui attend ou qui travaille : inchangée', async () => {
    const { runVibeAction, runSignalOf, runsShown } = await open();
    runVibeAction('forme', {});
    await settle();
    runsShown('a1');
    expect(runSignalOf('a1')).toBe('working');
  });

  it('runsShown d’un agent sans course : rien', async () => {
    const { runsShown, runSignalOf } = await open();
    runsShown('inconnu');
    expect(runSignalOf('inconnu')).toBeNull();
  });
});

describe('runTasksOf : les tâches de fond de ses courses vivantes', () => {
  it('une course dont une tâche de fond court : 1 ; finie : 0 ; sans course : 0', async () => {
    const { runVibeAction, runTasksOf } = await open();
    expect(runTasksOf('a1')).toBe(0);
    runVibeAction('forme', {});
    await settle();
    const forme = turn('/vibecoder:forme')!;
    expect(runTasksOf('a1')).toBe(0);
    forme.emit(taskStarted);
    await settle();
    expect(runTasksOf('a1')).toBe(1);
    forme.emit(taskDone);
    forme.finish('ok');
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const { GRACE_MS } = await import('core/vibecoder');
    vi.advanceTimersByTime(GRACE_MS + 1);
    vi.useRealTimers();
    await settle();
    expect(runTasksOf('a1')).toBe(0);
  });
});

// L'attente (note 0.15.0) : runEnd (run.wait) se résout à la fin de la course, en cours ou en attente puis partie ;
// queueStart met une demande en file, qui part seule quand la course qui retenait finit.
describe('l’attente : runEnd, queueStart', () => {
  const ready = async () => {
    const m = await open();
    const { loadConfig, vibeActions } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    const cfg = loadConfig();
    const defs = vibeActions(vibeLang(cfg));
    const agent = agentList(cfg)[0];
    const go = (id: string) => m.startRun(agent, defs.find((d) => d.id === id)!, { text: `/vibecoder:${id}`, images: [] }, cfg);
    return { ...m, agent, go };
  };
  const pending = (p: Promise<unknown>) => Promise.race([p.then(() => false), new Promise((r) => realSetTimeout(() => r(true), slow(100)))]);

  it('une course en cours : résolu à sa fin, son état et sa réponse', async () => {
    const { runEnd, go } = await ready();
    go('forme');
    await settle();
    const ended = runEnd('a1', 'forme');
    expect(await pending(ended)).toBe(true);
    turn('/vibecoder:forme')!.finish('Forme posée');
    expect(await ended).toEqual({ action: 'forme', state: 'done', reply: 'Forme posée' });
  });

  it('une course arrêtée : résolu à l’arrêt, state stopped', async () => {
    const { runEnd, runOp, agent, go } = await ready();
    go('forme');
    await settle();
    const ended = runEnd('a1', 'forme');
    await runOp(agent, 'forme', 'stop');
    expect(await ended).toEqual({ action: 'forme', state: 'stopped', reply: '' });
  });

  it('ni en cours ni en attente : null', async () => {
    const { runEnd } = await ready();
    expect(await runEnd('a1', 'forme')).toBeNull();
  });

  it('en attente : résolu à la fin de la course partie ensuite, pas à celle qui retenait', async () => {
    const { runEnd, queueStart, queuedOf, agent, go } = await ready();
    go('ponytail');
    await settle();
    queueStart(agent, 'forme', {}, 'ponytail');
    expect(queuedOf('a1')).toEqual([{ action: 'forme', by: 'ponytail' }]);
    const ended = runEnd('a1', 'forme');

    turn('/vibecoder:ponytail')!.finish('a');
    await settle();
    // la demande est partie seule, a quitté la file ; l'attente continue jusqu'à la fin de SA course
    expect(turn('/vibecoder:forme')).toBeDefined();
    expect(queuedOf('a1')).toEqual([]);
    expect(await pending(ended)).toBe(true);
    turn('/vibecoder:forme')!.finish('fait');
    expect(await ended).toEqual({ action: 'forme', state: 'done', reply: 'fait' });
  });

  // T-31 : le relevé du panneau s'arrête panneau caché (écran verrouillé) ; une demande en file part quand sa cause tombe, sans lui.
  it('panneau caché : la demande en file part à la fin de la course qui retenait, d’après un relevé neuf', async () => {
    const { queueStart, queuedOf, agent, go } = await ready();
    const { conversationShown } = await import('app/windows');
    write(path.join(fake.userData, 'projet', 'src.ts'), 'x\n');   // de quoi commiter : Préparer le commit est offerte
    const { refreshVibe } = await import('app/controllers');
    await refreshVibe({ now: true });   // le dernier relevé du panneau : Commiter grisé, pas de commit.md
    fake.windows.at(-1)!.hide();
    expect(conversationShown()).toBe(false);
    go('commit-prepare');   // la course part panneau caché : aucun relevé n'en suit
    await settle();
    queueStart(agent, 'commit', {}, 'commit-prepare');
    write(path.join(out, 'commit.md'), 'feat: x\n');   // ce que la course laisse : Commiter n'est permis qu'au relevé suivant

    turn('/vibecoder:commit-prepare')!.finish('ok');
    await settle();

    expect(turn('/vibecoder:commit ')).toBeDefined();
    expect(queuedOf('a1')).toEqual([]);
  });

  it('une même demande deux fois en file : une seule, elle part une fois', async () => {
    const { queueStart, queuedOf, agent, go } = await ready();
    go('ponytail');
    await settle();
    queueStart(agent, 'forme', {}, 'ponytail');
    queueStart(agent, 'forme', {}, 'ponytail');
    expect(queuedOf('a1')).toEqual([{ action: 'forme', by: 'ponytail' }]);
  });

  it('une demande que le relevé grise (Commiter sans commit.md) : elle quitte la file à la fin de la course, rien ne part', async () => {
    const { queueStart, queuedOf, runEnd, agent, go } = await ready();
    go('forme');
    await settle();
    queueStart(agent, 'commit', {}, 'forme');
    const ended = runEnd('a1', 'commit');

    turn('/vibecoder:forme')!.finish('ok');
    await settle();

    expect(await ended).toBeNull();
    expect(queuedOf('a1')).toEqual([]);
    expect(turn('/vibecoder:commit ')).toBeUndefined();
  });

  it('vibeStop : la file vidée, ce qui l’attendait rendu à null', async () => {
    const { runEnd, queueStart, queuedOf, vibeStart, vibeStop, agent, go } = await ready();
    vibeStart(agent);
    go('ponytail');
    await settle();
    queueStart(agent, 'forme', {}, 'ponytail');
    const ended = runEnd('a1', 'forme');
    vibeStop(agent);
    expect(queuedOf('a1')).toEqual([]);
    expect(await ended).toBeNull();
    turn('/vibecoder:ponytail')!.finish('a');
    await settle();
    expect(turn('/vibecoder:forme')).toBeUndefined();
  });
});

describe('le mode Vibe', () => {

  it('arrêté : la course en cours finit, la demande en file jetée, rien de nouveau ne part ; au repos, hors Vibe', async () => {
    const { runVibeAction, queuedOf, vibeOn, vibeStart, vibeStop } = await open();
    vibeStart({ id: 'a1' });
    runVibeAction('forme', {});
    await settle();
    await ask('run.start', { action: 'invariants', text: 'les cas' });   // en file derrière la Forme
    expect(queuedOf('a1')).toHaveLength(1);

    vibeStop({ id: 'a1' });
    // la bannière disparaît aussitôt ; la course n'est pas interrompue ; la demande en file jetée
    expect(vibeOn('a1')).toBe(false);
    expect(turn('/vibecoder:forme')!.interrupted).toBe(false);
    expect(queuedOf('a1')).toEqual([]);

    turn('/vibecoder:forme')!.finish('ok');
    await settle();
    expect(turn('/vibecoder:invariants')).toBeUndefined();
    const ended = turn('VibeCoder : « Poser la forme » terminée');
    expect(ended).toBeDefined();

    // la conversation finit son tour, plus rien ne vit : hors Vibe, les demandes partent comme avant
    ended!.finish('vu');
    await settle();
    await ask('run.start', { action: 'invariants', text: 'les cas' });
    expect(turn('/vibecoder:invariants')).toBeDefined();
  });

  // La demande d'autorisation de la conversation, comme Claude Code la pose (canUseTool) : accordée sans qu'on réponde ?
  async function cliAsk(command: string) {
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('new-request', { text: 'une question' });
    await settle();
    let granted = false;
    void (request('une question')!.options.canUseTool as (t: string, i: unknown, o: object) => Promise<unknown>)('Bash', { command }, {}).then(() => { granted = true; });
    await settle();
    return granted;
  }
  const cli = () => `node "${path.join(fake.userData, 'vibecoder', 'plugin')}/skills/vibe/../../bin/vibecoder.mjs" run list`;

  it('en cours : la conversation accepte d’elle-même la CLI de VibeCoder, pas une autre commande', async () => {
    const { vibeStart } = await open();
    vibeStart({ id: 'a1' });
    expect(await cliAsk(cli())).toBe(true);
    expect(await cliAsk(`${cli()} ; rm -rf x`)).toBe(false);
    expect(await cliAsk('rm -rf build')).toBe(false);
  });

  it('arrêté ou jamais lancé : la CLI est demandée comme toute commande', async () => {
    const { vibeStart, vibeStop } = await open();
    expect(await cliAsk(cli())).toBe(false);
    vibeStart({ id: 'a1' });
    vibeStop({ id: 'a1' });
    expect(await cliAsk(cli())).toBe(false);
  });

  it('en cours : une question ouverte le garde, fini seul quand la conversation finit son tour sans rien d’ouvert', async () => {
    const { refreshVibe, runVibeAction, vibeOn, vibeStart } = await open();
    runVibeAction('new-request', { text: 'une question' });
    vibeStart({ id: 'a1' });
    await settle();
    // écrite pendant le tour qui finit, sans relevé entre-temps : lue quand même
    write(path.join(out, 'questions.md'), '## 1. Une question ?\n');
    request('une question')!.finish('ok');
    await settle();
    expect(vibeOn('a1')).toBe(true);

    fs.rmSync(path.join(out, 'questions.md'));
    await refreshVibe({ now: true });
    runVibeAction('new-request', { text: 'encore' });
    await settle();
    expect(vibeOn('a1')).toBe(true);   // la conversation travaille
    request('encore')!.finish('ok');
    // fini au relevé qui suit le tour (ses lectures git, lentes sur un runner Windows)
    for (let i = 0; i < 30 && vibeOn('a1'); i++) await settle();
    expect(vibeOn('a1')).toBe(false);
  });

  it('panneau caché tout du long : un relevé forcé avant de finir, les étapes faites reçoivent leur ✓', async () => {
    const { runVibeAction, vibeOn, vibeStart } = await open();
    const { state } = await import('app/state');
    const { vibeStore } = await import('app/settings');
    runVibeAction('new-request', { text: 'une question' });
    await settle();
    state.panel!.hide();
    vibeStart({ id: 'a1' });
    request('une question')!.finish('ok');
    // fini au relevé forcé qui suit le tour (ses lectures git, lentes sur un runner Windows)
    for (let i = 0; i < 30 && vibeOn('a1'); i++) await settle();
    expect(vibeOn('a1')).toBe(false);
    expect(vibeStore().marks.a1).toHaveProperty('note');
  });

  it('la course en cours arrêtée par ⏹ : au repos, hors Vibe', async () => {
    const { runVibeAction, vibeOn, vibeRunOp, vibeStart } = await open();
    runVibeAction('forme', {});
    vibeStart({ id: 'a1' });
    await settle();
    vibeRunOp('forme', 'stop');
    // au repos au relevé qui suit l'arrêt (lent sur un runner Windows)
    for (let i = 0; i < 30 && vibeOn('a1'); i++) await settle();
    expect(turn('/vibecoder:forme')!.interrupted).toBe(true);
    expect(vibeOn('a1')).toBe(false);
  });

  it('arrêté au repos : hors Vibe aussitôt ; closeRuns l’oublie', async () => {
    const { closeRuns, vibeOn, vibeStart, vibeStop } = await open();
    vibeStart({ id: 'a1' });
    expect(vibeOn('a1')).toBe(true);
    vibeStop({ id: 'a1' });
    await ask('run.start', { action: 'forme' });
    expect(turn('/vibecoder:forme')).toBeDefined();   // pas halted : elle part

    vibeStart({ id: 'a1' });
    closeRuns({ id: 'a1' });
    expect(vibeOn('a1')).toBe(false);
  });
});

// Les droits d'une course (note 0.15.0, docs/tickets/feat/0.15.0-courses-droits.md) : ce que l'appli donne au processus
// (mode, liste, dossiers, contrôle des fichiers) et comment la course finit quand l'agent essuie des refus.
describe('les droits d’une course', () => {
  const project = () => path.join(fake.userData, 'projet');
  const skillsDir = async () => path.join((await import('app/settings')).vibePluginDir(), 'skills');
  // L'agent dans ce mode, le préfixe des actions posé : avant l'ouverture de l'appli.
  const configure = (mode: string) => {
    const file = path.join(fake.userData, 'config.json');
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    cfg.agents[0].mode = mode;
    write(file, JSON.stringify({ ...cfg, vibeCommandPrefix: 'distrobox enter dev --' }));
  };
  const skill = async (id: string, tools: string | null) =>
    write(path.join(await skillsDir(), id, 'SKILL.md'), `---\nname: ${id}\n${tools === null ? '' : `allowed-tools: "${tools}"\n`}---\n`);
  // La course de l'action `id`, lancée avec `text` : son tour.
  async function run(id: string, text = `/vibecoder:${id}`) {
    const { startRun } = await open();
    const { loadConfig, vibeActions } = await import('app/settings');
    const { agentList, vibeLang } = await import('core/config');
    const cfg = loadConfig();
    const def = vibeActions(vibeLang(cfg)).find((d) => d.id === id)!;
    expect(startRun(agentList(cfg)[0], def, { text, images: [] }, cfg)).toEqual({ ok: true });
    await settle();
    return turn(text.split(' ')[0])!;
  }
  // Le contrôle des fichiers de la course, appelé comme le SDK l'appelle avant un outil.
  type Hook = (i: object, id: string, o: { signal: AbortSignal }) => Promise<Record<string, unknown> | undefined>;
  async function verdict(t: { options: Record<string, unknown> }, tool: string, input: object) {
    const hooks = (t.options.hooks as { PreToolUse: { hooks: Hook[] }[] }).PreToolUse.flatMap((g) => g.hooks);
    const out = await Promise.all(hooks.map((h) => h({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, tool_use_id: 't' }, 't', { signal: new AbortController().signal })));
    return out.some((a) => (a?.hookSpecificOutput as Record<string, unknown> | undefined)?.permissionDecision === 'deny') ? 'deny' : 'pass';
  }
  // Le flux d'un refus de `tool` : son appel (par un sous-agent si `sub`), puis son résultat en erreur.
  const denied = (id: string, tool: string, input: object, sub = false) => [
    { type: 'assistant', parent_tool_use_id: sub ? 'tu-agent' : null, message: { id: `m-${id}`, content: [{ type: 'tool_use', id, name: tool, input }] } },
    { type: 'user', parent_tool_use_id: sub ? 'tu-agent' : null, message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: true, content: `Permission to use ${tool} has been denied.` }] } },
  ];

  it.each(['default', 'auto'])('l’agent en %s : le processus reçoit dontAsk, les outils de son skill hors Bash(…) et Bash entier ; l’AGENTS.md n’ajoute rien', async (mode) => {
    configure(mode);
    write(path.join(project(), 'AGENTS.md'), '## Commandes\n\n- Tests : `npm test`\n- Lancer : `npm start`\n');
    await skill('ci', 'Read(${CLAUDE_SKILL_DIR}/**), Bash(gh pr view *)');
    const ci = await run('ci');
    expect(ci.options.permissionMode).toBe('dontAsk');
    expect(ci.options.allowedTools).toEqual([`Read(${path.join(await skillsDir(), 'ci')}/**)`, 'Bash']);
    expect(JSON.stringify(ci.options)).not.toContain('npm test');
  });

  it('une course pr, l’agent en Auto : dontAsk, Bash en liste, git push et les gh du skill ouverts, git commit refusé', async () => {
    configure('auto');
    (await import('app/settings')).ensureVibeFiles();   // les skills livrés, tels qu'ils sont
    const pr = await run('pr');
    const deny = pr.options.disallowedTools as string[];
    expect(pr.options.permissionMode).toBe('dontAsk');
    expect(pr.options.allowedTools).toContain('Bash');
    expect(deny).not.toContain('Bash(git push *)');
    expect(deny).not.toContain('Bash(gh pr create *)');
    expect(deny).toContain('Bash(git commit *)');
    expect(deny).toContain('Bash(gh pr merge *)');
  });

  it('une course Forme : git push refusé, seul et derrière le préfixe des actions', async () => {
    configure('auto');
    (await import('app/settings')).ensureVibeFiles();
    const forme = await run('forme');
    const deny = forme.options.disallowedTools as string[];
    expect(deny).toContain('Bash(git push *)');
    expect(deny).toContain('Bash(distrobox enter dev -- git push *)');
  });

  it('la consigne d’outils : une course la reçoit en fin de prompt système, la conversation jamais', async () => {
    const { TOOL_RULE } = await import('core/agents');
    const { runVibeAction } = await open();
    runVibeAction('new-request', { text: 'une question' });
    runVibeAction('forme', {});
    await settle();
    const append = (t: { options: Record<string, unknown> }) => (t.options.systemPrompt as { append?: string }).append ?? '';
    expect(append(turn('/vibecoder:forme')!).endsWith(TOOL_RULE)).toBe(true);
    expect(append(request('une question')!)).not.toContain(TOOL_RULE);
  });

  it('answers : la liste de la note, ${VIBECODER_OUT} remplacé', async () => {
    await skill('note', 'Read, Write(${VIBECODER_OUT}/**)');
    const answers = await run('answers', 'Réponses : oui');
    expect(answers.options.allowedTools).toEqual(['Read', `Write(${out}/**)`, 'Bash']);
    expect(answers.options.disallowedTools).toEqual(expect.arrayContaining(['Bash(git push *)', 'Bash(git commit *)']));
  });

  it('une action en lecture : écrire dans le projet est refusé par le crochet, ses sorties et le projet en lecture passent', async () => {
    const ci = await run('ci');
    expect(await verdict(ci, 'Write', { file_path: path.join(project(), 'a.ts'), content: 'x' })).toBe('deny');
    expect(await verdict(ci, 'Write', { file_path: path.join(out, 'a.md'), content: 'x' })).toBe('pass');
    expect(await verdict(ci, 'Read', { file_path: path.join(project(), 'a.ts') })).toBe('pass');
  });

  it('une action qui modifie : écrire dans le projet passe, hors du projet et des sorties non', async () => {
    const forme = await run('forme');
    expect(await verdict(forme, 'Write', { file_path: path.join(project(), 'a.ts'), content: 'x' })).toBe('pass');
    expect(await verdict(forme, 'Write', { file_path: path.join(fake.userData, 'dehors.txt'), content: 'x' })).toBe('deny');
  });

  it('la course n’a que les sorties en dossier de travail ; la conversation garde le dossier des artefacts', async () => {
    const { runVibeAction, projectArtifactsPath } = await open();
    const forme = await run('forme');
    expect(forme.options.additionalDirectories).toEqual([out]);
    runVibeAction('new-request', { text: 'une question' });
    await settle();
    expect(request('une question')!.options.additionalDirectories).toEqual([out, projectArtifactsPath(project())]);
  });

  it('un skill sans allowed-tools, aucun plugin : Bash seul, tout refusé sauf lui, la course part', async () => {
    const ci = await run('ci');
    expect(ci.options.permissionMode).toBe('dontAsk');
    expect(ci.options.allowedTools).toEqual(['Bash']);
    expect(ci.options.disallowedTools).toContain('Bash(git push *)');
  });

  it('un skill sans allowed-tools : Bash seul', async () => {
    await skill('ci', null);
    expect((await run('ci')).options.allowedTools).toEqual(['Bash']);
  });

  it('un refus de Bash d’un sous-agent, hors tour : terminée, sa ligne en tête de la réponse', async () => {
    const { denialLine } = await import('core/vibecoder');
    const forme = await run('forme');
    forme.emit({ type: 'system', subtype: 'task_started', task_id: 'k1', tool_use_id: 'tu-agent', task_type: 'local_agent', description: 'dev' });
    forme.finish('Vague lancée');
    await settle();
    for (const m of denied('tu-1', 'Bash', { command: 'rm -rf /' }, true)) forme.emit(m);
    forme.emit({ type: 'system', subtype: 'task_notification', task_id: 'k1', status: 'completed' });
    forme.emit({ type: 'assistant', parent_tool_use_id: null, message: { id: 'm-tour', content: [{ type: 'text', text: 'Je relis' }] } });
    await settle();
    forme.finish('Relu');
    await settle();

    const line = denialLine([{ toolUseId: 'tu-1', tool: 'Bash', target: 'rm -rf /' }], 'fr');
    expect(await runsNow()).toMatchObject([{ id: 'forme', state: 'done', reply: `${line}\nRelu` }]);
  });

  it('un Read refusé seul : terminée, la lecture citée en tête', async () => {
    const { denialLine } = await import('core/vibecoder');
    const forme = await run('forme');
    for (const m of denied('tu-1', 'Read', { file_path: '/etc/passwd' })) forme.emit(m);
    forme.finish('Fait');
    await settle();

    const line = denialLine([{ toolUseId: 'tu-1', tool: 'Read', target: '/etc/passwd' }], 'fr');
    expect(await runsNow()).toMatchObject([{ id: 'forme', state: 'done', reply: `${line}\nFait` }]);
  });

  it('une course qui essuie un refus ne demande rien : elle reste en cours', async () => {
    const forme = await run('forme');
    for (const m of denied('tu-1', 'Bash', { command: 'ls' })) forme.emit(m);
    await settle();

    expect(await runsNow()).toMatchObject([{ id: 'forme', state: 'running' }]);
  });
});
