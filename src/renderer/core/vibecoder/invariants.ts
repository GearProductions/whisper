/** invariants — les tests d'invariants tels que la vue les montre : chaque cas
 *  avec sa lecture en pseudo-code (par son titre, sinon à son rang) et sa
 *  validation ; ce qui est validé, refusé, à lire, avec un point d'attention,
 *  et si « Tout valider » est permis ; le pseudo-code ligne à ligne, coloré,
 *  ses assertions et ses « étant donné / quand / alors » repérés.
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (invariants-view). */
import type { ReadingCase, VibeMarkState, VibeTestFile } from 'technicals/bridge';
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

export type Progress = {
  total: number; ok: number; ko: number; changed: number;
  warnings: number;            // cas lus avec un point d'attention
  unread: number;              // cas sans lecture
  all: boolean;                // « Tout valider » : chaque cas lu, aucun point d'attention, un au moins sans verdict
};

export function progress(files: VibeTestFile[]): Progress {
  const cases = files.flatMap(casesOf);
  const count = (f: (c: CaseView) => boolean) => cases.filter(f).length;
  const p = {
    total: cases.length, ok: count((c) => c.mark === 'ok'), ko: count((c) => c.mark === 'ko'),
    changed: count((c) => c.mark === 'changed'), warnings: count((c) => !!c.reading?.warning), unread: count((c) => !c.reading),
  };
  return { ...p, all: !p.unread && !p.warnings && p.ok + p.ko < p.total };
}

export type PseudoPart = { kind: Token['kind'] | 'step'; text: string };   // step : « étant donné », « quand », « alors »
export type PseudoLine = { parts: PseudoPart[]; assert: boolean };          // assert : la ligne commence par expect

const STEP = /^(\/\/\s*)((?:étant donnée?s?|quand|alors|given|when|then)(?=[\s:]|$)(?:\s*:)?)/iu;
const ASSERT = /^\s*(?:await\s+)?expect\b/;

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
  return lines.map((parts) => {
    const kept = parts.filter((p) => p.text);
    return { parts: kept, assert: ASSERT.test(kept.map((p) => p.text).join('')) };
  });
}
