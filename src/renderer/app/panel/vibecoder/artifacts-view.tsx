/** artifacts-view — le panneau Artefacts (F-94, F-95) : à gauche la liste
 *  (nom, taille ; vide → ce que le skill fait, en une ligne) ; au centre
 *  l'artefact choisi : markdown → MarkdownView, text → CodeView en lecture
 *  seule (le texte reçu par `code`), « fichier tronqué » si truncated ; page →
 *  <iframe sandbox> (attribut vide : ni script, ni réseau) sur url ; media →
 *  <iframe> sur url ; en tête, Ouvrir dans l'éditeur (onOpen) et Copier dans
 *  le projet (onCopy) ; le choix, état local (le premier par défaut ; disparu
 *  → le premier), annoncé par onChoose (la page suit son texte).
 *  Ne connaît pas : le pont (rappels passés), le disque, le schéma (url reçue).
 *  Utilisé par : vibe-coder. */
import type { VibeArtifact, VibeCode, VibeLang } from 'technicals/bridge';

export type ArtifactsViewProps = {
  artifacts: VibeArtifact[];
  lang: VibeLang;
  code: VibeCode | null;          // le texte de l'artefact choisi (VibeCode de son id)
  onChoose: (id: string) => void;
  onOpen: (id: string) => void;
  onCopy: (id: string) => void;
};

// Squelette (note 0.13.0, Forme) : le composant s'écrit à son commit.
export function ArtifactsView(_props: ArtifactsViewProps): never {
  throw new Error('not implemented');
}
