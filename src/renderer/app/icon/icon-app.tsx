/** icon-app — la fenêtre de l'icône : le micro (glisser pour déplacer ; la
 *  dictée et la lecture à voix haute sont au panneau), les robots des agents
 *  et de leurs enfants (bip d'une réponse non lue ou d'un signal de course qui
 *  apparaît ou change, sauf working, cible de la dictée : enfants compris), le
 *  menu du clic droit. La colle : seul fichier de l'icône qui connaît le pont (window.api).
 *  Ne connaît pas : le panneau, la bulle. Utilisé par : main.tsx. */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { beep, listInputs } from 'technicals/audio';
import type { IconAgentsState, IconAgentView, IconApi } from 'technicals/bridge';
import { AgentButtons } from './components';
import { useGesture } from './hooks';

const HINT = 'Glisser pour déplacer · clic droit : réglages';
const REPLY_FREQ = 660;
// Les robots et leurs enfants (worktrees), à plat.
const withChildren = (agents: IconAgentView[]) => agents.flatMap((a) => [a, ...a.children]);

const noop = () => {};

export function IconApp({ api }: { api: IconApi }) {
  const [agents, setAgents] = useState<IconAgentsState>({ enabled: false });
  const heardBefore = useRef(new Set<string>());

  // Le maintien ne dicte plus (la dictée est au panneau) : il ne fait rien.
  const gesture = useGesture({ getBounds: api.getBounds, moveTo: api.setPosition, dropAt: api.savePosition, holdStart: noop, holdEnd: noop });

  // Écoute posée pendant le premier rendu (synchrone, cf. main.tsx) : le
  // principal envoie l'état des robots dès la page chargée.
  useLayoutEffect(() => {
    api.onAgents((s) => {
      setAgents(s || { enabled: false });
      // Une réponse vient d'arriver, ou le signal d'une course (F-55) apparaît ou
      // change : le bip de fin, comme pour une dictée (pas pour l'agent affiché :
      // déjà lu, ni « non lu » ni signal). Le signal, pas l'état fusionné ; une
      // course qui travaille ne bipe pas (rien n'attend l'utilisateur).
      const heard = new Set(withChildren((s && s.enabled && s.agents) || [])
        .flatMap((a) => [a.unread ? a.id : '', a.signal && a.signal !== 'working' ? `${a.id}~${a.signal}` : '']).filter(Boolean));
      if ([...heard].some((k) => !heardBefore.current.has(k))) {
        api.getConfig().then((cfg) => { if (cfg.sound !== false) beep(REPLY_FREQ); });
      }
      heardBefore.current = heard;
    });
    // Sur l'icône ; un robot a son propre menu.
    document.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      const agent = (e.target as Element).closest<HTMLElement>('.agent');
      if (agent) api.agentMenu(agent.dataset.id!);
      else api.openMenu(await listInputs());
    });
  }, []);

  const list = (agents.enabled && agents.agents) || [];
  const selected = withChildren(list).find((a) => a.selected);

  return (
    <div id="app" data-agents={agents.enabled ? 'on' : 'off'}
      data-target={selected ? 'agent' : ''} style={{ '--agent': selected ? selected.color : '' } as CSSProperties}>
      <div id="icon" title={HINT} {...gesture}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7" fill="none" />
        </svg>
      </div>
      {/* Petits boutons accolés à l'icône : agents, ajout. */}
      <div id="side">
        <AgentButtons agents={list} onClick={api.agentClick} />
        <button id="add" className="small" type="button" title="Agents Claude Code : ajouter un dossier, autres agents"
          aria-label="Ajouter un agent" onClick={() => api.agentAdd()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" fill="none" /></svg>
        </button>
      </div>
    </div>
  );
}
