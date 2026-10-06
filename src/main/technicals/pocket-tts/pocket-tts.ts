/** pocket-tts — lecture à voix haute par Pocket TTS (Kyutai), en local.
 *
 *  `pocket-tts` (paquet Python, sur le processeur). S'il manque, l'appli
 *  l'installe elle-même dans ses données (install : ~400 Mo à télécharger,
 *  ~1,2 Go sur le disque dont 740 Mo pour PyTorch, Python compris)
 *  avec `uv`, livré dans le paquet ; en développement, celui du système. Une
 *  installation faite à la main (uv tool install pocket-tts) sert aussi.
 *  Un processus Python permanent (pocket-helper.py, lancé avec le Python de
 *  cette installation) garde modèles et voix en mémoire et renvoie l'audio par
 *  morceaux au fil de la génération : la lecture commence ~0,1 s après le clic.
 *  Il démarre au survol du bouton (warmUp : chargement ~3 s, ~1,5 Go par
 *  langue) et s'arrête après IDLE_MS sans lecture, pour rendre la mémoire.
 *
 *  Un modèle par langue, la voix au choix parmi quelques-unes : celles que
 *  Kyutai fournit toutes prêtes (le clonage à partir d'un enregistrement
 *  demande des poids à accès restreint). Le texte entier est lu dans une seule
 *  langue, détectée (cf. helpers/lang) ou imposée : une voix française dit très
 *  bien les termes techniques anglais.
 *  Ne connaît pas : la sélection, le bouton. Utilisé par : app/controllers/speech,
 *  app/menus. */
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { detectLanguage } from 'helpers';
import { scriptPath, which } from 'technicals/paths';

const MAX_CHARS = 20000;          // ~20 min de lecture
// Version figée : pocket-helper.py dépend de son API (generate_audio_stream…).
const POCKET_TTS = 'pocket-tts==3.3.0';
const TORCH_CPU_INDEX = 'https://download.pytorch.org/whl/cpu'; // ~200 Mo au lieu de ~3 Go (CUDA)
const isWin = process.platform === 'win32';
const IDLE_MS = 10 * 60 * 1000;

// Modèles « 24l » : les plus soignés ; quantifiés (cf. pocket-helper.py), ~5
// fois plus rapides que la lecture. Voix sous licence libre (CC0, CC-BY) ;
// `cosette` et `jean`, réservées à un usage non commercial, sont écartées.
// Sexe vérifié à la hauteur de la voix, pas au prénom (Alba est un homme).
export type Voice = { id: string; label: string; gender: 'f' | 'm' };
export type SpeechLang = 'fr' | 'en';
export const LANGS: Record<SpeechLang, { model: string; voices: Voice[] }> = {
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
      { id: 'jane', label: 'Jane', gender: 'f' },
      { id: 'anna', label: 'Anna', gender: 'f' },
      { id: 'alba', label: 'Alba', gender: 'm' },
    ],
  },
};

/* ---- Installation -------------------------------------------------------- */

let dirs: { data: string | null; bin: string | null } = { data: null, bin: null }; // données de l'appli, binaires du paquet
export function setDirs(d: typeof dirs) { dirs = d; }

// Notre installation (cf. install) : dans les données de l'appli.
const ownBase = () => (dirs.data ? path.join(dirs.data, 'pocket-tts') : null);
function ownPython() {
  const base = ownBase();
  if (!base) return null;
  const py = path.join(base, 'tools', 'pocket-tts', ...(isWin ? ['Scripts', 'python.exe'] : ['bin', 'python']));
  return fs.existsSync(py) ? py : null;
}

// Le Python de l'installation de pocket-tts : la nôtre, sinon celle de
// l'utilisateur. uv et pipx posent un lien vers le script de l'environnement,
// dont la première ligne (#!) nomme ce Python ; sous Windows, uv range
// l'environnement dans %APPDATA%\uv\tools.
function findPython(): string | null {
  const own = ownPython();
  if (own) return own;
  if (isWin) {
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

export const isInstalled = () => !!findPython();

/* ---- Installation automatique -------------------------------------------- */

function findUv(): string | null {
  const name = isWin ? 'uv.exe' : 'uv';
  const bundled = dirs.bin && path.join(dirs.bin, name);
  return bundled && fs.existsSync(bundled) ? bundled : which(name);
}

export const canInstall = () => !!(findUv() && ownBase());

// Python géré par uv, Pocket TTS et PyTorch (version processeur), le tout
// dans les données de l'appli : rien dans le système. Une seule à la fois ;
// résout true si Pocket TTS est ensuite utilisable.
let installing: Promise<boolean> | null = null;
export function install(): Promise<boolean> {
  if (installing) return installing;
  const uv = findUv();
  const base = ownBase();
  if (!uv || !base) return Promise.resolve(false);
  const cache = path.join(base, 'cache');
  const env = {
    ...process.env,
    UV_TOOL_DIR: path.join(base, 'tools'),
    UV_TOOL_BIN_DIR: path.join(base, 'bin'),
    UV_PYTHON_INSTALL_DIR: path.join(base, 'python'),
    UV_PYTHON_PREFERENCE: 'only-managed',   // pas le Python du système
    UV_CACHE_DIR: cache,
    UV_NO_PROGRESS: '1',
  };
  installing = new Promise((resolve) => {
    execFile(uv, ['tool', 'install', '--force', '--python', '3.12', POCKET_TTS, '--index', TORCH_CPU_INDEX],
      { env, timeout: 30 * 60 * 1000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, _stdout, stderr) => {
        if (err) console.error(`Installation de Pocket TTS : ${stderr || err.message}`);
        fs.rm(cache, { recursive: true, force: true }, () => {}); // ~1 Go de téléchargements
        installing = null;
        resolve(!err && !!ownPython());
      });
  });
  return installing;
}

/* ---- Processus Python ---------------------------------------------------- */

type Job = { onChunk: (pcm: Buffer, rate: number) => void; onEnd: (code: string | null) => void };
type Helper = { child: ChildProcess; jobs: Map<number, Job> };
let helper: Helper | null = null;
let nextId = 1;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

export function stop() {
  clearTimeout(idleTimer);
  if (!helper) return;
  const { child } = helper;
  helper = null;
  try { child.kill(); } catch { /* déjà mort */ }
}

function startHelper(python: string): Helper {
  const child = spawn(python, [scriptPath('pocket-helper.py')], {
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1' },
  });
  const h: Helper = { child, jobs: new Map() };
  // Flux : une ligne JSON d'en-tête, puis `bytes` octets de PCM s'il y en a.
  let buf = Buffer.alloc(0);
  let header: { id?: number; bytes?: number; rate?: number; done?: boolean; error?: string } | null = null;
  child.stdout!.on('data', (data: Buffer) => {
    buf = Buffer.concat([buf, data]);
    for (;;) {
      if (!header) {
        const nl = buf.indexOf(10);
        if (nl < 0) return;
        try { header = JSON.parse(buf.subarray(0, nl).toString('utf8')); } catch { header = {}; }
        buf = buf.subarray(nl + 1);
      }
      const msg = header!;
      const size = msg.bytes || 0;
      if (buf.length < size) return;
      const pcm = buf.subarray(0, size);
      buf = buf.subarray(size);
      header = null;
      const job = h.jobs.get(msg.id!);
      if (!job) continue;
      if (size) job.onChunk(Buffer.from(pcm), msg.rate!);
      else if (msg.done || msg.error) {
        h.jobs.delete(msg.id!);
        if (msg.error) console.error(`pocket-tts : ${msg.error}`);
        job.onEnd(msg.error ? 'failed' : null);
      }
    }
  });
  let stderrTail = '';
  child.stderr!.on('data', (d) => { stderrTail = (stderrTail + d).slice(-2000); });
  const dead = () => {
    if (helper === h) helper = null;
    if (h.jobs.size) console.error(`pocket-tts arrêté :\n${stderrTail}`);
    for (const job of h.jobs.values()) job.onEnd('failed');
    h.jobs.clear();
  };
  child.on('error', dead);
  child.on('close', dead);
  child.stdin!.on('error', () => {});
  return h;
}

function send(cmd: unknown) {
  if (helper) helper.child.stdin!.write(`${JSON.stringify(cmd)}\n`);
}

/* ---- API ----------------------------------------------------------------- */

// Voix retenue pour une langue : celle du réglage si elle existe, sinon la première.
export function pickVoice(lang: SpeechLang, chosen?: Partial<Record<string, string>> | null) {
  const { voices } = LANGS[lang];
  return voices.find((v) => v.id === (chosen && chosen[lang])) || voices[0];
}

function cleanText(text: unknown) {
  return String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, MAX_CHARS);
}

// Lecture par Pocket TTS, sous l'identifiant `id`.
function speakPocket(id: number, python: string, input: string, lang: SpeechLang, voice: string, onChunk: Job['onChunk'], onEnd: Job['onEnd']) {
  clearTimeout(idleTimer);
  if (!helper) helper = startHelper(python);
  const h: Helper = helper;
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
// LANGS. `onChunk(pcm, rate)` reçoit du PCM 16 bits mono au fil de la
// génération ; `onEnd(code)` une fois, avec null ou 'failed'. Lance 'empty' ou
// 'notInstalled'.
export type SpeakOptions = { lang?: string; voices?: Partial<Record<string, string>> | null };
const langOf = (lang: string, input: string): SpeechLang => (lang in LANGS ? lang as SpeechLang : detectLanguage(input, Object.keys(LANGS)) as SpeechLang);

export function speak(text: unknown, { lang = 'auto', voices }: SpeakOptions, onChunk: Job['onChunk'], onEnd: Job['onEnd']) {
  const input = cleanText(text);
  if (!input) throw new Error('empty');
  const python = findPython();
  if (!python) throw new Error('notInstalled');
  const l = langOf(lang, input);
  const id = nextId++;
  speakPocket(id, python, input, l, pickVoice(l, voices).id, onChunk, onEnd);
  return id;
}

export function cancel(id: unknown) {
  send({ cancel: id });
}

// Charge d'avance le modèle et la voix qui liront `text`, pour que le clic qui
// suit n'attende pas.
export function warmUp(text: unknown, { lang = 'auto', voices }: SpeakOptions = {}) {
  const python = findPython();
  if (!python) return;
  const l = langOf(lang, cleanText(text));
  clearTimeout(idleTimer);
  if (!helper) helper = startHelper(python);
  if (!helper.jobs.size) idleTimer = setTimeout(stop, IDLE_MS);
  send({ warm: LANGS[l].model, voice: pickVoice(l, voices).id });
}
