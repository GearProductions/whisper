/** panel-handlers — ce que la page du panneau peut demander : un gestionnaire
 *  par canal de PANEL_CHANNELS (vérifié par le typage).
 *  Ne connaît pas : l'écoute elle-même (technicals/ipc). Utilisé par : app/ipc. */
import { PANEL_CHANNELS, type HandlerTable } from 'shared/bridge';
import {
  answerPermission, copyDictation, currentSession, history, openLink, openSession, panelReady, probeAgent, resumeSession,
  sendDraft, setPanelMode, showFile, speakReply,
} from 'app/controllers';
import { openAttachMenu } from 'app/menus';
import { hideConversation, setCompactHeight } from 'app/windows';

export const panelHandlers: HandlerTable<typeof PANEL_CHANNELS> = {
  on: {
    'conv:ready': () => { panelReady(); },
    'conv:speak': speakReply,
    'conv:open': (sessionId) => { openSession(sessionId); },
    'conv:resume': resumeSession,
    'conv:current': currentSession,
    'conv:mode': setPanelMode,
    'conv:height': setCompactHeight,
    'conv:hide': hideConversation,
    'conv:attach': () => { openAttachMenu(); },
    'conv:answer': answerPermission,
    'conv:openLink': openLink,
    'conv:showFile': showFile,
  },
  handle: {
    'conv:history': history,
    'conv:probe': probeAgent,
    'conv:copy': copyDictation,
    'conv:send': sendDraft,
  },
};
