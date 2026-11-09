/** agent-menus — les menus des agents, posés sur la fenêtre (state.panel) : le menu d'un agent (écrire,
 *  ouvrir sur GitHub, dans l'éditeur, un terminal dans son dossier
 *  (terminalCommand, sinon le premier trouvé ; grisé s'il n'y en a pas), couleur
 *  (pas pour un enfant dont le parent est là : celle de son parent), modèle, effort, mode,
 *  interrompre, nouvelle session, retirer : ces deux-là
 *  ferment aussi ses courses ; pour un agent sans parent à la racine d'un
 *  dépôt, le sous-menu Worktrees : ses worktrees sans agent, chacun avec
 *  *Ouvrir un agent ici* ; pas de sous-menu si git n'a pas répondu), « Nouvel
 *  agent… » (dans un dossier favori ou un autre dossier, avec la question
 *  de confiance, I-23, puis le rattachement à sa famille), et le trombone du
 *  panneau (images ou fichiers).
 *  Ne connaît pas : les pages, git (app/controllers : freeWorktrees, openHere,
 *  syncFamilies). Utilisé par : app/ipc. */
import path from 'node:path';
import { app, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { EFFORTS, MODELS, MODES, type AgentConfig } from 'core/agents';
import { AGENT_COLORS, agentColor, agentList, colorDot, favoriteFolders } from 'core/config';
import { agentParent } from 'core/family';
import { githubPage } from 'core/repo';
import { findEditor, findTerminal } from 'technicals/editor';
import { loadConfig, saveConfig, updateAgent } from 'app/settings';
import { state } from 'app/state';
import {
  agents, CLAUDE_MISSING, closeRuns, ensureFolderColors, freeWorktrees, interruptAgent, isBusy, newAgent, openHere, pushAgents, readFile, real,
  removeAgent, setAgentSetting, syncFamilies, trustFolder, worktreeParent,
} from 'app/controllers';
import { conversationFocusInput, openConversation } from 'app/windows';

// Un dossier, ~ pour le home.
const short = (d: string) => {
  const home = app.getPath('home');
  return d.startsWith(`${home}${path.sep}`) ? `~${d.slice(home.length)}` : d;
};
// Un nouvel agent, puis sa famille (il peut être le worktree d'un autre).
const addAgent = (dir: string) => { newAgent(dir); syncFamilies(); };

// Le menu d'un agent (le sélecteur) : ses réglages.
export async function openAgentMenu(id: unknown) {
  const agent = agentList(loadConfig()).find((a) => a.id === id);
  if (!agent || !state.panel) return;
  // Les worktrees sans agent, relus par git avant d'ouvrir le menu (null : pas de sous-menu).
  const worktrees = agentParent(agent) ? null : (await freeWorktrees(agent))?.free;
  if (!state.panel) return;
  const busy = isBusy(agent.id);
  const page = githubPage(agent.dir, readFile); // relu à chaque clic droit
  const cfg = loadConfig();
  const editor = findEditor(cfg.editorCommand);
  const terminal = findTerminal(cfg.terminalCommand);
  // Agent au travail : le tour en cours suit le nouveau mode, le nouveau modèle.
  const radio = (key: 'model' | 'effort' | 'mode', options: [string, string][]) => options.map(([value, label]) => ({
    label, type: 'radio' as const, checked: ((agent as AgentConfig)[key] || options[0][0]) === value,
    click: () => setAgentSetting(agent.id, key, value),
  }));
  Menu.buildFromTemplate([
    { label: agent.name, enabled: false },
    { label: agent.dir, enabled: false },
    // Le dépôt affiché est celui qui sera ouvert (I-32) ; grisé sans origine GitHub.
    { label: page ? `Ouvrir sur GitHub — ${page.slice('https://github.com/'.length)}` : 'Ouvrir sur GitHub',
      enabled: !!page, click: () => { if (page) shell.openExternal(page); } },
    { label: editor ? `Ouvrir dans l'éditeur (${editor.name})` : 'Ouvrir dans l\'éditeur',
      enabled: !!editor, click: () => editor?.open(agent.dir) },
    { label: terminal ? `Ouvrir un terminal ici (${terminal.name})` : 'Ouvrir un terminal ici',
      enabled: !!terminal, click: () => terminal?.open(agent.dir) },
    { type: 'separator' },
    // Sans parler (micro indisponible, lieu calme) : le champ de son panneau.
    { label: '✎ Écrire un message…', click: () => { openConversation(agent.id); conversationFocusInput(); } },
    { type: 'separator' },
    // Un enfant a la couleur de son parent (présent ; orphelin : la sienne).
    ...(worktreeParent(agent) ? [] : [{ label: 'Couleur du dossier', submenu: AGENT_COLORS.map(([value, label, dot]) => ({
      label: `${dot} ${label}`, type: 'radio' as const, checked: agentColor(agent, loadConfig()) === value,
      click: () => {
        saveConfig({ agentFolders: ensureFolderColors().map((f) => (f.dir === agent.dir ? { ...f, color: value } : f)) });
        pushAgents();
      },
    })) }]),
    { label: 'Modèle', submenu: radio('model', MODELS) },
    { label: 'Effort', submenu: radio('effort', EFFORTS) },
    { label: 'Mode', submenu: radio('mode', MODES) },
    ...(worktrees ? [{ label: 'Worktrees', submenu: worktrees.length
      ? worktrees.map((w) => ({ label: `${w.branch ?? path.basename(w.dir)} — ${short(w.dir)}`,
        submenu: [{ label: 'Ouvrir un agent ici', click: () => openHere(agent, w.dir) }] }))
      : [{ label: 'Aucun worktree sans agent', enabled: false }] }] : []),
    { type: 'separator' },
    { label: 'Interrompre', enabled: busy, click: () => interruptAgent(agent.id) },
    { label: 'Nouvelle session (effacer le contexte)', click: () => {
      agents.forget(agent.id);
      closeRuns(agent); // ses actions en cours partent avec la session
      updateAgent(agent.id, { sessionId: null });
      pushAgents(); // le panneau des conversations, s'il est ouvert, se vide
    } },
    { type: 'separator' },
    { label: 'Retirer cet agent', click: () => removeAgent(agent.id) },
  ] as MenuItemConstructorOptions[]).popup({ window: state.panel });
}

// « Nouvel agent… » : un nouvel agent, dans un dossier favori (déjà choisi, sans
// agent pour l'instant) ou dans un dossier à choisir, qui devient favori.
export function openAddAgentMenu() {
  if (!state.panel) return;
  const cfg = loadConfig();
  const available = agents.isAvailable(cfg.agentCommand);
  const inUse = new Set(agentList(cfg).map((a) => real(a.dir) ?? a.dir)); // dossiers résolus
  const free = ensureFolderColors().filter((f) => !inUse.has(real(f.dir) ?? f.dir));
  Menu.buildFromTemplate([
    { label: free.length ? 'Nouvel agent dans un dossier favori' : 'Aucun dossier favori disponible', enabled: false },
    ...free.map((f) => ({
      label: `${colorDot(f.color)} ${path.basename(f.dir)}  —  ${short(f.dir)}`, enabled: available, click: () => addAgent(f.dir),
    })),
    { type: 'separator' },
    { label: 'Choisir un autre dossier…', enabled: available,
      click: async () => {
        const res = await dialog.showOpenDialog({ title: 'Dossier de travail de l\'agent', properties: ['openDirectory'] });
        if (!res.canceled && res.filePaths[0] && await trustFolder(res.filePaths[0])) addAgent(res.filePaths[0]);
      } },
    ...(free.length ? [{
      label: 'Oublier un dossier favori',
      submenu: free.map((f) => ({
        label: `${colorDot(f.color)} ${short(f.dir)}`,
        click: () => saveConfig({ agentFolders: favoriteFolders(loadConfig()).filter((o) => o.dir !== f.dir) }),
      })),
    }] : []),
    ...(available ? [] : [{ type: 'separator' as const }, { label: CLAUDE_MISSING, enabled: false }]),
  ] as MenuItemConstructorOptions[]).popup({ window: state.panel });
}

// Trombone du champ : choisir des images ou fichiers. Le choix revient par
// conv:attached.
export async function openAttachMenu() {
  const conv = state.panel;
  if (!conv) return;
  const res = await dialog.showOpenDialog(conv, { title: 'Joindre au message', properties: ['openFile', 'multiSelections'] });
  if (!res.canceled && state.panel) state.panel.webContents.send('conv:attached', { files: res.filePaths });
}
