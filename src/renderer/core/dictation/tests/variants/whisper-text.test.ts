// Variants de la dictée côté page (note 0.14.0, « Ce que ça ne doit pas
// faire »). Venus de tests/invariants (0.15.0, assainissement).
//   I-2 (réduit) : ce que la dictée met dans le champ est ce que whisper vient
//         de rendre, tel quel.
//   I-10 : pas de whisper sur du silence (F-4) : un enregistrement muet ou
//         trop court n'est pas transcrit.
import { describe, expect, it, vi } from 'vitest';
import { createDictation, MIN_PEAK, type Recording } from 'core/dictation';
import type { DictationConfig, TranscribeResult } from 'technicals/bridge';

const cfg: DictationConfig = { lang: 'fr', vocabulary: '', sound: false, deviceId: '', deviceLabel: '' };
const RATE = 16000;
const stream = () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream;
// Une seconde de parole, bien au-dessus du seuil.
const speech = (): Recording => ({ chunks: [new Float32Array(RATE).fill(0.2)], length: RATE, peak: 0.2, release: vi.fn() });
// Une seconde sous le seuil d'énergie.
const quiet = (): Recording => ({ chunks: [new Float32Array(RATE).fill(MIN_PEAK / 2)], length: RATE, peak: MIN_PEAK / 2, release: vi.fn() });
// Un dixième de seconde de parole.
const brief = (): Recording => ({ chunks: [new Float32Array(RATE / 10).fill(0.2)], length: RATE / 10, peak: 0.2, release: vi.fn() });

// Le temps que la transcription revienne : start() et stop() ne rendent rien à attendre.
const settle = () => new Promise((r) => setTimeout(r, 20));

// Une dictée dont on relève ce qui part à whisper et ce qui revient au champ.
function setup(rec: () => Recording, whisperSays: string) {
  const transcribed: ArrayBuffer[] = [];
  const texts: string[] = [];
  const d = createDictation({
    api: {
      getConfig: async () => cfg,
      setRecording: () => {},
      transcribe: async (pcm): Promise<TranscribeResult> => { transcribed.push(pcm); return { ok: true, text: whisperSays }; },
    },
    openMic: async () => stream(),
    record: rec,
    beep: () => {},
    stopSpeaking: () => {},
    setPhase: () => {},
    onText: (text: string) => { texts.push(text); },
  });
  return { d, transcribed, texts };
}

describe('le champ reçoit ce que whisper vient de rendre (I-2)', () => {
  it('le texte rendu au champ est la transcription, telle quelle', async () => {
    const whisperSays = 'bonjour, le monde';
    const { d, texts } = setup(speech, whisperSays);

    await d.start();
    await d.stop();
    await settle();

    // Le seul texte rendu est celui de whisper.
    expect(texts).toEqual([whisperSays]);
  });
});

describe('pas de whisper sur du silence (I-10)', () => {
  it('un enregistrement sous le seuil d’énergie n’est pas transcrit', async () => {
    const { d, transcribed } = setup(quiet, 'texte inventé');

    await d.start();
    await d.stop();
    await settle();

    // Rien n'est parti à whisper.
    expect(transcribed).toEqual([]);
  });

  it('un enregistrement trop court n’est pas transcrit', async () => {
    const { d, transcribed } = setup(brief, 'texte inventé');

    await d.start();
    await d.stop();
    await settle();

    // Rien n'est parti à whisper.
    expect(transcribed).toEqual([]);
  });

  it('un enregistrement muet ne rend aucun texte au champ', async () => {
    const { d, texts } = setup(quiet, 'texte inventé');

    await d.start();
    await d.stop();
    await settle();

    // Le champ ne reçoit rien.
    expect(texts).toEqual([]);
  });
});
