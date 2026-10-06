/** tool-text — ce que le panneau écrit d'une action de l'agent : après coup,
 *  une ligne courte, chemins raccourcis (« Écrire le fichier : src/note.txt ») ;
 *  pour une demande d'autorisation, ce qui va s'exécuter EN ENTIER et TEL QUEL
 *  (I-13), avec ses boutons.
 *  Pur. Utilisé par : app/controllers/conversation. */
import { toolTarget } from 'core/agents';

export const TOOL_LABELS: Record<string, string> = {
  Write: 'Écrire le fichier', Edit: 'Modifier le fichier', MultiEdit: 'Modifier le fichier', NotebookEdit: 'Modifier le notebook',
  Read: 'Lire le fichier', Bash: 'Exécuter la commande', WebFetch: 'Consulter la page', WebSearch: 'Chercher sur le web',
};

// Les chemins du dossier de l'agent, raccourcis. Le même dossier s'écrit
// /home/… ou /var/home/… (Fedora Atomic) : les deux, la plus longue d'abord —
// sinon « /var/home/x/f » deviendrait « /varf ».
export function relativeTo(dir: string, text: string, sep = '/') {
  const d = dir.replace(/\/+$/, '');
  const spellings = [d.startsWith('/var/home/') ? d.slice(4) : `/var${d}`, d].sort((x, y) => y.length - x.length);
  return spellings.reduce((t, s) => t.split(`${s}${sep}`).join(''), text);
}

// Pour le fil, après coup : une ligne, chemin relatif au dossier de l'agent.
export function toolSummary(dir: string, tool: string, input: unknown) {
  const target = toolTarget(input);
  const detail = target === undefined ? '' : relativeTo(dir, String(target)).split('\n')[0].slice(0, 300);
  return `${TOOL_LABELS[tool] || tool}${detail ? ` : ${detail}` : ''}`;
}

// Pour une demande d'autorisation : ni chemin raccourci ni coupure silencieuse
// (c'est sur ce texte qu'on autorise). Outil inconnu : ses paramètres bruts.
export const PERMISSION_MAX = 20000;
export function permissionText(tool: string, input: unknown) {
  const target = toolTarget(input);
  const detail = target === undefined ? JSON.stringify(input || {}, null, 2) : String(target);
  const cut = detail.length > PERMISSION_MAX
    ? `\n\n… ${detail.length - PERMISSION_MAX} caractères de plus ne sont pas affichés : dans le doute, refusez.` : '';
  return `${TOOL_LABELS[tool] || tool} :\n${detail.slice(0, PERMISSION_MAX)}${cut}`;
}

// La demande en tête de file, telle que le panneau l'affiche.
export function permissionView(agentName: string, p: { key: number; tool: string; input: unknown; always: string[]; waiting: number }) {
  return {
    key: p.key, text: permissionText(p.tool, p.input), always: p.always,
    title: `${agentName} demande l'autorisation${p.waiting ? ` (${p.waiting} autre${p.waiting > 1 ? 's' : ''} en attente)` : ''}`,
  };
}
