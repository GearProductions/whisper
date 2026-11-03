import { describe, expect, it, vi } from 'vitest';
import { createSpeechPlayer, type SpeechPhase } from 'core/speech';
import type { SpeakStart } from 'technicals/bridge';

// AudioContext minimal : des sources qu'on termine à la main.
function fakeContext() {
  const sources: { onended: (() => void) | null; stop: () => void }[] = [];
  const ctx = {
    currentTime: 0,
    destination: {},
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
  const phases: SpeechPhase[] = [];
  const messages: (string | undefined)[] = [];
  const { ctx, sources } = fakeContext();
  const cancelSpeak = vi.fn();
  const speak = vi.fn(() => Promise.resolve(start));
  let chunk: (id: number, pcm: Uint8Array, rate: number) => void = () => {};
  let end: (id: number, error: string | null) => void = () => {};
  const player = createSpeechPlayer({
    api: { speak, cancelSpeak, onSpeakChunk: (f) => { chunk = f; }, onSpeakEnd: (f) => { end = f; } },
    newContext: () => ctx,
    onChange: (p, m) => { phases.push(p); messages.push(m); },
  });
  return { player, phases, messages, sources, speak, cancelSpeak, chunk: (...a: Parameters<typeof chunk>) => chunk(...a), end: (...a: Parameters<typeof end>) => end(...a) };
}
const pcm = () => new Uint8Array(4800);
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('lecteur', () => {
  it('ne passe que le rang de la réponse', () => {
    const { player, speak } = setup();
    player.play(3);
    expect(speak).toHaveBeenCalledWith(3);
  });

  it('morceaux joués puis fin', async () => {
    const { player, sources, chunk, end } = setup();
    player.play(0);
    expect(player.phase).toBe('loading');
    await tick();
    chunk(7, pcm(), 24000);
    expect(player.phase).toBe('playing');
    end(7, null);
    sources[0].onended!();
    expect(player.phase).toBe('idle');
  });

  it('morceaux arrivés avant la réponse : rejoués', async () => {
    let resolve: (s: SpeakStart) => void = () => {};
    const { player, chunk } = setup(new Promise<SpeakStart>((r) => { resolve = r; }));
    player.play(0);
    chunk(7, pcm(), 24000);
    expect(player.phase).toBe('loading');
    resolve({ ok: true, id: 7 });
    await vi.waitFor(() => expect(player.phase).toBe('playing'));
  });

  it('morceaux d’une autre lecture ignorés', async () => {
    const { player, chunk } = setup();
    player.play(0);
    await tick();
    chunk(3, pcm(), 24000);
    expect(player.phase).toBe('loading');
  });

  it('stop : arrête et annule la génération', async () => {
    const { player, cancelSpeak, chunk } = setup();
    player.play(0);
    await tick();
    chunk(7, pcm(), 24000);
    player.stop();
    expect(player.phase).toBe('idle');
    expect(cancelSpeak).toHaveBeenCalledWith(7);
  });

  it('stop avant la réponse : la génération annoncée ensuite est annulée', async () => {
    const { player, cancelSpeak } = setup();
    player.play(0);
    player.stop();
    await tick();
    expect(cancelSpeak).toHaveBeenCalledWith(7);
    expect(player.phase).toBe('idle');
  });

  it('jouer une autre réponse en cours de lecture : arrête la première', async () => {
    const { player, speak, cancelSpeak, chunk } = setup();
    player.play(0);
    await tick();
    chunk(7, pcm(), 24000);
    player.play(1);
    expect(cancelSpeak).toHaveBeenCalledWith(7);
    expect(speak).toHaveBeenLastCalledWith(1);
    expect(player.phase).toBe('loading');
  });

  it('erreur du principal : phase error, avec son motif', async () => {
    const { player, messages } = setup({ ok: false, error: 'Rien à lire.' });
    player.play(0);
    await vi.waitFor(() => expect(player.phase).toBe('error'));
    expect(messages.at(-1)).toBe('Rien à lire.');
  });

  it('erreur de génération en cours de route : phase error, avec son motif', async () => {
    const { player, messages, chunk, end } = setup();
    player.play(0);
    await tick();
    chunk(7, pcm(), 24000);
    end(7, 'boum');
    expect(player.phase).toBe('error');
    expect(messages.at(-1)).toBe('boum');
  });
});
