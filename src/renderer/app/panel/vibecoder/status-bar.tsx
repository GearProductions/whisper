/** status-bar — la barre d'état de VibeCoder : modèle, effort et mode de
 *  l'agent (une liste chacun, comme son menu), jauge du contexte (clic : le
 *  détail), ⚙ Tâches (le volet, dans la colonne de la conversation), ⏹
 *  Arrêter quand l'agent travaille, fichiers modifiés, heure du dernier
 *  relevé.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import type { CSSProperties } from 'react';
import { gauge } from 'core/conversation';
import type { Strings } from 'core/vibecoder';
import type { Thread, VibePatch, VibeView } from 'technicals/bridge';

type Props = {
  view: VibeView;
  thread: Thread;
  t: Strings;
  busy: boolean;
  tasksOpen: boolean;
  contextOpen: boolean;
  onSet(patch: VibePatch): void;
  onGauge(): void;
  onTasks(): void;
};

export function StatusBar({ view, thread, t, busy, tasksOpen, contextOpen, onSet, onGauge, onTasks }: Props) {
  const g = gauge(thread.context);
  const running = thread.tasks?.filter((x) => x.status === 'running').length || 0;
  return (
    <div className="vc-status">
      <Choice label={t.model} title={t.modelTitle} value={view.agent.model || ''} options={t.models} onPick={(model) => onSet({ model })} />
      <Choice label={t.effort} title={t.effortTitle} value={view.agent.effort || ''} options={t.efforts} onPick={(effort) => onSet({ effort })} />
      <Choice label={t.mode} title={t.modeTitle} value={view.agent.mode || 'default'} options={t.modes} onPick={(mode) => onSet({ mode })} />
      {/* L'anneau de la jauge de l'en-tête de la conversation (même id, mêmes couleurs). */}
      <button id="context-button" type="button" className="vc-sitem" data-level={g.level} title={t.contextTitle} aria-pressed={contextOpen}
        style={{ '--pct': g.pct } as CSSProperties} onClick={onGauge}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><circle className="ring-bg" cx="18" cy="18" r="15" /><circle className="ring" cx="18" cy="18" r="15" /></svg>
        {g.level === 'unknown' ? t.context : `${t.context} ${g.pct} %`}
      </button>
      <button type="button" className="vc-sitem" title={t.tasksTitle} aria-pressed={tasksOpen} onClick={onTasks}>
        {`⚙ ${t.tasks}${running ? ` (${running})` : ''}`}
      </button>
      {busy ? <button type="button" className="vc-sitem vc-sstop" title={t.stopTitle} onClick={() => onSet({ interrupt: true })}>{t.stop}</button> : null}
      <span className="vc-spacer" />
      {view.repo ? <span className="vc-sinfo">{t.changed(view.repo.changed)}</span> : null}
      <span className="vc-sinfo" title={new Date(view.time).toLocaleString(t.locale)}>
        {t.at(new Date(view.time).toLocaleTimeString(t.locale))}
      </span>
    </div>
  );
}

// Un réglage de l'agent : une liste native, habillée en puce de la barre ; une
// valeur inconnue de la liste y est ajoutée telle quelle.
function Choice({ label, title, value, options, onPick }: {
  label: string; title: string; value: string; options: [string, string][]; onPick(value: string): void;
}) {
  const list = options.some(([v]) => v === value) ? options : [...options, [value, value] as [string, string]];
  return (
    <label className="vc-sitem vc-choice" title={title}>
      <span className="vc-slabel">{label}</span>
      <select value={value} onChange={(e) => onPick(e.target.value)}>
        {list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
