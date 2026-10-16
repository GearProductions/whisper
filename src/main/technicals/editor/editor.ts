/** editor — ouvrir un dossier (ou un fichier) dans l'éditeur de code de
 *  l'utilisateur : la commande réglée (`editorCommand`, ex. « zed », « flatpak
 *  run com.visualstudio.code ») ou, à défaut, le premier trouvé dans EDITORS.
 *  Trouvé ainsi, il ouvre un dossier dans une nouvelle fenêtre (`-n`) : un
 *  agent, un projet ; un fichier, là où l'éditeur le range (la fenêtre de son
 *  projet), à une ligne si on la donne et que l'éditeur est connu (zed :
 *  `fichier:ligne` ; code, cursor, codium : `-g fichier:ligne` ; un autre : le
 *  fichier seul). Le chemin part en dernier argument, jamais interprété (I-27) ;
 *  un échec ne fait rien (I-29). L'éditeur est détaché : il survit à l'appli.
 *  Ne connaît pas : Electron, les agents, la config.
 *  Utilisé par : app/menus, app/controllers/vibecoder. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { splitCommand } from 'helpers';
import { which } from 'technicals/paths';

// Cherchés dans cet ordre quand rien n'est réglé, lancés avec `-n` (nouvelle
// fenêtre, chez tous). Pas de $EDITOR : le plus souvent un éditeur de
// terminal, sans fenêtre où s'ouvrir.
export const EDITORS = ['zed', 'code', 'cursor', 'codium'];

// name : ce que montrent les menus (la commande réglée, ou l'éditeur trouvé).
export type Editor = { name: string; open: (dir: string) => void; openFile: (file: string, line?: number) => void };

// L'éditeur à lancer, ou null s'il est introuvable.
export function findEditor(command: unknown): Editor | null {
  const argv = splitCommand(command);
  if (!argv.length) {
    for (const name of EDITORS) {
      const program = which(name);
      if (program) return editor(name, program, ['-n'], [], name);
    }
    return null;
  }
  const program = which(argv[0]) || (fs.existsSync(argv[0]) ? argv[0] : null);
  // Un éditeur connu, d'après un mot de la commande (« zed », « /usr/bin/code », « com.visualstudio.code », « Cursor.exe »).
  const known = EDITORS.find((e) => argv.some((a) => new RegExp(`(^|[\\\\/.])${e}(\\.exe|\\.cmd)?$`, 'i').test(a))) ?? null;
  return program ? editor(String(command).trim(), program, argv.slice(1), argv.slice(1), known) : null;
}

function editor(name: string, program: string, dirArgs: string[], fileArgs: string[], known: string | null): Editor {
  // Erreurs avalées : asynchrones (introuvable, EACCES) par 'error' ;
  // synchrones (un .cmd sans shell sous Windows : EINVAL) par le catch.
  const launch = (args: string[]) => {
    try {
      spawn(program, args, { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
    } catch { /* rien */ }
  };
  const at = (file: string, line?: number) => (!line || !Number.isInteger(line) || line < 1 || !known ? [file]
    : known === 'zed' ? [`${file}:${line}`] : ['-g', `${file}:${line}`]);
  return { name, open: (dir) => launch([...dirArgs, dir]), openFile: (file, line) => launch([...fileArgs, ...at(file, line)]) };
}
