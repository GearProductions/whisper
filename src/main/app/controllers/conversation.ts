/** conversation — ce que montre le panneau : la conversation de l'agent
 *  affiché (son fil, sa demande d'autorisation, sa jauge), ou le contexte
 *  « Dictée » ; et ce qu'il demande (envoyer, joindre, répondre, écouter,
 *  sonder, l'historique, reprendre, copier, ouvrir un lien, montrer un
 *  fichier). Ce qui est copié est le dernier texte dicté, jamais un texte de la
 *  page (I-3) ; une ancienne conversation se lit, ne reçoit rien, et seules
 *  celles du dossier s'ouvrent (I-22).
 *  Ne connaît pas : la fenêtre elle-même (windows/panel-window).
 *  Utilisé par : app/ipc, controllers/agents. */
import fs from 'node:fs';
import { shell } from 'electron';
import type { ConvMode } from 'shared/bridge';
import { permissionView, prepareDraft, relativeTo, splitComposed, toolSummary, withSent } from 'core/conversation';
import { agentColor } from 'core/config';
import { showableFile, webUrl } from 'core/guards';
import { prepareImage, thumbnail } from 'technicals/images';
import * as clipboard from 'technicals/clipboard';
import { agentInstructions, loadConfig, updateAgent } from 'app/settings';
import { state } from 'app/state';
import { deliverPending, hideConversation, openConversation, sendToIcon } from 'app/windows';
import { agents, CLAUDE_MISSING, isBusy, liveViewAgent, pushAgents, sendToAgent, sessions, viewAgent } from './agents';

const DICTATION_COLOR = '#3b6fe0';
const CONV_PROGRESS_MS = 800;
let progressTimer: ReturnType<typeof setTimeout> | null = null;

// Le contexte « Dictée » : le dernier texte dicté, sans champ ni historique.
function showDictation() {
  state.convThread = [];
  state.panel!.webContents.send('conv:thread', {
    dictation: true, mode: 'compact', key: 'dictation', live: false, name: 'Dictée', title: 'Dictée',
    color: DICTATION_COLOR, status: 'idle',
    messages: state.dictation ? [{ role: 'user', text: state.dictation.text, time: state.dictation.time }] : [],
  });
  deliverPending();
}

// Relit la conversation affichée et l'envoie au panneau (à son ouverture, puis
// à chaque changement d'état d'un agent).
export async function refreshConversation() {
  if (!state.panel || !state.convView) return;
  const seq = ++state.convSeq;
  if (!state.convView.agentId) { showDictation(); return; }
  const cfg = loadConfig();
  const agent = viewAgent(cfg);
  if (!agent) { hideConversation(); return; } // agent retiré
  const view = { ...state.convView };
  const sid = view.sessionId || agent.sessionId;
  const st = agents.state(agent.id);
  const [title, thread] = await Promise.all([sid ? sessions.sessionTitle(agent, sid) : '', sessions.thread(agent, sid)]);
  if (!state.panel || seq !== state.convSeq) return;
  // La sortie d'une commande locale (« /context »…) n'est pas dans la
  // transcription : on la reprend de la dernière réponse, après la commande.
  const reply = agents.lastReply(agent.id);
  const lastMsg = thread[thread.length - 1];
  if (!view.sessionId && reply && lastMsg && lastMsg.role === 'user' && lastMsg.text.startsWith('/')
    && reply.asked.trim() === lastMsg.text) {
    thread.push({ role: 'system', kind: 'output', text: reply.text, time: lastMsg.time });
  }
  // Votre message, aussitôt envoyé : la transcription ne l'écrit qu'une fois
  // Claude Code lancé.
  const shown = view.sessionId ? thread : withSent(thread, agents.sent(agent.id), agents.state(agent.id).since);
  state.convThread = shown;
  // Le contexte : occupé (dernière réponse, sinon dernière sonde) sur la taille
  // de la fenêtre (connue après un tour ou une sonde, retenue par agent).
  if (st.contextWindow && st.contextWindow !== agent.contextWindow) updateAgent(agent.id, { contextWindow: st.contextWindow });
  const contextUsed = Number.isFinite(shown.contextTokens) ? shown.contextTokens : st.contextUsed;
  const pending = view.sessionId ? null : agents.pendingPermission(agent.id);
  state.panel.webContents.send('conv:thread', {
    context: { used: Number.isFinite(contextUsed) ? contextUsed : null, max: st.contextWindow || agent.contextWindow || 200000 },
    mode: state.convMode, key: view.sessionId ? `${agent.id}:${view.sessionId}` : agent.id, live: !view.sessionId,
    name: agent.name, color: agentColor(agent, cfg), dir: agent.dir, title, status: st.status, since: st.since,
    // La demande d'autorisation de l'agent, à valider dans le fil.
    permission: pending ? permissionView(agent.name, pending) : null,
    messages: shown.map((m) => {
      const { text, selection: context, files } = m.role === 'user' ? splitComposed(m.text) : { text: m.text, selection: '', files: [] };
      return {
        role: m.role, kind: 'kind' in m ? m.kind : null, text, context, files, time: m.time || null, audio: 'audio' in m && !!m.audio,
        images: ('images' in m ? m.images : []).map(thumbnail).filter(Boolean),
        tools: ('tools' in m ? m.tools : []).map((t) => toolSummary(agent.dir, t.tool, t.input)),
      };
    }),
  });
  deliverPending();
}

// Pendant un tour, le fil suit l'agent (texte, outils) : au plus un
// rafraîchissement par CONV_PROGRESS_MS, la transcription étant relue en entier.
export function conversationProgress() {
  if (!state.panel || progressTimer) return;
  progressTimer = setTimeout(() => { progressTimer = null; refreshConversation(); }, CONV_PROGRESS_MS);
}

/* ---- Ce que demande le panneau ------------------------------------------- */

// La page est prête : sa conversation, puis ce qui l'attendait (dictée, focus
// du champ, message).
export async function panelReady() {
  await refreshConversation();
  state.convReady = true;
  deliverPending();
  if (state.convNotice) state.panel!.webContents.send('conv:notice', state.convNotice);
}

// ⤢ / ⤡ : agrandi (tout le fil) ou réduit (le dernier échange). Réduire une
// ancienne conversation ramène à celle en cours.
export function setPanelMode(mode: unknown) {
  if (!state.convView || (mode !== 'compact' && mode !== 'full')) return;
  openConversation(state.convView.agentId, { sessionId: mode === 'full' ? state.convView.sessionId : null, mode: mode as ConvMode });
}

// Copier du contexte « Dictée » : le dernier texte dicté, connu du principal.
export function copyDictation() {
  if (!state.dictation) return false;
  clipboard.writeText(state.dictation.text);
  return true;
}

// Un lien d'un message s'ouvre dans le navigateur — et seulement une adresse web.
export function openLink(url: unknown) {
  const href = webUrl(url);
  if (href) shell.openExternal(href);
}

// Fichier joint à un message : montré dans le gestionnaire de fichiers, jamais
// ouvert (un script se lancerait).
export function showFile(file: unknown) {
  if (showableFile(file, fs.existsSync)) shell.showItemInFolder(file);
}

// Champ de saisie : un message à l'agent affiché (sa session en cours), avec
// les pièces jointes du champ (glissées, collées, ou choisies par le trombone).
export function sendDraft(draft: unknown) {
  const cfg = loadConfig();
  const agent = liveViewAgent(cfg);
  if (!agent) return { ok: false, error: 'Ancienne conversation : reprenez-la pour lui écrire.' };
  const ready = prepareDraft(draft, { prepareImage, files: { size: (p) => fs.statSync(p).size, read: (p) => fs.readFileSync(p) } });
  return 'error' in ready && ready.error ? { ok: false, error: ready.error } : sendToAgent(agent, (ready as { message: { text: string; images: { mediaType: string; data: string }[] } }).message, cfg);
}

// Réponse à une demande affichée dans le fil : seulement pour l'agent affiché,
// et seulement à la demande que l'utilisateur a sous les yeux (`key`, I-15).
export function answerPermission(decision: unknown, key: unknown) {
  const agent = liveViewAgent();
  if (!agent || (decision !== 'allow' && decision !== 'always' && decision !== 'deny') || !Number.isInteger(key)) return;
  agents.answer(agent.id, decision, key as number);
  pushAgents();
}

// Écouter une réponse : son résumé audio, par le lecteur de l'icône.
export function speakReply(index: unknown) {
  const entry = typeof index === 'number' ? state.convThread[index] : undefined;
  if (!state.icon || !entry || !('audio' in entry) || !entry.audio) return;
  state.convSpeech = entry.audio;
  sendToIcon('tts:speakReply');
}

// La jauge du contexte, cliquée (ou « / » tapé dans le champ) : le détail du
// contexte et les commandes de l'agent, par la sonde.
export async function probeAgent() {
  const agent = viewAgent();
  if (!agent) return { error: 'Aucun agent.' };
  const cfg = loadConfig();
  try {
    const { context: c, commands } = await agents.probe(agent, { command: cfg.agentCommand, instructions: agentInstructions() });
    if (c && c.maxTokens) updateAgent(agent.id, { contextWindow: c.maxTokens });
    refreshConversation(); // la jauge suit la mesure
    return {
      context: c && {
        total: c.totalTokens, max: c.maxTokens, percentage: c.percentage, model: c.model,
        categories: (c.categories || []).map(({ name, tokens, kind, color }: Record<string, unknown>) => ({ name, tokens, kind, color })),
        memoryFiles: (c.memoryFiles || []).map(({ path: file, tokens }: { path: string; tokens: number }) => ({ path: relativeTo(agent.dir, file), tokens })),
      },
      commands: (commands || []).map(({ name, description, argumentHint }) => ({ name, description, argumentHint })),
    };
  } catch (err) {
    return { error: err instanceof Error && err.message === 'notInstalled' ? CLAUDE_MISSING : 'Claude Code n\'a pas répondu.' };
  }
}

// Historique du dossier de l'agent affiché.
export async function history() {
  const agent = viewAgent();
  if (!agent) return [];
  return (await sessions.sessions(agent)).map((s) => ({ ...s, current: s.sessionId === agent.sessionId }));
}

// Ouvrir une session de l'historique : seulement une session de CE dossier.
export async function openSession(sessionId: unknown) {
  const agent = viewAgent();
  if (!agent || typeof sessionId !== 'string' || !(await sessions.sessions(agent)).some((s) => s.sessionId === sessionId)) return;
  openConversation(agent.id, { sessionId, mode: 'full' });
}

// Ancienne conversation affichée : revenir à la conversation en cours…
export function currentSession() {
  const agent = viewAgent();
  if (agent) openConversation(agent.id, { mode: 'full' });
}

// … ou la reprendre : elle redevient la session en cours de l'agent (la
// précédente reste dans l'historique).
export function resumeSession() {
  const agent = viewAgent();
  if (!agent || !state.convView!.sessionId || isBusy(agent.id)) return;
  updateAgent(agent.id, { sessionId: state.convView!.sessionId });
  agents.forgetReply(agent.id); // sa « dernière réponse » était celle de l'autre session
  openConversation(agent.id, { mode: 'full' });
}
