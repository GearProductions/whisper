import { describe, expect, it, vi } from 'vitest';
import type { SpeakStart, SpeakState } from '../../../bridge';
import { createSpeechPlayer, playView, type SpeechView } from '../../speech';

const ready: SpeakState = { mode: 'selection', ready: true, hasText: true, volume: 1 };

// AudioContext minimal : des sources qu'on termine à la main.
function fakeContext() {
  const sources: { onended: (() => void) | null; stop: () => void }[] = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect: () => {} }),
    createBuffer: (_c: number, length: number, rate: number) => ({ duration: length / rate, getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => {
      const s = { buffer: null, onended: null as (() => void) | null, connect: () => {}, start: () => {}, stop: () => {} };
      sources.push(s);
      return s;
    },
    close: () => Promise.resolve(),
  };
  return { ctx: ctx as unknown as AudioContext, sources };
}

function setup(start: SpeakStart | Promise<SpeakStart> = { ok: true, id: 7 }) {
  const views: SpeechView[] = [];
  const { ctx, sources } = fakeContext();
  const cancelSpeak = vi.fn();
  const player = createSpeechPlayer({
    api: { speak: vi.fn(() => Promise.resolve(start)), cancelSpeak },
    newContext: () => ctx,
    onChange: (v) => views.push(v),
  });
  player.setState(ready);
  return { player, views, sources, cancelSpeak, phase: () => player.view().phase };
}
const pcm = () => new Uint8Array(4800);

describe('lecteur', () => {
  it('morceaux joués puis fin', async () => {
    const { player, sources, phase } = setup();
    player.click();
    expect(phase()).toBe('loading');
    await Promise.resolve(); await Promise.resolve();
    player.onChunk(7, pcm(), 24000);
    expect(phase()).toBe('playing');
    player.onEnd(7, null);
    sources[0].onended!();
    expect(phase()).toBe('idle');
  });

  it('morceaux arrivés avant la réponse : rejoués', async () => {
    let resolve: (s: SpeakStart) => void = () => {};
    const { player, phase } = setup(new Promise<SpeakStart>((r) => { resolve = r; }));
    player.click();
    player.onChunk(7, pcm(), 24000);
    expect(phase()).toBe('loading');
    resolve({ ok: true, id: 7 });
    await vi.waitFor(() => expect(phase()).toBe('playing'));
  });

  it('morceaux d’une autre lecture ignorés', async () => {
    const { player, phase } = setup();
    player.click();
    await vi.waitFor(() => expect(player.view().phase).toBe('loading'));
    await Promise.resolve(); await Promise.resolve();
    player.onChunk(3, pcm(), 24000);
    expect(phase()).toBe('loading');
  });

  it('second clic : arrête et annule la génération', async () => {
    const { player, cancelSpeak, phase } = setup();
    player.click();
    await Promise.resolve(); await Promise.resolve();
    player.onChunk(7, pcm(), 24000);
    player.click();
    expect(phase()).toBe('idle');
    expect(cancelSpeak).toHaveBeenCalledWith(7);
  });

  it('erreur du principal affichée', async () => {
    const { player } = setup({ ok: false, error: 'Rien à lire.' });
    player.click();
    await vi.waitFor(() => expect(player.view()).toMatchObject({ phase: 'error', error: 'Rien à lire.' }));
  });
});

describe('bouton de lecture', () => {
  const view = (state: SpeakState, phase: SpeechView['phase'] = 'idle', error = ''): SpeechView => ({ state, phase, error });
  it.each([
    [view({ mode: 'off' }), { hidden: true, disabled: true }],
    [view({ ...ready, ready: false }), { disabled: true, title: 'Pocket TTS introuvable : voir le README (Lecture à voix haute)' }],
    [view({ ...ready, hasText: false }), { disabled: true, title: 'Sélectionnez du texte à lire' }],
    [view({ ...ready, mode: 'clipboard', hasText: false }), { disabled: true, title: 'Presse-papiers vide' }],
    [view(ready), { hidden: false, disabled: false, title: 'Lire la sélection à voix haute' }],
    [view({ ...ready, hasText: false }, 'playing'), { disabled: false, title: 'Arrêter la lecture' }],
    [view(ready, 'error', 'La synthèse vocale a échoué.'), { title: 'La synthèse vocale a échoué.' }],
  ])('%j', (v, expected) => {
    expect(playView(v)).toMatchObject(expected);
  });
});
