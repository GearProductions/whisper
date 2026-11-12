/** rights — la liste d'une course : les règles d'autorisation que l'appli donne
 *  au SDK à son départ (allowedTools), et sur lesquelles porte l'invariant des
 *  droits. Le `allowed-tools` du skill de son action (listSkill : `note` pour
 *  `answers`, qui reprend sa session sans appeler de skill), `${CLAUDE_SKILL_DIR}`
 *  remplacé par le dossier du skill et `${VIBECODER_OUT}` par les sorties de
 *  l'agent (les fichiers temporaires d'un skill y vont) ; plus les commandes du projet : les lignes
 *  de code de la section des commandes d'`AGENTS.md` dont le nom désigne un test,
 *  un typage ou un lint (projectCommands ; un argument entre chevrons devient un
 *  joker), autorisées seules ou suivies d'arguments, derrière le préfixe que
 *  l'appli donne aux actions (commandRules : préfixe compris, et seulement elles
 *  derrière lui). Aucune autre source : sans ces lignes, pas de commandes.
 *  Pur. Ne connaît pas : le disque (textes passés), le SDK, le mode de l'agent,
 *  les règles de l'utilisateur (Claude Code les ajoute lui-même).
 *  Utilisé par : app/controllers (runs : startRun). */

// Le skill dont la liste vaut pour l'action `actionId` lancée avec le gabarit `template`
// (« /vibecoder:<nom> … » → <nom>, variante de modèle comprise : la liste est celle de
// la variante) ; `answers` → `note` ; un texte qui n'appelle aucun skill : null.
export function listSkill(actionId: string, template: string): string | null {
  void [actionId, template];
  throw new Error('not implemented');
}

// Les règles du champ `allowed-tools` d'un SKILL.md, une par entrée, séparées par
// des virgules hors parenthèses, `${CLAUDE_SKILL_DIR}` remplacé par `dirs.skill` et
// `${VIBECODER_OUT}` par `dirs.out` ; pas de champ, ou pas de SKILL.md : [].
export function skillTools(skillMd: string | null, dirs: { skill: string; out: string }): string[] {
  void [skillMd, dirs];
  throw new Error('not implemented');
}

// Les commandes de test, de typage et de lint d'AGENTS.md : dans sa section des
// commandes (un titre « Commandes » ou « Commands »), chaque ligne de code dont un
// mot désigne un test, un typage ou un lint (test, typecheck, tsc, vitest, lint,
// clippy, cargo check), un argument `<…>` changé en `*` ; dans l'ordre, sans
// doublon. Pas d'AGENTS.md, pas de section : [].
export function projectCommands(agentsMd: string | null): string[] {
  void agentsMd;
  throw new Error('not implemented');
}

// Les règles Bash d'une commande du projet : `Bash(<préfixe> <commande>)` et
// `Bash(<préfixe> <commande> *)` (suivie d'arguments) ; préfixe vide : sans lui.
export function commandRules(commands: string[], prefix: string): string[] {
  void [commands, prefix];
  throw new Error('not implemented');
}

// La liste d'une course : skillTools puis commandRules(projectCommands), sans doublon.
export function runRules(o: { skillMd: string | null; skillDir: string; out: string; agentsMd: string | null; prefix: string }): string[] {
  void o;
  throw new Error('not implemented');
}
