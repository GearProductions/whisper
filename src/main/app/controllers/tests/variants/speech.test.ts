// speakReply : le résumé retenu du rang demandé, lu, son audio envoyé au panneau.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  cfg: {} as Record<string, unknown>,
  spoken: [] as string[],
  sent: [] as unknown[][],
  onChunk: null as null | ((pcm: unknown, rate: number) => void),
  onEnd: null as null | ((code?: string) => void),
}));

vi.mock('technicals/pocket-tts', () => ({
  isInstalled: () => true, canInstall: () => false, cancel: () => {}, warmUp: () => {},
  speak: (text: string, _o: unknown, onChunk: typeof fake.onChunk, onEnd: typeof fake.onEnd) => {
    fake.spoken.push(text); fake.onChunk = onChunk; fake.onEnd = onEnd; return 7;
  },
}));
vi.mock('technicals/selection', () => ({ hasText: async () => true, peekText: async () => '', readText: async () => '' }));
vi.mock('app/settings', () => ({ loadConfig: () => fake.cfg, saveConfig: () => {} }));
vi.mock('app/windows', () => ({ applySize: () => {}, canReadSelection: false, sendToIcon: () => {}, showBubble: () => {} }));

const thread = (...audio: (string | undefined)[]) => audio.map((a) => ({ role: 'assistant', text: 'x', ...(a ? { audio: a } : {}) }));

beforeEach(() => { fake.spoken = []; fake.sent = []; fake.cfg = {}; });

async function setup(entries: unknown[], withPanel = true) {
  vi.resetModules();
  const { state } = await import('app/state');
  state.convThread = entries as never;
  state.panel = withPanel ? ({ webContents: { send: (...a: unknown[]) => { fake.sent.push(a); } } } as never) : null;
  return import('app/controllers/speech');
}

describe('speakReply', () => {
  it('lit le résumé du rang demandé et envoie l’audio au panneau', async () => {
    const { speakReply } = await setup(thread(undefined, 'le résumé'));

    expect(await speakReply(1)).toEqual({ ok: true, id: 7 });
    fake.onChunk!('pcm', 24000);
    fake.onEnd!();

    expect(fake.spoken).toEqual(['le résumé']);
    expect(fake.sent).toEqual([['tts:chunk', 7, 'pcm', 24000], ['tts:end', 7, null]]);
  });

  it('applique le volume réglé aux échantillons 16 bits de chaque morceau', async () => {
    fake.cfg = { speakVolume: 0.5 };
    const { speakReply } = await setup(thread('le résumé'));
    const pcm = Buffer.from(Int16Array.of(1000, -2000, 32767).buffer);

    await speakReply(0);
    fake.onChunk!(pcm, 24000);

    const sent = fake.sent[0][2] as Buffer;
    expect([...new Int16Array(sent.buffer, sent.byteOffset, 3)]).toEqual([500, -1000, 16384]);
    expect([...new Int16Array(pcm.buffer, pcm.byteOffset, 3)]).toEqual([1000, -2000, 32767]); // l'original est intact
  });

  it.each([[0], [5], [-1], [1.5], ['1'], [{ text: 'autre' }], [undefined]])('refuse le rang %j : rien n’est lu', async (index) => {
    const { speakReply } = await setup(thread(undefined, 'le résumé'));

    expect(await speakReply(index)).toMatchObject({ ok: false });
    expect(fake.spoken).toEqual([]);
  });

  it('ne lit rien sans panneau', async () => {
    const { speakReply } = await setup(thread('le résumé'), false);

    expect(await speakReply(0)).toMatchObject({ ok: false });
    expect(fake.spoken).toEqual([]);
  });
});
