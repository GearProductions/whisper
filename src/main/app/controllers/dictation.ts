/** dictation — la dictée côté appli : coupures du son pendant l'enregistrement
 *  (micro Discord, autres applications), transcription, puis le texte au champ
 *  d'un agent, à l'agent, ou collé au curseur ; le modèle téléchargé au
 *  premier lancement. Ce qui est collé ou envoyé est TOUJOURS ce que whisper
 *  vient de rendre, jamais un texte fourni par la page (I-2).
 *  Ne connaît pas : les pages (seulement leurs messages). Utilisé par : app/ipc,
 *  app/lifecycle, app/menus. */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { selectedAgent } from 'core/config';
import { checkAudio, cleanTranscript, destination, pasteText, TRANSCRIBE_MESSAGES } from 'core/dictation';
import { createMuter, createStreamMuter, isWanted, type MutePlatform } from 'core/sound';
import * as clipboard from 'technicals/clipboard';
import * as paste from 'technicals/paste';
import * as pipewire from 'technicals/pipewire';
import * as windows from 'technicals/windows-helper';
import { locateWhisper, runWhisper } from 'technicals/whisper-cli';
import { loadConfig, ownWhisperDir, whisperDirs } from 'app/settings';
import { state } from 'app/state';
import { conversationInput, conversationNotice, hideBubble, openConversation, openDictation, showBubble } from 'app/windows';
import { sendToAgent } from './agents';

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

// Linux : PipeWire, flux par flux.
const pipewireMuter = createStreamMuter({
  list: async (target, own) => (await pipewire.streams()).filter((s) => isWanted(target, s.props, own)).map((s) => s.id),
  isMuted: pipewire.isMuted,
  setMute: pipewire.setMute,
});

export const muter = createMuter(process.platform === 'linux' ? pipewireMuter : process.platform === 'win32' ? windowsMuter : null);

// Les processus de l'appli : leurs flux audio (les bips) ne sont jamais coupés.
const ownPids = () => [process.pid, ...app.getAppMetrics().map((m) => m.pid)];

// Début (dès le seuil de maintien, avant l'ouverture du micro) et fin de
// l'enregistrement. Au début, la bulle (message de l'appli) s'efface ; le
// son des autres applications et le micro Discord sont coupés si c'est
// autorisé, et « Micro Discord coupé » s'affiche une fois la coupure confirmée
// (celle du son s'entend, elle). La fin rétablit toujours : réglage décoché en
// cours de route ou non, rien ne doit rester coupé (I-11).
export function setRecording(on: unknown) {
  state.recording = !!on;
  if (on) {
    const cfg = loadConfig();
    hideBubble(); // le panneau, lui, reste : on y relit la conversation en dictant
    if (cfg.muteOthers === true) muter.mute('others', ownPids());
    if (cfg.discordMute === true) {
      muter.mute('discord', []).then((n) => { if (n > 0 && state.recording) showBubble('Micro Discord coupé', 'notice'); });
    }
  } else {
    if (state.bubbleKind === 'notice') hideBubble();
    if (state.convNotice && state.convNotice.kind === 'notice') conversationNotice(null); // elle n'a plus lieu d'être
    muter.restore('others');
    muter.restore('discord');
  }
}

/* ---- Transcription -------------------------------------------------------- */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// `pcm` = PCM 16 bits mono 16 kHz, de la page.
export async function transcribe(pcm: unknown) {
  const cfg = loadConfig();
  let text: string;
  try {
    text = cleanTranscript(await runWhisper(whisperDirs(), checkAudio(pcm), { lang: cfg.lang, prompt: cfg.vocabulary }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const code = TRANSCRIBE_MESSAGES[message] ? message : 'failed';
    if (code === 'notInstalled' && state.modelDownload) {
      return { ok: false, code, error: `Modèle de dictée en cours de téléchargement (${state.modelDownload.percent} %).` };
    }
    return { ok: false, code, error: TRANSCRIBE_MESSAGES[code] };
  }
  if (!text) return { ok: true, text: '', pasted: false };
  // Un agent est sélectionné : la dictée lui est destinée, rien n'est collé.
  // Elle arrive dans le champ de saisie de son panneau (ouvert au besoin, en
  // réduit), à relire et compléter ; sans relecture, elle part aussitôt.
  const agent = selectedAgent(cfg);
  const to = destination(cfg, agent);
  if (to === 'review') {
    openConversation(agent!.id);
    conversationInput(text);
    return { ok: true, text, agent: agent!.name, panel: true };
  }
  if (to === 'send') {
    const res = sendToAgent(agent!, { text }, cfg);
    if (!res.ok) clipboard.writeText(text);
    return res.ok ? { ok: true, text, agent: agent!.name }
      : { ok: false, error: `${res.error} Le message est dans le presse-papiers.` };
  }
  const autoPaste = cfg.autoPaste !== false;
  const pasted = await pasteText(text, autoPaste, { clipboard, paste: paste.sendPaste, wait: delay });
  if (cfg.showText !== false) openDictation(text); // après le Ctrl+V : rien ne doit le détourner (I-18)
  return { ok: true, text, pasted, autoPaste };
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
  showBubble('Téléchargement du modèle de dictée (548 Mo)… Une seule fois.', 'status');
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
    showBubble('Modèle de dictée prêt : maintenir l\'icône pour dicter.', 'status');
  } catch (err) {
    console.error(`Téléchargement du modèle whisper : ${err instanceof Error ? err.message : err}`);
    fs.rmSync(part, { force: true });
    showBubble('Téléchargement du modèle de dictée impossible : il sera retenté au prochain lancement.', 'status');
  } finally {
    state.modelDownload = null;
  }
}

// Appelé quand le micro est ouvert : on prépare le collage.
export function warmUpPaste() { paste.warmUp(); return true; }
