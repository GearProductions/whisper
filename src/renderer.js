/* =========================================================================
   Whisper — l'icône : geste, micro, état

   Un seul appui, deux gestes : BOUGER déplace la fenêtre, MAINTENIR sans bouger
   dicte. Au-delà de DRAG_PX c'est un glisser ; passé HOLD_MS immobile c'est une
   dictée, qui dure jusqu'au relâché où que soit le curseur (capture). Le micro
   ne s'ouvre qu'au seuil : un clic ou un glisser ne l'allume pas.

   Chaîne : micro 16 kHz mono → relâché → PCM 16 bits → principal (whisper.cpp
   local, puis Ctrl+V dans l'application au premier plan). Rien ne quitte la
   machine.
   ========================================================================= */

const RATE = 16000;
const MAX_MS = 5 * 60 * 1000 - 5000; // sous la borne du principal
// Énergie (RMS) du morceau le plus fort : en dessous, on n'a capté que du
// silence — et whisper, sur du silence, INVENTE (« Sous-titres réalisés par… »).
const MIN_PEAK = 0.008;
const ERROR_MS = 4000;
const DRAG_PX = 5;
const HOLD_MS = 300;
const HINT = 'Maintenir pour dicter · glisser pour déplacer · clic droit : réglages';

const icon = document.getElementById('icon');

// phase : idle | starting | recording | transcribing | error
const state = { phase: 'idle', session: null, errorTimer: null };

function setPhase(phase, message = '') {
  state.phase = phase;
  icon.dataset.phase = phase;
  icon.title = message || HINT;
  clearTimeout(state.errorTimer);
  if (phase === 'error' || message) {
    state.errorTimer = setTimeout(() => {
      if (state.phase === 'error') { state.phase = 'idle'; icon.dataset.phase = 'idle'; }
      icon.title = HINT;
    }, ERROR_MS);
  }
}

/* ---- Micro --------------------------------------------------------------- */

// L'identifiant d'un micro peut changer (casque rebranché ailleurs) : on le
// retrouve alors par son NOM. Introuvable → micro par défaut.
async function openStream(cfg) {
  const base = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (cfg.deviceId) {
    let deviceId = cfg.deviceId;
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
      if (!inputs.some((d) => d.deviceId === deviceId)) {
        const byLabel = cfg.deviceLabel && inputs.find((d) => d.label === cfg.deviceLabel);
        deviceId = byLabel ? byLabel.deviceId : null;
        if (byLabel) window.api.setDevice(byLabel.deviceId, byLabel.label);
      }
    } catch { /* énumération impossible : on tente l'identifiant tel quel */ }
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: { ...base, deviceId: { exact: deviceId } } });
      } catch (err) {
        if (err && err.name !== 'OverconstrainedError' && err.name !== 'NotFoundError') throw err;
      }
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: base });
}

// Micros pour le menu. Les entrées virtuelles « default » et « communications »
// de Windows doublonnent un vrai périphérique.
async function listInputs() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
      .map((d) => ({ deviceId: d.deviceId, label: d.label }));
  } catch { return []; }
}

/* ---- Enregistrer --------------------------------------------------------- */

async function startDictation() {
  if (state.session) return;
  const cfg = await window.api.getConfig();
  // Une « session » par appui : relâcher PENDANT l'ouverture du micro (~100 ms)
  // doit l'annuler, pas laisser un enregistrement orphelin.
  const session = { stopRequested: false, rec: null, cfg };
  state.session = session;
  setPhase('starting');

  let stream;
  try {
    stream = await openStream(cfg);
  } catch {
    state.session = null;
    setPhase('error', 'Micro inaccessible.');
    return;
  }
  if (session.stopRequested) {
    stream.getTracks().forEach((t) => t.stop());
    state.session = null;
    setPhase('idle');
    return;
  }

  // Le contexte rééchantillonne lui-même à 16 kHz : le format de whisper.
  const ctx = new AudioContext({ sampleRate: RATE });
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const rec = { stream, ctx, source, proc, chunks: [], length: 0, peak: 0, timer: null };
  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    rec.chunks.push(new Float32Array(data));
    rec.length += data.length;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    rec.peak = Math.max(rec.peak, Math.sqrt(sum / data.length));
  };
  source.connect(proc);
  proc.connect(ctx.destination); // sans sortie branchée, onaudioprocess ne tourne pas
  rec.timer = setTimeout(() => stopDictation(), MAX_MS);
  session.rec = rec;
  window.api.warmUp();
  // Le bip dit « parlez » : il ne part qu'une fois le micro réellement ouvert.
  beep(cfg, 880);
  setPhase('recording');
}

function releaseRecorder(rec) {
  clearTimeout(rec.timer);
  try { rec.proc.disconnect(); rec.source.disconnect(); } catch { /* déjà débranché */ }
  rec.stream.getTracks().forEach((t) => t.stop());
  rec.ctx.close().catch(() => {});
}

// Float32 [-1, 1] → PCM 16 bits little-endian.
function toPcm(chunks, length) {
  const out = new Int16Array(length);
  let o = 0;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      const s = Math.max(-1, Math.min(1, c[i]));
      out[o++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  return out;
}

async function stopDictation() {
  const session = state.session;
  if (!session) return;
  if (!session.rec) { session.stopRequested = true; return; }
  state.session = null;
  const rec = session.rec;
  releaseRecorder(rec);
  beep(session.cfg, 520);

  if (rec.length < RATE * 0.4 || rec.peak < MIN_PEAK) {
    setPhase('idle', 'Aucune parole détectée.');
    return;
  }
  setPhase('transcribing');
  try {
    const res = await window.api.transcribe(toPcm(rec.chunks, rec.length).buffer);
    if (!res || !res.ok) { setPhase('error', (res && res.error) || 'La transcription a échoué.'); return; }
    if (!res.text) { setPhase('idle', 'Aucune parole détectée.'); return; }
    setPhase('idle', res.pasted ? '' : 'Collage impossible : le texte est dans le presse-papiers.');
  } catch {
    setPhase('error', 'La transcription a échoué.');
  }
}

// Bip de début/fin : on dicte les yeux sur une AUTRE application.
function beep(cfg, freq) {
  if (cfg.sound === false) return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => ctx.close().catch(() => {});
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch { /* pas de sortie audio : tant pis pour le bip */ }
}

/* ---- Geste --------------------------------------------------------------- */

let pressed = false;
let mode = null; // null (indécis) | 'drag' | 'dictate'
let holdTimer = null;
let startX = 0, startY = 0, winX = 0, winY = 0, lastX = 0, lastY = 0;

icon.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pressed = true;
  mode = null;
  startX = e.screenX; startY = e.screenY;
  icon.setPointerCapture(e.pointerId);
  // Position lue en parallèle : le seuil de glisser laisse le temps qu'elle arrive.
  window.api.getBounds().then((b) => {
    if (!b) return;
    winX = b.x; winY = b.y; lastX = b.x; lastY = b.y;
  });
  holdTimer = setTimeout(() => {
    holdTimer = null;
    if (!pressed || mode) return;
    mode = 'dictate';
    startDictation();
  }, HOLD_MS);
});

icon.addEventListener('pointermove', (e) => {
  if (!pressed || mode === 'dictate') return;
  const dx = e.screenX - startX;
  const dy = e.screenY - startY;
  if (!mode) {
    if (Math.hypot(dx, dy) < DRAG_PX) return;
    mode = 'drag';
    clearTimeout(holdTimer); holdTimer = null;
  }
  lastX = winX + dx;
  lastY = winY + dy;
  window.api.setPosition(lastX, lastY);
});

function endPress(e) {
  if (!pressed) return;
  pressed = false;
  clearTimeout(holdTimer); holdTimer = null;
  try { icon.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
  if (mode === 'drag') window.api.savePosition(lastX, lastY);
  else if (mode === 'dictate') stopDictation();
  mode = null;
}
icon.addEventListener('pointerup', endPress);
icon.addEventListener('pointercancel', endPress);

icon.addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  window.api.openMenu(await listInputs());
});
