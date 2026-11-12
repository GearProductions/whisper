/** rights — la liste d'une course : les règles d'autorisation que l'appli donne
 *  au SDK à son départ (allowedTools), et sur lesquelles porte l'invariant des
 *  droits. Le `allowed-tools` du skill de son action (listSkill : `note` pour
 *  `answers`, qui reprend sa session sans appeler de skill), `${CLAUDE_SKILL_DIR}`
 *  remplacé par le dossier du skill (celui de sa variante de modèle et celui du skill de base) et `${VIBECODER_OUT}` par les sorties de
 *  l'agent (les fichiers temporaires d'un skill y vont) ; plus les commandes du projet : les lignes
 *  de code de la section des commandes d'`AGENTS.md` dont le nom désigne un test,
 *  un typage ou un lint (projectCommands ; un argument entre chevrons devient un
 *  joker), autorisées seules ou suivies d'arguments, derrière le préfixe que
 *  l'appli donne aux actions (commandRules : préfixe compris, et seulement elles
 *  derrière lui). Aucune autre source : sans ces lignes, pas de commandes.
 *  Et la CLI de VibeCoder dans la conversation (vibeCliCall : le seul appel Bash qu'elle accepte d'elle-même
 *  tant que le mode Vibe est en cours ; la liste d'un skill ne vaut que pour son tour).
 *  Pur. Ne connaît pas : le disque (textes passés), le SDK, le mode de l'agent,
 *  les règles de l'utilisateur (Claude Code les ajoute lui-même).
 *  Utilisé par : app/controllers (runs : runRights ; agents : sendToAgent). */

import { resolve } from 'node:path';
import { EFFORT_LEVELS, SKILL_MODELS } from './actions';

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

// Un mot du nom de la commande (`test:invariants` en a deux) désigne un test, un typage ou un lint.
const isCheck = (c: string) => /\bcargo check\b/.test(c) || c.split(/[^a-z0-9]+/i).some((w) => ['test', 'typecheck', 'tsc', 'vitest', 'lint', 'clippy'].includes(w));

// Les commandes de test, de typage et de lint d'AGENTS.md : dans sa section des
// commandes (un titre « Commandes » ou « Commands »), chaque ligne de code dont un
// mot désigne un test, un typage ou un lint (test, typecheck, tsc, vitest, lint,
// clippy, cargo check), un argument `<…>` changé en `*` ; dans l'ordre, sans
// doublon. Pas d'AGENTS.md, pas de section : [].
export function projectCommands(agentsMd: string | null): string[] {
  const found: string[] = [];
  let level = 0; // rang du titre de la section des commandes ; 0 : hors section
  let fenced = false;
  for (const line of (agentsMd ?? '').split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
    const heading = fenced ? null : /^(#{1,6})\s+(.*)/.exec(line);
    if (heading) {
      if (level && heading[1].length <= level) level = 0;
      if (!level && /^(Commandes|Commands)\b/i.test(heading[2])) level = heading[1].length;
      continue;
    }
    if (!level) continue;
    const codes = fenced ? [line.replace(/^\s*\$\s*/, '')] : [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    for (const code of codes) {
      const c = code.trim().replace(/<[^>]*>/g, '*');
      if (c && isCheck(c)) found.push(c);
    }
  }
  return [...new Set(found)];
}

// Les règles Bash d'une commande du projet : `Bash(<préfixe> <commande>)` et
// `Bash(<préfixe> <commande> *)` (suivie d'arguments) ; préfixe vide : sans lui.
export function commandRules(commands: string[], prefix: string): string[] {
  return commands.flatMap((c) => {
    const full = prefix ? `${prefix} ${c}` : c;
    return [`Bash(${full})`, `Bash(${full} *)`];
  });
}

// Le dossier du skill dont une variante de modèle (`<nom>--<modèle>[--<effort>]`) suit le texte ; un autre dossier : tel quel.
const baseDir = (dir: string) => dir.replace(new RegExp(`--(${SKILL_MODELS.join('|')})(--(${EFFORT_LEVELS.join('|')}))?$`), '');

// La liste d'une course : skillTools (pour une variante, aussi avec le dossier du skill de base : l'agent lit son texte et y
// tape ${CLAUDE_SKILL_DIR} tel quel), puis commandRules(projectCommands), sans doublon.
export function runRules(o: { skillMd: string | null; skillDir: string; out: string; agentsMd: string | null; prefix: string }): string[] {
  const skill = [o.skillDir, baseDir(o.skillDir)].flatMap((dir) => skillTools(o.skillMd, { skill: dir, out: o.out }));
  return [...new Set([...skill, ...commandRules(projectCommands(o.agentsMd), o.prefix)])];
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
