/** compact-height — la hauteur du panneau réduit : celle de son contenu, que le
 *  principal lui donne. Le fil remplit la fenêtre (son scrollHeight ne descend
 *  pas sous sa hauteur) : on mesure donc ses éléments.
 *  Ne connaît pas : le pont, React. Utilisé par : app/panel (panel-app). */

export type Parts = {
  fixed: (HTMLElement | null)[];   // en-tête, message, bandeau, champ : comptés s'ils sont visibles
  contextPanel: HTMLElement | null;
  thread: HTMLElement;
};

const CONTEXT_MAX = 360;

export function compactHeight({ fixed, contextPanel, thread }: Parts) {
  const sum = fixed.reduce((h, el) => h + (!el || el.hidden ? 0 : el.offsetHeight), 0);
  const panel = !contextPanel || contextPanel.hidden ? 0 : Math.min(contextPanel.scrollHeight, CONTEXT_MAX); // le détail du contexte, s'il est ouvert
  const top = thread.getBoundingClientRect().top - thread.scrollTop;
  const bottom = Math.max(top, ...[...thread.children].map((c) => c.getBoundingClientRect().bottom + parseFloat(getComputedStyle(c).marginBottom)));
  return sum + Math.max(bottom - top + 16, panel) + 2; // marge basse du fil, bordure
}
