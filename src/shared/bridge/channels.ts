/** channels — les canaux de chaque pont, par sens : `send` (page → principal,
 *  sans réponse), `invoke` (avec réponse), `events` (principal → page). Le pont
 *  n'emprunte que ceux-là, la table de gestionnaires de sa fenêtre les couvre
 *  tous (vérifié par le typage) et rien d'autre.
 *  Ne connaît pas : Electron. Utilisé par : src/preload, src/main (app/ipc),
 *  tests/invariants/bridges.test.ts. */

export const ICON_CHANNELS = {
  send: ['win:setPosition', 'win:savePosition', 'config:setDevice', 'dictation:recording', 'menu:open', 'tts:cancel',
    'tts:warmUp', 'agent:click', 'agent:menu', 'agent:add'],
  invoke: ['win:getBounds', 'config:get', 'dictation:warmUp', 'dictation:transcribe', 'tts:speak'],
  events: ['tts:state', 'tts:chunk', 'tts:end', 'tts:speakReply', 'agents:state'],
} as const;

export const BUBBLE_CHANNELS = {
  send: ['bubble:ready', 'bubble:hover', 'bubble:close', 'bubble:volume'],
  invoke: [],
  events: ['bubble:show'],
} as const;

export const PANEL_CHANNELS = {
  send: ['conv:ready', 'conv:speak', 'conv:open', 'conv:resume', 'conv:current', 'conv:mode', 'conv:height', 'conv:hide',
    'conv:attach', 'conv:answer', 'conv:openLink', 'conv:showFile'],
  invoke: ['conv:history', 'conv:probe', 'conv:copy', 'conv:send'],
  events: ['conv:thread', 'conv:notice', 'conv:attached', 'conv:dictation', 'conv:focusInput'],
} as const;

export type Channels = { send: readonly string[]; invoke: readonly string[]; events: readonly string[] };

// La table de gestionnaires d'une fenêtre : un par canal reçu, ni plus ni moins.
// Les arguments viennent d'une page : à vérifier avant usage.
export type HandlerTable<C extends Channels> = {
  on: { [K in C['send'][number]]: (...args: unknown[]) => void };
  handle: { [K in C['invoke'][number]]: (...args: unknown[]) => unknown };
};
