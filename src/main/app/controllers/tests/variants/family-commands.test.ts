// Variants « une commande par famille » (note 0.10.0 docs/tickets/feat/0.10.0-familles-d-agents.md ;
// SPEC I-47 : une même commande ne tourne qu'à un endroit dans une famille) : les 7 cas de la page (la
// question « l'arrêter et le lancer ici ? », Oui ou Non) et de l'agent (<sorties>/run/<nom>.restart).
// Les agents d'un même dépôt (le parent, ses enfants) partagent ports et base : une même commande du
// fichier du projet ne tourne jamais à deux endroits à la fois. La marque propre au lancement : toujours
// une seule instance par famille (note docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 3).
//
// Sur le vrai principal (contrôleur des processus, réglages et fichiers sur disque, git réel sur un dépôt
// d'essai et ses worktrees, de vrais processus), dans le décor commun (app/tests/harness) : faux Electron,
// dont la boîte de dialogue relève ses questions et répond Oui ou Non selon le cas. Chaque lancement de la
// commande note, avant de devenir `sleep`, combien d'instances tournent déjà et dans quel dossier : c'est
// le système lui-même qu'on observe.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeElectron, git, profile, repo, writeConfig, write } from 'app/tests/harness';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);

const { loadConfig } = await import('app/settings');
const { processAction, processOp, processView, projectFile, stopProcesses } = await import('app/controllers/processes');
const { openSocket, closeSocket } = await import('app/controllers');

let yes = false;
const until = async (ok: () => boolean, ms = 8000) => {
  for (const end = Date.now() + ms; !ok() && Date.now() < end;) await new Promise((r) => setTimeout(r, 50));
  return ok();
};
let root = '';
let worktree = '';
let seenFile = '';

// La commande devient `sleep 9871.<pid de ce lancement>` : ses instances vivantes, comptées par le
// système. La marque est propre au lancement : deux lancements en même temps ne se voient ni ne se tuent.
const MARK = `^sleep 9871\\.${process.pid}$`;
const alive = () => Number(spawnSync('pgrep', ['-fc', MARK], { encoding: 'utf8' }).stdout.trim() || 0);
// Chaque lancement : combien d'instances tournaient déjà, et son dossier.
const seen = () => (fs.existsSync(seenFile) ? fs.readFileSync(seenFile, 'utf8').trim().split('\n') : [])
  .map((line) => ({ alongside: Number(line.split(' ')[0]), dir: line.slice(line.indexOf(' ') + 1) }));

const agentOf = (id: string) => loadConfig().agents.find((a) => a.id === id)!;
const names = (id: string) => processView(agentOf(id), loadConfig()).processes.map((p) => p.name);

// Ce que demande la page de l'agent `id` pour la commande au rang 0 : 'start' ou 'restart'.
async function fromPage(id: string, op: 'start' | 'restart') {
  const cfg = loadConfig();
  const agent = agentOf(id);
  await processAction(agent, cfg, op, 0, processView(agent, cfg).processes);
}

// La commande `serveur` lancée par l'agent `id`, et attendue.
async function runningIn(id: string) {
  const before = seen().length;
  await fromPage(id, 'start');
  await until(() => seen().length > before);
}

beforeEach(async () => {
  yes = false;
  root = profile('whisper-famille-');
  seenFile = path.join(root, 'seen.txt');
  const repoDir = path.join(root, 'projet');
  repo(repoDir);
  worktree = path.join(root, 'projet-worktrees', 'feat-a');
  git(repoDir, 'worktree', 'add', '-q', '-b', 'feat/a', worktree);
  const sibling = path.join(root, 'projet-worktrees', 'feat-b');
  git(repoDir, 'worktree', 'add', '-q', '-b', 'feat/b', sibling);
  // Une famille : a1 sur la copie principale, a2 et a3 ses enfants sur deux worktrees.
  const agent = (id: string, dir: string) => ({ id, dir, name: id, model: 'opus', effort: 'high', mode: 'default' as const, sessionId: null });
  writeConfig(root, [agent('a1', repoDir), { ...agent('a2', worktree), parent: { id: 'a1' } }, { ...agent('a3', sibling), parent: { id: 'a1' } }]);
  // Oui : le bouton qui n'est pas celui d'annulation ; Non : celui d'annulation.
  electron.dialog.answer = (o: { buttons: string[]; cancelId?: number }) => {
    const no = o.cancelId ?? 0;
    return yes ? o.buttons.findIndex((_, i) => i !== no) : no;
  };
  // Le fichier du projet de la famille : celui de la copie principale.
  write(projectFile(repoDir), JSON.stringify({
    commands: [{ name: 'serveur', run: `echo "$(pgrep -fc '${MARK}') $PWD" >> '${seenFile}'; exec sleep 9871.${process.pid}` }],
  }));
  // Les boutons de l'écran passent par le socket (0.15.0). Ici sans panneau ni relevé : la porte
  // est celle de l'écran, mais l'exécuteur est remplacé par processOp, l'opération qu'il appelle (proc.<op>).
  await openSocket(async (env) => {
    const agent = loadConfig().agents.find((a) => fs.realpathSync.native(a.dir) === env.target)!;
    await processOp(agent, loadConfig(), (env.args as { name: string }).name, env.cmd.slice('proc.'.length) as 'start' | 'stop' | 'restart');
    return { ok: true, result: null };
  });
});
afterEach(async () => {
  closeSocket();
  await stopProcesses();
  spawnSync('pkill', ['-f', MARK]);
});

describe.skipIf(process.platform === 'win32')('une même commande ne tourne qu’à un endroit dans une famille', () => {
  it('le parent la fait tourner, l’enfant la lance depuis la page, Non : rien de plus', async () => {
    await runningIn('a1');
    // l'enfant propose bien la commande de la famille
    expect(names('a2')).toContain('serveur');

    const before = seen().length;

    await fromPage('a2', 'start');
    // un lancement de plus aurait eu le temps d'apparaître
    await until(() => seen().length > before, 3000);

    // aucun lancement de plus après l'appel
    expect(seen()).toHaveLength(before);
    // une seule instance vivante
    expect(alive()).toBe(1);
  }, 20000);

  it('le parent la fait tourner, l’enfant la lance depuis la page, Oui : arrêtée là-bas, puis lancée ici, jamais deux à la fois', async () => {
    await runningIn('a1');
    // l'enfant propose bien la commande de la famille
    expect(names('a2')).toContain('serveur');
    yes = true;

    await fromPage('a2', 'start');
    await until(() => seen().length === 2);

    // à chaque lancement, aucune autre instance ne tournait
    expect(Math.max(...seen().map((s) => s.alongside))).toBeLessThan(1);
    // le dernier lancement est celui de l'enfant, dans son dossier
    expect(seen().at(-1)?.dir).toBe(worktree);
    // une seule instance vivante
    expect(alive()).toBe(1);
  }, 20000);

  it('un enfant la fait tourner, le parent la lance depuis la page, Non : rien de plus', async () => {
    await runningIn('a2');
    // l'enfant fait bien tourner la commande de la famille
    expect(seen()).toHaveLength(1);

    const before = seen().length;

    await fromPage('a1', 'start');
    // un lancement de plus aurait eu le temps d'apparaître
    await until(() => seen().length > before, 3000);

    // aucun lancement de plus après l'appel
    expect(seen()).toHaveLength(before);
    // une seule instance vivante
    expect(alive()).toBe(1);
  }, 20000);

  it('un enfant la fait tourner, un autre enfant la lance depuis la page, Non : rien de plus', async () => {
    await runningIn('a2');
    // l'autre enfant propose bien la commande de la famille
    expect(names('a3')).toContain('serveur');

    const before = seen().length;

    await fromPage('a3', 'start');
    // un lancement de plus aurait eu le temps d'apparaître
    await until(() => seen().length > before, 3000);

    // aucun lancement de plus après l'appel
    expect(seen()).toHaveLength(before);
    // une seule instance vivante
    expect(alive()).toBe(1);
  }, 20000);

  it('le parent la fait tourner, l’enfant la relance depuis la page, Non : rien de plus', async () => {
    await runningIn('a1');
    // l'enfant propose bien la commande de la famille
    expect(names('a2')).toContain('serveur');

    const before = seen().length;

    await fromPage('a2', 'restart');
    // un lancement de plus aurait eu le temps d'apparaître
    await until(() => seen().length > before, 3000);

    // aucun lancement de plus après l'appel
    expect(seen()).toHaveLength(before);
    // une seule instance vivante
    expect(alive()).toBe(1);
  }, 20000);

  it('le parent la fait tourner, l’enfant la relance depuis la page, Oui : arrêtée là-bas, puis lancée ici, une seule instance', async () => {
    await runningIn('a1');
    // l'enfant propose bien la commande de la famille
    expect(names('a2')).toContain('serveur');
    yes = true;

    await fromPage('a2', 'restart');
    await until(() => seen().length === 2);

    // un lancement de plus
    expect(seen()).toHaveLength(2);
    // le dernier lancement est celui de l'enfant, dans son dossier
    expect(seen().at(-1)?.dir).toBe(worktree);
    // une seule instance vivante
    expect(alive()).toBe(1);
  }, 20000);

  it('le parent la fait tourner, l’agent enfant demande .restart : pas lancée', async () => {
    await runningIn('a1');
    // l'enfant propose bien la commande de la famille
    expect(names('a2')).toContain('serveur');
    const request = path.join(root, 'vibecoder-out', 'a2', 'run', 'serveur.restart');
    fs.mkdirSync(path.dirname(request), { recursive: true });
    fs.writeFileSync(request, '');

    processView(agentOf('a2'), loadConfig());
    // la demande est lue (le fichier consommé), sans délai fixe
    await until(() => !fs.existsSync(request));

    // lancée une seule fois
    expect(seen()).toHaveLength(1);
    // une seule instance vivante
    expect(alive()).toBe(1);
  }, 20000);
});
