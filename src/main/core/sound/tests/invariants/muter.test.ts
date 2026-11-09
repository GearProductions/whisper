// Invariants des coupures de son pendant la dictée. Protégés : si un test
// échoue, corriger le code.
//   I-11 : ce que l'appli coupe est toujours rétabli.
//   I-12 : on ne rétablit que ce que NOUS avons coupé (un flux déjà muet le
//          reste).
import { describe, expect, it } from 'vitest';
import { createMuter, createStreamMuter, type StreamTools } from 'core/sound';

// Des flux PipeWire en mémoire.
function streams(initial: Record<string, boolean>, opts: { failSet?: boolean } = {}) {
  const muted = { ...initial };
  const tools: StreamTools = {
    list: async () => Object.keys(muted),
    isMuted: async (id) => (id in muted ? muted[id] : null),
    setMute: async (id, on) => { if (opts.failSet) return false; muted[id] = on; return true; },
  };
  return { muted, tools };
}

describe('rétablir ce qu’on a coupé, et seulement cela', () => {
  it('flux déjà muet : laissé muet ; les autres rétablis (I-11, I-12)', async () => {
    const { muted, tools } = streams({ a: false, b: true, c: false });
    const m = createMuter(createStreamMuter(tools));
    expect(await m.mute('others', [])).toBe(2);
    expect(muted).toEqual({ a: true, b: true, c: true });
    await m.restore('others');
    expect(muted).toEqual({ a: false, b: true, c: false });
  });

  it('rétablir deux fois ne touche à rien de plus', async () => {
    const { muted, tools } = streams({ a: false });
    const m = createMuter(createStreamMuter(tools));
    await m.mute('discord', []);
    await m.restore('discord');
    muted.a = true; // l'utilisateur coupe lui-même ensuite
    await m.restore('discord');
    expect(muted.a).toBe(true);
  });

  it('un relâché rapide attend la coupure : rien ne reste coupé', async () => {
    const { muted, tools } = streams({ a: false, b: false });
    const m = createMuter(createStreamMuter(tools));
    const cut = m.mute('others', []);
    const back = m.restore('others');
    await Promise.all([cut, back]);
    expect(muted).toEqual({ a: false, b: false });
  });
});
