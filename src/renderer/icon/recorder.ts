/** recorder — le micro : l'ouvrir (retrouvé par son nom si son identifiant a
 *  changé), lister les entrées, enregistrer à 16 kHz.
 *  Ne connaît pas : le pont (setDevice est passé), React. Utilisé par : IconApp. */
import type { DictationConfig, MicDevice } from '../bridge';
import { RATE, rms } from './audio';
import type { Recording } from './dictation';

// L'identifiant d'un micro peut changer (casque rebranché ailleurs) : on le
// retrouve alors par son NOM, et on le dit au principal. Introuvable → micro
// par défaut.
export async function openMic(cfg: DictationConfig, onRelabel: (id: string, label: string) => void): Promise<MediaStream> {
  const base = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (cfg.deviceId) {
    let deviceId: string | null = cfg.deviceId;
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
      if (!inputs.some((d) => d.deviceId === deviceId)) {
        const byLabel = cfg.deviceLabel ? inputs.find((d) => d.label === cfg.deviceLabel) : undefined;
        deviceId = byLabel ? byLabel.deviceId : null;
        if (byLabel) onRelabel(byLabel.deviceId, byLabel.label);
      }
    } catch { /* énumération impossible : on tente l'identifiant tel quel */ }
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: { ...base, deviceId: { exact: deviceId } } });
      } catch (err) {
        const name = (err as Error | null)?.name;
        if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw err;
      }
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: base });
}

// Micros pour le menu. Les entrées virtuelles « default » et « communications »
// de Windows doublonnent un vrai périphérique.
export async function listInputs(): Promise<MicDevice[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
      .map((d) => ({ deviceId: d.deviceId, label: d.label }));
  } catch { return []; }
}

// Enregistre le flux jusqu'à release(). Le contexte rééchantillonne lui-même à
// 16 kHz : le format de whisper.
export function record(stream: MediaStream): Recording {
  const ctx = new AudioContext({ sampleRate: RATE });
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const rec: Recording = {
    chunks: [], length: 0, peak: 0,
    release() {
      try { proc.disconnect(); source.disconnect(); } catch { /* déjà débranché */ }
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    rec.chunks.push(new Float32Array(data));
    rec.length += data.length;
    rec.peak = Math.max(rec.peak, rms(data));
  };
  source.connect(proc);
  proc.connect(ctx.destination); // sans sortie branchée, onaudioprocess ne tourne pas
  return rec;
}
