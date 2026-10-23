/** module-code — l'accordéon Voir le code d'un module touché (étape Modules).
 *  Déplié : ses fichiers par dossier (filesByDir) et le fichier choisi
 *  (CodeView), gardé tant qu'il est dans m.files (le premier sinon) ; suivi
 *  par son id (onFollow). Déplié ou non, c'est modules-view qui le tient
 *  (open, onOpen : un seul déplié à la fois) ; replié par l'utilisateur :
 *  onFollow(null) ; replié parce qu'un autre s'ouvre : rien, l'autre envoie
 *  son id. Le texte suivi et la modification gardée par fichier (drafts,
 *  tenues par vibe-coder), Ctrl+S, Enregistrer et Abandonner : useFileDraft
 *  et DraftEditor (file-draft), grisés si m.locked (le motif en titre). Sans
 *  texte du disque : « fichier trop gros ».
 *  Ne connaît pas : le pont (rappels passés), le disque, les autres modules.
 *  Utilisé par : modules-view. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fileParts, filesByDir, type Strings } from 'core/vibecoder';
import type { VibeCode, VibeModule } from 'technicals/bridge';
import { DraftEditor, useFileDraft } from './file-draft';
import type { StepProps } from './step-views';

export function ModuleCode({ m, code, t, open, onOpen, onFollow, onSave, onQuote, drafts }: {
  m: VibeModule;
  open: boolean;
  onOpen(open: boolean): void;
  code: VibeCode | null;
  t: Strings;
  onFollow(id: string | null): void;
  onSave(id: string, text: string): Promise<boolean>;
  onQuote?(block: string, id: 'comment' | 'fix'): void;
  drafts: StepProps['drafts'];
}): ReactNode {
  const files = m.files ?? [];
  const locked = m.locked ?? null;
  // Le choix par son chemin : un id (m<rang>/<i>) change de fichier quand la liste change.
  const [chosen, setChosen] = useState<string | null>(null);
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

  const d = useFileDraft(file ?? null, code, locked, onSave, drafts);

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
          {file ? <DraftEditor d={d} file={file} locked={locked} t={t} onQuote={onQuote} /> : null}
        </>
      ) : null}
    </details>
  );
}
