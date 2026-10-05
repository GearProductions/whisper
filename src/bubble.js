/* =========================================================================
   Whisper — la bulle des messages de l'appli

   Une « notice » (« Micro Discord coupé »), un message de l'appli
   (téléchargement, installation…) ou le réglage du volume de lecture (un
   curseur, appliqué aussitôt). La croix la ferme. Le principal la place (et
   la déplace avec l'icône), la montre sans lui donner le focus et la masque au
   bout de quelques secondes — le survol suspend ce délai. Le texte dicté et
   les agents ont leur panneau (conversation.js).
   ========================================================================= */

const box = document.getElementById('bubble');
const text = document.getElementById('text');
const volume = document.getElementById('volume');
const range = document.getElementById('volume-range');
const rangeValue = document.getElementById('volume-value');

// `size` : { width, maxHeight } de la fenêtre. La largeur est posée ici, avant
// la mesure : la fenêtre, cachée, n'est pas encore à la bonne taille.
window.bubble.onShow((value, kind, size) => {
  document.body.style.width = `${size.width}px`;
  box.style.maxHeight = `${size.maxHeight - 8}px`;
  const isVolume = kind === 'volume';
  text.textContent = isVolume ? 'Volume de lecture' : value;
  volume.hidden = !isVolume;
  if (isVolume) {
    range.value = String(Math.round(Number(value) * 100));
    rangeValue.textContent = `${range.value} %`;
  }
  box.classList.toggle('notice', kind === 'notice');   // aux couleurs de Discord
  text.scrollTop = 0;
  // Hauteur réelle une fois le texte posé : le principal taille la fenêtre dessus.
  // Mesure immédiate (getBoundingClientRect force la mise en page), PAS dans un
  // requestAnimationFrame : la bulle est alors cachée, et une page cachée n'en
  // exécute aucun — elle ne s'afficherait qu'à la première dictée.
  window.bubble.ready(Math.ceil(box.getBoundingClientRect().height) + 8);
});

document.getElementById('close').addEventListener('click', () => window.bubble.close());

range.addEventListener('input', () => {
  rangeValue.textContent = `${range.value} %`;
  window.bubble.setVolume(Number(range.value) / 100);
});

box.addEventListener('mouseenter', () => window.bubble.hover(true));
box.addEventListener('mouseleave', () => window.bubble.hover(false));
