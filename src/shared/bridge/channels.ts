/** channels — les canaux de chaque pont, par sens : `send` (page → principal,
 *  sans réponse), `invoke` (avec réponse), `events` (principal → page). Le pont
 *  n'emprunte que ceux-là, la table de gestionnaires de sa fenêtre les couvre
 *  tous (vérifié par le typage) et rien d'autre. Le panneau porte aussi le micro
 *  (réglages, enregistrement, transcription) et la lecture d'une réponse par son
 *  rang, et le choix de l'agent affiché (un agent par son id, jamais un
 *  chemin), son menu, Nouvel agent…, ⚙ Réglages (le panneau est le seul pont). Aucun canal ne
 *  colle, ne copie ni ne lit un texte fourni par une page (I-2, I-3).
 *  Ne connaît pas : Electron. Utilisé par : src/preload, src/main (app/ipc),
 *  tests/invariants/bridges.test.ts. */

export const PANEL_CHANNELS = {
  send: ['conv:ready', 'conv:open', 'conv:resume', 'conv:current',
    'conv:attach', 'conv:answer', 'conv:openLink', 'conv:showFile',
    'conv:vibeSet', 'conv:vibeMark', 'conv:vibeDraft', 'conv:vibeOpen', 'conv:vibeRefresh', 'conv:vibeProcess',
    'conv:vibeRunOp', 'conv:vibeFollow', 'dictation:recording', 'config:setDevice', 'tts:cancel',
    'agent:show', 'agent:menu', 'agent:add', 'menu:settings'],
  invoke: ['conv:history', 'conv:probe', 'conv:send', 'conv:vibeRun', 'conv:vibeSave',
    'conv:vibeDrop', 'config:get', 'dictation:transcribe', 'conv:speak'],
  events: ['conv:thread', 'conv:notice', 'conv:attached', 'conv:focusInput', 'conv:vibe', 'conv:vibeCode',
    'tts:chunk', 'tts:end', 'agents:state'],
} as const;

export type Channels = { send: readonly string[]; invoke: readonly string[]; events: readonly string[] };

// La table de gestionnaires d'une fenêtre : un par canal reçu, ni plus ni moins.
// Les arguments viennent d'une page : à vérifier avant usage.
export type HandlerTable<C extends Channels> = {
  on: { [K in C['send'][number]]: (...args: unknown[]) => void };
  handle: { [K in C['invoke'][number]]: (...args: unknown[]) => unknown };
};
