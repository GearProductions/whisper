/** agent-menus — les menus des agents : le clic droit sur un robot (écrire,
 *  couleur, modèle, effort, mode, conversations, interrompre, nouvelle session,
 *  retirer), le « + » (nouvel agent dans un dossier favori ou un autre
 *  dossier, avec la question de confiance, I-23), et le trombone du panneau
 *  (fichiers, texte sélectionné).
 *  Ne connaît pas : les pages. Utilisé par : app/ipc. */
import path from 'node:path';
import { app, dialog, Menu, type MenuItemConstructorOptions } from 'electron';
import { EFFORTS, MODELS, MODES, type AgentConfig } from 'core/agents';
import { AGENT_COLORS, agentColor, agentList, colorDot, favoriteFolders } from 'core/config';
import { SELECTION_MAX } from 'core/conversation';
import { readText } from 'technicals/selection';
import { loadConfig, saveConfig, updateAgent } from 'app/settings';
import { state } from 'app/state';
import {
  agents, CLAUDE_MISSING, ensureFolderColors, isBusy, newAgent, pushAgents, trustFolder,
} from 'app/controllers';
import { conversationFocusInput, openConversation } from 'app/windows';

// Clic droit sur un robot : ses réglages, comme dans les autres intégrations.
export function openAgentMenu(id: unknown) {
  const agent = agentList(loadConfig()).find((a) => a.id === id);
  if (!agent || !state.icon) return;
  const st = agents.state(agent.id);
  const busy = isBusy(agent.id);
  const radio = (key: 'model' | 'effort' | 'mode', options: [string, string][]) => options.map(([value, label]) => ({
    label, type: 'radio' as const, checked: ((agent as AgentConfig)[key] || options[0][0]) === value,
    click: () => {
      updateAgent(agent.id, { [key]: value });
      // Agent au travail : le tour en cours suit le nouveau réglage.
      if (key === 'mode') agents.setMode(agent.id, value);
      if (key === 'model') agents.setModel(agent.id, value);
    },
  }));
  Menu.buildFromTemplate([
    { label: agent.name, enabled: false },
    { label: agent.dir, enabled: false },
    { type: 'separator' },
    // Sans parler (micro indisponible, lieu calme) : le champ de son panneau.
    { label: '✎ Écrire un message…', click: () => { openConversation(agent.id); conversationFocusInput(); } },
    { type: 'separator' },
    { label: 'Couleur du dossier', submenu: AGENT_COLORS.map(([value, label, dot]) => ({
      label: `${dot} ${label}`, type: 'radio' as const, checked: agentColor(agent, loadConfig()) === value,
      click: () => {
        saveConfig({ agentFolders: ensureFolderColors().map((f) => (f.dir === agent.dir ? { ...f, color: value } : f)) });
        pushAgents();
      },
    })) },
    { label: 'Modèle', submenu: radio('model', MODELS) },
    { label: 'Effort', submenu: radio('effort', EFFORTS) },
    { label: 'Mode', submenu: radio('mode', MODES) },
    { type: 'separator' },
    { label: 'Dernier échange', enabled: st.hasReply || !!agent.sessionId, click: () => openConversation(agent.id, { mode: 'compact' }) },
    { label: '⤢ Conversation complète (et historique)', click: () => openConversation(agent.id, { mode: 'full' }) },
    { label: 'Interrompre', enabled: busy, click: () => { agents.interrupt(agent.id); pushAgents(); } },
    { label: 'Nouvelle session (effacer le contexte)', click: () => {
      agents.forget(agent.id);
      updateAgent(agent.id, { sessionId: null });
      pushAgents(); // le panneau des conversations, s'il est ouvert, se vide
    } },
    { type: 'separator' },
    { label: 'Retirer cet agent', click: () => {
      agents.forget(agent.id);
      const cfg = loadConfig();
      saveConfig({
        agents: agentList(cfg).filter((a) => a.id !== agent.id),
        agentSelected: cfg.agentSelected === agent.id ? null : cfg.agentSelected,
        agentFolders: ensureFolderColors(), // son dossier reste proposé par « + », avec sa couleur
      });
      pushAgents(); // son panneau, s'il est ouvert, se ferme (cf. refreshConversation)
    } },
  ]).popup({ window: state.icon });
}

// Bouton « + » : un nouvel agent, dans un dossier favori (déjà choisi, sans
// agent pour l'instant) ou dans un dossier à choisir, qui devient favori.
export function openAddAgentMenu() {
  if (!state.icon) return;
  const cfg = loadConfig();
  const available = agents.isAvailable(cfg.agentCommand);
  const inUse = new Set(agentList(cfg).map((a) => a.dir));
  const free = ensureFolderColors().filter((f) => !inUse.has(f.dir));
  const home = app.getPath('home');
  const short = (d: string) => (d.startsWith(`${home}${path.sep}`) ? `~${d.slice(home.length)}` : d);
  Menu.buildFromTemplate([
    { label: free.length ? 'Nouvel agent dans un dossier favori' : 'Aucun dossier favori disponible', enabled: false },
    ...free.map((f) => ({
      label: `${colorDot(f.color)} ${path.basename(f.dir)}  —  ${short(f.dir)}`, enabled: available, click: () => newAgent(f.dir),
    })),
    { type: 'separator' },
    { label: 'Choisir un autre dossier…', enabled: available,
      click: async () => {
        const res = await dialog.showOpenDialog({ title: 'Dossier de travail de l\'agent', properties: ['openDirectory'] });
        if (!res.canceled && res.filePaths[0] && await trustFolder(res.filePaths[0])) newAgent(res.filePaths[0]);
      } },
    ...(free.length ? [{
      label: 'Oublier un dossier favori',
      submenu: free.map((f) => ({
        label: `${colorDot(f.color)} ${short(f.dir)}`,
        click: () => saveConfig({ agentFolders: favoriteFolders(loadConfig()).filter((o) => o.dir !== f.dir) }),
      })),
    }] : []),
    ...(available ? [] : [{ type: 'separator' as const }, { label: CLAUDE_MISSING, enabled: false }]),
  ] as MenuItemConstructorOptions[]).popup({ window: state.icon });
}

// Le texte sélectionné, joint au message. Pas de sélection sous Windows : la
// lire y demande un Ctrl+C simulé dans l'application au premier plan — dans un
// terminal, il interromprait le programme. Le presse-papiers, lui, se colle
// dans le champ.
const canAttachSelection = process.platform === 'linux';
async function readSelection() {
  if (!canAttachSelection) return { text: '', cut: false };
  const text = (await readText('selection')).trim();
  return { text: text.slice(0, SELECTION_MAX), cut: text.length > SELECTION_MAX };
}

// Trombone du champ : choisir des images ou fichiers, ou joindre le texte
// sélectionné (relu à ce moment, montré dans le menu). Le choix revient par
// conv:attached.
export async function openAttachMenu() {
  const conv = state.panel;
  if (!conv) return;
  const sel = canAttachSelection ? await readSelection() : null;
  const preview = sel && sel.text ? sel.text.replace(/\s+/g, ' ').slice(0, 60) : '';
  Menu.buildFromTemplate([
    { label: 'Images ou fichiers…', click: async () => {
      const res = await dialog.showOpenDialog(conv, { title: 'Joindre au message', properties: ['openFile', 'multiSelections'] });
      if (!res.canceled && state.panel) state.panel.webContents.send('conv:attached', { files: res.filePaths });
    } },
    ...(sel ? [{
      label: sel.text ? `Texte sélectionné (${sel.text.length.toLocaleString('fr-FR')} car.) : « ${preview}${sel.text.length > 60 ? '…' : ''} »`
        : 'Aucun texte sélectionné', enabled: !!sel.text,
      click: () => { if (state.panel) state.panel.webContents.send('conv:attached', { selection: sel }); },
    }] : []),
  ]).popup({ window: conv });
}
