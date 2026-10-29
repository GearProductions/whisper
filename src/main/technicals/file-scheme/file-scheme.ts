/** file-scheme — un schéma de l'appli qui sert des fichiers du disque à une
 *  page : registerScheme (avant ready : standard, secure, stream ; rien
 *  d'autre de privilégié), serveFiles (protocol.handle : le fichier que
 *  `resolve` désigne, en flux, Range compris, avec son type et
 *  X-Content-Type-Options: nosniff ; null → 404 ; sandbox → FRAME_CSP, sans
 *  script ni réseau ; toute autre méthode que GET → 405).
 *  Ne connaît pas : VibeCoder, les agents, la configuration.
 *  Utilisé par : app/lifecycle. */

export type Served = { file: string; type: string; sandbox: boolean };

// Squelette (note 0.13.0, Forme) : le module s'écrit à son commit.
export function registerScheme(_name: string): void {
  throw new Error('not implemented');
}

export function serveFiles(_name: string, _resolve: (url: URL) => Served | null): void {
  throw new Error('not implemented');
}
