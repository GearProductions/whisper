/** accepted — ce qu'une réponse « Accepter » de la vérification de conception ajoute à la note validée
 *  (note 0.16.0-controle-en-trois-points) : la note garde son ✓ après un changement seulement si ce changement
 *  n'ajoute à la conception validée que le texte exact de réponses « Accepter » choisies par l'utilisateur.
 *  acceptedTexts(questions: VibeQuestion[], answers: string[]): string[] — les textes acceptés d'un envoi des
 *  réponses : pour chaque question, dans l'ordre, sa réponse si elle est, mot pour mot, une de ses réponses proposées
 *  dont le choix est « Accepter » (« Accept »), sans précision libre ; le texte entre « … » de cette réponse
 *  (`**Accepter** — *<où>* : « <texte> »`, skill conception). Une réponse libre, « Refuser », « Conseille-moi » : rien.
 *  onlyAccepted(validated: string, now: string, accepted: string[]): boolean — la conception d'aujourd'hui (now) est
 *  celle validée (validated) plus, à leur place, des textes de accepted, chacun entier et tel quel ; rien de retiré,
 *  rien d'autre d'ajouté (les blancs de fin de ligne et les lignes vides autour d'un ajout ne comptent pas).
 *  Identiques : vrai. accepted vide et un changement : faux.
 *  Pur. Ne connaît pas : le disque, les marques (marks : keepNote), le questionnaire de l'écran, qui envoie les réponses.
 *  Utilisé par : core/vibecoder (marks : keepNote), app/controllers/vibecoder (acceptedTexts, à l'envoi des réponses). */
import type { VibeQuestion } from 'shared/bridge';

export function acceptedTexts(_questions: VibeQuestion[], _answers: string[]): string[] {
  throw new Error('not implemented');
}

export function onlyAccepted(_validated: string, _now: string, _accepted: string[]): boolean {
  throw new Error('not implemented');
}
