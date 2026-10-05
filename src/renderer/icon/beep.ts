/** beep — bip de début, de fin, de réponse d'un agent : on dicte les yeux sur
 *  une AUTRE application. Ne connaît pas : le pont, React. Utilisé par : IconApp. */

export function beep(freq: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => { ctx.close().catch(() => {}); };
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch { /* pas de sortie audio : tant pis pour le bip */ }
}
