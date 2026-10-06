/** permissions — ce que « Toujours autoriser » accordera : parmi les
 *  suggestions de Claude Code, SEULEMENT des règles d'autorisation, et pour la
 *  session en cours (I-14). Une suggestion peut viser les réglages du projet ou
 *  de l'utilisateur (écrite sur le disque, elle survivrait à la session),
 *  changer de mode ou ouvrir d'autres dossiers : rien de cela ne doit passer
 *  par un bouton du panneau.
 *  Pur. Utilisé par : core/agents. */

export type SessionRule = { type: 'addRules'; behavior: 'allow'; rules: { toolName: string; ruleContent?: string }[]; destination: 'session' };

export function sessionRules(suggestions: unknown): SessionRule[] {
  return (Array.isArray(suggestions) ? suggestions : [])
    .filter((s) => s && s.type === 'addRules' && s.behavior === 'allow' && Array.isArray(s.rules) && s.rules.length)
    .map((s) => ({ type: 'addRules', behavior: 'allow', rules: s.rules, destination: 'session' }));
}

// « Bash(git status:*) », pour dire ce que la règle accorde.
export const describeRules = (rules: SessionRule[]) => rules.flatMap((u) => u.rules.map((x) => (x.ruleContent ? `${x.toolName}(${x.ruleContent})` : x.toolName)));
