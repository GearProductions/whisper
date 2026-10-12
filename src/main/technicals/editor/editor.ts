/** editor — ouvrir un dossier dans l'éditeur de code de l'utilisateur : la
 *  commande réglée (`editorCommand`, ex. « zed », « flatpak run
 *  com.visualstudio.code ») ou, à défaut, le premier trouvé dans EDITORS.
 *  Trouvé ainsi, il s'ouvre dans une nouvelle fenêtre (`-n`) : un agent, un
 *  projet. Le dossier part en dernier argument, jamais interprété (I-27) ;
 *  un échec ne fait rien (I-29). L'éditeur est détaché : il survit à l'appli.
 *  Ne connaît pas : Electron, les agents, la config. Utilisé par : app/menus. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { splitCommand } from 'helpers';
import { which } from 'technicals/paths';

// Cherchés dans cet ordre quand rien n'est réglé, lancés avec `-n` (nouvelle
// fenêtre, chez tous). Pas de $EDITOR : le plus souvent un éditeur de
// terminal, sans fenêtre où s'ouvrir.
export const EDITORS = ['zed', 'code', 'cursor', 'codium'];

// name : ce que montrent les menus (la commande réglée, ou l'éditeur trouvé).
export type Editor = { name: string; open: (dir: string) => void };

// L'éditeur à lancer, ou null s'il est introuvable.
export function findEditor(command: unknown): Editor | null {
  const argv = splitCommand(command);
  if (!argv.length) {
    for (const name of EDITORS) {
      const program = which(name);
      if (program) return editor(name, program, ['-n']);
    }
    return null;
  }
  const program = which(argv[0]) || (fs.existsSync(argv[0]) ? argv[0] : null);
  return program ? editor(String(command).trim(), program, argv.slice(1)) : null;
}

function editor(name: string, program: string, args: string[]): Editor {
  return {
    name,
    open: (dir) => {
      // Erreurs avalées : asynchrones (introuvable, EACCES) par 'error' ;
      // synchrones (un .cmd sans shell sous Windows : EINVAL) par le catch.
      try {
        spawn(program, [...args, dir], { detached: true, stdio: 'ignore', windowsHide: true })
          .on('error', () => {}).unref();
      } catch { /* rien */ }
    },
  };
}
