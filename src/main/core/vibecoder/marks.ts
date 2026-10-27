/** marks — les validations de l'utilisateur (la note, la forme, « rien à écrire »
 *  de l'étape Invariants, un cas de test, une case du plan de test, une case du
 *  § A.3 cochée à la main), chacune pour l'empreinte du contenu
 *  validé (targetHash) : « modifié depuis » si le contenu a changé. Le ✓ des
 *  étapes faites pendant Vibe (vibeMarks). Et le brouillon de
 *  revue de chaque PR (Relire) : ajouter, modifier, retirer une remarque. Rend
 *  un nouvel état, ne touche pas à l'ancien.
 *  Ne connaît pas : Electron, le disque (l'état est rangé par app/settings).
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder, app/settings. */
import type { VibeComment, VibeMarkState, VibeView } from 'shared/bridge';
import { parseNote } from './note';
import { blobSha } from './test-files';

// Par cible ('note', 'forme', 'nothing' (pour le texte de la note), 'case:<chemin du fichier>:<titre du cas>', 'check:<pr>:<rang>', 'a3:<rang>').
export type Marks = Record<string, { hash: string; verdict: 'ok' | 'ko' }>;
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

// L'empreinte du contenu d'une cible dans le relevé : la note (son texte), la
// forme (sa rubrique), « rien à écrire » de l'étape Invariants (Créer : le texte de la note), un cas de test (le fichier), une case du plan de test
// (le plan), une case du § A.3 à cocher à la main (le commit de tête de la
// branche) ; null si la cible n'y est pas.
export function targetHash(view: VibeView, target: string): string | null {
  const { note } = view;
  const a3 = /^a3:(\d+)$/.exec(target);
  if (a3) return view.flow === 'create' && view.checklist[Number(a3[1])]?.manual ? view.commits.at(-1)?.hash ?? null : null;
  if (target === 'nothing' && view.flow !== 'create') return null;
  if (target === 'note' || target === 'nothing' || target === 'forme') return note && blobSha(target === 'forme' ? parseNote(note.text).forme : note.text);
  const file = view.invariants.find((f) => target.startsWith(`case:${f.path}:`) && f.cases.includes(target.slice(`case:${f.path}:`.length)));
  if (file) return file.blob;
  const check = /^check:(\d+):(\d+)$/.exec(target);
  const plan = check && view.pr?.number === Number(check[1]) && Number(check[2]) < view.checklist.length
    ? view.outputs[`pr-${check[1]}-ecran.md`] : undefined;
  return plan ? blobSha(plan.text) : null;
}

// Créer : chaque étape faite de view (note, forme, invariants : chacun de leurs cas) reçoit un ✓ pour son
// contenu d'aujourd'hui, les mêmes cibles et empreintes qu'un clic sur ✓ (targetHash) ; un ✓ ou ✗ déjà donné pour ce contenu reste.
export function vibeMarks(marks: Marks, view: VibeView): Marks {
  if (view.flow !== 'create' || !view.note) return marks;
  const done = new Set(view.steps.filter((s) => s.status === 'done').map((s) => s.id));
  const targets: string[] = [];
  if (done.has('note')) targets.push('note');
  if (done.has('forme')) targets.push('forme');
  if (done.has('invariants')) view.invariants.forEach((f) => f.cases.forEach((c) => targets.push(`case:${f.path}:${c}`)));
  return targets.reduce((m, target) => {
    const hash = targetHash(view, target);
    const s = hash && markState(m, target, hash);
    return !hash || s === 'ok' || s === 'ko' ? m : setMark(m, target, hash, 'ok');
  }, marks);
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
