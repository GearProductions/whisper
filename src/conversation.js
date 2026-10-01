/* =========================================================================
   Whisper — les conversations des agents, en onglets

   Une fenêtre classique (redimensionnable, déplaçable), un onglet par
   conversation ouverte : la session en cours d'un agent, ou une ancienne
   session de son dossier, ouverte depuis l'historique (lecture seule, à
   reprendre au besoin). Chaque conversation porte son intitulé, celui que
   Claude Code lui donne. Le principal envoie onglets et fil (`conv:thread`) à
   l'ouverture, à chaque changement, et au fil d'un tour (l'agent qui travaille
   s'anime au bas du fil) ; ▶ Écouter lit le résumé audio d'une réponse par le
   lecteur de l'icône. Chaque message dit son heure ; les liens s'ouvrent dans
   le navigateur ; les pièces jointes d'un message (images, fichiers, texte
   sélectionné) s'y voient.
   ========================================================================= */

const tabsBar = document.getElementById('tabs');
const thread = document.getElementById('thread');
const template = document.getElementById('message-template');
const tabTemplate = document.getElementById('tab-template');
const lightbox = document.getElementById('lightbox');
const composer = document.getElementById('composer');
const message = document.getElementById('message');
const sendButton = document.getElementById('send');
const composerStatus = document.getElementById('composer-status');
const archived = document.getElementById('archived');
const resume = document.getElementById('resume');
const history = document.getElementById('history');
const historyButton = document.getElementById('history-button');

const BUSY = ['working', 'asking'];
let shownKey = null; // onglet affiché au dernier rendu

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

// Demande d'autorisation dans le fil, comme dans la bulle : ce qui va
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

const openDetails = new Set(); // contextes dépliés, par rang : gardés d'un rendu à l'autre

function renderTabs(tabs, active) {
  tabsBar.replaceChildren(...tabs.map((t) => {
    const el = tabTemplate.content.firstElementChild.cloneNode(true);
    el.style.setProperty('--tab', t.color);
    el.classList.toggle('active', t.key === active);
    el.classList.toggle('busy', t.live && BUSY.includes(t.status));
    el.classList.toggle('old', !t.live);
    // Notifications de l'onglet : nouveau message, autorisation demandée.
    el.classList.toggle('unread', !!t.unread && t.key !== active);
    el.classList.toggle('asking', t.live && t.status === 'asking');
    const note = t.live && t.status === 'asking' ? ' — attend votre autorisation' : t.unread && t.key !== active ? ' — nouveau message' : '';
    el.title = `${t.name} — ${titleOf(t)}${t.live ? '' : ' (ancienne conversation)'}${note}`;
    el.querySelector('.tab-title').textContent = titleOf(t);
    el.addEventListener('click', () => { if (t.key !== active) window.conv.select(t.key); });
    // Clic du milieu : fermer, comme dans un navigateur.
    el.addEventListener('auxclick', (e) => { if (e.button === 1) window.conv.closeTab(t.key); });
    el.querySelector('.tab-close').addEventListener('click', (e) => { e.stopPropagation(); window.conv.closeTab(t.key); });
    return el;
  }));
  const el = tabsBar.querySelector('.active');
  if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// `data` : { tabs: [{ key, live, name, color, status, since, title, unread }], active, dir,
//            permission: { key, title, text, always } | null,
//            messages: [{ role, text, context, files, images, time, tools, audio }] }.
window.conv.onThread((data) => {
  const tab = data.tabs.find((t) => t.key === data.active);
  if (!tab) return;
  renderTabs(data.tabs, data.active);
  document.documentElement.style.setProperty('--accent', tab.color);
  document.title = `${titleOf(tab)} — ${tab.name}`;
  document.getElementById('title').textContent = titleOf(tab);
  document.getElementById('sub').textContent = `${tab.name} · ${data.dir}`;
  archived.hidden = tab.live;
  resume.disabled = BUSY.includes(tab.status);
  resume.title = resume.disabled ? `${tab.name} travaille : attendez qu'il ait fini.`
    : `${tab.name} reprend cette conversation ; celle en cours reste dans l'historique.`;

  const switched = data.active !== shownKey;
  if (switched) swapDraft(shownKey, data.active);
  shownKey = data.active;
  renderComposer(tab);
  if (switched) { history.hidden = true; openDetails.clear(); }
  const atEnd = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 40;
  const grew = data.messages.length !== thread.querySelectorAll('.message').length;
  thread.replaceChildren(...data.messages.map((m, index) => {
    const el = template.content.firstElementChild.cloneNode(true);
    el.classList.add(m.role);
    const who = el.querySelector('.who');
    who.textContent = m.role === 'user' ? 'Vous' : tab.name;
    if (m.time) {
      who.append(Object.assign(document.createElement('time'), {
        textContent: clock(m.time), title: new Date(m.time).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' }),
      }));
    }
    renderBody(el.querySelector('.body'), m.text);
    el.querySelector('.body').hidden = !m.text;
    const context = el.querySelector('.context');
    context.hidden = !m.context;
    if (m.context) {
      context.querySelector('summary').textContent = `Texte sélectionné joint (${m.context.length.toLocaleString('fr-FR')} caractères)`;
      context.querySelector('pre').textContent = m.context;
      context.open = openDetails.has(index);
      context.addEventListener('toggle', () => { if (context.open) openDetails.add(index); else openDetails.delete(index); });
    }
    renderAttachments(el.querySelector('.attachments'), m);
    el.querySelector('.tools').replaceChildren(...(m.tools || []).map((t) => Object.assign(document.createElement('div'), { textContent: t })));
    const listen = el.querySelector('.listen');
    listen.hidden = m.role !== 'assistant' || !m.audio;
    listen.addEventListener('click', () => window.conv.speak(index));
    return el;
  }));
  // L'agent demande une autorisation : elle se valide ici, au bas du fil.
  if (data.permission) thread.append(renderPermission(data.permission));
  const texts = { working: `${tab.name} travaille`, asking: `${tab.name} attend votre autorisation` };
  const text = tab.live && !data.permission && texts[tab.status];
  workingSince = text ? tab.since : null;
  if (text) {
    working.dataset.status = tab.status;
    working.querySelector('.what').textContent = text;
    working.querySelector('.elapsed').textContent = tab.since ? elapsed(Date.now() - tab.since) : '';
    thread.append(working);
  }
  // Nouvel onglet : en bas. Sinon, reste en bas quand un message arrive, sans
  // arracher la lecture d'un message plus ancien.
  if (switched || data.permission || (atEnd && (grew || text))) thread.scrollTop = thread.scrollHeight;
});

/* ---- Champ de saisie -------------------------------------------------------- */

// Écrire à l'agent de l'onglet affiché, sans micro. Un brouillon par onglet ;
// pendant que l'agent travaille, on peut écrire, pas envoyer.
const drafts = new Map();
let composerTab = null;
let sending = false;

function swapDraft(from, to) {
  if (from) drafts.set(from, message.value);
  message.value = drafts.get(to) || '';
  composerStatus.textContent = '';
  autoSize();
}

function renderComposer(tab) {
  composerTab = tab;
  composer.hidden = !tab.live; // une ancienne conversation se lit, ou se reprend
  const busy = BUSY.includes(tab.status);
  sendButton.disabled = sending || busy;
  message.placeholder = busy ? `${tab.name} travaille : vous pourrez envoyer quand il aura fini.`
    : `Écrire à ${tab.name}… (Entrée : envoyer, Maj+Entrée : à la ligne)`;
}

// Le champ grandit avec le texte, jusqu'à quelques lignes.
function autoSize() {
  message.style.height = 'auto';
  message.style.height = `${Math.min(message.scrollHeight, 160)}px`;
  message.style.overflowY = message.scrollHeight > 160 ? 'auto' : 'hidden'; // pas de barre pour rien
}

async function sendMessage() {
  const text = message.value.trim();
  if (!text || sending || !composerTab || BUSY.includes(composerTab.status)) return;
  sending = true;
  renderComposer(composerTab);
  let res;
  try { res = await window.conv.send(text); } catch { res = null; }
  sending = false;
  if (res && res.ok) {
    message.value = '';
    drafts.delete(shownKey);
    composerStatus.textContent = '';
    autoSize();
    thread.scrollTop = thread.scrollHeight;
  } else {
    composerStatus.textContent = (res && res.error) || 'L\'envoi a échoué.';
  }
  renderComposer(composerTab);
}

message.addEventListener('input', () => { autoSize(); composerStatus.textContent = ''; });
message.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
});
sendButton.addEventListener('click', sendMessage);
autoSize();
document.getElementById('attach').addEventListener('click', () => {
  window.conv.compose(message.value);
  message.value = '';
  drafts.delete(shownKey);
  autoSize();
});

/* ---- Historique du dossier ----------------------------------------------- */

const when = (ms) => new Date(ms).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

async function showHistory() {
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
lightbox.addEventListener('click', () => { lightbox.hidden = true; });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.hidden) lightbox.hidden = true;
  else if (e.key === 'Escape' && !history.hidden) history.hidden = true;
  if (e.key.toLowerCase() === 'w' && e.ctrlKey && shownKey) { e.preventDefault(); window.conv.closeTab(shownKey); }
});

window.conv.ready();
