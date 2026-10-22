/** module-code — l'accordéon Voir le code d'un module touché (étape Modules).
 *  Déplié : ses fichiers par dossier (filesByDir) et le fichier choisi
 *  (CodeView), gardé tant qu'il est dans m.files (le premier sinon) ; suivi
 *  par son id (onFollow). Déplié ou non, c'est modules-view qui le tient
 *  (open, onOpen : un seul déplié à la fois) ; replié par l'utilisateur :
 *  onFollow(null) ; replié parce qu'un autre s'ouvre : rien, l'autre envoie
 *  son id. Sans modification en cours, la vue suit le disque (le texte
 *  poussé, s'il est celui du fichier suivi ; le dernier du fichier choisi,
 *  par son chemin, reste affiché jusqu'au prochain quand son id change) ;
 *  une modification est gardée,
 *  par fichier, tant qu'elle n'est pas enregistrée (Ctrl+S ou Enregistrer,
 *  grisés si m.locked, le motif en titre ; grisée, la vue suit le disque),
 *  jamais jetée : si le disque a changé depuis son début (VibeCode.time),
 *  Enregistrer est grisé (« Le fichier a changé sur le disque ») et
 *  Abandonner remet le texte du disque. Enregistrée : rebasée sur la
 *  poussée suivante (égale, supprimée ; sinon gardée, avec son heure pour
 *  base). Texte null : « fichier trop gros ».
 *  Ne connaît pas : le pont (rappels passés), le disque, les autres modules.
 *  Utilisé par : modules-view. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fileParts, filesByDir, type Strings } from 'core/vibecoder';
import type { VibeCode, VibeModule } from 'technicals/bridge';
import { CodeView } from './code-view';

export function ModuleCode({ m, code, t, open, onOpen, onFollow, onSave, onQuote }: {
  m: VibeModule;
  open: boolean;
  onOpen(open: boolean): void;
  code: VibeCode | null;
  t: Strings;
  onFollow(id: string | null): void;
  onSave(id: string, text: string): Promise<boolean>;
  onQuote?(block: string, id: 'comment' | 'fix'): void;
}): ReactNode {
  const files = m.files ?? [];
  const locked = m.locked ?? null;
  // Le choix par son chemin : un id (m<rang>/<i>) change de fichier quand la liste change.
  const [chosen, setChosen] = useState<string | null>(null);
  // Une modification, par chemin : son texte et l'heure du disque à son début (null : la prochaine poussée).
  const [drafts, setDrafts] = useState<Record<string, { text: string; base: number | null }>>({});
  const file = files.find((f) => f.path === chosen) ?? files[0];
  const id = open && file ? file.id : null;

  // null n'est pas envoyé ici : replié parce qu'un autre s'ouvre, c'est l'autre que le principal suit.
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (id === sent.current) return;
    sent.current = id;
    if (id) onFollow(id);
  }, [id]);
  // onToggle part aussi quand open change par les props : seul l'écart avec la prop est un geste.
  const toggle = (now: boolean) => {
    if (now === open) return;
    onOpen(now);
    if (!now) onFollow(null);
  };

  const pushed = file && code?.id === file.id ? code : null; // un texte poussé pour un autre fichier est ignoré
  // Le dernier texte du fichier choisi, par son chemin : gardé quand son id change, jusqu'au prochain.
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

  // Grisé, la vue suit le disque ; la modification revient une fois l'édition rendue.
  const text = locked ? disk?.text : draft?.text ?? disk?.text;
  // Le disque a changé depuis le début de la modification : l'enregistrer l'écraserait.
  const stale = !!draft && !!disk && draft.base !== null && disk.time > draft.base;
  const save = async () => {
    if (!file || !draft || locked || stale) return;
    const p = file.path;
    // Enregistrée, elle attend la poussée de son écriture : égale, supprimée (le disque l'a rejointe) ;
    // sinon (tapé depuis), elle y prend sa base.
    if (await onSave(file.id, draft.text)) setDrafts((d) => d[p] ? { ...d, [p]: { ...d[p], base: null } } : d);
  };

  return (
    <details open={open} className="vc-mod-code" onToggle={(e) => toggle(e.currentTarget.open)}>
      <summary>{t.seeCode}</summary>
      {open ? (
        <>
          <div className="vc-mod-tree">
            {filesByDir(files).map((g) => (
              <div key={g.dir}>
                {g.dir ? <div className="vc-mod-tree-dir vc-mono">{g.dir}</div> : null}
                <ul className="vc-jfiles">
                  {g.files.map((f) => (
                    <li key={f.id}>
                      <button type="button" className="vc-mono" title={f.path} aria-current={f === file || undefined}
                        onClick={() => setChosen(f.path)}>{fileParts(f.path).name}</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {file && text != null ? (
            <>
              <CodeView key={file.path} code={text} path={file.path} t={t} onQuote={onQuote}
                edit={{ locked, onChange: (x) => setDrafts((d) => ({ ...d, [file.path]: { text: x, base: d[file.path] ? d[file.path].base : disk?.time ?? 0 } })), onSave: save }} />
              <div className="vc-mod-code-foot">
                {stale && !locked ? <button type="button" className="vc-mini" title={t.discardTitle} onClick={drop}>{t.discard}</button> : null}
                <button type="button" className="vc-mini" disabled={!!locked || !draft || stale}
                  title={locked ?? (stale ? t.changedOnDisk : t.saveTitle)} onClick={save}>{t.save}</button>
              </div>
            </>
          ) : disk ? <div className="vc-empty">{t.tooBig}</div> : null}
        </>
      ) : null}
    </details>
  );
}
