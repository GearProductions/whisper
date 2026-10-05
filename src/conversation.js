/* =========================================================================
   Whisper — la conversation d'un agent

   Un panneau attaché à l'icône (il la suit ; × le ferme), une conversation à
   la fois — celle du robot sélectionné, les robots servant d'onglets ; aucun
   robot sélectionné : le contexte « Dictée », le dernier texte dicté et
   Copier, rien d'autre. Deux
   tailles : réduit (⤡), le dernier échange, à la hauteur de son contenu ;
   agrandi (⤢), tout le fil et l'historique. Dans les deux, le champ de saisie,
   où « / » propose les commandes de Claude Code (/compact, skills…), et la
   jauge du contexte (un clic : son détail). Sa session en cours, ou une
   ancienne session de son dossier, ouverte depuis l'historique (lecture seule,
   à reprendre au besoin). Chaque conversation porte son intitulé, celui que
   Claude Code lui donne. Le principal envoie la conversation (`conv:thread`) à
   l'ouverture, à chaque changement, et au fil d'un tour (l'agent qui travaille
   s'anime au bas du fil) ; ▶ Écouter lit le résumé audio d'une réponse par le
   lecteur de l'icône. Chaque message dit son heure ; les liens s'ouvrent dans
   le navigateur ; les pièces jointes d'un message (images, fichiers, texte
   sélectionné) s'y voient.
   ========================================================================= */

const thread = document.getElementById('thread');
const template = document.getElementById('message-template');
const lightbox = document.getElementById('lightbox');
const composer = document.getElementById('composer');
const message = document.getElementById('message');
const sendButton = document.getElementById('send');
const composerStatus = document.getElementById('composer-status');
const piecesBox = document.getElementById('pieces');
const archived = document.getElementById('archived');
const resume = document.getElementById('resume');
const history = document.getElementById('history');
const historyButton = document.getElementById('history-button');
const modeButton = document.getElementById('mode');
const header = document.querySelector('header');
const notice = document.getElementById('notice');
const noticeText = document.getElementById('notice-text');
const contextButton = document.getElementById('context-button');
const contextPanel = document.getElementById('context-panel');
const slashBox = document.getElementById('slash');
let mode = 'compact';
let current = null; // la conversation affichée (données du dernier rendu)
let shownCount = 0; // messages de la conversation au dernier rendu

const BUSY = ['working', 'asking'];
let shownKey = null; // conversation affichée au dernier rendu

const titleOf = (t) => t.title || (t.live ? 'Nouvelle conversation' : 'Conversation sans titre');

// Le texte tel quel, liens cliquables ; seuls les blocs ``` deviennent des blocs de code.
function renderBody(el, text) {
  el.replaceChildren();
  String(text || '').split('```').forEach((part, i) => {
    if (i % 2 === 0) { if (part) el.append(linkify(part.replace(/^\n+|\n+$/g, i ? '\n' : ''), window.conv.openLink)); return; }
    const pre = document.createElement('pre');
    pre.textContent = part.replace(/^[\w+-]*\n/, '').replace(/\n$/, ''); // sans le nom du langage
    el.append(pre);
  });
}

// « 14:32 », ou « 30 sept., 21:18 » un autre jour.
function clock(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const today = d.toDateString() === new Date().toDateString();
  return d.toLocaleString('fr-FR', today ? { timeStyle: 'short' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// « 12 s », « 1 min 05 s ».
function elapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

// Pictogramme d'un fichier joint, d'après son extension.
const KINDS = [
  [/\.(png|jpe?g|gif|webp|svg|bmp|tiff?|heic|avif)$/i, '🖼'], [/\.(mp4|mkv|mov|webm|avi|m4v)$/i, '🎞'],
  [/\.(mp3|wav|flac|ogg|m4a|opus)$/i, '🎵'], [/\.(pdf|docx?|odt|txt|md|rtf)$/i, '📄'],
  [/\.(zip|tar|gz|xz|7z|rar)$/i, '🗜'], [/(^|\/)[^./]+$/, '📁'],
];
const kindOf = (file) => (KINDS.find(([re]) => re.test(file)) || [null, '📎'])[1];

// Images (aperçus, clic : en grand) et fichiers (clic : dans le gestionnaire de fichiers).
function renderAttachments(el, m) {
  el.replaceChildren(
    ...(m.images || []).map((src) => {
      const img = Object.assign(document.createElement('img'), { src, alt: 'Image jointe', title: 'Agrandir' });
      img.addEventListener('click', () => { lightbox.querySelector('img').src = src; lightbox.hidden = false; });
      return img;
    }),
    ...(m.files || []).map((file) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'file', title: `${file}\n(clic : montrer dans le gestionnaire de fichiers)` });
      b.append(Object.assign(document.createElement('span'), { textContent: kindOf(file) }),
        Object.assign(document.createElement('span'), { className: 'file-name', textContent: file.split('/').filter(Boolean).pop() || file }));
      b.addEventListener('click', () => window.conv.showFile(file));
      return b;
    }),
  );
}

// L'agent au travail (ou qui attend une autorisation), au bas du fil.
const working = document.createElement('div');
working.className = 'working';
working.innerHTML = '<span class="dots"><i></i><i></i><i></i></span><span class="what"></span><span class="elapsed"></span>';
let workingSince = null;
setInterval(() => {
  if (workingSince) working.querySelector('.elapsed').textContent = elapsed(Date.now() - workingSince);
}, 1000);

// Demande d'autorisation dans le fil : ce qui va
// s'exécuter en entier, trois boutons. Un clic parti juste après l'arrivée
// d'une NOUVELLE demande est ignoré : il répondrait à ce qu'on n'a pas lu.
const CLICK_GUARD_MS = 600;
const seen = { key: null, at: 0 };
function renderPermission(p) {
  if (p.key !== seen.key) { seen.key = p.key; seen.at = Date.now(); }
  const el = document.getElementById('permission-template').content.firstElementChild.cloneNode(true);
  el.querySelector('.permission-title').textContent = p.title;
  el.querySelector('.permission-text').textContent = p.text;
  const always = el.querySelector('.permission-always');
  always.hidden = !p.always.length;
  always.textContent = p.always.length ? `« Toujours autoriser », jusqu'à la fin de cette session : ${p.always.join(', ')}` : '';
  for (const b of el.querySelectorAll('button')) {
    b.hidden = b.dataset.act === 'always' && !p.always.length;
    b.addEventListener('click', () => {
      if (Date.now() - seen.at < CLICK_GUARD_MS) return;
      el.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      window.conv.answer(b.dataset.act, p.key);
    });
  }
  return el;
}

// Ce que l'agent a fait pendant le tour. Au-delà de TOOLS_SHOWN actions, les
// dernières seulement ; les autres, à déplier.
const TOOLS_SHOWN = 6;
const openTools = new Set();
function renderTools(el, tools, index) {
  const line = (t) => Object.assign(document.createElement('div'), { textContent: t });
  if (tools.length <= TOOLS_SHOWN) { el.replaceChildren(...tools.map(line)); return; }
  const more = document.createElement('details');
  more.append(Object.assign(document.createElement('summary'), { textContent: `${tools.length - TOOLS_SHOWN} actions de plus` }),
    ...tools.slice(0, -TOOLS_SHOWN).map(line));
  more.open = openTools.has(index);
  more.addEventListener('toggle', () => { if (more.open) openTools.add(index); else openTools.delete(index); });
  el.replaceChildren(more, ...tools.slice(-TOOLS_SHOWN).map(line));
}

const openDetails = new Set(); // contextes dépliés, par rang : gardés d'un rendu à l'autre

// Réduit : la hauteur de son contenu, que le principal donne au panneau. Le fil
// remplit la fenêtre (son scrollHeight ne descend pas sous sa hauteur) : on
// mesure donc ses éléments.
function reportHeight() {
  if (mode !== 'compact') return;
  setTimeout(() => {
    const fixed = [header, notice, archived, composer].reduce((h, el) => h + (el.hidden ? 0 : el.offsetHeight), 0);
    const panel = contextPanel.hidden ? 0 : Math.min(contextPanel.scrollHeight, 360); // le détail du contexte, s'il est ouvert
    const top = thread.getBoundingClientRect().top - thread.scrollTop;
    const bottom = Math.max(top, ...[...thread.children].map((c) => c.getBoundingClientRect().bottom + parseFloat(getComputedStyle(c).marginBottom)));
    window.conv.height(fixed + Math.max(bottom - top + 16, panel) + 2); // marge basse du fil, bordure
  }, 0);
}

// `data` : { dictation, mode, key, live, name, color, dir, title, status, since,
//            permission: { key, title, text, always } | null,
//            messages: [{ role, text, context, files, images, time, tools, audio }] }.
window.conv.onThread((data) => {
  current = data;
  document.documentElement.style.setProperty('--accent', data.color);
  document.title = `${titleOf(data)} — ${data.name}`;
  document.getElementById('title').textContent = titleOf(data);
  document.getElementById('sub').textContent = data.dictation
    ? 'Aucun agent sélectionné : le texte va au curseur' : `${data.name} · ${data.dir}`;
  document.body.dataset.view = data.dictation ? 'dictation' : 'agent';
  archived.hidden = data.live || data.dictation;
  resume.disabled = BUSY.includes(data.status);
  resume.title = resume.disabled ? `${data.name} travaille : attendez qu'il ait fini.`
    : `${data.name} reprend cette conversation ; celle en cours reste dans l'historique.`;
  renderGauge(data.context);
  mode = data.mode;
  const compact = mode === 'compact';
  document.body.dataset.mode = mode;
  historyButton.hidden = compact; // l'historique : en agrandi seulement
  if (compact) history.hidden = true;
  modeButton.textContent = compact ? '⤢' : '⤡';
  modeButton.title = compact ? 'Agrandir : toute la conversation et l\'historique' : 'Réduire : le dernier échange';

  const switched = data.key !== shownKey;
  if (switched) swapDraft(shownKey, data.key);
  shownKey = data.key;
  renderComposer();
  if (switched) { history.hidden = true; contextPanel.hidden = true; openDetails.clear(); openTools.clear(); }
  const atEnd = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 40;
  const grew = data.messages.length !== shownCount;
  shownCount = data.messages.length;
  // Réduit : le dernier échange — votre dernier message et ce qui l'a suivi.
  const lastUser = data.messages.map((m) => m.role).lastIndexOf('user');
  const from = compact ? Math.max(0, lastUser >= 0 ? lastUser : data.messages.length - 1) : 0;
  thread.replaceChildren(...data.messages.map((m, index) => ({ m, index })).filter(({ index }) => index >= from).map(({ m, index }) => {
    const el = template.content.firstElementChild.cloneNode(true);
    el.classList.add(m.role);
    const who = el.querySelector('.who');
    who.textContent = data.dictation ? 'Texte dicté' : m.role === 'user' ? 'Vous' : m.role === 'system'
      ? (m.kind === 'compact' ? 'Contexte compacté' : 'Sortie de la commande') : data.name;
    if (m.time) {
      who.append(Object.assign(document.createElement('time'), {
        textContent: clock(m.time), title: new Date(m.time).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' }),
      }));
    }
    renderBody(el.querySelector('.body'), m.text);
    el.querySelector('.body').hidden = !m.text;
    // Le résumé laissé par une compaction : long, à déplier.
    if (m.kind === 'compact') {
      const more = document.createElement('details');
      more.append(Object.assign(document.createElement('summary'), { textContent: 'Résumé de la conversation précédente' }));
      more.append(el.querySelector('.body'));
      el.querySelector('.who').after(more);
    }
    const context = el.querySelector('.context');
    context.hidden = !m.context;
    if (m.context) {
      context.querySelector('summary').textContent = `Texte sélectionné joint (${m.context.length.toLocaleString('fr-FR')} caractères)`;
      context.querySelector('pre').textContent = m.context;
      context.open = openDetails.has(index);
      context.addEventListener('toggle', () => { if (context.open) openDetails.add(index); else openDetails.delete(index); });
    }
    renderAttachments(el.querySelector('.attachments'), m);
    renderTools(el.querySelector('.tools'), m.tools || [], index);
    const listen = el.querySelector('.listen');
    listen.hidden = m.role !== 'assistant' || !m.audio;
    listen.addEventListener('click', () => window.conv.speak(index));
    const copy = el.querySelector('.copy');
    copy.addEventListener('click', async () => { if (await window.conv.copy()) copy.textContent = 'Copié ✓'; });
    return el;
  }));
  if (data.dictation && !data.messages.length) {
    thread.append(Object.assign(document.createElement('div'), { className: 'hint', textContent: 'Maintenez l\'icône pour dicter : le texte s\'affichera ici.' }));
  }
  // L'agent demande une autorisation : elle se valide ici, au bas du fil.
  if (data.permission) thread.append(renderPermission(data.permission));
  const texts = { working: `${data.name} travaille`, asking: `${data.name} attend votre autorisation` };
  const text = data.live && !data.permission && texts[data.status];
  workingSince = text ? data.since : null;
  if (text) {
    working.dataset.status = data.status;
    working.querySelector('.what').textContent = text;
    working.querySelector('.elapsed').textContent = data.since ? elapsed(Date.now() - data.since) : '';
    thread.append(working);
  }
  // Autre conversation : en bas. Sinon, reste en bas quand un message arrive, sans
  // arracher la lecture d'un message plus ancien.
  if (compact || switched || data.permission || (atEnd && (grew || text))) thread.scrollTop = thread.scrollHeight;
  reportHeight();
});

// ⤢ / ⤡
modeButton.addEventListener('click', () => window.conv.setMode(mode === 'compact' ? 'full' : 'compact'));

/* ---- Contexte ---------------------------------------------------------------- */

// « 45 k »
const kTokens = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.0', '')} k` : String(n));

// L'anneau de l'en-tête : la part de la fenêtre de contexte occupée (orange à
// 80 %, rouge à 90 % : l'agent compactera bientôt de lui-même).
function renderGauge(c) {
  const known = c && Number.isFinite(c.used) && c.max;
  const pct = known ? Math.min(100, Math.round((c.used / c.max) * 100)) : 0;
  contextButton.style.setProperty('--pct', pct);
  contextButton.dataset.level = !known ? 'unknown' : pct >= 90 ? 'high' : pct >= 80 ? 'warn' : 'ok';
  document.getElementById('context-label').textContent = known ? `Contexte ${pct} %` : 'Contexte';
  contextButton.title = known ? `Contexte utilisé : ${kTokens(c.used)} sur ${kTokens(c.max)} jetons — cliquer pour le détail`
    : 'Contexte : cliquer pour le mesurer';
}

// Le détail : par catégorie (instructions, outils, mémoire, messages…), et de
// quoi le réduire.
async function showContext() {
  history.hidden = true;
  contextPanel.hidden = false;
  contextPanel.replaceChildren(Object.assign(document.createElement('div'), { className: 'hint', textContent: 'Mesure du contexte…' }));
  const res = await window.conv.probe();
  if (contextPanel.hidden) return;
  if (res.commands) commandsFor.set(agentKey(), res.commands);
  if (!res.context) {
    contextPanel.replaceChildren(Object.assign(document.createElement('div'), { className: 'hint', textContent: res.error || 'Mesure impossible.' }));
    return;
  }
  const c = res.context;
  const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
  const rows = c.categories.filter((x) => x.tokens > 0).map((x) => {
    const row = el('div', `ctx-row ${x.kind}`);
    const bar = el('span', 'ctx-bar');
    bar.style.setProperty('--w', `${Math.max(1, Math.round((x.tokens / c.max) * 100))}%`);
    row.append(el('span', 'ctx-name', x.name), bar, el('span', 'ctx-tokens', kTokens(x.tokens)));
    row.title = x.kind === 'deferred' ? 'Hors de la fenêtre : chargés à la demande' : '';
    return row;
  });
  const busy = !current || !current.live || BUSY.includes(current.status);
  const compactButton = el('button', 'ctx-compact', 'Compacter (/compact)');
  compactButton.type = 'button';
  compactButton.disabled = busy;
  compactButton.title = busy ? 'Possible quand l\'agent a fini, sur la conversation en cours'
    : 'Résumer la conversation pour libérer le contexte (l\'historique complet reste dans la transcription)';
  compactButton.addEventListener('click', async () => {
    compactButton.disabled = true;
    const sent = await window.conv.send({ text: '/compact', images: [], files: [], selection: '' });
    if (sent && sent.ok) contextPanel.hidden = true;
    else compactButton.textContent = (sent && sent.error) || 'Échec';
  });
  contextPanel.replaceChildren(
    el('div', 'ctx-total', `${kTokens(c.total)} / ${kTokens(c.max)} jetons (${Math.round(c.percentage)} %)`),
    el('div', 'ctx-model', c.model),
    ...rows,
    ...(c.memoryFiles.length ? [el('div', 'ctx-section', 'Fichiers de mémoire'),
      ...c.memoryFiles.map((f) => el('div', 'ctx-file', `${f.path} — ${kTokens(f.tokens)}`))] : []),
    compactButton,
  );
}
contextButton.addEventListener('click', () => { if (contextPanel.hidden) showContext(); else contextPanel.hidden = true; });

/* ---- Commandes (« / ») ------------------------------------------------------ */

// Le champ commence par « / » : les commandes de l'agent (celles de Claude
// Code, ses skills, celles du projet), filtrées par ce qui est tapé. Flèches,
// Entrée ou Tab pour choisir, Échap pour fermer. La liste vient de la sonde,
// une fois par dossier (deux agents peuvent porter le même nom).
const commandsFor = new Map();
const agentKey = () => (current ? current.dir : '');
let slashItems = [];
let slashIndex = 0;
let slashLoading = false;

function slashQuery() {
  const m = /^\/(\S*)$/.exec(message.value.slice(0, message.selectionStart));
  return m ? m[1].toLowerCase() : null;
}

async function updateSlash() {
  const q = slashQuery();
  if (q === null || composer.hidden) { closeSlash(); return; }
  const list = commandsFor.get(agentKey());
  if (!list) {
    showSlashHint('Chargement des commandes…');
    if (slashLoading) return;
    slashLoading = true;
    const res = await window.conv.probe();
    slashLoading = false;
    commandsFor.set(agentKey(), res.commands || []);
    if (!res.commands) { showSlashHint(res.error || 'Commandes indisponibles.'); return; }
    updateSlash();
    return;
  }
  slashItems = list.filter((c) => c.name.toLowerCase().startsWith(q))
    .concat(list.filter((c) => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q))).slice(0, 50);
  slashIndex = Math.min(slashIndex, Math.max(0, slashItems.length - 1));
  if (!slashItems.length) { showSlashHint('Aucune commande ne correspond.'); return; }
  slashBox.replaceChildren(...slashItems.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `slash-item${i === slashIndex ? ' active' : ''}`;
    b.append(Object.assign(document.createElement('span'), { className: 'slash-name', textContent: `/${c.name}${c.argumentHint ? ` ${c.argumentHint}` : ''}` }),
      Object.assign(document.createElement('span'), { className: 'slash-desc', textContent: c.description }));
    b.addEventListener('mousedown', (e) => { e.preventDefault(); pickSlash(i); });
    return b;
  }));
  slashBox.hidden = false;
  const active = slashBox.querySelector('.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
  reportHeight();
}
function showSlashHint(text) {
  slashItems = [];
  slashBox.replaceChildren(Object.assign(document.createElement('div'), { className: 'hint', textContent: text }));
  slashBox.hidden = false;
  reportHeight();
}
function closeSlash() {
  if (slashBox.hidden) return;
  slashBox.hidden = true;
  slashItems = [];
  slashIndex = 0;
  reportHeight();
}
function pickSlash(i) {
  const c = slashItems[i];
  if (!c) return;
  message.value = `/${c.name} ${message.value.slice(message.selectionStart).trimStart()}`;
  const at = c.name.length + 2;
  message.setSelectionRange(at, at);
  message.focus();
  closeSlash();
  autoSize();
}
// La liste ouverte prend les touches (cf. le keydown du champ, plus bas) : true
// si elle a pris celle-ci.
function slashKey(e) {
  if (slashBox.hidden) return false;
  if (e.key === 'Escape') closeSlash();
  else if (!slashItems.length) return false;
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    slashIndex = (slashIndex + (e.key === 'ArrowDown' ? 1 : -1) + slashItems.length) % slashItems.length;
    updateSlash();
  } else if (e.key === 'Enter' || e.key === 'Tab') pickSlash(slashIndex);
  else return false;
  e.preventDefault();
  e.stopPropagation(); // Échap : ne ferme pas aussi l'historique ou le contexte
  return true;
}
message.addEventListener('blur', () => setTimeout(closeSlash, 150));

// À la place de la bulle, panneau ouvert : un message de l'appli, en tête du
// panneau. null : effacé.
let noticeTimer = null;
window.conv.onNotice((n) => {
  clearTimeout(noticeTimer);
  notice.hidden = !n;
  if (n) {
    notice.dataset.kind = n.kind;
    noticeText.textContent = n.text;
    if (n.kind === 'status') noticeTimer = setTimeout(() => { notice.hidden = true; reportHeight(); }, 10000);
  }
  reportHeight();
});
document.getElementById('notice-close').addEventListener('click', () => { notice.hidden = true; reportHeight(); });

/* ---- Champ de saisie -------------------------------------------------------- */

// Écrire à l'agent affiché — au clavier, ou par la dictée, qui arrive ici
// quand le panneau est ouvert sur cet agent. Un brouillon par conversation
// (texte et pièces jointes) ; pendant que l'agent travaille, on peut écrire,
// pas envoyer.
//
// Pièces jointes : glisser-déposer ou Ctrl+V (images envoyées à Claude, autres
// fichiers par leur chemin), ou 📎 (fichiers à choisir, texte sélectionné).
//   { kind: 'image', name, type, data, url } | { kind: 'file', name, path }
//   | { kind: 'selection', text, cut }
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const drafts = new Map();
let pieces = [];
let sending = false;

function swapDraft(from, to) {
  if (from) drafts.set(from, { text: message.value, pieces });
  const d = drafts.get(to) || { text: '', pieces: [] };
  message.value = d.text;
  pieces = d.pieces;
  renderPieces();
  composerStatus.textContent = '';
  autoSize();
}

function renderPieces() {
  setTimeout(reportHeight, 0);
  piecesBox.replaceChildren(...pieces.map((p) => {
    const el = document.createElement('div');
    el.className = 'piece';
    if (p.kind === 'image') el.append(Object.assign(document.createElement('img'), { src: p.url, alt: '' }));
    const label = p.kind === 'selection' ? `❝ Sélection (${p.text.length.toLocaleString('fr-FR')} car.${p.cut ? ', coupée' : ''})`
      : p.kind === 'file' ? `${kindOf(p.path)} ${p.name}` : p.name;
    el.append(Object.assign(document.createElement('span'), { textContent: label }));
    el.title = p.kind === 'selection' ? p.text.slice(0, 600) : p.path || p.name;
    const remove = Object.assign(document.createElement('button'), { type: 'button', className: 'remove', textContent: '×', title: 'Retirer' });
    remove.addEventListener('click', () => {
      pieces = pieces.filter((x) => x !== p);
      if (p.url) URL.revokeObjectURL(p.url);
      renderPieces();
    });
    el.append(remove);
    return el;
  }));
}

// Fichiers collés ou déposés. Une image collée n'a pas de chemin : elle part
// en image ; un autre fichier sans chemin ne peut pas être joint.
async function addFiles(files) {
  if (composer.hidden) return; // ancienne conversation : rien à envoyer
  composerStatus.textContent = '';
  for (const file of files) {
    if (IMAGE_TYPES.includes(file.type)) {
      pieces.push({ kind: 'image', name: file.name || 'image collée', type: file.type, data: await file.arrayBuffer(), url: URL.createObjectURL(file) });
      continue;
    }
    const filePath = window.conv.pathFor(file);
    if (!filePath) composerStatus.textContent = `${file.name || 'Fichier'} : impossible à joindre ici, déposez-le depuis le gestionnaire de fichiers.`;
    else if (!pieces.some((p) => p.path === filePath)) pieces.push({ kind: 'file', name: file.name, path: filePath });
  }
  renderPieces();
}

window.conv.onAttached((what) => {
  if (what.selection) pieces = [...pieces.filter((p) => p.kind !== 'selection'), { kind: 'selection', ...what.selection }];
  for (const f of what.files || []) {
    if (!pieces.some((p) => p.path === f)) pieces.push({ kind: 'file', name: f.split('/').pop() || f, path: f });
  }
  renderPieces();
  message.focus();
});

// Du texte collé va dans le champ ; des images ou fichiers, en pièces jointes.
message.addEventListener('paste', (e) => {
  const files = [...((e.clipboardData && e.clipboardData.files) || [])];
  if (!files.length) return;
  e.preventDefault();
  addFiles(files);
});

// Tout le panneau accepte le dépôt (le champ s'allume). Sans preventDefault, un
// fichier lâché remplacerait la page ; du texte lâché dans le champ s'y insère.
let dragDepth = 0;
const dragging = (on) => document.body.classList.toggle('dragging', on && !composer.hidden);
document.addEventListener('dragenter', () => { dragDepth += 1; dragging(true); });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dragging(false); });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  dragDepth = 0;
  dragging(false);
  const files = [...e.dataTransfer.files];
  if (files.length || e.target !== message) e.preventDefault();
  if (files.length) addFiles(files);
});

// La dictée, panneau ouvert sur cet agent : ajoutée au champ, à relire.
window.conv.onDictation((text) => {
  message.value += `${message.value && !/\s$/.test(message.value) ? ' ' : ''}${text}`;
  autoSize();
  message.focus();
  message.setSelectionRange(message.value.length, message.value.length);
});
window.conv.onFocusInput(() => message.focus());

function renderComposer() {
  composer.hidden = !current.live; // une ancienne conversation se lit, ou se reprend
  const busy = BUSY.includes(current.status);
  sendButton.disabled = sending || busy;
  message.placeholder = busy ? `${current.name} travaille : vous pourrez envoyer quand il aura fini.`
    : `Écrire à ${current.name}… (Entrée : envoyer, Maj+Entrée : à la ligne)`;
}

// Le champ grandit avec le texte, jusqu'à quelques lignes.
function autoSize() {
  message.style.height = 'auto';
  message.style.height = `${Math.min(message.scrollHeight, 160)}px`;
  message.style.overflowY = message.scrollHeight > 160 ? 'auto' : 'hidden'; // pas de barre pour rien
  reportHeight();
}

async function sendMessage() {
  const text = message.value.trim();
  if ((!text && !pieces.length) || sending || !current || BUSY.includes(current.status)) return;
  sending = true;
  renderComposer();
  const draft = {
    text,
    images: pieces.filter((p) => p.kind === 'image').map(({ name, type, data }) => ({ name, type, data })),
    files: pieces.filter((p) => p.kind === 'file').map((p) => p.path),
    selection: (pieces.find((p) => p.kind === 'selection') || {}).text || '',
  };
  let res;
  try { res = await window.conv.send(draft); } catch { res = null; }
  sending = false;
  if (res && res.ok) {
    message.value = '';
    for (const p of pieces) if (p.url) URL.revokeObjectURL(p.url);
    pieces = [];
    renderPieces();
    drafts.delete(shownKey);
    composerStatus.textContent = '';
    autoSize();
    thread.scrollTop = thread.scrollHeight;
  } else {
    composerStatus.textContent = (res && res.error) || 'L\'envoi a échoué.';
  }
  renderComposer();
}

message.addEventListener('input', () => { autoSize(); composerStatus.textContent = ''; slashIndex = 0; updateSlash(); });
message.addEventListener('keydown', (e) => {
  if (slashKey(e)) return;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
});
sendButton.addEventListener('click', sendMessage);
autoSize();
document.getElementById('attach').addEventListener('click', () => window.conv.attach());
document.getElementById('hide').addEventListener('click', () => window.conv.hide());

/* ---- Historique du dossier ----------------------------------------------- */

const when = (ms) => new Date(ms).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

async function showHistory() {
  contextPanel.hidden = true;
  history.hidden = false;
  history.replaceChildren(Object.assign(document.createElement('div'), { className: 'hint', textContent: 'Chargement…' }));
  const list = await window.conv.history();
  if (history.hidden) return;
  if (!list.length) {
    history.replaceChildren(Object.assign(document.createElement('div'), { className: 'hint', textContent: 'Aucune conversation dans ce dossier.' }));
    return;
  }
  history.replaceChildren(...list.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'session';
    b.append(
      Object.assign(document.createElement('div'), { className: 'session-title', textContent: s.title || 'Conversation sans titre' }),
      Object.assign(document.createElement('div'), { className: 'session-date', textContent: `${when(s.lastModified)}${s.current ? ' · en cours' : ''}` }),
    );
    b.classList.toggle('current', s.current);
    b.addEventListener('click', () => { history.hidden = true; window.conv.open(s.sessionId); });
    return b;
  }));
}

historyButton.addEventListener('click', () => { if (history.hidden) showHistory(); else history.hidden = true; });
resume.addEventListener('click', () => window.conv.resume());
document.getElementById('current').addEventListener('click', () => window.conv.current());
lightbox.addEventListener('click', () => { lightbox.hidden = true; });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.hidden) lightbox.hidden = true;
  else if (e.key === 'Escape' && !history.hidden) history.hidden = true;
  else if (e.key === 'Escape' && !contextPanel.hidden) contextPanel.hidden = true;
});

window.conv.ready();
