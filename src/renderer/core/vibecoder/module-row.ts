/** module-row — un chemin en nom et dossier (un module de la Forme, un fichier
 *  du relevé) ; les commits de la branche qui touchent un module (le dernier
 *  est celui dont on relit le diff).
 *  Ne connaît pas : le DOM, React.
 *  Utilisé par : app/panel/vibecoder (modules-view, forme-view, note-view, invariants-view). */
import type { VibeCommit, VibeModule } from 'technicals/bridge';

// « main/core/x.ts » → dossier « main/core/ », nom « x.ts » ; un dossier garde son « / ».
export function fileParts(path: string): { dir: string; name: string } {
  const p = path.trim();
  const i = p.replace(/\/+$/, '').lastIndexOf('/');
  return { dir: p.slice(0, i + 1), name: p.slice(i + 1) };
}

// Les commits du relevé (le plus ancien d'abord) que désignent les hash du
// module, dans cet ordre ; un hash inconnu du relevé est ignoré.
export function moduleCommits(m: VibeModule, commits: VibeCommit[]): VibeCommit[] {
  return commits.filter((c) => m.commits.includes(c.hash));
}
