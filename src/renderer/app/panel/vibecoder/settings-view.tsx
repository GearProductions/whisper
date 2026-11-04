/** settings-view — la page des réglages, par-dessus l'écran au centre comme la palette : à gauche les
 *  catégories, à droite les éléments de la choisie, chacun selon sa sorte (liste, case, champ, nombre,
 *  micro, info, bouton). Elle ne garde que la catégorie choisie ; un champ ou un nombre s'écrit en le
 *  quittant ou par Entrée (pas à chaque frappe), une liste ou une case tout de suite. Échap ou un clic
 *  dehors : onClose. Une info vide : son « introuvable » ; `downloading:<n>` : le téléchargement de whisper.
 *  Ne connaît pas : le pont (que des rappels), ce qui est valide (le principal décide, la page relue
 *  s'affiche). Utilisé par : panel-app (par vibecoder/index.ts). */
import { useState } from 'react';
import type { FixedSettingKey, Strings } from 'core/vibecoder';
import type { MicDevice, SettingItem, SettingKey, SettingsCommand, SettingsView as View } from 'technicals/bridge';
import './settings-view.css';

type Props = {
  view: View; mics: MicDevice[]; t: Strings;
  onSet(key: SettingKey, value: unknown): void; onRun(cmd: SettingsCommand): void; onMic(id: string, label: string): void; onClose(): void;
};

export function SettingsView({ view, mics, t, onSet, onRun, onMic, onClose }: Props) {
  const [chosen, setChosen] = useState(view.categories[0]?.id);
  const category = view.categories.find((c) => c.id === chosen) ?? view.categories[0];
  return (
    <div className="vc-set-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vc-set" role="dialog" aria-modal="true" aria-label={t.settingsTitle}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
        <nav className="vc-set-nav" aria-label={t.settingsCategories}>
          <h2>{t.settingsTitle}</h2>
          {view.categories.map((c, i) => (
            <button key={c.id} type="button" autoFocus={i === 0} data-on={c.id === category?.id || undefined} onClick={() => setChosen(c.id)}>
              {t.settingsCategory[c.id]}
            </button>
          ))}
        </nav>
        <div className="vc-set-items">
          {category?.items.map((item, i) => (
            <Row key={`${category.id}:${i}`} item={item} mics={mics} t={t} onSet={onSet} onRun={onRun} onMic={onMic} />
          ))}
        </div>
        <button type="button" className="vc-set-close" aria-label={t.close} title={t.close} onClick={onClose}>×</button>
      </div>
    </div>
  );
}

type RowProps = Pick<Props, 'mics' | 't' | 'onSet' | 'onRun' | 'onMic'> & { item: SettingItem };

// Écrit en quittant le champ, ou par Entrée (qui le quitte) ; rien si la valeur n'a pas changé.
function Field({ item, text, onSet, step }: { item: Extract<SettingItem, { kind: 'text' | 'command' | 'number' }>; text: string; onSet: Props['onSet']; step?: number }) {
  const commit = (raw: string) => {
    if (raw === text || (item.kind === 'number' && raw === '')) return;
    onSet(item.key, item.kind === 'number' ? Number(raw) : raw);
  };
  return (
    <input key={text} defaultValue={text}
      type={item.kind === 'number' ? 'number' : 'text'} step={step} min={item.kind === 'number' ? 0 : undefined}
      maxLength={item.kind === 'number' ? undefined : item.max}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
  );
}

function Row({ item, mics, t, onSet, onRun, onMic }: RowProps) {
  if (item.kind === 'run') {
    return <button type="button" className="vc-set-run" disabled={item.disabled} onClick={() => onRun(item.key)}>{t.settingRun[item.key]}</button>;
  }
  if (item.kind === 'info') {
    const missing = { whisperModel: t.settingInfoValue.whisperMissing, agentFound: t.settingInfoValue.agentMissing, editor: t.settingInfoValue.editorMissing, version: '' };
    // whisper qui se télécharge : `downloading:<pourcent>` (core/settings).
    const percent = /^downloading:(\d+)$/.exec(item.value)?.[1];
    const shown = percent ? t.settingInfoValue.downloading(Number(percent)) : item.value || missing[item.key];
    return <div className="vc-set-row"><span>{t.settingInfo[item.key]}</span><span className="vc-set-info">{shown}</span></div>;
  }
  if (item.kind === 'mic') {
    const known = mics.some((m) => m.deviceId === item.value);
    return (
      <label className="vc-set-row"><span>{t.settingMic}</span>
        <select value={item.value} onChange={(e) => onMic(e.target.value, mics.find((m) => m.deviceId === e.target.value)?.label ?? '')}>
          <option value="">{t.settingMicDefault}</option>
          {item.value && !known && <option value={item.value}>{t.settingMicUnnamed}</option>}
          {mics.map((m) => <option key={m.deviceId} value={m.deviceId}>{m.label || t.settingMicUnnamed}</option>)}
        </select>
      </label>
    );
  }
  // Un réglage d'une action (`model:<id>`, `effort:<id>`) porte le libellé de l'action.
  const name = item.key.startsWith('model:') ? `${item.kind === 'choice' && item.label} · ${t.model}`
    : item.key.startsWith('effort:') ? `${item.kind === 'choice' && item.label} · ${t.effort}`
    : t.settingLabel[item.key as FixedSettingKey];
  return (
    <label className="vc-set-row"><span>{name}</span>
      {item.kind === 'toggle' ? <input type="checkbox" checked={item.value} onChange={(e) => onSet(item.key, e.target.checked)} />
        : item.kind === 'choice' ? (
          <select value={item.value} onChange={(e) => onSet(item.key, e.target.value)}>
            {item.choices.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>)
        : <Field item={item} text={String(item.value)} onSet={onSet} step={item.key === 'speakVolume' ? 0.05 : 1} />}
    </label>
  );
}
