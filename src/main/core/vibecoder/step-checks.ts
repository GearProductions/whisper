/** step-checks — la validation de chaque étape et sa cascade (note 0.15.0-ecran-statuts) : ce que valide
 *  une étape aujourd'hui (stepContent, et stepContents pour les quatre : la note, sa conception, noteDesign ; la Forme, la
 *  section Forme de la note, et, retenus pour le diff, la note et les fichiers des modules ; les invariants, les fichiers de test,
 *  aucun cas noté ✗ (« À revoir ») pour son bloc et le code commun de son fichier (caseMarkState de case-marks ; « Validé » n'est pas exigé), aucun sans test ni
 *  ligne « → invariant » ; les modules,
 *  tout ce que la branche change d'après git — changed, ou view.files — plus les fichiers des modules, hors la note
 *  et les tests d'invariants : on suit git, sans autre règle, une feuille de style ou un libellé compris) ; l'état de chaque étape (stepChecks : cochée ; « changed », ce qu'elle a
 *  validé a changé ; « cascade », une étape d'avant décochée ou revalidée depuis, avec la première décochée
 *  pour cause ; jamais validée) ; et le geste (validateStep : la marque de l'étape, pour l'empreinte de ce
 *  qu'elle valide, avec celle de la validation de l'étape d'avant — after — et celle de sa liste de fichiers —
 *  files ; refusé si l'étape d'avant n'est pas cochée ; retirer la validation l'oublie). Revalider une étape ne
 *  recoche pas les suivantes : leur after ne correspond plus. Un commit ne change rien.
 *  Remplace stale (les étapes périmées, retiré).
 *  Rend un nouvel état, ne touche pas à l'ancien.
 *  Ne connaît pas : Electron, le disque, git (note, tests, empreintes passés) ; les textes retenus (le contrôleur
 *  les écrit, versionName et filesText de validated) ; qui valide (l'écran ou la CLI).
 *  Utilisé par : core/vibecoder (journey, marks : vibeMarks), app/controllers/vibecoder (validateStep). */
import { caseKeys } from 'shared/test-cases';
import type { VibeStepCheck, VibeStepId, VibeView } from 'shared/bridge';
import { caseMarkState, caseTarget } from './case-marks';
import { markState, setMark, type Marks } from './marks';
import { hasInvariantLines, noteDesign, parseNote } from './note';
import { blobSha } from './test-files';
import { filesText, type FileBlobs, type StepFiles } from './validated';

// Les étapes qui se valident, dans l'ordre de la cascade.
export type CheckedStep = Extract<VibeStepId, 'note' | 'forme' | 'invariants' | 'modules'>;
export const CHECKED: CheckedStep[] = ['note', 'forme', 'invariants', 'modules'];

// Ce qu'une étape valide : hash, l'empreinte que porte sa marque ; files, les fichiers retenus pour le diff
// « Depuis la validation » (la note : aucun).
export type StepContent = { hash: string; files: StepFiles };

type Contents = Partial<Record<CheckedStep, StepContent | null>>;
type StepView = Pick<VibeView, 'note' | 'invariants' | 'modules'> & { changed?: string[]; files?: VibeView['files'] };

// Ce que valide l'étape aujourd'hui, d'après le relevé, ses marques et les empreintes du disque (blobs) ; null : rien à
// valider — pas de note ; invariants : un cas noté ✗ pour son bloc et son code commun, ou aucun test, des lignes
// « → invariant » dans la note et pas « Rien à écrire » ✓ (sans test ni ligne « → invariant » : le contenu vide) ;
// modules : aucun fichier.
// La note : blobSha(noteDesign) ; la Forme : blobSha de la section Forme, files la note (son texte, pour que « Depuis la
// validation » montre son diff quand seule la section Forme change) et ceux des modules ; invariants et modules :
// blobSha(filesText(files)). Un fichier sans empreinte sur le disque n'est pas dans la liste.
export function stepContent(view: StepView, marks: Marks, step: CheckedStep, blobs: FileBlobs[]): StepContent | null {
  const { note } = view;
  if (!note) return null;
  const disk = new Map(blobs.map((b) => [b.path, b.disk]));
  const listed = (paths: string[]): StepFiles =>
    Object.fromEntries(paths.flatMap((p) => (disk.get(p) ? [[p, disk.get(p)!]] : [])));
  const list = (files: StepFiles): StepContent => ({ hash: blobSha(filesText(files)), files });
  const modules = listed(view.modules.flatMap((m) => (m.files ?? []).filter((f) => !f.deleted).map((f) => f.path)));
  if (step === 'note') return { hash: blobSha(noteDesign(note.text)), files: {} };
  if (step === 'forme') return { hash: blobSha(parseNote(note.text).forme), files: { [note.path]: blobSha(note.text), ...modules } };
  if (step === 'modules') {
    // Tout ce que git voit changer sur la branche, hors la note et les tests d'invariants (leurs propres validations).
    const own = new Set([note.path, ...view.invariants.map((f) => f.path)]);
    const branch = view.changed ?? (view.files ?? []).map((f) => f.path);
    const code = { ...modules, ...listed(branch.filter((p) => !own.has(p))) };
    return Object.keys(code).length ? list(code) : null;
  }
  if (!view.invariants.length) return !hasInvariantLines(note.text) || markState(marks, 'nothing', blobSha(note.text)) === 'ok' ? list({}) : null;
  // Un fichier sans hashes : rien ne se valide. Un test noté « À revoir » (✗ pour son bloc et son code commun) : non plus ;
  // « Validé » n'est pas exigé (les verdicts sont les notes de l'utilisateur, pas une condition : note 0.16.0-ecran-essentiel).
  const none = view.invariants.every(({ path, cases, hashes }) =>
    !!hashes && caseKeys(cases).every((key, i) => caseMarkState(marks, caseTarget(path, key), { hash: hashes.blocks[i], common: hashes.common }) !== 'ko'));
  return none ? list(listed(view.invariants.map((f) => f.path))) : null;
}

// Le contenu de chaque étape (stepContent), pour les mêmes relevé, marques et empreintes.
export const stepContents = (view: StepView, marks: Marks, blobs: FileBlobs[]): Record<CheckedStep, StepContent | null> =>
  Object.fromEntries(CHECKED.map((s) => [s, stepContent(view, marks, s, blobs)])) as Record<CheckedStep, StepContent | null>;

// Ce que l'after d'une étape retient de la marque de l'étape d'avant : son empreinte et son propre after (revalider la
// note change sa marque, donc la Forme ne suit plus ; revalider la Forme change la sienne, donc les invariants non plus).
const markId = (m: Marks[string]): string => blobSha(`${m.hash}\n${m.after ?? ''}`);

// L'état de chaque étape : 'ok' si sa marque porte l'empreinte d'aujourd'hui et, après la note, si l'étape d'avant est
// 'ok' et que son after est l'empreinte de la marque de l'étape d'avant ; 'changed' si sa propre empreinte a changé ;
// 'cascade' sinon (cause : la première étape pas 'ok' avant elle, ou l'étape d'avant si elle l'est mais a été revalidée) ;
// null : sans marque (un refus ne valide pas). now : contents[step]?.hash, null si l'étape d'avant n'est pas 'ok'
// (Valider n'est pas offert).
export function stepChecks(marks: Marks, contents: Contents): Record<CheckedStep, VibeStepCheck> {
  const out = {} as Record<CheckedStep, VibeStepCheck>;
  CHECKED.forEach((step, i) => {
    const prev = CHECKED[i - 1];
    const prevOk = !prev || out[prev].state === 'ok';
    const content = contents[step] ?? null;
    const now = prevOk ? content?.hash ?? null : null;
    const mark = Object.hasOwn(marks, step) && marks[step].verdict === 'ok' ? marks[step] : undefined;
    if (!mark) out[step] = { state: null, now };
    else if (mark.hash !== content?.hash) out[step] = { state: 'changed', now };
    else if (prevOk && (!prev || mark.after === markId(marks[prev]))) out[step] = { state: 'ok', now };
    else out[step] = { state: 'cascade', cause: CHECKED.slice(0, i).find((s) => out[s].state !== 'ok') ?? prev, now };
  });
  return out;
}

// Valider (ok) ou retirer la validation (null) d'une étape : la marque { hash, verdict, after, files } ; null : refusé
// (rien à valider, ou l'étape d'avant pas 'ok'). Les marques des autres étapes et des cas : inchangées.
export function validateStep(marks: Marks, contents: Contents, step: CheckedStep, verdict: 'ok' | null): Marks | null {
  if (!verdict) return setMark(marks, step, '', null);
  const content = contents[step] ?? null;
  const prev = CHECKED[CHECKED.indexOf(step) - 1];
  if (!content || (prev && stepChecks(marks, contents)[prev].state !== 'ok')) return null;
  return {
    ...marks,
    [step]: { hash: content.hash, verdict, ...(prev && { after: markId(marks[prev]) }), files: blobSha(filesText(content.files)) },
  };
}
