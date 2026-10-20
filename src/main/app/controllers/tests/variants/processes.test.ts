// Variants de l'onglet Processus (note 0.8.0, « Lancer le projet ») : sur le
// vrai contrôleur, de vrais processus (bash -ic), un userData temporaire ;
// faux : Electron (le dossier userData), l'éditeur (relève ce qu'on ouvre).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from 'core/agents';
import { withDefaults } from 'core/config';

const fake = vi.hoisted(() => ({ userData: '', edited: [] as string[] }));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData } }));
vi.mock('technicals/editor', () => ({ findEditor: () => ({ openFile: (file: string) => { fake.edited.push(file); } }) }));

const { processAction, processView, projectFile, promptPrefix, stopProcesses } = await import('app/controllers/processes');

const until = async (ok: () => boolean, ms = 8000) => {
  for (const end = Date.now() + ms; !ok() && Date.now() < end;) await new Promise((r) => setTimeout(r, 50));
  return ok();
};
const cfg = withDefaults({});
let agent: AgentConfig;
let n = 0;

beforeEach(() => {
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-processus-'));
  fake.edited = [];
  const dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir);
  agent = { id: `a${n++}`, dir, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null };
});
afterAll(async () => { await stopProcesses(); });

const writeProject = (commands: unknown[]) => {
  fs.mkdirSync(path.dirname(projectFile(agent.dir)), { recursive: true });
  fs.writeFileSync(projectFile(agent.dir), JSON.stringify({ commands }));
};
const out = () => path.join(fake.userData, 'vibecoder-out', agent.id);
const view = () => processView(agent, cfg);

describe.skipIf(process.platform === 'win32')('lancer, lire, arrêter', () => {
  it('une commande du fichier : lancée par son rang, son journal à l’écran, arrêtée', async () => {
    // bash -i ignore SIGTERM : la boucle finit son tour (sleep tué), puis bash sort.
    writeProject([{ name: 'tic', run: 'for i in 1 2 3; do echo tick $i; sleep 1; done' }]);
    expect(view()).toMatchObject({ projectFile: true, processes: [{ name: 'tic', status: 'stopped', since: null, log: '' }] });
    await processAction(agent, cfg, 'start', 0, view().processes);
    expect(view().processes[0]).toMatchObject({ status: 'running', since: expect.any(Number) });
    expect(await until(() => view().processes[0].log.endsWith('tick 2'))).toBe(true);
    await processAction(agent, cfg, 'stop', 0, view().processes);
    expect(await until(() => view().processes[0].status === 'stopped')).toBe(true);
    expect(view().processes[0].log).toMatch(/tick 1\ntick 2/);
    expect(fs.readFileSync(path.join(out(), 'run', 'tic.log'), 'utf8')).toMatch(/tick 1\ntick 2/);
  }, 15000);

  it('un rang qui n’est plus celui du relevé (fichier changé entre-temps) : rien', async () => {
    writeProject([{ name: 'a', run: 'sleep 30' }]);
    const shown = view().processes;
    writeProject([{ name: 'b', run: 'sleep 30' }]);
    await processAction(agent, cfg, 'start', 0, shown);
    expect(view().processes[0]).toMatchObject({ name: 'b', status: 'stopped' });
  });

  it('l’agent demande l’arrêt par <nom>.stop : fait au relevé, la demande retirée', async () => {
    writeProject([{ name: 'srv', run: 'sleep 30' }]);
    await processAction(agent, cfg, 'start', 0, view().processes);
    fs.writeFileSync(path.join(out(), 'run', 'srv.stop'), '');
    view();
    expect(fs.existsSync(path.join(out(), 'run', 'srv.stop'))).toBe(false);
    expect(await until(() => view().processes[0].status === 'stopped')).toBe(true);
  }, 15000); // arrêt réel (SIGTERM, puis SIGKILL après 5 s) : lent sur une machine chargée
});

describe('le fichier du projet', () => {
  it('la proposition du skill : adoptée s’il n’y a pas de fichier', () => {
    fs.mkdirSync(out(), { recursive: true });
    fs.writeFileSync(path.join(out(), 'lancement.json'), '{"commands":[{"name":"dev","run":"npm run dev"}]}');
    expect(view()).toMatchObject({ projectFile: true, processes: [{ name: 'dev', run: 'npm run dev' }] });
    expect(fs.existsSync(path.join(out(), 'lancement.json'))).toBe(false);
  });

  it('la proposition ne remplace jamais un fichier existant', () => {
    writeProject([{ name: 'gear', run: 'gear' }]);
    const before = fs.readFileSync(projectFile(agent.dir), 'utf8');
    fs.mkdirSync(out(), { recursive: true });
    fs.writeFileSync(path.join(out(), 'lancement.json'), '{"commands":[{"name":"dev","run":"npm run dev"}]}');
    expect(view().processes.map((p) => p.name)).toEqual(['gear']);
    expect(fs.readFileSync(projectFile(agent.dir), 'utf8')).toBe(before);
  });

  it('Modifier les commandes : le fichier dans l’éditeur, un exemple s’il manque, jamais par-dessus', async () => {
    await processAction(agent, cfg, 'edit', undefined, []);
    expect(fake.edited).toEqual([projectFile(agent.dir)]);
    expect(view().processes.map((p) => p.name)).toEqual(['dev']);
    fs.writeFileSync(projectFile(agent.dir), '{"commands":[]}');
    await processAction(agent, cfg, 'edit', undefined, []);
    expect(fs.readFileSync(projectFile(agent.dir), 'utf8')).toBe('{"commands":[]}');
  });

  it('dans userData/vibecoder/projets/, d’après le dossier de l’agent', () => {
    expect(path.dirname(projectFile(agent.dir))).toBe(path.join(fake.userData, 'vibecoder', 'projets'));
  });

  it('promptPrefix : le préfixe vu de l’agent — vide dans sa box, celui du fichier sinon', () => {
    const box = withDefaults({ agentCommand: 'distrobox enter dev -- mise exec -- claude' });
    expect(promptPrefix(agent, box)).toBe('');
    expect(promptPrefix(agent, withDefaults({ ...box, vibeCommandPrefix: 'distrobox enter dev -- mise exec --' }))).toBe('mise exec --');
    fs.mkdirSync(path.dirname(projectFile(agent.dir)), { recursive: true });
    fs.writeFileSync(projectFile(agent.dir), JSON.stringify({ commands: [], prefix: 'toolbox run' }));
    expect(promptPrefix(agent, box)).toBe('toolbox run');
  });
});
