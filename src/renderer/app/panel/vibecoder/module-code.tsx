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
 *  diff (la vue IDE, note 0.15.0-ecran-statuts) : le choix vient du menu de la vue (useIdeDiff), sans
 *  sélecteur propre ni choice ; base, head ou validated → ModuleDiffView(at.base | at.head |
 *  at.validations[step] ?? '', le texte), en `mode` du menu ; une référence absente ou null : tout ajouté ; un fichier
 *  supprimé (deleted) : tout en retraits depuis cette référence (la base si file) ; file : l'éditeur. Sans diff
 *  (la liste de Modules) : comme avant.
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : noEdit (le créateur, toujours avec diff : useCreatorDiff de
 *  l'étape Modules), le code se lit, il ne se modifie plus — ni éditeur, ni Enregistrer, ni Abandonner, ni sélecteur,
 *  ni 💬 sur ses lignes, ni tools ; le diff en ligne depuis diff.shown ('base' ou 'validated'), tout ajouté si la
 *  référence manque, tout en retraits pour un supprimé ; le texte pas encore poussé ou trop gros : le dire, sans
 *  éditeur. onOpen (facultatif) : Ouvrir dans l'éditeur du développeur, une icône discrète sur le fichier affiché
 *  (act.open). Sans noEdit (le relecteur) : comme avant, en lecture seule — sans diff, son sélecteur ; avec diff, le
 *  menu de sa vue (useIdeDiff à l'étape Invariants : Fichier, la référence choisie, En ligne · Côte à côte).
 *  Ne connaît pas : le pont (rappels passés), le disque, les autres modules,
 *  les actions de la barre d'outils.
 *  Utilisé par : modules-view ; forme-view, invariants-view (le relecteur). */
import { useEffect, useState, type ReactNode } from 'react';
import { fileParts, filesByDir, type Strings } from 'core/vibecoder';
import type { VibeCode, VibeDiffStep, VibeLang, VibeModule } from 'technicals/bridge';
import type { DiffRef } from 'core/vibecoder';
import { DiffPicker } from './diff-picker';
import { IconButton } from './icons';
import { ModuleDiffView } from './module-diff-view';
import { DraftEditor, useFileDraft } from './file-draft';
import type { StepProps } from './step-views';

type Shown = 'file' | 'base' | 'head';
type Mode = 'inline' | 'split';

const S: Record<VibeLang, Record<Exclude<Shown, 'file'> | 'deleted' | 'loading', string>> = {
  fr: { base: 'Diff depuis la base de la branche', head: 'Diff depuis le dernier commit', deleted: 'supprimé', loading: 'Chargement du fichier…' },
  en: { base: 'Diff since the branch base', head: 'Diff since the last commit', deleted: 'deleted', loading: 'Loading the file…' },
};

// Le choix d'affichage, commun à tous les fichiers tant que la page vit : ce qu'on change vaut pour les suivants.
const choice: { shown: Shown; mode: Mode } = { shown: 'base', mode: 'inline' };

export function ModuleCode({ m, code, t, lang, open, onFollow, onSave, onQuote, onOpen, drafts, readOnly, noTree, tools, diff, noEdit }: {
  m: VibeModule;
  readOnly?: string;               // le motif : le code ne s'édite pas, et son pied (Enregistrer, Abandonner) est masqué
  lang: VibeLang;
  noTree?: boolean;                // sans la rangée des fichiers quand il n'y en a qu'un
  tools?: ReactNode;               // en tête de la rangée du sélecteur
  diff?: { shown: 'file' | DiffRef; mode: Mode; step: VibeDiffStep };   // le menu de la vue IDE ; absent : son sélecteur
  noEdit?: boolean;                // le créateur : le code se lit seulement, jamais d'éditeur (avec diff, en ligne)
  open: boolean;
  code: VibeCode | null;
  t: Strings;
  onFollow(id: string | null): void;
  onSave?(id: string, text: string): Promise<boolean>;   // absent avec noEdit : rien ne s'enregistre
  onQuote?(block: string): void;
  onOpen?(id: string): void;       // Ouvrir dans l'éditeur : l'icône du fichier affiché ; absent : pas d'icône
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
  // Le texte d'une référence ; absent ou null : '' (tout ajouté).
  const refText = (r: DiffRef) => (r === 'validated' ? at?.validations?.[diff!.step] : at?.[r]) ?? '';
  // Avec diff, le menu de la vue décide (même depuis une base absente) ; sans, le sélecteur de ce composant.
  const ref: Shown | 'validated' = diff ? diff.shown : shown;
  const dmode = noEdit ? 'inline' : diff ? diff.mode : mode;   // noEdit : toujours en ligne
  // Le texte d'avant du diff affiché ; null : le fichier.
  const before = ref !== 'file' && (at || noEdit) && d.text != null && (diff || !(ref === 'base' && noBase)) ? refText(ref) : null;

  if (!open) return null;
  return (
    <>
      <div className="vc-mod-head">
        {noEdit ? null : tools}
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
        {at && !file?.deleted && !diff ? (
          <DiffPicker<'base' | 'head'> options={(['base', 'head'] as const).map((k) => ({ key: k, label: S[lang][k], disabled: k === 'base' && noBase }))}
            shown={shown === 'base' && noBase ? 'file' : shown} onShown={setShown} mode={before != null ? mode : null} onMode={setMode} lang={lang} />
        ) : null}
        {onOpen && file && !file.deleted ? <IconButton icon="open" label={t.openTitle} className="vc-mod-open" onClick={() => onOpen(file.id)} /> : null}
      </div>
      {file?.deleted ? (at ? <ModuleDiffView before={refText(diff && ref !== 'file' ? ref : 'base')} after="" path={file.path} mode={diff ? dmode : 'inline'} lang={lang} /> : null)
        : before != null && file ? <ModuleDiffView before={before} after={d.text ?? ''} path={file.path} mode={dmode} lang={lang} />
        : noEdit ? (file ? <div className="vc-empty">{d.tooBig ? t.tooBig : S[lang].loading}</div> : null)
        : file ? <DraftEditor d={d} file={file} locked={locked} t={t} onQuote={onQuote} footInTools noFoot={!!readOnly} /> : null}
    </>
  );
}
