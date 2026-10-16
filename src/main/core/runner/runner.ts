/** runner — les commandes qui lancent le projet d'un agent (onglet Processus
 *  de VibeCoder), lues dans son fichier du projet (`{ commands: [{ name, run,
 *  cwd? }], shell? }`, écrit par l'utilisateur ou adopté d'une proposition).
 *  Une commande se désigne par son rang dans ce fichier, jamais par un texte :
 *  son argv est le shell du fichier (`bash -ic` par défaut : alias et
 *  fonctions de l'utilisateur ; seule exception à I-27, limitée à ces
 *  commandes), dans la box de l'agent si sa commande passe par
 *  `distrobox enter <box> --`. Les demandes de l'agent (<nom>.stop,
 *  <nom>.restart) ne valent que pour les noms du fichier. La fin d'un journal,
 *  sans couleurs.
 *  Ne connaît pas : le disque, les processus, Electron.
 *  Utilisé par : app/controllers/processes. */
import { splitCommand } from 'helpers';

export type ProjectCommand = { name: string; run: string; cwd?: string };
export type Project = { commands: ProjectCommand[]; shell: string[] };
export type Request = { name: string; op: 'stop' | 'restart'; file: string };

export const DEFAULT_SHELL = ['bash', '-ic'];
const NAME = /^[A-Za-z0-9][\w.-]{0,39}$/;   // il nomme un fichier : <nom>.log
const RUN_MAX = 4000;
const okText = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= max && !v.includes('\0');

// Le fichier du projet (JSON) → ses commandes valides, dans leur ordre (une
// entrée mal formée ou un nom déjà vu : ignorés) ; null s'il manque ou n'est
// pas un objet à liste `commands`.
export function parseProject(text: string | null | undefined): Project | null {
  let raw: unknown;
  try { raw = JSON.parse(text ?? ''); } catch { return null; }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { commands?: unknown }).commands)) return null;
  const { commands, shell } = raw as { commands: unknown[]; shell?: unknown };
  const names = new Set<string>();
  const list = commands.flatMap((c): ProjectCommand[] => {
    const { name, run, cwd } = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    if (typeof name !== 'string' || !NAME.test(name) || names.has(name) || !okText(run, RUN_MAX)
      || (cwd !== undefined && !okText(cwd, 1000))) return [];
    names.add(name);
    return [cwd === undefined ? { name, run } : { name, run, cwd }];
  });
  const okShell = Array.isArray(shell) && shell.length > 0 && shell.length <= 5 && shell.every((s) => okText(s, 200));
  return { commands: list, shell: okShell ? shell as string[] : DEFAULT_SHELL };
}

// Une proposition (<out>/lancement.json) → le texte du fichier du projet, ou
// null si elle n'a aucune commande valide.
export function projectText(text: string | null | undefined): string | null {
  const p = parseProject(text);
  if (!p?.commands.length) return null;
  const shell = p.shell === DEFAULT_SHELL ? {} : { shell: p.shell };
  return `${JSON.stringify({ commands: p.commands, ...shell }, null, 2)}\n`;
}

// `distrobox enter <box> … --` en tête de la commande de l'agent : ce préfixe ; sinon [].
export function boxPrefix(agentCommand: unknown): string[] {
  const argv = splitCommand(agentCommand);
  const end = argv.indexOf('--');
  return /(^|[\\/])distrobox$/.test(argv[0] ?? '') && argv[1] === 'enter' && end > 1 ? argv.slice(0, end + 1) : [];
}

// La commande au rang `index` du fichier (un entier, rien d'autre) : son nom,
// son argv (box, shell, la commande), son dossier tel qu'écrit ; sinon null.
export function commandAt(project: Project | null, index: unknown, agentCommand: unknown) {
  const c = project && Number.isInteger(index) ? project.commands[index as number] : undefined;
  return c ? { name: c.name, argv: [...boxPrefix(agentCommand), ...project!.shell, c.run], cwd: c.cwd } : null;
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
