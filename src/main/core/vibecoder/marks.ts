/** marks — les validations de l'utilisateur (la note, la forme, « rien à écrire »
 *  de l'étape Invariants, un cas de test, une case du plan de test, une case du
 *  § A.3 cochée à la main, un commit du relevé), chacune pour l'empreinte du contenu
 *  validé (targetHash) : « modifié depuis » si le contenu a changé. Les validations
 *  d'étape (note 0.15.0-ecran-statuts) : 'note' pour l'empreinte de sa conception
 *  (noteDesign), 'forme', 'invariants', 'modules' pour celle de step.check.now ; leur
 *  marque porte aussi after (la validation de l'étape d'avant) et files (la liste des
 *  fichiers retenus) — step-checks. Plus de « file: » ni de « step: » (retirés). Le ✓ des
 *  étapes faites pendant Vibe (vibeMarks : note, forme, invariants, par validateStep ; les cas, ou « Rien à écrire » sans test). Et le brouillon de
 *  revue de chaque PR (relecteur) : ajouter, modifier, retirer une remarque, savoir
 *  si une remarque y est (hasComment). Et la
 *  vérification de conception de la note, gardée avec les validations (la cible
 *  'design'). Rend un nouvel état, ne touche pas à l'ancien.
 *  Ne connaît pas : Electron, le disque (l'état est rangé par app/settings), la
 *  course design-check (le contrôleur lui dit comment elle a fini).
 *  Utilisé par : core/vibecoder (journey : checked ; step-checks), app/controllers/vibecoder, app/settings. */
import type { VibeComment, VibeFlow, VibeMarkState, VibeView } from 'shared/bridge';
import { noteDesign } from './note';
import { stepChecks, stepContents, validateStep } from './step-checks';
import { blobSha } from './test-files';
import type { FileBlobs } from './validated';

// Par cible ('note', 'forme', 'nothing' (pour le texte de la note), 'case:<chemin du fichier>:<titre du cas>', 'check:<rang>' (une case du plan à l'écran, ecran.md), 'a3:<rang>', 'commit:<hash>',
// 'invariants', 'modules' (step-checks) ; 'file:<chemin>' et 'step:<étape>' : retirés).
// after, files : une validation d'étape (step-checks) — l'empreinte de la marque de l'étape d'avant, celle de sa liste de fichiers.
export type Marks = Record<string, { hash: string; verdict: 'ok' | 'ko'; after?: string; files?: string }>;
// Par numéro de PR.
export type Drafts = Record<string, VibeComment[]>;

// Le verdict s'il porte sur `hash`, 'changed' s'il porte sur un autre contenu, null sans validation.
export function markState(marks: Marks, target: string, hash: string): VibeMarkState {
  const mark = Object.hasOwn(marks, target) ? marks[target] : undefined;
  return !mark ? null : mark.hash === hash ? mark.verdict : 'changed';
}

// null : oublie la validation.
export function setMark(marks: Marks, target: string, hash: string, verdict: 'ok' | 'ko' | null): Marks {
  const { [target]: _, ...rest } = marks;
  return verdict ? { ...rest, [target]: { hash, verdict } } : rest;
}

// La vérification de conception de la note : la cible 'design' porte le chemin de la note (pas une empreinte :
// la page ne l'envoie jamais, targetHash ne la connaît pas).
export function designChecked(marks: Marks, notePath: string): boolean {
  return Object.hasOwn(marks, 'design') && marks.design.hash === notePath;
}

// 'check' : le Valider du créateur sur une note pas encore vérifiée lance la vérification au lieu de valider ; tout le reste : 'mark'.
export function noteClick(marks: Marks, notePath: string, verdict: 'ok' | 'ko' | null, flow: VibeFlow): 'check' | 'mark' {
  return flow === 'create' && verdict === 'ok' && !designChecked(marks, notePath) ? 'check' : 'mark';
}

// La fin de la course design-check : finie, la note est vérifiée ; sans question et avec l'empreinte au clic (clicked),
// elle est aussi validée pour cette empreinte (changée depuis : « modifiée depuis »). Échouée ou arrêtée : rien.
export function designEnd(
  marks: Marks,
  end: { path: string; state: 'done' | 'failed' | 'stopped'; questions: number; clicked: string | null },
): Marks {
  if (end.state !== 'done') return marks;
  const checked = setMark(marks, 'design', end.path, 'ok');
  return end.clicked && !end.questions ? setMark(checked, 'note', end.clicked, 'ok') : checked;
}

// L'empreinte du contenu d'une cible dans le relevé : la note (sa conception, noteDesign), « rien à écrire » de l'étape
// Invariants (créateur : le texte de la note), un cas de test (le fichier), une case du plan à l'écran (ecran.md), une case
// du § A.3 à cocher à la main (le commit de tête de la branche), un commit (« commit:<hash> » : son hash) ; null si la
// cible n'y est pas (« file: » et « step: » compris, retirés ; 'forme', 'invariants' et 'modules' : markStep, step-checks).
export function targetHash(view: VibeView, target: string): string | null {
  const { note } = view;
  if (target.startsWith('commit:')) return view.commits.find((c) => `commit:${c.hash}` === target)?.hash ?? null;
  const a3 = /^a3:(\d+)$/.exec(target);
  if (a3) return view.flow === 'create' && view.checklist[Number(a3[1])]?.manual ? view.commits.at(-1)?.hash ?? null : null;
  if (target === 'nothing' && view.flow !== 'create') return null;
  if (target === 'note' || target === 'nothing') return note && blobSha(target === 'note' ? noteDesign(note.text) : note.text);
  const file = view.invariants.find((f) => target.startsWith(`case:${f.path}:`) && f.cases.includes(target.slice(`case:${f.path}:`.length)));
  if (file) return file.blob;
  const check = /^check:(\d+)$/.exec(target);
  const plan = check && Number(check[1]) < (view.screen?.length ?? 0) ? view.outputs['ecran.md'] : undefined;
  return plan ? blobSha(plan.text) : null;
}

// Créateur : chaque étape faite de view (note, forme, invariants) reçoit sa validation d'étape pour son contenu
// d'aujourd'hui (validateStep de step-checks, dans l'ordre : after suit), et chaque cas des invariants son ✓ (aucun test :
// « Rien à écrire » son ✓, pour le texte de la note), les mêmes cibles et empreintes qu'un clic (targetHash) ; un ✓ ou ✗ déjà donné pour ce contenu reste ; une étape refusée (l'étape
// d'avant pas cochée) ne reçoit rien. blobs : les empreintes du disque (les fichiers retenus par la Forme et les invariants).
export function vibeMarks(marks: Marks, view: VibeView, blobs: FileBlobs[] = []): Marks {
  if (view.flow !== 'create' || !view.note) return marks;
  const done = new Set(view.steps.filter((s) => s.status === 'done').map((s) => s.id));
  const cases = done.has('invariants')
    ? [...view.invariants.flatMap((f) => f.cases.map((c) => ({ target: `case:${f.path}:${c}`, hash: f.blob }))),
      ...(!view.invariants.length ? [{ target: 'nothing', hash: blobSha(view.note.text) }] : [])]
    : [];
  const withCases = cases.reduce((m, { target, hash }) => (markState(m, target, hash) === 'ok' || markState(m, target, hash) === 'ko' ? m : setMark(m, target, hash, 'ok')), marks);
  // Les contenus ne dépendent que des cas et de « rien à écrire » (withCases) : les marques d'étape que le reste ajoute n'y changent rien.
  const contents = stepContents(view, withCases, blobs);
  return (['note', 'forme', 'invariants'] as const).filter((step) => done.has(step)).reduce((m, step) => {
    const hash = contents[step]?.hash;
    // Déjà cochée pour ce contenu (et l'étape d'avant) : rien à écrire, ni marque neuve ni relevé du disque du contrôleur.
    return !hash || markState(m, step, hash) === 'ko' || stepChecks(m, contents)[step].state === 'ok' ? m : validateStep(m, contents, step, 'ok') ?? m;
  }, withCases);
}

export function addComment(drafts: Drafts, pr: number, target: string, text: string): Drafts {
  const list = drafts[pr] ?? [];
  return { ...drafts, [pr]: [...list, { id: Math.max(0, ...list.map((c) => c.id)) + 1, target, text }] };
}

export function removeComment(drafts: Drafts, pr: number, id: number): Drafts {
  return { ...drafts, [pr]: (drafts[pr] ?? []).filter((c) => c.id !== id) };
}

// Le texte d'une remarque, changé sur place (même id, même cible).
export function editComment(drafts: Drafts, pr: number, id: number, text: string): Drafts {
  return { ...drafts, [pr]: (drafts[pr] ?? []).map((c) => (c.id === id ? { ...c, text } : c)) };
}

// La remarque `id` est-elle au brouillon de la PR `pr` ? (draft.edit, draft.remove : une inconnue est refusée.)
export function hasComment(drafts: Drafts, pr: number, id: number): boolean {
  return (drafts[pr] ?? []).some((c) => c.id === id);
}

// Les squelettes de la Forme (note 0.15.0-ecran-statuts) : à la fin d'une course forme réussie, la marque 'skel:<chemin>'
// retient l'empreinte de chaque fichier de module tel que la Forme l'a laissé (disk de blobs). before : les empreintes au
// départ de la course (null : inconnu, l'appli relancée entre-temps) ; un fichier déjà généré au départ (son empreinte
// d'alors n'était plus celle de son squelette) garde sa marque : une retouche de la Forme ne le rend pas « à générer ».
// Sans before, seul un fichier sans marque en reçoit une. Un fichier absent du disque : rien. Rend marks tel quel sans changement.
export function skeletonMarks(marks: Marks, paths: string[], blobs: FileBlobs[], before: Map<string, string | null> | null): Marks {
  const disk = new Map(blobs.map((b) => [b.path, b.disk]));
  let next = marks;
  for (const p of paths) {
    const now = disk.get(p);
    const old = marks[`skel:${p}`]?.hash;
    if (!now || now === old) continue;
    const generated = old !== undefined && (before ? (before.get(p) ?? null) !== null && before.get(p) !== old : true);
    if (generated) continue;
    next = { ...next, [`skel:${p}`]: { hash: now, verdict: 'ok' } };
  }
  return next;
}
