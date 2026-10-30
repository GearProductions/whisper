/** artifact-mention — le « @ » du champ : tant qu'un mot commence par « @ », la
 *  liste des artefacts du projet qui correspondent (flèches, Entrée ou Tab
 *  choisit, Échap ferme, comme les commandes « / ») ; le choix met le chemin du
 *  fichier (le dossier des artefacts + son nom) à la place du « @… ».
 *  Aucune correspondance, ou pas de dossier : liste fermée, key rend false
 *  (« @types/node » se tape et part).
 *  Ne connaît pas : le pont, le disque. Utilisé par : step-parts, composer. */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { cycle, matchArtifacts, mentionQuery, pickArtifact } from 'core/conversation';
import type { VibeArtifact } from 'technicals/bridge';
import './artifact-mention.css';

type Open = { items: VibeArtifact[]; index: number };

// Le chemin que l'agent peut lire : le dossier, puis le nom, avec le séparateur du dossier.
function filePath(dir: string, name: string) {
  const sep = dir.includes('\\') ? '\\' : '/';
  return dir.replace(/[\\/]+$/, '') + sep + name.replace(/[\\/]/g, sep);
}

export function useArtifactMention(artifacts: VibeArtifact[], dir: string, input: RefObject<HTMLTextAreaElement | null>, setText: (text: string) => void) {
  const [open, setOpen] = useState<Open | null>(null);
  const caret = useRef<number | null>(null); // curseur à poser après un choix
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (caret.current !== null) { input.current?.setSelectionRange(caret.current, caret.current); caret.current = null; }
    box.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  });

  const close = () => setOpen(null);

  function show(index: number) {
    const el = input.current!;
    const q = mentionQuery(el.value, el.selectionStart);
    const items = q && dir ? matchArtifacts(artifacts, q.query) : [];
    if (!q || !items.length) { close(); return; }
    setOpen({ items, index: Math.min(index, items.length - 1) });
  }

  function pick(i: number) {
    const a = open?.items[i];
    const el = input.current!;
    const q = mentionQuery(el.value, el.selectionStart); // le curseur a pu bouger depuis la dernière frappe
    if (!a || !q) { close(); return; }
    const next = pickArtifact(el.value, el.selectionStart, q.start, filePath(dir, a.name));
    caret.current = next.caret;
    setText(next.value);
    el.focus();
    close();
  }

  // La liste ouverte prend les touches : true si elle a pris celle-ci.
  function key(e: KeyboardEvent) {
    if (!open) return false;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') show(cycle(open.index, e.key === 'ArrowDown' ? 1 : -1, open.items.length));
    else if (e.key === 'Enter' || e.key === 'Tab') pick(open.index);
    else return false;
    e.preventDefault();
    e.stopPropagation(); // Échap : ne ferme pas aussi l'historique ou le contexte
    return true;
  }

  const list: ReactNode = open ? (
    <div className="mention scroll" ref={box}>
      {open.items.map((a, i) => (
        <button key={a.id} type="button" className={`slash-item${i === open.index ? ' active' : ''}`} title={filePath(dir, a.name)}
          onMouseDown={(e) => { e.preventDefault(); pick(i); }}><span className="slash-name">{a.name}</span></button>
      ))}
    </div>
  ) : null;

  return { update: () => show(0), key, close, list };
}
