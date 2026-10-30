// Variants des familles côté robots (note 0.10.0) : pushAgents envoie chaque
// parent avec ses enfants et leur pastille (branche lue dans .git, ou « PR #n »),
// la fenêtre suit la rangée d'enfants ; removeAgent oublie l'agent, le dossier
// d'un robot de PR, et laisse leur parent aux enfants. Le signal des courses
// sur le robot (note fix/0.11.0-vibecoder-invariants-existants-et-courses) :
// l'état du robot par-dessus sa conversation au repos, le clic qui ouvre son panneau.
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie), le signal
// des courses de chaque agent (runSignalOf, variants dans runs.test.ts).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentsState } from 'shared/bridge';

const fake = vi.hoisted(() => {
  class Win {
    sent: [string, unknown][] = [];
    bounds = { x: 500, y: 500, width: 64, height: 64 };
    webContents = { send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); }, on: () => {} };
    on() { return this; } once() { return this; }
    getBounds() { return this.bounds; } setBounds(b: typeof this.bounds) { this.bounds = b; }
    isVisible() { return false; } isDestroyed() { return false; } isMinimized() { return false; }
    setResizable() {} show() {} focus() {} hide() {} showInactive() {}
  }
  return { Win, userData: '', signals: {} as Record<string, string> };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: fake.Win,
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

vi.mock('app/controllers/runs', async (orig) => ({
  ...(await orig<object>()), runSignalOf: (id: string) => fake.signals[id] ?? null,
}));

const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const AGENT = { model: '', effort: '', mode: 'default', sessionId: null };
let repo = '';
let wt = '';
let pr = '';

beforeEach(() => {
  vi.resetModules();
  fake.signals = {};
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-agents-'));
  repo = path.join(fake.userData, 'projet');
  wt = path.join(fake.userData, 'wt', 'essai');
  pr = path.join(fake.userData, 'wt', 'pr-12');
  write(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/master\n');
  write(path.join(repo, '.git', 'worktrees', 'essai', 'HEAD'), 'ref: refs/heads/feat/essai\n');
  write(path.join(wt, '.git'), `gitdir: ${path.join(repo, '.git', 'worktrees', 'essai')}\n`);
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agentSelected: 'a1',
    agents: [
      { ...AGENT, id: 'a1', name: 'projet', dir: repo },
      { ...AGENT, id: 'a2', name: 'essai', dir: wt, parent: { id: 'a1' } },
      { ...AGENT, id: 'a3', name: 'PR #12', dir: pr, temp: { parent: 'a1', pr: 12 } }, // ancien format
    ],
    agentFolders: [{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }, { dir: pr, color: '#22c55e' }],
  }));
});

async function icon() {
  const { state } = await import('app/state');
  const win = new fake.Win();
  state.icon = win as never;
  return { state, win, last: () => win.sent.filter(([ch]) => ch === 'agents:state').at(-1)?.[1] as AgentsState };
}

describe('robots par famille', () => {
  it('pushAgents : le parent et ses enfants, chacun sa pastille ; la fenêtre gagne la rangée d’enfants', async () => {
    const { state, win, last } = await icon();
    const { pushAgents } = await import('app/controllers');
    pushAgents();
    const [a1] = last().agents!;
    expect(last().agents).toHaveLength(1);
    expect(a1).toMatchObject({ id: 'a1', badge: 'master', selected: true });
    expect(a1.children.map((c) => [c.id, c.badge, c.children])).toEqual([['a2', 'feat/essai', []], ['a3', 'PR #12', []]]);
    expect(a1.children.map((c) => c.color)).toEqual([a1.color, a1.color]); // de la couleur du parent
    expect(state.childRow).toBe(true);
    expect(state.agentSlots).toBe(3); // deux enfants, une place chacun ; « + »
    const tall = win.bounds.height;
    const { removeAgent } = await import('app/controllers');
    await removeAgent('a2');
    await removeAgent('a3');
    expect(state.childRow).toBe(false);
    expect(win.bounds.height).toBeLessThan(tall);
  });

  it('removeAgent du parent : la sélection part, ses enfants restent avec leur parent, en robots ordinaires', async () => {
    const { last } = await icon();
    const { removeAgent } = await import('app/controllers');
    await removeAgent('a1');
    const { loadConfig } = await import('app/settings');
    const cfg = loadConfig();
    expect(cfg.agentSelected).toBeNull();
    expect(cfg.agents.map((a) => [a.id, a.parent ?? a.temp])).toEqual([['a2', { id: 'a1' }], ['a3', { parent: 'a1', pr: 12 }]]);
    expect(cfg.agentFolders).toEqual([{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }, { dir: pr, color: '#22c55e' }]);
    expect(last().agents!.map((a) => [a.id, a.children.length])).toEqual([['a2', 0], ['a3', 0]]);
  });

  it('removeAgent d’un enfant : le dossier d’un robot de PR quitte les favoris, celui d’un enfant sans PR reste', async () => {
    await icon();
    const { removeAgent } = await import('app/controllers');
    await removeAgent('a3');
    await removeAgent('a2');
    await removeAgent('inconnu');
    const { loadConfig } = await import('app/settings');
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1']);
    expect(loadConfig().agentFolders).toEqual([{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }]);
  });
});

// Les artefacts d'un agent retiré (note 0.13.0) : l'invariant du transfert et du
// retour est dans tests/invariants/artifact-moves.test.ts ; ici, les cas voisins.
describe('les artefacts au retrait et à la naissance', () => {
  const arts = (id: string) => path.join(fake.userData, 'vibecoder-out', id, 'artifacts', 'a.md');
  const left = () => JSON.parse(fs.readFileSync(path.join(fake.userData, 'artifacts-left.json'), 'utf8'));

  it('removeAgent d’un enfant dont le parent est parti : comme sans parent, ses artefacts restent', async () => {
    await icon();
    const { removeAgent } = await import('app/controllers');
    await removeAgent('a1');
    write(arts('a2'), 'ENFANT');
    await removeAgent('a2');
    expect(fs.readFileSync(arts('a2'), 'utf8')).toBe('ENFANT');
    expect(Object.keys(left())).toContain('a2');
  });

  it('newAgent sur un dossier qui a déjà son agent : rien ne revient', async () => {
    await icon();
    write(arts('parti'), 'LAISSE');
    fs.writeFileSync(path.join(fake.userData, 'artifacts-left.json'), JSON.stringify({ parti: fs.realpathSync.native(repo) }));
    const { newAgent } = await import('app/controllers');
    newAgent(repo); // a1 existe déjà
    await new Promise((r) => setTimeout(r, 100));
    expect(fs.readFileSync(arts('parti'), 'utf8')).toBe('LAISSE');
    expect(left()).toHaveProperty('parti');
  });
});

describe('le signal des courses sur le robot', () => {
  it('par-dessus une conversation au repos : asking → « ? », failed → erreur, done → pastille ; le signal suit', async () => {
    fake.signals = { a1: 'done', a2: 'asking', a3: 'failed' };
    const { last } = await icon();
    const { pushAgents } = await import('app/controllers');
    pushAgents();
    const [a1] = last().agents!;
    expect([a1, ...a1.children].map((a) => [a.id, a.status, a.unread, a.signal])).toEqual([
      ['a1', 'idle', true, 'done'], ['a2', 'asking', false, 'asking'], ['a3', 'error', false, 'failed'],
    ]);
  });

  it.each(['asking', 'done', 'failed'])('clickAgent : une course %s ouvre le panneau du robot, sans basculer la sélection (F-54)', async (signal) => {
    fake.signals = { a2: signal };
    const { state } = await icon();
    state.panel = new fake.Win() as never;
    const { clickAgent } = await import('app/controllers');
    clickAgent('a2');
    expect(state.convView?.agentId).toBe('a2');
  });

  it('clickAgent : sans signal ni conversation qui attend, la sélection bascule', async () => {
    const { state } = await icon();
    const { clickAgent } = await import('app/controllers');
    clickAgent('a2');
    const { loadConfig } = await import('app/settings');
    expect(loadConfig().agentSelected).toBe('a2');
    expect(state.convView).toBeFalsy();
  });
});

describe('la consigne de la conversation', () => {
  it('launchOptions : la consigne audio, puis la ligne du questionnaire avec le dossier de sorties de l’agent', async () => {
    const { launchOptions } = await import('app/controllers');
    const { loadConfig, vibeOutDir } = await import('app/settings');
    const cfg = loadConfig();
    const { instructions } = launchOptions(cfg.agents![0] as never, cfg);
    expect(instructions).toContain('<audio>');
    expect(instructions).toContain(`${vibeOutDir('a1')}/questions.md`);
    expect(instructions.indexOf('<audio>')).toBeLessThan(instructions.indexOf('questions.md'));
  });
});
