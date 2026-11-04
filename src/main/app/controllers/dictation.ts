/** dictation — la dictée côté appli : coupures du son pendant l'enregistrement
 *  (micro Discord, autres applications), transcription rendue à la page qui l'a
 *  demandée (le panneau), le modèle téléchargé au premier lancement. Le texte
 *  rendu est TOUJOURS ce que whisper vient de rendre, jamais un texte fourni
 *  par la page (I-2) ; il n'est ni collé ni envoyé à un agent ici. Un
 *  enregistrement muet ou trop court n'atteint pas whisper (I-10).
 *  Ne connaît pas : les pages (seulement leurs messages). Utilisé par : app/ipc,
 *  app/lifecycle, app/menus. */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { checkAudio, cleanTranscript, TRANSCRIBE_MESSAGES } from 'core/dictation';
import { createMuter, createStreamMuter, isWanted, streamKey, type MutePlatform } from 'core/sound';
import { readJson, writeJson } from 'technicals/config-file';
import * as pipewire from 'technicals/pipewire';
import * as windows from 'technicals/windows-helper';
import { locateWhisper, runWhisper } from 'technicals/whisper-cli';
import { loadConfig, ownWhisperDir, whisperDirs } from 'app/settings';
import { state } from 'app/state';
import { conversationNotice } from 'app/windows';
import type { TranscribeResult } from 'shared/bridge';

/* ---- Coupures du son ------------------------------------------------------ */

// Windows : l'assistant tient lui-même la liste des sessions qu'il a coupées.
const windowsMuter: MutePlatform = {
  async mute(target, own) {
    const command = target === 'others' ? `others-mute ${[...own].join(',')}` : 'discord-mute';
    const n = Number(await windows.request(command));
    return Number.isFinite(n) ? n : 0;
  },
  restore: (target) => windows.request(`${target}-restore`),
};

// Linux : PipeWire, flux par flux. Les applications restées muettes dans la
// mémoire de WirePlumber (flux disparu avant d'être rétabli) sont retenues
// dans les données de l'appli, jusqu'à ce qu'elles soient rétablies.
const pendingFile = () => path.join(app.getPath('userData'), 'sons-a-retablir.json');
const pipewireMuter = createStreamMuter({
  list: async (target, own) => (await pipewire.streams()).filter((s) => isWanted(target, s.props, own)).map((s) => s.id),
  isMuted: pipewire.isMuted,
  setMute: pipewire.setMute,
  keyOf: async (id) => { const p = await pipewire.inspect(id); return p ? streamKey(p) : null; },
  findByKey: async (key) => (await pipewire.streams()).filter((s) => streamKey(s.props) === key).map((s) => s.id),
}, {
  load: () => { const keys = readJson(pendingFile()).keys; return Array.isArray(keys) ? keys.filter((k) => typeof k === 'string') : []; },
  save: (keys) => { try { writeJson(pendingFile(), { keys }); } catch { /* sans importance : retenu jusqu'à la sortie */ } },
});

export const muter = createMuter(process.platform === 'linux' ? pipewireMuter : process.platform === 'win32' ? windowsMuter : null);

// Une application restée muette est rétablie dès qu'elle rejoue : un coup
// d'œil toutes les HEAL_MS, seulement s'il y en a, et jamais pendant une dictée.
// ponytail: regard périodique (5 s de silence au pire) ; suivre pw-mon si le délai gêne.
const HEAL_MS = 5000;
export function startHealing() {
  muter.heal();
  setInterval(() => { if (muter.pending() && !state.recording) muter.heal(); }, HEAL_MS);
}

// Dépannage (menu) : rétablir le son des autres applications et le micro de
// Discord, même ce que l'appli n'aurait pas su rétablir.
export async function forceRestoreSound() {
  const own = ownPids();
  const n = (await muter.force('others', own)) + (await muter.force('discord', own));
  conversationNotice(n ? `Son rétabli : ${n} flux remis en marche.` : 'Rien n\'était coupé : le son et le micro Discord sont déjà rétablis.', 'status');
}

// Les processus de l'appli : leurs flux audio (les bips) ne sont jamais coupés.
const ownPids = () => [process.pid, ...app.getAppMetrics().map((m) => m.pid)];

// Début (dès le seuil de maintien, avant l'ouverture du micro) et fin de
// l'enregistrement. Au début, le
// son des autres applications et le micro Discord sont coupés si c'est
// autorisé, et « Micro Discord coupé » s'affiche une fois la coupure confirmée
// (celle du son s'entend, elle). La fin rétablit toujours : réglage décoché en
// cours de route ou non, rien ne doit rester coupé (I-11).
export function setRecording(on: unknown) {
  state.recording = !!on;
  if (on) {
    const cfg = loadConfig();
    if (cfg.muteOthers === true) muter.mute('others', ownPids());
    if (cfg.discordMute === true) {
      muter.mute('discord', []).then((n) => { if (n > 0 && state.recording) conversationNotice('Micro Discord coupé', 'notice'); });
    }
  } else {
    if (state.convNotice && state.convNotice.kind === 'notice') conversationNotice(null); // elle n'a plus lieu d'être
    muter.restore('others');
    muter.restore('discord');
  }
}

/* ---- Transcription -------------------------------------------------------- */

// `pcm` = PCM 16 bits mono 16 kHz, de la page.
export async function transcribe(pcm: unknown): Promise<TranscribeResult> {
  const cfg = loadConfig();
  try {
    return { ok: true, text: cleanTranscript(await runWhisper(whisperDirs(), checkAudio(pcm), { lang: cfg.lang, prompt: cfg.vocabulary })) };
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const code = TRANSCRIBE_MESSAGES[message] ? message : 'failed';
    if (code === 'notInstalled' && state.modelDownload) {
      return { ok: false, code, error: `Modèle de dictée en cours de téléchargement (${state.modelDownload.percent} %).` };
    }
    return { ok: false, code, error: TRANSCRIBE_MESSAGES[code] };
  }
}

/* ---- Modèle whisper : téléchargé au premier lancement --------------------- */

// Le paquet livre whisper-cli, pas le modèle (548 Mo) : on le télécharge dans
// nos données s'il n'est trouvé nulle part. Bon en français ; ~0,3 s par
// dictée sur GPU, quelques secondes sur processeur.
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin';

export async function ensureModel() {
  if (state.modelDownload || locateWhisper(whisperDirs()).model) return;
  const dest = path.join(ownWhisperDir(), path.basename(MODEL_URL));
  const part = `${dest}.part`;
  const download = { percent: 0 };
  state.modelDownload = download;
  conversationNotice('Téléchargement du modèle de dictée (548 Mo)… Une seule fois.', 'status');
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 0;
    fs.mkdirSync(ownWhisperDir(), { recursive: true });
    const out = fs.createWriteStream(part);
    let received = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      received += chunk.length;
      if (total) download.percent = Math.floor((received / total) * 100);
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    fs.renameSync(part, dest);
    conversationNotice('Modèle de dictée prêt : maintenir le micro pour dicter.', 'status');
  } catch (err) {
    console.error(`Téléchargement du modèle whisper : ${err instanceof Error ? err.message : err}`);
    fs.rmSync(part, { force: true });
    conversationNotice('Téléchargement du modèle de dictée impossible : il sera retenté au prochain lancement.', 'status');
  } finally {
    state.modelDownload = null;
  }
}
