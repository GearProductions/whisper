/** outputs — ce que les skills écrivent pour l'écran dans le dossier de
 *  sorties de l'agent : les seuls noms que le principal y lit, et leur
 *  lecture (cas d'un test lus en pseudo-code, questions ouvertes et leur
 *  niveau, cases à cocher, un JSON, le worktree d'une PR, la branche d'une nouvelle demande
 *  (new-request.json), les remarques ponytail appliquées) ;
 *  la ligne de la consigne qui fait vider questions.md par la conversation.
 *  La preuve des invariants par mutation (note 0.16.0-controle-en-trois-points) : preuve.md, une sortie connue de
 *  plus (OUTPUTS), écrite par le skill prouver — une rubrique par ligne « → invariant » de la note,
 *  `## [prouvé] <la ligne>` (« [proved] ») puis le mutant qui a fait échouer son test, ou `## [toi] <la ligne>` puis
 *  pourquoi elle remonte à l'utilisateur ; sans ligne « → invariant » : « Rien à prouver. ».
 *  toiCount(md: string): number — les rubriques `## [toi]` d'un fichier de retour (align.md, preuve.md).
 *  parseProof(md: string): VibeProofLine[] — les rubriques de preuve.md, dans l'ordre ; une rubrique sans étiquette
 *  connue n'est pas prouvée.
 *  proofOf(md: string | null, lines: string[]): VibeProof — l'état de la preuve pour les lignes « → invariant » de la
 *  note (lines, leur texte) : 'none' sans ligne ; 'missing' sans fichier, ou si une ligne de la note n'a pas sa
 *  rubrique ; 'blocked' si une rubrique est [toi] ou pas prouvée ; 'ok' si chaque ligne de la note est prouvée.
 *  Elle ne lit que preuve.md et les lignes de la note, ni le code ni les tests : une preuve passée le reste quand le
 *  code change ensuite (une correction après l'essai à l'écran) ; seule une nouvelle course la remplace.
 *  Ne connaît pas : le disque (textes passés), git, les skills.
 *  Utilisé par : core/vibecoder (journey), app/controllers (vibecoder,
 *  worktrees, agents). */
import path from 'node:path';
import { okRef } from 'helpers';
import type { ReadingCase, VibeCheck, VibeProof, VibeProofLine, VibeQuestion } from 'shared/bridge';

// Les noms fixes. S'y ajoutent, par PR : pr-<n>.json, pr-<n>-note.md,
// pr-<n>-commits.md, pr-<n>-review.json, pr-<n>-worktree.json ; et les lectures
// invariants/<blob>.md.
export const OUTPUTS: readonly string[] = [
  'questions.md', 'align.md', 'review.md', 'commit.md', 'checks.json', 'ponytail.md', 'pr.json', 'ci.md',
  'ecran.md',          // le plan à l'écran (skill ecran), une sortie de branche, les deux rôles
  'lancement.json',   // la proposition des commandes du projet (skill lancement), adoptée par controllers/processes
  'ponytail-applied.json', // { applied: ["<fichier>:L<ligne>", …] } : les remarques de ponytail.md que la course apply a appliquées
  'new-request.json',      // { branch } : la branche d'une nouvelle demande (skill nouvelle-demande)
  'preuve.md',             // la preuve des invariants par mutation (skill prouver), lue par journey
  'liens.md',              // quel test garde quelle ligne « → invariant » de la note (skill aligner), lu par la page (ruleGroups)
];

// Un nom de sortie connu, rien d'autre : ni `..`, ni autre dossier qu'invariants/.
export function isOutputName(name: string): boolean {
  return OUTPUTS.includes(name) || /^pr-[1-9]\d*(-note\.md|-commits\.md|-review\.json|-worktree\.json|\.json)$/.test(name)
    || /^invariants\/[0-9a-f]{40}\.md$/.test(name);
}

// Un JSON écrit par un skill : un objet (ou tableau), sinon null.
export function json(text: string | null | undefined): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text ?? '');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

// pr-<n>-worktree.json (écrite par l'appli, prWorktreeReady) : le dossier du worktree, un chemin
// absolu sans caractère de contrôle, et sa branche ; sinon null.
export function worktreeCard(text: string | null | undefined): { dir: string; branch: string } | null {
  const card = json(text);
  const dir = card?.dir;
  if (typeof dir !== 'string' || !path.isAbsolute(dir) || /[\0-\x1f\x7f]/.test(dir)) return null;
  return { dir, branch: typeof card!.branch === 'string' ? card!.branch : '' };
}

// new-request.json (skill nouvelle-demande) : la branche, un ref sûr (okRef) ; sinon null.
export function newRequestCard(text: string | null | undefined): { branch: string } | null {
  const branch = json(text)?.branch;
  return typeof branch === 'string' && okRef(branch) ? { branch } : null;
}

const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/;
const LABEL = /^\s*\**\s*(cas limites|edge cases|garantit|guarantees?|attention|warning)\s*\**\s*:\s*\**\s*(.*)$/i;

// invariants/<blob>.md : un cas par titre `##` (tel que dans le test), son bloc
// ```pseudo, « Cas limites : » (liste), « Garantit : », « Attention : » ;
// en anglais « Edge cases: », « Guarantees: », « Warning: ».
export function parseReading(md: string): ReadingCase[] {
  const cases: ReadingCase[] = [];
  let c: ReadingCase | null = null;
  let fence: string[] | null = null;   // le bloc de code en cours
  let field: 'edges' | 'guarantees' | 'warning' | null = null;
  for (const line of md.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      if (fence && c && !c.pseudo) c.pseudo = fence.join('\n');
      fence = fence ? null : [];
      continue;
    }
    if (fence) { fence.push(line); continue; }
    const h = /^##\s+(.*?)\s*$/.exec(line);
    if (h) { cases.push(c = { title: h[1], pseudo: '', edges: [], guarantees: '', warning: null }); field = null; continue; }
    if (!c || !line.trim()) continue;
    const label = LABEL.exec(line);
    if (label) {
      const word = label[1].toLowerCase();
      field = word.startsWith('cas') || word.startsWith('edge') ? 'edges' : word.startsWith('g') ? 'guarantees' : 'warning';
      if (label[2]) add(c, field, label[2]);
    } else if (field) add(c, field, line.replace(BULLET, '').trim());
  }
  return cases;
}

function add(c: ReadingCase, field: 'edges' | 'guarantees' | 'warning', text: string) {
  if (field === 'edges') c.edges.push(text);
  else c[field] = c[field] ? `${c[field]} ${text}` : text;
}

// questions.md : `## <n>. <question>` puis ses réponses proposées en liste ; vide : plus de question.
// Le niveau en tête du titre, après le numéro (`## 1. [important] …`, `## 1. [secondaire] …`) : dans level
// ('important', 'secondary'), retiré de text ; un autre crochet, ou aucun : pas de level, le titre tel quel.
export function parseQuestions(md: string): VibeQuestion[] {
  const out: VibeQuestion[] = [];
  for (const line of md.split(/\r?\n/)) {
    const h = /^##\s+(?:(\d+)[.)]\s*)?(.*?)\s*$/.exec(line);
    const q = out[out.length - 1];
    if (h) {
      const level = /^\[(important|secondaire)\](?:\s+|$)/.exec(h[2]);
      out.push({ n: h[1] ? Number(h[1]) : out.length + 1, text: level ? h[2].slice(level[0].length) : h[2], options: [], ...(level && { level: level[1] === 'important' ? 'important' : 'secondary' }) });
    } else if (q && BULLET.test(line)) q.options.push(line.replace(BULLET, '').trim());
    else if (q && line.trim() && !q.options.length) q.text = `${q.text} ${line.trim()}`.trim();
  }
  return out;
}

// La ligne ajoutée à la consigne de la conversation d'un agent (F-100, étape 1) :
// les skills de VibeCoder ne s'y chargent jamais d'eux-mêmes, c'est elle qui
// fait suivre au questionnaire les réponses données dans la conversation.
export function questionsRule(out: string): string {
  return `VibeCoder: when the user answers the ticket note's open questions in this conversation, write each decision in the note at its place, then rewrite ${out}/questions.md with the questions still open (empty file: no more questions); an answer asking for your advice keeps its question.`;
}

// Les cases d'une liste (`- [ ]`, `- [x]`).
export function parseChecklist(md: string): VibeCheck[] {
  return md.split(/\r?\n/).flatMap((line) => {
    const m = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*?)\s*$/.exec(line);
    return m ? [{ text: m[2], done: m[1] !== ' ' }] : [];
  });
}

// Les rubriques `## [toi]` d'un fichier de retour (align.md, preuve.md) : ce qui remonte à l'utilisateur.
export function toiCount(md: string): number {
  return md.split(/\r?\n/).filter((line) => /^##\s+\[toi\]/.test(line)).length;
}

// preuve.md : une rubrique par ligne « → invariant » de la note, prouvée ([prouvé], [proved]) ou pour l'utilisateur ([toi]).
// Le détail : le texte de la rubrique, jusqu'au titre suivant.
export function parseProof(md: string): VibeProofLine[] {
  const out: VibeProofLine[] = [];
  const detail: string[][] = [];
  for (const row of md.split(/\r?\n/)) {
    const h = /^##\s+(?:\[([^\]]*)\]\s*)?(.*?)\s*$/.exec(row);
    if (h) {
      out.push({ line: h[2], proved: h[1] === 'prouvé' || h[1] === 'proved', detail: '' });
      detail.push([]);
    } else if (out.length) detail[detail.length - 1].push(row);
  }
  return out.map((r, i) => ({ ...r, detail: detail[i].join('\n').trim() }));
}

// L'état de la preuve pour les lignes « → invariant » de la note (leur texte) ; md null : pas de preuve.md.
// Une ligne se compare à l'espace près ; une ligne n'est prouvée que si toutes ses rubriques le sont.
export function proofOf(md: string | null, lines: string[]): VibeProof {
  if (!lines.length) return { state: 'none', lines: [] };
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
  const rubrics = md === null ? [] : parseProof(md);
  const got = lines.map((line): VibeProofLine & { found: boolean } => {
    const mine = rubrics.filter((r) => norm(r.line) === norm(line));
    return { line, proved: mine.length > 0 && mine.every((r) => r.proved), detail: (mine.find((r) => !r.proved) ?? mine[0])?.detail ?? '', found: mine.length > 0 };
  });
  const state = got.some((l) => !l.found) ? 'missing' : got.every((l) => l.proved) ? 'ok' : 'blocked';
  return { state, lines: got };
}
