/** ide-diff — le menu de diff d'une vue IDE (note 0.15.0-ecran-statuts) : un DiffPicker pour toute la vue —
 *  Fichier · Depuis la base de la branche (par défaut) · Depuis le dernier commit · Depuis la validation (si
 *  l'étape en a une, diffRefs) — et, avec un diff, En ligne · Côte à côte. Tant que la branche n'a aucun commit à elle
 *  (view.commits vide : la note, la Forme, les invariants pas encore commités), Depuis le dernier commit est grisé, la
 *  base et le dernier commit étant le même point ; grisé aussi quand rien ne diffère du dernier commit (view.diffs.head
 *  vide) ; la référence gardée y retombe sur la base. La référence filtre l'arborescence
 *  (diffTree) ; Fichier garde le filtre de la dernière référence. Gardé par agent et par étape (useKept) ;
 *  showValidated passe sur Depuis la validation (le clic sur « modifiée depuis la validation » de StepHead).
 *  Ne connaît pas : le pont, le disque, les marques (step.check et view.diffs du relevé).
 *  Utilisé par : forme-view, modules-view, invariants-view. */
import type { ReactNode } from 'react';
import { diffRefs, diffTree, type DiffRef, type IdeFile } from 'core/vibecoder';
import type { VibeDiffStep, VibeLang, VibeView } from 'technicals/bridge';
import { DiffPicker } from './diff-picker';
import { useKept } from './kept-scope';

const S: Record<VibeLang, Record<DiffRef, { label: string; empty: string; none?: string; clean?: string }>> = {
  fr: {
    base: { label: 'Depuis la base de la branche', empty: 'Rien de modifié depuis la base de la branche' },
    head: { label: 'Depuis le dernier commit', empty: 'Rien de modifié depuis le dernier commit', none: 'Depuis le dernier commit (pas encore de commit)', clean: 'Depuis le dernier commit (rien de modifié)' },
    validated: { label: 'Depuis la validation', empty: 'Rien de modifié depuis la validation' },
  },
  en: {
    base: { label: 'Since the branch base', empty: 'Nothing changed since the branch base' },
    head: { label: 'Since the last commit', empty: 'Nothing changed since the last commit', none: 'Since the last commit (no commit yet)', clean: 'Since the last commit (nothing changed)' },
    validated: { label: 'Since the validation', empty: 'Nothing changed since the validation' },
  },
};

export type IdeDiff = {
  shown: 'file' | DiffRef;          // ce que montre le fichier choisi
  ref: DiffRef;                      // la référence du filtre (la dernière choisie)
  mode: 'inline' | 'split';
  bar: ReactNode;                    // le DiffPicker, pour IdeView bar
  filter(files: IdeFile[]): IdeFile[];   // diffTree pour ref
  empty: string;                     // « Rien de modifié depuis … » (IdeView empty), d'après ref
  showValidated(): void;             // Depuis la validation, si offert
};

export function useIdeDiff(view: VibeView, step: VibeDiffStep): IdeDiff {
  const [keptShown, setShown] = useKept<'file' | DiffRef>('ide-diff-shown', 'base');
  const [keptRef, setRef] = useKept<DiffRef>('ide-diff-ref', 'base');
  const [mode, setMode] = useKept<'inline' | 'split'>('ide-diff-mode', 'inline');
  const refs = diffRefs(view, step);
  // La validation a disparu : la référence gardée retombe sur la base.
  const noCommit = !view.commits?.length;   // aucun commit sur la branche : le dernier commit est la base
  const clean = !view.diffs?.head.length;   // rien ne diffère du dernier commit
  const headOff = noCommit || clean;
  const fit = (r: DiffRef) => (refs.includes(r) && !(r === 'head' && headOff) ? r : 'base');
  const ref = fit(keptRef);
  const shown = keptShown === 'file' ? 'file' : fit(keptShown);
  const s = S[view.lang];
  const pick = (k: 'file' | DiffRef) => { setShown(k); if (k !== 'file') setRef(k); };
  return {
    shown, ref, mode,
    bar: <DiffPicker<DiffRef> options={refs.map((k) => (k === 'head' && headOff ? { key: k, label: noCommit ? s[k].none! : s[k].clean!, disabled: true } : { key: k, label: s[k].label }))} shown={shown} onShown={pick}
      mode={shown === 'file' ? null : mode} onMode={setMode} lang={view.lang} />,
    filter: (files) => diffTree(files, view, step, ref, view.lang === 'en' ? 'Changed, but not declared in the forme' : 'Modifié, mais non déclaré dans la Forme'),
    empty: s[ref].empty,
    showValidated: () => { if (refs.includes('validated')) pick('validated'); },
  };
}
