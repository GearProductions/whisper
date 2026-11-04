/** prompt-tools — la paire de boutons ronds au bas à droite d'un champ où l'on écrit à un agent (vue C) :
 *  le micro (rose) et Envoyer (bleu). Le micro dicte tant qu'il est maintenu (down à l'appui, up une
 *  seule fois au relâchement, à la sortie ou à l'annulation) ; il ne prend pas le clavier et le donne à
 *  son champ (`field`) : la dictée, qui va à la zone de texte qui a le clavier (panel-app), arrive dans
 *  ce champ. Sa phase (enregistre, transcrit) dans data-phase et le title. Le micro vient du contexte
 *  Mic (posé par panel-app) ; sans lui, Envoyer seul. Envoyer : onSend, grisé par sendDisabled. `ids` : les id #mic et #send (le champ de la conversation).
 *  Ne connaît pas : le pont, le micro lui-même (rappels). Utilisé par : step-parts, comment-box,
 *  questions-view ; components (composer). */
import { createContext, useContext, useRef, type RefObject } from 'react';
import type { Phase } from 'core/dictation';
import type { Strings } from 'core/vibecoder';
import { Icon } from './icons';
import './prompt-tools.css';

export type MicApi = { phase: Phase; down(): void; up(): void };
export const Mic = createContext<MicApi | null>(null);

type Props = {
  t: Strings; field?: RefObject<HTMLTextAreaElement | null>; ids?: boolean;
  onSend(): void; sendDisabled?: boolean; sendTitle?: string;
};

export function PromptTools({ t, field, ids, onSend, sendDisabled, sendTitle = t.sendField }: Props) {
  const mic = useContext(Mic);
  const held = useRef(false);
  const down = () => { field?.current?.focus(); held.current = true; mic?.down(); };
  const up = () => { if (held.current) { held.current = false; mic?.up(); } };
  const phase = mic?.phase ?? 'idle';
  const micTitle = phase === 'recording' ? t.micRecording : phase === 'transcribing' ? t.micTranscribing : t.micHold;
  return (
    <span className="vc-prompt-tools">
      {mic ? (
        <button id={ids ? 'mic' : undefined} type="button" className="vc-mic" aria-label={t.micHold} title={micTitle} data-phase={phase}
          onMouseDown={(e) => e.preventDefault()} onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}>
          <Icon name="mic" />
        </button>
      ) : null}
      <button id={ids ? 'send' : undefined} type="button" className="vc-send" title={sendTitle} aria-label={t.sendField}
        disabled={sendDisabled} onClick={onSend}><Icon name="send" /></button>
    </span>
  );
}
