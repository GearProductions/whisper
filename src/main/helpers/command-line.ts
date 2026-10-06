/** command-line — découpe une commande en arguments, guillemets compris :
 *  « distrobox enter dev -- claude » → ['distrobox', 'enter', 'dev', '--', 'claude'].
 *  Rien n'est interprété : pas de variables, pas de redirections.
 *  Ne connaît pas : les processus. Utilisé par : technicals/claude. */

export function splitCommand(command: unknown): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(command || '')))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}
