/** modules-view — l'étape Modules (Créer).
 *  Créateur (note 0.16.0-ecran-essentiel), CreatorModules : en tête, une seule ligne d'état (moduleCounts de core/vibecoder :
 *  « 16 modules écrits · commités »), puis un seul arbre et son diff, en lecture seule (IdeView ; ModuleCode noEdit, diff
 *  en ligne, onOpen : une icône Ouvrir dans l'éditeur sur le fichier affiché ; useCreatorDiff : le diff depuis la base de
 *  la branche, ou, au clic sur « modifiée depuis la validation » de l'en-tête (StepHead onSince), depuis la validation,
 *  et retour). Un fichier supprimé depuis la référence : goneModule, tout en retraits ; un fichier de module pas
 *  touché : rien à montrer, plus aucun fichier suivi (act.follow(null)). Sans module : les fichiers de la branche
 *  (ideFiles). Plus rien d'autre : ni boutons (Générer, Relire le diff, Ouvrir en texte, Prouver, Valider, Commiter),
 *  ni commit proposé (proposed-commit : supprimé), ni cartes review.md et preuve.md (le résultat de la preuve est à
 *  l'étape Invariants), ni légende ni compte par état, ni « rien à prouver », ni Vue IDE · Vue liste (view.modulesView
 *  n'est plus lu, act.set modulesView plus envoyé), ni menu de diff, ni éditeur, ni Enregistrer (rien n'est enregistré),
 *  ni accordéon.
 *  Relecteur (view.flow 'review'), ReviewerModules, inchangé : les modules en lecture seule — ni commit.md, ni review.md ;
 *  les actions qui modifient ne sont pas dans son relevé. Une ligne par module de la Forme, un accordéon : point plein
 *  s'il est touché (vert : commité ; accent : modifié, pas encore commité), anneau sinon ; son numéro (l'ordre de la
 *  Forme) ; nom en gras, dossier atténué ; les commits qui le touchent en puces (un clic : son diff dans l'éditeur) ;
 *  Ouvrir au bout de sa ligne ; dessous, son contrat par rubrique (Contract) et, s'il est touché, son code (ModuleCode,
 *  readOnly : motif en titre, ni Enregistrer ni Abandonner). Un seul déplié à la fois, le chemin du module déplié tenu
 *  ici (gardé par agent et par étape, useKept) ; plus aucun fichier suivi quand on replie, ou que le module déplié n'a
 *  pas (ou plus) de fichier. Deux vues, un interrupteur dans les outils de la carte (gardée par agent et par étape,
 *  useKept ; au départ, view.modulesView, act.set({ modulesView })) : la liste, l'accordéon ; la vue IDE (IdeView), l'arborescence
 *  des fichiers des modules, puis des variants de la branche (ideFiles(view, 'file')), leur nom coloré comme VS Code,
 *  et à droite le code du fichier choisi (ModuleCode, noTree), sans menu de diff. Sans module : les fichiers de la
 *  branche, dans les deux vues, sans interrupteur. Puis CommitsSection (commits-view), qui porte elle-même Relire les
 *  commits : 'review-commits' est dans own. Le point d'état de la liste vient de moduleState (core).
 *  La revue essentielle (note 0.16.0-revue-essentielle) : l'étape Modules n'est plus un arrêt du relecteur — cette vue
 *  est celle du créateur seul (CreatorModules, inchangée). Partent : ReviewerModules, ses deux vues (liste, IDE) et
 *  leur interrupteur, le code en lecture seule, les puces de commits, et la section des commits (commits-view,
 *  supprimé : ses cartes, Validé / À revoir par commit, le fichier d'un commit sous sa carte, Relire les commits). Le
 *  paragraphe « Relecteur » ci-dessus ne vaut plus. Restent dans le dépôt, sans appel de la page : le fichier d'un
 *  commit (commit-file) et le mode lecture seule de ModuleCode (des tests protégés gardent ce qui les sert).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useEffect } from 'react';
import { fileParts, goneModule, ideFiles, moduleCommits, moduleCounts, moduleState, type IdeFile, type ModuleCounts, type ModuleState } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { CommitsSection } from './commits-view';
import { Contract } from './forme-view';
import { useCreatorDiff, type CreatorDiff } from './ide-diff';
import { IdeView } from './ide-view';
import { useKept } from './kept-scope';
import { ModuleCode } from './module-code';
import { Invite, OutputCard, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './modules-view.css';

const s1 = (n: number, one: string, many: string) => (n > 1 ? many : one);

const fr = {
  modules: 'Modules de la Forme',
  branchFiles: 'Fichiers de la branche',
  // « 16 modules écrits · commités », « 3 sur 16 modules écrits · pas commités »
  status: ({ total, written, committed }: ModuleCounts) => [
    `${written < total ? `${written} sur ` : ''}${total} ${s1(total, 'module écrit', 'modules écrits')}`,
    committed === total ? s1(total, 'commité', 'commités') : committed ? `${committed} ${s1(committed, 'commité', 'commités')}` : written ? s1(written, 'pas commité', 'pas commités') : '',
  ].filter(Boolean).join(' · '),
  state: { done: 'Commité sur la branche', wip: 'Modifié, pas encore commité', todo: 'Pas encore touché par la branche' } as Record<ModuleState, string>,
  open: 'Ouvrir',
  toCreate: 'à créer',
  rankTitle: (n: number, of: number) => `Ordre de génération : ${n} sur ${of}`,
  readOnly: 'Lecture seule : vous relisez cette PR.',
  noModule: 'La Forme ne liste aucun module',
  noModuleHint: 'Les modules viennent de la rubrique « Forme » de la note : étape Forme, Poser la forme.',
  skeleton: 'À générer : encore le squelette de la Forme',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    modules: 'Modules of the Shape',
    branchFiles: 'Files of the branch',
    status: ({ total, written, committed }) => [
      `${written < total ? `${written} of ` : ''}${total} ${s1(total, 'module', 'modules')} written`,
      committed === total ? 'committed' : committed ? `${committed} committed` : written ? 'not committed' : '',
    ].filter(Boolean).join(' · '),
    state: { done: 'Committed on the branch', wip: 'Changed, not committed yet', todo: 'Not touched by the branch yet' },
    open: 'Open',
    toCreate: 'to create',
    rankTitle: (n, of) => `Generation order: ${n} of ${of}`,
    readOnly: 'Read only: you are reviewing this PR.',
    noModule: 'The Shape lists no module',
    noModuleHint: 'Modules come from the “Forme” section of the note: Shape step, Set the shape.',
    skeleton: 'To generate: still the forme\'s skeleton',
  },
};

export function ModulesView(p: StepProps) {
  return p.view.flow === 'review' ? <ReviewerModules {...p} /> : <CreatorModules {...p} />;
}

// ---- Le créateur : un seul arbre et son diff, en lecture seule ------------------------------------------------------

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

function CreatorModules(p: StepProps) {
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

// ---- Le relecteur : ses modules en lecture seule, ses deux vues, ses commits ----------------------------------------

// Ouvrir un module, sur sa ligne (liste) ou au-dessus de son code (vue IDE) : son fichier, s'il existe.
function OpenTool({ p, file }: { p: StepProps; file: { id: string; path: string } | null | undefined }) {
  const { view, t, act } = p;
  return file ? (
    <div className="vc-mod-acts" onClick={(e) => e.preventDefault()}>
      <button type="button" title={`${t.openTitle} : ${file.path}`} onClick={() => act.open(file.id)}>{S[view.lang].open}</button>
    </div>
  ) : null;
}

// Vue IDE : à droite, du fichier choisi, Ouvrir puis son code ; sans code, plus aucun fichier suivi.
function IdeBody({ p, file }: { p: StepProps; file: IdeFile | null }) {
  const { view, t, act } = p;
  const has = !!file?.code;
  useEffect(() => { if (!has) act.follow(null); }, [file?.path, has]);
  const tools = file && file.rank != null ? <OpenTool p={p} file={view.modules[file.rank].file} /> : null;
  return (
    <>
      {file?.code ? null : tools}
      {file?.code ? (
        <ModuleCode key={file.path} m={file.code} tools={tools} noTree readOnly={S[view.lang].readOnly} code={p.code} t={t} lang={view.lang} open
          onFollow={act.follow} onSave={act.save} onQuote={(block) => act.prefill('comment', block, true)} drafts={p.drafts} />
      ) : null}
    </>
  );
}

function ReviewerModules(p: StepProps) {
  const { view, t, act } = p;
  // Le module déplié et la vue, gardés par agent et par étape (KeptScope) ; la vue part du dernier choix enregistré (view.modulesView).
  const [opened, setOpened] = useKept<string | null>('opened', null);
  const [mode, setMode] = useKept<'ide' | 'list'>('modulesView', view.modulesView === 'ide' ? 'ide' : 'list');
  const s = S[view.lang];
  const files = ideFiles(view, 'file', s.skeleton);
  const hasModules = view.modules.length > 0;
  const ide = mode === 'ide' || !hasModules;   // sans module : les fichiers de la branche, dans les deux vues
  const switchTo = (k: 'ide' | 'list') => { act.follow(null); setMode(k); act.set({ modulesView: k }); };
  // Un seul effet pour replier-sans-fichier : le module déplié n'a pas de fichier, ou n'existe plus.
  const openedFiles = view.modules.find((m) => m.path === opened)?.files?.length ?? 0;
  useEffect(() => { if (!ide && opened && !openedFiles) act.follow(null); }, [ide, opened, openedFiles]);
  return (
    <>
      <StepHead p={p} own={['review-commits']} />
      {hasModules || files.length ? (
        <OutputCard className="vc-modules" title={s.modules} t={t} tools={hasModules ? (
          <div className="vc-seg" role="group" aria-label={`${t.ideView} / ${t.listView}`}>
            {(['ide', 'list'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={k === (ide ? 'ide' : 'list')} onClick={() => switchTo(k)}>{k === 'ide' ? t.ideView : t.listView}</button>
            ))}
          </div>
        ) : undefined}>
          {ide ? (
            <div className="vc-mod-ide">
              <IdeView files={files}>{(file) => <IdeBody p={p} file={file} />}</IdeView>
            </div>
          ) : <ul className="vc-mod-list">
            {view.modules.map((m, i) => {
              const state = moduleState(m);
              const open = opened === m.path;
              const { dir, name } = fileParts(m.path);
              return (
                <li key={`${i}:${m.path}`} className="vc-mod" data-state={state}>
                  <span className="vc-mod-dot" title={s.state[state]} />
                  {/* onToggle part aussi quand open change par les props : seul l'écart est un geste. */}
                  <details className="vc-mod-main" open={open} onToggle={(e) => {
                    const now = e.currentTarget.open;
                    if (now === open) return;
                    setOpened(now ? m.path : null);
                    if (!now) act.follow(null);
                  }}>
                    <summary className="vc-mod-line" title={m.file ? m.file.path : m.path}>
                      <span className="vc-mod-rank" title={s.rankTitle(i + 1, view.modules.length)}>{i + 1}</span>
                      <span className="vc-mod-name vc-mono">{name}</span>
                      <span className="vc-mod-dir vc-mono">{dir}</span>
                      {!m.file && state === 'todo' ? <span className="vc-mod-new">{s.toCreate}</span> : null}
                      {moduleCommits(m, view.commits).map((c) => (
                        <button key={c.hash} type="button" className="vc-chip" data-fixup={c.fixup || undefined}
                          title={`${c.hash.slice(0, 7)} ${c.subject}\n${t.diffTitle}`} onClick={() => act.open(`c${view.commits.indexOf(c)}`)}>
                          {c.hash.slice(0, 7)}
                        </button>
                      ))}
                      {open ? <OpenTool p={p} file={m.file} /> : null}
                    </summary>
                    <Contract text={m.contract} t={t} onOpenLink={act.openLink} />
                    {m.touched ? (
                      <ModuleCode m={m} readOnly={s.readOnly} code={p.code} t={t} lang={view.lang} open={open} onFollow={act.follow} onSave={act.save}
                        onQuote={(block) => act.prefill('comment', block, true)} drafts={p.drafts} />
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ul>}
        </OutputCard>
      ) : <Invite title={s.noModule} text={s.noModuleHint} />}
      <CommitsSection {...p} />
    </>
  );
}
