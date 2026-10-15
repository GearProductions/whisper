/** outputs — ce que les skills écrivent pour l'écran dans le dossier de
 *  sorties de l'agent : les seuls noms que le principal y lit, et leur
 *  lecture (cas d'un test lus en pseudo-code, questions ouvertes, cases à
 *  cocher).
 *  Ne connaît pas : le disque (textes passés), les skills.
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder. */
import type { ReadingCase, VibeCheck, VibeQuestion } from 'shared/bridge';

// Les noms fixes. S'y ajoutent, par PR : pr-<n>.json, pr-<n>-note.md,
// pr-<n>-commits.md, pr-<n>-ecran.md, pr-<n>-review.json ; et les lectures
// invariants/<blob>.md.
export const OUTPUTS: readonly string[] = [
  'questions.md', 'align.md', 'review.md', 'commit.md', 'checks.json', 'ponytail.md', 'pr.json', 'ci.md', 'prs.json',
];

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

// Un nom de sortie connu, rien d'autre : ni `..`, ni autre dossier qu'invariants/.
export function isOutputName(name: string): boolean { return todo(name); }

// invariants/<blob>.md : un cas par titre `##` (tel que dans le test), son bloc
// ```pseudo, « Cas limites : » (liste), « Garantit : », « Attention : » ;
// en anglais « Edge cases: », « Guarantees: », « Warning: ».
export function parseReading(md: string): ReadingCase[] { return todo(md); }

// questions.md : `## <n>. <question>` puis ses réponses proposées en liste ; vide : plus de question.
export function parseQuestions(md: string): VibeQuestion[] { return todo(md); }

// Les cases d'une liste (`- [ ]`, `- [x]`).
export function parseChecklist(md: string): VibeCheck[] { return todo(md); }
