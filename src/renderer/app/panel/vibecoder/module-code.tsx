/** module-code — l'accordéon Voir le code d'un module touché (étape Modules).
 *  Déplié : ses fichiers que la branche change (m.files), par dossier
 *  (filesByDir), un supprimé marqué « supprimé » (S, par lang), et le fichier
 *  choisi, gardé tant qu'il est dans m.files (le premier sinon) ; suivi par
 *  son id (onFollow). Déplié ou non, c'est modules-view qui le tient (open,
 *  onOpen : un seul déplié à la fois) ; replié par l'utilisateur :
 *  onFollow(null) ; replié parce qu'un autre s'ouvre : rien, l'autre envoie
 *  son id. Le texte suivi et la modification gardée par fichier (drafts,
 *  tenues par vibe-coder), Ctrl+S, Enregistrer et Abandonner : useFileDraft
 *  et DraftEditor (file-draft), grisés si m.locked (le motif en titre). Sans
 *  texte du disque : « fichier trop gros ».
 *  Un fichier supprimé, choisi : son diff depuis la base, tout en retraits
 *  (ModuleDiffView(at.base ?? '', ''), en ligne), sans sélecteur, ni éditeur,
 *  ni Enregistrer (rien à éditer) ; rien tant que code.at n'est pas poussé.
 *  Sinon, sous l'arbre, un sélecteur (DiffPicker, si le principal a poussé
 *  code.at) : Fichier · Diff depuis la base de la branche · Diff depuis le
 *  dernier commit ; un diff → ModuleDiffView(at.base | at.head ?? '', le
 *  texte affiché, file.path, mode), en texte (I-40) ; avec un diff, En ligne
 *  · Côte à côte (mode, en ligne d'abord) ; depuis la base grisé si at.base
 *  est null et at.head non (trop gros, pas de base : tout serait ajouté). En
 *  dessous, la barre d'outils du module (tools, passée par modules-view).
 *  Ne connaît pas : le pont (rappels passés), le disque, les autres modules,
 *  les actions de la barre d'outils.
 *  Utilisé par : modules-view. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fileParts, filesByDir, type Strings } from 'core/vibecoder';
import type { VibeCode, VibeLang, VibeModule } from 'technicals/bridge';
import { DiffPicker } from './diff-picker';
import { ModuleDiffView } from './module-diff-view';
import { DraftEditor, useFileDraft } from './file-draft';
import type { StepProps } from './step-views';

type Shown = 'file' | 'base' | 'head';
type Mode = 'inline' | 'split';

const S: Record<VibeLang, Record<Exclude<Shown, 'file'> | 'deleted', string>> = {
  fr: { base: 'Diff depuis la base de la branche', head: 'Diff depuis le dernier commit', deleted: 'supprimé' },
  en: { base: 'Diff since the branch base', head: 'Diff since the last commit', deleted: 'deleted' },
};

export function ModuleCode({ m, code, t, lang, open, onOpen, onFollow, onSave, onQuote, drafts, tools }: {
  m: VibeModule;
  lang: VibeLang;
  tools?: ReactNode;                           // la barre d'outils du module, sous le code
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
  const [shown, setShown] = useState<Shown>('file');
  const [mode, setMode] = useState<Mode>('inline');
  const at = file && code?.id === file.id ? code.at : undefined; // note et tests : pas de at
  // Pas de version à la base alors qu'il y en a une au dernier commit (trop grosse, pas de base) : pas de diff
  // depuis la base, il montrerait tout ajouté ; absent des deux (vraiment nouveau) : tout ajouté.
  const noBase = at?.base === null && at.head !== null;
  // Le texte d'avant du diff affiché ; null : le fichier.
  const before = shown !== 'file' && at && d.text != null && !(shown === 'base' && noBase) ? at[shown] ?? '' : null;

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
                        onClick={() => setChosen(f.path)}>{fileParts(f.path).name}
                        {f.deleted ? <span className="vc-mod-gone">{S[lang].deleted}</span> : null}</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {file?.deleted ? (at ? <ModuleDiffView before={at.base ?? ''} after="" path={file.path} mode="inline" lang={lang} /> : null) : (
            <>
              {at ? (
                <DiffPicker<'base' | 'head'> options={(['base', 'head'] as const).map((k) => ({ key: k, label: S[lang][k], disabled: k === 'base' && noBase }))}
                  shown={shown} onShown={setShown} mode={before != null ? mode : null} onMode={setMode} lang={lang} />
              ) : null}
              {before != null && file ? <ModuleDiffView before={before} after={d.text ?? ''} path={file.path} mode={mode} lang={lang} />
                : file ? <DraftEditor d={d} file={file} locked={locked} t={t} onQuote={onQuote} /> : null}
            </>
          )}
          {tools}
        </>
      ) : null}
    </details>
  );
}
