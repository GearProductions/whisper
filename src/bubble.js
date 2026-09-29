/* =========================================================================
   Whisper — la bulle du texte transcrit

   Montrée à côté de l'icône à la fin d'une dictée (réglage « Afficher le texte
   transcrit »). Un clic copie le texte dans le presse-papiers ; la croix la
   ferme. Le principal la place (et la déplace avec l'icône), la montre sans
   lui donner le focus et la masque au bout de quelques secondes — le survol
   suspend ce délai.

   Elle sert aussi de « notice » (ex. « Micro Discord coupé ») : simple
   message, rien à copier ; et de réglage du volume de lecture (un curseur,
   appliqué aussitôt).
   ========================================================================= */

const box = document.getElementById('bubble');
const text = document.getElementById('text');
const hint = document.getElementById('hint');
const volume = document.getElementById('volume');
const range = document.getElementById('volume-range');
const rangeValue = document.getElementById('volume-value');
const HINT = 'Cliquer pour copier';

window.bubble.onShow((value, kind) => {
  const notice = kind === 'notice';
  const isVolume = kind === 'volume';
  text.textContent = isVolume ? 'Volume de lecture' : value;
  volume.hidden = !isVolume;
  if (isVolume) {
    range.value = String(Math.round(Number(value) * 100));
    rangeValue.textContent = `${range.value} %`;
  }
  hint.textContent = HINT;
  hint.hidden = notice || isVolume;
  box.title = notice || isVolume ? '' : HINT;
  box.classList.toggle('notice', notice);
  box.classList.toggle('volume', isVolume);
  box.classList.remove('copied');
  box.scrollTop = 0;
  // Hauteur réelle une fois le texte posé : le principal taille la fenêtre dessus.
  // Mesure immédiate (getBoundingClientRect force la mise en page), PAS dans un
  // requestAnimationFrame : la bulle est alors cachée, et une page cachée n'en
  // exécute aucun — elle ne s'afficherait qu'à la première dictée.
  window.bubble.ready(Math.ceil(box.getBoundingClientRect().height) + 8);
});

// La croix ferme SANS copier (elle est hors de la bulle : son clic n'y remonte pas).
document.getElementById('close').addEventListener('click', () => window.bubble.close());

range.addEventListener('input', () => {
  rangeValue.textContent = `${range.value} %`;
  window.bubble.setVolume(Number(range.value) / 100);
});

box.addEventListener('click', async () => {
  if (box.classList.contains('volume')) return;
  if (await window.bubble.copy()) {
    box.classList.add('copied');
    hint.textContent = 'Copié ✓';
  }
});

box.addEventListener('mouseenter', () => window.bubble.hover(true));
box.addEventListener('mouseleave', () => window.bubble.hover(false));
