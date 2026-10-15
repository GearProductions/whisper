/** outputs — ce que les skills écrivent pour l'écran dans le dossier de
 *  sorties de l'agent : les seuls noms que le principal y lit, et leur
 *  lecture (cas d'un test lus en pseudo-code, questions ouvertes, cases à
 *  cocher, un JSON).
 *  Ne connaît pas : le disque (textes passés), les skills.
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder. */
import type { ReadingCase, VibeCheck, VibeQuestion } from 'shared/bridge';

// Les noms fixes. S'y ajoutent, par PR : pr-<n>.json, pr-<n>-note.md,
// pr-<n>-commits.md, pr-<n>-ecran.md, pr-<n>-review.json ; et les lectures
// invariants/<blob>.md.
export const OUTPUTS: readonly string[] = [
  'questions.md', 'align.md', 'review.md', 'commit.md', 'checks.json', 'ponytail.md', 'pr.json', 'ci.md', 'prs.json',
];

// Un nom de sortie connu, rien d'autre : ni `..`, ni autre dossier qu'invariants/.
export function isOutputName(name: string): boolean {
  return OUTPUTS.includes(name) || /^pr-[1-9]\d*(-note\.md|-commits\.md|-ecran\.md|-review\.json|\.json)$/.test(name)
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
export function parseQuestions(md: string): VibeQuestion[] {
  const out: VibeQuestion[] = [];
  for (const line of md.split(/\r?\n/)) {
    const h = /^##\s+(?:(\d+)[.)]\s*)?(.*?)\s*$/.exec(line);
    const q = out[out.length - 1];
    if (h) out.push({ n: h[1] ? Number(h[1]) : out.length + 1, text: h[2], options: [] });
    else if (q && BULLET.test(line)) q.options.push(line.replace(BULLET, '').trim());
    else if (q && line.trim() && !q.options.length) q.text += ` ${line.trim()}`;
  }
  return out;
}

// Les cases d'une liste (`- [ ]`, `- [x]`).
export function parseChecklist(md: string): VibeCheck[] {
  return md.split(/\r?\n/).flatMap((line) => {
    const m = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*?)\s*$/.exec(line);
    return m ? [{ text: m[2], done: m[1] !== ' ' }] : [];
  });
}
