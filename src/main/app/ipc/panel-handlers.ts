/** panel-handlers — ce que la page du panneau peut demander : un gestionnaire
 *  par canal de PANEL_CHANNELS (vérifié par le typage).
 *  Ne connaît pas : l'écoute elle-même (technicals/ipc). Utilisé par : app/ipc. */
import { PANEL_CHANNELS, type HandlerTable } from 'shared/bridge';
import {
  answerPermission, copyDictation, currentSession, draftVibe, history, markVibe, openLink, openSession, openVibeItem, panelReady,
  probeAgent, refreshVibe, resumeSession, runVibeAction, sendDraft, setPanelMode, setVibe, showFile, speakReply, vibeProcess,
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
    'conv:vibeSet': setVibe,
    'conv:vibeMark': markVibe,
    'conv:vibeDraft': draftVibe,
    'conv:vibeOpen': openVibeItem,
    'conv:vibeRefresh': () => { refreshVibe({ now: true }); },
    'conv:vibeProcess': (op, index) => { vibeProcess(op, index); },
  },
  handle: {
    'conv:history': history,
    'conv:probe': probeAgent,
    'conv:copy': copyDictation,
    'conv:send': sendDraft,
    'conv:vibeRun': runVibeAction,
  },
};
