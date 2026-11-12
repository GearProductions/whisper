/** rights — les règles d'une course, que l'appli donne au SDK à son départ et
 *  sur lesquelles porte l'invariant des droits (I-57) : runRules → { allow, deny }.
 *  allow (allowedTools) : les outils du `allowed-tools` du skill de son action
 *  (listSkill : `note` pour `answers`), hors règles Bash, plus `Bash` entier.
 *  deny (disallowedTools) : la liste de refus, DENIED — ce qui part à
 *  l'extérieur, change les dépendances, détruit, écrit dans git, touche au
 *  système, la CLI de VibeCoder —, moins ce que le skill en ouvre (skillOpens :
 *  une commande du refus que ses règles Bash nomment), chaque commande refusée
 *  seule ou suivie d'arguments, et aussi derrière le préfixe que l'appli donne
 *  aux actions et, pour git, derrière `-C` et `-c` (denyRules). Claude Code juge lui-même chaque morceau d'un
 *  enchaînement ; aucune commande du projet n'est ouverte.
 *  Et la CLI de VibeCoder dans la conversation (vibeCliCall : le seul appel Bash qu'elle accepte d'elle-même
 *  tant que le mode Vibe est en cours ; la liste d'un skill ne vaut que pour son tour).
 *  Pur. Ne connaît pas : le disque (textes passés), le SDK, le mode de l'agent,
 *  les règles de l'utilisateur (Claude Code les ajoute lui-même), le contrôle
 *  des fichiers (bounds).
 *  Utilisé par : app/controllers (runs : runRights ; agents : sendToAgent). */

import { resolve } from 'node:path';

/** Les règles d'une course : allowedTools et disallowedTools du SDK. */
export type RunRules = { allow: string[]; deny: string[] };

// Ce qu'aucun skill ne rouvre (skillOpens les garde refusés) : fusionner une PR, publier une release, toucher au dépôt distant.
export const NEVER: readonly string[] = ['gh pr merge', 'gh release', 'gh repo'];

// La liste de refus d'une course : chaque commande, refusée seule ou suivie
// d'arguments (`*` : n'importe quoi), sauf celles que son skill ouvre.
export const DENIED: readonly string[] = [
  // ce qui part à l'extérieur ; gh par ses sous-commandes qui écrivent (ses lectures — pr view, pr checks, pr diff,
  // run view — passent) : un skill qui ouvre `gh pr create` n'ouvre pas `gh pr merge`
  'git push', 'curl', 'wget',
  'gh pr create', 'gh pr edit', 'gh pr review', 'gh pr comment', 'gh pr close', 'gh pr reopen', 'gh pr ready',
  'gh pr checkout', 'gh api', 'gh issue', 'gh workflow', 'gh run rerun', 'gh run cancel', 'gh label', 'gh secret',
  // jamais rouverts par un skill (NEVER) : l'irréversible
  ...NEVER,
  // ce qui change les dépendances
  'npm install', 'npm i', 'npm add', 'yarn add', 'pnpm add', 'cargo add', 'cargo install', 'pip install',
  // ce qui détruit
  'git reset --hard', 'git reset * --hard', 'git clean', 'rm -rf', 'rm -fr', 'rm -Rf', 'rm -r -f', 'sudo',
  // les commandes git qui écrivent
  'git add', 'git commit', 'git rebase', 'git checkout', 'git switch', 'git stash', 'git merge', 'git tag',
  'git branch -D', 'git config', 'git pull', 'git restore',
  // le système ; distrobox par ses sous-commandes : le préfixe des actions est souvent `distrobox enter <box> --`
  'kill', 'pkill', 'systemctl', 'podman',
  'distrobox create', 'distrobox rm', 'distrobox stop', 'distrobox assemble', 'distrobox upgrade',
  // la CLI de VibeCoder, quel que soit son chemin
  'node *vibecoder.mjs*',
];

// Le skill dont la liste vaut pour l'action `actionId` lancée avec le gabarit `template`
// (« /vibecoder:<nom> … » → <nom>, variante de modèle comprise : la liste est celle de
// la variante) ; `answers` → `note` ; un texte qui n'appelle aucun skill : null.
export function listSkill(actionId: string, template: string): string | null {
  if (actionId === 'answers') return 'note';
  return /^\s*\/vibecoder:([\w-]+)/.exec(template)?.[1] ?? null;
}

// Les règles du champ `allowed-tools` d'un SKILL.md, une par entrée, séparées par
// des virgules hors parenthèses, `${CLAUDE_SKILL_DIR}` remplacé par `dirs.skill` et
// `${VIBECODER_OUT}` par `dirs.out` ; pas de champ, ou pas de SKILL.md : [].
export function skillTools(skillMd: string | null, dirs: { skill: string; out: string }): string[] {
  const field = /^allowed-tools:[^\S\r\n]*"?(.*?)"?\s*$/m.exec(skillMd ?? '')?.[1] ?? '';
  return field.split(/,(?![^(]*\))/).map((r) => r.trim()).filter(Boolean)
    .map((r) => r.replaceAll('${CLAUDE_SKILL_DIR}', dirs.skill).replaceAll('${VIBECODER_OUT}', dirs.out));
}

// Les commandes de `denied` que les règles Bash de `tools` ouvrent : une règle `Bash(<cmd>)` dont la commande,
// assignations de tête (`VAR=… `) ôtées, commence mot pour mot par celle du refus (`*` du refus : n'importe quoi) ;
// dans l'ordre de `denied`, sans doublon. Les autres outils (`Read`…) n'ouvrent rien, et NEVER reste refusé.
export function skillOpens(tools: string[], denied: readonly string[]): string[] {
  const cmds = tools.flatMap((t) => /^Bash\((.*)\)$/s.exec(t)?.[1] ?? [])
    .map((c) => c.trim().replace(/:\*$/, ' *').replace(/^(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S*)\s+)+/, ''));
  const words = (d: string) => new RegExp(`^${d.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/ +/g, '\\s+')}(?=\\s|$)`, 's');
  return [...new Set(denied)].filter((d) => !NEVER.includes(d) && cmds.some((c) => words(d).test(c)));
}

// Les règles de refus des commandes `commands` : `Bash(<cmd> *)` (la commande seule comprise), et derrière le
// préfixe des actions `Bash(<préfixe> <cmd> *)` (Claude Code n'ôte pas un préfixe comme `distrobox enter dev --`) ;
// préfixe vide : sans lui. Une commande `git <sub>` est aussi refusée derrière les options globales de git, que Claude Code
// n'ôte pas : `git -C <dossier> <sub>` et `git -c <clé=valeur> <sub>`.
export function denyRules(commands: readonly string[], prefix: string): string[] {
  const forms = (c: string) => c.startsWith('git ') ? [c, `git -C * ${c.slice(4)}`, `git -c * ${c.slice(4)}`] : [c];
  return commands.flatMap(forms).flatMap((c) => [`Bash(${c} *)`, ...(prefix ? [`Bash(${prefix} ${c} *)`] : [])]);
}

// Les règles d'une course : allow, les outils de skillTools hors règles Bash, plus `Bash`, sans doublon ;
// deny, denyRules(DENIED moins skillOpens(skillTools), prefix).
export function runRules(o: { skillMd: string | null; skillDir: string; out: string; prefix: string }): RunRules {
  const tools = skillTools(o.skillMd, { skill: o.skillDir, out: o.out });
  const opened = skillOpens(tools, DENIED);
  return {
    allow: [...new Set([...tools.filter((t) => !t.startsWith('Bash(')), 'Bash'])],
    deny: denyRules(DENIED.filter((d) => !opened.includes(d)), o.prefix),
  };
}

// Un mot du shell sans composition : des caractères simples, ou entre guillemets (`$`, `` ` `` et `\` interdits dans les
// doubles ; tout dans les simples).
const WORD = String.raw`(?:[^\s"'$\`\\;&|<>()]+|"[^"$\`\\]*"|'[^']*')+`;
const CLI_CALL = new RegExp(String.raw`^node[ \t]+(?:"([^"$\`]+)"|([^\s"'$\`\\;&|<>()]+))((?:[ \t]+${WORD})*)[ \t]*$`);

// L'appel `tool(input)` est un `node <pluginDir>/bin/vibecoder.mjs …` : un Bash dont la commande est la CLI de VibeCoder,
// son chemin résolu (`/skills/x/../../bin` compris) celui du plugin, et ses arguments sans composition ni redirection
// (`;` `&` `|` `<` `>` `$` accent grave, parenthèses, saut de ligne hors guillemets).
export function vibeCliCall(tool: string, input: unknown, pluginDir: string): boolean {
  const command = (input as { command?: unknown } | null)?.command;
  if (tool !== 'Bash' || typeof command !== 'string') return false;
  const m = CLI_CALL.exec(command);
  const script = m?.[1] ?? m?.[2];
  if (!script || (script.includes('\\') && !pluginDir.includes('\\'))) return false;
  return resolve(script) === resolve(pluginDir, 'bin', 'vibecoder.mjs');
}
