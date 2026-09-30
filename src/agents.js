/* =========================================================================
   Whisper — agents Claude Code

   Un agent = une conversation Claude Code attachée à un dossier de projet (un
   seul par dossier). On lui parle par la dictée ; sa réponse se lit dans la
   bulle et s'écoute par le lecteur (cf. tts.js).

   Pilotés par le SDK officiel (@anthropic-ai/claude-agent-sdk), qui lance le
   Claude Code DE L'UTILISATEUR (déjà installé et connecté : pas de clé API,
   rien d'embarqué). La commande de lancement est réglable (`agentCommand`) :
   `claude` par défaut ; par exemple `distrobox enter dev -- claude` quand les
   outils du projet vivent dans un conteneur.

   Un tour = un appel query() : le premier crée la session, les suivants la
   reprennent (`resume`). « Nouvelle session » oublie simplement l'identifiant.

   Chaque réponse se termine par un bloc <audio>…</audio> (AUDIO_RULES, ajouté
   au prompt système de NOS sessions seulement) : un résumé fait pour l'oreille.
   La bulle montre la réponse sans ce bloc ; le lecteur ne lit que lui.

   Mode « manuel » : l'agent demande l'autorisation avant d'agir (canUseTool) ;
   la demande remonte à l'appli, qui répond par answer().
   ========================================================================= */

const fs = require('fs');
const { spawn } = require('child_process');
const { which } = require('./paths');

const AUDIO_RULES = [
  'Tu réponds à travers Whisper, une application vocale : l\'utilisateur DICTE ses messages (tolère les fautes de',
  'transcription, surtout sur les termes techniques) et peut ÉCOUTER ta réponse au lieu de la lire.',
  'Réponds normalement, puis termine TOUJOURS par un bloc <audio>…</audio>. Ce bloc est lu par une synthèse vocale :',
  '- un résumé oral court de ta réponse, en 2 à 4 phrases, dans la langue de l\'utilisateur ;',
  '- ce qui a été fait ou trouvé, puis ta question s\'il y en a une ;',
  '- aucun Markdown, code, chemin de fichier, symbole ni liste : des phrases simples qui se disent à voix haute.',
  'N\'écris rien après ce bloc.',
].join('\n');

// [valeur, libellé] pour les menus. '' : le réglage par défaut de Claude Code.
const MODELS = [['', 'Par défaut'], ['fable', 'Fable'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']];
const EFFORTS = [['', 'Par défaut'], ['low', 'Faible'], ['medium', 'Moyen'], ['high', 'Élevé'], ['xhigh', 'Très élevé'], ['max', 'Maximal']];
const MODES = [
  ['default', 'Manuel (demander avant d\'agir)'],
  ['acceptEdits', 'Accepter les modifications de fichiers'],
  ['auto', 'Auto'],
  ['plan', 'Plan (lecture seule)'],
];

/* ---- Lancement de Claude Code -------------------------------------------- */

// « distrobox enter dev -- claude » → ['distrobox', 'enter', 'dev', '--', 'claude'] ;
// guillemets simples ou doubles pour un argument avec espaces.
function splitCommand(command) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(String(command || '')))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// { executable, spawn } pour le SDK, ou null si Claude Code est introuvable.
// Commande personnalisée : le SDK prépare ses arguments, on les passe derrière
// la commande de l'utilisateur.
function launcher(command) {
  const argv = splitCommand(command);
  if (!argv.length) {
    const claude = which('claude');
    return claude ? { executable: claude } : null;
  }
  const program = which(argv[0]) || (fs.existsSync(argv[0]) ? argv[0] : null);
  if (!program) return null;
  return {
    executable: program,
    spawn: ({ args, cwd, env, signal }) => spawn(program, [...argv.slice(1), ...args],
      { cwd, env, signal, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }),
  };
}

const isAvailable = (command) => !!launcher(command);

/* ---- État des agents ------------------------------------------------------ */

// id → { status, abort, pending, last, unread, onChange }
//   status : 'idle' | 'working' | 'asking' (attend une autorisation) | 'error'
//   last   : { text, audio, error } de la dernière réponse
const runtime = new Map();
const rt = (id) => {
  if (!runtime.has(id)) runtime.set(id, { status: 'idle', abort: null, pending: null, last: null, unread: false, onChange: null });
  return runtime.get(id);
};

const state = (id) => {
  const r = rt(id);
  return { status: r.status, unread: r.unread, hasReply: !!r.last };
};
const lastReply = (id) => rt(id).last;
function markRead(id) { rt(id).unread = false; }
function forget(id) { interrupt(id); runtime.delete(id); }

// Réponse → { text (sans le bloc audio), audio (pour le lecteur) }. Sans bloc :
// le texte dépouillé de son formatage.
function splitReply(reply) {
  const raw = String(reply || '').trim();
  const m = raw.match(/<audio>([\s\S]*?)<\/audio>/i);
  const text = raw.replace(/<audio>[\s\S]*?<\/audio>/gi, '').trim();
  const plain = (s) => s.replace(/```[\s\S]*?```/g, ' ').replace(/[`*_#>|]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ').trim();
  return { text: text || (m ? m[1].trim() : ''), audio: m ? plain(m[1]) : plain(text) };
}

/* ---- Un tour de conversation --------------------------------------------- */

let sdk = null; // chargé au premier usage (module ES)

// Envoie `message` à l'agent. `hooks` :
//   onChange()                  l'état a changé (robot à redessiner)
//   onSession(sessionId)        identifiant de session à retenir
//   onPermission({ tool, input })   une autorisation est demandée (cf. answer)
// Résout quand le tour est fini ; rejette 'busy' ou 'notInstalled'.
async function send(agent, message, { command, onChange, onSession, onPermission }) {
  const r = rt(agent.id);
  if (r.status === 'working' || r.status === 'asking') throw new Error('busy');
  const launch = launcher(command);
  if (!launch) throw new Error('notInstalled');
  if (!sdk) sdk = await import('@anthropic-ai/claude-agent-sdk');

  r.status = 'working';
  r.abort = new AbortController();
  r.onChange = onChange;
  onChange();

  const ask = (tool, input, { suggestions } = {}) => new Promise((resolve) => {
    r.status = 'asking';
    r.pending = { tool, input, rules: sessionRules(suggestions), resolve };
    onChange();
    onPermission({ tool, input });
  });

  let reply = null;
  let failure = null;
  try {
    const q = sdk.query({
      prompt: message,
      options: {
        cwd: agent.dir,
        abortController: r.abort,
        permissionMode: MODES.some(([v]) => v === agent.mode) ? agent.mode : 'default',
        ...(agent.model ? { model: agent.model } : {}),
        ...(agent.effort ? { effort: agent.effort } : {}),
        ...(agent.sessionId ? { resume: agent.sessionId } : {}),
        // Comme un Claude Code lancé dans ce dossier : ses réglages, CLAUDE.md, skills.
        settingSources: ['user', 'project', 'local'],
        systemPrompt: { type: 'preset', preset: 'claude_code', append: AUDIO_RULES },
        pathToClaudeCodeExecutable: launch.executable,
        ...(launch.spawn ? { spawnClaudeCodeProcess: launch.spawn } : {}),
        canUseTool: ask,
      },
    });
    for await (const m of q) {
      if (m.type === 'system' && m.subtype === 'init' && m.session_id) onSession(m.session_id);
      if (m.type === 'result') {
        if (m.subtype === 'success' && !m.is_error) reply = m.result;
        else failure = m.subtype === 'success' ? String(m.result || 'erreur') : m.subtype;
      }
    }
  } catch (err) {
    failure = r.abort.signal.aborted ? 'interrupted' : (err && err.message) || 'erreur';
  }
  r.pending = null;
  r.abort = null;
  if (reply !== null) {
    r.last = splitReply(reply);
    r.status = 'idle';
  } else {
    const messages = {
      interrupted: 'Interrompu.',
      error_max_turns: 'L\'agent s\'est arrêté : trop d\'étapes.',
      error_during_execution: 'L\'agent a rencontré une erreur pendant l\'exécution.',
    };
    const text = messages[failure] || `L'agent n'a pas pu répondre : ${failure || 'erreur inconnue'}.`;
    r.last = { text, audio: text, error: true };
    r.status = failure === 'interrupted' ? 'idle' : 'error';
  }
  r.unread = true;
  onChange();
}

// Ce que « Toujours autoriser » accordera : parmi les suggestions de Claude
// Code, SEULEMENT des règles d'autorisation, et pour la session en cours. Une
// suggestion peut viser les réglages du projet ou de l'utilisateur (écrite sur
// le disque, elle survivrait à la session), changer de mode ou ouvrir d'autres
// dossiers : rien de cela ne doit passer par un bouton de la bulle.
function sessionRules(suggestions) {
  return (Array.isArray(suggestions) ? suggestions : [])
    .filter((s) => s && s.type === 'addRules' && s.behavior === 'allow' && Array.isArray(s.rules) && s.rules.length)
    .map((s) => ({ type: 'addRules', behavior: 'allow', rules: s.rules, destination: 'session' }));
}

// Réponse à la demande d'autorisation en cours : 'allow', 'always' (ne plus
// demander, dans cette session, ce que décrivent les règles) ou 'deny'.
function answer(id, decision) {
  const r = rt(id);
  const p = r.pending;
  if (!p) return false;
  r.pending = null;
  r.status = 'working';
  if (r.onChange) r.onChange();
  if (decision === 'deny') p.resolve({ behavior: 'deny', message: 'Refusé par l\'utilisateur.' });
  else p.resolve({ behavior: 'allow', updatedInput: p.input, ...(decision === 'always' && p.rules.length ? { updatedPermissions: p.rules } : {}) });
  return true;
}

// { tool, input, always } : `always` liste ce que « Toujours autoriser »
// accorderait (« Bash(git status:*) »), vide si rien à proposer.
const pendingPermission = (id) => {
  const p = rt(id).pending;
  if (!p) return null;
  const always = p.rules.flatMap((u) => u.rules.map((x) => (x.ruleContent ? `${x.toolName}(${x.ruleContent})` : x.toolName)));
  return { tool: p.tool, input: p.input, always };
};

function interrupt(id) {
  const r = runtime.get(id);
  if (!r) return;
  if (r.pending) answer(id, 'deny');
  if (r.abort) r.abort.abort();
}

function stop() { for (const id of runtime.keys()) interrupt(id); }

/* ---- Fil de la conversation ---------------------------------------------- */

// Toute la session de l'agent, relue dans sa transcription :
//   [{ role: 'user', text } | { role: 'assistant', text, audio, tools: [{ tool, input }] }]
// Les messages successifs d'un même tour de l'agent (texte, outil, texte…)
// sont regroupés ; les échanges internes (résultats d'outils, sous-agents)
// sont écartés. [] sans session.
async function thread(agent) {
  if (!agent.sessionId) return [];
  if (!sdk) sdk = await import('@anthropic-ai/claude-agent-sdk');
  let messages = [];
  try { messages = await sdk.getSessionMessages(agent.sessionId, { dir: agent.dir }); } catch { /* transcription absente */ }
  const out = [];
  for (const m of messages) {
    if (m.parent_tool_use_id) continue;
    const content = m.message && m.message.content;
    const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : Array.isArray(content) ? content : [];
    if (m.type === 'user') {
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      if (text) out.push({ role: 'user', text });
    } else if (m.type === 'assistant') {
      let last = out[out.length - 1];
      if (!last || last.role !== 'assistant') { last = { role: 'assistant', text: '', tools: [] }; out.push(last); }
      for (const b of blocks) {
        if (b.type === 'text' && b.text.trim()) last.text += `${last.text ? '\n\n' : ''}${b.text.trim()}`;
        if (b.type === 'tool_use') last.tools.push({ tool: b.name, input: b.input });
      }
    }
  }
  return out.map((e) => (e.role === 'assistant' ? { ...e, ...splitReply(e.text) } : e));
}

module.exports = {
  MODELS, EFFORTS, MODES, isAvailable,
  state, lastReply, markRead, forget, send, answer, pendingPermission, interrupt, stop, thread,
};
