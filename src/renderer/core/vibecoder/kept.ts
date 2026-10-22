/** kept — ce que l'écran VibeCoder tient pour un agent (réponses aux
 *  questions, champ de chaque étape, modèles choisis, verdict de la revue,
 *  étape choisie), gardé quand on passe à un autre agent et qu'on revient :
 *  le panneau recrée l'écran à chaque changement d'agent. En mémoire
 *  seulement, comme les brouillons de la conversation.
 *  Ne connaît pas : le DOM, le pont. Utilisé par : app/panel (panel-app,
 *  vibe-coder). */

export type Kept = ReturnType<typeof createKept>;

export function createKept() {
  const saved = new Map<string, Record<string, unknown>>();
  return {
    get<T>(agent: string, key: string, initial: T): T {
      const v = saved.get(agent)?.[key];
      return v === undefined ? initial : v as T;
    },
    set(agent: string, key: string, value: unknown) {
      saved.set(agent, { ...saved.get(agent), [key]: value });
    },
  };
}
