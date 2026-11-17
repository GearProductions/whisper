/** invariants — les tests d'invariants tels que la vue les montre : chaque cas
 *  avec sa clé (caseKeys de shared/test-cases : un titre en double, son numéro d'ordre), sa lecture en pseudo-code
 *  (par sa clé parmi les cas lus, sinon à son rang), sa lecture périmée ou non (staleCases), et sa
 *  validation (par sa clé ; common : « changed » parce que le code commun du fichier a changé, commonChanged), sa ligne dans le fichier et son code d'origine, les lignes de son bloc (caseRange) et le
 *  fichier dont seul ce bloc est remplacé (replaceRange) ; ce qui est validé, refusé, à lire, avec un point d'attention,
 *  et si « Tout valider » est permis (lu ou pas : la lecture n'est qu'une aide) ; le pseudo-code ligne à ligne, coloré,
 *  ses assertions et ses « given / when / then » repérés — en tête de ligne
 *  (`test "…":`, la forme des lectures) ou en commentaire (`it(…)`, l'ancienne) ;
 *  le point d'attention d'un cas, versé en un clic : cité dans le champ de la
 *  conversation (attentionQuote, comme on cite la note : du texte, sans `>`),
 *  ou ajouté à la zone de commentaire sans rien effacer (withAttention) ; la ligne « → invariant » de
 *  la note que garde un cas, d'après la seule phrase Garantit de sa lecture (caseLink).
 *  Ne connaît pas : le DOM, React, la spécification du projet (un I-… n'est qu'un numéro).
 *  Utilisé par : app/panel/vibecoder (invariants-view). */
import type { ReadingCase, VibeMarkState, VibeNote, VibeTestFile } from 'technicals/bridge';
import { caseKeys } from 'shared/test-cases';
import { tokens, type Token } from './highlight';

// key : la clé du cas (sa cible : « case:<chemin>:<clé> ») ; stale : sa lecture est périmée ; common : sa validation est
// tombée parce que le code commun du fichier a changé (absents : non ; note 0.15.0-invariants-par-cas).
export type CaseView = { title: string; key?: string; reading: ReadingCase | null; stale?: boolean; mark: VibeMarkState; common?: boolean };

// Les cas du fichier (leurs clés : les validations s'y rattachent) ; la lecture d'un cas est celle de même clé parmi les
// cas lus (caseKeys de leurs titres), sinon celle de même rang si la lecture a autant de cas et que celle-ci ne porte
// le titre d'aucun autre.
export function casesOf(file: VibeTestFile): CaseView[] {
  const r = file.reading;
  const keys = caseKeys(file.cases), readKeys = r ? caseKeys(r.map((c) => c.title)) : [];
  return file.cases.map((title, i) => {
    const key = keys[i], at = readKeys.indexOf(key);
    return {
      title, key,
      reading: !r ? null : r[at] ?? (r.length === file.cases.length && !file.cases.includes(r[i].title) ? r[i] : null),
      stale: file.staleCases?.includes(key) || undefined,
      mark: Object.hasOwn(file.marks, key) ? file.marks[key] : null,
      common: file.commonChanged?.includes(key) || undefined,
    };
  });
}

// Le code d'origine du cas de rang i : de sa ligne à celle du cas suivant (ou à
// la fin du fichier), sans les lignes vides de la fin ; texte ou ligne inconnus : ''.
export function caseSource(file: VibeTestFile, i: number): string {
  const range = caseRange(file, i);
  return range ? file.source.split('\n').slice(range.from - 1, range.to).join('\n').trimEnd() : '';
}

// Les lignes (1…, bornes comprises) du bloc du cas de rang i dans file.source, celles que caseSource rend : de la
// ligne du cas à celle d'avant le suivant (ou à la fin du fichier), sans les lignes vides de la fin, mais au moins la
// première ; texte ou ligne inconnus : null (note 0.15.0-ecran-statuts : l'éditeur d'un cas ne montre que ce bloc).
export type CaseRange = { from: number; to: number };
export function caseRange(file: VibeTestFile, i: number): CaseRange | null {
  const from = file.lines[i];
  if (!file.source || !Number.isInteger(from) || from < 1) return null;
  const next = file.lines[i + 1];
  const lines = file.source.split('\n').slice(0, Number.isInteger(next) && next > from ? next - 1 : undefined);
  let to = lines.length;
  while (to > from && !lines[to - 1].trim()) to--;
  return { from, to };
}

// `text` dont les lignes range.from à range.to sont remplacées par `block` ; toute autre ligne, et les fins de ligne
// du fichier, identiques (le bloc, donné en \n ou en \r\n, prend la fin de ligne de la première ligne remplacée, sa dernière ligne celle de la dernière) ;
// une plage hors du texte ou renversée : null.
export function replaceRange(text: string, range: CaseRange, block: string): string | null {
  const { from, to } = range;
  const lines = text.split('\n');
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > lines.length) return null;
  const eol = (line: string) => (line.endsWith('\r') ? '\r' : '');
  const first = eol(lines[from - 1]), last = eol(lines[to - 1]);   // la dernière ligne du fichier n'a pas de fin de ligne
  lines.splice(from - 1, to - from + 1, ...(block ? block.split(/\r?\n/).map((l, i, all) => l + (i === all.length - 1 ? last : first)) : []));
  return lines.join('\n');
}

export type Progress = {
  total: number; ok: number; ko: number; changed: number;
  warnings: number;            // cas lus avec un point d'attention
  unread: number;              // cas sans lecture, ou à lecture périmée
  all: boolean;                // « Tout valider » : aucun point d'attention, un cas au moins sans verdict, lus ou pas
};

export function progress(files: VibeTestFile[]): Progress {
  // une lecture périmée n'est pas lue (comme côté principal), cas par cas
  const cases = files.flatMap(casesOf);
  const count = (f: (c: CaseView) => boolean) => cases.filter(f).length;
  const p = {
    total: cases.length, ok: count((c) => c.mark === 'ok'), ko: count((c) => c.mark === 'ko'),
    changed: count((c) => c.mark === 'changed'), warnings: count((c) => !!c.reading?.warning), unread: count((c) => !c.reading || !!c.stale),
  };
  return { ...p, all: !p.warnings && p.ok + p.ko < p.total };
}

export type PseudoPart = { kind: Token['kind'] | 'step'; text: string };   // step : « étant donné », « quand », « alors »
export type PseudoLine = { parts: PseudoPart[]; assert: boolean };          // assert : expect…, ou une ligne then (et ses and / but)

const STEP = /^(\/\/\s*)((?:étant donnée?s?|quand|alors|given|when|then)(?=[\s:]|$)(?:\s*:)?)/iu;
const ASSERT = /^\s*(?:await\s+)?expect\b/;
const LEAD = /^(\s*)(test|given|when|then|and|but)\b/i;   // le mot qui ouvre une ligne de la forme `test "…":`
const PROSE = /^\s*test\s+"[^\n]*:\s*$/m;                 // un cas `test "…":` (sinon l'ancienne forme, it(…) { … })

// Le pseudo-code en lignes de morceaux colorés (tokens), bout à bout le code tel quel.
export function pseudoLines(code: string): PseudoLine[] {
  const lines: PseudoPart[][] = [[]];
  for (const tok of tokens(code)) {
    tok.text.split('\n').forEach((text, i) => {
      if (i) lines.push([]);
      const line = lines[lines.length - 1];
      const m = tok.kind === 'comment' ? STEP.exec(text) : null;
      if (m) line.push({ kind: 'comment', text: m[1] }, { kind: 'step', text: m[2] }, { kind: 'comment', text: text.slice(m[0].length) });
      else line.push({ kind: tok.kind, text });
    });
  }
  // La forme `test "…":` est de la prose : ses mots ne sont pas des mots-clés (of, in, it…), sauf celui qui ouvre la ligne.
  const prose = PROSE.test(code);
  let phase = '';
  return lines.map((parts) => {
    let kept = parts.filter((p) => p.text).map((p) => (prose && p.kind === 'keyword' ? { kind: 'text' as const, text: p.text } : p));
    const first = kept[0];
    const m = first?.kind === 'text' ? LEAD.exec(first.text) : null;
    if (m) {
      const word = m[2].toLowerCase();
      if (word !== 'and' && word !== 'but') phase = word;
      kept = [{ kind: 'text' as const, text: m[1] }, { kind: word === 'test' ? 'keyword' as const : 'step' as const, text: m[2] },
        { kind: 'text' as const, text: first.text.slice(m[0].length) }, ...kept.slice(1)].filter((p) => p.text);
    }
    return { parts: kept, assert: ASSERT.test(kept.map((p) => p.text).join('')) || (!!m && phase === 'then') };
  });
}

// Le cas et son point d'attention, à citer dans le champ de la conversation (citation entière : prefill block).
export const attentionQuote = (title: string, attention: string): string => `${title}\n${attention}`;

// Le texte d'une zone de commentaire, suivi du point d'attention (une ligne vide entre les deux) ;
// texte vide → l'attention seule ; déjà au bout → inchangé (un second clic n'ajoute rien) ; rien d'effacé.
export function withAttention(text: string, attention: string): string {
  if (!text.trim()) return attention;
  return text.trimEnd().endsWith(attention.trim()) ? text : `${text.trimEnd()}\n\n${attention}`;
}

// Ce qu'un cas garde : note, les lignes « → invariant » de la note (mark 'invariant', leur texte tel que dans
// mustNot) que sa phrase Garantit cite mot pour mot (leur texte avant « → », blancs, guillemets et apostrophes
// typographiques confondus), dans l'ordre de la note ; une ligne citée contenue dans une autre aussi citée ne
// compte que par la plus longue. spec, sans ligne de la note citée : les I-<n> de la phrase (dans leur ordre,
// sans doublon). none : pas de lecture, pas de phrase, rien de cité. La lecture périmée garde le sien.
export type CaseLink = { kind: 'note'; lines: string[] } | { kind: 'spec'; ids: string[] } | { kind: 'none' };

export function caseLink(reading: ReadingCase | null, mustNot: VibeNote['mustNot']): CaseLink {
  const said = reading ? norm(reading.guarantees) : '';
  const cited = mustNot
    .filter((l) => l.mark === 'invariant')
    .map((l) => {
      const arrow = Math.max(l.text.lastIndexOf('→'), l.text.lastIndexOf('->'));
      // avant la dernière flèche ; sans flèche, après le préfixe de la marque (« [invariant] … », comme parseNote)
      return { text: l.text, key: norm(arrow >= 0 ? l.text.slice(0, arrow) : l.text.replace(/^[[(][^\])]*[\])]/, '')) };
    })
    .filter((l) => l.key && said.includes(l.key));
  const lines = cited.filter((l) => !cited.some((o) => o.key.length > l.key.length && o.key.includes(l.key))).map((l) => l.text);
  if (lines.length) return { kind: 'note', lines };
  const ids = [...new Set(reading?.guarantees.match(/\bI-\d+\b/g))];
  return ids.length ? { kind: 'spec', ids } : { kind: 'none' };
}

// Blancs réduits à une espace, guillemets (« », “ ”, „) ramenés à ", apostrophes (’ ‘) à '.
const norm = (s: string) => s.replace(/«\s*/g, '"').replace(/\s*»/g, '"').replace(/[“”„]/g, '"').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
