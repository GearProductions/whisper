/** terminal — ouvrir le terminal du système dans un dossier : la commande
 *  réglée (`terminalCommand`, découpée par splitCommand, `{dir}` remplacé par
 *  le dossier comme un argument entier, withDir), lancée au dossier ; vide :
 *  le premier trouvé dans TERMINALS (which), lancé au dossier (wt : -d
 *  <dir>) ; aucun : null. Jamais de shell (I-27) ; détaché.
 *  Ne connaît pas : Electron, les agents, la config.
 *  Utilisé par : app/menus. */

export const TERMINALS: Record<string, string[]> = {
  linux: ['konsole', 'gnome-terminal', 'kitty', 'alacritty', 'wezterm', 'xterm'],
  win32: ['wt', 'cmd'],
};

export type Terminal = { name: string; open: (dir: string) => void };

export function findTerminal(_command: unknown, _platform: string = process.platform): Terminal | null {
  throw new Error('not implemented');
}
