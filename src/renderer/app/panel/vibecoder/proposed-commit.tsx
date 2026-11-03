/** proposed-commit — la carte du commit proposé (commit.md, écrit par Préparer le commit) : le message tel
 *  qu'il sera commité, ✓ Commiter (direct ou via l'agent, F-114), Relancer (commit-prepare), et, si l'action
 *  comment existe, l'IconButton qui cite son sujet dans le champ. Rien sans commit.md, ni en relecteur.
 *  Ne connaît pas : le pont (rappels passés), le disque, git.
 *  Utilisé par : modules-view, forme-view (un fixup de la note ou de la Forme). */
import type { VibeLang } from 'technicals/bridge';
import { IconButton } from './icons';
import { OutputCard, Run } from './step-parts';
import type { StepProps } from './step-views';
import './proposed-commit.css';

const S: Record<VibeLang, { hint: string; quote: string }> = {
  fr: { hint: 'Les fichiers indexés, avec ce message, mot pour mot.', quote: 'Citer le message dans le champ' },
  en: { hint: 'The staged files, with this message, word for word.', quote: 'Quote the message in the field' },
};

// Les actions de la carte : à retirer de l'en-tête de l'étape (StepHead own) quand elle est là.
export const PROPOSED_ACTS = ['commit', 'commit-prepare'];

export function ProposedCommit({ p }: { p: StepProps }) {
  const { view, t, act, busy } = p;
  const commit = view.flow === 'review' ? undefined : view.outputs['commit.md'];
  if (!commit) return null;
  const s = S[view.lang];
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const quote = action('comment') ? (text: string) => act.prefill('comment', text) : undefined;
  return (
    <OutputCard className="vc-proposed" title={t.outputs['commit.md']} file="commit.md" time={commit.time} t={t}
      tools={(
        <>
          {quote ? <IconButton icon="comment" label={s.quote} onClick={() => quote(commit.text.trim().split('\n')[0])} /> : null}
          <Run a={action('commit-prepare')} busy={busy} tone="ghost" label={t.rerun} onRun={() => act.run('commit-prepare')} />
        </>
      )}>
      <pre className="vc-commit-msg">{commit.text.trim()}</pre>
      <div className="vc-commit-foot">
        <Run a={action('commit')} busy={busy} tone="accent" onRun={(x) => act.run('commit', x)} />
        <span>{s.hint}</span>
      </div>
    </OutputCard>
  );
}
