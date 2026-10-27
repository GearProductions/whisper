/** vibe-banner — en tête du centre quand Vibe tourne : le texte vibeOn et le
 *  bouton Arrêter Vibe. Habillé par .vc-vibe-banner (vibecoder.css) et
 *  .vc-run (step-parts.css).
 *  Ne connaît pas : le pont (rappel passé), le relevé. Utilisé par : vibe-coder. */
import type { Strings } from 'core/vibecoder';

type Props = { t: Strings; onStop(): void };

export function VibeBanner({ t, onStop }: Props) {
  return (
    <div className="vc-vibe-banner" role="status">
      <span aria-hidden="true">⚡</span>{t.vibeOn}
      <span className="vc-spacer" />
      <button type="button" className="vc-run" data-tone="ghost" title={t.vibeStopTitle} onClick={onStop}>{t.vibeStop}</button>
    </div>
  );
}
