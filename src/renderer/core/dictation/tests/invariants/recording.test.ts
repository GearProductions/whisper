// Invariant (SPEC I-11, côté page) : tout enregistrement commencé
// (`setRecording(true)`, qui coupe le son et le micro Discord) se termine par
// `setRecording(false)`, quel que soit le chemin de sortie. Sinon le principal
// ne rétablit rien. Protégé : si ce test échoue, corriger le code.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDictation, MAX_MS, type Recording } from 'core/dictation';
import type { DictationConfig, TranscribeResult } from 'technicals/bridge';

const cfg: DictationConfig = { lang: 'fr', vocabulary: '', sound: false, deviceId: '', deviceLabel: '' };
const stream = () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream;
const speech = (): Recording => ({ chunks: [new Float32Array(16000).fill(0.2)], length: 16000, peak: 0.2, release: vi.fn() });
const silence = (): Recording => ({ chunks: [new Float32Array(16000)], length: 16000, peak: 0, release: vi.fn() });

function setup(opts: { mic?: () => Promise<MediaStream>; rec?: () => Recording; transcribe?: () => Promise<TranscribeResult> } = {}) {
  const calls: boolean[] = [];
  const d = createDictation({
    api: {
      getConfig: async () => cfg,
      setRecording: (on) => { calls.push(on); },
      warmUp: async () => true,
      transcribe: opts.transcribe || (async () => ({ ok: true, text: 'bonjour', pasted: true })),
    },
    openMic: opts.mic || (async () => stream()),
    record: opts.rec || speech,
    beep: () => {},
    stopSpeaking: () => {},
    setPhase: () => {},
  });
  return { d, calls };
}

const closed = (calls: boolean[]) => {
  expect(calls[0]).toBe(true);
  expect(calls.filter((c) => c)).toHaveLength(1);
  expect(calls.filter((c) => !c)).toHaveLength(1);
  expect(calls[calls.length - 1]).toBe(false);
};

afterEach(() => { vi.useRealTimers(); });

describe('un enregistrement commencé est toujours terminé', () => {
  it('micro refusé', async () => {
    const { d, calls } = setup({ mic: () => Promise.reject(new Error('NotAllowedError')) });
    await d.start();
    closed(calls);
  });

  it('relâché pendant l’ouverture du micro', async () => {
    let open: (s: MediaStream) => void = () => {};
    const { d, calls } = setup({ mic: () => new Promise((r) => { open = r; }) });
    const started = d.start();
    await vi.waitFor(() => expect(calls).toEqual([true]));
    await d.stop();
    open(stream());
    await started;
    closed(calls);
  });

  it('silence', async () => {
    const { d, calls } = setup({ rec: silence });
    await d.start();
    await d.stop();
    closed(calls);
  });

  it('parole transcrite', async () => {
    const { d, calls } = setup();
    await d.start();
    await d.stop();
    closed(calls);
  });

  it('transcription en échec', async () => {
    const { d, calls } = setup({ transcribe: () => Promise.reject(new Error('x')) });
    await d.start();
    await d.stop();
    closed(calls);
  });

  it('durée maximale atteinte sans relâcher', async () => {
    vi.useFakeTimers();
    const { d, calls } = setup();
    await d.start();
    await vi.advanceTimersByTimeAsync(MAX_MS);
    closed(calls);
  });
});
