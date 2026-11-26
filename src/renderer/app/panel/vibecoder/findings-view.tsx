/** findings-view — les constats de l'agent sur le code de la PR, pour le relecteur, à l'arrêt « publier », au-dessus du
 *  brouillon de revue (note 0.16.0-revue-essentielle) : la relecture du code en une passe (pr-<n>-commits.md, lue par
 *  findings de core/vibecoder). Une carte : son introduction, puis un constat par titre — son titre, son détail
 *  (MarkdownView, jamais de HTML) et sa 💬. La 💬 ouvre sous le constat une zone de remarque déjà remplie avec lui
 *  (findingDraft), à corriger ; Ajouter la verse au brouillon de revue sur la cible du constat (remark,
 *  findingTarget ; act.draft), Annuler ne fait rien : un constat n'entre au brouillon que par ce geste. Sous chaque
 *  constat, ses remarques déjà au brouillon (remarksAt, DraftRemarks : grisées, crayon, croix). Une relecture sans
 *  constat : son texte seul, aucune 💬. Pas encore de relecture : une phrase qui renvoie à Préparer la revue, sans
 *  bouton. Aucun bouton de lecture (ni Relire les commits, ni Relancer), aucun verdict, aucun code, aucun commit.
 *  FindingsView(p: StepProps): ReactNode
 *  Ne connaît pas : le pont (rappels passés), le créateur (pr-view ne la rend qu'au relecteur), le verdict, la
 *  publication (draft-view).
 *  Utilisé par : pr-view. */
import { useState, type ReactNode } from 'react';
import { findingDraft, findings, findingTarget, remark, remarksAt } from 'core/vibecoder';
import { CommentBox } from './comment-box';
import { DraftRemarks } from './draft-remarks';
import { IconButton } from './icons';
import { MarkdownView } from './markdown-view';
import { OutputCard } from './step-parts';
import type { StepProps } from './step-views';

export function FindingsView({ view, t, act }: StepProps): ReactNode {
  const s = t.essentialReview;
  const { list, intro } = findings(view.pr ? view.outputs[`pr-${view.pr.number}-commits.md`]?.text ?? '' : '');
  return (
    <OutputCard className="vc-findings" t={t} title={s.findingsTitle}>
      {intro || list.length ? null : <div className="vc-empty">{s.findingsEmpty}</div>}
      {intro ? <MarkdownView md={intro} t={t} onOpenLink={act.openLink} /> : null}
      {list.map((f, i) => {
        const target = findingTarget(f.title);
        return (
          <Finding key={`${i}:${f.title}`} f={f} label={s.addRemark} t={t} act={act}
            here={remarksAt(view.draft, target)} onAdd={(text) => act.draft({ add: remark(target, text) })} />
        );
      })}
    </OutputCard>
  );
}

type FindingProps = {
  f: { title: string; body: string }; label: string; t: StepProps['t']; act: StepProps['act'];
  here: StepProps['view']['draft']; onAdd(text: string): void;
};

// Un constat : titre, détail, 💬 qui ouvre la zone remplie avec lui ; ses remarques déjà au brouillon dessous.
function Finding({ f, label, t, act, here, onAdd }: FindingProps) {
  const [writing, setWriting] = useState(false);
  return (
    <div className="vc-finding">
      <div className="vc-q-head">
        <span className="vc-q-title">{f.title}</span>
        <IconButton icon="comment" label={label} pressed={writing} onClick={() => setWriting(!writing)} />
      </div>
      {f.body ? <MarkdownView md={f.body} t={t} onOpenLink={act.openLink} /> : null}
      {here.length ? <DraftRemarks remarks={here} t={t} onOpenLink={act.openLink} onDraft={act.draft} /> : null}
      {writing ? (
        <CommentBox t={t} initial={findingDraft(f)} onCancel={() => setWriting(false)}
          onSave={(text) => { onAdd(text); setWriting(false); }} />
      ) : null}
    </div>
  );
}
