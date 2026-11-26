/** readings — les lectures de la revue d'une PR (note 0.16.0-revue-essentielle) : les cinq lectures que
 *  « Préparer la revue » lance pour le relecteur, la marque qui retient d'où chacune est partie, et celles qu'il reste à
 *  lancer. Tout est une lecture : aucune n'édite, ne génère ni ne commite.
 *  READINGS: readonly string[] — les ids de leurs actions, dans l'ordre où elles partent : review-note (la relecture de
 *  la note, pr-<n>-note.md), read-invariants (le pseudo-code des tests, invariants/<blob>.md), align (l'alignement,
 *  align.md et liens.md), review-commits (la relecture du code, pr-<n>-commits.md), screen (le plan de test, ecran.md).
 *  readEnd(marks: Marks, end: ReadEnd): Marks — la fin d'une de ces lectures : finie ('done'), la cible
 *  « read:<action> » des marques porte le commit de tête d'où elle est partie (end.head, retenu par l'appelant à son
 *  départ, qu'elle vienne de l'écran, de la CLI ou de la file) ; en échec, arrêtée, ou la tête inconnue (null : l'appli
 *  relancée entre-temps) : marks tel quel, elle sera relancée. Une marque d'avant, pour une autre tête, est remplacée.
 *  La page ne pose jamais cette cible (targetHash de marks ne la connaît pas).
 *  toPrepare(input: PrepareInput): string[] — celles que « Préparer la revue » lancerait maintenant, dans l'ordre de
 *  READINGS : sa sortie manque, ou sa marque « read:<action> » ne porte pas la tête d'aujourd'hui (lue sur une autre
 *  tête de la PR, jamais finie) ; read-invariants suit l'empreinte de ses tests et non la tête (unread : un cas pas lu
 *  ou à lecture périmée) ; jamais une lecture en cours ou en file (live) ; review-note seulement si la PR a une note,
 *  read-invariants seulement si elle a des tests d'invariants ; sans PR chargée (pr null : pas de PR suivie, ou le
 *  dossier ailleurs que sur sa tête) : aucune. Rien n'est comparé à une heure : seulement des commits et des empreintes.
 *  Ne connaît pas : Electron, le disque, git (la tête est passée), les courses (leur fin et leur état sont passés), qui
 *  lance une lecture.
 *  Utilisé par : core/vibecoder (journey : toPrepare), app/controllers/vibecoder (READINGS, readEnd). */
import { setMark, type Marks } from './marks';

export const READINGS: readonly string[] = ['review-note', 'read-invariants', 'align', 'review-commits', 'screen'];

// La fin d'une lecture : son action, comment elle a fini, le commit de tête d'où elle est partie (null : pas retenu).
export type ReadEnd = { action: string; state: 'done' | 'failed' | 'stopped'; head: string | null };

export function readEnd(marks: Marks, { action, state, head }: ReadEnd): Marks {
  return state === 'done' && head !== null && READINGS.includes(action) ? setMark(marks, `read:${action}`, head, 'ok') : marks;
}

export type PrepareInput = {
  pr: number | null;            // la PR suivie, chargée, le dossier sur sa tête ; null : rien à préparer
  head: string | null;          // le commit de tête de la PR (le dernier du relevé) ; null : inconnu
  marks: Marks;                 // les marques de l'agent (« read:<action> »)
  outputs: readonly string[];   // les noms des sorties présentes (pr-<n>-note.md, align.md, liens.md, pr-<n>-commits.md, ecran.md)
  note: boolean;                // la PR a une note
  tests: number;                // ses fichiers de tests d'invariants
  unread: boolean;              // un cas d'un test d'invariant pas lu, ou à lecture périmée
  live: readonly string[];      // les actions en cours, arrêtées pas tranchées, ou en file
};

export function toPrepare({ pr, head, marks, outputs, note, tests, unread, live }: PrepareInput): string[] {
  if (pr === null) return [];
  const has = (name: string) => outputs.includes(name);
  const readAt = (action: string) => Object.hasOwn(marks, `read:${action}`) && marks[`read:${action}`].hash === head;
  // La sortie présente et lue sur la tête d'aujourd'hui (head null : jamais, une tête inconnue ne se compare à rien).
  const todo: Record<string, boolean> = {
    'review-note': note && !(has(`pr-${pr}-note.md`) && readAt('review-note')),
    'read-invariants': tests > 0 && unread,
    align: !(has('align.md') && has('liens.md') && readAt('align')),
    'review-commits': !(has(`pr-${pr}-commits.md`) && readAt('review-commits')),
    screen: !(has('ecran.md') && readAt('screen')),
  };
  return READINGS.filter((a) => todo[a] && !live.includes(a));
}
