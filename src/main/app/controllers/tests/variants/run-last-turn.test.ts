// Variants de la fin d'une course (note 0.13.0,
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 1, « Ce que ça ne doit pas
// faire ») : fermer une course pendant que le tour réveillé par une tâche de fond
// travaille ou va commencer — du travail perdu, sans que rien ne le dise.
// L'enchaînement observé (agents.log, les 20, 29 et 30 octobre) : le rapport du dernier
// sous-agent arrive pendant un tour et attend dans la file ; ce tour finit, le compteur
// de tâches est déjà à 0 ; le tour qui lit le rapport commence 0,4 à 4,4 s après.
// Variants : les 7 cas, tels quels (plus un invariant protégé : un comportement de la course, pas une garde).
//
// Sur le vrai principal (contrôleurs, runtime des agents, fenêtres, état, réglages et
// fichiers sur disque, git réel sur un dépôt d'essai, les actions livrées dans
// resources/), dans le décor commun (app/tests/harness) ; faux : Electron (le décor) et
// le SDK de Claude Code, ici celui du fichier, qui fait sortir de son flux ce que le cas
// lui dit (tâches, début et fin de tour, comme le SDK les émet) et relève quand son entrée
// se ferme : c'est la fermeture du processus de la course.
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, closeAll, fakeElectron, openPanel, profile, repo, repoResources, slow, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);
vi.mock('technicals/paths', () => repoResources());

// Un processus de Claude Code, vu par son premier message : emit(m) fait sortir m de son
// flux ; finish(texte) finit le tour en cours ; closed : son entrée a été fermée ;
// interrupted : on lui a demandé d'interrompre son tour.
type Proc = {
  text: string; closed: boolean; interrupted: boolean;
  finish: (reply: string) => void; emit: (m: Record<string, unknown>) => void;
};
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
          proc ??= {
            text: String(m.message.content), closed: false, interrupted: false, emit: push,
            finish: (r) => push({ type: 'result', subtype: 'success', is_error: false, result: r }),
          };
          if (!procs.includes(proc)) procs.push(proc);
        }
        if (proc) proc.closed = true;
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
        interrupt: async () => { if (proc) proc.interrupted = true; },
        rewindFiles: async () => ({ canRewind: true, filesChanged: [] }),
      });
    },
  }),
}));

// Le vrai setTimeout, pris avant toute horloge simulée : attendre les fichiers même quand elle est posée.
const realSetTimeout = globalThis.setTimeout;
const settle = () => new Promise((r) => realSetTimeout(r, slow(300)));
const proc = (start: string) => procs.find((p) => p.text.startsWith(start));
// Les courses de l'agent, et l'état de celle de la Forme, comme le relevé les montre (runsOf).
const runsNow = async () => (await import('app/controllers')).runsOf({ id: 'a1' });
const state = async () => (await runsNow()).find((r) => r.id === 'forme')!.state as string;
// L'avis de fin : une conversation à part, qui reçoit « VibeCoder : … terminée ».
const notice = () => proc('VibeCoder');

// Le flux d'une tâche de fond, et d'un tour qui commence, comme le SDK les émet.
const started = (id: string) => ({ type: 'system', subtype: 'task_started', task_id: id, task_type: 'local_agent', description: 'sous-agent' });
const ended = (id: string) => ({ type: 'system', subtype: 'task_notification', task_id: id, status: 'completed' });
const newTurn = (text: string) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  procs.length = 0;
  session = 0;
  const root = profile('whisper-last-turn-');
  repo(path.join(root, 'projet'), { branch: 'feat/0.13.0-essai', note: '# 0.13.0 — essai\n\n## Ce que ça fait\n\n- un essai\n' });
  writeConfig(root, [{ id: 'a1', dir: path.join(root, 'projet'), name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
});
// Le relevé retardé d'un cas ne doit pas lire la config du suivant.
afterEach(async () => { closeAll(); await new Promise((r) => realSetTimeout(r, 1100)); });

// La Forme lancée au clic : son processus, au travail sur son premier tour.
async function runForme() {
  await openPanel('a1');
  await click('forme');
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
    // le relevé la voit encore en cours
    expect(await state()).toBe('running');
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
    // le relevé la voit encore en cours
    expect(await state()).toBe('running');
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
    // le relevé la voit encore en cours
    expect(await state()).toBe('running');
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
    // le relevé la voit finie, avec la réponse de ce tour
    expect(await runsNow()).toMatchObject([{ id: 'forme', state: 'done', reply: 'Tous les modules sont faits' }]);
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
    // le relevé la voit encore en cours
    expect(await state()).toBe('running');
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
    // le relevé la voit encore en cours
    expect(await state()).toBe('running');
  });
});
