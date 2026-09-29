/* =========================================================================
   Whisper — lecture à voix haute par Pocket TTS (Kyutai), en local

   `pocket-tts` (paquet Python, sur le processeur) :
     uv tool install pocket-tts --index https://download.pytorch.org/whl/cpu
   Un processus Python permanent (pocket-helper.py, lancé avec le Python de
   cette installation) garde modèles et voix en mémoire et renvoie l'audio par
   morceaux au fil de la génération : la lecture commence ~0,1 s après le clic.
   Il démarre au survol du bouton (warmUp : chargement ~3 s, ~1,5 Go par
   langue) et s'arrête après IDLE_MS sans lecture, pour rendre la mémoire.

   Autre moteur, au choix (réglage `speakEngine`) : Chatterbox, sur GPU, par
   son service local (cf. chatterbox.js) ; mêmes voix, même interface.

   Un modèle par langue, la voix au choix parmi quelques-unes : celles que
   Kyutai fournit toutes prêtes (le clonage à partir d'un enregistrement
   demande des poids à accès restreint). Le texte entier est lu dans une seule
   langue, détectée (cf. lang.js) ou imposée : une voix française dit très
   bien les termes techniques anglais.
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { detectLanguage } = require('./lang');
const chatterbox = require('./chatterbox');

const MAX_CHARS = 20000;          // ~20 min de lecture
const IDLE_MS = 10 * 60 * 1000;

// Modèles « 24l » : les plus soignés ; ~2 fois plus rapides que la lecture.
// Voix sous licence libre (CC0, CC-BY) ; `cosette` et `jean`, réservées à un
// usage non commercial, sont écartées.
const LANGS = {
  fr: {
    model: 'french_24l',
    voices: [
      { id: 'estelle', label: 'Estelle', gender: 'f' },   // la seule voix d'origine française
      { id: 'mary', label: 'Mary', gender: 'f' },
      { id: 'marius', label: 'Marius', gender: 'm' },
    ],
  },
  en: {
    model: 'english_2026-09_24l',
    voices: [
      { id: 'alba', label: 'Alba', gender: 'f' },
      { id: 'jane', label: 'Jane', gender: 'f' },
      { id: 'george', label: 'George', gender: 'm' },
    ],
  },
};

/* ---- Installation -------------------------------------------------------- */

function which(name) {
  const dirs = [...String(process.env.PATH || '').split(path.delimiter), path.join(os.homedir(), '.local', 'bin')];
  for (const dir of dirs) {
    if (!dir) continue;
    const file = path.join(dir, name);
    try { if (fs.statSync(file).isFile()) return file; } catch { /* pas là */ }
  }
  return null;
}

// Le Python de l'installation de pocket-tts. uv et pipx posent un lien vers le
// script de l'environnement, dont la première ligne (#!) nomme ce Python ;
// sous Windows, uv range l'environnement dans %APPDATA%\uv\tools.
function findPython() {
  if (process.platform === 'win32') {
    const py = path.join(process.env.APPDATA || '', 'uv', 'tools', 'pocket-tts', 'Scripts', 'python.exe');
    return fs.existsSync(py) ? py : null;
  }
  const exe = which('pocket-tts');
  if (!exe) return null;
  try {
    const first = fs.readFileSync(fs.realpathSync(exe), 'utf8').split('\n', 1)[0];
    const py = first.startsWith('#!') ? first.slice(2).trim().split(/\s+/)[0] : '';
    return py && fs.existsSync(py) ? py : null;
  } catch { return null; }
}

// Dans un paquet (asar), Python ne lit pas l'archive : le script en est sorti
// (--asar.unpack, cf. package.json).
function helperScript() {
  const inside = path.join(__dirname, 'pocket-helper.py');
  const unpacked = inside.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  return unpacked !== inside && fs.existsSync(unpacked) ? unpacked : inside;
}

const isInstalled = () => !!findPython();

/* ---- Processus Python ---------------------------------------------------- */

let helper = null;   // { child, jobs: Map<id, { onChunk, onEnd }> }
let nextId = 1;
let idleTimer = null;

function stop() {
  clearTimeout(idleTimer);
  if (!helper) return;
  const { child } = helper;
  helper = null;
  try { child.kill(); } catch { /* déjà mort */ }
}

function startHelper(python) {
  const child = spawn(python, [helperScript()], {
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1' },
  });
  const h = { child, jobs: new Map() };
  // Flux : une ligne JSON d'en-tête, puis `bytes` octets de PCM s'il y en a.
  let buf = Buffer.alloc(0);
  let header = null;
  child.stdout.on('data', (data) => {
    buf = Buffer.concat([buf, data]);
    for (;;) {
      if (!header) {
        const nl = buf.indexOf(10);
        if (nl < 0) return;
        try { header = JSON.parse(buf.subarray(0, nl).toString('utf8')); } catch { header = {}; }
        buf = buf.subarray(nl + 1);
      }
      const size = header.bytes || 0;
      if (buf.length < size) return;
      const pcm = buf.subarray(0, size);
      buf = buf.subarray(size);
      const msg = header;
      header = null;
      const job = h.jobs.get(msg.id);
      if (!job) continue;
      if (size) job.onChunk(Buffer.from(pcm), msg.rate);
      else if (msg.done || msg.error) {
        h.jobs.delete(msg.id);
        if (msg.error) console.error(`pocket-tts : ${msg.error}`);
        job.onEnd(msg.error ? 'failed' : null);
      }
    }
  });
  let stderrTail = '';
  child.stderr.on('data', (d) => { stderrTail = (stderrTail + d).slice(-2000); });
  const dead = () => {
    if (helper === h) helper = null;
    if (h.jobs.size) console.error(`pocket-tts arrêté :\n${stderrTail}`);
    for (const job of h.jobs.values()) job.onEnd('failed');
    h.jobs.clear();
  };
  child.on('error', dead);
  child.on('close', dead);
  child.stdin.on('error', () => {});
  return h;
}

function send(cmd) {
  if (helper) helper.child.stdin.write(`${JSON.stringify(cmd)}\n`);
}

/* ---- API ----------------------------------------------------------------- */

// Voix retenue pour une langue : celle du réglage si elle existe, sinon la première.
function pickVoice(lang, chosen) {
  const { voices } = LANGS[lang];
  return voices.find((v) => v.id === (chosen && chosen[lang])) || voices[0];
}

function cleanText(text) {
  return String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, MAX_CHARS);
}

// Lecture par Pocket TTS, sous l'identifiant `id`.
function speakPocket(id, python, input, lang, voice, onChunk, onEnd) {
  clearTimeout(idleTimer);
  if (!helper) helper = startHelper(python);
  const h = helper;
  h.jobs.set(id, {
    onChunk,
    onEnd: (code) => {
      if (helper === h && !h.jobs.size) idleTimer = setTimeout(stop, IDLE_MS);
      onEnd(code);
    },
  });
  send({ id, text: input, model: LANGS[lang].model, voice });
}

// Lance une lecture et rend son identifiant. `lang` : 'auto' ou une langue de
// LANGS ; `engine` : 'pocket' ou 'chatterbox' (GPU, cf. chatterbox.js). Service
// Chatterbox arrêté : la lecture passe par Pocket TTS. `onChunk(pcm, rate)`
// reçoit du PCM 16 bits mono au fil de la génération ; `onEnd(code)` une fois,
// avec null ou 'failed'. Lance 'empty' ou 'notInstalled'.
function speak(text, { lang = 'auto', voices, engine = 'pocket' } = {}, onChunk, onEnd) {
  const input = cleanText(text);
  if (!input) throw new Error('empty');
  const python = findPython();
  if (!python && engine !== 'chatterbox') throw new Error('notInstalled');
  const l = LANGS[lang] ? lang : detectLanguage(input, Object.keys(LANGS));
  const voice = pickVoice(l, voices).id;
  const id = nextId++;
  if (engine !== 'chatterbox') {
    speakPocket(id, python, input, l, voice, onChunk, onEnd);
    return id;
  }
  chatterbox.speak(id, input, l, voice, onChunk, (code) => {
    if (code !== 'unreachable') { onEnd(code); return; }
    console.error('chatterbox : service injoignable, lecture par Pocket TTS');
    const py = findPython();
    if (py) speakPocket(id, py, input, l, voice, onChunk, onEnd);
    else onEnd('failed');
  });
  return id;
}

function cancel(id) {
  chatterbox.cancel(id);
  send({ cancel: id });
}

// Charge d'avance le modèle et la voix qui liront `text`, pour que le clic qui
// suit n'attende pas.
function warmUp(text, { lang = 'auto', voices, engine = 'pocket' } = {}) {
  const l = LANGS[lang] ? lang : detectLanguage(cleanText(text), Object.keys(LANGS));
  const voice = pickVoice(l, voices).id;
  const warmPocket = () => {
    const python = findPython();
    if (!python) return;
    clearTimeout(idleTimer);
    if (!helper) helper = startHelper(python);
    if (!helper.jobs.size) idleTimer = setTimeout(stop, IDLE_MS);
    send({ warm: LANGS[l].model, voice });
  };
  // Service Chatterbox arrêté : c'est Pocket TTS qui lira.
  if (engine === 'chatterbox') chatterbox.warmUp(l, voice).then((up) => { if (!up) warmPocket(); });
  else warmPocket();
}

module.exports = { LANGS, isInstalled, pickVoice, speak, cancel, warmUp, stop };
