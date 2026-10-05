/** PlayButton — le bouton de lecture à voix haute : actif, grisé ou en cours
 *  (■ pour arrêter). Grisé par aria-disabled et non `disabled` : un bouton
 *  désactivé ne reçoit plus le clic droit, et le menu doit rester accessible.
 *  Ne connaît pas : le pont. Utilisé par : IconApp. */
import { playView, type SpeechView } from './speech';

export function PlayButton({ view, onClick, onHover }: { view: SpeechView; onClick: () => void; onHover: () => void }) {
  const { disabled, title } = playView(view);
  return (
    <button id="play" className="small" type="button" data-phase={view.phase} aria-label="Lire à voix haute"
      aria-disabled={String(disabled) as 'true' | 'false'} title={title} onClick={onClick} onMouseEnter={onHover}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="i-play" d="M8 5.5v13l10.5-6.5z" />
        <rect className="i-stop" x="6.5" y="6.5" width="11" height="11" rx="1.5" />
      </svg>
    </button>
  );
}
