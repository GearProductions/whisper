/** icon-handlers — ce que la page de l'icône peut demander au principal : un
 *  gestionnaire par canal de ICON_CHANNELS (vérifié par le typage).
 *  Ne connaît pas : l'écoute elle-même (technicals/ipc). Utilisé par : app/ipc. */
import { ICON_CHANNELS, type HandlerTable } from 'shared/bridge';
import { cancelSpeak, clickAgent, setRecording, speak, transcribe, warmUpPaste, warmUpSpeak } from 'app/controllers';
import { openAddAgentMenu, openAgentMenu, openMainMenu } from 'app/menus';
import { loadConfig, saveConfig } from 'app/settings';
import { state } from 'app/state';
import { bubbleShown, conversationShown, moveIcon, placeBubble, placeConversation } from 'app/windows';

export const iconHandlers: HandlerTable<typeof ICON_CHANNELS> = {
  on: {
    'win:setPosition': (x, y) => {
      if (!state.icon) return;
      moveIcon(Number(x), Number(y));
      if (bubbleShown()) placeBubble();
      if (conversationShown()) placeConversation();
    },
    'win:savePosition': (x, y) => { saveConfig({ pos: { x: Math.round(Number(x)), y: Math.round(Number(y)) } }); },
    // Le micro, retrouvé par son nom quand son identifiant a changé.
    'config:setDevice': (deviceId, deviceLabel) => { saveConfig({ deviceId: String(deviceId || ''), deviceLabel: String(deviceLabel || '') }); },
    'dictation:recording': setRecording,
    'menu:open': openMainMenu,
    'tts:cancel': cancelSpeak,
    'tts:warmUp': () => { warmUpSpeak(); },
    'agent:click': clickAgent,
    'agent:menu': openAgentMenu,
    'agent:add': openAddAgentMenu,
  },
  handle: {
    'win:getBounds': () => (state.icon ? state.icon.getBounds() : null),
    'config:get': () => {
      const { lang, vocabulary, sound, deviceId, deviceLabel } = loadConfig();
      return { lang, vocabulary, sound, deviceId, deviceLabel };
    },
    'dictation:warmUp': warmUpPaste,
    'dictation:transcribe': transcribe,
    'tts:speak': speak,
  },
};
