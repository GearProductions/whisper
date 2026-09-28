/* =========================================================================
   Whisper — la bulle du texte transcrit

   Montrée à côté de l'icône à la fin d'une dictée (réglage « Afficher le texte
   transcrit »). Un clic copie le texte dans le presse-papiers. Le principal la
   place, la montre sans lui donner le focus et la masque au bout de quelques
   secondes — le survol suspend ce délai.
   ========================================================================= */

const box = document.getElementById('bubble');
const text = document.getElementById('text');
const hint = document.getElementById('hint');
const HINT = 'Cliquer pour copier';

window.bubble.onShow((value) => {
  text.textContent = value;
  hint.textContent = HINT;
  box.classList.remove('copied');
  box.scrollTop = 0;
  // Hauteur réelle une fois le texte posé : le principal taille la fenêtre dessus.
  // Mesure immédiate (getBoundingClientRect force la mise en page), PAS dans un
  // requestAnimationFrame : la bulle est alors cachée, et une page cachée n'en
  // exécute aucun — elle ne s'afficherait qu'à la première dictée.
  window.bubble.ready(Math.ceil(box.getBoundingClientRect().height) + 8);
});

box.addEventListener('click', async () => {
  if (await window.bubble.copy()) {
    box.classList.add('copied');
    hint.textContent = 'Copié ✓';
  }
});

box.addEventListener('mouseenter', () => window.bubble.hover(true));
box.addEventListener('mouseleave', () => window.bubble.hover(false));
