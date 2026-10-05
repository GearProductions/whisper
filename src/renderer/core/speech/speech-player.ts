/** speech-player — le lecteur de la lecture à voix haute. Le principal génère l'audio
 *  et l'envoie par morceaux (`tts:chunk`), joués bout à bout ; `tts:end` dit
 *  que la génération est finie. `id` : la lecture en cours, les morceaux
 *  d'une lecture abandonnée sont ignorés. playView : l'état du bouton.
 *  Ne connaît pas : React ; pont et AudioContext sont injectés.
 *  Utilisé par : app/icon (icon-app, play-button). */
import type { IconApi, SpeakState } from 'technicals/bridge';

export const ERROR_MS = 4000;
const LEAD_S = 0.05; // marge avant le premier morceau

// idle | loading (en attente du premier son) | playing | error
export type SpeechPhase = 'idle' | 'loading' | 'playing' | 'error';
export type SpeechView = { state: SpeakState; phase: SpeechPhase; error: string };

export const canSpeak = (s: SpeakState) => s.mode !== 'off' && !!s.ready && !!s.hasText;

// Le bouton : masqué, grisé (aria-disabled, pour garder le clic droit) ou actif, et son infobulle.
export function playView({ state: s, phase, error }: SpeechView) {
  const busy = phase === 'loading' || phase === 'playing';
  const what = s.mode === 'selection' ? 'la sélection' : 'le presse-papiers';
  let title: string;
  if (busy) title = phase === 'loading' ? 'Préparation de la lecture… (clic : annuler)' : 'Arrêter la lecture';
  else if (phase === 'error') title = error;
  else if (!s.ready) title = 'Pocket TTS introuvable : voir le README (Lecture à voix haute)';
  else if (!s.hasText) title = s.mode === 'selection' ? 'Sélectionnez du texte à lire' : 'Presse-papiers vide';
  else title = `Lire ${what} à voix haute`;
  return { hidden: s.mode === 'off', disabled: !busy && !canSpeak(s), title };
}

export type SpeechDeps = {
  api: Pick<IconApi, 'speak' | 'cancelSpeak'>;
  newContext: () => AudioContext;
  onChange: (view: SpeechView) => void;
};

type Early = [number, 'chunk', Uint8Array, number] | [number, 'end', string | null];

export function createSpeechPlayer({ api, newContext, onChange }: SpeechDeps) {
  let state: SpeakState = { mode: 'off' };
  let phase: SpeechPhase = 'idle';
  let error = '';
  let errorTimer: ReturnType<typeof setTimeout> | undefined;
  let id: number | null = null;
  let token = 0;
  let done = false;
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  const sources = new Set<AudioBufferSourceNode>();
  let nextTime = 0;
  let early: Early[] = [];

  const volume = () => (Number.isFinite(state.volume) ? state.volume! : 1);
  const view = (): SpeechView => ({ state, phase, error });
  const changed = () => onChange(view());

  function setPhase(p: SpeechPhase, err = '') {
    phase = p;
    error = err;
    clearTimeout(errorTimer);
    if (p === 'error') errorTimer = setTimeout(() => { if (phase === 'error') setPhase('idle'); }, ERROR_MS);
    changed();
  }

  function stop() {
    token++;
    if (id !== null && !done) api.cancelSpeak(id);
    for (const src of sources) { try { src.stop(); } catch { /* déjà arrêtée */ } }
    if (ctx) ctx.close().catch(() => {});
    sources.clear();
    ctx = null;
    gain = null;
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
    src.connect(gain!);
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
      try { playChunk(ev[2], ev[3]); } catch { stop(); setPhase('error', 'Lecture audio impossible.'); }
      return;
    }
    done = true;
    if (ev[2]) { stop(); setPhase('error', ev[2]); return; }
    if (phase === 'loading') stop(); // rien n'a été généré
    else finishIfDone();
  }

  // `source` : rien (la sélection ou le presse-papiers) ou 'reply'.
  async function speak(source?: 'reply') {
    const own = ++token;
    // Créés au clic : le volume passe par un gain, le curseur agit en cours de lecture.
    ctx = newContext();
    gain = ctx.createGain();
    gain.gain.value = volume();
    gain.connect(ctx.destination);
    nextTime = 0;
    done = false;
    early = [];
    setPhase('loading');
    let res: Awaited<ReturnType<IconApi['speak']>> | null;
    try { res = await api.speak(source); } catch { res = null; }
    if (own !== token) { if (res && res.ok) api.cancelSpeak(res.id); return; } // annulée entre-temps
    if (!res || !res.ok) { stop(); setPhase('error', (res && !res.ok && res.error) || 'La synthèse vocale a échoué.'); return; }
    id = res.id;
    // Morceaux arrivés avant la réponse : rejoués dans l'ordre.
    const pending = early;
    early = [];
    for (const ev of pending) onEvent(ev);
  }

  const busy = () => phase === 'loading' || phase === 'playing';

  return {
    view,
    stop,
    canSpeak: () => canSpeak(state),
    // Clic sur le bouton : lit, ou arrête la lecture en cours.
    click() {
      if (busy()) stop();
      else if (canSpeak(state)) speak();
    },
    // Écouter, dans le panneau : le résumé d'une réponse, par le même lecteur.
    speakReply() {
      if (busy()) stop();
      speak('reply');
    },
    setState(s: SpeakState | null) {
      state = s || { mode: 'off' };
      if (state.mode === 'off') stop();
      if (gain) gain.gain.value = volume();
      changed();
    },
    onChunk: (chunkId: number, pcm: Uint8Array, rate: number) => onEvent([chunkId, 'chunk', pcm, rate]),
    onEnd: (endId: number, err: string | null) => onEvent([endId, 'end', err]),
  };
}
