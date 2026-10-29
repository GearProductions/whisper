/** commit-file — un fichier d'un commit (étape Commits, Relire), ouvert sous
 *  sa carte : le texte poussé pour file.id seulement (un autre : rien encore) ;
 *  un sélecteur (DiffPicker, si code.at) Fichier · Diff de ce commit
 *  (at.commit.before ?? '' → after ?? '') · Diff depuis
 *  la base de la PR (at.base ?? '' → at.head ?? '') ; avec un diff, En ligne ·
 *  Côte à côte (en ligne d'abord). Fichier : CodeView en lecture seule (sans
 *  edit, ni Enregistrer ni Ctrl+S), fix false, 💬 → onQuote(block) ; un diff :
 *  ModuleDiffView ; text null : « absent à la tête de la PR, ou trop gros ».
 *  En texte, jamais en HTML (I-40). Libellés ici, par lang.
 *  Ne connaît pas : le pont, git, le brouillon.
 *  Utilisé par : commits-view. */
import { useState, type ReactElement } from 'react';
import type { Strings } from 'core/vibecoder';
import type { VibeCode, VibeFile, VibeLang } from 'technicals/bridge';
import { CodeView } from './code-view';
import { DiffPicker } from './diff-picker';
import { ModuleDiffView } from './module-diff-view';

type Shown = 'file' | 'commit' | 'base';

const S: Record<VibeLang, Record<Exclude<Shown, 'file'> | 'none', string>> = {
  fr: { commit: 'Diff de ce commit', base: 'Diff depuis la base de la PR', none: 'Absent à la tête de la PR, ou trop gros.' },
  en: { commit: 'Diff of this commit', base: 'Diff since the PR base', none: 'Missing at the PR head, or too big.' },
};

export function CommitFile({ file, code, lang, t, onQuote }: {
  file: VibeFile;
  code: VibeCode | null;
  lang: VibeLang;
  t: Strings;
  onQuote(block: string): void;
}): ReactElement {
  const [shown, setShown] = useState<Shown>('file');
  const [mode, setMode] = useState<'inline' | 'split'>('inline');
  const mine = code?.id === file.id ? code : null;
  const at = mine?.at;
  // Le diff affiché, avant → après ; null : le fichier.
  const diff = !at || shown === 'file' ? null
    : shown === 'commit' ? [at.commit?.before ?? '', at.commit?.after ?? '']
    : [at.base ?? '', at.head ?? ''];

  return (
    <>
      {at ? (
        <DiffPicker<'commit' | 'base'> options={(['commit', 'base'] as const).map((k) => (
          { key: k, label: S[lang][k] }))}
          shown={shown} onShown={setShown} mode={diff ? mode : null} onMode={setMode} lang={lang} />
      ) : null}
      {!mine ? null
        : diff ? <ModuleDiffView before={diff[0]} after={diff[1]} path={file.path} mode={mode} lang={lang} />
        : mine.text != null ? <CodeView code={mine.text} path={file.path} fix={false} t={t} onQuote={(block) => onQuote(block)} />
        : <div className="vc-empty">{S[lang].none}</div>}
    </>
  );
}
