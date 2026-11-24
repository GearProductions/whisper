/** bounds — la décision du contrôle que l'appli donne au SDK avant chaque outil
 *  de fichiers d'une course et de ses sous-agents (crochet PreToolUse, appliqué
 *  avant les règles de l'utilisateur) : c'est sur elle que porte l'invariant du
 *  disque. Lecture et exploration (Read, Glob, Grep) : dans le dossier du
 *  projet, les sorties de l'agent, le dossier du plugin de VibeCoder et le
 *  dossier d'artefacts du projet (artifacts ; absent : aucun pour la course).
 *  Écriture (Write, Edit, MultiEdit, NotebookEdit) : dans le projet et les
 *  sorties, jamais dans le plugin ni le dossier d'artefacts ; pour une action
 *  en lecture (reads), dans les seules sorties ; jamais
 *  sur un fichier borné du projet (BOUNDED : ses réglages et skills `.claude/`,
 *  un `AGENTS.md`, un `package.json`, `.git/`, `.husky/`). Un chemin est jugé
 *  résolu (relatif au projet, liens suivis par `real` : /home → /var/home).
 *  Une course à qui l'appelant passe `frozen` (Vérifier l'alignement, note
 *  0.16.0-controle-en-trois-points : les fichiers de tests d'invariants qui existaient
 *  au départ de la branche, chemins relatifs au projet) n'écrit dans aucun d'eux, jugé
 *  au chemin demandé comme au chemin réel ; la raison dit que le fichier est protégé
 *  et que son cas remonte à l'utilisateur ([toi]). Sans `frozen` : comme avant.
 *  Un autre outil (Bash, Agent…) : rien à dire, le mode et la liste en décident.
 *  `real` suit les liens d'un chemin ; il peut lever sur un fichier qui n'existe pas
 *  encore (un Write) : on juge alors son plus proche dossier existant, nom remis
 *  (l'appelant passe fs.realpathSync). Un fichier borné se reconnaît au chemin
 *  demandé comme au chemin réel (un lien nommé AGENTS.md est borné) ; les sorties
 *  ne sont pas jugées sur ces noms (ce sont les fichiers de l'agent). Le motif d'un
 *  Glob (le filtre d'un Grep) ne sort pas de son dossier : absolu ou `..`, refusé.
 *  Pur. Les outils de lecture sont ceux de core/agents (READ_TOOLS). Ne connaît pas : le SDK et la forme de sa réponse, le disque
 *  (`real` passé), les règles de l'utilisateur, ce que lance une commande, git (la
 *  liste `frozen` est lue par l'appelant), la clé d'un projet ni où vivent ses
 *  artefacts (le chemin réel est passé).
 *  Utilisé par : app/controllers (runs : runRights). */

import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { READ_TOOLS } from 'core/agents';
import { inside } from './files';

// Les dossiers d'une course, chemins réels ; reads : l'action est marquée en lecture ;
// artifacts : le dossier d'artefacts de son projet, en lecture seule (absent : aucun) ;
// frozen : les fichiers du projet (chemins relatifs) que cette course n'écrit pas ; absent : aucun de plus.
export type Bounds = { project: string; out: string; plugin: string; artifacts?: string; reads: boolean; frozen?: readonly string[] };

// La décision : passer (le mode et la liste jugent ensuite), ou refuser, avec la raison
// que lira l'agent (le chemin et pourquoi).
export type FileDecision = { allow: true } | { allow: false; reason: string };

// Les fichiers du projet qu'aucune course n'écrit : un dossier (segment du chemin) ou un nom.
export const BOUNDED = { dirs: ['.claude', '.git', '.husky'], names: ['AGENTS.md', 'package.json'] } as const;

const WRITES = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];

// Le chemin que vise un outil de fichiers (file_path, notebook_path, path ; Glob et
// Grep sans path : le projet) et s'il écrit ; un autre outil : null.
export function fileTarget(tool: string, input: unknown, project: string): { path: string; write: boolean } | null {
  const write = WRITES.includes(tool);
  if (!write && !READ_TOOLS.has(tool)) return null;
  const i = (input ?? {}) as Record<string, unknown>;
  const p = [i.file_path, i.notebook_path, i.path].find((v) => typeof v === 'string' && v !== '');
  return { path: resolve(project, typeof p === 'string' ? p : ''), write };
}

// Le chemin réel, même si le fichier n'existe pas encore : son plus proche dossier existant, nom remis.
function realPath(p: string, real: (p: string) => string): string {
  try {
    return real(p);
  } catch {
    const up = dirname(p);
    return up === p ? p : join(realPath(up, real), basename(p));
  }
}

// Un chemin du projet sous un dossier de BOUNDED, ou nommé comme un de ses noms (casse comprise).
function bounded(project: string, p: string): boolean {
  if (!inside(project, p)) return false;
  const parts = relative(project, p).toLowerCase().split(sep);
  return parts.some((s) => BOUNDED.dirs.includes(s as never)) || BOUNDED.names.some((n) => n.toLowerCase() === parts[parts.length - 1]);
}

// Un chemin du projet qui est un de ceux de `frozen` (relatifs, en / comme git les rend).
function frozen(b: Bounds, p: string): boolean {
  return inside(b.project, p) && !!b.frozen?.includes(relative(b.project, p).split(sep).join('/'));
}

// La décision du contrôle pour l'appel `tool(input)` d'une course aux dossiers `bounds`.
export function fileDecision(tool: string, input: unknown, bounds: Bounds, real: (p: string) => string): FileDecision {
  const t = fileTarget(tool, input, bounds.project);
  if (!t) return { allow: true };
  const p = realPath(t.path, real);
  const no = (why: string): FileDecision => ({ allow: false, reason: `${t.path} : ${why}` });
  // Le motif d'un Glob ou le filtre d'un Grep ne sort pas de son dossier (absolu, ~ ou ..).
  const glob = (input as Record<string, unknown> | null)?.[tool === 'Glob' ? 'pattern' : 'glob'];
  if (typeof glob === 'string' && /^[/~\\]|^[a-z]:|(^|[/\\])\.\.([/\\]|$)/i.test(glob)) return no(`le motif ${glob} sort du dossier qu'il parcourt`);
  if (inside(bounds.out, p)) return { allow: true };
  if (!t.write) {
    return inside(bounds.project, p) || inside(bounds.plugin, p) || (bounds.artifacts && inside(bounds.artifacts, p)) ? { allow: true } : no('hors du dossier du projet et des sorties de l\'agent');
  }
  if (!inside(bounds.project, p)) return no('hors du dossier du projet et des sorties de l\'agent, qu\'une action n\'écrit pas');
  if (bounds.reads) return no('une action en lecture n\'écrit que dans les sorties de l\'agent');
  if (bounded(bounds.project, p) || bounded(bounds.project, t.path)) {
    return no('un fichier borné (réglages et skills .claude, AGENTS.md, package.json, .git, .husky) : une action n\'élargit pas ses droits ; à faire par l\'utilisateur');
  }
  if (bounds.frozen?.length && (frozen(bounds, p) || frozen(bounds, t.path))) {
    return no('un fichier protégé (un test d\'invariants d\'avant le ticket) : cette course ne l\'écrit pas ; son cas remonte à l\'utilisateur, en [toi]');
  }
  return { allow: true };
}
