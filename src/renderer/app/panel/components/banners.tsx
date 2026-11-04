/** banners — en tête de l'écran : le message de l'appli (téléchargement, installation,
 *  micro Discord coupé…) et le bandeau d'une ancienne conversation, en lecture
 *  seule, à reprendre.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import { isBusy } from 'core/conversation';
import type { Notice, Thread } from 'technicals/bridge';

export function NoticeBar({ notice, onClose }: { notice: Notice | null; onClose(): void }) {
  return (
    <div id="notice" hidden={!notice} data-kind={notice?.kind}>
      <span id="notice-text">{notice?.text}</span>
      <button id="notice-close" type="button" title="Fermer" aria-label="Fermer" onClick={onClose}>×</button>
    </div>
  );
}

type ArchivedProps = { data: Thread | null; onCurrent(): void; onResume(): void };

export function ArchivedBar({ data, onCurrent, onResume }: ArchivedProps) {
  const busy = !!data && isBusy(data.status);
  return (
    <div id="archived" hidden={!data || data.live}>
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
