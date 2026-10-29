/** diff-picker — le sélecteur de ce qui est affiché (Fichier, un diff…) et,
 *  quand un diff est affiché (mode non null), le choix En ligne · Côte à côte.
 *  Fichier (clé file) en tête, puis les options (clé, libellé, grisée)
 *  passées par l'appelant ; les textes du sélecteur lui-même (son titre,
 *  Fichier, celui du choix, En ligne, Côte à côte) sont ici, par lang. Classes vc-mod-bar, vc-mod-shown, vc-seg
 *  (vibecoder.css).
 *  Ne connaît pas : le pont, le relevé, les textes affichés.
 *  Utilisé par : module-code, invariants-view, commit-file. */
import type { ReactNode } from 'react';
import type { VibeLang } from 'technicals/bridge';

type Mode = 'inline' | 'split';

const S: Record<VibeLang, Record<Mode | 'pick' | 'file' | 'mode', string>> = {
  fr: { pick: 'Ce qui est affiché', file: 'Fichier', mode: 'Affichage du diff', inline: 'En ligne', split: 'Côte à côte' },
  en: { pick: 'What is shown', file: 'File', mode: 'Diff layout', inline: 'Inline', split: 'Side by side' },
};

export function DiffPicker<K extends string>({ options, shown, onShown, mode, onMode, lang }: {
  options: { key: K; label: string; disabled?: boolean }[];   // après Fichier
  shown: K | 'file';
  onShown(k: K | 'file'): void;
  mode: Mode | null;                           // null : pas de diff affiché, pas de choix
  onMode(m: Mode): void;
  lang: VibeLang;
}): ReactNode {
  return (
    <div className="vc-mod-bar">
      <select className="vc-mod-shown" value={shown} title={S[lang].pick} aria-label={S[lang].pick}
        onChange={(e) => onShown(e.target.value as K)}>
        <option value="file">{S[lang].file}</option>
        {options.map((o) => <option key={o.key} value={o.key} disabled={o.disabled}>{o.label}</option>)}
      </select>
      {mode ? (
        <div className="vc-seg" role="group" aria-label={S[lang].mode}>
          {(['inline', 'split'] as Mode[]).map((k) => (
            <button key={k} type="button" aria-pressed={k === mode} onClick={() => onMode(k)}>{S[lang][k]}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
