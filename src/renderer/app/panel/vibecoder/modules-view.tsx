/** modules-view — l'étape Modules (Créer), la vue du créateur seul (l'étape n'est plus un arrêt du relecteur : note
 *  0.16.0-revue-essentielle).
 *  En tête, une seule ligne d'état (moduleCounts de core/vibecoder : « 16 modules écrits · commités »), puis un seul arbre et
 *  son diff, en lecture seule (IdeView ; ModuleCode noEdit, diff en ligne, onOpen : une icône Ouvrir dans l'éditeur sur le
 *  fichier affiché ; useCreatorDiff : le diff depuis la base de la branche, ou, au clic sur « modifiée depuis la validation »
 *  de l'en-tête (StepHead onSince), depuis la validation, et retour). Un fichier supprimé depuis la référence : goneModule,
 *  tout en retraits ; un fichier de module pas touché : rien à montrer, plus aucun fichier suivi (act.follow(null)). Sans
 *  module : les fichiers de la branche (ideFiles). Plus rien d'autre : ni boutons (Générer, Relire le diff, Ouvrir en texte,
 *  Prouver, Valider, Commiter), ni commit proposé, ni cartes review.md et preuve.md (le résultat de la preuve est à l'étape
 *  Invariants), ni légende ni compte par état, ni « rien à prouver », ni Vue IDE · Vue liste, ni menu de diff, ni éditeur,
 *  ni Enregistrer, ni accordéon, ni cartes de commits ni Relire les commits. Restent dans le dépôt, sans appel de la page :
 *  le fichier d'un commit (commit-file) et le mode lecture seule de ModuleCode (des tests protégés gardent ce qui les sert).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useEffect } from 'react';
import { goneModule, ideFiles, moduleCounts, type IdeFile, type ModuleCounts } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { useCreatorDiff, type CreatorDiff } from './ide-diff';
import { IdeView } from './ide-view';
import { ModuleCode } from './module-code';
import { Invite, OutputCard, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './modules-view.css';

const s1 = (n: number, one: string, many: string) => (n > 1 ? many : one);

const fr = {
  branchFiles: 'Fichiers de la branche',
  // « 16 modules écrits · commités », « 3 sur 16 modules écrits · pas commités »
  status: ({ total, written, committed }: ModuleCounts) => [
    `${written < total ? `${written} sur ` : ''}${total} ${s1(total, 'module écrit', 'modules écrits')}`,
    committed === total ? s1(total, 'commité', 'commités') : committed ? `${committed} ${s1(committed, 'commité', 'commités')}` : written ? s1(written, 'pas commité', 'pas commités') : '',
  ].filter(Boolean).join(' · '),
  noModule: 'La Forme ne liste aucun module',
  skeleton: 'À générer : encore le squelette de la Forme',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    branchFiles: 'Files of the branch',
    status: ({ total, written, committed }) => [
      `${written < total ? `${written} of ` : ''}${total} ${s1(total, 'module', 'modules')} written`,
      committed === total ? 'committed' : committed ? `${committed} committed` : written ? 'not committed' : '',
    ].filter(Boolean).join(' · '),
    noModule: 'The Shape lists no module',
    skeleton: 'To generate: still the forme\'s skeleton',
  },
};

// À droite, le fichier choisi : son diff (depuis la base, ou la validation), l'icône Ouvrir ; sans code, plus aucun fichier suivi.
// Un fichier supprimé depuis la référence (gone) : un module d'un seul fichier, tout en retraits.
function CreatorBody({ p, file, diff }: { p: StepProps; file: IdeFile | null; diff: CreatorDiff }) {
  const { view, t, act } = p;
  const code = file?.code ?? (file?.gone ? goneModule(file) : null);
  useEffect(() => { if (!code) act.follow(null); }, [file?.path, !!code]);
  return code ? (
    <ModuleCode key={file!.path} m={code} noEdit noTree diff={{ shown: diff.shown, mode: 'inline', step: 'modules' }} code={p.code} t={t} lang={view.lang} open
      onFollow={act.follow} onOpen={act.open} drafts={p.drafts} />
  ) : null;
}

export function ModulesView(p: StepProps) {
  const { view } = p;
  const s = S[view.lang];
  const diff = useCreatorDiff(view, 'modules');
  const all = ideFiles(view, 'file', s.skeleton);
  return (
    <>
      <StepHead p={p} onSince={diff.toggleValidated} />
      {all.length ? (
        <OutputCard className="vc-modules" title={view.modules.length ? s.status(moduleCounts(view.modules)) : s.branchFiles} t={p.t}>
          <div className="vc-mod-ide">
            <IdeView files={diff.filter(all)} empty={diff.empty}>{(file) => <CreatorBody p={p} file={file} diff={diff} />}</IdeView>
          </div>
        </OutputCard>
      ) : <Invite title={s.noModule} />}
    </>
  );
}
