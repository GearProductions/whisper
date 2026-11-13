// Invariant du dossier temporaire d'une course (note 0.15.0, docs/tickets/fix/0.15.0-droits-souples.md,
// « Ce que ça ne doit pas faire ») : laisser le dossier temporaire d'une course après sa fin, ou le laisser
// dépasser sa borne sans arrêter la course (familles « bornes » : une limite configurée ; « processus » :
// rien ne survit). Sans numéro dans SPEC.md pour l'instant : la doc du ticket le pose.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, runtime des agents, fenêtres, état, réglages et fichiers sur disque, git
// réel sur un dépôt d'essai, les actions livrées dans resources/), dans le décor commun (app/tests/harness) ;
// faux : Electron (le décor) et le SDK de Claude Code, ici celui du fichier : il relève, pour chaque processus,
// son premier message et les options de son lancement (le dossier temporaire de la course : CLAUDE_CODE_TMPDIR
// de son environnement) ; son tour dure jusqu'à ce que le cas le finisse (succès ou échec) ou que l'appli
// l'interrompe. Une fuite de la course est jouée par le cas, qui écrit dans ce dossier comme le ferait une
// commande de la course. La borne (runTmpMax, config.json) est posée à quelques octets ; l'horloge simulée
// fait passer les mesures du dossier.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, closeAll, fakeElectron, openPanel, profile, repo, repoResources, slow, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);
vi.mock('technicals/paths', () => repoResources());

// Un processus de Claude Code : son premier message, les options de son lancement ; end(true) finit son tour
// sur un succès, end(false) sur un échec.
type Proc = { text: string; options: Record<string, unknown>; end: (ok: boolean) => void };
const procs: Proc[] = [];

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options: Record<string, unknown> }) => {
      let end: (ok: boolean) => void = () => {};
      let proc: Proc | null = null;
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          const ok = await new Promise<boolean>((done) => {
            end = done;
            if (!proc) { proc = { text: String(m.message.content), options, end: (o) => end(o) }; procs.push(proc); }
          });
          yield ok
            ? { type: 'result', subtype: 'success', is_error: false, result: 'ok' }
            : { type: 'result', subtype: 'error_during_execution', is_error: true };
        }
      }()), {
        setPermissionMode: async () => {}, setModel: async () => {},
        interrupt: async () => { end(false); },
        rewindFiles: async () => ({ canRewind: true, filesChanged: [] }),
      });
    },
  }),
}));

// Le vrai setTimeout, pris avant toute horloge simulée : attendre les fichiers même quand elle est posée.
const realSetTimeout = globalThis.setTimeout;
const settle = () => new Promise((r) => realSetTimeout(r, slow(300)));

// La borne du dossier temporaire, en octets (runTmpMax) : quelques octets, pour l'essai ; et une fuite bien au-delà.
const SMALL_MAX = 1024;
const LEAK = Buffer.alloc(64 * 1024, 'x');
// Tous les combien l'appli mesure le dossier temporaire d'une course (RUN_TMP_EVERY_MS de la Forme : 5 s).
const MEASURE_MS = 5_000;

let root = '';     // le profil d'essai
let project = '';  // le dossier de l'agent, un dépôt git

// L'agent a1 dans config.json, plus ce que le cas ajoute (runTmpMax…).
function writeAgent(extra: object = {}): void {
  writeConfig(root, [{ id: 'a1', dir: project, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], extra);
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  procs.length = 0;
  root = profile('whisper-run-tmp-');
  project = path.join(root, 'projet');
  repo(project, { branch: 'feat/0.15.0-essai', note: '# 0.15.0 — essai\n\n## Ce que ça fait\n\n- un essai\n' });
  writeAgent();
});
// Le relevé retardé d'un cas ne doit pas lire la config du suivant.
afterEach(async () => { closeAll(); await new Promise((r) => realSetTimeout(r, 1100)); });

// La Forme lancée au clic ; son processus.
async function startForme(): Promise<Proc> {
  await openPanel('a1');
  await click('forme');
  await settle();
  const forme = procs.find((p) => p.text.startsWith('/vibecoder:forme'));
  if (!forme) throw new Error('la Forme n’est pas partie');
  return forme;
}

// Le dossier temporaire donné à la course (CLAUDE_CODE_TMPDIR de son environnement) ; aucun : un chemin du profil
// qui n'existe pas (le témoin du cas échoue, rien n'est écrit ailleurs).
function tmpOf(p: Proc): string {
  const env = (p.options.env ?? {}) as Record<string, string | undefined>;
  return env.CLAUDE_CODE_TMPDIR || path.join(root, 'aucun-dossier-temporaire-donne');
}

// L'état de la Forme, vu par l'appli.
async function formeState(): Promise<string | undefined> {
  return (await import('app/controllers')).runsOf({ id: 'a1' }).find((r) => r.id === 'forme')?.state;
}

// Plusieurs périodes de mesure du dossier passent, le disque relu après chacune.
async function pastMeasures(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await vi.advanceTimersByTimeAsync(MEASURE_MS);
    await settle();
  }
}

describe('le dossier temporaire d’une course ne survit pas à sa fin', () => {
  it('la course finit sur un succès : son dossier temporaire n’existe plus', async () => {
    const forme = await startForme();
    const tmp = tmpOf(forme);
    // témoin : la course a bien reçu un dossier temporaire, qui existe pendant qu'elle court
    expect(fs.existsSync(tmp)).toBe(true);
    // une commande de la course y a laissé un fichier
    fs.writeFileSync(path.join(tmp, 'fuite.log'), LEAK);

    forme.end(true);
    await settle();

    // témoin : la course est finie
    expect(await formeState()).toBe('done');
    // son dossier temporaire, fuite comprise, est effacé
    expect(fs.existsSync(tmp)).toBe(false);
  });

  it('la course finit en échec : son dossier temporaire n’existe plus', async () => {
    const forme = await startForme();
    const tmp = tmpOf(forme);
    // témoin : la course a bien reçu un dossier temporaire, qui existe pendant qu'elle court
    expect(fs.existsSync(tmp)).toBe(true);
    // une commande de la course y a laissé un fichier
    fs.writeFileSync(path.join(tmp, 'fuite.log'), LEAK);

    forme.end(false);
    await settle();

    // témoin : la course est finie, en échec
    expect(await formeState()).toBe('failed');
    // son dossier temporaire, fuite comprise, est effacé
    expect(fs.existsSync(tmp)).toBe(false);
  });

  it('la course arrêtée à la main : son dossier temporaire n’existe plus', async () => {
    const forme = await startForme();
    const tmp = tmpOf(forme);
    const { vibeRunOp } = await import('app/controllers');
    // témoin : la course a bien reçu un dossier temporaire, qui existe pendant qu'elle court
    expect(fs.existsSync(tmp)).toBe(true);
    // une commande de la course y a laissé un fichier
    fs.writeFileSync(path.join(tmp, 'fuite.log'), LEAK);

    vibeRunOp('forme', 'stop');
    await settle();

    // son dossier temporaire, fuite comprise, est effacé dès l'arrêt (sans attendre Garder ou Annuler)
    expect(fs.existsSync(tmp)).toBe(false);
  });

  // L'agent retiré, ou l'appli qui ferme ses courses : la course part avec lui.
  it('les courses de l’agent fermées (closeRuns) : son dossier temporaire n’existe plus', async () => {
    const forme = await startForme();
    const tmp = tmpOf(forme);
    const { closeRuns } = await import('app/controllers');
    // témoin : la course a bien reçu un dossier temporaire, qui existe pendant qu'elle court
    expect(fs.existsSync(tmp)).toBe(true);
    // une commande de la course y a laissé un fichier
    fs.writeFileSync(path.join(tmp, 'fuite.log'), LEAK);

    closeRuns({ id: 'a1' });
    await settle();

    // son dossier temporaire, fuite comprise, est effacé
    expect(fs.existsSync(tmp)).toBe(false);
  });
});

describe('le dossier temporaire d’une course ne dépasse pas sa borne sans que la course s’arrête', () => {
  beforeEach(() => {
    // l'horloge simulée, timeouts compris, qui avance aussi avec le temps réel : les mesures passent à la demande
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'], shouldAdvanceTime: true });
    // la borne, à quelques octets
    writeAgent({ runTmpMax: SMALL_MAX });
  });

  it('au-delà de la borne : la course est arrêtée', async () => {
    const forme = await startForme();
    const tmp = tmpOf(forme);
    // témoin : la course a bien reçu un dossier temporaire
    expect(fs.existsSync(tmp)).toBe(true);
    // témoin : sous la borne, les mesures passées, la course court toujours (c'est bien la taille qui l'arrêtera)
    await pastMeasures();
    expect(await formeState()).toBe('running');

    fs.writeFileSync(path.join(tmp, 'fuite.log'), LEAK);
    await pastMeasures();

    // la course est arrêtée
    expect(await formeState()).toBe('stopped');
  });

  it('au-delà de la borne : son dossier temporaire n’existe plus', async () => {
    const forme = await startForme();
    const tmp = tmpOf(forme);
    // témoin : la course a bien reçu un dossier temporaire
    expect(fs.existsSync(tmp)).toBe(true);

    fs.writeFileSync(path.join(tmp, 'fuite.log'), LEAK);
    await pastMeasures();

    // la fuite ne survit pas à l'arrêt
    expect(fs.existsSync(tmp)).toBe(false);
  });
});
