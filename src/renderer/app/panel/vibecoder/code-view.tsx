/** code-view — un code affiché comme dans un éditeur de texte : monospace,
 *  numéroté (à partir de `from`), coloré d'après l'extension de son fichier
 *  (codeLines, F-113), en morceaux de texte, jamais en HTML (I-40). Avec
 *  `edit` : une zone de saisie transparente sur le code coloré, Ctrl+S →
 *  onSave, grisée (en lecture) si `locked` (le motif, en titre). Avec
 *  `onQuote` : un clic sur une ligne ou une sélection, puis 💬 ou Retour →
 *  fixup citent ses lignes entières (codeBlock). Libellés : `t` (français
 *  par défaut).
 *  Ne connaît pas : le pont, le relevé.
 *  Utilisé par : invariants-view (Code, Voir le fichier), module-code (Voir le code). */
import { useMemo, useState, type ReactNode } from 'react';
import { codeBlock, codeLines, t as strings, type Strings } from 'core/vibecoder';

export type CodeEdit = { locked: string | null; onChange(text: string): void; onSave(): void };

export function CodeView({ code, path, from = 1, edit, onQuote, t = strings('fr') }: {
  code: string;
  path: string;
  from?: number;
  edit?: CodeEdit;
  onQuote?(block: string, id: 'comment' | 'fix'): void;
  t?: Strings;
}): ReactNode {
  const lines = useMemo(() => codeLines(code, path), [code, path]);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const colored = (
    <code>
      {lines.map((l, i) => (
        <span key={i} className="vc-sl" data-n={from + i}>
          {l.map((p, j) => (p.kind === 'text' ? p.text : <span key={j} className={`vc-cx-${p.kind}`}>{p.text}</span>))}
        </span>
      ))}
    </code>
  );
  if (!edit && !onQuote) return <pre className="vc-src scroll">{colored}</pre>;
  const locked = edit?.locked ?? null;
  const quote = (id: 'comment' | 'fix') => { if (sel) onQuote!(codeBlock(code, sel[0], sel[1]), id); };
  // La zone de saisie, transparente, sur le code coloré : elle donne le curseur, la sélection et la frappe.
  return (
    <>
      <pre className="vc-src scroll" data-locked={locked ? true : undefined}>
        <span className="vc-src-edit">
          {colored}
          <textarea value={code} readOnly={!edit || !!locked} title={locked ?? undefined} aria-label={path}
            spellCheck={false} wrap="off" rows={lines.length}
            onChange={(e) => edit?.onChange(e.target.value)}
            onSelect={(e) => setSel([e.currentTarget.selectionStart, e.currentTarget.selectionEnd])}
            onKeyDown={(e) => {
              if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
              e.preventDefault();
              if (edit && !locked) edit.onSave();
            }} />
        </span>
      </pre>
      {onQuote ? (
        <div className="vc-src-tools">
          <button type="button" className="vc-tool" title={t.quote} aria-label={t.quote} disabled={!sel} onClick={() => quote('comment')}>💬</button>
          <button type="button" className="vc-mini" title={t.fixTitle} disabled={!sel} onClick={() => quote('fix')}>{t.fix}</button>
        </div>
      ) : null}
    </>
  );
}
