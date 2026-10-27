/** processes — l'onglet Processus de VibeCoder : les commandes qui lancent le
 *  projet de l'agent, lues dans le fichier du projet de sa famille :
 *  <dossier du parent>/.vibecoder/project.json (homeOf : le dossier de core/family
 *  familyOwner, le parent présent ; un enfant reprend les commandes de son
 *  parent et les lance dans son propre dossier ; un enfant dont le parent est
 *  parti n'a pas de projet : relevé vide, 'edit' et 'setup' ne font rien —
 *  jamais le fichier d'un worktree). À la première lecture d'un dossier dans la
 *  session (projectFile) : l'ancien fichier userData/vibecoder/projets/<slug du
 *  dossier>.json copié s'il n'y a rien dans .vibecoder/ (l'ancien gardé), et
 *  .vibecoder/ ajouté à <dossier>/.git/info/exclude si .git y est un dossier et
 *  que la ligne n'y est pas (core/runner withExclude).
 *  Les commandes, lancées par l'appli (core/runner : par leur rang, dans le shell du fichier,
 *  après le préfixe — celui du fichier, du réglage, ou la box de l'agent —,
 *  le même pour gh : agentPrefix ; vu de l'agent, sans la box où il tourne
 *  déjà, pour le message d'une action : promptPrefix ; technicals/process : détachées, marquées, leur
 *  journal dans <sorties>/run/<nom>.log). Au relevé : la proposition du skill
 *  lancement (<sorties>/lancement.json) devient le fichier du projet s'il
 *  n'existe pas ; s'il existe, seules ses commandes de nom nouveau, et son
 *  setup, son worktree si le fichier n'en a pas, s'y ajoutent (core/runner
 *  mergeProject ; rien de nouveau : pas réécrit) ; la
 *  proposition supprimée dans les deux cas ; les demandes de l'agent
 *  (<sorties>/run/<nom>.stop, .restart, pour un nom du fichier) sont faites,
 *  une commande retirée du fichier est arrêtée ; l'état et la fin du journal
 *  de chaque commande ; si le fichier a un setup ; la recette de la famille
 *  (controllers/recipe recipeView). Ce que demande la page : une commande par son rang
 *  dans le dernier relevé (lancer, arrêter, relancer, son journal dans
 *  l'éditeur), le fichier du projet dans l'éditeur (créé d'un exemple s'il
 *  manque), 'setup' : préparer le projet (controllers/recipe prepare, sans
 *  l'attendre ; un fichier sans setup : rien). Une commande ne tourne qu'à un endroit par famille (core/family
 *  heldBy) : depuis la page, la boîte de dialogue « <nom> tourne dans
 *  <branche> : l'arrêter et le lancer ici ? » (Oui : arrêtée là-bas, puis
 *  lancée ici ; Non : rien) ; une demande .restart de l'agent retenue
 *  ailleurs : pas lancée. Quitter arrête tout ce qui a été lancé
 *  (app/lifecycle) ; retirer un agent, ses commandes (I-47). Un échec ne bloque pas le relevé (I-29).
 *  Ne connaît pas : la page (seulement ses demandes), les fenêtres (la boîte
 *  de dialogue sans parent), git (la branche lue sur le disque).
 *  Utilisé par : controllers/vibecoder (et projectAt, readTimed, readFile), controllers/agents
 *  (et readFile), controllers/module-code (readTimed, READ_MAX),
 *  controllers/recipe (projectAt, homeOf, readFile), app/menus (readFile),
 *  app/lifecycle. */
import fs from 'node:fs';
import path from 'node:path';
import type { VibeProcess, VibeRecipe } from 'shared/bridge';
import { dialog } from 'electron';
import type { AgentConfig } from 'core/agents';
import { agentList, type Config } from 'core/config';
import { branchOf, familyOwner, heldBy } from 'core/family';
import { agentSidePrefix, commandAt, commandPrefix, logTail, mergeProject, parseProject, projectPath, projectSlug, projectText, requestsOf, withExclude, type Project } from 'core/runner';
import { findEditor } from 'technicals/editor';
import { createProcesses, readTail, writeNew } from 'technicals/process';
import { vibeDir, vibeOutDir } from 'app/settings';
import { prepare, recipeView } from './recipe';

const LOG_BYTES = 32 * 1024;   // la fin du journal lue à chaque relevé…
const LOG_LINES = 200;         // … et ses dernières lignes, à l'écran
// « Modifier les commandes » sans fichier : un exemple, à remplacer.
const EXAMPLE = `${JSON.stringify({ commands: [{ name: 'dev', run: 'npm run dev' }] }, null, 2)}\n`;

const procs = createProcesses();
const key = (agentId: string, name: string) => `${agentId}/${name}`;
const logOf = (agentId: string, name: string) => path.join(vibeOutDir(agentId), 'run', `${name}.log`);

// Les dossiers déjà vus dans la session (l'ancien fichier repris, l'exclusion écrite).
const seenHomes = new Set<string>();

// Le fichier du projet du dossier `home` ; à sa première lecture dans la
// session : l'ancien fichier (userData/vibecoder/projets/<slug>.json) copié
// s'il n'y a rien (l'ancien gardé), .vibecoder/ ajouté à .git/info/exclude
// (la copie principale : .git est un dossier).
export function projectFile(home: string) {
  const file = projectPath(home);
  if (seenHomes.has(home)) return file;
  seenHomes.add(home);
  try {
    const old = readFile(path.join(vibeDir(), 'projets', `${projectSlug(home)}.json`));
    if (old !== null) writeNew(file, old);
    if (fs.statSync(path.join(home, '.git')).isDirectory()) {
      const exclude = path.join(home, '.git', 'info', 'exclude');
      const next = withExclude(fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : null);
      if (next !== null) {
        fs.mkdirSync(path.dirname(exclude), { recursive: true });
        fs.writeFileSync(exclude, next);
      }
    }
  } catch { /* pas de .git, ou illisible : rien (I-29) */ }
  return file;
}

// Le dossier du parent de la famille de `agent` (familyOwner) ; null : un
// enfant dont le parent est parti, il n'a pas de projet.
export const homeOf = (agent: AgentConfig, cfg: Config) => familyOwner(agent, agentList(cfg))?.dir ?? null;

const isRunning = (agentId: string, name: string) => procs.state(key(agentId, name))?.status === 'running';
// Où `name` tourne dans la famille de l'agent, lui excepté.
const holderOf = (agent: AgentConfig, cfg: Config, name: string) => heldBy(name, agent, agentList(cfg), isRunning);

// Lance la commande au rang `index` du fichier (déjà lancée ici, ou ailleurs
// dans la famille : rien).
function launch(agent: AgentConfig, cfg: Config, p: Project | null, index: number) {
  const c = commandAt(p, index, cfg.agentCommand, cfg.vibeCommandPrefix);
  if (c && !holderOf(agent, cfg, c.name)) procs.start(key(agent.id, c.name), { argv: c.argv, cwd: path.resolve(agent.dir, c.cwd ?? '.'), log: logOf(agent.id, c.name) });
}

// Le fichier du projet d'un agent : celui du dossier du parent ; null sans parent présent.
const familyFile = (agent: AgentConfig, cfg: Config) => {
  const home = homeOf(agent, cfg);
  return home ? projectFile(home) : null;
};
export const READ_MAX = 1024 * 1024;  // un fichier plus gros n'est pas lu

// Un fichier ordinaire (pas un lien) d'au plus READ_MAX octets : son texte et
// son heure ; null s'il manque ou ne se lit pas.
export function readTimed(file: string) {
  try {
    const st = fs.lstatSync(file);
    return st.isFile() && st.size <= READ_MAX ? { text: fs.readFileSync(file, 'utf8'), time: st.mtimeMs } : null;
  } catch { return null; }
}
// Son texte seul.
export const readFile = (file: string) => readTimed(file)?.text ?? null;

const readProject = (file: string | null) => (file ? parseProject(readFile(file)) : null);
// Le projet du dossier `home` (son fichier dans .vibecoder/) ; null sans fichier valide.
export const projectAt = (home: string) => readProject(projectFile(home));
const projectOf = (agent: AgentConfig, cfg: Config) => readProject(familyFile(agent, cfg));

// Ce qui précède gh pour cet agent : comme ses commandes (core/runner, commandPrefix).
export const agentPrefix = (agent: AgentConfig, cfg: Config) =>
  commandPrefix(projectOf(agent, cfg), cfg.vibeCommandPrefix, cfg.agentCommand);

// Le préfixe vu de l'agent, pour le message d'une action ({{prefix}}) : les
// mêmes mots sans la box où il tourne déjà (agentSidePrefix), joints par des espaces.
export const promptPrefix = (agent: AgentConfig, cfg: Config) =>
  agentSidePrefix(projectOf(agent, cfg), cfg.vibeCommandPrefix, cfg.agentCommand).join(' ');

// Au relevé : la proposition adoptée (ou fusionnée), les demandes de l'agent, l'état de chaque commande.
// Sans dossier du parent : aucune commande (celles qui tournaient, arrêtées).
export function processView(agent: AgentConfig, cfg: Config): { processes: VibeProcess[]; projectFile: boolean; setup: boolean; recipe: VibeRecipe | null } {
  try {
    const file = familyFile(agent, cfg);
    const out = vibeOutDir(agent.id);
    const proposal = file && projectText(readFile(path.join(out, 'lancement.json')));
    if (file && proposal) {
      const current = writeNew(file, proposal) ? null : readFile(file);
      const merged = current === null ? null : mergeProject(current, proposal);
      if (merged) fs.writeFileSync(file, merged);
      fs.rmSync(path.join(out, 'lancement.json'), { force: true });
    }
    const p = readProject(file);
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
      projectFile: !!file && fs.existsSync(file),
      setup: !!p?.setup,
      recipe: recipeView(agent, cfg),
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
    return { processes: [], projectFile: false, setup: false, recipe: null };
  }
}

// Ce que demande la page : 'edit' (le fichier du projet dans l'éditeur),
// 'setup' (préparer le projet, sans l'attendre : la recette au relevé), ou
// une commande par son rang dans le dernier relevé (`shown`), qui doit être
// celle du fichier à ce rang : 'start', 'stop', 'restart', 'log' (son journal
// dans l'éditeur). Autre chose : rien.
export async function processAction(agent: AgentConfig, cfg: Config, op: unknown, index: unknown, shown: VibeProcess[]) {
  const file = familyFile(agent, cfg);
  if (!file) return;
  const open = (f: string) => { if (fs.existsSync(f)) findEditor(cfg.editorCommand)?.openFile(f); };
  if (op === 'edit') {
    writeNew(file, EXAMPLE);
    return open(file);
  }
  const p = readProject(file);
  if (op === 'setup') {
    if (p?.setup) void prepare(agent, cfg);
    return;
  }
  const c = commandAt(p, index, cfg.agentCommand, cfg.vibeCommandPrefix);
  if (!c || shown[index as number]?.name !== c.name) return;
  const k = key(agent.id, c.name);
  if (op === 'log') return open(logOf(agent.id, c.name));
  const holder = op === 'start' || op === 'restart' ? holderOf(agent, cfg, c.name) : null;
  if (holder) {
    const { response } = await dialog.showMessageBox({
      type: 'question', buttons: ['Non', 'Arrêter et lancer ici'], defaultId: 0, cancelId: 0,
      message: `${c.name} tourne dans ${branchOf(holder.dir, readFile) ?? holder.name} : l'arrêter et le lancer ici ?`,
    });
    if (response !== 1) return;
    await procs.stop(key(holder.id, c.name));
  }
  if (op === 'stop' || op === 'restart') await procs.stop(k);
  if (op === 'start' || op === 'restart') launch(agent, cfg, p, index as number);
}

// À la sortie : tout ce qui a été lancé, arrêté (SIGKILL après 5 s).
export const stopProcesses = () => procs.stopAll();
export const processesRunning = () => procs.running();

// Un agent retiré : ses commandes, arrêtées (heldBy ne cherche que parmi les
// agents présents : elles tourneraient en double, I-47).
export const stopAgentProcesses = (agentId: string) => {
  for (const k of procs.keys()) if (k.startsWith(`${agentId}/`)) procs.stop(k);
};
