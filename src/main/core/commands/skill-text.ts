/** skill-text — la section des arguments des skills `actions` et `processus`,
 *  produite par la table : les lignes de la CLI `vibecoder` (run start avec les
 *  clés de run.start dans l'ordre de son schéma, et les actions qui lisent
 *  `text` d'après leur gabarit ; run stop, wait, list ; proc list, stop,
 *  restart, logs). Le script est appelé par son chemin : la base du skill
 *  (`${CLAUDE_SKILL_DIR}`, que Claude Code remplace au chargement), puis
 *  `../../bin/vibecoder.mjs`.
 *  Ne connaît pas : le disque (le SKILL.md est lu par le test), l'exécuteur,
 *  le socket.
 *  Utilisé par : le test des skills. */
import { ownRun, readArgs, type ActionDef } from 'core/vibecoder';
import type { CommandTable } from './table';

// La description de l'argument `key` de la commande `name`, en minuscule et sans son point final, pour la phrase ; la table l'a, ou c'est une faute.
const argText = (table: CommandTable, name: string, key: string) => {
  const text = table.commands.find((c) => c.name === name)?.args.properties?.[key]?.description;
  if (text === undefined) throw new Error(`skillArgs : ${name}.${key} sans description dans la table`);
  return text[0].toLowerCase() + text.slice(1).replace(/\.$/, '');
};

// Le script par son chemin ; ${CLAUDE_SKILL_DIR} est remplacé par Claude Code, pas ici.
const VIBECODER = 'node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs"';

export function skillArgs(table: CommandTable, defs: ActionDef[], skill: 'actions' | 'processus'): string {
  const d = (name: string, key: string) => argText(table, name, key);
  if (skill === 'processus') {
    return [
      `- **List**: \`${VIBECODER} proc list\`.`,
      `- **Logs**: \`${VIBECODER} proc logs <name>\`: the end of its log (\`<name>\`: ${d('proc.stop', 'name')}).`,
      `- **Stop**: \`${VIBECODER} proc stop <name>\`.`,
      `- **Restart** (or start a stopped one): \`${VIBECODER} proc restart <name>\` (\`<name>\`: ${d('proc.restart', 'name')}).`,
    ].join('\n');
  }
  const readers = new Intl.ListFormat('en').format(
    defs.filter((def) => ownRun(def) && readArgs(def).includes('text')).map((def) => `\`${def.id}\``));
  const keys = Object.keys(table.commands.find((c) => c.name === 'run.start')?.args.properties ?? {})
    .filter((key) => key !== 'action')   // l'id de l'action est dans la ligne
    .map((key) => `\`${key}\` (${d('run.start', key)}${key === 'text'
      ? `; only ${readers} read it — for any other the action starts anyway and the notice says « arguments ignorés : text », so don't send it there`
      : ''})`);
  return [
    `- **Start**: \`${VIBECODER} run start <id> [key=value…]\` (\`<id>\`: ${d('run.start', 'action')}). A value with spaces in quotes; an array or an object as JSON. Only these keys: ${keys.join(', ')}.`,
    `- **Stop**: \`${VIBECODER} run stop <id>\` (\`<id>\`: ${d('run.stop', 'action')}).`,
    `- **Wait**: \`${VIBECODER} run wait <id>\`, started in the background (\`run_in_background\`): it returns when the run ends, and that wakes you.`,
    `- **State**: \`${VIBECODER} run list\` (what runs, waits, ended).`,
  ].join('\n');
}
