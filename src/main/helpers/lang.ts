/** lang — français ou anglais ? (lecture à voix haute)

   Choisit le modèle et la voix qui liront le texte. Sans dépendance ni
   modèle : on compte les petits mots propres à chaque langue (articles,
   pronoms, auxiliaires…), les élisions (l', qu'…) et les accents pour le
   français, les contractions (n't, 're…) pour l'anglais.

   Des termes techniques anglais dans un texte français ne le font pas
   basculer : il reste lu en français, ce que la voix française fait bien.
   Ne connaît pas : les voix, Pocket TTS. Utilisé par : technicals/pocket-tts. */

// Les mots communs aux deux langues (« a », « on », « me », « as »…) sont écartés.
const WORDS = {
  fr: new Set(('le la les un une des du de et est sont pas ne pour que qui quoi dans sur avec ce cette ces '
    + 'il elle ils elles nous vous je tu au aux mais ou donc car être avoir fait plus très été son sa ses '
    + 'leur leurs mon ma mes ton ta tes notre votre lui comme tout tous aussi bien sans sous entre peut '
    + 'cela ça où quand alors déjà encore après avant chez vers').split(' ')),
  en: new Set(('the an and is are was were be been being to of for with that this these those it its you '
    + 'i we they he she not have has had do does did can will would should could from at by or but if '
    + 'there what which who whom your my our their them us his her than then when where why how just '
    + 'about into over also only some any all very').split(' ')),
};
const ELISION = /^(?:l|d|j|qu|n|c|s|m|t|jusqu|lorsqu|puisqu)['’]/;
const ACCENT = /[àâçéèêëîïôûùüÿœæ]/;
const CONTRACTION = /(?:n['’]t|['’](?:re|ve|ll|d|m))$/;

function score(sentence: string) {
  const s = { fr: 0, en: 0 };
  for (let word of sentence.toLowerCase().match(/[\p{L}'’]+/gu) || []) {
    if (ELISION.test(word)) { s.fr++; word = word.replace(ELISION, ''); }
    if (CONTRACTION.test(word)) s.en++;
    if (WORDS.fr.has(word)) s.fr++;
    if (WORDS.en.has(word)) s.en++;
    if (ACCENT.test(word)) s.fr++;
  }
  return s;
}

const winner = (s: { fr: number; en: number }) => (s.fr > s.en ? 'fr' : s.en > s.fr ? 'en' : null);

// Langue du texte parmi `langs` (celles qui ont une voix). Seuls le français
// et l'anglais sont reconnus ; indécis : le français s'il est là, sinon la
// première langue.
export function detectLanguage(text: string, langs: string[]): string {
  const lang = winner(score(text));
  if (lang && langs.includes(lang)) return lang;
  return langs.includes('fr') ? 'fr' : langs[0];
}

