// Invariant « une commande par famille » (note 0.10.0
// docs/tickets/feat/0.10.0-familles-d-agents.md, « Ce que ça ne doit pas
// faire » : « Lancer deux fois la même commande du projet dans une même
// famille » ; SPEC : l'invariant à inscrire avec ce ticket). Les agents d'un
// même dépôt (le parent, ses enfants) partagent ports et base : une même
// commande du fichier du projet ne tourne jamais à deux endroits à la fois,
// qu'elle soit demandée par la page (la question « l'arrêter et le lancer
// ici ? ») ou par l'agent (<sorties>/run/<nom>.restart).
// Protégé : si ce test échoue, corriger le code. Seule retouche acceptée (note
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 3) : la marque propre au
// lancement ; toujours une seule instance par famille.
//
// Sur le vrai principal (contrôleur des processus, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai et ses worktrees, de vrais processus) ;
// faux : Electron (le dossier userData, et la boîte de dialogue, qui relève
// ses questions et répond Oui ou Non selon le cas). Chaque lancement de la
// commande note, avant de devenir `sleep`, combien d'instances tournent déjà
// et dans quel dossier : c'est le système lui-même qu'on observe.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { slow } from '../slow';

const fake = vi.hoisted(() => ({ userData: '', yes: false, asked: [] as unknown[] }));

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class {},
  screen: {}, shell: {}, clipboard: {}, nativeImage: {},
  // Oui : le bouton qui n'est pas celui d'annulation ; Non : celui d'annulation.
  dialog: {
    showMessageBox: async (o: { buttons: string[]; cancelId?: number }) => {
      fake.asked.push(o);
      const no = o.cancelId ?? 0;
      return { response: fake.yes ? o.buttons.findIndex((_, i) => i !== no) : no };
    },
  },
}));

const { loadConfig } = await import('app/settings');
const { processAction, processView, projectFile, stopProcesses } = await import('app/controllers/processes');

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const settle = () => new Promise((r) => setTimeout(r, slow(800)));
const until = async (ok: () => boolean, ms = 8000) => {
  for (const end = Date.now() + ms; !ok() && Date.now() < end;) await new Promise((r) => setTimeout(r, 50));
  return ok();
};
let root = '';
let repo = '';
let worktree = '';
let sibling = '';
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

beforeEach(() => {
  fake.yes = false;
  fake.asked = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-famille-')));
  root = fake.userData;
  seenFile = path.join(root, 'seen.txt');
  repo = path.join(root, 'projet');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
  worktree = path.join(root, 'projet-worktrees', 'feat-a');
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/a', worktree);
  sibling = path.join(root, 'projet-worktrees', 'feat-b');
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/b', sibling);
  // Une famille : a1 sur la copie principale, a2 et a3 ses enfants sur deux worktrees.
  const agent = (id: string, dir: string) => ({ id, dir, name: id, model: 'opus', effort: 'high', mode: 'default', sessionId: null });
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [agent('a1', repo), { ...agent('a2', worktree), parent: { id: 'a1' } }, { ...agent('a3', sibling), parent: { id: 'a1' } }],
  }));
  // Le fichier du projet de la famille : celui de la copie principale.
  fs.mkdirSync(path.dirname(projectFile(repo)), { recursive: true });
  fs.writeFileSync(projectFile(repo), JSON.stringify({
    commands: [{ name: 'serveur', run: `echo "$(pgrep -fc '${MARK}') $PWD" >> '${seenFile}'; exec sleep 9871.${process.pid}` }],
  }));
});
afterEach(async () => {
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
    fake.yes = true;

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

  it('le parent la fait tourner, l’agent enfant demande .restart : pas lancée', async () => {
    await runningIn('a1');
    // l'enfant propose bien la commande de la famille
    expect(names('a2')).toContain('serveur');
    fs.mkdirSync(path.join(root, 'vibecoder-out', 'a2', 'run'), { recursive: true });
    fs.writeFileSync(path.join(root, 'vibecoder-out', 'a2', 'run', 'serveur.restart'), '');

    processView(agentOf('a2'), loadConfig());
    await settle();

    // lancée une seule fois
    expect(seen()).toHaveLength(1);
    // une seule instance vivante
    expect(alive()).toBe(1);
  }, 20000);
});
