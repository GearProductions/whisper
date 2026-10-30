/** slash — les commandes « / » du champ : ce qui est tapé, les commandes qui
 *  correspondent (d'abord celles qui commencent par la saisie, sans les variantes
 *  `<skill>--<modèle>--<effort>`, F-70), le choix.
 *  Ne connaît pas : le DOM, le pont. Utilisé par : app/panel (composer). */
import type { Command } from 'technicals/bridge';
import { matchByName } from './mention';

const VARIANT = /--[a-z]+--[a-z]+$/;

// Le champ commence par « / » (sans espace jusqu'au curseur) : ce qui suit, sinon null.
export function slashQuery(value: string, caret: number) {
  const m = /^\/(\S*)$/.exec(value.slice(0, caret));
  return m ? m[1].toLowerCase() : null;
}

export const matchCommands = (list: Command[], q: string) =>
  matchByName(list.filter((c) => !VARIANT.test(c.name.toLowerCase())), q, (c) => c.name);

// La commande choisie remplace ce qui est tapé ; le reste du champ suit.
export function pickCommand(value: string, caret: number, c: Command) {
  return { value: `/${c.name} ${value.slice(caret).trimStart()}`, caret: c.name.length + 2 };
}

export const cycle = (index: number, delta: number, length: number) => (index + delta + length) % length;
