/** kept — ce que l'écran VibeCoder tient pour un agent (réponses aux
 *  questions, champ de chaque étape, modèles choisis, verdict de la revue,
 *  étape choisie, et ce que chaque étape retient : fichier, pliage, onglet,
 *  défilement, vue — via scoped), gardé quand on passe à un autre agent et qu'on revient :
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

/** Ce qu'un agent garde pour une étape : la clé devient « <scope>:<key> »,
 *  donc ni un autre agent ni une autre étape ne la voient. */
export function scoped(kept: Kept, agent: string, scope: string) {
  return {
    get<T>(key: string, initial: T): T { return kept.get(agent, `${scope}:${key}`, initial); },
    set(key: string, value: unknown) { kept.set(agent, `${scope}:${key}`, value); },
  };
}
