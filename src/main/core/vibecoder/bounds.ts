/** bounds — la décision du contrôle que l'appli donne au SDK avant chaque outil
 *  de fichiers d'une course et de ses sous-agents (crochet PreToolUse, appliqué
 *  avant les règles de l'utilisateur) : c'est sur elle que porte l'invariant du
 *  disque. Lecture et exploration (Read, Glob, Grep) : dans le dossier du
 *  projet, les sorties de l'agent et le dossier du plugin de VibeCoder.
 *  Écriture (Write, Edit, MultiEdit, NotebookEdit) : dans le projet et les
 *  sorties ; pour une action en lecture (reads), dans les seules sorties ; jamais
 *  sur un fichier borné du projet (BOUNDED : ses réglages et skills `.claude/`,
 *  un `AGENTS.md`, un `package.json`, `.git/`, `.husky/`). Un chemin est jugé
 *  résolu (relatif au projet, liens suivis par `real` : /home → /var/home).
 *  Un autre outil (Bash, Agent…) : rien à dire, le mode et la liste en décident.
 *  Pur. Ne connaît pas : le SDK et la forme de sa réponse (core/agents), le disque
 *  (`real` passé), les règles de l'utilisateur, ce que lance une commande.
 *  Utilisé par : app/controllers (runs : startRun). */

// Les dossiers d'une course, chemins réels ; reads : l'action est marquée en lecture.
export type Bounds = { project: string; out: string; plugin: string; reads: boolean };

// La décision : passer (le mode et la liste jugent ensuite), ou refuser, avec la raison
// que lira l'agent (le chemin et pourquoi).
export type FileDecision = { allow: true } | { allow: false; reason: string };

// Les fichiers du projet qu'aucune course n'écrit : un dossier (segment du chemin) ou un nom.
export const BOUNDED = { dirs: ['.claude', '.git', '.husky'], names: ['AGENTS.md', 'package.json'] } as const;

// Le chemin que vise un outil de fichiers (file_path, notebook_path, path ; Glob et
// Grep sans path : le projet) et s'il écrit ; un autre outil : null.
export function fileTarget(tool: string, input: unknown, project: string): { path: string; write: boolean } | null {
  void [tool, input, project];
  throw new Error('not implemented');
}

// La décision du contrôle pour l'appel `tool(input)` d'une course aux dossiers `bounds`.
export function fileDecision(tool: string, input: unknown, bounds: Bounds, real: (p: string) => string): FileDecision {
  void [tool, input, bounds, real];
  throw new Error('not implemented');
}
