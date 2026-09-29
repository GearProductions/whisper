/* =========================================================================
   Whisper — lecture à voix haute par Piper (local)

   `piper` (paquet Python `piper-tts`, par ex. `uv tool install piper-tts`)
   + des voix `*.onnx` accompagnées de leur `*.onnx.json`, posées dans le
   dossier des voix. Comme pour whisper : rien ne sort de la machine.

   Une voix par langue (réglage `speakVoices`, sinon la meilleure qualité,
   voix féminine d'abord) ; un modèle à plusieurs locuteurs (upmc : jessica,
   pierre) compte pour autant de voix. Le texte
   est découpé phrase par phrase entre français et anglais (cf. lang.js), et
   chaque morceau est lu par la voix de sa langue.

   L'exécutable est cherché dans le dossier des voix (jusqu'à deux niveaux),
   puis sur le PATH, puis dans ~/.local/bin.

   Mots anglais dans du français : une voix française n'a appris que les sons
   du français, et ceux de l'anglais (« r » anglais, « th »…) sortent faux. Un
   dictionnaire (réglage `pronunciations`) remplace ces mots, dans les
   passages lus en français, par une graphie « à la française » : { "feature": "fitcheur" }. Une
   valeur entre [[ ]] est prise comme phonèmes espeak bruts.
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { findFile } = require('./whisper');
const { splitByLanguage } = require('./lang');

const MAX_CHARS = 20000;                      // ~20 min de lecture
const CLI_RE = /^piper(\.exe)?$/i;

// ~/.local/bin en plus : c'est là que `uv tool` et `pipx` le posent, et une
// appli lancée hors d'un shell (lanceur, raccourci) ne l'a pas toujours au PATH.
function onPath() {
  const name = process.platform === 'win32' ? 'piper.exe' : 'piper';
  const dirs = String(process.env.PATH || '').split(path.delimiter);
  for (const dir of [...dirs, path.join(os.homedir(), '.local', 'bin')]) {
    if (!dir) continue;
    const file = path.join(dir, name);
    try { if (fs.statSync(file).isFile()) return file; } catch { /* pas là */ }
  }
  return null;
}

const QUALITIES = ['x_low', 'low', 'medium', 'high'];

// Le .onnx.json ne dit pas si une voix est féminine ou masculine : relevé à
// l'écoute pour les voix françaises et anglaises courantes de piper-voices.
const GENDERS = {
  siwis: 'f', jessica: 'f', lessac: 'f', ljspeech: 'f', cori: 'f', amy: 'f', kristin: 'f', kathleen: 'f',
  alba: 'f', jenny_dioco: 'f', hfc_female: 'f', southern_english_female: 'f',
  pierre: 'm', tom: 'm', gilles: 'm', ryan: 'm', joe: 'm', john: 'm', bryce: 'm', danny: 'm', kusal: 'm',
  norman: 'm', alan: 'm', mike: 'm', hfc_male: 'm', northern_english_male: 'm',
};
const MAX_SPEAKERS = 10; // au-delà (mls : 125, libritts : 904), seul le premier est proposé

// [{ id, name, file, speaker, label, lang, quality, gender }] ; `lang` =
// famille de langue (« fr », « en »…), lue avec la qualité dans le .onnx.json
// (une voix sans lui est inutilisable). `id` = nom du fichier, suivi de
// « :locuteur » pour un modèle à plusieurs voix (fr_FR-upmc-medium:jessica).
function listVoices(dir) {
  let names = [];
  try { names = fs.readdirSync(dir).sort(); } catch { /* dossier absent */ }
  const voices = [];
  for (const n of names) {
    if (!/\.onnx$/i.test(n) || !names.includes(`${n}.json`)) continue;
    let json = {};
    try { json = JSON.parse(fs.readFileSync(path.join(dir, `${n}.json`), 'utf8')); } catch { /* illisible */ }
    const name = n.replace(/\.onnx$/i, '');
    const base = {
      name, file: path.join(dir, n),
      lang: String((json.language && json.language.family) || '?'),
      quality: QUALITIES.includes(json.audio && json.audio.quality) ? json.audio.quality : '',
    };
    const short = name.split('-')[1] || name; // fr_FR-siwis-medium → siwis
    const speakers = Object.entries(json.speaker_id_map || {});
    if (speakers.length > 1 && speakers.length <= MAX_SPEAKERS) {
      for (const [speaker, sid] of speakers) {
        voices.push({ ...base, id: `${name}:${speaker}`, speaker: sid, label: `${short} (${speaker})`, gender: GENDERS[speaker] || '' });
      }
    } else {
      voices.push({ ...base, id: name, speaker: null, label: short, gender: GENDERS[short] || '' });
    }
  }
  return voices;
}

// { cli, voices } ; cli à null s'il manque.
function locatePiper(dir) {
  return { cli: findFile(dir, (n) => CLI_RE.test(n)) || onPath(), voices: listVoices(dir) };
}

// Meilleure qualité d'abord, puis voix féminine, puis ordre alphabétique.
const rank = (v) => [-QUALITIES.indexOf(v.quality), v.gender === 'f' ? 0 : 1];
function better(a, b) {
  const [ra, rb] = [rank(a), rank(b)];
  return ra[0] !== rb[0] ? ra[0] < rb[0] : ra[1] < rb[1];
}

// { langue: voix } : la voix choisie (`chosen`, { fr: 'fr_FR-upmc-medium:jessica' })
// si elle est installée, sinon la meilleure de sa langue.
function pickVoices(voices, chosen) {
  const byLang = {};
  for (const v of voices) {
    const cur = byLang[v.lang];
    const want = chosen && chosen[v.lang];
    if (!cur || (cur.id !== want && (v.id === want || better(v, cur)))) byLang[v.lang] = v;
  }
  return byLang;
}

// Piper lit ligne à ligne : un retour à la ligne en plein milieu d'une phrase
// (texte copié d'un PDF, d'un terminal…) y mettrait une pause. On ne garde que
// les coupures de paragraphe.
function cleanText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_CHARS);
}

// Mots entiers, sans tenir compte de la casse ; une clé de plusieurs mots
// accepte n'importe quel blanc entre eux. Une seule passe : ce qui vient d'être
// remplacé n'est pas remplacé à nouveau.
function applyPronunciations(text, dict) {
  const norm = (k) => k.toLowerCase().replace(/\s+/g, ' ').trim();
  const map = new Map();
  for (const [k, v] of Object.entries(dict && typeof dict === 'object' ? dict : {})) {
    if (typeof v === 'string' && norm(k)) map.set(norm(k), v);
  }
  if (!map.size) return text;
  const alternatives = [...map.keys()]
    .sort((a, b) => b.length - a.length) // « pull request » avant « pull »
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return text.replace(re, (m) => map.get(norm(m)));
}

const running = new Set(); // synthèses en cours, pour pouvoir les annuler

function runPiper(cli, voice, dir, input) {
  return new Promise((resolve, reject) => {
    // `-f -` : le WAV sort sur stdout, pas de fichier temporaire.
    const args = ['-m', voice.file, '-f', '-', ...(voice.speaker === null ? [] : ['-s', String(voice.speaker)])];
    const child = execFile(cli, args, {
      cwd: dir, encoding: 'buffer', timeout: 120000, maxBuffer: 256 * 1024 * 1024, windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1' }, // Windows : stdin en UTF-8, pas en cp1252
    }, (err, stdout) => {
      running.delete(child);
      if (child.cancelled) reject(new Error('cancelled'));
      else if (err) reject(new Error(err.killed ? 'timeout' : 'failed'));
      else resolve(stdout);
    });
    running.add(child);
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

// Résout les WAV à jouer bout à bout (un par passage de même langue). `lang` :
// 'auto' (détection) ou une langue imposée. Rejette avec un code
// ('notInstalled', 'empty', 'failed', 'timeout', 'cancelled').
async function synthesize(voiceDir, text, { pronunciations, voices: chosen, lang = 'auto' } = {}) {
  const dir = path.resolve(voiceDir);
  const input = cleanText(text);
  if (!input) throw new Error('empty');
  const { cli, voices } = locatePiper(dir);
  const byLang = pickVoices(voices, chosen);
  if (!cli || !voices.length) throw new Error('notInstalled');
  const segments = byLang[lang]
    ? [{ lang, text: input }]
    : splitByLanguage(input, Object.keys(byLang));
  cancel();
  // En parallèle : chaque Piper charge sa voix (~0,5 s), c'est l'essentiel du délai.
  const kill = (err) => { cancel(); throw err; };
  return Promise.all(segments.map((seg) => runPiper(cli, byLang[seg.lang], dir,
    seg.lang === 'fr' ? applyPronunciations(seg.text, pronunciations) : seg.text).catch(kill)));
}

function cancel() {
  for (const child of running) {
    child.cancelled = true;
    try { child.kill(); } catch { /* déjà fini */ }
  }
  running.clear();
}

module.exports = { locatePiper, pickVoices, synthesize, cancel };
