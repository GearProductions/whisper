/** prompt-field — le seul composant de saisie d'un champ où l'on écrit à un agent : le cadre .vc-prompt,
 *  Joindre (📎) au début, les pièces jointes (libellé, ×), la zone de texte (coller ou déposer des images
 *  ou fichiers → onFiles), la paire de prompt-tools à la fin (sans onSend : le micro seul, pas d'Envoyer). `children` : au-dessus du cadre, les menus
 *  « / » et « @ » du caller. Il montre et rapporte : le texte et les pièces viennent du caller, qui
 *  transforme les File en pièces (onFiles), gère les touches (onKeyDown) et ses menus. `field` : la zone
 *  de texte du caller (sinon la sienne) ; `ids` : les id #attach, #message, #mic, #send (le champ de la
 *  conversation). Le dépôt est pris ici (data-own-drop : panel-app ne le joint pas aussi). La zone grandit avec son texte, jusqu'à MAX_HEIGHT.
 *  Une image jointe s'agrandit d'un clic (Zoom, fourni par la page).
 *  Ne connaît pas : le pont, le micro, l'agent. Utilisé par : components (composer),
 *  comment-box, questions-view. */
import { createContext, useContext, useLayoutEffect, useRef, type ClipboardEvent, type DragEvent, type FocusEventHandler, type KeyboardEventHandler, type ReactNode, type RefObject } from 'react';
import { pieceLabel, pieceTitle, type Piece } from 'core/conversation';
import type { Strings } from 'core/vibecoder';
import { Icon } from './icons';
import { PromptTools } from './prompt-tools';
import './prompt-field.css';

const MAX_HEIGHT = 160;

// Agrandir une image jointe pas encore envoyée, comme une image d'un message (la page la montre en grand) ;
// sans fournisseur, l'image ne se clique pas.
export const Zoom = createContext<((src: string) => void) | null>(null);

type Props = {
  t: Strings; text: string; setText(text: string): void;
  // Les pièces jointes : seulement si l'appelant en tient (sans onAttach, pas de 📎 ; sans onFiles, coller et déposer restent du texte).
  pieces?: Piece[]; onRemove?(p: Piece): void; onAttach?(): void; onFiles?(files: File[]): void;
  onSend?(): void; sendDisabled?: boolean; sendTitle?: string;
  field?: RefObject<HTMLTextAreaElement | null>; ids?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  children?: ReactNode;
  // La zone de texte : son invite, ses lignes, sa sortie (le caller ferme ses menus).
  placeholder?: string; rows?: number; onBlur?: FocusEventHandler<HTMLTextAreaElement>;
};

const filesOf = (e: ClipboardEvent | DragEvent) => [...((e as ClipboardEvent).clipboardData ?? (e as DragEvent).dataTransfer)?.files ?? []];

export function PromptField({
  t, text, setText, pieces = [], onRemove, onAttach, onFiles, onSend, sendDisabled, sendTitle, field, ids, onKeyDown, children,
  placeholder, rows = 1, onBlur,
}: Props) {
  const zoom = useContext(Zoom);
  const own = useRef<HTMLTextAreaElement>(null);
  const area = field ?? own;
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'; // pas de barre pour rien
  }, [text]);

  // Du texte collé va dans le champ ; des images ou fichiers, en pièces jointes.
  const take = (e: ClipboardEvent | DragEvent) => {
    const files = filesOf(e);
    if (!files.length || !onFiles) return;
    e.preventDefault();
    onFiles(files);
  };

  return (
    <>
      {children}
      <div className="vc-prompt" data-own-drop={onFiles ? true : undefined} onDragOver={(e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); }} onDrop={take}>
        {onAttach ? (
          <button id={ids ? 'attach' : undefined} type="button" className="vc-attach" onClick={onAttach} aria-label={t.attach} title={t.attachTitle}>
            <Icon name="attach" />
          </button>
        ) : null}
        <div className="vc-prompt-body">
          {pieces.length ? (
            <div className="vc-pieces">
              {pieces.map((piece, i) => (
                <div key={i} className="piece" title={pieceTitle(piece)}>
                  {piece.kind === 'image' ? <img src={piece.url} alt="" data-zoom={zoom ? '' : undefined} title={zoom ? t.zoom : undefined} onClick={zoom ? () => zoom(piece.url) : undefined} /> : null}
                  <span>{pieceLabel(piece)}</span>
                  <button type="button" className="remove" title={t.removePiece} aria-label={t.removePiece} onClick={() => onRemove?.(piece)}>×</button>
                </div>
              ))}
            </div>
          ) : null}
          <textarea id={ids ? 'message' : undefined} className="scroll" ref={area} rows={rows} value={text}
            placeholder={placeholder} aria-label={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
            onPaste={take} onBlur={onBlur} />
        </div>
        <PromptTools t={t} field={area} ids={ids} onSend={onSend} sendDisabled={sendDisabled} sendTitle={sendTitle} />
      </div>
    </>
  );
}
