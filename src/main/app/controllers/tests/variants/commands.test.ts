// Variants de runCommand et commandFromSocket (notes 0.15.0, docs/tickets/feat/0.15.0-executeur.md et
// 0.15.0-socket-interface.md) : le branchement seul.
// Réels : execute, la table et le catalogue livrés dans resources/, la configuration (par défaut) ;
// faux : Electron (le dossier userData) et les opérations (relevé, startAction, runDirect, refreshVibe,
// runOp, vibeStart, processOp, readArtifact, editDraft, le robot affiché), qui relèvent leurs appels ; les robots
// de commandFromSocket sont ceux d'un config.json d'essai. Les gardes sont celles de commands-guards.test.ts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from 'core/agents';
import type { VibeView } from 'shared/bridge';

const fake = vi.hoisted(() => ({
  userData: '',
  view: null as unknown,
  start: vi.fn(), direct: vi.fn(), refresh: vi.fn(), run: vi.fn(), vibeStart: vi.fn(), proc: vi.fn(), artifact: vi.fn(), draft: vi.fn(),
  shown: null as unknown,   // le robot affiché (viewAgent)
}));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData } }));
vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));
vi.mock('app/controllers/vibecoder', () => ({
  lastView: () => fake.view, startAction: fake.start, runDirect: fake.direct, refreshVibe: fake.refresh, editDraft: fake.draft,
}));
vi.mock('app/controllers/artifacts', () => ({ readArtifact: fake.artifact }));
vi.mock('app/controllers/agents', () => ({ viewAgent: () => fake.shown, real: (d: string) => { try { return fs.realpathSync.native(d); } catch { return null; } } }));
vi.mock('app/controllers/runs', () => ({ runOp: fake.run, vibeStart: fake.vibeStart }));
vi.mock('app/controllers/processes', () => ({ processOp: fake.proc }));

const { runCommand, commandFromSocket } = await import('app/controllers/commands');
const { vibeActions } = await import('app/settings');

const agent: AgentConfig = { id: 'a1', dir: '/tmp/x', name: 'essai', model: '', effort: '', mode: 'default', sessionId: null };
const action = (id: string) => ({ id, label: id, hidden: false, disabled: null });
const view = { flow: 'create', steps: [], actions: ['forme', 'vibe', 'pull'].map(action), processes: [{ name: 'dev' }], runs: [] } as unknown as VibeView;
const def = (id: string) => vibeActions('fr').find((d) => d.id === id);

beforeEach(() => {
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-commands-'));
  fake.view = view;
  fake.shown = null;
  for (const f of [fake.start, fake.direct, fake.refresh, fake.run, fake.vibeStart, fake.proc, fake.artifact, fake.draft]) f.mockReset();
  fake.artifact.mockResolvedValue({ name: 'a.md', kind: 'markdown', text: 'x', truncated: false });
  fake.draft.mockReturnValue({ ok: true });
  fake.start.mockReturnValue({ ok: true });
  fake.direct.mockReturnValue({ ok: true });
  fake.run.mockResolvedValue(true);
  fake.proc.mockResolvedValue(true);
});

describe('runCommand', () => {
  it('sans relevé pour ce robot : no-survey, rien n’est lancé', async () => {
    fake.view = null;
    const res = await runCommand(agent, { command: 'run.start', args: { action: 'forme' }, door: 'agent' });
    expect(res).toMatchObject({ ok: false, error: { code: 'no-survey' } });
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('run.start : startAction avec le robot, la def du catalogue, le relevé, la configuration ; le relevé est relu', async () => {
    const res = await runCommand(agent, { command: 'run.start', args: { action: 'forme' }, door: 'agent' });
    expect(res.ok).toBe(true);
    expect(fake.start).toHaveBeenCalledWith(agent, def('forme'), {}, view, expect.objectContaining({ agents: expect.any(Array) }));
    expect(fake.vibeStart).not.toHaveBeenCalled();
    expect(fake.refresh).toHaveBeenCalledWith({ now: true });
  });

  it('vibe parti : vibeStart ; refusé : ni vibeStart ni relevé', async () => {
    await runCommand(agent, { command: 'vibe', door: 'agent' });
    expect(fake.vibeStart).toHaveBeenCalledWith(agent);
    fake.vibeStart.mockReset(); fake.refresh.mockReset();
    fake.start.mockReturnValue({ ok: false, error: 'non', reason: 'busy', by: 'forme' });
    const res = await runCommand(agent, { command: 'vibe', door: 'agent' });
    expect(res).toMatchObject({ ok: false, error: { code: 'busy' } });
    expect(fake.vibeStart).not.toHaveBeenCalled();
    expect(fake.refresh).not.toHaveBeenCalledWith({ now: true });
  });

  it('pull : runDirect avec le robot, la def, le relevé et la configuration', async () => {
    const res = await runCommand(agent, { command: 'pull', door: 'agent' });
    expect(res.ok).toBe(true);
    expect(fake.direct).toHaveBeenCalledWith(agent, def('pull'), {}, view, expect.objectContaining({ agents: expect.any(Array) }));
  });

  it('run.stop : runOp ; proc.restart : processOp', async () => {
    await runCommand(agent, { command: 'run.stop', args: { action: 'forme' }, door: 'agent' });
    expect(fake.run).toHaveBeenCalledWith(agent, 'forme', 'stop');
    await runCommand(agent, { command: 'proc.restart', args: { name: 'dev' }, door: 'agent' });
    expect(fake.proc).toHaveBeenCalledWith(agent, expect.objectContaining({ agents: expect.any(Array) }), 'dev', 'restart');
  });

  it('une action absente du catalogue : not-offered, startAction pas appelée', async () => {
    fake.view = { ...view, actions: [action('fantome')] };
    const res = await runCommand(agent, { command: 'run.start', args: { action: 'fantome' }, door: 'agent' });
    expect(res.ok).toBe(false);
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('status : le relevé du robot, sans son id', async () => {
    const res = await runCommand(agent, { command: 'status', door: 'agent' });
    expect(res).toMatchObject({ ok: true, result: { flow: 'create', vibe: false, running: [] } });
    expect(JSON.stringify(res)).not.toContain(agent.id);
  });
});

describe('runCommand : l\'état relu, le robot absent, les opérations nouvelles', () => {
  it('une écriture : refreshVibe fresh attendu avant execute ; une lecture : sans', async () => {
    let order: string[] = [];
    fake.refresh.mockImplementation(async (o: object) => { order.push(`refresh ${JSON.stringify(o)}`); });
    fake.start.mockImplementation(() => { order.push('start'); return { ok: true }; });
    await runCommand(agent, { command: 'run.start', args: { action: 'forme' }, door: 'agent' });
    expect(order.slice(0, 2)).toEqual(['refresh {"fresh":true}', 'start']);
    order = [];
    await runCommand(agent, { command: 'status', door: 'agent' });
    expect(order).toEqual([]);
  });

  it('agent null : no-survey, aucune opération appelée, rien relu', async () => {
    const res = await runCommand(null, { command: 'run.start', args: { action: 'forme' }, door: 'screen' });
    expect(res).toMatchObject({ ok: false, error: { code: 'no-survey' } });
    for (const f of [fake.start, fake.direct, fake.run, fake.proc, fake.artifact, fake.draft, fake.refresh]) expect(f).not.toHaveBeenCalled();
  });

  it('draft.add : editDraft avec le robot et l\'opération ; artifact : readArtifact ; proc.start : processOp start', async () => {
    await runCommand(agent, { command: 'draft.add', args: { target: 'a.ts:3', text: 'rm' }, door: 'agent' });
    expect(fake.draft).toHaveBeenCalledWith(agent, { add: { target: 'a.ts:3', text: 'rm' } });
    const res = await runCommand(agent, { command: 'artifact', args: { artifact: 'a1' }, door: 'agent' });
    expect(fake.artifact).toHaveBeenCalledWith(agent, 'a1');
    expect(res).toMatchObject({ ok: true, result: { name: 'a.md' } });
    await runCommand(agent, { command: 'proc.start', args: { name: 'dev' }, door: 'agent' });
    expect(fake.proc).toHaveBeenCalledWith(agent, expect.objectContaining({ agents: expect.any(Array) }), 'dev', 'start');
  });
});

describe('commandFromSocket : le robot de la cible, porte écran', () => {
  const env = (target: string) => ({ cmd: 'run.start', args: { action: 'forme' }, token: 't', target });
  const robots = (dirs: string[]) => {
    const list = dirs.map((dir, i) => ({ ...agent, id: `r${i}`, dir }));
    fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({ agentsEnabled: true, agents: list }));
    return list;
  };
  const dir = () => fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-target-')));

  it('le robot affiché s\'il est sur le dossier ; sinon le premier du dossier', async () => {
    const d = dir();
    const [first, second] = robots([d, d]);
    fake.shown = second;
    expect((await commandFromSocket(env(d))).ok).toBe(true);
    expect(fake.start.mock.calls[0][0]).toMatchObject({ id: second.id });
    fake.start.mockClear();
    fake.shown = { ...agent, id: 'ailleurs', dir: dir() };
    await commandFromSocket(env(d));
    expect(fake.start.mock.calls[0][0]).toMatchObject({ id: first.id });
  });

  it('un lien et son chemin réel (/home, /var/home) : le même dossier', async () => {
    const d = dir();
    const link = `${d}-lien`;
    fs.symlinkSync(d, link);
    const [r] = robots([link]);
    await commandFromSocket(env(d));
    expect(fake.start.mock.calls[0][0]).toMatchObject({ id: r.id });
  });

  it('aucun robot sur le dossier (ou dossier disparu) : no-survey, rien d\'appelé', async () => {
    robots([dir(), '/nulle/part/ici']);
    const res = await commandFromSocket(env(dir()));
    expect(res).toMatchObject({ ok: false, error: { code: 'no-survey' } });
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('porte écran : une commande fermée aux agents passe (run.allow)', async () => {
    const d = dir();
    robots([d]);
    await commandFromSocket({ cmd: 'run.allow', args: { action: 'forme' }, token: 't', target: d });
    expect(fake.run).toHaveBeenCalledWith(expect.objectContaining({ dir: d }), 'forme', 'allow');
  });
});
