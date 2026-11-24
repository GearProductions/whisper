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

// `**Accepter** — *<où>* : « <texte> »` : le texte va du premier « au dernier » (il peut contenir des « »).
const ACCEPT = /^\*\*Accept(?:er)?\*\*[^«]*«\s*([\s\S]*?)\s*»$/;

export function acceptedTexts(questions: VibeQuestion[], answers: string[]): string[] {
  const texts: string[] = [];
  questions.forEach((question, i) => {
    const answer = answers[i];
    if (answer === undefined || !question.options.includes(answer)) return;
    const text = ACCEPT.exec(answer)?.[1];
    if (text) texts.push(text);
  });
  return texts;
}

// Un texte accepté s'ajoute en lignes entières, une ligne chacun ; une ligne vide de plus ne passe que collée à un
// ajout (juste après, ou juste avant) : retirer ou ajouter un saut de paragraphe ailleurs change la conception.
const lines = (text: string) => text.trim().split('\n').map((line) => line.trimEnd());

export function onlyAccepted(validated: string, now: string, accepted: string[]): boolean {
  const kept = lines(validated);
  const got = lines(now);
  const free = accepted.map((text) => text.trim());
  let i = 0;
  let added = false;
  for (const [k, line] of got.entries()) {
    if (line === kept[i]) { i++; added = false; }
    else if (free.includes(line)) { free.splice(free.indexOf(line), 1); added = true; }
    else if (line !== '' || !(added || free.includes(got[k + 1]))) return false;
  }
  return i === kept.length;
}
