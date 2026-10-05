/** IconApp — la fenêtre de l'icône : le micro (geste, dictée), le bouton de
 *  lecture, les robots des agents, le menu du clic droit. La colle : seul
 *  fichier de l'icône qui connaît le pont (window.api).
 *  Ne connaît pas : le panneau, la bulle. Utilisé par : main.tsx. */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { AgentsState, IconApi } from '../bridge';
import { AgentButtons } from './AgentButtons';
import { beep } from './beep';
import { createDictation, type Phase } from './dictation';
import { useGesture } from './gesture';
import { PlayButton } from './PlayButton';
import { listInputs, openMic, record } from './recorder';
import { createSpeechPlayer, ERROR_MS, type SpeechView } from './speech';

const HINT = 'Maintenir pour dicter · glisser pour déplacer · clic droit : réglages';
const REPLY_FREQ = 660;

export function IconApp({ api }: { api: IconApi }) {
  // Phase de l'icône et message de son infobulle (effacé après ERROR_MS).
  const [phase, setPhaseState] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const phaseRef = useRef<Phase>('idle');
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [agents, setAgents] = useState<AgentsState>({ enabled: false });
  const [speech, setSpeech] = useState<SpeechView | null>(null);
  const unreadBefore = useRef(new Set<string>());

  const setPhase = (p: Phase, msg = '') => {
    phaseRef.current = p;
    setPhaseState(p);
    setMessage(msg);
    clearTimeout(messageTimer.current);
    if (p === 'error' || msg) {
      messageTimer.current = setTimeout(() => {
        if (phaseRef.current === 'error') { phaseRef.current = 'idle'; setPhaseState('idle'); }
        setMessage('');
      }, ERROR_MS);
    }
  };

  const [player] = useState(() => createSpeechPlayer({ api, newContext: () => new AudioContext(), onChange: setSpeech }));
  const [dictation] = useState(() => createDictation({
    api,
    openMic: (cfg) => openMic(cfg, (id, label) => api.setDevice(id, label)),
    record,
    beep: (cfg, freq) => { if (cfg.sound !== false) beep(freq); },
    stopSpeaking: player.stop,
    setPhase,
  }));

  const gesture = useGesture({
    getBounds: api.getBounds,
    moveTo: api.setPosition,
    dropAt: api.savePosition,
    holdStart: dictation.start,
    holdEnd: dictation.stop,
  });

  // Écoutes posées pendant le premier rendu (synchrone, cf. main.tsx) : le
  // principal envoie l'état des robots et du bouton dès la page chargée.
  useLayoutEffect(() => {
    api.onSpeakState(player.setState);
    api.onSpeakChunk(player.onChunk);
    api.onSpeakEnd(player.onEnd);
    api.onSpeakReply(player.speakReply);
    api.onAgents((s) => {
      setAgents(s || { enabled: false });
      // Une réponse vient d'arriver : le bip de fin, comme pour une dictée (pas
      // pour celle de l'agent affiché : déjà lue, elle n'est jamais « non lue »).
      const unread = new Set(((s && s.enabled && s.agents) || []).filter((a) => a.unread).map((a) => a.id));
      if ([...unread].some((id) => !unreadBefore.current.has(id))) {
        api.getConfig().then((cfg) => { if (cfg.sound !== false) beep(REPLY_FREQ); });
      }
      unreadBefore.current = unread;
    });
    // Sur l'icône comme sur le bouton de lecture ; un robot a son propre menu.
    document.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      const agent = (e.target as Element).closest<HTMLElement>('.agent');
      if (agent) api.agentMenu(agent.dataset.id!);
      else api.openMenu(await listInputs());
    });
  }, []);

  const list = (agents.enabled && agents.agents) || [];
  const selected = list.find((a) => a.selected);
  const hint = selected ? `Maintenir pour parler à ${selected.name} · glisser pour déplacer · clic droit : réglages` : HINT;
  const view = speech || player.view();

  return (
    <div id="app" data-tts={view.state.mode === 'off' ? 'off' : 'on'} data-agents={agents.enabled ? 'on' : 'off'}
      data-target={selected ? 'agent' : ''} style={{ '--agent': selected ? selected.color : '' } as CSSProperties}>
      <div id="icon" data-phase={phase} title={message || hint} {...gesture}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7" fill="none" />
        </svg>
      </div>
      {/* Petits boutons accolés à l'icône : lecture, agents, ajout. */}
      <div id="side">
        <PlayButton view={view} onClick={player.click} onHover={() => { if (player.canSpeak()) api.warmUpSpeak(); }} />
        <AgentButtons agents={list} onClick={api.agentClick} />
        <button id="add" className="small" type="button" title="Agents Claude Code : ajouter un dossier, autres agents"
          aria-label="Ajouter un agent" onClick={() => api.agentAdd()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" fill="none" /></svg>
        </button>
      </div>
    </div>
  );
}
