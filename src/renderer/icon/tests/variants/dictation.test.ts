import { describe, expect, it, vi } from 'vitest';
import type { DictationConfig, TranscribeResult } from '../../../bridge';
import { isSilent, RATE, rms, toPcm } from '../../audio';
import { createDictation, type Phase, type Recording } from '../../dictation';

const cfg: DictationConfig = { lang: 'fr', vocabulary: '', sound: true, deviceId: '', deviceLabel: '' };
const stream = () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream;

function run(rec: Recording, result: TranscribeResult) {
  const phases: [Phase, string | undefined][] = [];
  const transcribe = vi.fn(async () => result);
  const beep = vi.fn();
  const d = createDictation({
    api: { getConfig: async () => cfg, setRecording: () => {}, warmUp: async () => true, transcribe },
    openMic: async () => stream(),
    record: () => rec,
    beep,
    stopSpeaking: () => {},
    setPhase: (p, m) => { phases.push([p, m]); },
  });
  return { d, phases, transcribe, beep };
}
const voice = (seconds = 1): Recording => ({ chunks: [new Float32Array(RATE * seconds).fill(0.3)], length: RATE * seconds, peak: 0.3, release: vi.fn() });

describe('audio', () => {
  it('silence : trop court ou trop faible', () => {
    expect(isSilent(RATE * 0.39, 0.5)).toBe(true);
    expect(isSilent(RATE, 0.007)).toBe(true);
    expect(isSilent(RATE, 0.008)).toBe(false);
  });
  it('rms et PCM 16 bits bornés', () => {
    expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
    expect([...toPcm([new Float32Array([2, -2, 0])], 3)]).toEqual([32767, -32768, 0]);
  });
});

describe('dictée', () => {
  it('silence : whisper n’est pas appelé (I-10)', async () => {
    const { d, phases, transcribe } = run({ chunks: [], length: RATE * 0.2, peak: 0.3, release: vi.fn() }, { ok: true, text: 'x' });
    await d.start();
    await d.stop();
    expect(transcribe).not.toHaveBeenCalled();
    expect(phases.at(-1)).toEqual(['idle', 'Aucune parole détectée.']);
  });

  it('bip aigu au micro ouvert, grave au relâché', async () => {
    const { d, beep } = run(voice(), { ok: true, text: 'x', pasted: true });
    await d.start();
    expect(beep).toHaveBeenLastCalledWith(cfg, 880);
    await d.stop();
    expect(beep).toHaveBeenLastCalledWith(cfg, 520);
  });

  it.each([
    [{ ok: true, text: 'x', pasted: true }, ['idle', '']],
    [{ ok: true, text: 'x', pasted: false, autoPaste: false }, ['idle', 'Texte dans le presse-papiers : Ctrl+V pour le coller.']],
    [{ ok: true, text: 'x', pasted: false, autoPaste: true }, ['idle', 'Collage impossible : le texte est dans le presse-papiers.']],
    [{ ok: true, text: 'x', agent: 'alpha', panel: true }, ['idle', 'Ajouté au message pour alpha.']],
    [{ ok: true, text: 'x', agent: 'alpha' }, ['idle', 'Envoyé à alpha.']],
    [{ ok: true, text: '' }, ['idle', 'Aucune parole détectée.']],
    [{ ok: false, error: 'La transcription a pris trop de temps.' }, ['error', 'La transcription a pris trop de temps.']],
  ] as [TranscribeResult, [Phase, string]][])('résultat %j → infobulle', async (result, expected) => {
    const { d, phases } = run(voice(), result);
    await d.start();
    await d.stop();
    expect(phases.at(-1)).toEqual(expected);
  });

  it('PCM 16 bits envoyé à whisper', async () => {
    const { d, transcribe } = run(voice(2), { ok: true, text: 'x', pasted: true });
    await d.start();
    await d.stop();
    const buf = (transcribe.mock.calls[0] as unknown as [ArrayBuffer])[0];
    expect(buf.byteLength).toBe(RATE * 2 * 2);
  });
});
