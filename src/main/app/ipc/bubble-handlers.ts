/** bubble-handlers — ce que la page de la bulle peut demander : un
 *  gestionnaire par canal de BUBBLE_CHANNELS (vérifié par le typage).
 *  Ne connaît pas : l'écoute elle-même (technicals/ipc). Utilisé par : app/ipc. */
import { BUBBLE_CHANNELS, type HandlerTable } from 'shared/bridge';
import { setVolume } from 'app/controllers';
import { bubbleHover, bubbleReady, hideBubble } from 'app/windows';

export const bubbleHandlers: HandlerTable<typeof BUBBLE_CHANNELS> = {
  on: {
    'bubble:ready': bubbleReady,
    'bubble:hover': bubbleHover,
    'bubble:close': () => hideBubble(),
    'bubble:volume': setVolume,
  },
  handle: {},
};
