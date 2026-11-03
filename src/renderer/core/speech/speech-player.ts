/** speech-player — le lecteur d'*Écouter* : lit la réponse dont on donne le rang.
 *  Le principal choisit le texte (le résumé retenu), génère l'audio et l'envoie
 *  par morceaux (`tts:chunk`), joués bout à bout, au volume réglé ; `tts:end`
 *  dit que la génération est finie. `id` : la lecture en cours, les morceaux
 *  d'une lecture abandonnée sont ignorés.
 *  Ne connaît pas : React, le texte lu ; pont et AudioContext sont injectés.
 *  Utilisé par : app/panel (panel-app). */
import type { ConvApi } from 'technicals/bridge';

const LEAD_S = 0.05; // marge avant le premier morceau

// idle | loading (en attente du premier son) | playing | error (jusqu'à la lecture suivante)
export type SpeechPhase = 'idle' | 'loading' | 'playing' | 'error';

export type SpeechDeps = {
  api: Pick<ConvApi, 'speak' | 'cancelSpeak' | 'onSpeakChunk' | 'onSpeakEnd'>;
  newContext: () => AudioContext;
  onChange: (phase: SpeechPhase, message?: string) => void; // message : le motif d'un échec, quand le principal le donne
};

type Early = [number, 'chunk', Uint8Array, number] | [number, 'end', string | null];

export function createSpeechPlayer({ api, newContext, onChange }: SpeechDeps) {
  let phase: SpeechPhase = 'idle';
  let id: number | null = null;
  let token = 0;
  let done = false;
  let ctx: AudioContext | null = null;
  const sources = new Set<AudioBufferSourceNode>();
  let nextTime = 0;
  let early: Early[] = [];

  function setPhase(p: SpeechPhase, message?: string) {
    phase = p;
    onChange(p, message);
  }

  function stop() {
    token++;
    if (id !== null && !done) api.cancelSpeak(id);
    for (const src of sources) { try { src.stop(); } catch { /* déjà arrêtée */ } }
    if (ctx) ctx.close().catch(() => {});
    sources.clear();
    ctx = null;
    id = null;
    early = [];
    if (phase === 'loading' || phase === 'playing') setPhase('idle');
  }

  // Fin : génération terminée et dernier morceau joué.
  function finishIfDone() {
    if (done && !sources.size && phase === 'playing') stop();
  }

  function playChunk(pcm: Uint8Array, rate: number) {
    const c = ctx!;
    // PCM 16 bits mono → flottants ; copié, l'alignement n'étant pas garanti.
    const ints = new Int16Array(pcm.slice().buffer);
    const buf = c.createBuffer(1, ints.length, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < ints.length; i++) data[i] = ints[i] / 32768;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    const at = Math.max(nextTime, c.currentTime + LEAD_S);
    src.start(at);
    nextTime = at + buf.duration;
    sources.add(src);
    src.onended = () => { sources.delete(src); finishIfDone(); };
    if (phase === 'loading') setPhase('playing');
  }

  function onEvent(ev: Early) {
    if (id === null && phase === 'loading') { early.push(ev); return; }
    if (ev[0] !== id) return;
    if (ev[1] === 'chunk') {
      try { playChunk(ev[2], ev[3]); } catch { stop(); setPhase('error'); }
      return;
    }
    done = true;
    if (ev[2]) { stop(); setPhase('error', ev[2]); return; }
    if (phase === 'loading') stop(); // rien n'a été généré
    else finishIfDone();
  }

  api.onSpeakChunk((chunkId, pcm, rate) => onEvent([chunkId, 'chunk', pcm, rate]));
  api.onSpeakEnd((endId, err) => onEvent([endId, 'end', err]));

  async function play(index: number) {
    stop(); // une lecture en cours cède la place
    const own = ++token;
    ctx = newContext(); // créé au clic : le navigateur l'exige
    nextTime = 0;
    done = false;
    setPhase('loading');
    let res: Awaited<ReturnType<ConvApi['speak']>> | null;
    try { res = await api.speak(index); } catch { res = null; }
    if (own !== token) { if (res && res.ok) api.cancelSpeak(res.id); return; } // annulée entre-temps
    if (!res || !res.ok) { stop(); setPhase('error', res?.error); return; }
    id = res.id;
    // Morceaux arrivés avant la réponse : rejoués dans l'ordre.
    const pending = early;
    early = [];
    for (const ev of pending) onEvent(ev);
  }

  return {
    play: (index: number) => { void play(index); },
    stop,
    get phase() { return phase; },
  };
}
