/** status-line — la ligne qui dit où en est le parcours du créateur (note 0.16.0-ecran-essentiel) : une seule phrase,
 *  dans la langue du relevé — ce que le système est en train de faire, ou ce qu'il attend de l'utilisateur.
 *  statusLine(view: VibeView): StatusLine | null
 *  Dans l'ordre, la première qui vaut : pas de note rédigée (« Demandez la note à l'agent, dans la conversation ») ;
 *  des questions ouvertes, à toute étape, le moteur en route ou pas (« 2 questions : répondez dans le questionnaire ») ;
 *  la note sans son ✓ (« Vérifiez, puis validez la note » ; déjà commitée, la pause 'note' : « La note a changé : elle
 *  attend sa validation ») ; un ✓ d'étape retiré à la main qui tient (la pause 'withdrawn:<étape>' : la ligne nomme
 *  l'étape) ; le moteur en route (« Le système écrit les modules » : d'après la course en cours, sinon l'étape en
 *  cours) ; une pause (« Regardez vos règles, puis reprenez », « Essayez l'appli, puis reprenez ») ; la PR ouverte
 *  (« La PR est ouverte, la CI tourne », la CI en échec, « La PR est verte : à vous de la fusionner », fusionnée) ;
 *  sinon le moteur arrêté hors d'une pause (« Le système est arrêté : reprenez »).
 *  yours : la ligne attend l'utilisateur (une question, la note, une pause, un ✓ retiré, la PR verte, le moteur
 *  arrêté) ; false : le système travaille. Le relecteur, ou un relevé en erreur : null (aucune ligne).
 *  Ne connaît pas : le DOM, React, le pont, le bouton du moteur (breadcrumb le pose à côté).
 *  Utilisé par : app/panel/vibecoder (breadcrumb). */
import type { VibeView } from 'technicals/bridge';

export type StatusLine = { text: string; yours: boolean };

export function statusLine(_view: VibeView): StatusLine | null {
  throw new Error('not implemented');
}
