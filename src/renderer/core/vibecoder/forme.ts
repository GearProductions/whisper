/** forme — le contrat d'un module de la Forme en rubriques (ce qu'il expose, « ne connaît pas »,
 *  « utilisé par », « variants »), une par « · » ou par ligne ; un cas « - … » en élément de liste.
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : ce que fait un module en une phrase, pour la liste de la Forme.
 *  moduleLine(contract: string): string — le début du contrat, ce que le module expose ou fait : sa première ligne,
 *  coupée au premier « · » et avant toute rubrique (« ne connaît pas : », « utilisé par : », « variants : ») ; un
 *  contrat vide, ou qui commence par une rubrique : ''.
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (forme-view). */

// Une rubrique : son libellé tel qu'écrit, suivi de « : » ; sans libellé, ce que le module expose ou fait.
const LABEL = /^(variants?|exposes?|ne conna[iî]t (?:pas|rien)(?: de)?|utilis[ée]e?s? par|used by|knows nothing(?: of| about)?|does(?:n't| not) know)\s*:\s*/i;

// Le contrat, coupé à ses lignes (une Forme aérée) et à ses « · » (expose · ne connaît pas · utilisé par) ; une
// ligne « - … » (un cas des variants) : un élément de liste (item). Une ligne qui n'ouvre aucune rubrique
// (« · », « - », « libellé : ») continue la phrase d'avant : une Forme ancienne coupe ses phrases sur plusieurs
// lignes. Le principal garde les lignes du bloc telles quelles ; cette liste est la seule à dire laquelle ouvre.
export function contractParts(contract: string): { label: string | null; text: string; item?: true }[] {
  const lines = contract.split('\n').map((l) => l.trim()).filter(Boolean)
    .reduce<string[]>((all, l) => (all.length && !/^(?:·|- )/.test(l) && !LABEL.test(l) ? [...all.slice(0, -1), `${all.at(-1)} ${l}`] : [...all, l]), []);
  return lines.flatMap((l) => l.split(/(?:^|\s+)·\s+/)).map((s) => s.trim().replace(/^·\s*/, '')).filter(Boolean).map((part) => {
    if (part.startsWith('- ')) return { label: null, text: part.slice(2).trim(), item: true as const };
    const m = LABEL.exec(part);
    return m ? { label: m[1], text: part.slice(m[0].length) } : { label: null, text: part };
  });
}

// Ce que fait un module, en une phrase : le début de son contrat (voir l'en-tête).
export function moduleLine(contract: string): string {
  const first = contract.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const line = first.replace(/^·\s*/, '').split(/\s+·\s+/)[0].trim();
  return LABEL.test(line) ? '' : line;
}
