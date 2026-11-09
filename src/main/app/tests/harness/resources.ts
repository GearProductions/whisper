// Les ressources livrées (resources/ : actions, skills, table des commandes), lues dans le dépôt, tout le
// reste de technicals/paths restant vrai.
// Ne connaît pas : le principal (il n'importe l'original que par vi.importActual, jamais en statique :
// le module est remplacé dans le test qui l'utilise).
// Utilisé par : le barrel (harness).
import path from 'node:path';
import { vi } from 'vitest';
import type * as Paths from 'technicals/paths';

export type PathsModule = typeof Paths;

// Le dossier du projet au chargement du décor : un cas qui change de dossier courant ne le déplace pas.
const CWD = process.cwd();

// `dir` : le dossier des ressources (le dépôt par défaut ; un cas peut donner un dossier d'essai).
export async function repoResources(dir: () => string = () => path.join(CWD, 'resources')): Promise<PathsModule> {
  const real = await vi.importActual<PathsModule>('technicals/paths');
  return { ...real, resourcePath: (name: string) => `${dir()}/${name}` };
}
