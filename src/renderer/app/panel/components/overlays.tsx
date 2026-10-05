/** overlays — ce qui se pose sur le fil : l'historique du dossier, le détail
 *  du contexte (et Compacter), l'image en grand.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import { useState, type CSSProperties, type RefObject } from 'react';
import { kTokens, when } from 'helpers';
import type { ProbeResult, SendResult, Session } from 'technicals/bridge';

const Hint = ({ text }: { text: string }) => <div className="hint">{text}</div>;

type HistoryProps = { open: boolean; sessions: Session[] | null; onOpen(sessionId: string): void };

export function HistoryList({ open, sessions, onOpen }: HistoryProps) {
  return (
    <aside id="history" className="scroll" hidden={!open}>
      {!sessions ? <Hint text="Chargement…" />
        : !sessions.length ? <Hint text="Aucune conversation dans ce dossier." />
          : sessions.map((s) => (
            <button key={s.sessionId} type="button" className={`session${s.current ? ' current' : ''}`} onClick={() => onOpen(s.sessionId)}>
              <div className="session-title">{s.title || 'Conversation sans titre'}</div>
              <div className="session-date">{`${when(s.lastModified)}${s.current ? ' · en cours' : ''}`}</div>
            </button>
          ))}
    </aside>
  );
}

type ContextProps = {
  open: boolean;
  probe: ProbeResult | null;   // null : mesure en cours
  canCompact: boolean;          // agent inactif, conversation en cours
  onCompact(): Promise<SendResult | null>;
  ref: RefObject<HTMLElement | null>;
};

// Le détail : par catégorie (instructions, outils, mémoire, messages…), et de quoi le réduire.
export function ContextDetail({ open, probe, canCompact, onCompact, ref }: ContextProps) {
  return (
    <aside id="context-panel" className="scroll" hidden={!open} ref={ref}>
      {!probe ? <Hint text="Mesure du contexte…" />
        : !probe.context ? <Hint text={probe.error || 'Mesure impossible.'} />
          : <Detail probe={probe} canCompact={canCompact} onCompact={onCompact} />}
    </aside>
  );
}

function Detail({ probe, canCompact, onCompact }: Pick<ContextProps, 'canCompact' | 'onCompact'> & { probe: ProbeResult }) {
  const c = probe.context!;
  const [failed, setFailed] = useState('');
  const [pending, setPending] = useState(false);
  return (
    <>
      <div className="ctx-total">{`${kTokens(c.total)} / ${kTokens(c.max)} jetons (${Math.round(c.percentage)} %)`}</div>
      <div className="ctx-model">{c.model}</div>
      {c.categories.filter((x) => x.tokens > 0).map((x, i) => (
        <div key={i} className={`ctx-row ${x.kind}`} title={x.kind === 'deferred' ? 'Hors de la fenêtre : chargés à la demande' : ''}>
          <span className="ctx-name">{x.name}</span>
          <span className="ctx-bar" style={{ '--w': `${Math.max(1, Math.round((x.tokens / c.max) * 100))}%` } as CSSProperties} />
          <span className="ctx-tokens">{kTokens(x.tokens)}</span>
        </div>
      ))}
      {c.memoryFiles.length ? (
        <>
          <div className="ctx-section">Fichiers de mémoire</div>
          {c.memoryFiles.map((f, i) => <div key={i} className="ctx-file">{`${f.path} — ${kTokens(f.tokens)}`}</div>)}
        </>
      ) : null}
      <button type="button" className="ctx-compact" disabled={!canCompact || pending || !!failed}
        title={canCompact ? 'Résumer la conversation pour libérer le contexte (l\'historique complet reste dans la transcription)'
          : 'Possible quand l\'agent a fini, sur la conversation en cours'}
        onClick={async () => {
          setPending(true);
          const sent = await onCompact();
          setPending(false);
          if (!sent || !sent.ok) setFailed((sent && sent.error) || 'Échec');
        }}>
        {failed || 'Compacter (/compact)'}
      </button>
    </>
  );
}

export function Lightbox({ src, onClose }: { src: string | null; onClose(): void }) {
  return (
    <div id="lightbox" hidden={!src} onClick={onClose}><img alt="" src={src || undefined} /></div>
  );
}
