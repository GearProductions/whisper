// Le résumé du banc de contrat, pur : la table (resources/vibecoder/
// commands.json, ses commandes et ses codes d'erreur) contre ce que les cas ont
// couvert (bench.mjs tally). coverage → les lignes du résumé (« n commandes
// couvertes sur 55 », puis chaque commande sans cas, nommée, puis les codes
// que l'appli rend mais que le banc n'atteint pas, chacun avec sa raison
// (UNREACHED : halted, changing, worktree, failed, bad-token), puis tout autre
// code d'erreur jamais rendu) et missing : les commandes sans aucun cas ; une
// seule fait échouer le banc.
// Ne connaît pas : l'appli, la CLI, le disque (la table est passée).
// Utilisé par : tests/contract/run.mjs.

/** Les codes rendus par l'appli hors d'atteinte du banc, et pourquoi. */
export const UNREACHED = {
  halted: "rendu après l'arrêt de Vibe, à l'écran seulement",
  changing: "il faudrait une course qui écrit et une action qui lit en même temps",
  worktree: "le banc n'a pas de worktree (la fenêtre de confiance)",
  failed: "il faudrait une panne (opération qui lève, disque en échec)",
  'bad-token': "rendu par le socket ; la CLI n'envoie rien sans jeton",
};

/**
 * @param {{ commands: { name: string }[]; errors: { code: string }[] }} table
 * @param {{ covered: Map<string, number>; codes: Set<string> }} seen
 * @returns {{ lines: string[]; missing: string[]; uncoveredCodes: string[] }}
 */
export function coverage(table, seen) {
  const missing = table.commands.map((c) => c.name).filter((n) => !seen.covered.get(n));
  const uncoveredCodes = table.errors.map((e) => e.code).filter((c) => !seen.codes.has(c));
  const total = table.commands.length;
  const lines = [`${total - missing.length} commandes couvertes sur ${total}`];
  for (const name of missing) lines.push(`  sans cas : ${name}`);
  for (const code of uncoveredCodes.filter((c) => c in UNREACHED)) {
    lines.push(`  hors d'atteinte du banc : ${code} (${UNREACHED[code]})`);
  }
  const others = uncoveredCodes.filter((c) => !(c in UNREACHED));
  if (others.length) lines.push(`codes d'erreur jamais rendus : ${others.join(', ')}`);
  return { lines, missing, uncoveredCodes };
}
