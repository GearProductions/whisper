/** editor — ouvrir un dossier dans l'éditeur de code de l'utilisateur : la
 *  commande réglée (`editorCommand`, ex. « zed », « flatpak run
 *  com.visualstudio.code ») ou, à défaut, le premier trouvé dans EDITORS.
 *  Le dossier part en dernier argument, jamais interprété (I-27) ; un échec
 *  ne fait rien (I-29). L'éditeur est détaché : il survit à l'appli.
 *  Ne connaît pas : Electron, les agents, la config. Utilisé par : app/menus. */

// Cherchés dans cet ordre quand rien n'est réglé. Pas de $EDITOR : le plus
// souvent un éditeur de terminal, sans fenêtre où s'ouvrir.
export const EDITORS = ['zed', 'code', 'cursor', 'codium'];

// name : ce que montrent les menus (la commande réglée, ou l'éditeur trouvé).
export type Editor = { name: string; open: (dir: string) => void };

// L'éditeur à lancer, ou null s'il est introuvable.
export function findEditor(_command: unknown): Editor | null {
  return null;
}
