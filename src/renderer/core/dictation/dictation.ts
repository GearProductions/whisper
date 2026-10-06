/** dictation — un appui long = une dictée : prévenir le principal (coupures),
 *  ouvrir le micro, bips, enregistrer, faire transcrire, dire le résultat.
 *  Une session par appui : relâcher PENDANT l'ouverture du micro l'annule.
 *  Tout `setRecording(true)` est suivi de `setRecording(false)` (SPEC I-11).
 *  Ne connaît pas : React, le DOM ; pont et micro sont injectés.
 *  Utilisé par : app/icon (icon-app). */
import type { Recording } from 'technicals/audio';
import { RATE, toPcm } from 'technicals/audio';
import type { DictationConfig, IconApi } from 'technicals/bridge';

export type { Recording };

export const MAX_MS = 5 * 60 * 1000 - 5000; // sous la borne du principal
const START_FREQ = 880;
const END_FREQ = 520;

// idle | starting | recording | transcribing | error
export type Phase = 'idle' | 'starting' | 'recording' | 'transcribing' | 'error';

// Énergie (RMS) du morceau le plus fort : en dessous, on n'a capté que du
// silence — et whisper, sur du silence, INVENTE (« Sous-titres réalisés par… »).
export const MIN_PEAK = 0.008;
const MIN_SECONDS = 0.4;

// Trop court ou trop faible : rien à transcrire (SPEC F-4, I-10).
export const isSilent = (length: number, peak: number) => length < RATE * MIN_SECONDS || peak < MIN_PEAK;

export type DictationDeps = {
  api: Pick<IconApi, 'getConfig' | 'setRecording' | 'warmUp' | 'transcribe'>;
  openMic(cfg: DictationConfig): Promise<MediaStream>;
  record(stream: MediaStream): Recording;
  beep(cfg: DictationConfig, freq: number): void;
  stopSpeaking(): void;
  setPhase(phase: Phase, message?: string): void;
};

type Session = { stopRequested: boolean; rec: Recording | null; cfg: DictationConfig; timer?: ReturnType<typeof setTimeout> };

export function createDictation({ api, openMic, record, beep, stopSpeaking, setPhase }: DictationDeps) {
  let session: Session | null = null;

  async function start() {
    if (session) return;
    const cfg = await api.getConfig();
    const own: Session = { stopRequested: false, rec: null, cfg };
    session = own;
    stopSpeaking(); // sinon le micro capterait la lecture
    setPhase('starting');
    // Avant d'ouvrir le micro : le principal coupe Discord si c'est autorisé.
    // Chaque sortie ci-dessous (et stop) signale la fin.
    api.setRecording(true);

    let stream: MediaStream;
    try {
      stream = await openMic(cfg);
    } catch {
      session = null;
      api.setRecording(false);
      setPhase('error', 'Micro inaccessible.');
      return;
    }
    if (own.stopRequested) {
      stream.getTracks().forEach((t) => t.stop());
      session = null;
      api.setRecording(false);
      setPhase('idle');
      return;
    }
    own.rec = record(stream);
    own.timer = setTimeout(() => { stop(); }, MAX_MS);
    api.warmUp();
    // Le bip dit « parlez » : il ne part qu'une fois le micro réellement ouvert.
    beep(cfg, START_FREQ);
    setPhase('recording');
  }

  async function stop() {
    const own = session;
    if (!own) return;
    if (!own.rec) { own.stopRequested = true; return; }
    session = null;
    const rec = own.rec;
    clearTimeout(own.timer);
    rec.release();
    api.setRecording(false);
    beep(own.cfg, END_FREQ);

    if (isSilent(rec.length, rec.peak)) {
      setPhase('idle', 'Aucune parole détectée.');
      return;
    }
    setPhase('transcribing');
    try {
      const res = await api.transcribe(toPcm(rec.chunks, rec.length).buffer as ArrayBuffer);
      if (!res || !res.ok) { setPhase('error', (res && res.error) || 'La transcription a échoué.'); return; }
      if (!res.text) { setPhase('idle', 'Aucune parole détectée.'); return; }
      if (res.agent) {
        setPhase('idle', res.panel ? `Ajouté au message pour ${res.agent}.` : `Envoyé à ${res.agent}.`);
        return;
      }
      // Pas collé : soit le collage automatique est désactivé, soit il a échoué.
      const notPasted = res.autoPaste === false ? 'Texte dans le presse-papiers : Ctrl+V pour le coller.'
        : 'Collage impossible : le texte est dans le presse-papiers.';
      setPhase('idle', res.pasted ? '' : notPasted);
    } catch {
      setPhase('error', 'La transcription a échoué.');
    }
  }

  return { start, stop };
}
