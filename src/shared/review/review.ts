/** review — ce que le principal et la page lisent pareil d'une revue : les verdicts qu'on peut publier
 *  (VERDICTS, isVerdict) et le texte d'un brouillon (draftText : « - [cible] texte » par ligne). Une seule copie : la
 *  revue publiée n'est reconnue envoyée (reviewSent) que si les deux côtés écrivent le même texte.
 *  Ne connaît pas : Electron, le DOM, le pont. Utilisé par : main/core/vibecoder (actions, runs), main/technicals/direct,
 *  main/app/controllers/vibecoder, renderer/core/vibecoder (outputs, review-flow). */

export const VERDICTS = ['approve', 'comment', 'request-changes'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const isVerdict = (v: unknown): v is Verdict => VERDICTS.includes(v as Verdict);

export const draftText = (draft: readonly { target: string; text: string }[]): string =>
  draft.map((c) => `- [${c.target}] ${c.text}`).join('\n');
