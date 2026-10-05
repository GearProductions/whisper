/** Banners — sous l'en-tête : le message de l'appli (à la place de la bulle,
 *  panneau ouvert) et le bandeau d'une ancienne conversation, en lecture
 *  seule, à reprendre.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : PanelApp. */
import type { RefObject } from 'react';
import type { Notice, Thread } from '../bridge';
import { isBusy } from './format';

export function NoticeBar({ notice, onClose, ref }: { notice: Notice | null; onClose(): void; ref: RefObject<HTMLDivElement | null> }) {
  return (
    <div id="notice" ref={ref} hidden={!notice} data-kind={notice?.kind}>
      <span id="notice-text">{notice?.text}</span>
      <button id="notice-close" type="button" title="Fermer" aria-label="Fermer" onClick={onClose}>×</button>
    </div>
  );
}

type ArchivedProps = { data: Thread | null; onCurrent(): void; onResume(): void; ref: RefObject<HTMLDivElement | null> };

export function ArchivedBar({ data, onCurrent, onResume, ref }: ArchivedProps) {
  const busy = !!data && isBusy(data.status);
  return (
    <div id="archived" ref={ref} hidden={!data || data.live || !!data.dictation}>
      <span>Ancienne conversation : en lecture seule.</span>
      <button id="current" type="button" onClick={onCurrent}>← Conversation en cours</button>
      <button id="resume" type="button" disabled={busy} onClick={onResume}
        title={data ? (busy ? `${data.name} travaille : attendez qu'il ait fini.`
          : `${data.name} reprend cette conversation ; celle en cours reste dans l'historique.`) : undefined}>
        Reprendre cette conversation
      </button>
    </div>
  );
}
