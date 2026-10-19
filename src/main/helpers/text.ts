/** text — un texte sur une ligne, espaces resserrés ; la fin d'un texte long.
 *  Ne connaît pas : le métier. Utilisé par : core/agents, core/vibecoder (note), app/controllers/conversation. */

export const oneLine = (s: unknown) => String(s || '').replace(/\s+/g, ' ').trim();

// Les `lines` dernières lignes (sans les sauts de ligne finaux), puis les
// `maxChars` derniers caractères.
export const tail = (text: string, lines: number, maxChars: number) =>
  text.replace(/\n+$/, '').split('\n').slice(-lines).join('\n').slice(-maxChars);
