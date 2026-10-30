/** artifact-migration — le déplacement des anciens artefacts
 *  (vibecoder-out/<agent>/artifacts/) vers le dossier de leur projet, à chaque
 *  démarrage : ce qui reste part, sans drapeau. Ne rejette jamais ; un échec : au
 *  journal et showBubble(failedLine), le fichier reste et repart au démarrage suivant.
 *  Un id sans dossier : au journal, rien ne bouge. artifacts-left.json est lu ici, et
 *  supprimé quand plus aucune de ses entrées n'a de fichier.
 *  Ne connaît pas : la page, les menus, les boutons.
 *  Utilisé par : app/lifecycle. */

export async function moveLegacyArtifacts(): Promise<void> {
  throw new Error('not implemented');
}
