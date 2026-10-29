/** artifacts — les artefacts de l'agent (vibecoder-out/<agent>/artifacts/) :
 *  listArtifacts (le relevé), artifactFile (l'agent affiché, l'id dans son
 *  dernier relevé, safePath sous artifacts/ — I-37), resolveArtifact (pour
 *  serveFiles, le schéma vibe-artifact : <agent>/a<i>, une page ou un media
 *  seulement), copyArtifact (au clic, dans le dossier choisi dans la boîte de
 *  dialogue ; un fichier du même nom remplacé seulement après Remplacer —
 *  I-39).
 *  Ne connaît pas : la page (ses canaux), les libellés de l'écran.
 *  Utilisé par : controllers/vibecoder (survey, openVibeItem, runDirect),
 *  controllers/module-code, app/lifecycle. */
import type { Served } from 'technicals/file-scheme';

// Squelette (note 0.13.0, Forme) : le module s'écrit à son commit.
export function resolveArtifact(_url: URL): Served | null {
  throw new Error('not implemented');
}
