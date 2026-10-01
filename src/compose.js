/* =========================================================================
   Whisper — relire un message avant de l'envoyer à un agent

   Le texte dicté, à corriger ; chaque nouvelle dictée s'y ajoute. Le contexte
   à joindre : images et fichiers (glissés-déposés ou collés), et le texte
   sélectionné au moment de la dictée — montré, joint seulement si on coche.
   Ctrl+Entrée envoie, Échap abandonne. Le principal ferme la fenêtre une fois
   le message parti.
   ========================================================================= */

const text = document.getElementById('text');
const selectionBox = document.getElementById('selection');
const withSelection = document.getElementById('with-selection');
const selectionLabel = document.getElementById('selection-label');
const selectionText = document.getElementById('selection-text');
const list = document.getElementById('list');
const sendButton = document.getElementById('send');
const status = document.getElementById('status');

// { kind: 'image', name, type, data, url } | { kind: 'file', name, path }
const attachments = [];
const agent = { name: '', busy: false };
let sending = false;
let error = '';

function render() {
  sendButton.disabled = sending || agent.busy;
  const busy = agent.busy ? `${agent.name} travaille encore : l'envoi sera possible quand il aura répondu.` : '';
  status.textContent = error || (sending ? 'Envoi…' : busy);
  status.classList.toggle('error', !!error);
}

function setAgent(a) {
  if (!a) return;
  Object.assign(agent, a);
  document.documentElement.style.setProperty('--accent', a.color);
  document.title = `Message pour ${a.name}`;
  document.getElementById('name').textContent = `Message pour ${a.name}`;
  document.getElementById('dir').textContent = a.dir;
  render();
}

// `sel` : { text, cut }, ou null quand la sélection ne peut pas être jointe.
function setSelection(sel) {
  selectionBox.hidden = !sel;
  if (!sel) return;
  const has = !!sel.text;
  withSelection.disabled = !has;
  if (!has) withSelection.checked = false;
  const n = sel.text.length.toLocaleString('fr-FR');
  selectionLabel.textContent = has ? `Joindre le texte sélectionné (${n} caractères${sel.cut ? ', coupé' : ''})` : 'Aucun texte sélectionné';
  selectionText.hidden = !has;
  selectionText.textContent = sel.text;
  selectionText.scrollTop = 0;
}

function focusEnd() {
  text.focus();
  text.setSelectionRange(text.value.length, text.value.length);
  text.scrollTop = text.scrollHeight;
}

/* ---- Pièces jointes ------------------------------------------------------ */

function renderList() {
  for (const a of attachments) a.el = a.el || item(a);
  list.replaceChildren(...attachments.map((a) => a.el));
}

function item(a) {
  const el = document.createElement('div');
  el.className = 'item';
  el.title = a.path || a.name;
  if (a.kind === 'image') el.append(Object.assign(document.createElement('img'), { src: a.url, alt: '' }));
  el.append(Object.assign(document.createElement('span'), { textContent: a.kind === 'image' ? a.name : `📄 ${a.name}` }));
  const remove = Object.assign(document.createElement('button'), { className: 'remove', type: 'button', textContent: '×', title: 'Retirer' });
  remove.addEventListener('click', () => {
    attachments.splice(attachments.indexOf(a), 1);
    if (a.url) URL.revokeObjectURL(a.url);
    renderList();
  });
  el.append(remove);
  return el;
}

// Une image part à Claude (réduite par le principal si besoin) ; un autre
// fichier, ou une image d'un format que Claude ne lit pas (SVG, TIFF…), par son
// chemin : l'agent le lit lui-même. Ce qui est collé n'a pas de chemin : hors
// image, ça ne peut pas être joint.
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

async function addFiles(files) {
  error = '';
  for (const file of files) {
    if (IMAGE_TYPES.includes(file.type)) {
      attachments.push({ kind: 'image', name: file.name || 'image collée', type: file.type, data: await file.arrayBuffer(), url: URL.createObjectURL(file) });
      continue;
    }
    const path = window.compose.pathFor(file);
    if (!path) error = `${file.name || 'Fichier'} : impossible à joindre ici, déposez-le depuis le gestionnaire de fichiers.`;
    else if (!attachments.some((a) => a.path === path)) attachments.push({ kind: 'file', name: file.name, path });
  }
  renderList();
  render();
}

// Du texte collé va dans le message ; des images ou fichiers, en pièces jointes.
document.addEventListener('paste', (e) => {
  const files = [...((e.clipboardData && e.clipboardData.files) || [])];
  if (!files.length) return;
  e.preventDefault();
  addFiles(files);
});

// Toute la fenêtre accepte le dépôt. Sans preventDefault, un fichier lâché
// remplacerait la page ; du texte lâché dans le message s'y insère normalement.
let dragDepth = 0;
const dragging = (on) => document.body.classList.toggle('dragging', on);
document.addEventListener('dragenter', () => { dragDepth += 1; dragging(true); });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dragging(false); });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  dragDepth = 0;
  dragging(false);
  const files = [...e.dataTransfer.files];
  if (files.length || e.target !== text) e.preventDefault();
  if (files.length) addFiles(files);
});

/* ---- Envoyer, abandonner --------------------------------------------------- */

async function send() {
  if (sending || agent.busy) return;
  sending = true;
  error = '';
  render();
  const images = attachments.filter((a) => a.kind === 'image').map(({ name, type, data }) => ({ name, type, data }));
  const files = attachments.filter((a) => a.kind === 'file').map((a) => a.path);
  let res;
  try {
    res = await window.compose.send({ text: text.value, withSelection: withSelection.checked, images, files });
  } catch { res = null; }
  sending = false;
  // Parti : le principal ferme la fenêtre. Sinon, le brouillon reste.
  if (!res || !res.ok) error = (res && res.error) || 'L\'envoi a échoué.';
  render();
}

sendButton.addEventListener('click', send);
document.getElementById('cancel').addEventListener('click', () => window.compose.cancel());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
  if (e.key === 'Escape') window.compose.cancel();
});

// Relire la sélection maintenant : c'est pour la joindre, on la coche.
document.getElementById('reread').addEventListener('click', async () => {
  const sel = await window.compose.readSelection();
  setSelection(sel);
  if (sel && sel.text) withSelection.checked = true;
});

/* ---- Brouillon ------------------------------------------------------------- */

window.compose.onAgent(setAgent);
window.compose.onAppend((more) => {
  text.value += `${text.value && !/\s$/.test(text.value) ? ' ' : ''}${more}`;
  focusEnd();
});
window.compose.init().then((draft) => {
  if (!draft) return;
  setAgent(draft.agent);
  text.value = draft.text || '';
  setSelection(draft.selection);
  focusEnd();
});
render();
