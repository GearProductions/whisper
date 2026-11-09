// Le lancement de l'appli réelle pour les bancs (test:main-diff, test:contract) :
// un profil neuf (dossier temporaire donné à Electron en --user-data-dir), un
// projet git (un commit, une branche, une commande inoffensive) dont un agent
// « essai » est le robot affiché, Electron avec un port de débogage.
// Ne connaît pas : ce que le banc vérifie (scénario, comparaison, CLI).
// Utilisé par : tests/main-diff/run.mjs, tests/contract/run.mjs.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'ignore' });
export const git = (cwd, ...args) => run('git', ['-c', 'user.name=banc', '-c', 'user.email=banc@example.invalid', '-c', 'commit.gpgsign=false', ...args], cwd);

// launch({ appDir, name, port, agent, config, env, setup }) → { data, projet, app, stop, dispose }
// agent, config : ajoutés à l'agent « essai » et à config.json ; env : ajouté à l'environnement d'Electron ;
// setup(projet) : retouche le projet avant le lancement. stop : tue l'appli (une fois) ; dispose : stop, puis efface le profil.
export async function launch({ appDir, name, port, agent = {}, config = {}, env = {}, setup }) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), `whisper-main-diff-${name}-`));
  // Le projet : un dépôt git (un commit, une branche) et une commande inoffensive.
  const projet = path.join(data, 'projet');
  fs.mkdirSync(path.join(projet, '.vibecoder'), { recursive: true });
  fs.writeFileSync(path.join(projet, '.vibecoder/project.json'), JSON.stringify({ commands: [{ name: 'dormir', run: 'sleep 30' }] }));
  fs.writeFileSync(path.join(projet, 'README.md'), 'essai\n');
  git(projet, 'init', '-q', '-b', 'main');
  git(projet, 'add', 'README.md');
  git(projet, 'commit', '-q', '-m', 'initial');
  git(projet, 'branch', 'autre');
  await setup?.(projet);
  const model = path.join(ROOT, '.data/whisper');
  if (fs.existsSync(model)) fs.symlinkSync(model, path.join(data, 'whisper'));
  fs.writeFileSync(path.join(data, 'config.json'), JSON.stringify({
    agentSelected: 'a1',
    agents: [{ id: 'a1', dir: projet, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null, ...agent }],
    agentFolders: [{ dir: projet, color: '#22c55e' }],
    ...config,
  }));
  const app = spawn(path.join(ROOT, 'node_modules/.bin/electron'), ['.', `--user-data-dir=${data}`, `--remote-debugging-port=${port}`],
    { cwd: appDir, stdio: 'ignore', env: { ...process.env, ...env } });
  await sleep(4000);
  const stop = async () => { if (app.exitCode === null && app.signalCode === null) { app.kill(); await new Promise((r) => app.once('exit', r)); } };
  const dispose = async () => { await stop(); fs.rmSync(data, { recursive: true, force: true }); };
  return { data, projet, app, stop, dispose };
}
