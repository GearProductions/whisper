/** runner — les commandes qui lancent le projet d'un agent (onglet Processus
 *  de VibeCoder), lues dans son fichier du projet (`{ commands: [{ name, run,
 *  cwd? }], shell?, prefix?, setup?, worktree?: { create?, remove?, dir? } }`,
 *  écrit par l'utilisateur ou adopté d'une
 *  proposition ; fichier existant : la proposition n'y ajoute que ses commandes
 *  de nom nouveau, et `setup`, `worktree` si le fichier n'a pas encore la clé,
 *  jamais par-dessus : mergeProject, I-42 ; `prWorktree`, `featureWorktree`,
 *  retirés en 0.12.0 (F-111) : ignorés s'il les a encore). Une commande se désigne par son rang dans ce fichier, jamais
 *  par un texte : son argv est le préfixe (commandPrefix : celui du fichier,
 *  sinon le réglage vibeCommandPrefix, sinon la box de l'agent si sa commande
 *  passe par `distrobox enter <box> --` ; le même pour gh), puis le shell du
 *  fichier (`bash -ic` par défaut : alias et fonctions de l'utilisateur ;
 *  seule exception à I-27, limitée à ces commandes et à la recette). Les demandes de l'agent (<nom>.stop,
 *  <nom>.restart) ne valent que pour les noms du fichier. La fin d'un journal,
 *  sans couleurs. Le préfixe vu de l'agent (agentSidePrefix) : le même, sans
 *  la box où il tourne déjà.
 *  Ne connaît pas : le disque, les processus, Electron.
 *  Utilisé par : app/controllers (processes, recipe), core/runner/recipe (et vibecoder : le préfixe de gh, celui vu de l'agent). */
import { splitCommand } from 'helpers';

export type ProjectCommand = { name: string; run: string; cwd?: string };
export type Project = {
  commands: ProjectCommand[]; shell: string[]; prefix?: string;
  setup?: string[]; worktree?: { create?: string; remove?: string; dir?: string };
};
export type Request = { name: string; op: 'stop' | 'restart'; file: string };

export const DEFAULT_SHELL = ['bash', '-ic'];
const NAME = /^[A-Za-z0-9](?:[\w. -]{0,38}[\w.-])?$/;   // il nomme un fichier : <nom>.log ; des espaces au milieu
const RUN_MAX = 4000;
const okText = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= max && !v.includes('\0');

// Le fichier du projet (JSON) → ses commandes valides, dans leur ordre (une
// entrée mal formée ou un nom déjà vu : ignorés), et ses autres clés valides
// (une valeur mal formée : ignorée, comme absente) ; null s'il manque ou n'est
// pas un objet à liste `commands`.
export function parseProject(text: string | null | undefined): Project | null {
  let raw: unknown;
  try { raw = JSON.parse(text ?? ''); } catch { return null; }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { commands?: unknown }).commands)) return null;
  const { commands, shell, prefix, setup, worktree } = raw as Record<string, unknown> & { commands: unknown[] };
  const names = new Set<string>();
  const list = commands.flatMap((c): ProjectCommand[] => {
    const { name, run, cwd } = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    if (typeof name !== 'string' || !NAME.test(name) || names.has(name) || !okText(run, RUN_MAX)
      || (cwd !== undefined && !okText(cwd, 1000))) return [];
    names.add(name);
    return [cwd === undefined ? { name, run } : { name, run, cwd }];
  });
  const okShell = Array.isArray(shell) && shell.length > 0 && shell.length <= 5 && shell.every((s) => okText(s, 200));
  const own = typeof prefix === 'string' && prefix.length <= 1000 && !prefix.includes('\0') ? { prefix } : {};
  // setup : une liste ordonnée, gardée entière ou pas du tout (une étape qui manque fausserait la suite).
  const okSetup = Array.isArray(setup) && setup.length > 0 && setup.every((s) => okText(s, RUN_MAX));
  const w = (worktree && typeof worktree === 'object' ? worktree : {}) as Record<string, unknown>;
  const recipe = Object.fromEntries((['create', 'remove', 'dir'] as const)
    .filter((k) => okText(w[k], k === 'dir' ? 1000 : RUN_MAX)).map((k) => [k, w[k] as string]));
  return {
    commands: list, shell: okShell ? shell as string[] : DEFAULT_SHELL, ...own,
    ...(okSetup ? { setup: setup as string[] } : {}),
    ...(Object.keys(recipe).length ? { worktree: recipe } : {}),
  };
}

// Une proposition (<out>/lancement.json) → le texte du fichier du projet, ou
// null si elle n'a ni commande, ni setup, ni worktree valides. Jamais son
// `prefix` : il précède aussi les appels à gh, faits sans clic ; seul
// l'utilisateur l'écrit.
export function projectText(text: string | null | undefined): string | null {
  const p = parseProject(text);
  if (!p || (!p.commands.length && !p.setup && !p.worktree)) return null;
  const shell = p.shell === DEFAULT_SHELL ? {} : { shell: p.shell };
  return `${JSON.stringify({ commands: p.commands, ...shell, setup: p.setup, worktree: p.worktree }, null, 2)}\n`;
}

// Le fichier existant (current) et une proposition → le texte du fichier :
// son objet JSON tel quel (champs inconnus, commandes invalides compris), plus,
// à la fin de commands, les commandes valides de la proposition dont le nom n'y
// est pas, et son `setup`, son `worktree` valides si le fichier n'a pas la clé
// (même mal formée : jamais par-dessus, I-42) ; null s'il n'y a rien de nouveau
// ou si le fichier est illisible (il appartient à l'utilisateur : jamais
// réécrit). Jamais le `prefix`, ni le `shell` de la proposition.
export function mergeProject(current: string, proposal: string): string | null {
  if (!parseProject(current)) return null;
  const raw = JSON.parse(current) as Record<string, unknown> & { commands: unknown[] };
  const p = parseProject(proposal);
  const taken = new Set(raw.commands.map((c) => (c && typeof c === 'object' ? (c as { name?: unknown }).name : undefined)));
  const added = (p?.commands ?? []).filter((c) => !taken.has(c.name));
  const keys = (['setup', 'worktree'] as const).filter((k) => p?.[k] && !(k in raw));
  if (!added.length && !keys.length) return null;
  raw.commands.push(...added);
  for (const k of keys) raw[k] = p![k];
  return `${JSON.stringify(raw, null, 2)}\n`;
}

// `distrobox enter <box> … --` en tête de la commande de l'agent : ce préfixe ; sinon [].
export function boxPrefix(agentCommand: unknown): string[] {
  const argv = splitCommand(agentCommand);
  const end = argv.indexOf('--');
  return /(^|[\\/])distrobox$/.test(argv[0] ?? '') && argv[1] === 'enter' && end > 1 ? argv.slice(0, end + 1) : [];
}

// Ce qui précède une commande lancée pour le projet (ses commandes, gh) : le
// `prefix` du fichier du projet s'il en a un ('' : aucun) ; sinon le réglage
// vibeCommandPrefix s'il n'est pas vide ; sinon la box de l'agent (boxPrefix).
export function commandPrefix(project: Project | null, setting: unknown, agentCommand: unknown): string[] {
  if (project?.prefix !== undefined) return splitCommand(project.prefix);
  const own = splitCommand(setting);
  return own.length ? own : boxPrefix(agentCommand);
}

// Le préfixe vu de l'agent (le message d'une action) : commandPrefix sans la
// box où l'agent tourne déjà (boxPrefix de sa commande), s'il commence par elle.
export function agentSidePrefix(project: Project | null, setting: unknown, agentCommand: unknown): string[] {
  const prefix = commandPrefix(project, setting, agentCommand);
  const box = boxPrefix(agentCommand);
  return box.length && box.every((w, i) => prefix[i] === w) ? prefix.slice(box.length) : prefix;
}

// La commande au rang `index` du fichier (un entier, rien d'autre) : son nom,
// son argv (préfixe, shell, la commande), son dossier tel qu'écrit ; sinon null.
export function commandAt(project: Project | null, index: unknown, agentCommand: unknown, setting: unknown = '') {
  const c = project && Number.isInteger(index) ? project.commands[index as number] : undefined;
  return c ? { name: c.name, argv: [...commandPrefix(project, setting, agentCommand), ...project!.shell, c.run], cwd: c.cwd } : null;
}

// Les demandes de l'agent parmi les fichiers de <out>/run/ : <nom>.stop,
// <nom>.restart, pour un nom du fichier du projet ; le reste est ignoré.
export function requestsOf(files: string[], project: Project | null): Request[] {
  const names = new Set(project?.commands.map((c) => c.name));
  return files.flatMap((file): Request[] => {
    const m = /^(.+)\.(stop|restart)$/.exec(file);
    return m && names.has(m[1]) ? [{ name: m[1], op: m[2] as Request['op'], file }] : [];
  });
}

// Les `lines` dernières lignes d'un journal, sans séquences ANSI (couleurs) ;
// une ligne réécrite par \r (barre de progression) : son dernier état.
export function logTail(text: string, lines: number): string {
  const clean = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '').split('\n')
    .map((l) => l.replace(/\r+$/, '').split('\r').at(-1)!);
  if (clean.at(-1) === '') clean.pop();
  return clean.slice(-lines).join('\n');
}

// Le nom du fichier du projet d'un dossier : son chemin, en lettres sûres.
export const projectSlug = (dir: string) => dir.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'projet';
