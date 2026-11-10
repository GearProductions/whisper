/** note-ref — la note de référence du surlignage (« Changée depuis votre dernière relecture », Voir les
 *  modifications) : posée une fois, au premier relevé où l'agent ou une course qui modifie la branche
 *  travaille ; ensuite remplacée par le seul geste de l'utilisateur (Vu, la validation de la note : le
 *  contrôleur la pose lui-même, la note qu'il avait sous les yeux) ; repartie à rien quand la note affichée
 *  change de fichier. Posée sans note (path null) : la première note qui paraît l'adopte, tout y est nouveau.
 *  Ne connaît pas : Electron, le disque, les agents ni les courses (on lui dit si la branche s'écrit).
 *  Utilisé par : app/controllers/vibecoder. */

export type NoteRef = { path: string | null; text: string };

// Au relevé : ref d'après la note du moment (null : pas de note) et `writing` (l'agent, ou une course qui
// modifie la branche, travaille). Sans ref : posée si writing ({ chemin, texte } ; sans note : { null, '' }),
// sinon null. Une ref sans chemin et une note : son chemin adopté, son texte gardé. Une ref d'un autre fichier
// que la note : repartie (null, puis posée si writing). Pas de note : la ref gardée telle quelle.
export function nextRef(ref: NoteRef | null, note: { path: string; text: string } | null, writing: boolean): NoteRef | null {
  void ref; void note; void writing;
  throw new Error('not implemented');
}

// Le texte de référence à montrer (VibeNote.before) : celui de ref, si elle est de ce fichier et que la
// note a changé depuis ; sinon null (rien de surligné).
export function beforeOf(ref: NoteRef | null, note: { path: string; text: string }): string | null {
  void ref; void note;
  throw new Error('not implemented');
}
