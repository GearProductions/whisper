/** permission-card — une demande d'autorisation, au bas du fil : ce qui va
 *  s'exécuter en entier, et trois boutons. onAnswer dit si la réponse est
 *  partie (cf. core/conversation/permission-guard) ; partie, les boutons se grisent.
 *  Ne connaît pas : le pont. Utilisé par : thread. */
import { useState } from 'react';
import type { Decision, Permission } from 'technicals/bridge';

const ACTIONS: [Decision, string, string][] = [['allow', 'allow', 'Autoriser'], ['always', 'allow', 'Toujours autoriser'], ['deny', 'deny', 'Refuser']];

export function PermissionCard({ permission: p, onAnswer }: { permission: Permission; onAnswer: (d: Decision) => boolean }) {
  const [answered, setAnswered] = useState(false);
  return (
    <article className="permission">
      <div className="permission-title">{p.title}</div>
      <pre className="permission-text">{p.text}</pre>
      <div className="permission-always" hidden={!p.always.length}>
        {p.always.length ? `« Toujours autoriser », jusqu'à la fin de cette session : ${p.always.join(', ')}` : ''}
      </div>
      <div className="permission-actions">
        {ACTIONS.map(([act, cls, label]) => (
          <button key={act} type="button" data-act={act} className={cls} disabled={answered}
            hidden={act === 'always' && !p.always.length}
            onClick={() => { if (onAnswer(act)) setAnswered(true); }}>{label}</button>
        ))}
      </div>
    </article>
  );
}
