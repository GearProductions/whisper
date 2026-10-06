/** text — un texte sur une ligne, espaces resserrés.
 *  Ne connaît pas : le métier. Utilisé par : core/agents. */

export const oneLine = (s: unknown) => String(s || '').replace(/\s+/g, ' ').trim();
