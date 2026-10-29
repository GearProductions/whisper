/** model-pick — le petit choix du modèle, à côté du bouton d'une action dont
 *  le skill fixe son modèle (VibeAction.models) : fermé, le nom du modèle ; ouvert, la
 *  liste, le conseillé marqué « conseillé » et choisi par défaut ; le choix vaut pour cette action tant qu'on reste sur cet agent.
 *  Le contexte Picks (tenu par vibe-coder) le porte jusqu'aux boutons ; rien
 *  pour une action qui tourne avec le modèle de l'agent.
 *  Ne connaît pas : le pont. Utilisé par : vibe-coder, step-parts (Run). */
import { createContext, useContext } from 'react';
import { chosenModel, t as strings, type ModelPicks } from 'core/vibecoder';
import type { VibeAction, VibeLang } from 'technicals/bridge';

export const Picks = createContext<{ picks: ModelPicks; lang: VibeLang; pick(id: string, model: string): void } | null>(null);

// Fermé : le nom du modèle (en accent s'il n'est pas le conseillé) ; ouvert : la liste, le conseillé marqué.
export function ModelPick({ a }: { a: VibeAction }) {
  const ctx = useContext(Picks);
  if (!ctx || !a.models.length) return null;
  const t = strings(ctx.lang);
  const value = chosenModel(a, ctx.picks);
  return (
    <label className="vc-model" title={t.pickTitle} data-other={value !== a.model || undefined}>
      <span aria-hidden="true">{value}</span>
      <select value={value} aria-label={t.pickTitle} onChange={(e) => ctx.pick(a.id, e.target.value)}>
        {a.models.map((m) => <option key={m} value={m}>{m === a.model ? t.recommended(m) : m}</option>)}
      </select>
    </label>
  );
}
