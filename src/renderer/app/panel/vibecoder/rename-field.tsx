/** rename-field — le petit champ de texte, sur place dans la liste des artefacts, pour renommer
 *  un élément ou nommer un nouveau fichier ou dossier. À l'ouverture, le nom est sélectionné sans
 *  son extension (jusqu'au dernier point, hors point initial). Chaque frappe est dite (onChange) ;
 *  `problem`, le message déjà traduit d'un nom impossible, passe l'encart en rouge et s'affiche
 *  dessous. Entrée valide (onDone) s'il n'y a pas de problème ; Échap (qui n'atteint pas les autres
 *  Échap) et la perte du focus annulent (onCancel), une seule fois.
 *  Ne connaît pas : les règles d'un nom (problem reçu), le pont. Utilisé par : artifact-tree-view. */
import { useRef, useState } from 'react';
import './rename-field.css';

type Props = { initial: string; problem: string | null; onChange(name: string): void; onDone(name: string): void; onCancel(): void };

export function RenameField({ initial, problem, onChange, onDone, onCancel }: Props) {
  const [name, setName] = useState(initial);
  const over = useRef(false); // fini (validé ou annulé) : la perte du focus qui suit ne compte plus
  const end = (f: () => void) => { if (!over.current) { over.current = true; f(); } };
  return (
    <span className="vc-rename">
      <input className="vc-rename-input" autoFocus value={name} aria-invalid={problem ? true : undefined} spellCheck={false}
        onFocus={(e) => { const dot = initial.lastIndexOf('.'); e.currentTarget.setSelectionRange(0, dot > 0 ? dot : initial.length); }}
        onChange={(e) => { setName(e.target.value); onChange(e.target.value); }}
        onBlur={() => end(onCancel)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(onCancel); }
          if (e.key === 'Enter') { e.preventDefault(); if (!problem) end(() => onDone(name)); }
        }} />
      {problem && <span className="vc-rename-problem" role="alert">{problem}</span>}
    </span>
  );
}
