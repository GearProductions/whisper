/** BubbleApp — la bulle des messages de l'appli : une « notice » (« Micro
 *  Discord coupé »), un message (téléchargement, installation…) ou le curseur
 *  du volume de lecture, appliqué aussitôt. La croix la ferme. Le principal la
 *  place, la montre sans lui donner le focus et la masque au bout de quelques
 *  secondes ; le survol suspend ce délai. Seul fichier de la bulle qui connaît
 *  le pont (window.bubble).
 *  Ne connaît pas : la dictée, les agents (le panneau). Utilisé par : main.tsx. */
import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { BubbleApi, BubbleKind } from '../bridge';

type Shown = { text: string; kind: BubbleKind; maxHeight: number };

export function BubbleApp({ bubble }: { bubble: BubbleApi }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [volume, setVolume] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // `size` : { width, maxHeight } de la fenêtre. La largeur est posée avant la
    // mesure : la fenêtre, cachée, n'est pas encore à la bonne taille.
    bubble.onShow((value, kind, size) => {
      document.body.style.width = `${size.width}px`;
      flushSync(() => {
        setShown({ text: kind === 'volume' ? 'Volume de lecture' : String(value), kind, maxHeight: size.maxHeight });
        if (kind === 'volume') setVolume(String(Math.round(Number(value) * 100)));
      });
      text.current!.scrollTop = 0;
      // Hauteur réelle une fois le texte posé : le principal taille la fenêtre
      // dessus. Mesure immédiate, PAS dans un requestAnimationFrame : la bulle
      // est alors cachée, et une page cachée n'en exécute aucun.
      bubble.ready(Math.ceil(box.current!.getBoundingClientRect().height) + 8);
    });
  }, []);

  return (
    <>
      <div id="bubble" ref={box} className={shown?.kind === 'notice' ? 'notice' : undefined}
        style={shown ? { maxHeight: `${shown.maxHeight - 8}px` } : undefined}
        onMouseEnter={() => bubble.hover(true)} onMouseLeave={() => bubble.hover(false)}>
        <div id="text" className="scroll" ref={text}>{shown?.text}</div>
        <div id="volume" hidden={shown?.kind !== 'volume'}>
          <input id="volume-range" type="range" min="0" max="100" step="5" aria-label="Volume de lecture" value={volume}
            onChange={(e) => { setVolume(e.target.value); bubble.setVolume(Number(e.target.value) / 100); }} />
          <span id="volume-value">{volume && `${volume} %`}</span>
        </div>
      </div>
      <button id="close" type="button" title="Fermer" aria-label="Fermer" onClick={() => bubble.close()}>×</button>
    </>
  );
}
