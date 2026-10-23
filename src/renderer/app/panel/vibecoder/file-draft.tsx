/** file-draft — la modification gardée d'un fichier suivi, son pied
 *  (Abandonner, Enregistrer) et son éditeur, partagés par les éditeurs du
 *  panneau.
 *  useFileDraft : sans modification en cours, la vue suit le disque (le texte
 *  poussé, s'il est celui du fichier suivi ; le dernier du fichier, par son
 *  chemin, reste affiché quand son id change, jusqu'au prochain) ; une
 *  modification est gardée, par chemin, tant qu'elle n'est pas enregistrée,
 *  jamais jetée sans geste (drafts : tenues au-dessus de l'étape, par
 *  vibe-coder pour l'agent ; changer d'étape ou d'agent ne les jette pas) :
 *  si le disque a changé depuis son début (VibeCode.time), stale (Enregistrer
 *  grisé, Abandonner remet le disque).
 *  Grisé (locked, le motif) : la vue suit le disque, la modification revient
 *  une fois l'édition rendue. Enregistrée : rebasée sur la poussée suivante
 *  (égale, supprimée ; sinon gardée, avec son heure pour base). text null :
 *  rien à montrer ; tooBig : le disque a répondu sans texte (trop gros).
 *  DraftEditor : le fichier dans CodeView (edit) et son pied, ou « fichier
 *  trop gros ».
 *  Ne connaît pas : le pont (rappels passés), le disque, le relevé.
 *  Utilisé par : module-code, invariants-view, note-view ; vibe-coder et
 *  step-views (Drafts). */
import { useEffect, useRef, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { Strings } from 'core/vibecoder';
import type { VibeCode, VibeFile } from 'technicals/bridge';
import { CodeView } from './code-view';

// Les modifications gardées, par chemin : leur texte et l'heure du disque à leur début (null : la prochaine poussée).
export type Drafts = Record<string, { text: string; base: number | null }>;

export type FileDraft = {
  text: string | null;
  draft: boolean;
  stale: boolean;
  tooBig: boolean;
  change(text: string): void;
  save(): Promise<void>;
  drop(): void;
};

export function useFileDraft(file: VibeFile | null, code: VibeCode | null, locked: string | null,
  onSave: (id: string, text: string) => Promise<boolean>,
  [drafts, setDrafts]: readonly [Drafts, Dispatch<SetStateAction<Drafts>>]): FileDraft {
  const pushed = file && code?.id === file.id ? code : null; // un texte poussé pour un autre fichier est ignoré
  // Le dernier texte du fichier, par son chemin : gardé quand son id change, jusqu'au prochain.
  const seen = useRef<{ path: string; code: VibeCode } | null>(null);
  if (file && pushed) seen.current = { path: file.path, code: pushed };
  const disk = file && seen.current?.path === file.path ? seen.current.code : null;
  const draft = file ? drafts[file.path] : undefined;
  const drop = () => { if (file) setDrafts(({ [file.path]: _, ...rest }) => rest); };
  // Le disque a rejoint la modification (enregistrée, ou défaite) : la vue le suit de nouveau.
  useEffect(() => {
    if (draft && draft.text === disk?.text) drop();
  }, [file?.path, draft?.text, disk?.text]);
  // Une modification enregistrée prend pour base l'heure de la poussée suivante (son écriture).
  useEffect(() => {
    if (file && pushed) setDrafts((d) => d[file.path]?.base === null ? { ...d, [file.path]: { ...d[file.path], base: pushed.time } } : d);
  }, [pushed]);

  const text = (locked ? disk?.text : draft?.text ?? disk?.text) ?? null;
  // Le disque a changé depuis le début de la modification : l'enregistrer l'écraserait.
  const stale = !!draft && !!disk && draft.base !== null && disk.time > draft.base;
  const save = async () => {
    if (!file || !draft || locked || stale) return;
    const p = file.path;
    // Enregistrée, elle attend la poussée de son écriture : égale, supprimée (le disque l'a rejointe) ;
    // sinon (tapé depuis), elle y prend sa base.
    if (await onSave(file.id, draft.text)) setDrafts((d) => d[p] ? { ...d, [p]: { ...d[p], base: null } } : d);
  };
  const change = (x: string) => {
    if (file) setDrafts((d) => ({ ...d, [file.path]: { text: x, base: d[file.path] ? d[file.path].base : disk?.time ?? 0 } }));
  };
  return { text, draft: !!draft, stale, tooBig: !!disk && text === null, change, save, drop };
}

/** Le pied d'un éditeur : Abandonner (le disque a changé), Enregistrer (grisé : locked, rien à
 *  enregistrer, ou le disque a changé). */
export function DraftFoot({ d, locked, t }: { d: FileDraft; locked: string | null; t: Strings }): ReactNode {
  return (
    <div className="vc-mod-code-foot">
      {d.stale && !locked ? <button type="button" className="vc-mini" title={t.discardTitle} onClick={d.drop}>{t.discard}</button> : null}
      <button type="button" className="vc-mini" disabled={!!locked || !d.draft || d.stale}
        title={locked ?? (d.stale ? t.changedOnDisk : t.saveTitle)} onClick={d.save}>{t.save}</button>
    </div>
  );
}

/** L'éditeur d'un fichier suivi (CodeView, modifiable) et son pied ; le disque a répondu sans texte : « fichier trop gros ». */
export function DraftEditor({ d, file, locked, t, onQuote }: {
  d: FileDraft; file: VibeFile; locked: string | null; t: Strings;
  onQuote?(block: string, id: 'comment' | 'fix'): void;
}): ReactNode {
  return d.text != null ? (
    <>
      <CodeView key={file.path} code={d.text} path={file.path} t={t} onQuote={onQuote}
        edit={{ locked, onChange: d.change, onSave: d.save }} />
      <DraftFoot d={d} locked={locked} t={t} />
    </>
  ) : d.tooBig ? <div className="vc-empty">{t.tooBig}</div> : null;
}
