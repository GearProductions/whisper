/** forme — les modules de la Forme rangés pour l'écran : par premier dossier
 *  (main/…, renderer/…, shared/…, resources/… ; un src/ de tête ignoré ; un
 *  fichier à la racine : le groupe ''), leur contrat en rubriques (ce qu'il
 *  expose, « ne connaît pas », « utilisé par »).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (forme-view). */
import type { VibeModule } from 'technicals/bridge';

export type ModuleGroup = { folder: string; modules: VibeModule[] };

// Les groupes dans l'ordre de leur premier module, les modules dans celui de la Forme.
export function groupModules(modules: VibeModule[]): ModuleGroup[] {
  const groups: ModuleGroup[] = [];
  for (const m of modules) {
    const rest = m.path.replace(/^(?:\.\/)?(?:src\/)?/, '');
    const folder = rest.includes('/') ? rest.slice(0, rest.indexOf('/') + 1) : '';
    const g = groups.find((x) => x.folder === folder);
    if (g) g.modules.push(m);
    else groups.push({ folder, modules: [m] });
  }
  return groups;
}

// Une rubrique : son libellé tel qu'écrit, suivi de « : » ; sans libellé, ce que le module expose ou fait.
const LABEL = /^(exposes?|ne conna[iî]t (?:pas|rien)(?: de)?|utilis[ée]e?s? par|used by|knows nothing(?: of| about)?|does(?:n't| not) know)\s*:\s*/i;

// Le contrat, coupé à ses « · » (expose · ne connaît pas · utilisé par).
export function contractParts(contract: string): { label: string | null; text: string }[] {
  return contract.split(/(?:^|\s+)·\s+/).map((s) => s.trim()).filter(Boolean).map((part) => {
    const m = LABEL.exec(part);
    return m ? { label: m[1], text: part.slice(m[0].length) } : { label: null, text: part };
  });
}
