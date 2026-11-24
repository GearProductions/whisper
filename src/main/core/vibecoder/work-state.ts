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

const SHOWN = 20; // les fichiers nommés dans la ligne ; au-delà, leur nombre

export function workState(git: { head: string; status: string; staged: string }, hash: (path: string) => string | null): WorkState {
  const index: Record<string, string> = {}; // chemin → ce que l'index en dit (lettre et empreinte git)
  const paths = new Set<string>();
  // diff --cached --raw -z : « :modes modes avant après LETTRE », puis un chemin (deux pour R et C : origine, nouveau).
  const s = git.staged.split('\0');
  for (let i = 0; i < s.length; i++) {
    if (!s[i].startsWith(':')) continue;
    const f = s[i].split(' ');
    const n = /^[RC]/.test(f[4]) ? 2 : 1;
    for (const p of s.slice(i + 1, i + 1 + n)) {
      index[p] = `${f[4]}${f[3]}`;
      paths.add(p);
    }
    i += n;
  }
  // status --porcelain -z : « XY chemin », pour R et C le champ suivant est l'origine ; « !! » : ignoré.
  const t = git.status.split('\0');
  for (let i = 0; i < t.length; i++) {
    const xy = t[i].slice(0, 2);
    if (t[i].length < 4 || xy === '!!') continue;
    paths.add(t[i].slice(3));
    if (/[RC]/.test(xy)) paths.add(t[++i] ?? '');
  }
  const state: WorkState = { HEAD: git.head.trim() };
  for (const p of paths) state[p] = `${hash(p) ?? '-'} ${index[p] ?? ''}`;
  return state;
}

export function touched(before: WorkState, after: WorkState): string[] {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  const files = [...paths].filter((p) => p !== 'HEAD' && before[p] !== after[p]).sort();
  return before.HEAD !== after.HEAD ? ['HEAD', ...files] : files;
}

export function touchedLine(files: string[] | null, lang: VibeLang): string {
  const fr = lang === 'fr';
  if (files === null) return fr ? 'L’état du dossier de travail n’a pas pu être lu : l’action est en échec.' : 'The state of the working folder could not be read: the action failed.';
  const rest = files.length - SHOWN;
  const names = files.slice(0, SHOWN).join(', ') + (rest > 0 ? (fr ? ` et ${rest} autres` : ` and ${rest} more`) : '');
  return fr ? `L’action a touché des fichiers qu’elle ne devait pas changer : ${names}.` : `The action touched files it must not change: ${names}.`;
}
