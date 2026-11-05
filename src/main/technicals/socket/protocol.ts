/** protocol — le protocole d'une ligne, pur : une enveloppe JSON par ligne
 *  ({ cmd, args, token, target }) ; readLine la rend, la refuse (bad-token :
 *  le jeton faux, comparé à temps constant) ou demande la fermeture (pas une
 *  commande : pas du JSON, pas un objet, cmd ou target absent ou pas une
 *  chaîne, une clé de trop, au-delà de LINE_MAX) ; writeLine écrit une
 *  réponse en une ligne.
 *  Ne connaît pas : la table, l'exécuteur, le réseau.
 *  Utilisé par : server, client ; les tests de commands.json (le texte de bad-token). */

export type Envelope = { cmd: string; args?: unknown; token: string; target: string };
export type Answer = { ok: false; error: { code: 'bad-token'; details: Record<string, never>; message: string; todo: string } };

/** La plus longue ligne lue (assez pour les pièces de prepareMessage et le contenu d'add-artifact). */
export const LINE_MAX: number = Number.NaN;   // pas encore écrit
/** La réponse à un jeton faux, en anglais. */
export const BAD_TOKEN = null as unknown as Answer;   // pas encore écrit

export function readLine(_line: string, _token: string): { envelope: Envelope } | { refuse: Answer } | { close: true } {
  throw new Error('not implemented');
}

export function writeLine(_value: unknown): string {
  throw new Error('not implemented');
}
