/** constants — la consigne <audio> par défaut, et les choix proposés pour un
 *  agent (modèle, effort, mode).
 *  Utilisé par : core/agents, app/menus, app/controllers/agents. */

export const AUDIO_RULES = [
  'Tu réponds à travers Whisper, une application vocale : l\'utilisateur DICTE ses messages (tolère les fautes de',
  'transcription, surtout sur les termes techniques) et peut ÉCOUTER ta réponse au lieu de la lire.',
  'Réponds normalement, puis termine TOUJOURS par un bloc <audio>…</audio>. Ce bloc est lu par une synthèse vocale :',
  '- un résumé oral court de ta réponse, en 2 à 4 phrases, dans la langue de l\'utilisateur ;',
  '- ce qui a été fait ou trouvé, puis ta question s\'il y en a une ;',
  '- aucun Markdown, code, chemin de fichier, symbole ni liste : des phrases simples qui se disent à voix haute.',
  'N\'écris rien après ce bloc.',
].join('\n');

// [valeur, libellé] pour les menus. '' : le réglage par défaut de Claude Code.
export const MODELS: [string, string][] = [['', 'Par défaut'], ['fable', 'Fable'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']];
export const EFFORTS: [string, string][] = [['', 'Par défaut'], ['low', 'Faible'], ['medium', 'Moyen'], ['high', 'Élevé'], ['xhigh', 'Très élevé'], ['max', 'Maximal']];
export const MODES: [string, string][] = [
  ['default', 'Manuel (demander avant d\'agir)'],
  ['acceptEdits', 'Accepter les modifications de fichiers'],
  ['auto', 'Auto'],
  ['plan', 'Plan (lecture seule)'],
];

// Les outils qu'« Accepter les modifications » n'interroge plus.
export const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
