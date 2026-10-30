// Invariant de la fin d'une course (note 0.13.0,
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 1, « Ce que ça ne doit pas
// faire ») : fermer une course pendant que le tour réveillé par une tâche de fond
// travaille ou va commencer — du travail perdu, sans que rien ne le dise.
// L'enchaînement observé (agents.log, les 20, 29 et 30 octobre) : le rapport du dernier
// sous-agent arrive pendant un tour et attend dans la file ; ce tour finit, le compteur
// de tâches est déjà à 0 ; le tour qui lit le rapport commence 0,4 à 4,4 s après.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, runtime des agents, fenêtres, état, réglages et
// fichiers sur disque, git réel sur un dépôt d'essai, les actions livrées dans
// resources/) ; faux : Electron et le SDK de Claude Code, qui fait sortir de son flux ce
// que le cas lui dit (tâches, début et fin de tour, comme le SDK les émet) et relève
// quand son entrée se ferme : c'est la fermeture du processus de la course.
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
  // Un processus de Claude Code, vu par son premier message : emit(m) fait sortir m de son
  // flux ; finish(texte) finit le tour en cours ; closed : son entrée a été fermée ;
  // interrupted : on lui a demandé d'interrompre son tour.
  type Proc = {
    text: string; closed: boolean; interrupted: boolean;
    finish: (reply: string) => void; emit: (m: Record<string, unknown>) => void;
  };
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], procs: [] as Proc[], session: 0 };
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
    query: ({ prompt }: { prompt: AsyncIterable<{ message: { content: unknown } }> }) => {
      const inbox: (Record<string, unknown> | null)[] = [];
      let wake = () => {};
      const push = (m: Record<string, unknown> | null) => { inbox.push(m); wake(); };
      let proc: (typeof fake.procs)[number] | null = null;
      void (async () => {
        for await (const m of prompt) {
          proc ??= {
            text: String(m.message.content), closed: false, interrupted: false, emit: push,
            finish: (r) => push({ type: 'result', subtype: 'success', is_error: false, result: r }),
          };
          if (!fake.procs.includes(proc)) fake.procs.push(proc);
        }
        if (proc) proc.closed = true;
        push(null);
      })();
      return Object.assign((async function* run() {
        yield { type: 'system', subtype: 'init', session_id: `s${++fake.session}` };
        for (;;) {
          while (!inbox.length) await new Promise<void>((ok) => { wake = ok; });
          const m = inbox.shift()!;
          if (m === null) return;
          yield m;
        }
      }()), {
        setPermissionMode: async () => {}, setModel: async () => {},
        interrupt: async () => { if (proc) proc.interrupted = true; },
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
const proc = (start: string) => fake.procs.find((p) => p.text.startsWith(start));
const actionsJson = () => JSON.parse(fs.readFileSync(path.join(out, 'actions.json'), 'utf8'));
// L'état de la course de la Forme, tel que l'orchestrateur le lit.
const state = () => actionsJson().runs.find((r: { id: string }) => r.id === 'forme').state as string;
// L'avis de fin : une conversation à part, qui reçoit « VibeCoder : … terminée ».
const notice = () => proc('VibeCoder');
let out = '';

// Le flux d'une tâche de fond, et d'un tour qui commence, comme le SDK les émet.
const started = (id: string) => ({ type: 'system', subtype: 'task_started', task_id: id, task_type: 'local_agent', description: 'sous-agent' });
const ended = (id: string) => ({ type: 'system', subtype: 'task_notification', task_id: id, status: 'completed' });
const newTurn = (text: string) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.procs = [];
  fake.session = 0;
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-last-turn-')));
  const dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', 'feat/0.13.0-essai');
  write(path.join(dir, 'docs/tickets/feat/0.13.0-essai.md'), '# 0.13.0 — essai\n\n## Ce que ça fait\n\n- un essai\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'note');
  out = path.join(fake.userData, 'vibecoder-out', 'a1');
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', autonomy: 'guide', pr: null } }],
  }));
});
// Le relevé retardé d'un cas ne doit pas lire la config du suivant.
afterEach(async () => { vi.useRealTimers(); await new Promise((r) => realSetTimeout(r, 1100)); });

// La Forme lancée au clic : son processus, au travail sur son premier tour.
async function runForme() {
  const { state: appState } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady, runVibeAction } = await import('app/controllers');
  appState.icon = new fake.Win() as never;
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await settle();
  runVibeAction('forme', {});
  await settle();
  return proc('/vibecoder:forme')!;
}
// L'horloge simulée : GRACE_MS et le délai de fermeture ne passent que par le cas.
const simulatedClock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
const elapse = async (ms: number) => { vi.advanceTimersByTime(ms); await settle(); };

describe('le rapport du dernier sous-agent est en file quand le tour finit', () => {
  it('à la fin de ce tour, la course reste en cours et son processus ouvert', async () => {
    const forme = await runForme();

    forme.emit(started('k1'));
    forme.emit(ended('k1'));
    forme.finish('Vague lancée');
    await settle();

    // son processus n'est pas fermé
    expect(forme.closed).toBe(false);
    // l'orchestrateur la voit encore en cours
    expect(state()).toBe('running');
    // aucun avis de fin n'est parti
    expect(notice()).toBeUndefined();
  });

  // 4,4 s, le plus long des écarts relevés ; ici, le plus long que la règle permette.
  it('le tour qui lit le rapport commence juste avant la fin du délai : il n’est pas coupé', async () => {
    const { GRACE_MS } = await import('core/vibecoder');
    const forme = await runForme();
    simulatedClock();
    forme.emit(started('k1'));
    forme.emit(ended('k1'));
    forme.finish('Vague lancée');
    await settle();

    await elapse(GRACE_MS - 1);
    forme.emit(newTurn('Je lis le rapport'));
    await settle();

    // son processus n'est pas fermé
    expect(forme.closed).toBe(false);
    // son tour n'est pas interrompu
    expect(forme.interrupted).toBe(false);
    // l'orchestrateur la voit encore en cours
    expect(state()).toBe('running');
  });

  // Il dépasse le délai de grâce et les 5 s de la fermeture forcée : c'est ce qui le tuait.
  it('le tour qui lit le rapport dure bien plus que le délai : il n’est toujours pas coupé', async () => {
    const { GRACE_MS } = await import('core/vibecoder');
    const forme = await runForme();
    simulatedClock();
    forme.emit(started('k1'));
    forme.emit(ended('k1'));
    forme.finish('Vague lancée');
    await settle();
    forme.emit(newTurn('Je lis le rapport'));
    await settle();

    await elapse(GRACE_MS * 3);

    // son processus n'est pas fermé
    expect(forme.closed).toBe(false);
    // son tour n'est pas interrompu
    expect(forme.interrupted).toBe(false);
    // l'orchestrateur la voit encore en cours
    expect(state()).toBe('running');
    // aucun avis de fin n'est parti
    expect(notice()).toBeUndefined();
  });

  it('ce tour fini, la course finit avec sa réponse, pas celle du tour d’avant', async () => {
    const forme = await runForme();
    forme.emit(started('k1'));
    forme.emit(ended('k1'));
    forme.finish('Vague lancée');
    await settle();
    forme.emit(newTurn('Je lis le rapport'));
    await settle();

    forme.finish('Tous les modules sont faits');
    await settle();

    // témoin : c'est ce tour-ci qui ferme le processus (le harnais voit bien une fermeture)
    expect(forme.closed).toBe(true);
    // l'orchestrateur la voit finie, avec la réponse de ce tour
    expect(actionsJson().runs).toMatchObject([{ id: 'forme', state: 'done', reply: 'Tous les modules sont faits' }]);
    // l'avis de fin porte cette réponse
    expect(notice()?.text).toContain('Tous les modules sont faits');
    // l'avis de fin ne porte pas la réponse du tour d'avant
    expect(notice()?.text).not.toContain('Vague lancée');
  });

  it('deux sous-agents finis pendant le même tour : le tour suivant n’est pas coupé', async () => {
    const { GRACE_MS } = await import('core/vibecoder');
    const forme = await runForme();
    simulatedClock();
    forme.emit(started('k1'));
    forme.emit(started('k2'));
    forme.emit(ended('k1'));
    forme.emit(ended('k2'));
    forme.finish('Vague lancée');
    await settle();

    forme.emit(newTurn('Je lis les rapports'));
    await settle();
    await elapse(GRACE_MS * 3);

    // son processus n'est pas fermé
    expect(forme.closed).toBe(false);
    // son tour n'est pas interrompu
    expect(forme.interrupted).toBe(false);
  });
});

describe('les vagues s’enchaînent : chaque tour réveillé peut en réveiller un autre', () => {
  // Le rythme d'une génération : des sous-agents lancés au tour d'avant, finis l'un hors
  // tour, l'autre pendant le tour que le premier a réveillé.
  it('un sous-agent du tour d’avant, fini pendant le tour réveillé par l’autre : le tour suivant n’est pas coupé', async () => {
    const { GRACE_MS } = await import('core/vibecoder');
    const forme = await runForme();
    simulatedClock();
    forme.emit(started('k1'));
    forme.emit(started('k2'));
    forme.finish('Deux sous-agents lancés');
    await settle();
    forme.emit(ended('k1'));
    forme.emit(newTurn('Je lis le premier rapport'));
    await settle();
    forme.emit(ended('k2'));
    forme.finish('Le premier est lu');
    await settle();

    forme.emit(newTurn('Je lis le second rapport'));
    await settle();
    await elapse(GRACE_MS * 3);

    // son processus n'est pas fermé
    expect(forme.closed).toBe(false);
    // son tour n'est pas interrompu
    expect(forme.interrupted).toBe(false);
    // l'orchestrateur la voit encore en cours
    expect(state()).toBe('running');
  });

  it('le tour réveillé lance et voit finir un autre sous-agent : le tour d’après n’est pas coupé', async () => {
    const { GRACE_MS } = await import('core/vibecoder');
    const forme = await runForme();
    simulatedClock();
    forme.emit(started('k1'));
    forme.emit(ended('k1'));
    forme.finish('Première vague');
    await settle();
    forme.emit(newTurn('Je lance la seconde vague'));
    await settle();
    forme.emit(started('k2'));
    forme.emit(ended('k2'));
    forme.finish('Seconde vague');
    await settle();

    forme.emit(newTurn('Je lis le dernier rapport'));
    await settle();
    await elapse(GRACE_MS * 3);

    // son processus n'est pas fermé
    expect(forme.closed).toBe(false);
    // son tour n'est pas interrompu
    expect(forme.interrupted).toBe(false);
    // l'orchestrateur la voit encore en cours
    expect(state()).toBe('running');
  });
});
