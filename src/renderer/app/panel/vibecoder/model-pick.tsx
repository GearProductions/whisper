/** model-pick — les petits choix à côté du bouton d'une action : le modèle, si le skill
 *  fixe le sien (VibeAction.models), et l'effort, s'il laisse le choix (VibeAction.efforts).
 *  Fermé, la valeur ; ouvert, la liste (modèle : le conseillé marqué « conseillé » et choisi
 *  par défaut ; effort : « effort par défaut », puis les niveaux) ; le choix vaut pour cette
 *  action tant qu'on reste sur cet agent. Le contexte Picks (tenu par vibe-coder) le porte
 *  jusqu'aux boutons ; sans `efforts` / `pickEffort`, pas de choix d'effort ; rien pour une
 *  action qui tourne avec le modèle et l'effort de l'agent.
 *  Ne connaît pas : le pont. Utilisé par : vibe-coder, step-parts (Run). */
import { createContext, useContext } from 'react';
import { chosenEffort, chosenModel, t as strings, type EffortPicks, type ModelPicks } from 'core/vibecoder';
import type { VibeAction, VibeLang } from 'technicals/bridge';

export const Picks = createContext<{
  picks: ModelPicks; lang: VibeLang; pick(id: string, model: string): void;
  efforts?: EffortPicks; pickEffort?(id: string, effort: string): void;
} | null>(null);

// Fermé : la valeur (en accent si elle n'est pas celle par défaut) ; ouvert : la liste.
export function ModelPick({ a }: { a: VibeAction }) {
  const ctx = useContext(Picks);
  if (!ctx) return null;
  const t = strings(ctx.lang);
  const value = chosenModel(a, ctx.picks);
  const efforts = a.efforts?.length && ctx.efforts && ctx.pickEffort ? a.efforts : [];
  const effort = ctx.efforts ? chosenEffort(a, ctx.efforts) : '';
  const label = (e: string) => t.efforts.find(([v]) => v === e)?.[1] ?? e;
  return (
    <>
      {a.models.length ? (
        <label className="vc-model" title={t.pickTitle} data-other={value !== a.model || undefined}>
          <span aria-hidden="true">{value}</span>
          <select value={value} aria-label={t.pickTitle} onChange={(e) => ctx.pick(a.id, e.target.value)}>
            {a.models.map((m) => <option key={m} value={m}>{m === a.model ? t.recommended(m) : m}</option>)}
          </select>
        </label>
      ) : null}
      {efforts.length ? (
        <label className="vc-model" title={t.effortTitle} data-other={effort || undefined}>
          <span aria-hidden="true">{effort ? label(effort) : t.effortDefault}</span>
          <select value={effort} aria-label={t.effortTitle} onChange={(e) => ctx.pickEffort?.(a.id, e.target.value)}>
            <option value="">{t.effortDefault}</option>
            {efforts.map((e) => <option key={e} value={e}>{label(e)}</option>)}
          </select>
        </label>
      ) : null}
    </>
  );
}
