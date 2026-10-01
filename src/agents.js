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
   Un message peut porter des images (jointes dans la fenêtre de relecture).

   Chaque réponse se termine par un bloc <audio>…</audio> (consigne ajoutée au
   prompt système de NOS sessions seulement) : un résumé fait pour l'oreille.
   La bulle montre la réponse sans ce bloc ; le lecteur ne lit que lui. La
   consigne vient d'un fichier que l'utilisateur peut retoucher (cf. main.js) ;
   AUDIO_RULES est son contenu par défaut.

   Mode « manuel » : l'agent demande l'autorisation avant d'agir (canUseTool) ;
   la demande remonte à l'appli, qui répond par answer(). Plusieurs demandes
   peuvent arriver à la fois (outils lancés en parallèle) : elles attendent en
   FILE et se montrent l'une après l'autre. Une demande sans réponse bloque
   Claude Code indéfiniment : aucune ne doit se perdre.

   Journal (setJournal) : début et fin de chaque tour, chaque demande
   d'autorisation et sa réponse, les échecs — de quoi comprendre après coup un
   agent resté bloqué. Le mode et le modèle
   changés en cours de tour s'appliquent aussitôt (setMode, setModel).
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

// id → { status, abort, query, pending, last, unread, onChange }
//   pending : la file des demandes d'autorisation, la plus ancienne en tête
//   status : 'idle' | 'working' | 'asking' (attend une autorisation) | 'error'
//   last   : { text, audio, error } de la dernière réponse
//   query  : la requête du SDK pendant un tour (pour changer de mode, de modèle)
const runtime = new Map();
const rt = (id) => {
  if (!runtime.has(id)) runtime.set(id, { status: 'idle', abort: null, query: null, pending: [], last: null, unread: false, onChange: null });
  return runtime.get(id);
};

const state = (id) => {
  const r = rt(id);
  // `since` : début du tour en cours (ms), pour le temps écoulé.
  return { status: r.status, unread: r.unread, hasReply: !!r.last, since: r.since || null };
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

/* ---- Journal ------------------------------------------------------------- */

let nextKey = 1; // numéro des demandes d'autorisation (cf. answer)
const JOURNAL_MAX = 1024 * 1024; // au-delà, l'ancien passe en .old
let journalFile = null;
function setJournal(file) { journalFile = file; }
function journal(agent, event, detail = '') {
  if (!journalFile) return;
  const line = `${new Date().toISOString()}  ${agent.name || agent.id}  ${event}${detail ? `  ${detail}` : ''}\n`;
  try {
    if (fs.existsSync(journalFile) && fs.statSync(journalFile).size > JOURNAL_MAX) fs.renameSync(journalFile, `${journalFile}.old`);
    fs.appendFileSync(journalFile, line);
  } catch { /* journal impossible : on n'arrête pas l'agent pour ça */ }
}
// Ce sur quoi porte un outil, en une ligne courte, pour le journal.
const target = (input) => {
  const i = input || {};
  return String(i.command ?? i.file_path ?? i.notebook_path ?? i.path ?? i.url ?? i.pattern ?? '').split('\n')[0].slice(0, 160);
};

/* ---- Un tour de conversation --------------------------------------------- */

let sdk = null; // chargé au premier usage (module ES)

// Le prompt du SDK : toujours un message structuré (le mode « streaming » est
// le seul qui permette de changer de mode ou de modèle en cours de tour, cf.
// setMode), avec les images ([{ mediaType, data (base64) }]) avant le texte.
function prompt({ text, images = [] }) {
  const content = [
    ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
    ...(text ? [{ type: 'text', text }] : []),
  ];
  return (async function* one() {
    yield { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null };
  }());
}

// Envoie `message` ({ text, images }) à l'agent. `hooks` :
//   onChange()                  l'état a changé (robot à redessiner)
//   onSession(sessionId)        identifiant de session à retenir
//   onPermission({ tool, input })   une autorisation est demandée (cf. answer)
//   onProgress()                l'agent avance (message, outil) : de quoi suivre le tour
// `instructions` : la consigne ajoutée au prompt système (AUDIO_RULES par
// défaut ; '' : aucune).
// Résout quand le tour est fini ; rejette 'busy' ou 'notInstalled'.
async function send(agent, message, { command, instructions = AUDIO_RULES, onChange, onSession, onPermission, onProgress = () => {} }) {
  const r = rt(agent.id);
  if (r.status === 'working' || r.status === 'asking') throw new Error('busy');
  const launch = launcher(command);
  if (!launch) throw new Error('notInstalled');
  await loadSdk();

  r.status = 'working';
  r.name = agent.name;
  r.since = Date.now();
  r.abort = new AbortController();
  r.onChange = onChange;
  onChange();

  // Une demande d'autorisation : en file. Claude Code peut l'annuler lui-même
  // (`signal` : outil abandonné, tour interrompu) — elle quitte alors la file.
  const ask = (tool, input, { suggestions, signal } = {}) => new Promise((resolve) => {
    const p = { key: nextKey++, tool, input, rules: sessionRules(suggestions), resolve, at: Date.now() };
    r.pending.push(p);
    r.status = 'asking';
    journal(agent, 'autorisation demandée', `${tool} ${target(input)} (${r.pending.length} en attente)`);
    if (signal) {
      signal.addEventListener('abort', () => {
        const head = r.pending[0] === p;
        if (!settle(r, p, { behavior: 'deny', message: 'Annulé.' })) return;
        journal(agent, 'autorisation annulée par Claude Code', `${tool} ${target(input)}`);
        onChange();
        if (head && r.pending[0]) onPermission(r.pending[0]); // la suivante prend sa place
      }, { once: true });
    }
    onChange();
    // La bulle montre la tête de file : on ne la prévient que pour la première.
    if (r.pending[0] === p) onPermission({ tool, input });
  });

  let reply = null;
  let failure = null;
  let permissionFailures = 0;
  try {
    const q = sdk.query({
      prompt: prompt(message),
      options: {
        cwd: agent.dir,
        abortController: r.abort,
        permissionMode: MODES.some(([v]) => v === agent.mode) ? agent.mode : 'default',
        ...(agent.model ? { model: agent.model } : {}),
        ...(agent.effort ? { effort: agent.effort } : {}),
        ...(agent.sessionId ? { resume: agent.sessionId } : {}),
        // Comme un Claude Code lancé dans ce dossier : ses réglages, CLAUDE.md, skills.
        settingSources: ['user', 'project', 'local'],
        systemPrompt: { type: 'preset', preset: 'claude_code', ...(instructions ? { append: instructions } : {}) },
        pathToClaudeCodeExecutable: launch.executable,
        ...(launch.spawn ? { spawnClaudeCodeProcess: launch.spawn } : {}),
        canUseTool: ask,
      },
    });
    r.query = q;
    journal(agent, 'tour commencé', `mode ${agent.mode || 'default'}${agent.sessionId ? `, reprise ${agent.sessionId.slice(0, 8)}` : ', nouvelle session'}`);
    for await (const m of q) {
      if (m.type === 'assistant' || m.type === 'user') onProgress();
      // Un outil refusé faute d'avoir pu demander l'autorisation (Claude Code ne
      // reçoit plus les réponses) : à signaler, c'est le symptôme d'un blocage.
      if (m.type === 'user' && Array.isArray(m.message && m.message.content)) {
        for (const b of m.message.content) {
          const text = b && b.type === 'tool_result' ? JSON.stringify(b.content || '') : '';
          if (text.includes('Tool permission request failed') && !r.interrupted && !r.abort.signal.aborted) {
            permissionFailures++;
            journal(agent, 'ÉCHEC d\'une demande d\'autorisation', text.slice(0, 200));
          }
        }
      }
      if (m.type === 'system' && m.subtype === 'init' && m.session_id) onSession(m.session_id);
      if (m.type === 'result') {
        if (m.subtype === 'success' && !m.is_error) reply = m.result;
        else failure = m.subtype === 'success' ? String(m.result || 'erreur') : m.subtype;
      }
    }
  } catch (err) {
    failure = r.abort.signal.aborted ? 'interrupted' : (err && err.message) || 'erreur';
  }
  // Interrompu à notre demande : Claude Code finit son tour par une erreur ou
  // une réponse partielle, c'est une interruption.
  if (r.interrupted) { failure = 'interrupted'; reply = null; }
  // Fin du tour : une demande restée sans réponse n'a plus d'objet.
  for (const p of [...r.pending]) settle(r, p, { behavior: 'deny', message: 'Tour terminé.' });
  journal(agent, 'tour fini', `${reply !== null ? 'réponse' : failure} en ${Math.round((Date.now() - r.since) / 1000)} s`
    + `${permissionFailures ? `, ${permissionFailures} demande(s) d'autorisation en échec` : ''}`);
  r.abort = null;
  r.query = null;
  r.since = null;
  r.interrupted = false;
  if (reply !== null) {
    r.last = splitReply(reply);
    // Dit dans la réponse elle-même qu'une action n'a pas pu être autorisée.
    if (permissionFailures) {
      r.last.text += `\n\n⚠ ${permissionFailures} demande(s) d'autorisation n'ont pas pu aboutir : l'agent n'a pas pu faire ces actions (détails dans le journal des agents).`;
    }
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

// Retire `p` de la file et répond à Claude Code. false si déjà réglée.
function settle(r, p, response) {
  const i = r.pending.indexOf(p);
  if (i < 0) return false;
  r.pending.splice(i, 1);
  if (r.status === 'asking' && !r.pending.length) r.status = 'working';
  p.resolve(response);
  return true;
}

// Réponse à la demande en tête de file : 'allow', 'always' (ne plus demander,
// dans cette session, ce que décrivent les règles) ou 'deny'. La suivante, s'il
// y en a, devient la demande en cours (cf. pendingPermission). `key` : le
// numéro de la demande que l'utilisateur a sous les yeux ; si ce n'est plus la
// tête de file (annulée entre-temps), rien n'est répondu.
function answer(id, decision, key) {
  const r = rt(id);
  const p = r.pending[0];
  if (!p || (key !== undefined && p.key !== key)) return false;
  settle(r, p, decision === 'deny' ? { behavior: 'deny', message: 'Refusé par l\'utilisateur.' }
    : { behavior: 'allow', updatedInput: p.input, ...(decision === 'always' && p.rules.length ? { updatedPermissions: p.rules } : {}) });
  journal({ id, name: r.name }, 'autorisation répondue', `${decision} ${p.tool} ${target(p.input)} après ${Math.round((Date.now() - p.at) / 1000)} s`
    + `${r.pending.length ? ` (${r.pending.length} encore en attente)` : ''}`);
  if (r.onChange) r.onChange();
  return true;
}

// La demande en tête de file : { tool, input, always, waiting } ; `always`
// liste ce que « Toujours autoriser » accorderait (« Bash(git status:*) »),
// vide si rien à proposer ; `waiting` : combien d'autres attendent derrière.
const pendingPermission = (id) => {
  const r = rt(id);
  const p = r.pending[0];
  if (!p) return null;
  const always = p.rules.flatMap((u) => u.rules.map((x) => (x.ruleContent ? `${x.toolName}(${x.ruleContent})` : x.toolName)));
  return { key: p.key, tool: p.tool, input: p.input, always, waiting: r.pending.length - 1 };
};

// Mode changé (menu du robot) : le tour en cours le suit aussitôt. Une demande
// d'autorisation en attente que le nouveau mode n'aurait pas posée (modifier un
// fichier, passé en « accepter les modifications ») est accordée.
const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
function setMode(id, mode) {
  const r = runtime.get(id);
  if (!r || !r.query || !MODES.some(([v]) => v === mode)) return;
  r.query.setPermissionMode(mode).catch(() => { /* tour fini entre-temps */ });
  if (mode !== 'acceptEdits') return;
  for (const p of r.pending.filter((x) => EDIT_TOOLS.has(x.tool))) settle(r, p, { behavior: 'allow', updatedInput: p.input });
  if (r.onChange) r.onChange();
}

// Modèle changé : pris en compte dès le prochain appel du tour en cours.
function setModel(id, model) {
  const r = runtime.get(id);
  if (r && r.query) r.query.setModel(model || undefined).catch(() => {});
}

// Interrompre : c'est Claude Code qui arrête son tour (query.interrupt), et
// avec lui les commandes qu'il a lancées ; il se ferme ensuite de lui-même.
// Tuer le processus ne suffit pas : lancé par une commande enveloppe
// (« distrobox enter dev -- claude »), seule l'enveloppe meurt — Claude Code et
// sa commande continuent dans le conteneur, sans plus personne pour répondre à
// ses demandes d'autorisation (« Stream closed »). On ne tue qu'en dernier
// recours, s'il n'a pas obéi au bout de INTERRUPT_GRACE_MS.
const INTERRUPT_GRACE_MS = 5000;
function interrupt(id) {
  const r = runtime.get(id);
  if (!r) return;
  for (const p of [...r.pending]) settle(r, p, { behavior: 'deny', message: 'Interrompu par l\'utilisateur.' });
  const { abort, query } = r;
  if (!abort || r.interrupted) return;
  r.interrupted = true;
  journal({ id, name: r.name }, 'interruption demandée');
  if (query) query.interrupt().catch(() => {});
  const timer = setTimeout(() => {
    if (r.abort !== abort) return; // tour fini entre-temps : Claude Code a obéi
    journal({ id, name: r.name }, 'interruption FORCÉE', `Claude Code n'a pas arrêté son tour en ${INTERRUPT_GRACE_MS / 1000} s : processus tué (une commande enveloppe peut lui survivre)`);
    abort.abort();
  }, query ? INTERRUPT_GRACE_MS : 0);
  if (timer.unref) timer.unref();
}

// À la fermeture de l'appli : interrompt tous les agents, et résout quand leurs
// tours sont finis (ou au bout du délai de grâce, où ils ont été tués).
function stop() {
  const busy = [...runtime.keys()].filter((id) => runtime.get(id).abort);
  busy.forEach(interrupt);
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      if (busy.every((id) => !runtime.has(id) || !runtime.get(id).abort) || Date.now() - started > INTERRUPT_GRACE_MS + 1000) resolve();
      else setTimeout(check, 100);
    };
    check();
  });
}

/* ---- Conversations : fil, intitulé, historique ----------------------------- */

const loadSdk = async () => { if (!sdk) sdk = await import('@anthropic-ai/claude-agent-sdk'); return sdk; };

// Les chemins sous lesquels Claude Code a pu ranger les sessions du dossier.
// Il prend le chemin réel du dossier où il est lancé ; sous Fedora Atomic,
// /home est un lien vers /var/home sur l'hôte, mais un dossier monté dans une
// distrobox : selon l'endroit où tournent l'appli et Claude Code, le même
// dossier s'écrit de deux façons.
function dirs(dir) {
  const out = [dir];
  try { out.push(fs.realpathSync(dir)); } catch { /* dossier disparu */ }
  for (const d of [...out]) {
    if (d.startsWith('/home/')) out.push(`/var${d}`);
    if (d.startsWith('/var/home/')) out.push(d.slice(4));
  }
  return [...new Set(out)];
}

// Le premier résultat non vide de `fn(dossier)`, sous les chemins possibles.
async function firstFound(agent, fn, empty) {
  for (const dir of dirs(agent.dir)) {
    try {
      const res = await fn(dir);
      if (res && (!Array.isArray(res) || res.length)) return res;
    } catch { /* pas sous ce chemin */ }
  }
  return empty;
}
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Intitulé d'une session, comme dans Claude Code : titre donné ou généré, à
// défaut le premier message. '' si introuvable.
async function sessionTitle(agent, sessionId) {
  await loadSdk();
  return oneLine((await firstFound(agent, (dir) => sdk.getSessionInfo(sessionId, { dir }), {})).summary);
}

// Les sessions Claude Code du dossier de l'agent, de la plus récente à la plus
// ancienne — celles de l'appli comme celles lancées dans un terminal :
// [{ sessionId, title, lastModified }]. Pas celles des worktrees : on ne
// pourrait pas les reprendre d'ici (une session se reprend dans son dossier).
async function sessions(agent) {
  await loadSdk();
  const seen = new Map();
  for (const dir of dirs(agent.dir)) {
    let list = [];
    try { list = await sdk.listSessions({ dir, includeWorktrees: false, limit: 200 }); } catch { /* pas sous ce chemin */ }
    for (const s of list) if (!seen.has(s.sessionId)) seen.set(s.sessionId, { sessionId: s.sessionId, title: oneLine(s.summary), lastModified: s.lastModified });
  }
  return [...seen.values()].sort((a, b) => b.lastModified - a.lastModified);
}

// Heure d'un message de la transcription (champ non documenté du SDK : null s'il manque).
const timeOf = (m) => { const t = Date.parse(m.timestamp); return Number.isFinite(t) ? t : null; };

// Toute une session de l'agent (la sienne en cours par défaut), relue dans sa transcription :
//   [{ role: 'user', text, images: [{ media_type, data }], time }
//    | { role: 'assistant', text, audio, tools: [{ tool, input }], time }]
// `time` (ms) : l'envoi du message ; pour l'agent, son dernier message du tour.
// Les messages successifs d'un même tour de l'agent (texte, outil, texte…)
// sont regroupés ; les échanges internes (résultats d'outils, sous-agents)
// sont écartés. [] sans session.
async function thread(agent, sessionId = agent.sessionId) {
  if (!sessionId) return [];
  await loadSdk();
  const messages = await firstFound(agent, (dir) => sdk.getSessionMessages(sessionId, { dir }), []);
  const out = [];
  for (const m of messages) {
    if (m.parent_tool_use_id) continue;
    const content = m.message && m.message.content;
    const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : Array.isArray(content) ? content : [];
    if (m.type === 'user') {
      const images = blocks.filter((b) => b.type === 'image' && b.source && b.source.type === 'base64').map((b) => b.source);
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      if (text || images.length) out.push({ role: 'user', text, images, time: timeOf(m) });
    } else if (m.type === 'assistant') {
      let last = out[out.length - 1];
      if (!last || last.role !== 'assistant') { last = { role: 'assistant', text: '', tools: [] }; out.push(last); }
      last.time = timeOf(m) || last.time;
      for (const b of blocks) {
        if (b.type === 'text' && b.text.trim()) last.text += `${last.text ? '\n\n' : ''}${b.text.trim()}`;
        if (b.type === 'tool_use') last.tools.push({ tool: b.name, input: b.input });
      }
    }
  }
  return out.map((e) => (e.role === 'assistant' ? { ...e, ...splitReply(e.text) } : e));
}

module.exports = {
  MODELS, EFFORTS, MODES, AUDIO_RULES, isAvailable, setMode, setModel, setJournal,
  state, lastReply, markRead, forget, send, answer, pendingPermission, interrupt, stop, thread, sessionTitle, sessions,
};
