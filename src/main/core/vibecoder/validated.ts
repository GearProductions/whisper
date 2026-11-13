/** validated — les fichiers que retient la validation d'une étape (note 0.15.0-ecran-statuts) : leur
 *  liste (chemin → empreinte git du texte validé), écrite en un texte (filesText) et relue (parseFiles), gardée
 *  avec chaque texte dans le dossier de sorties de l'agent sous son empreinte (versionName : validated/<empreinte>,
 *  jamais dans le dépôt ni sous .git/) ; et les fichiers qui diffèrent d'une référence — le dernier commit ou
 *  cette liste — pour le menu de diff de la vue IDE (diffFiles : ajouté, supprimé).
 *  Retirés par la retouche : FILE, fileMark, gestureFiles, fileReview — plus de validation par fichier ni d'accordéons.
 *  Rend un nouvel état, ne touche pas à l'ancien.
 *  Ne connaît pas : Electron, le disque, git, l'index du dépôt (empreintes et textes passés) ; les étapes.
 *  Utilisé par : core/vibecoder (step-checks, journey), app/controllers/vibecoder (versionName, filesText,
 *  parseFiles), app/controllers/module-code (versionName, parseFiles). */
import type { VibeDiffFile } from 'shared/bridge';

// Le chemin, sous le dossier de sorties de l'agent, du texte d'une version retenue (une liste ou un fichier) :
// « validated/<empreinte> » ; une empreinte qui n'est pas 40 caractères hexadécimaux : null (jamais de « / » ni de « .. »).
export const versionName = (hash: string): string | null => (/^[0-9a-f]{40}$/i.test(hash) ? `validated/${hash}` : null);

// Un fichier d'une étape : son chemin, l'empreinte de son texte sur le disque et au dernier commit (null : absent).
export type FileBlobs = { path: string; disk: string | null; head: string | null };

// Les fichiers d'une validation d'étape : chemin relatif au dépôt → empreinte git du texte validé.
export type StepFiles = Record<string, string>;

const byPath = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// La liste en texte, une ligne « <empreinte> <chemin> » par fichier, triée par chemin ; {} : ''.
export function filesText(files: StepFiles): string {
  return Object.keys(files).sort(byPath).map((path) => `${files[path]} ${path}`).join('\n');
}

// Relit filesText (un retour à la ligne final et des CRLF tolérés) ; une ligne mal formée (empreinte pas hexadécimale
// de 40 caractères, chemin vide, ligne vide) ou un chemin en double : null.
export function parseFiles(text: string): StepFiles | null {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  const entries: [string, string][] = [];
  for (const line of lines) {
    const m = /^([0-9a-f]{40}) (.+)$/i.exec(line);
    if (!m) return null;
    entries.push([m[2], m[1]]);
  }
  // fromEntries définit des propriétés propres : « __proto__ » n'est pas un cas particulier.
  const files: StepFiles = Object.fromEntries(entries);
  return Object.keys(files).length === entries.length ? files : null;
}

// Les fichiers de `files` qui diffèrent de la référence, triés par chemin : 'head', le dernier commit (head) ; une
// StepFiles, la version validée (un chemin de la liste absent de `files` : supprimé). added : absent de la référence ;
// deleted : disk null. Un fichier identique à sa référence : absent. Sans id (journey les numérote).
export function diffFiles(files: FileBlobs[], ref: 'head' | StepFiles): VibeDiffFile[] {
  const all = ref === 'head' ? files : [...files, ...Object.keys(ref).filter((p) => !files.some((f) => f.path === p)).map((path) => ({ path, disk: null, head: null }))];
  return all
    .map(({ path, disk, head }) => ({ path, disk, ref: ref === 'head' ? head : (Object.hasOwn(ref, path) ? ref[path] : null) }))
    .filter(({ disk, ref }) => disk !== ref)
    .sort((a, b) => byPath(a.path, b.path))
    .map(({ path, disk, ref }) => ({ path, ...(ref === null && { added: true as const }), ...(disk === null && { deleted: true as const }) }));
}
