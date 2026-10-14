/** tasks-pane — le volet « Tâches », à droite du fil : les tâches de fond de
 *  l'agent, les plus récentes en haut (état, type, temps, description et
 *  commande avec leurs liens, avancement, résumé, sortie). Il ne fait rien :
 *  il montre.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import { Linkified } from 'core/ui';
import { elapsed } from 'helpers';
import type { TaskStatus, TaskView } from 'technicals/bridge';

const MARK: Record<TaskStatus, string> = { running: '●', completed: '✓', failed: '✕', stopped: '■' };

type Props = { tasks: TaskView[]; onOpenLink(url: string): void; onShowFile(path: string): void };

export function TasksPane({ tasks, onOpenLink, onShowFile }: Props) {
  return (
    <aside id="tasks" className="scroll">
      {tasks.length ? tasks.map((t) => (
        <section key={t.id} className="task" data-status={t.status}>
          <div className="task-head">
            <span className="mark">{MARK[t.status]}</span>
            <span className="kind">{t.kind}</span>
            <span className="elapsed">{elapsed((t.ended ?? Date.now()) - t.started)}</span>
          </div>
          <div className="task-text"><Linkified text={t.description} onOpen={onOpenLink} /></div>
          {t.command ? <code><Linkified text={t.command} onOpen={onOpenLink} /></code> : null}
          {t.progress ? <div className="task-line">{t.progress}</div> : null}
          {t.summary ? <div className="task-line">{t.summary}</div> : null}
          {t.output ? (
            <details open={t.status === 'running'}>
              <summary>Sortie</summary>
              <pre>{t.output}</pre>
            </details>
          ) : null}
          {t.outputFile ? <button type="button" onClick={() => onShowFile(t.outputFile!)}>Montrer le fichier</button> : null}
        </section>
      )) : <div className="hint">Aucune tâche de fond pour l'instant.</div>}
    </aside>
  );
}
