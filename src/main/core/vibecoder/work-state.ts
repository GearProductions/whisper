/** work-state — l'état du dossier de travail et de l'index d'un projet, pour constater qu'une course n'y a rien
 *  changé (note 0.16.0-controle-en-trois-points : Prouver les invariants garde le terminal entier, une liste de
 *  commandes interdites ne ferme pas tout ; l'appli compare l'état d'avant et celui d'après, une copie de fichier
 *  comprise).
 *  workState(git: { head: string; status: string; staged: string }, hash: (path: string) => string | null): WorkState
 *  — l'état d'après ce que git en dit (head : rev-parse HEAD ; status : status --porcelain -z --untracked-files=all ;
 *  staged : diff --cached --raw --no-abbrev -z) et ce que le disque porte (hash : l'empreinte du contenu d'un chemin
 *  relatif au projet, null : absent) : une signature par chemin que git dit changé, indexé ou pas suivi (un
 *  renommage : ses deux chemins), plus HEAD. Les fichiers que git ignore ne sont pas regardés.
 *  touched(before: WorkState, after: WorkState): string[] — les chemins dont la signature diffère entre les deux
 *  états (apparu, disparu, contenu ou index changé), triés ; HEAD déplacé (un commit) : 'HEAD' en tête ; [] : rien
 *  n'a changé.
 *  touchedLine(files: string[] | null, lang: VibeLang): string — la ligne en tête de la réponse d'une course en
 *  échec pour avoir touché des fichiers qu'elle ne devait pas changer (Prouver les invariants : le dossier de travail
 *  et l'index ; Vérifier l'alignement : les tests d'invariants du départ de la branche) : les fichiers touchés,
 *  nommés ; null : l'état n'a pas pu être lu.
 *  Pur. Ne connaît pas : git ni le disque (textes et empreintes passés), les courses, preuve.md.
 *  Utilisé par : app/controllers (runs : le départ et la fin de la course prove ; ceux de la course align, sur un
 *  état des seuls tests d'invariants du départ de la branche, dressé par l'appelant). */
import type { VibeLang } from 'shared/bridge';

// Par chemin relatif au projet (et 'HEAD') : sa signature.
export type WorkState = Record<string, string>;

export function workState(_git: { head: string; status: string; staged: string }, _hash: (path: string) => string | null): WorkState {
  throw new Error('not implemented');
}

export function touched(_before: WorkState, _after: WorkState): string[] {
  throw new Error('not implemented');
}

export function touchedLine(_files: string[] | null, _lang: VibeLang): string {
  throw new Error('not implemented');
}
