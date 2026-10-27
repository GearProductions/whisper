/** terminal — ouvrir le terminal du système dans un dossier : la commande
 *  réglée (`terminalCommand`, découpée par splitCommand, `{dir}` remplacé par
 *  le dossier comme un argument entier, withDir), lancée au dossier ; vide :
 *  le premier trouvé dans TERMINALS (which), lancé au dossier (wt : -d
 *  <dir>) ; aucun : null. Jamais de shell (I-27) ; détaché (launchDetached
 *  d'editor.ts), un échec ne fait rien.
 *  Ne connaît pas : Electron, les agents, la config.
 *  Utilisé par : app/menus. */
import fs from 'node:fs';
import { splitCommand, withDir } from 'helpers';
import { which } from 'technicals/paths';
import { launchDetached } from './editor';

export const TERMINALS: Record<string, string[]> = {
  linux: ['konsole', 'gnome-terminal', 'kitty', 'alacritty', 'wezterm', 'xterm'],
  win32: ['wt', 'cmd'],
};

export type Terminal = { name: string; open: (dir: string) => void };

// Le terminal à lancer, ou null s'il est introuvable.
export function findTerminal(command: unknown, platform: string = process.platform): Terminal | null {
  const argv = splitCommand(command);
  const terminal = (name: string, program: string, args: (dir: string) => string[]): Terminal => ({
    name, open: (dir) => launchDetached(program, args(dir), { cwd: dir, windowsHide: false }),
  });
  if (!argv.length) {
    for (const name of TERMINALS[platform] ?? []) {
      const program = which(name);
      if (program) return terminal(name, program, (dir) => (name === 'wt' ? ['-d', dir] : []));
    }
    return null;
  }
  const program = which(argv[0]) || (fs.existsSync(argv[0]) ? argv[0] : null);
  return program ? terminal(String(command).trim(), program, (dir) => withDir(argv.slice(1), dir)) : null;
}
