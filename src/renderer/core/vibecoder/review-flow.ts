/** review-flow — ce que Relire prend de l'utilisateur et passe au principal :
 *  une remarque du brouillon de revue dans les
 *  bornes que le principal accepte (draftVibe : cible d'une ligne, 300
 *  caractères ; texte de 5 000) ; celle d'un fichier d'un commit cite son
 *  chemin et ses lignes en bloc de code (coupées d'abord : la remarque reste),
 *  sur la cible du commit (quoteRemark).
 *  Et si une course retient les autres (isLive).
 *  Et, en relecteur : les remarques d'un élément (remarksAt), le verdict que les marques
 *  proposent (proposedVerdict : il ne fait que proposer ; les cas lus par leur clé, caseKeys de shared/test-cases) et si la revue affichée est celle qu'on
 *  publierait (reviewSent : le texte du brouillon est draftText, de shared/review, celui du principal ;
 *  les blancs de fin et les \r\n ne comptent pas).
 *  La revue essentielle (note 0.16.0-revue-essentielle) : sans carte de commit, plus de verdict par commit —
 *  proposedVerdict ne lit que la note et les tests d'invariants (une marque « commit:<hash> » restée au relevé ne
 *  compte plus) ; quoteRemark part avec la vue des commits (commits-view). Un constat de la relecture du code, mis au
 *  brouillon par sa 💬 :
 *  findingTarget(title: string): string — la cible de sa remarque, « code: <son titre> », sur une ligne et dans la borne
 *  du principal : la même pour le même constat (ses remarques se retrouvent sous lui, remarksAt).
 *  findingDraft(finding: Section): string — le texte qui remplit sa zone de remarque : son titre, puis son détail, coupé
 *  à DRAFT_MAX ; l'utilisateur le corrige, rien n'est ajouté sans son clic.
 *  Ne connaît pas : le DOM, React, le pont, les noms des fichiers de sortie.
 *  Utilisé par : app/panel/vibecoder (note-view, rules-view, findings-view : remark ;
 *  findings-view : findingTarget, findingDraft ; comment-box : DRAFT_MAX ;
 *  review-view, step-parts, vibe-coder : isLive ;
 *  vues du relecteur : remarksAt, proposedVerdict, reviewSent). */
import { draftText, type Verdict } from 'shared/review';
import { caseKeys } from 'shared/test-cases';
import type { VibeComment, VibeRun, VibeView } from 'technicals/bridge';
import { excerpt } from './note';
import type { parseReview, Section } from './outputs';

// Les bornes du principal (draftVibe) : la cible d'une remarque, son texte.
const TARGET_MAX = 300;
export const DRAFT_MAX = 5000;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// Une remarque : sa cible sur une ligne, son texte (vide : la cible), coupés à
// la taille que le principal accepte.
export function remark(target: string, text: string): { target: string; text: string } {
  const t = excerpt(target, TARGET_MAX);
  return { target: t, text: clip(text.trim() || t, DRAFT_MAX) };
}

// Une remarque sur des lignes d'un fichier d'un commit : la cible du commit (comptée sur sa carte),
// le texte = le chemin, les lignes en bloc de code (clôture plus longue que leurs ` : il reste fermé),
// puis la remarque ; les lignes coupées d'abord, pour que la remarque tienne sous DRAFT_MAX.
export function quoteRemark(target: string, path: string, block: string, text: string): { target: string; text: string } {
  const fence = '`'.repeat((block.match(/`+/g) ?? []).reduce((n, b) => Math.max(n, b.length + 1), 3));
  const note = text.trim();
  const lines = clip(block, Math.max(1, DRAFT_MAX - path.length - note.length - 2 * fence.length - 4));
  return remark(target, `${path}\n${fence}\n${lines}\n${fence}\n${note}`);
}

// La cible de la remarque d'un constat de la relecture du code (voir l'en-tête).
export function findingTarget(_title: string): string {
  throw new Error('not implemented');
}

// Le texte qui remplit la zone de remarque d'un constat : son titre, puis son détail (voir l'en-tête).
export function findingDraft(_finding: Section): string {
  throw new Error('not implemented');
}

// Une course qui retient les autres : en cours, en attente d'une autorisation, arrêtée non tranchée.
export const isLive = (state: VibeRun['state'] | null | undefined) => state === 'running' || state === 'asking' || state === 'stopped';

// Les remarques d'un élément, dans l'ordre du brouillon : sa cible comparée telle que remark la coupe.
export const remarksAt = (draft: VibeComment[], target: string): VibeComment[] => {
  const t = remark(target, '').target;
  return draft.filter((c) => c.target === t);
};

// Le verdict que proposent les marques (il ne publie rien) : un À revoir sur la note, un cas d'invariant ou un
// commit → request-changes ; tout validé → approve ; sinon (pas jugé, modifié depuis, rien) null.
export function proposedVerdict(view: VibeView): Verdict | null {
  const marks = [...(view.note ? [view.note.mark] : []), ...view.invariants.flatMap((f) => caseKeys(f.cases).map((k) => (Object.hasOwn(f.marks, k) ? f.marks[k] : null))),
    ...view.commits.map((c) => c.mark ?? null)];
  if (marks.includes('ko')) return 'request-changes';
  return marks.length && marks.every((m) => m === 'ok') ? 'approve' : null;
}

// Le texte comparé : les fins de ligne en \n, sans blancs de fin (l'agent qui publie recopie le brouillon : un saut de ligne final, \r\n).
const trimmed = (s: string) => s.replace(/\r\n/g, '\n').trimEnd();

// La revue affichée est celle qu'on publierait (même verdict, même texte à ces blancs près) ; une revue d'avant (sans verdict ni texte) : non.
export const reviewSent = (review: ReturnType<typeof parseReview>, draft: VibeComment[], verdict: Verdict | null): boolean =>
  !!review && review.verdict !== null && review.body !== null && review.verdict === verdict && trimmed(review.body) === trimmed(draftText(draft));
