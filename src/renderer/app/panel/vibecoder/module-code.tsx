/** module-code — le code d'un module touché, dans son accordéon (étape
 *  Modules). Déplié : ses fichiers que la branche change (m.files), par dossier
 *  (filesByDir), à la suite sur une rangée, un supprimé marqué « supprimé » (S,
 *  par lang), et le fichier choisi, gardé tant qu'il est dans m.files (le
 *  premier sinon) ; suivi par son id (onFollow). Déplié ou non, c'est
 *  modules-view qui le tient (open : un seul déplié à la fois) et qui envoie
 *  onFollow(null) quand on replie ou que le module déplié n'a pas de fichier ;
 *  un module déplié qui en a envoie le sien (son id). Le texte suivi et la modification gardée par fichier (drafts,
 *  tenues par vibe-coder), Ctrl+S, Enregistrer et Abandonner : useFileDraft
 *  et DraftEditor (file-draft), grisés si m.locked (le motif en titre) ; readOnly
 *  (le motif) : lecture seule, sans Enregistrer ni Abandonner. Sans
 *  texte du disque : « fichier trop gros ».
 *  Un fichier supprimé, choisi : son diff depuis la base, tout en retraits
 *  (ModuleDiffView(at.base ?? '', ''), en ligne), sans sélecteur, ni éditeur,
 *  ni Enregistrer (rien à éditer) ; le pied de l'éditeur (Abandonner, Enregistrer) est dans
 *  la rangée d'outils du code (footInTools) ; rien tant que code.at n'est pas poussé.
 *  Sinon, au bout de la rangée, un sélecteur (DiffPicker, si le principal a
 *  poussé code.at) : Fichier · Diff depuis la base de la branche · Diff depuis le
 *  dernier commit ; un diff → ModuleDiffView(at.base | at.head ?? '', le
 *  texte affiché, file.path, mode), en texte (I-40) ; avec un diff, En ligne
 *  · Côte à côte (mode, en ligne d'abord) ; depuis la base grisé si at.base
 *  est null et at.head non (trop gros, pas de base : tout serait ajouté ; le
 *  fichier est alors montré). Le choix (sélecteur, En ligne · Côte à côte) est
 *  commun à tous les fichiers, de toutes les étapes, tant que la page vit
 *  (choice), pas enregistré : le diff depuis la base d'abord.
 *  Deux réglages d'affichage, pour la vue IDE (forme-view, modules-view) : noTree
 *  (sans la rangée des fichiers quand il n'y en a qu'un : l'arborescence la remplace)
 *  et tools, en tête de la rangée du sélecteur (la vue IDE de Modules : les boutons
 *  du module et le sélecteur sur une seule ligne).
 *  Ne connaît pas : le pont (rappels passés), le disque, les autres modules,
 *  les actions de la barre d'outils.
 *  Utilisé par : modules-view, forme-view. */
import { useEffect, useState, type ReactNode } from 'react';
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

// Le choix d'affichage, commun à tous les fichiers tant que la page vit : ce qu'on change vaut pour les suivants.
const choice: { shown: Shown; mode: Mode } = { shown: 'base', mode: 'inline' };

export function ModuleCode({ m, code, t, lang, open, onFollow, onSave, onQuote, drafts, readOnly, noTree, tools }: {
  m: VibeModule;
  readOnly?: string;               // le motif : le code ne s'édite pas, et son pied (Enregistrer, Abandonner) est masqué
  lang: VibeLang;
  noTree?: boolean;                // sans la rangée des fichiers quand il n'y en a qu'un
  tools?: ReactNode;               // en tête de la rangée du sélecteur
  open: boolean;
  code: VibeCode | null;
  t: Strings;
  onFollow(id: string | null): void;
  onSave(id: string, text: string): Promise<boolean>;
  onQuote?(block: string): void;
  drafts: StepProps['drafts'];
}): ReactNode {
  const files = m.files ?? [];
  const locked = readOnly ?? m.locked ?? null;
  // Le choix par son chemin : un id (m<rang>/<i>) change de fichier quand la liste change.
  const [chosen, setChosen] = useState<string | null>(null);
  const file = files.find((f) => f.path === chosen) ?? files[0];
  const id = open && file ? file.id : null;

  // null n'est pas envoyé ici : modules-view s'en charge.
  useEffect(() => { if (id) onFollow(id); }, [id]);

  const d = useFileDraft(file ?? null, code, locked, onSave, drafts);
  const [shown, setShownState] = useState<Shown>(choice.shown);
  const [mode, setModeState] = useState<Mode>(choice.mode);
  const setShown = (k: Shown) => { choice.shown = k; setShownState(k); };
  const setMode = (k: Mode) => { choice.mode = k; setModeState(k); };
  const at = file && code?.id === file.id ? code.at : undefined; // note et tests : pas de at
  // Pas de version à la base alors qu'il y en a une au dernier commit (trop grosse, pas de base) : pas de diff
  // depuis la base, il montrerait tout ajouté ; absent des deux (vraiment nouveau) : tout ajouté.
  const noBase = at?.base === null && at.head !== null;
  // Le texte d'avant du diff affiché ; null : le fichier.
  const before = shown !== 'file' && at && d.text != null && !(shown === 'base' && noBase) ? at[shown] ?? '' : null;

  if (!open) return null;
  return (
    <>
      <div className="vc-mod-head">
        {tools}
        {noTree && files.length <= 1 ? null : <div className="vc-mod-tree">
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
        </div>}
        {at && !file?.deleted ? (
          <DiffPicker<'base' | 'head'> options={(['base', 'head'] as const).map((k) => ({ key: k, label: S[lang][k], disabled: k === 'base' && noBase }))}
            shown={shown === 'base' && noBase ? 'file' : shown} onShown={setShown} mode={before != null ? mode : null} onMode={setMode} lang={lang} />
        ) : null}
      </div>
      {file?.deleted ? (at ? <ModuleDiffView before={at.base ?? ''} after="" path={file.path} mode="inline" lang={lang} /> : null)
        : before != null && file ? <ModuleDiffView before={before} after={d.text ?? ''} path={file.path} mode={mode} lang={lang} />
        : file ? <DraftEditor d={d} file={file} locked={locked} t={t} onQuote={onQuote} footInTools noFoot={!!readOnly} /> : null}
    </>
  );
}
