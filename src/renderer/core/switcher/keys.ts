/** keys — les raccourcis du sélecteur d'agents et l'ordre des agents montrés, sans le DOM :
 *  quelle touche ouvre quoi (Ctrl+K la palette, Ctrl+Tab le dernier agent, Ctrl+N un nouvel agent,
 *  Ctrl+Maj+B les branches), la liste des agents montrés du plus récent au plus ancien.
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel (panel-app). */

export type Shortcut = 'palette' | 'last' | 'new-agent' | 'branches';

const RECENT = 10;   // les agents retenus pour Ctrl+Tab

export const shortcut = (e: { key: string; ctrl: boolean; shift: boolean }): Shortcut | null => {
  if (!e.ctrl) return null;
  const key = e.key.toLowerCase();
  if (e.shift) return key === 'b' ? 'branches' : null;
  return key === 'k' ? 'palette' : key === 'tab' ? 'last' : key === 'n' ? 'new-agent' : null;
};

// `shown` en tête de `list`, sans doublon, au plus RECENT.
export const recent = (list: string[], shown: string) => [shown, ...list.filter((id) => id !== shown)].slice(0, RECENT);

// Ctrl+Tab : le premier de `list` qui n'est pas l'agent affiché.
export const lastShown = (list: string[], shown: string | null) => list.find((id) => id !== shown) ?? null;
