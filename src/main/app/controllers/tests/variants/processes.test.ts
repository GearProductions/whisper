// Variants de l'onglet Processus (note 0.8.0, « Lancer le projet ») : sur le
// vrai contrôleur, de vrais processus (bash -ic), un userData temporaire ;
// faux : Electron (le dossier userData, la boîte de dialogue : relève ses
// questions, répond Non), l'éditeur (relève ce qu'on ouvre).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from 'core/agents';
import { withDefaults } from 'core/config';
import { projectSlug } from 'core/runner';

const fake = vi.hoisted(() => ({ userData: '', edited: [] as string[], asked: [] as string[] }));
vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  dialog: { showMessageBox: async (o: { message: string }) => { fake.asked.push(o.message); return { response: 0 }; } },
}));
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
  fake.asked = [];
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

  // 0.11.0 : fichier existant, la proposition n'y ajoute que ses commandes
  // de nom nouveau ; celles qui y sont restent telles quelles.
  it('la fusion d’une proposition : seules les commandes nouvelles ajoutées ; rien de nouveau : pas réécrit ; supprimée dans les deux cas', () => {
    const propose = (commands: unknown[]) => {
      fs.mkdirSync(out(), { recursive: true });
      fs.writeFileSync(path.join(out(), 'lancement.json'), JSON.stringify({ commands }));
    };
    writeProject([{ name: 'gear', run: 'gear --mine' }]);
    propose([{ name: 'gear', run: 'gear' }, { name: 'dev', run: 'npm run dev' }]);
    expect(view().processes.map((p) => [p.name, p.run])).toEqual([['gear', 'gear --mine'], ['dev', 'npm run dev']]);
    expect(fs.existsSync(path.join(out(), 'lancement.json'))).toBe(false);

    const before = fs.readFileSync(projectFile(agent.dir), 'utf8');
    const time = new Date(2000, 0, 1);
    fs.utimesSync(projectFile(agent.dir), time, time);
    propose([{ name: 'dev', run: 'yarn dev' }]);
    view();
    expect(fs.readFileSync(projectFile(agent.dir), 'utf8')).toBe(before);
    expect(fs.statSync(projectFile(agent.dir)).mtimeMs).toBe(time.getTime());
    expect(fs.existsSync(path.join(out(), 'lancement.json'))).toBe(false);
  });

  it('Modifier les commandes : le fichier dans l’éditeur, un exemple s’il manque, jamais par-dessus', async () => {
    await processAction(agent, cfg, 'edit', undefined, []);
    expect(fake.edited).toEqual([projectFile(agent.dir)]);
    expect(view().processes.map((p) => p.name)).toEqual(['dev']);
    fs.writeFileSync(projectFile(agent.dir), '{"commands":[]}');
    await processAction(agent, cfg, 'edit', undefined, []);
    expect(fs.readFileSync(projectFile(agent.dir), 'utf8')).toBe('{"commands":[]}');
  });

  // 0.11.0, « Processus : reproduire d'abord » : enregistré sur place ou par
  // renommage, le fichier est relu à chaque relevé (vert) ; ce qui manquait est
  // la commande elle-même, au nom à espace (le cas réel : « install deps »).
  it('une commande ajoutée au fichier, au nom à espace : au relevé suivant', () => {
    writeProject([{ name: 'gear', run: 'gear' }]);
    expect(view().processes).toHaveLength(1);
    writeProject([{ name: 'gear', run: 'gear' }, { name: 'install deps', run: 'yarn install' }]);
    expect(view().processes.map((p) => p.name)).toEqual(['gear', 'install deps']);
  });

  // 0.12.0 : le fichier quitte userData pour <dossier du parent>/.vibecoder/.
  it('dans <dossier>/.vibecoder/project.json', () => {
    expect(projectFile(agent.dir)).toBe(path.join(agent.dir, '.vibecoder', 'project.json'));
  });

  it('l’ancien fichier de userData : repris s’il n’y a rien dans .vibecoder/, gardé ; jamais par-dessus', () => {
    const old = (dir: string) => path.join(fake.userData, 'vibecoder', 'projets', `${projectSlug(dir)}.json`);
    fs.mkdirSync(path.dirname(old(agent.dir)), { recursive: true });
    fs.writeFileSync(old(agent.dir), '{"commands":[{"name":"ancien","run":"true"}]}');
    expect(view().processes.map((p) => p.name)).toEqual(['ancien']);
    expect(fs.existsSync(old(agent.dir))).toBe(true);

    const other = path.join(fake.userData, 'autre');
    fs.mkdirSync(other);
    fs.writeFileSync(old(other), '{"commands":[{"name":"ancien","run":"true"}]}');
    fs.mkdirSync(path.join(other, '.vibecoder'));
    fs.writeFileSync(path.join(other, '.vibecoder', 'project.json'), '{"commands":[{"name":"nouveau","run":"true"}]}');
    expect(processView({ ...agent, id: `${agent.id}-autre`, dir: other }, cfg).processes.map((p) => p.name)).toEqual(['nouveau']);
  });

  it('.vibecoder/ ajouté à .git/info/exclude d’une copie principale, une seule fois ; rien sans .git dossier', () => {
    const exclude = path.join(agent.dir, '.git', 'info', 'exclude');
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    fs.writeFileSync(exclude, '# git ls-files\n*.log');
    view();
    expect(fs.readFileSync(exclude, 'utf8')).toBe('# git ls-files\n*.log\n.vibecoder/\n');

    const done = path.join(fake.userData, 'deja');
    fs.mkdirSync(path.join(done, '.git', 'info'), { recursive: true });
    fs.writeFileSync(path.join(done, '.git', 'info', 'exclude'), '/.vibecoder/\n');
    projectFile(done);
    expect(fs.readFileSync(path.join(done, '.git', 'info', 'exclude'), 'utf8')).toBe('/.vibecoder/\n');

    const wt = path.join(fake.userData, 'wt');
    fs.mkdirSync(wt);
    fs.writeFileSync(path.join(wt, '.git'), 'gitdir: /ailleurs\n');
    projectFile(wt);
    expect(fs.readFileSync(path.join(wt, '.git'), 'utf8')).toBe('gitdir: /ailleurs\n');
  });

  it('setup : montré si le fichier en a un ; « setup » lance la recette, sans fichier à setup : rien', async () => {
    writeProject([]);
    await processAction(agent, cfg, 'setup', undefined, []);
    expect(view()).toMatchObject({ setup: false, recipe: null });
    // un fichier relatif : il atterrit au dossier de l'agent (pwd donnerait un chemin POSIX sous Windows)
    const seen = path.join(agent.dir, 'seen.txt');
    fs.writeFileSync(projectFile(agent.dir), JSON.stringify({ commands: [], setup: ['echo vu > seen.txt'] }));
    expect(view().setup).toBe(true);
    await processAction(agent, cfg, 'setup', undefined, []);
    expect(await until(() => view().recipe?.running === false)).toBe(true);
    expect(view().recipe).toMatchObject({ op: 'setup', last: { ok: true } });
    expect(fs.readFileSync(seen, 'utf8').trim()).toBe('vu');
  }, 15000);

  it('promptPrefix : le préfixe vu de l’agent — vide dans sa box, celui du fichier sinon', () => {
    const box = withDefaults({ agentCommand: 'distrobox enter dev -- mise exec -- claude' });
    expect(promptPrefix(agent, box)).toBe('');
    expect(promptPrefix(agent, withDefaults({ ...box, vibeCommandPrefix: 'distrobox enter dev -- mise exec --' }))).toBe('mise exec --');
    fs.mkdirSync(path.dirname(projectFile(agent.dir)), { recursive: true });
    fs.writeFileSync(projectFile(agent.dir), JSON.stringify({ commands: [], prefix: 'toolbox run' }));
    expect(promptPrefix(agent, box)).toBe('toolbox run');
  });
});

describe.skipIf(process.platform === 'win32')('une famille : le fichier de la tête, le dossier de chacun', () => {
  // Le parent sur `projet`, l'enfant sur un worktree (sa branche lue par .git → HEAD).
  const family = () => {
    const parent = agent;
    const dir = path.join(fake.userData, 'feat-a');
    const gitDir = path.join(fake.userData, 'projet', '.git', 'worktrees', 'feat-a');
    fs.mkdirSync(dir);
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.git'), `gitdir: ${gitDir}\n`);
    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/feat/a\n');
    const child: AgentConfig = { ...parent, id: `${parent.id}-enfant`, dir, name: 'enfant', parent: { id: parent.id } };
    return { parent, child, fam: withDefaults({ agents: [parent, child] }) };
  };

  it('l’enfant : les commandes du parent, lancées dans son dossier ; sa proposition et Modifier vont au fichier du parent', async () => {
    const { child, fam } = family();
    fs.mkdirSync(path.join(fake.userData, 'vibecoder-out', child.id), { recursive: true });
    fs.writeFileSync(path.join(fake.userData, 'vibecoder-out', child.id, 'lancement.json'), '{"commands":[{"name":"ici","run":"pwd"}]}');
    expect(processView(child, fam).processes.map((p) => p.name)).toEqual(['ici']);
    expect(fs.existsSync(projectFile(agent.dir))).toBe(true);
    await processAction(child, fam, 'start', 0, processView(child, fam).processes);
    expect(await until(() => processView(child, fam).processes[0].log.split('\n').includes(child.dir))).toBe(true);
    await processAction(child, fam, 'edit', undefined, []);
    expect(fake.edited).toEqual([projectFile(agent.dir)]);
  }, 15000);

  it('le parent parti : aucune commande (celles qui tournaient, arrêtées), Modifier ne crée rien', async () => {
    writeProject([{ name: 'srv', run: 'sleep 30' }]);
    const { child, fam } = family();
    await processAction(child, fam, 'start', 0, processView(child, fam).processes);
    const alone = withDefaults({ agents: [child] });
    expect(processView(child, alone)).toMatchObject({ processes: [], projectFile: false, setup: false, recipe: null });
    await processAction(child, alone, 'edit', undefined, []);
    expect(fake.edited).toEqual([]);
    expect(fs.existsSync(path.join(child.dir, '.vibecoder'))).toBe(false);
    expect(await until(() => processView(child, fam).processes[0].status === 'stopped')).toBe(true);
  }, 15000);

  it('tenue ailleurs : la question nomme la branche (sinon le nom), Non : rien', async () => {
    writeProject([{ name: 'srv', run: 'sleep 30' }]);
    const { parent, child, fam } = family();
    await processAction(child, fam, 'start', 0, processView(child, fam).processes);
    await processAction(parent, fam, 'start', 0, processView(parent, fam).processes);
    expect(fake.asked).toEqual(['srv tourne dans feat/a : l\'arrêter et le lancer ici ?']);
    expect(processView(parent, fam).processes[0].status).toBe('stopped');
    fs.rmSync(path.join(child.dir, '.git'));
    await processAction(parent, fam, 'restart', 0, processView(parent, fam).processes);
    expect(fake.asked.at(-1)).toBe('srv tourne dans enfant : l\'arrêter et le lancer ici ?');
    expect(processView(parent, fam).processes[0].status).toBe('stopped');
    await processAction(child, fam, 'stop', 0, processView(child, fam).processes);
  }, 15000);
});
