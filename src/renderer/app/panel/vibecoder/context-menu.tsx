/** context-menu — un menu contextuel posé au point (x, y), gardé dans le panneau (recalé si
 *  le point est près d'un bord). Entrées { id, label, disabled? } ; le choix d'une entrée
 *  active appelle onPick(id) puis onClose(). Se ferme aussi avec Échap (écouté en capture :
 *  il n'atteint pas les autres Échap du panneau) ou un clic ailleurs ; flèches haut/bas,
 *  Début et Fin déplacent la sélection (les entrées grisées sautées), Entrée choisit. Les
 *  écouteurs ne vivent que menu ouvert (il est monté ou démonté par son parent).
 *  Ne connaît pas : les artefacts, le pont. Utilisé par : artifacts-view. */
import { useEffect, useLayoutEffect, useRef } from 'react';
import './context-menu.css';

export type ContextMenuEntry = { id: string; label: string; disabled?: boolean };
type Props = { x: number; y: number; entries: ContextMenuEntry[]; onPick(id: string): void; onClose(): void };

export function ContextMenu({ x, y, entries, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const items = () => [...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  // Gardé dans le panneau : recalé d'après sa taille mesurée ; le premier choix actif a le focus.
  useLayoutEffect(() => {
    const m = ref.current!;
    m.style.left = `${Math.max(0, Math.min(x, window.innerWidth - m.offsetWidth))}px`;
    m.style.top = `${Math.max(0, Math.min(y, window.innerHeight - m.offsetHeight))}px`;
    items()[0]?.focus();
  }, [x, y]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === 'ArrowDown' ? list[(i + 1) % list.length] : e.key === 'ArrowUp' ? list[(i - 1 + list.length) % list.length]
      : e.key === 'Home' ? list[0] : e.key === 'End' ? list.at(-1) : e.key === 'Enter' ? null : undefined;
    if (to === undefined) return;
    e.preventDefault();
    if (to) to.focus(); else list[i]?.click();
  };
  return (
    <div ref={ref} className="vc-ctxmenu" role="menu" style={{ left: x, top: y }} onKeyDown={onKeyDown} onContextMenu={(e) => e.preventDefault()}>
      {entries.map((en) => (
        <button key={en.id} type="button" role="menuitem" disabled={en.disabled} onClick={() => { onPick(en.id); onClose(); }}>{en.label}</button>
      ))}
    </div>
  );
}
