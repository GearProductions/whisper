/** processes — l'onglet Processus de VibeCoder : les commandes qui lancent le
 *  projet de l'agent, lues dans son fichier du projet
 *  (userData/vibecoder/projets/<slug du dossier>.json, propre à la machine),
 *  lancées par l'appli (core/runner : par leur rang, dans le shell du fichier,
 *  dans la box de l'agent ; technicals/process : détachées, marquées, leur
 *  journal dans <sorties>/run/<nom>.log). Au relevé : la proposition du skill
 *  lancement (<sorties>/lancement.json) devient le fichier du projet s'il
 *  n'existe pas — jamais par-dessus —, les demandes de l'agent
 *  (<sorties>/run/<nom>.stop, .restart, pour un nom du fichier) sont faites,
 *  une commande retirée du fichier est arrêtée ; l'état et la fin du journal
 *  de chaque commande. Ce que demande la page : une commande par son rang
 *  dans le dernier relevé (lancer, arrêter, relancer, son journal dans
 *  l'éditeur), le fichier du projet dans l'éditeur (créé d'un exemple s'il
 *  manque). Quitter arrête tout ce qui a été lancé (app/lifecycle). Un échec
 *  ne bloque pas le relevé (I-29).
 *  Ne connaît pas : la page (seulement ses demandes), les fenêtres.
 *  Utilisé par : controllers/vibecoder, app/lifecycle. */
import fs from 'node:fs';
import path from 'node:path';
import type { VibeProcess } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import type { Config } from 'core/config';
import { commandAt, logTail, parseProject, projectSlug, projectText, requestsOf, type Project } from 'core/runner';
import { findEditor } from 'technicals/editor';
import { createProcesses, readTail, writeNew } from 'technicals/process';
import { vibeDir, vibeOutDir } from 'app/settings';

const LOG_BYTES = 32 * 1024;   // la fin du journal lue à chaque relevé…
const LOG_LINES = 200;         // … et ses dernières lignes, à l'écran
const READ_MAX = 1024 * 1024;
// « Modifier les commandes » sans fichier : un exemple, à remplacer.
const EXAMPLE = `${JSON.stringify({ commands: [{ name: 'dev', run: 'npm run dev' }] }, null, 2)}\n`;

const procs = createProcesses();
const key = (agentId: string, name: string) => `${agentId}/${name}`;
const logOf = (agentId: string, name: string) => path.join(vibeOutDir(agentId), 'run', `${name}.log`);

export const projectFile = (dir: string) => path.join(vibeDir(), 'projets', `${projectSlug(dir)}.json`);

// Un fichier ordinaire (pas un lien) d'au plus READ_MAX octets, ou null.
function readText(file: string) {
  try {
    const st = fs.lstatSync(file);
    return st.isFile() && st.size <= READ_MAX ? fs.readFileSync(file, 'utf8') : null;
  } catch { return null; }
}

// Lance la commande au rang `index` du fichier (déjà lancée : rien).
function launch(agent: AgentConfig, cfg: Config, p: Project | null, index: number) {
  const c = commandAt(p, index, cfg.agentCommand);
  if (c) procs.start(key(agent.id, c.name), { argv: c.argv, cwd: path.resolve(agent.dir, c.cwd ?? '.'), log: logOf(agent.id, c.name) });
}

// Au relevé : la proposition adoptée, les demandes de l'agent, l'état de chaque commande.
export function processView(agent: AgentConfig, cfg: Config): { processes: VibeProcess[]; projectFile: boolean } {
  try {
    const file = projectFile(agent.dir);
    const out = vibeOutDir(agent.id);
    const proposal = projectText(readText(path.join(out, 'lancement.json')));
    if (proposal) {
      writeNew(file, proposal);
      fs.rmSync(path.join(out, 'lancement.json'), { force: true });
    }
    const p = parseProject(readText(file));
    let files: string[] = [];
    try { files = fs.readdirSync(path.join(out, 'run')); } catch { /* rien de lancé */ }
    for (const r of requestsOf(files, p)) {
      fs.rmSync(path.join(out, 'run', r.file), { force: true });
      const stopped = procs.stop(key(agent.id, r.name));
      if (r.op === 'restart') stopped.then(() => launch(agent, cfg, p, p!.commands.findIndex((c) => c.name === r.name)));
    }
    const names = new Set(p?.commands.map((c) => c.name));
    for (const k of procs.keys()) {
      if (k.startsWith(`${agent.id}/`) && !names.has(k.slice(agent.id.length + 1)) && procs.state(k)?.status === 'running') procs.stop(k);
    }
    return {
      projectFile: fs.existsSync(file),
      processes: (p?.commands ?? []).map((c) => {
        const s = procs.state(key(agent.id, c.name));
        return {
          name: c.name, run: c.run, status: s?.status ?? 'stopped', since: s?.since ?? null, exit: s?.exit ?? null,
          log: logTail(readTail(logOf(agent.id, c.name), LOG_BYTES), LOG_LINES),
        };
      }),
    };
  } catch (err) {
    console.error(`VibeCoder : processus non relevés (${err instanceof Error ? err.message : err})`);
    return { processes: [], projectFile: false };
  }
}

// Ce que demande la page : 'edit' (le fichier du projet dans l'éditeur), ou
// une commande par son rang dans le dernier relevé (`shown`), qui doit être
// celle du fichier à ce rang : 'start', 'stop', 'restart', 'log' (son journal
// dans l'éditeur). Autre chose : rien.
export async function processAction(agent: AgentConfig, cfg: Config, op: unknown, index: unknown, shown: VibeProcess[]) {
  const file = projectFile(agent.dir);
  const open = (f: string) => { if (fs.existsSync(f)) findEditor(cfg.editorCommand)?.openFile(f); };
  if (op === 'edit') {
    writeNew(file, EXAMPLE);
    return open(file);
  }
  const p = parseProject(readText(file));
  const c = commandAt(p, index, cfg.agentCommand);
  if (!c || shown[index as number]?.name !== c.name) return;
  const k = key(agent.id, c.name);
  if (op === 'log') return open(logOf(agent.id, c.name));
  if (op === 'stop' || op === 'restart') await procs.stop(k);
  if (op === 'start' || op === 'restart') launch(agent, cfg, p, index as number);
}

// À la sortie : tout ce qui a été lancé, arrêté (SIGKILL après 5 s).
export const stopProcesses = () => procs.stopAll();
export const processesRunning = () => procs.running();
