// Variants de Relire dans un worktree (note 0.8.0, F-110) : l'état du worktree
// dans le relevé, Aller au robot et le départ du robot de PR (ici à l'ancien
// format `temp`) ; des familles d'agents (note 0.10.0) : un enfant sans PR
// reste, le rattachement par git (liens symboliques, `temp` réécrit en
// `parent`), les worktrees libres, Ouvrir un agent ici ; des worktrees (note
// 0.12.0) : le worktree de la PR prêt (prWorktreeReady), l'enfant d'une
// nouvelle demande (openChild), Retirer le worktree (removeWorktreeChild) ; et, déplacés de
// invariants/worktree.test.ts (qui garde la question de confiance, un autre dépôt, le chemin
// relatif, le lien symbolique et les courses), les dossiers qui ne sont pas la racine d'un
// worktree (le robot d'une PR, Ouvrir un agent ici) et le rattachement par git.
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, parcours), dans le décor commun (app/tests/harness) : faux Electron
// (fenêtres qui relèvent ce qu'on leur envoie, la boîte de dialogue répond oui
// ou non), SDK de Claude Code (le tour finit aussitôt) ; faux : la recette
// (removeWorktree répond `fake.removed`).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo as newRepo, repoResources, write } from 'app/tests/harness';

const fake = vi.hoisted(() => ({ removed: { ok: true, line: '' } }));
const electron = fakeElectron();
const claude = fakeClaude({ finish: true });
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());
vi.mock('app/controllers/recipe', () => ({ removeWorktree: async () => fake.removed }));

let userData = '';
let repo = '';
let worktree = '';
let outA = '';
let card = '';

const AGENT = { name: 'projet', model: '', effort: '', mode: 'default', sessionId: null };
const ROBOT = { ...AGENT, id: 'a2', name: 'PR #12', vibe: { flow: 'review', autonomy: 'guide', pr: 12 }, temp: { parent: 'a1', pr: 12 } };

// Un profil neuf ; la boîte de dialogue répond le premier bouton.
function fresh(prefix: string) {
  userData = profile(prefix);
  electron.dialog.answer = () => 1;
  return userData;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fake.removed = { ok: true, line: '' };
  fresh('whisper-worktrees-');
  repo = path.join(userData, 'projet');
  worktree = path.join(userData, 'projet-worktrees', 'pr-12');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(worktree, { recursive: true });
  outA = path.join(userData, 'vibecoder-out', 'a1');
  card = path.join(outA, 'pr-12-worktree.json');
  write(path.join(outA, 'pr-12.json'), JSON.stringify({ number: 12, title: 'Essai', state: 'OPEN' }));
  write(card, JSON.stringify({ dir: worktree, branch: 'pr-12' }));
  // le robot a la fiche de sa PR (copiée par l'appli) : il la suit, ouverte, et reste relecteur tant que gh n'a pas dit le contraire
  write(path.join(userData, 'vibecoder-out', 'a2', 'pr-12.json'), JSON.stringify({ number: 12, title: 'Essai', state: 'OPEN' }));
  write(path.join(userData, 'config.json'), JSON.stringify({
    agents: [{ ...AGENT, id: 'a1', dir: repo, vibe: { flow: 'review', autonomy: 'guide', pr: 12 } }, { ...ROBOT, dir: worktree }],
    agentFolders: [{ dir: repo, color: '#22c55e' }, { dir: worktree, color: '#22c55e' }],
  }));
});
afterEach(closeAll);

// Le panneau ouvert sur un agent, la page prête : ses relevés reçus. Les boutons de l'écran passent par le socket
// (0.15.0) : ouvert comme au lancement, sur la vraie porte de l'écran.
async function open(id: string) {
  const panel = await openPanel(id);
  return () => panel.sent.filter(([ch]) => ch === 'conv:vibe').at(-1)?.[1] as VibeView | null;
}

describe('Relire dans un worktree', () => {
  it('sur le robot : son badge', async () => {
    const view = await open('a2');
    expect(view()!.worktree).toEqual({ state: 'robot', temp: true, dir: worktree });
  });

  it('Retirer le worktree, refusé par la recette : le robot et sa fiche restent', async () => {
    fake.removed = { ok: false, line: 'des modifications' };
    const { removeWorktreeChild } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    expect(await removeWorktreeChild(loadConfig().agents[1])).toEqual({ ok: false, line: 'des modifications' });
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(fs.existsSync(card)).toBe(true);
  });

  it('Retirer le worktree du robot d’une PR : sa fiche part, le robot avec, son brouillon revient', async () => {
    await open('a2');
    const { draftVibe, removeWorktreeChild } = await import('app/controllers');
    const { loadConfig, vibeStore } = await import('app/settings');
    await draftVibe({ add: { target: 'note', text: 'à revoir' } });
    expect(await removeWorktreeChild(loadConfig().agents[1])).toEqual({ ok: true, line: '' });
    expect(fs.existsSync(card)).toBe(false);
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1']);
    expect(vibeStore().drafts.a1?.[12]).toEqual([{ id: expect.any(Number), target: 'note', text: 'à revoir' }]);
  });

  it('Retirer le worktree d’un enfant sans PR : il part, son dossier quitte les favoris, ses sorties partent, le panneau passe au parent', async () => {
    const { loadConfig, saveConfig, vibeOutDir } = await import('app/settings');
    saveConfig({ agents: loadConfig().agents.map((a) => (a.id === 'a2' ? { ...AGENT, id: 'a2', dir: worktree, parent: { id: 'a1' } } as never : a)) });
    await open('a2');
    const outB = vibeOutDir('a2');
    write(path.join(outB, 'note.md'), 'x');
    const { removeWorktreeChild } = await import('app/controllers');
    const { state } = await import('app/state');
    expect((await removeWorktreeChild(loadConfig().agents[1])).ok).toBe(true);
    const cfg = loadConfig();
    expect(cfg.agents.map((a) => a.id)).toEqual(['a1']);
    expect(cfg.agentFolders).toEqual([{ dir: repo, color: '#22c55e' }]);
    expect(fs.existsSync(outB)).toBe(false);
    expect(state.convView?.agentId).toBe('a1');
  });

  it('la fiche partie : le robot part, son dossier quitte les favoris, son brouillon revient, le panneau passe à l’agent du dépôt', async () => {
    await open('a2');
    const { draftVibe, syncWorktrees } = await import('app/controllers');
    await draftVibe({ add: { target: 'note', text: 'à revoir' } });
    fs.rmSync(card);
    await syncWorktrees();
    const { loadConfig, vibeStore } = await import('app/settings');
    const { state } = await import('app/state');
    const cfg = loadConfig();
    expect(cfg.agents.map((a) => a.id)).toEqual(['a1']);
    expect(cfg.agentFolders).toEqual([{ dir: repo, color: '#22c55e' }]);
    expect(vibeStore().drafts.a1?.[12]).toEqual([{ id: expect.any(Number), target: 'note', text: 'à revoir' }]);
    expect(state.convView?.agentId).toBe('a1');
  });

  it('la fiche là : le robot reste', async () => {
    await open('a2');
    const { syncWorktrees } = await import('app/controllers');
    await syncWorktrees();
    const { loadConfig } = await import('app/settings');
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('un enfant sans PR reste au relevé : il ne part qu’à Retirer', async () => {
    const { loadConfig, saveConfig } = await import('app/settings');
    const { syncWorktrees } = await import('app/controllers');
    saveConfig({ agents: loadConfig().agents.map((a) => (a.id === 'a2' ? { ...AGENT, id: 'a2', dir: worktree, parent: { id: 'a1' } } as never : a)) });
    fs.rmSync(card);
    await syncWorktrees();
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('sur l’agent du dépôt : son robot là, Aller au robot l’affiche', async () => {
    const view = await open('a1');
    expect(view()!.worktree).toEqual({ state: 'robot', temp: false, dir: worktree });
    const { setVibe } = await import('app/controllers');
    const { state } = await import('app/state');
    setVibe({ worktree: true });
    expect(state.convView?.agentId).toBe('a2');
  });

  it('l’état sur l’agent du dépôt : ouverte sans robot, en création (pr-worktree en cours), rien', async () => {
    const { worktreeState } = await import('app/controllers');
    const { loadConfig, saveConfig } = await import('app/settings');
    saveConfig({ agents: loadConfig().agents.filter((a) => a.id === 'a1') });
    const a1 = loadConfig().agents[0];
    expect(worktreeState(a1, 12, false)).toEqual({ state: 'open', temp: false, dir: worktree });
    fs.rmSync(card);
    expect(worktreeState(a1, 12, true)).toEqual({ state: 'creating', temp: false, dir: '' });
    expect(worktreeState(a1, 12, false)).toBeNull();   // la recette a fini sans worktree
    expect(worktreeState(a1, null, true)).toBeNull();
  });
});

describe('les artefacts d’un enfant retiré', () => {
  it('Retirer le worktree d’un enfant : un ancien artifacts/ pas encore parti reste, ses autres sorties partent', async () => {
    const { loadConfig, saveConfig, vibeOutDir } = await import('app/settings');
    saveConfig({ agents: loadConfig().agents.map((a) => (a.id === 'a2' ? { ...AGENT, id: 'a2', dir: worktree, parent: { id: 'gone' } } as never : a)) });
    const { removeWorktreeChild } = await import('app/controllers');
    const outB = vibeOutDir('a2');
    write(path.join(outB, 'artifacts', 'plan.md'), 'plan');
    write(path.join(outB, 'note.md'), 'x');
    await removeWorktreeChild(loadConfig().agents[1]);
    expect(fs.readFileSync(path.join(outB, 'artifacts', 'plan.md'), 'utf8')).toBe('plan');
    expect(fs.existsSync(path.join(outB, 'note.md'))).toBe(false);
  });
});

describe('les familles par git', () => {
  let real = '';   // le dépôt, résolu
  let wt = '';     // son worktree, résolu
  let link = '';   // le même dossier par un lien symbolique (comme /home → /var/home)

  beforeEach(() => {
    const root = userData;
    real = path.join(root, 'g', 'projet');
    wt = path.join(root, 'g', 'projet-wt');
    fs.mkdirSync(real, { recursive: true });
    git(real, 'init', '-q');
    git(real, 'commit', '-q', '--allow-empty', '-m', 'init');
    git(real, 'worktree', 'add', '-q', '-b', 'feat-y', wt);
    link = path.join(root, 'lien');
    fs.symlinkSync(path.join(root, 'g'), link);
  });

  const config = async (agents: object[], agentFolders: object[] = []) => {
    const { saveConfig } = await import('app/settings');
    saveConfig({ agents: agents as never, agentFolders: agentFolders as never });
  };

  it('le rattachement : dossiers par un lien, l’ancien `temp` réécrit en `parent` (PR gardée), un sous-dossier jamais enfant', async () => {
    fs.mkdirSync(path.join(real, 'src'));
    write(path.join(outA, 'pr-3-worktree.json'), JSON.stringify({ dir: wt, branch: 'feat-y' }));   // le robot de PR garde sa fiche
    await config([
      { ...AGENT, id: 'a1', dir: path.join(link, 'projet') },
      { ...AGENT, id: 'a2', dir: path.join(link, 'projet-wt'), temp: { parent: 'a1', pr: 3 } },
      { ...AGENT, id: 'a3', dir: path.join(link, 'projet', 'src') },
    ]);
    const { syncFamilies } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    await syncFamilies();
    const [a1, a2, a3] = loadConfig().agents;
    expect(a1.parent).toBeUndefined();
    expect(a2.parent).toEqual({ id: 'a1', pr: 3 });
    expect(a2.temp).toBeUndefined();
    expect(a3.parent).toBeUndefined();
  });

  it('les worktrees libres : sans la copie principale ni un dossier qui a un agent (même par un lien)', async () => {
    await config([{ ...AGENT, id: 'a1', dir: path.join(link, 'projet') }]);
    const { freeWorktrees } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    expect((await freeWorktrees(loadConfig().agents[0]))?.free).toEqual([{ dir: wt, branch: 'feat-y' }]);
    await config([{ ...AGENT, id: 'a1', dir: path.join(link, 'projet') }, { ...AGENT, id: 'a2', dir: path.join(link, 'projet-wt') }]);
    expect((await freeWorktrees(loadConfig().agents[0]))?.free).toEqual([]);
  });

  it('les worktrees libres : null pour un agent hors de la racine de la copie principale', async () => {
    fs.mkdirSync(path.join(real, 'src'));
    await config([{ ...AGENT, id: 'a1', dir: path.join(real, 'src') }, { ...AGENT, id: 'a2', dir: wt }]);
    const { freeWorktrees } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    const [a1, a2] = loadConfig().agents;
    expect(await freeWorktrees(a1)).toBeNull();
    expect(await freeWorktrees(a2)).toBeNull();
  });

  it('Ouvrir un agent ici : l’enfant nommé par sa branche, de la couleur du parent (dossier déjà favori : pas de question)', async () => {
    await config([{ ...AGENT, id: 'a1', dir: real }], [{ dir: real, color: '#ef4444' }, { dir: wt, color: '#22c55e' }]);
    const { openHere } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    await openHere(loadConfig().agents[0], wt);
    const cfg = loadConfig();
    expect(cfg.agents[1]).toMatchObject({ dir: wt, name: 'feat-y', parent: { id: 'a1' } });
    expect(cfg.agents[1].parent).toEqual({ id: 'a1' });
    expect(cfg.agentFolders).toContainEqual({ dir: wt, color: '#ef4444' });
  });

  it('le worktree de la PR prêt : la fiche écrite par l’appli (pas à travers un lien), le robot « PR #3 » après la question', async () => {
    await config([{ ...AGENT, id: 'a1', dir: real }]);
    const target = path.join(userData, 'cible.txt');
    write(target, 'intact');
    write(path.join(outA, 'pr-3.json'), '{}');
    fs.symlinkSync(target, path.join(outA, 'pr-3-worktree.json'));
    const { prWorktreeReady } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    await prWorktreeReady(loadConfig().agents[0], 3, wt, 'pr-3');
    expect(fs.readFileSync(target, 'utf8')).toBe('intact');
    expect(JSON.parse(fs.readFileSync(path.join(outA, 'pr-3-worktree.json'), 'utf8'))).toEqual({ dir: wt, branch: 'pr-3' });
    expect(loadConfig().agents[1]).toMatchObject({ dir: wt, name: 'PR #3', parent: { id: 'a1', pr: 3 } });
  });

  it('l’enfant d’une nouvelle demande : en Créer, le dossier résolu (donné par un lien), de la couleur du parent', async () => {
    await config([{ ...AGENT, id: 'a1', dir: real }], [{ dir: real, color: '#ef4444' }, { dir: wt, color: '#22c55e' }]);
    const { openChild } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    const child = await openChild(loadConfig().agents[0], path.join(link, 'projet-wt'), { name: 'feat/y', create: true });
    expect(child).toMatchObject({ dir: wt, name: 'feat/y', parent: { id: 'a1' }, vibe: { flow: 'create', pr: null } });
    expect(loadConfig().agents[1]).toEqual(child);
    expect(loadConfig().agentFolders).toContainEqual({ dir: wt, color: '#ef4444' });
  });

  it('l’enfant d’une nouvelle demande, question refusée : null, aucun enfant', async () => {
    electron.dialog.answer = () => 0;
    await config([{ ...AGENT, id: 'a1', dir: real }]);
    const { openChild } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    expect(await openChild(loadConfig().agents[0], wt, { name: 'feat/y', create: true })).toBeNull();
    expect(loadConfig().agents).toHaveLength(1);
  });
});

// Le robot d'une PR et Ouvrir un agent ici sur des dépôts d'essai réels : un dossier qui n'est pas la racine d'un
// worktree du dépôt ne donne ni question ni agent. Chaque cas repart d'un profil neuf (son dépôt, son worktree).
describe('dossiers et rattachement : seule la racine d’un worktree du dépôt', () => {
  let root = '';
  beforeEach(() => {
    root = fresh('whisper-worktrees-racine-');
    repo = path.join(root, 'projet');
    newRepo(repo);
    worktree = path.join(root, 'projet-worktrees', 'pr-7');
    git(repo, 'worktree', 'add', '-q', '-b', 'pr-7', worktree);
    outA = path.join(root, 'vibecoder-out', 'a1');
    write(path.join(outA, 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', base: 'main', head: 'feat/x', state: 'OPEN' }));
    write(path.join(root, 'config.json'), JSON.stringify({
      agents: [{ id: 'a1', dir: repo, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
        vibe: { flow: 'review', autonomy: 'guide', pr: 7 } }],
    }));
  });

  const pr7Card = (dir: string, where = outA) => write(path.join(where, 'pr-7-worktree.json'), JSON.stringify({ dir, branch: 'pr-7' }));
  const agents = async () => (await import('app/settings')).loadConfig().agents;

  // Un agent de plus dans les réglages, comme l'enregistre « + » (dossier déjà choisi).
  function addAgent(id: string, dir: string) {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
    cfg.agents.push({ id, dir, name: id, model: 'opus', effort: 'high', mode: 'default', sessionId: null });
    write(path.join(root, 'config.json'), JSON.stringify(cfg));
  }

  // L'écran a demandé le worktree de la PR 7 à a1 ; la fiche est là (ou non) : un passage.
  async function sync() {
    const { syncWorktrees, wantWorktree } = await import('app/controllers');
    wantWorktree('a1', 7);
    await syncWorktrees();
  }

  // Clic droit de a1 → Worktrees → Ouvrir un agent ici, sur `dir`.
  async function openHere(dir: string) {
    const { openHere: open } = await import('app/controllers');
    const parent = (await agents()).find((a) => a.id === 'a1')!;
    await open(parent, dir);
  }

  // Le rattachement par git (au lancement), puis l'agent a2 tel qu'enregistré.
  async function familiesSynced() {
    const { syncFamilies } = await import('app/controllers');
    await syncFamilies();
    return (await agents()).find((a) => a.id === 'a2')!;
  }

  describe('le robot d’une PR dans un worktree', () => {
    it('un dossier qui n’existe pas : ni question, ni robot', async () => {
      pr7Card(path.join(root, 'nulle-part'));

      await sync();

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('le dossier de l’agent du dépôt : ni question, ni robot', async () => {
      pr7Card(repo);

      await sync();

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('un sous-dossier du dépôt : ni question, ni robot', async () => {
      fs.mkdirSync(path.join(repo, 'src'));
      pr7Card(path.join(repo, 'src'));

      await sync();

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('un sous-dossier du worktree : ni question, ni robot', async () => {
      fs.mkdirSync(path.join(worktree, 'src'));
      pr7Card(path.join(worktree, 'src'));

      await sync();

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('un fichier du worktree : ni question, ni robot', async () => {
      write(path.join(worktree, 'a.txt'), 'a');
      pr7Card(path.join(worktree, 'a.txt'));

      await sync();

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('un dossier hors de tout dépôt : ni question, ni robot', async () => {
      fs.mkdirSync(path.join(root, 'vide'));
      pr7Card(path.join(root, 'vide'));

      await sync();

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });
  });

  describe('Ouvrir un agent ici : l’enfant d’un worktree', () => {
    it('un dossier qui n’existe pas : ni question, ni enfant', async () => {
      await openHere(path.join(root, 'nulle-part'));

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('la copie du parent : ni question, ni enfant', async () => {
      await openHere(repo);

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('un sous-dossier du dépôt : ni question, ni enfant', async () => {
      fs.mkdirSync(path.join(repo, 'src'));

      await openHere(path.join(repo, 'src'));

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('un sous-dossier du worktree : ni question, ni enfant', async () => {
      fs.mkdirSync(path.join(worktree, 'src'));

      await openHere(path.join(worktree, 'src'));

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('un fichier du worktree : ni question, ni enfant', async () => {
      write(path.join(worktree, 'a.txt'), 'a');

      await openHere(path.join(worktree, 'a.txt'));

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('un dossier hors de tout dépôt : ni question, ni enfant', async () => {
      fs.mkdirSync(path.join(root, 'vide'));

      await openHere(path.join(root, 'vide'));

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // aucun agent de plus
      expect(await agents()).toHaveLength(1);
    });

    it('un worktree qui a déjà un agent : ni question, ni second agent', async () => {
      addAgent('a2', worktree);

      await openHere(worktree);

      // aucune question
      expect(electron.dialog.asked).toEqual([]);
      // toujours un seul agent sur ce worktree
      expect((await agents()).filter((a) => a.dir === worktree)).toHaveLength(1);
    });
  });

  describe('le rattachement par git : un agent existant ne devient enfant que sur la racine d’un worktree du dépôt', () => {
    it('un agent à la racine d’un worktree du dépôt : enfant de l’agent du dépôt', async () => {
      addAgent('a2', worktree);

      const a2 = await familiesSynced();

      // rattaché à a1
      expect(a2.parent).toMatchObject({ id: 'a1' });
    });

    it('un agent sur un sous-dossier d’un worktree du dépôt : jamais enfant', async () => {
      fs.mkdirSync(path.join(worktree, 'src'));
      addAgent('a2', path.join(worktree, 'src'));

      const a2 = await familiesSynced();

      // aucun parent
      expect(a2.parent ?? null).toBeNull();
    });

    it('un agent sur un sous-dossier de la copie principale : jamais enfant', async () => {
      fs.mkdirSync(path.join(repo, 'src'));
      addAgent('a2', path.join(repo, 'src'));

      const a2 = await familiesSynced();

      // aucun parent
      expect(a2.parent ?? null).toBeNull();
    });
  });
});
