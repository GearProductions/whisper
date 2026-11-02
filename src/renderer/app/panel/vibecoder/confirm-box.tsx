/** confirm-box — la petite boîte de confirmation dessinée dans le panneau (pas
 *  celle du système) : un message, les premiers éléments concernés (puis « … »),
 *  Confirmer et Annuler. Le focus est sur Annuler ; Échap, Annuler ou un clic à
 *  côté annulent : seul un clic sur Confirmer appelle onConfirm.
 *  Ne connaît pas : les artefacts, le pont (l'appelant tient la cible et les libellés).
 *  Utilisé par : artifacts-view. */
import './confirm-box.css';

const SHOWN = 5;

type Props = { message: string; items: string[]; confirm: string; cancel: string; onConfirm(): void; onCancel(): void };

export function ConfirmBox({ message, items, confirm, cancel, onConfirm, onCancel }: Props) {
  return (
    <div className="vc-confirm-back" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="vc-confirm" role="alertdialog" aria-modal="true" aria-label={message}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }}>
        <p className="vc-confirm-msg">{message}</p>
        {items.length > 0 && (
          <ul className="vc-confirm-items">
            {items.slice(0, SHOWN).map((it, i) => <li key={i}>{it}</li>)}
            {items.length > SHOWN && <li>…</li>}
          </ul>
        )}
        <div className="vc-confirm-foot">
          <button type="button" className="vc-run" data-tone="ghost" autoFocus onClick={onCancel}>{cancel}</button>
          <button type="button" className="vc-run" data-tone="accent" onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>
  );
}
