/** panel-handlers — ce que la page du panneau peut demander : un gestionnaire
 *  par canal de PANEL_CHANNELS (vérifié par le typage). L'expéditeur de chaque
 *  message est vérifié en amont, par listenFrom (I-20).
 *  Ne connaît pas : l'écoute elle-même (technicals/ipc). Utilisé par : app/ipc. */
import { PANEL_CHANNELS, type HandlerTable } from 'shared/bridge';
import {
  answerPermission, copyDictation, currentSession, draftVibe, followCode, history, markVibe, openLink, openSession, openVibeItem,
  panelReady, probeAgent, refreshVibe, resumeSession, runVibeAction, saveCode, sendDraft, setPanelMode, setVibe, showFile,
  speakReply, vibeProcess, vibeRunOp,
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
    'conv:vibeRefresh': () => { refreshVibe({ now: true, fresh: true }); },
    'conv:vibeProcess': (op, index) => { vibeProcess(op, index); },
    'conv:vibeRunOp': vibeRunOp,
    'conv:vibeFollow': followCode,
  },
  handle: {
    'conv:history': history,
    'conv:probe': probeAgent,
    'conv:copy': copyDictation,
    'conv:send': sendDraft,
    'conv:vibeRun': runVibeAction,
    'conv:vibeSave': saveCode,
  },
};
