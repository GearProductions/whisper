/** slash — les commandes « / » du champ : ce qui est tapé, les commandes qui
 *  correspondent (d'abord celles qui commencent par la saisie), le choix.
 *  Ne connaît pas : le DOM, le pont. Utilisé par : Composer. */
import type { Command } from '../bridge';

const SHOWN = 50;

// Le champ commence par « / » (sans espace jusqu'au curseur) : ce qui suit, sinon null.
export function slashQuery(value: string, caret: number) {
  const m = /^\/(\S*)$/.exec(value.slice(0, caret));
  return m ? m[1].toLowerCase() : null;
}

export function matchCommands(list: Command[], q: string) {
  const name = (c: Command) => c.name.toLowerCase();
  return list.filter((c) => name(c).startsWith(q))
    .concat(list.filter((c) => !name(c).startsWith(q) && name(c).includes(q))).slice(0, SHOWN);
}

// La commande choisie remplace ce qui est tapé ; le reste du champ suit.
export function pickCommand(value: string, caret: number, c: Command) {
  return { value: `/${c.name} ${value.slice(caret).trimStart()}`, caret: c.name.length + 2 };
}

export const cycle = (index: number, delta: number, length: number) => (index + delta + length) % length;
