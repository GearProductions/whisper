/** note — la note du ticket lue par ses titres, sans modèle : son titre, si
 *  « Ce que ça fait » est rédigée, ses rubriques, les lignes de « Ce que ça ne
 *  doit pas faire » et leur marque (→ invariant, variant…), les modules de la
 *  « Forme » et leur contrat. Et où la trouver : la clé que porte la branche
 *  (ticket ou version), le fichier de docs/tickets/ qui la nomme parmi ceux
 *  que la branche change.
 *  Les questions ouvertes ne sont pas dans la note (<sorties>/questions.md).
 *  Ne connaît pas : Electron, le disque, git (texte et chemins passés).
 *  Utilisé par : core/vibecoder (journey : parseNote), app/controllers/vibecoder
 *  (noteKey, findNote, parseNote). */
import type { MustNotMark } from 'shared/bridge';
import { oneLine } from 'helpers';

export type NoteFacts = {
  title: string;
  filled: boolean;                                      // « Ce que ça fait » est rédigée
  sections: { name: string; text: string }[];
  mustNot: { text: string; mark: MustNotMark }[];       // « Ce que ça ne doit pas faire »
  modules: { path: string; contract: string }[];        // la Forme : chemin, expose · ne connaît pas · utilisé par
  forme: string;
};

// Les rubriques, reconnues au début de leur titre (casse, accents et apostrophes ignorés), en français et en anglais.
const DOES = /^(ce que ca fait|what it does)/;
const MUST_NOT = /^(ce que ca ne doit|what it (must|should)(n't| not| never))/;
const FORME = /^(forme|shape|form)\b/;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[’`]/g, '\'');

const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/;
const placeholder = (s: string) => /^\(.*\)$/.test(s);

export function parseNote(md: string): NoteFacts {
  let title = '';
  const sections: { name: string; text: string }[] = [];
  let fence = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = fence ? null : /^(#{1,2})\s+(.*?)\s*$/.exec(line);
    if (h && h[1] === '##') sections.push({ name: h[2], text: '' });
    else if (h && !title) title = h[2];
    else if (sections.length) sections[sections.length - 1].text += `${line}\n`;
  }
  for (const s of sections) s.text = s.text.replace(/^\s*\n|\s+$/g, '');
  const find = (re: RegExp) => sections.find((s) => re.test(norm(s.name)));
  const does = find(DOES)?.text ?? '';
  const forme = find(FORME)?.text ?? '';
  return {
    title,
    filled: does.split('\n').map((l) => l.replace(BULLET, '').trim()).some((l) => l && !placeholder(l)),
    sections,
    mustNot: items(find(MUST_NOT)?.text ?? '').filter((t) => !placeholder(t)).map((text) => ({ text, mark: markOf(text) })),
    modules: modulesOf(forme),
    forme,
  };
}

// Les éléments d'une liste, leurs lignes de suite jointes ; le texte avant la première puce est ignoré.
function items(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    if (BULLET.test(line)) out.push(line.replace(BULLET, ''));
    else if (line.trim() && out.length) out[out.length - 1] += ` ${line.trim()}`;
  }
  return out.map(oneLine);
}

// La marque d'une ligne : le premier mot connu après sa dernière flèche (« → variant suffit, structure »
// → variant), sinon dans un préfixe entre crochets ou parenthèses (« [structure] … », « (review, sans test) … »).
function markOf(text: string): MustNotMark {
  const arrow = Math.max(text.lastIndexOf('→'), text.lastIndexOf('->'));
  const where = arrow >= 0 ? text.slice(arrow) : /^[[(]([^\])]*)[\])]/.exec(text)?.[1] ?? '';
  return (/\b(invariant|variant|review|structure)/i.exec(where)?.[1].toLowerCase() as MustNotMark) ?? null;
}

// Un chemin : un `/` ou une extension, pas un gabarit (<chemin>).
const isPath = (t: string) => /\w/.test(t) && !/[<>]/.test(t) && (t.includes('/') || /\.\w+$/.test(t));
// Une ligne qui commence par un chemin (puce et accents graves ôtés), suivi d'un blanc ou de la fin : chemin, blanc, reste.
const LINE = /^\s*(?:[-*+]\s+)?`?([^\s`]*[\w/])`?(?=\s|$)(\s*)(.*)$/;
// Un titre de module : son premier mot, ponctuation finale ôtée ; le reste du titre ouvre le contrat.
const HEADING = /^`?([^\s`]*[\w/])`?[,;:]?(\s*)(.*)$/;

type Mod = { path: string; parts: string[]; sep: string; col: number };

// Les modules de la Forme, sous deux formes :
//  - `### chemin` puis ses lignes (Expose, Ne connaît pas, Utilisé par), jointes par « · » ; un `###`
//    qui finit par `/` est un dossier, dont les `####` (un nom suffit) sont les modules ;
//  - des lignes (bloc de code, liste, texte) qui commencent par un chemin : le reste de la ligne et ses
//    lignes de suite, plus indentées, forment le contrat ; sous un chemin qui finit par `/`, une ligne
//    moins indentée que son contrat, « fichier␣␣contrat » ou « fichier » seul, est un module de ce dossier.
// Un dossier qui a des modules n'en est plus un lui-même.
function modulesOf(forme: string): { path: string; contract: string }[] {
  const mods: Mod[] = [];
  let cur: Mod | null = null;
  let group: Mod | null = null;      // le dossier dont les lignes suivantes peuvent être des modules
  let heading = false;               // cur vient d'un titre : toutes les lignes jusqu'au suivant sont son contrat
  // Un module (dans `dir`, qui cesse alors d'en être un) ; son contrat commence par `first`, à la colonne `col`.
  const add = (dir: Mod | null, path: string, first: string, sep: string, col = Infinity): Mod => {
    if (dir && mods.includes(dir)) mods.splice(mods.indexOf(dir), 1);
    const mod = { path: (dir?.path ?? '') + path, parts: [first.replace(/^[:—–-]\s*/, '')].filter(Boolean), sep, col };
    mods.push(mod);
    return mod;
  };
  for (const line of forme.split('\n')) {
    if (!line.trim() || /^\s*(```|~~~)/.test(line)) continue;
    const h = /^(#{3,4})\s+(.*)$/.exec(line);
    if (h) {
      const top = h[1] === '###';
      const m = HEADING.exec(h[2].trim());
      // Sous un dossier, un #### nomme un module même sans `/` ni extension (save-glb).
      const path: string | null = m && (isPath(m[1]) || (!top && group)) ? m[1] : null;
      cur = path ? add(top ? null : group, path, m![3], ' · ') : null;
      if (top) group = path?.endsWith('/') ? cur : null;
      heading = !!cur;
      continue;
    }
    const text = line.trim().replace(/^[-*+]\s+/, '');
    const m = LINE.exec(line);
    const path = m && isPath(m[1]) ? m[1] : null;
    const indent = line.length - line.trimStart().length;
    if (heading) cur?.parts.push(text);
    else if (!indent) {
      cur = path ? add(null, path, m![3], ' ', m![3] ? line.length - m![3].length : Infinity) : null;
      group = path?.endsWith('/') ? cur : null;
    } else if (group && path && indent < group.col && (m![2].length >= 2 || !m![3])) cur = add(group, path, m![3], ' ');
    else cur?.parts.push(text);
  }
  return mods.map((m) => ({ path: m.path, contract: m.parts.join(m.sep) }));
}

// La clé de la note d'après la branche : un ticket (G2-6675, WT-14), sinon une
// version qu'elle porte (0.8.0), sinon `version` ; null sans rien de tout ça.
export function noteKey(branch: string, version: string | null): string | null {
  return /(?<![A-Za-z0-9])[A-Z][A-Z0-9]+-\d+(?![A-Za-z0-9])/.exec(branch)?.[0]
    ?? /(?<![\d.])\d+\.\d+\.\d+(?![\d])/.exec(branch)?.[0]
    ?? (version || null);
}

// Le premier .md sous docs/tickets/ (dans l'ordre des chemins) dont le nom
// contient `key` en mot entier, sans tenir compte de la casse ; null si aucun.
// `paths` : les fichiers que la branche change (la note du ticket en est).
export function findNote(paths: string[], key: string): string | null {
  const word = new RegExp(`(?<![A-Za-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'i');
  return [...paths].sort().find((p) => /(^|\/)docs\/tickets\/.*\.md$/i.test(p) && word.test(p.slice(p.lastIndexOf('/') + 1))) ?? null;
}
