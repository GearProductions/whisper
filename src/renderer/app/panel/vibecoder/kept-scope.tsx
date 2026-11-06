/** kept-scope — un état de composant gardé pour l'agent et l'étape affichés :
 *  vibe-coder pose `<KeptScope.Provider value={scoped(kept, agent, étape)}>`,
 *  useKept y lit et y écrit ; le panneau recrée l'écran à chaque changement
 *  d'agent, la valeur revient. Hors d'un KeptScope : un état ordinaire.
 *  Ne connaît pas : le pont, les étapes (vibe-coder donne l'étape).
 *  Utilisé par : vibe-coder, ide-view, note-view, forme-view, modules-view,
 *  invariants-view. */
import { createContext, useContext, useEffect, useState } from 'react';
import type { scoped } from 'core/vibecoder';

export const KeptScope = createContext<ReturnType<typeof scoped> | null>(null);

export function useKept<T>(key: string, initial: T) {
  const scope = useContext(KeptScope);
  const [value, set] = useState<T>(() => scope ? scope.get(key, initial) : initial);
  useEffect(() => { scope?.set(key, value); }, [scope, key, value]);
  return [value, set] as const;
}
