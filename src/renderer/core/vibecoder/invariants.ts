/** invariants — les tests d'invariants tels que la vue les montre : chaque cas
 *  avec sa clé (caseKeys de shared/test-cases : un titre en double, son numéro d'ordre), sa lecture en pseudo-code
 *  (par sa clé parmi les cas lus, sinon à son rang), sa lecture périmée ou non (staleCases), et sa
 *  validation (par sa clé ; common : « changed » parce que le code commun du fichier a changé, commonChanged), sa ligne dans le fichier et son code d'origine, les lignes de son bloc (caseRange) et le
 *  fichier dont seul ce bloc est remplacé (replaceRange) ; ce qui est validé, refusé, à lire, avec un point d'attention,
 *  et si « Tout valider » est permis (lu ou pas : la lecture n'est qu'une aide) ; le pseudo-code ligne à ligne, coloré,
 *  ses assertions et ses « given / when / then » repérés — en tête de ligne
 *  (`test "…":`, la forme des lectures) ou en commentaire (`it(…)`, l'ancienne) ;
 *  le point d'attention d'un cas, versé en un clic : ajouté à la zone de commentaire sans rien effacer (withAttention) ; la ligne « → invariant » de
 *  la note que garde un cas, d'après la seule phrase Garantit de sa lecture (caseLink).
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : les tests rangés par ligne « → invariant » de la note.
 *  ruleGroups(view: Pick<VibeView, 'note' | 'invariants' | 'proof'>, links?: string | null): RuleGroups
 *  rules : une règle par ligne « → invariant » de la note (mustNot, mark 'invariant'), dans l'ordre de la note, son
 *  texte tel qu'écrit ; ses cas, ceux que l'alignement y rattache (links : le texte de liens.md, écrit par le skill
 *  aligner, qui vérifie déjà test par test à quelle ligne chacun est lié ; alignLinks le lit) ; pour un cas que
 *  liens.md ne nomme pas, ou sans liens.md, ceux que caseLink y rattache d'après sa lecture (une citation mot pour
 *  mot, qui manque souvent sur une ligne longue : un repli, plus la règle) ; un cas sous deux lignes est sous chacune, dans
 *  l'ordre des fichiers puis des cas ; elsewhere, les tests que liens.md range sous elle et qui ne sont pas au relevé
 *  (un test d'avant la branche qui l'observe déjà) ; une ligne sans cas ni test ailleurs reste (« aucun test ») ; son état d'après la
 *  preuve du relevé (view.proof.lines, par le texte de la ligne) : 'proved', prouvée ; 'unproved', la preuve la
 *  remonte à l'utilisateur (detail : pourquoi) ; 'written', la preuve ne dit encore rien d'elle (pas de preuve, ou pas
 *  de rubrique pour elle). others : les cas qui ne gardent aucune ligne (pas lus, sans phrase Garantit, un I-… seul,
 *  rien de cité) : « Autres tests ». Chaque cas de chaque test est dans une règle ou dans others : rien n'est caché.
 *  Sans note : aucune règle, tous les cas dans others.
 *  La revue essentielle (note 0.16.0-revue-essentielle) : le relecteur lit les mêmes règles (ruleGroups, sur une PR
 *  aussi : liens.md y est écrit par l'alignement, tests d'avant la branche compris ; son relevé n'a pas de preuve, la vue
 *  ne montre alors aucun état). casesOf dit de chaque cas s'il est un test d'avant la branche que la PR modifie
 *  (CaseView.fromBase, d'après VibeTestFile.changedFromBase, par sa clé ; absent : non, toujours en créateur).
 *  Ne connaît pas : le DOM, React, la spécification du projet (un I-… n'est qu'un numéro).
 *  Utilisé par : app/panel/vibecoder (rules-view : ruleGroups, pseudoLines, progress, withAttention). */
import type { ReadingCase, VibeMarkState, VibeNote, VibeTestFile, VibeView } from 'technicals/bridge';
import { caseKeys, readingRanks } from 'shared/test-cases';
import { tokens, type Token } from './highlight';

// key : la clé du cas (sa cible : « case:<chemin>:<clé> ») ; stale : sa lecture est périmée ; common : sa validation est
// tombée parce que le code commun du fichier a changé (absents : non ; note 0.15.0-invariants-par-cas) ; fromBase : un test
// d'avant la branche dont la PR a changé le bloc (relecteur ; absent : non ; note 0.16.0-revue-essentielle).
export type CaseView = { title: string; key?: string; reading: ReadingCase | null; stale?: boolean; mark: VibeMarkState; common?: boolean; fromBase?: boolean };

// Les cas du fichier (leurs clés : les validations s'y rattachent) ; la lecture d'un cas est celle de même clé parmi les
// cas lus (caseKeys de leurs titres), sinon celle de même rang si la lecture a autant de cas et que celle-ci ne porte
// le titre d'aucun autre.
export function casesOf(file: VibeTestFile): CaseView[] {
  const r = file.reading;
  const keys = caseKeys(file.cases), ranks = r ? readingRanks(file.cases, r.map((c) => c.title)) : [];
  return file.cases.map((title, i) => {
    const key = keys[i];
    return {
      title, key,
      reading: r && ranks[i] !== null ? r[ranks[i]!] : null,
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
    .map((l) => ({ text: l.text, key: lineKey(l.text) }))
    .filter((l) => l.key && said.includes(l.key));
  const lines = cited.filter((l) => !cited.some((o) => o.key.length > l.key.length && o.key.includes(l.key))).map((l) => l.text);
  if (lines.length) return { kind: 'note', lines };
  const ids = [...new Set(reading?.guarantees.match(/\bI-\d+\b/g))];
  return ids.length ? { kind: 'spec', ids } : { kind: 'none' };
}

// liens.md (skill aligner) : sous chaque ligne « → invariant » de la note (un titre `## `, son texte), les tests
// qui la gardent, un par puce : `- <chemin du fichier> :: <titre du test>` (les accents graves autour sont ôtés).
// Une puce sans « :: », du texte hors d'un titre : ignorés.
export type AlignLink = { line: string; tests: { path: string; title: string }[] };
export function alignLinks(md: string): AlignLink[] {
  const bare = (t: string) => t.trim().replace(/^`(.*)`$/, '$1').trim();
  const out: AlignLink[] = [];
  for (const raw of md.split('\n')) {
    const l = raw.trim();
    if (l.startsWith('## ')) out.push({ line: l.slice(3).trim(), tests: [] });
    else if (out.length && /^[-*] /.test(l)) {
      const at = l.indexOf(' :: ');
      if (at > 0) out[out.length - 1].tests.push({ path: bare(l.slice(2, at)).replace(/^\.\//, ''), title: bare(l.slice(at + 4)) });
    }
  }
  return out;
}

// La clé d'une ligne de la note : son texte avant la dernière flèche (sans flèche, après le préfixe de la marque,
// « [invariant] … », comme parseNote), normalisé.
const lineKey = (text: string) => {
  const arrow = Math.max(text.lastIndexOf('→'), text.lastIndexOf('->'));
  return norm(arrow >= 0 ? text.slice(0, arrow) : text.replace(/^[[(][^\])]*[\])]/, ''));
};
// Sans la ponctuation de fin : une ligne recopiée par son début finit souvent par un point ou des points de suspension.
const untailed = (key: string) => key.replace(/[\s.…:;,]+$/, '');

// La ligne de la note qu'un titre de liens.md désigne (son texte tel que dans mustNot) : celle de même clé ; sinon la
// seule dont la clé commence par ce titre (une ligne longue recopiée sans sa fin), s'il fait au moins 12 caractères ;
// aucune, ou plusieurs : null (le test reste dans les autres : rien n'est rangé au hasard).
function linkedLine(heading: string, lines: { text: string; key: string }[]): string | null {
  const h = untailed(lineKey(heading));
  if (!h) return null;
  const same = lines.filter((l) => untailed(l.key) === h);
  if (same.length) return same.length === 1 ? same[0].text : null;
  const starts = h.length >= 12 ? lines.filter((l) => l.key.startsWith(h)) : [];
  return starts.length === 1 ? starts[0].text : null;
}

// Ce que liens.md rattache : cases, pour chaque cas du relevé (« <id du fichier>:<rang> »), les lignes de la note qu'il
// garde ; elsewhere, pour chaque ligne (son texte), les tests nommés dont le fichier n'est pas au relevé (un test
// d'avant la branche qui observe déjà la ligne), sans doublon. Un titre inconnu d'un fichier du relevé : ignoré.
type Linked = { cases: Map<string, Set<string>>; elsewhere: Map<string, { path: string; title: string }[]> };
function linked(md: string, mustNot: VibeNote['mustNot'], files: VibeTestFile[]): Linked {
  const lines = mustNot.filter((l) => l.mark === 'invariant').map((l) => ({ text: l.text, key: lineKey(l.text) }));
  const out: Linked = { cases: new Map(), elsewhere: new Map() };
  for (const link of alignLinks(md)) {
    const line = linkedLine(link.line, lines);
    if (!line) continue;
    for (const t of link.tests) {
      const file = files.find((f) => f.path === t.path);
      if (!file) {
        const there = out.elsewhere.get(line) ?? [];
        if (!there.some((e) => e.path === t.path && e.title === t.title)) out.elsewhere.set(line, [...there, t]);
        continue;
      }
      // Le cas qu'un titre désigne : sa clé numérotée exacte (« x n° 2 »), sinon le seul cas de ce titre ; un titre que portent
      // plusieurs cas ne range rien (le test reste dans les autres, pas au hasard sur le premier).
      const keyAt = caseKeys(file.cases).indexOf(t.title);
      const same = file.cases.flatMap((c, j) => (norm(c) === norm(t.title) ? [j] : []));
      const i = keyAt >= 0 && file.cases[keyAt] !== t.title ? keyAt : same.length === 1 ? same[0] : -1;
      if (i < 0) continue;
      const id = `${file.id}:${i}`;
      out.cases.set(id, (out.cases.get(id) ?? new Set()).add(line));
    }
  }
  return out;
}

// Blancs réduits à une espace, guillemets (« », “ ”, „) ramenés à ", apostrophes (’ ‘) à '.
const norm = (s: string) => s.replace(/«\s*/g, '"').replace(/\s*»/g, '"').replace(/[“”„]/g, '"').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

// Une règle : une ligne « → invariant » de la note, son état d'après la preuve, les cas qui la gardent (voir l'en-tête).
export type RuleState = 'written' | 'proved' | 'unproved';
// index : le rang du cas dans file.cases (sa ligne : file.lines[index]).
export type RuleCase = { file: VibeTestFile; index: number; view: CaseView };
// detail : ce que la preuve dit de la ligne (le mutant qui l'a prouvée, ou pourquoi elle remonte) ; '' : rien.
// elsewhere : les tests que l'alignement range sous la ligne et qui ne sont pas au relevé (d'avant la branche) : leur
// chemin et leur titre, rien de plus (ni pseudo-code ni ligne) ; sans liens.md : aucun.
export type Rule = { line: string; state: RuleState; detail: string; cases: RuleCase[]; elsewhere: { path: string; title: string }[] };
export type RuleGroups = { rules: Rule[]; others: RuleCase[] };

export function ruleGroups(view: Pick<VibeView, 'note' | 'invariants' | 'proof'>, links?: string | null): RuleGroups {
  const mustNot = view.note?.mustNot ?? [];
  // L'alignement d'abord (liens.md), dans l'ordre de la note ; un cas qu'il ne nomme pas : la citation de sa lecture.
  const aligned = links ? linked(links, mustNot, view.invariants) : null;
  const linkOf = (file: VibeTestFile, index: number, reading: ReadingCase | null): CaseLink => {
    const lines = aligned?.cases.get(`${file.id}:${index}`);
    return lines ? { kind: 'note', lines: mustNot.filter((l) => lines.has(l.text)).map((l) => l.text) } : caseLink(reading, mustNot);
  };
  const cases = view.invariants.flatMap((file) => casesOf(file).map((v, index): RuleCase & { link: CaseLink } => ({ file, index, view: v, link: linkOf(file, index, v.reading) })));
  const strip = ({ link: _l, ...c }: RuleCase & { link: CaseLink }): RuleCase => c;
  const rules = mustNot.filter((l) => l.mark === 'invariant').map(({ text }): Rule => {
    const p = view.proof?.lines.find((l) => l.line === text);
    // sans rubrique dans preuve.md (found false) : « écrite », pas « non prouvée »
    const state: RuleState = !p || p.found === false ? 'written' : p.proved ? 'proved' : 'unproved';
    return {
      line: text, state, detail: state === 'written' ? '' : p!.detail,
      cases: cases.filter((c) => c.link.kind === 'note' && c.link.lines.includes(text)).map(strip), elsewhere: aligned?.elsewhere.get(text) ?? [],
    };
  });
  return { rules, others: cases.filter((c) => c.link.kind !== 'note').map(strip) };
}
