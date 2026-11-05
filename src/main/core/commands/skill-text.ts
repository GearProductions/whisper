/** skill-text — la section des arguments des skills `actions` et `processus`,
 *  produite par la table : les clés de run.start et leur description (dans
 *  l'ordre de son schéma), les actions qui lisent `text` (d'après leur gabarit),
 *  puis l'arrêt d'une course, l'arrêt et le redémarrage d'un processus. Le
 *  chemin des fichiers de la boîte aux lettres est ici, pas dans la table : une
 *  porte parmi d'autres.
 *  Ne connaît pas : le disque (le SKILL.md est lu par le test), l'exécuteur.
 *  Utilisé par : le test des skills. */
import { ownRun, readArgs, type ActionDef } from 'core/vibecoder';
import type { CommandTable } from './table';

// La description de l'argument `key` de la commande `name`, en minuscule et sans son point final, pour la phrase ; la table l'a, ou c'est une faute.
const argText = (table: CommandTable, name: string, key: string) => {
  const text = table.commands.find((c) => c.name === name)?.args.properties?.[key]?.description;
  if (text === undefined) throw new Error(`skillArgs : ${name}.${key} sans description dans la table`);
  return text[0].toLowerCase() + text.slice(1).replace(/\.$/, '');
};

export function skillArgs(table: CommandTable, defs: ActionDef[], skill: 'actions' | 'processus'): string {
  const d = (name: string, key: string) => argText(table, name, key);
  if (skill === 'processus') {
    return [
      `- **Stop**: create the empty file \`<out>/run/<name>.stop\` (\`<name>\`: ${d('proc.stop', 'name')}).`,
      `- **Restart** (or start a stopped one): create the empty file \`<out>/run/<name>.restart\` (\`<name>\`: ${d('proc.restart', 'name')}).`,
    ].join('\n');
  }
  const readers = new Intl.ListFormat('en').format(
    defs.filter((def) => ownRun(def) && readArgs(def).includes('text')).map((def) => `\`${def.id}\``));
  const keys = Object.keys(table.commands.find((c) => c.name === 'run.start')?.args.properties ?? {})
    .filter((key) => key !== 'action')   // l'id de l'action est dans le nom du fichier
    .map((key) => `\`${key}\` (${d('run.start', key)}${key === 'text'
      ? `; only ${readers} read it — for any other the action starts anyway and the notice says « arguments ignorés : text », so don't send it there`
      : ''})`);
  return [
    `- **Start**: write \`<out>/actions/<id>.start\` containing a JSON object of its arguments, \`{}\` if none (\`<id>\`: ${d('run.start', 'action')}). Only these keys: ${keys.join(', ')}.`,
    `- **Stop**: create the empty file \`<out>/actions/<id>.stop\` (\`<id>\`: ${d('run.stop', 'action')}).`,
  ].join('\n');
}
