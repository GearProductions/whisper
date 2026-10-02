/* =========================================================================
   Whisper — l'icône : geste, micro, état

   Un seul appui, deux gestes : BOUGER déplace la fenêtre, MAINTENIR sans bouger
   dicte. Au-delà de DRAG_PX c'est un glisser ; passé HOLD_MS immobile c'est une
   dictée, qui dure jusqu'au relâché où que soit le curseur (capture). Le micro
   ne s'ouvre qu'au seuil : un clic ou un glisser ne l'allume pas.

   Chaîne : micro 16 kHz mono → relâché → PCM 16 bits → principal (whisper.cpp
   local, puis Ctrl+V dans l'application au premier plan). Rien ne quitte la
   machine.

   À côté, le bouton de lecture : le principal le dit actif, grisé ou masqué
   (texte sélectionné ou non, moteur disponible ou non) ; un clic lit, un
   second arrête.

   Puis les agents Claude Code (un robot par dossier de projet) : un clic en
   sélectionne un, la dictée lui est alors envoyée au lieu d'être collée ; une
   pastille signale sa réponse, à lire dans la bulle ou à écouter.
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
// Taille configurée de l'icône : toute la mise en page s'y rapporte (cf. style.css).
document.documentElement.style.setProperty('--s', `${Number(new URLSearchParams(location.search).get('size')) || 64}px`);

// phase : idle | starting | recording | transcribing | error
const state = { phase: 'idle', session: null, errorTimer: null };

// Infobulle au repos : à qui va la dictée (un agent sélectionné, sinon le curseur).
let targetName = '';
const hint = () => (targetName ? `Maintenir pour parler à ${targetName} · glisser pour déplacer · clic droit : réglages` : HINT);

function setPhase(phase, message = '') {
  state.phase = phase;
  icon.dataset.phase = phase;
  icon.title = message || hint();
  clearTimeout(state.errorTimer);
  if (phase === 'error' || message) {
    state.errorTimer = setTimeout(() => {
      if (state.phase === 'error') { state.phase = 'idle'; icon.dataset.phase = 'idle'; }
      icon.title = hint();
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
  stopSpeaking(); // sinon le micro capterait la lecture
  setPhase('starting');
  // Avant d'ouvrir le micro : le principal coupe Discord si c'est autorisé.
  // Chaque sortie ci-dessous (et releaseRecorder) signale la fin.
  window.api.setRecording(true);

  let stream;
  try {
    stream = await openStream(cfg);
  } catch {
    state.session = null;
    window.api.setRecording(false);
    setPhase('error', 'Micro inaccessible.');
    return;
  }
  if (session.stopRequested) {
    stream.getTracks().forEach((t) => t.stop());
    state.session = null;
    window.api.setRecording(false);
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
  window.api.setRecording(false);
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

// Sur l'icône comme sur le bouton de lecture ; un robot a son propre menu.
document.addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  const agent = e.target.closest('.agent');
  if (agent) window.api.agentMenu(agent.dataset.id);
  else window.api.openMenu(await listInputs());
});

/* ---- Lecture à voix haute ------------------------------------------------ */

const play = document.getElementById('play');

// phase : idle | loading (en attente du premier son) | playing | error.
// L'audio arrive par morceaux au fil de la génération (`tts:chunk`), joués bout
// à bout ; `tts:end` dit que la génération est finie. `id` : la lecture en
// cours, les morceaux d'une lecture abandonnée sont ignorés.
const speech = {
  state: { mode: 'off' }, phase: 'idle', id: null, token: 0, done: false,
  ctx: null, gain: null, sources: new Set(), nextTime: 0, early: [], error: '', errorTimer: null,
};
const speechVolume = () => (Number.isFinite(speech.state.volume) ? speech.state.volume : 1);
const LEAD_S = 0.05; // marge avant le premier morceau

function canSpeak() {
  const s = speech.state;
  return s.mode !== 'off' && s.ready && s.hasText;
}

function renderPlay() {
  const s = speech.state;
  document.body.dataset.tts = s.mode === 'off' ? 'off' : 'on';
  play.dataset.phase = speech.phase;
  const busy = speech.phase === 'loading' || speech.phase === 'playing';
  // aria-disabled et non `disabled` : un bouton désactivé ne reçoit plus le
  // clic droit, et le menu doit rester accessible.
  play.setAttribute('aria-disabled', String(!busy && !canSpeak()));
  const what = s.mode === 'selection' ? 'la sélection' : 'le presse-papiers';
  if (busy) play.title = speech.phase === 'loading' ? 'Préparation de la lecture… (clic : annuler)' : 'Arrêter la lecture';
  else if (speech.phase === 'error') play.title = speech.error;
  else if (!s.ready) play.title = 'Pocket TTS introuvable : voir le README (Lecture à voix haute)';
  else if (!s.hasText) play.title = s.mode === 'selection' ? 'Sélectionnez du texte à lire' : 'Presse-papiers vide';
  else play.title = `Lire ${what} à voix haute`;
}

function setSpeechPhase(phase, error = '') {
  speech.phase = phase;
  speech.error = error;
  clearTimeout(speech.errorTimer);
  if (phase === 'error') {
    speech.errorTimer = setTimeout(() => { if (speech.phase === 'error') setSpeechPhase('idle'); }, ERROR_MS);
  }
  renderPlay();
}

function stopSpeaking() {
  speech.token++;
  if (speech.id !== null && !speech.done) window.api.cancelSpeak(speech.id);
  for (const src of speech.sources) { try { src.stop(); } catch { /* déjà arrêtée */ } }
  if (speech.ctx) speech.ctx.close().catch(() => {});
  speech.sources.clear();
  speech.ctx = null;
  speech.gain = null;
  speech.id = null;
  speech.early = [];
  if (speech.phase === 'loading' || speech.phase === 'playing') setSpeechPhase('idle');
}

// Fin : génération terminée et dernier morceau joué.
function finishIfDone() {
  if (speech.done && !speech.sources.size && speech.phase === 'playing') stopSpeaking();
}

function playChunk(pcm, rate) {
  const { ctx } = speech;
  // PCM 16 bits mono (Uint8Array) → flottants ; copié, l'alignement n'étant pas garanti.
  const ints = new Int16Array(pcm.slice().buffer);
  const buf = ctx.createBuffer(1, ints.length, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < ints.length; i++) data[i] = ints[i] / 32768;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(speech.gain);
  const at = Math.max(speech.nextTime, ctx.currentTime + LEAD_S);
  src.start(at);
  speech.nextTime = at + buf.duration;
  speech.sources.add(src);
  src.onended = () => { speech.sources.delete(src); finishIfDone(); };
  if (speech.phase === 'loading') setSpeechPhase('playing');
}

// `source` : rien (la sélection ou le presse-papiers) ou { agent: id }.
async function speak(source) {
  const token = ++speech.token;
  // Créés au clic : le volume passe par un gain, le curseur agit en cours de lecture.
  speech.ctx = new AudioContext();
  speech.gain = speech.ctx.createGain();
  speech.gain.gain.value = speechVolume();
  speech.gain.connect(speech.ctx.destination);
  speech.nextTime = 0;
  speech.done = false;
  speech.early = [];
  setSpeechPhase('loading');
  let res;
  try { res = await window.api.speak(source); } catch { res = null; }
  if (token !== speech.token) { if (res && res.ok) window.api.cancelSpeak(res.id); return; } // annulée entre-temps
  if (!res || !res.ok) { stopSpeaking(); setSpeechPhase('error', (res && res.error) || 'La synthèse vocale a échoué.'); return; }
  speech.id = res.id;
  // Morceaux arrivés avant la réponse : rejoués dans l'ordre.
  const early = speech.early;
  speech.early = [];
  for (const [id, ...args] of early) onEvent(id, ...args);
}

function onEvent(id, kind, a, b) {
  if (speech.id === null && speech.phase === 'loading') { speech.early.push([id, kind, a, b]); return; }
  if (id !== speech.id) return;
  if (kind === 'chunk') { try { playChunk(a, b); } catch { stopSpeaking(); setSpeechPhase('error', 'Lecture audio impossible.'); } return; }
  speech.done = true;
  if (a) { stopSpeaking(); setSpeechPhase('error', a); return; }
  if (speech.phase === 'loading') stopSpeaking(); // rien n'a été généré
  else finishIfDone();
}

play.addEventListener('click', () => {
  if (speech.phase === 'loading' || speech.phase === 'playing') stopSpeaking();
  else if (canSpeak()) speak();
});
// Survol : le clic va suivre, le principal charge le modèle d'avance.
play.addEventListener('mouseenter', () => { if (canSpeak()) window.api.warmUpSpeak(); });

// Bouton ▶ de la bulle d'un agent ou de sa fenêtre de conversation : le résumé
// audio d'une réponse, par le même lecteur.
window.api.onSpeakAgent((id, index) => {
  if (speech.phase === 'loading' || speech.phase === 'playing') stopSpeaking();
  speak({ agent: id, index });
});
window.api.onSpeakChunk((id, pcm, rate) => onEvent(id, 'chunk', pcm, rate));
window.api.onSpeakEnd((id, error) => onEvent(id, 'end', error));
window.api.onSpeakState((state) => {
  speech.state = state || { mode: 'off' };
  if (speech.state.mode === 'off') stopSpeaking();
  if (speech.gain) speech.gain.gain.value = speechVolume();
  renderPlay();
});
renderPlay();

/* ---- Agents Claude Code --------------------------------------------------- */

const agentsBox = document.getElementById('agents');
const agentTemplate = document.getElementById('agent-template');
const STATUS_TEXT = { working: 'au travail…', asking: 'attend une autorisation', error: 'erreur' };
let unreadBefore = new Set();

// `s` : { enabled, agents: [{ id, name, color, status, unread, selected }] }.
function renderAgents(s) {
  const list = (s && s.enabled && s.agents) || [];
  document.body.dataset.agents = s && s.enabled ? 'on' : 'off';
  const selected = list.find((a) => a.selected);
  document.body.dataset.target = selected ? 'agent' : '';
  targetName = selected ? selected.name : '';
  document.body.style.setProperty('--agent', selected ? selected.color : '');
  if (state.phase === 'idle') icon.title = hint();
  agentsBox.replaceChildren(...list.map((a) => {
    const b = agentTemplate.content.firstElementChild.cloneNode(true);
    b.dataset.id = a.id;
    b.style.setProperty('--agent', a.color);
    b.dataset.status = a.status;
    b.dataset.selected = String(!!a.selected);
    b.dataset.unread = String(!!a.unread);
    const detail = STATUS_TEXT[a.status] || (a.unread ? 'a répondu : cliquer pour lire' : a.selected ? 'sélectionné' : 'cliquer pour lui parler');
    b.title = `${a.name} — ${detail}`;
    return b;
  }));
  // Une réponse vient d'arriver : le bip de fin, comme pour une dictée (pas
  // pour celle de l'onglet affiché : déjà lue, elle n'est jamais « non lue »).
  const unread = new Set(list.filter((a) => a.unread).map((a) => a.id));
  if ([...unread].some((id) => !unreadBefore.has(id))) window.api.getConfig().then((cfg) => beep(cfg, 660));
  unreadBefore = unread;
}

agentsBox.addEventListener('click', (e) => {
  const b = e.target.closest('.agent');
  if (b) window.api.agentClick(b.dataset.id);
});
document.getElementById('add').addEventListener('click', () => window.api.agentAdd());
window.api.onAgents(renderAgents);
renderAgents({ enabled: false });

