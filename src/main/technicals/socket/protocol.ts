/** protocol — le protocole d'une ligne, pur : une enveloppe JSON par ligne
 *  ({ cmd, args, token, target }) ; readLine la rend avec son caller (le nom que
 *  la table de jetons donne au jeton lu, cherché parmi tous, chacun comparé à
 *  temps constant), la refuse (bad-token : aucun jeton de la table) ou demande la fermeture (pas une
 *  commande : pas du JSON, pas un objet, cmd ou target absent ou pas une
 *  chaîne, une clé de trop, au-delà de LINE_MAX) ; writeLine écrit une
 *  réponse en une ligne.
 *  Ne connaît pas : ce que désigne un caller, l'exécuteur, les robots, le réseau.
 *  Utilisé par : server, client ; les tests de commands.json (le texte de bad-token). */

export type Envelope = { cmd: string; args?: unknown; token: string; target: string };
export type Answer = { ok: false; error: { code: 'bad-token'; details: Record<string, never>; message: string; todo: string } };

import { timingSafeEqual } from 'node:crypto';

/** La plus longue ligne lue, en caractères. Les gros morceaux sont en base64 : les images des pièces
 *  (64 Mio décodés au plus pour l'écran, controllers/vibecoder PIECES_MAX : ~85 Mi de caractères) ou le
 *  contenu d'add-artifact (25 Mio décodés par demande : ~34 Mio). Bornes fixées hors de technicals/, qui ne
 *  peut pas les importer : 128 Mio laissent de la marge sans laisser un client remplir la mémoire.
 *  Une demande plus grosse ferme la connexion : l'écran refuse les pièces trop lourdes avant l'envoi. */
export const LINE_MAX = 128 * 1024 * 1024;

/** La réponse à un jeton faux, en anglais. */
export const BAD_TOKEN: Answer = {
  ok: false,
  error: {
    code: 'bad-token',
    details: {},
    message: 'The token is missing or wrong.',
    todo: 'Read live.json again (the app may have restarted, or the setting "Allow outside agents" been turned off), or turn that setting on.',
  },
};

const KEYS = new Set(['cmd', 'args', 'token', 'target']);

// Jeton comparé à temps constant ; une longueur différente se refuse sans comparer (timingSafeEqual lèverait).
function sameToken(given: unknown, token: string): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function readLine(line: string, tokens: ReadonlyMap<string, string>): { envelope: Envelope; caller: string } | { refuse: Answer } | { close: true } {
  const close = { close: true } as const;
  if (line.length > LINE_MAX) return close;
  let v: unknown;
  try { v = JSON.parse(line); } catch { return close; }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return close;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some((k) => !KEYS.has(k)) || typeof o.cmd !== 'string' || typeof o.target !== 'string') return close;
  let caller: string | undefined;
  for (const [name, token] of tokens) if (sameToken(o.token, token) && caller === undefined) caller = name; // tous comparés : pas de sortie anticipée
  if (caller === undefined) return { refuse: BAD_TOKEN };
  return { envelope: o as Envelope, caller };
}

/** JSON.stringify n'écrit aucun saut de ligne brut : la valeur tient en une ligne. */
export function writeLine(value: unknown): string {
  return JSON.stringify(value) + '\n';
}
