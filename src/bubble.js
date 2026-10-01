/* =========================================================================
   Whisper — la bulle du texte transcrit

   Montrée à côté de l'icône à la fin d'une dictée (réglage « Afficher le texte
   transcrit »). Un clic copie le texte dans le presse-papiers ; la croix la
   ferme. Le principal la place (et la déplace avec l'icône), la montre sans
   lui donner le focus et la masque au bout de quelques secondes — le survol
   suspend ce délai.

   Elle sert aussi de « notice » (ex. « Micro Discord coupé ») : simple
   message, rien à copier ; de réglage du volume de lecture (un curseur,
   appliqué aussitôt) ; et pour les agents Claude Code : leur réponse (à copier,
   ou à écouter par ▶) et leurs demandes d'autorisation (trois boutons). Ces
   deux-là reçoivent un objet { title, text } et restent jusqu'à leur croix.
   ========================================================================= */

const box = document.getElementById('bubble');
const text = document.getElementById('text');
const hint = document.getElementById('hint');
const volume = document.getElementById('volume');
const range = document.getElementById('volume-range');
const rangeValue = document.getElementById('volume-value');
const title = document.getElementById('title');
const actions = document.getElementById('actions');
const expand = document.getElementById('expand');
const always = document.getElementById('always');
const HINT = 'Cliquer pour copier';
// Boutons montrés par genre de bulle.
const ACTIONS = { agent: ['speak'], permission: ['allow', 'always', 'deny'] };

// `size` : { width, maxHeight } de la fenêtre pour ce genre de bulle. La largeur
// est posée ici, avant la mesure : la fenêtre, cachée, n'est pas encore à la
// bonne taille.
window.bubble.onShow((value, kind, size) => {
  document.body.style.width = `${size.width}px`;
  box.style.maxHeight = `${size.maxHeight - 8}px`;
  box.style.setProperty('--accent', (value && value.color) || '#a78bfa'); // la couleur de l'agent
  const notice = kind === 'notice' || kind === 'status' || kind === 'permission'; // rien à copier
  const isVolume = kind === 'volume';
  const rich = kind === 'agent' || kind === 'permission'; // { title, text }
  title.hidden = !rich;
  title.textContent = rich ? value.title : '';
  // Réponse d'un agent : ses liens sont cliquables (cf. links.js).
  if (kind === 'agent') text.replaceChildren(linkify(value.text, window.bubble.openLink));
  else text.textContent = isVolume ? 'Volume de lecture' : rich ? value.text : value;
  // « Toujours autoriser » : seulement s'il y a quelque chose à accorder, et en
  // disant quoi.
  const rules = (kind === 'permission' && value.always) || [];
  const shown = (ACTIONS[kind] || []).filter((a) => a !== 'always' || rules.length);
  actions.hidden = !shown.length;
  for (const b of actions.children) b.hidden = !shown.includes(b.dataset.act);
  always.hidden = !rules.length;
  always.textContent = rules.length ? `« Toujours autoriser », jusqu'à la fin de cette session : ${rules.join(', ')}` : '';
  shownAt = Date.now();
  volume.hidden = !isVolume;
  if (isVolume) {
    range.value = String(Math.round(Number(value) * 100));
    rangeValue.textContent = `${range.value} %`;
  }
  hint.textContent = HINT;
  hint.hidden = notice || isVolume;
  box.title = notice || isVolume ? '' : HINT;
  box.classList.toggle('notice', kind === 'notice');   // aux couleurs de Discord
  box.classList.toggle('status', kind === 'status');
  box.classList.toggle('volume', isVolume);
  box.classList.toggle('permission', kind === 'permission');
  expand.hidden = kind !== 'agent';
  box.classList.remove('copied');
  text.scrollTop = 0;
  // Hauteur réelle une fois le texte posé : le principal taille la fenêtre dessus.
  // Mesure immédiate (getBoundingClientRect force la mise en page), PAS dans un
  // requestAnimationFrame : la bulle est alors cachée, et une page cachée n'en
  // exécute aucun — elle ne s'afficherait qu'à la première dictée.
  window.bubble.ready(Math.ceil(box.getBoundingClientRect().height) + 8);
});

// La croix ferme SANS copier (elle est hors de la bulle : son clic n'y remonte pas).
document.getElementById('close').addEventListener('click', () => window.bubble.close());
// Agrandir : le principal ouvre la fenêtre de conversation de cet agent.
expand.addEventListener('click', () => window.bubble.action('expand'));

range.addEventListener('input', () => {
  rangeValue.textContent = `${range.value} %`;
  window.bubble.setVolume(Number(range.value) / 100);
});

// Un bouton d'action n'est pas un clic « copier ». Un clic parti juste avant
// que la bulle change de contenu (une autre demande vient d'arriver) est
// ignoré : il répondrait à ce qu'on n'a pas eu le temps de lire.
const CLICK_GUARD_MS = 600;
let shownAt = 0;
actions.addEventListener('click', (e) => {
  e.stopPropagation();
  const b = e.target.closest('button');
  if (b && Date.now() - shownAt > CLICK_GUARD_MS) window.bubble.action(b.dataset.act);
});

box.addEventListener('click', async () => {
  if (box.classList.contains('volume') || box.classList.contains('permission')) return;
  if (await window.bubble.copy()) {
    box.classList.add('copied');
    hint.textContent = 'Copié ✓';
  }
});

box.addEventListener('mouseenter', () => window.bubble.hover(true));
box.addEventListener('mouseleave', () => window.bubble.hover(false));
