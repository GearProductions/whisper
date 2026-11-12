// Invariant des actions qui courent à part, un sous-agent au travail, relancé compris (note 0.15.0,
// docs/tickets/feat/0.15.0-courses-droits.md, « Ce que ça ne doit pas faire », T-32) : marquer une
// course finie (et libérer son verrou) pendant qu'un de ses sous-agents travaille, relancé compris —
// une autre action qui écrit pourrait partir pendant qu'il écrit (SPEC I-44 : jamais deux courses qui
// modifient la branche en même temps ; les autres cas d'I-44 : runs.test.ts).
// Protégé : si un test échoue, corriger le code.
//
// Le fil mesuré le 12 novembre (note, « Où ça casse ») : SendMessage vers un sous-agent fini émet un
// task_started de même task_id (son tool_use_id : celui du SendMessage, is_backgrounded vrai) ; le
// SendMessage rend aussitôt, l'agent finit son tour pendant que le sous-agent travaille ; puis sa
// notification (task_notification), qui réveille l'agent pour un tour sans message de l'appli.
//
// Sur le vrai principal (contrôleurs, runtime des agents, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, les actions livrées dans resources/), dans le décor commun
// (app/tests/harness) ; faux : Electron (le décor) et le SDK de Claude Code, ici celui du fichier, qui
// fait sortir de son flux ce que le cas lui dit (tâches, début et fin de tour, comme le SDK les émet).
// L'horloge simulée fait passer le délai de grâce qu'une course laisse au tour que réveille une tâche.
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, closeAll, fakeElectron, openPanel, orchestratorAsks, profile, repo, repoResources, slow, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);
vi.mock('technicals/paths', () => repoResources());

// Un processus de Claude Code, vu par son premier message : emit(m) fait sortir m de son flux ;
// finish(texte) finit le tour en cours.
type Proc = { text: string; finish: (reply: string) => void; emit: (m: Record<string, unknown>) => void };
const procs: Proc[] = [];
let session = 0;

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
      let proc: Proc | null = null;
      void (async () => {
        for await (const m of prompt) {
          proc ??= { text: String(m.message.content), emit: push, finish: (r) => push({ type: 'result', subtype: 'success', is_error: false, result: r }) };
          if (!procs.includes(proc)) procs.push(proc);
        }
        push(null);
      })();
      return Object.assign((async function* run() {
        yield { type: 'system', subtype: 'init', session_id: `s${++session}` };
        for (;;) {
          while (!inbox.length) await new Promise<void>((ok) => { wake = ok; });
          const m = inbox.shift()!;
          if (m === null) return;
          yield m;
        }
      }()), {
        setPermissionMode: async () => {}, setModel: async () => {},
        interrupt: async () => {},
        rewindFiles: async () => ({ canRewind: true, filesChanged: [] }),
      });
    },
  }),
}));

// Le vrai setTimeout, pris avant toute horloge simulée : attendre les fichiers même quand elle est posée.
const realSetTimeout = globalThis.setTimeout;
const settle = () => new Promise((r) => realSetTimeout(r, slow(300)));
const proc = (start: string) => procs.find((p) => p.text.startsWith(start));
let out = '';

// Le fil, comme le SDK l'émet : un appel d'outil de l'agent, puis les événements de la tâche d'un sous-agent.
const toolUse = (id: string, name: string) => ({ type: 'assistant', parent_tool_use_id: null, message: { id: `m-${id}`, content: [{ type: 'tool_use', id, name, input: {} }] } });
const started = (task: string, toolUseId: string, more: object = {}) =>
  ({ type: 'system', subtype: 'task_started', task_id: task, tool_use_id: toolUseId, task_type: 'local_agent', description: 'developpeur', ...more });
const ended = (task: string) => ({ type: 'system', subtype: 'task_notification', task_id: task, status: 'completed' });
const newTurn = (text: string) => ({ type: 'assistant', parent_tool_use_id: null, message: { id: 'm-tour', content: [{ type: 'text', text }] } });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  procs.length = 0;
  session = 0;
  const root = profile('whisper-run-relaunched-');
  repo(path.join(root, 'projet'), { branch: 'feat/0.15.0-essai', note: '# 0.15.0 — essai\n\n## Ce que ça fait\n\n- un essai\n' });
  out = path.join(root, 'vibecoder-out', 'a1');
  writeConfig(root, [{ id: 'a1', dir: path.join(root, 'projet'), name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
});
// Le relevé retardé d'un cas ne doit pas lire la config du suivant.
afterEach(async () => { closeAll(); await new Promise((r) => realSetTimeout(r, 1100)); });

// La Forme lancée au clic, l'horloge simulée posée ensuite ; son processus.
async function startForme(): Promise<Proc> {
  await openPanel('a1');
  await click('forme');
  await settle();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  return proc('/vibecoder:forme')!;
}
// Bien plus que le délai de grâce qu'une course laisse au tour que réveille une tâche.
async function pastGrace() {
  const { GRACE_MS } = await import('core/vibecoder');
  vi.advanceTimersByTime(GRACE_MS * 3);
  await settle();
}
// La Forme dont le sous-agent a fini, que l'agent relance par SendMessage (même task_id) avant de finir son tour sans
// attendre sa réponse ; le délai de grâce passé, le sous-agent travaille toujours.
async function formeWithRelaunchedAgent(): Promise<Proc> {
  const forme = await startForme();
  forme.emit(toolUse('tu-agent', 'Agent'));
  forme.emit(started('k1', 'tu-agent'));
  forme.emit(ended('k1'));
  forme.emit(toolUse('tu-send', 'SendMessage'));
  forme.emit(started('k1', 'tu-send', { is_backgrounded: true }));
  forme.finish('Correction envoyée au développeur');
  await settle();
  await pastGrace();
  return forme;
}

describe('un sous-agent au travail tient la course : rien qui modifie la branche ne part (I-44)', () => {
  // Le cas premier de la ligne : un sous-agent lancé en fond, pas encore fini quand le tour finit.
  it('la Forme, un sous-agent de fond au travail après la fin de son tour : un clic sur Écrire les invariants ne part pas', async () => {
    const forme = await startForme();
    forme.emit(toolUse('tu-agent', 'Agent'));
    forme.emit(started('k1', 'tu-agent', { is_backgrounded: true }));
    forme.finish('Vague lancée');
    await settle();
    await pastGrace();

    await click('invariants');
    await settle();

    // les invariants n'ont pas été envoyés à Claude Code
    expect(proc('/vibecoder:invariants')).toBeUndefined();
  });

  it('la Forme, son sous-agent relancé au travail : un clic sur Écrire les invariants ne part pas', async () => {
    const forme = await formeWithRelaunchedAgent();

    await click('invariants');
    await settle();

    // les invariants n'ont pas été envoyés à Claude Code
    expect(proc('/vibecoder:invariants')).toBeUndefined();
    // la Forme n'est pas marquée finie
    expect((await import('app/controllers')).runsOf({ id: 'a1' }).find((r) => r.id === 'forme')?.state).toBe('running');

    // témoin : le sous-agent fini et sa réponse relue par un tour, le même clic part (c'était bien lui qui retenait)
    forme.emit(ended('k1'));
    forme.emit(newTurn('Je relis sa correction'));
    forme.finish('Correction relue');
    await settle();
    await pastGrace();
    await click('invariants');
    await settle();
    expect(proc('/vibecoder:invariants')).toBeDefined();
  });

  it('la Forme, son sous-agent relancé au travail : l’orchestrateur demande les invariants, ils ne partent pas', async () => {
    await formeWithRelaunchedAgent();
    vi.useRealTimers(); // l'horloge rendue : la demande de l'orchestrateur attend son relevé en temps réel

    await orchestratorAsks(out, 'invariants');

    // les invariants n'ont pas été envoyés à Claude Code
    expect(proc('/vibecoder:invariants')).toBeUndefined();
  });
});
