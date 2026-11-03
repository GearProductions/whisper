/** panel-handlers — ce que la page du panneau peut demander : un gestionnaire
 *  par canal de PANEL_CHANNELS (vérifié par le typage), dont ceux du micro
 *  (transcription, enregistrement, réglages) et de la lecture d'une réponse par
 *  son rang, et du choix de l'agent (un agent par son id, vérifié dans la
 *  config), son menu, Nouvel agent…, ⚙ Réglages (les micros énumérés par la
 *  page). Aucun ne reçoit un texte à coller, copier ou lire (I-2, I-3).
 *  L'expéditeur de chaque message est vérifié en amont, par listenFrom (I-20).
 *  Ne connaît pas : l'écoute elle-même (technicals/ipc). Utilisé par : app/ipc. */
import { PANEL_CHANNELS, type HandlerTable } from 'shared/bridge';
import {
  answerPermission, copyDictation, currentSession, draftVibe, dropOnArtifacts, followCode, history, markVibe, openLink, openSession, openVibeItem,
  panelReady, probeAgent, refreshVibe, resumeSession, runVibeAction, saveCode, sendDraft, setPanelMode, setVibe, showFile,
  cancelSpeak, pushAgents, setRecording, showAgent, speakReply, transcribe, vibeProcess, vibeRunOp,
} from 'app/controllers';
import { openAddAgentMenu, openAgentMenu, openAttachMenu, openSettings } from 'app/menus';
import { loadConfig, saveConfig } from 'app/settings';
import { hideConversation, setCompactHeight } from 'app/windows';

export const panelHandlers: HandlerTable<typeof PANEL_CHANNELS> = {
  on: {
    'conv:ready': () => { panelReady(); pushAgents(); },   // la liste des agents, envoyée avant que la page l'écoute
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
    'dictation:recording': setRecording,
    // Le micro, retrouvé par son nom quand son identifiant a changé.
    'config:setDevice': (deviceId, deviceLabel) => { saveConfig({ deviceId: String(deviceId || ''), deviceLabel: String(deviceLabel || '') }); },
    'tts:cancel': cancelSpeak,
    'agent:show': showAgent,
    'agent:menu': (id) => { openAgentMenu(id); },
    'agent:add': openAddAgentMenu,
    'menu:settings': openSettings,
  },
  handle: {
    'conv:history': history,
    'conv:probe': probeAgent,
    'conv:copy': copyDictation,
    'conv:send': sendDraft,
    'conv:vibeRun': runVibeAction,
    'conv:vibeSave': saveCode,
    'conv:vibeDrop': dropOnArtifacts,
    'config:get': () => {
      const { lang, vocabulary, sound, deviceId, deviceLabel } = loadConfig();
      return { lang, vocabulary, sound, deviceId, deviceLabel };
    },
    'dictation:transcribe': transcribe,
    'conv:speak': speakReply,
  },
};
