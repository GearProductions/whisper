/** forme — le contrat d'un module de la Forme en rubriques (ce qu'il expose, « ne connaît pas »,
 *  « utilisé par »).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (forme-view). */

// Une rubrique : son libellé tel qu'écrit, suivi de « : » ; sans libellé, ce que le module expose ou fait.
const LABEL = /^(exposes?|ne conna[iî]t (?:pas|rien)(?: de)?|utilis[ée]e?s? par|used by|knows nothing(?: of| about)?|does(?:n't| not) know)\s*:\s*/i;

// Le contrat, coupé à ses « · » (expose · ne connaît pas · utilisé par).
export function contractParts(contract: string): { label: string | null; text: string }[] {
  return contract.split(/(?:^|\s+)·\s+/).map((s) => s.trim()).filter(Boolean).map((part) => {
    const m = LABEL.exec(part);
    return m ? { label: m[1], text: part.slice(m[0].length) } : { label: null, text: part };
  });
}
