/** breadcrumb — le fil d'Ariane de l'écran Vibe : les étapes de Créer en une
 *  ligne (faite, en cours, à venir, d'après le relevé), sans clic.
 *  Ne connaît pas : le pont. Utilisé par : vibe-screen. */
import type { Strings } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';

export function Breadcrumb({ view, t }: { view: VibeView; t: Strings }) {
  return (
    <ol className="vc-crumbs" aria-label={t.breadcrumb}>
      {view.steps.map((s) => (
        <li key={s.id} data-status={s.status} aria-current={s.status === 'current' ? 'step' : undefined}
          title={`${t.steps[s.id]} — ${t.stepStatus[s.status]}${s.facts ? ` · ${s.facts}` : ''}`}>
          <span className="vc-tdot" />{t.steps[s.id]}
        </li>
      ))}
    </ol>
  );
}
