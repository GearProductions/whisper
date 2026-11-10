/** invariants — les tests d'invariants tels que la vue les montre : chaque cas
 *  avec sa lecture en pseudo-code (par son titre, sinon à son rang) et sa
 *  validation, sa ligne dans le fichier et son code d'origine ; ce qui est validé, refusé, à lire, avec un point d'attention,
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
import { tokens, type Token } from './highlight';

export type CaseView = { title: string; reading: ReadingCase | null; mark: VibeMarkState };

// Les cas du fichier (les titres du test : les validations s'y rattachent) ; la
// lecture d'un cas est celle de même titre, sinon celle de même rang si la
// lecture a autant de cas et que celle-ci ne porte le titre d'aucun autre.
export function casesOf(file: VibeTestFile): CaseView[] {
  const r = file.reading;
  return file.cases.map((title, i) => ({
    title,
    reading: !r ? null : r.find((c) => c.title === title)
      ?? (r.length === file.cases.length && !file.cases.includes(r[i].title) ? r[i] : null),
    mark: Object.hasOwn(file.marks, title) ? file.marks[title] : null,
  }));
}

// La ligne (1…) d'un cas dans son fichier, pour Ouvrir à la ligne ; inconnue : undefined (Ouvrir au début).
export function caseLine(file: VibeTestFile, title: string): number | undefined {
  const line = file.lines[file.cases.indexOf(title)];
  return Number.isInteger(line) && line > 0 ? line : undefined;
}

// Le code d'origine du cas de rang i : de sa ligne à celle du cas suivant (ou à
// la fin du fichier), sans les lignes vides de la fin ; texte ou ligne inconnus : ''.
export function caseSource(file: VibeTestFile, i: number): string {
  const from = file.lines[i];
  if (!file.source || !Number.isInteger(from) || from < 1) return '';
  const next = file.lines[i + 1];
  return file.source.split('\n').slice(from - 1, Number.isInteger(next) && next > from ? next - 1 : undefined).join('\n').trimEnd();
}

export type Progress = {
  total: number; ok: number; ko: number; changed: number;
  warnings: number;            // cas lus avec un point d'attention
  unread: number;              // cas sans lecture, ou à lecture périmée
  all: boolean;                // « Tout valider » : aucun point d'attention, un cas au moins sans verdict, lus ou pas
};

export function progress(files: VibeTestFile[]): Progress {
  // une lecture périmée n'est pas lue (comme côté principal)
  const cases = files.flatMap((file) => casesOf(file).map((c) => ({ ...c, stale: !!file.stale })));
  const count = (f: (c: CaseView & { stale: boolean }) => boolean) => cases.filter(f).length;
  const p = {
    total: cases.length, ok: count((c) => c.mark === 'ok'), ko: count((c) => c.mark === 'ko'),
    changed: count((c) => c.mark === 'changed'), warnings: count((c) => !!c.reading?.warning), unread: count((c) => !c.reading || c.stale),
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
