import { describe, expect, it } from 'vitest';
import { createMuter, createStreamMuter, isWanted, type StreamTools } from 'core/sound';

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

describe('coupures qui échouent ou ne sont pas prises en charge', () => {
  it('outil en échec : la dictée continue (I-29)', async () => {
    const { tools } = streams({ a: false }, { failSet: true });
    const failing: StreamTools = { ...tools, list: () => Promise.reject(new Error('wpctl absent')) };
    const m = createMuter(createStreamMuter(failing));
    await expect(m.mute('others', [])).resolves.toBe(0);
    await expect(m.restore('others')).resolves.toBeUndefined();
  });

  it('plateforme non prise en charge : rien', async () => {
    const m = createMuter(null);
    await expect(m.mute('discord', [])).resolves.toBe(0);
    await expect(m.restore('discord')).resolves.toBeUndefined();
  });
});

describe('ce qu’on coupe (I-12)', () => {
  const app = { 'media.class': 'Stream/Output/Audio', 'application.process.id': '42' };
  it('jamais les flux de l’appli', () => {
    expect(isWanted('others', app, new Set([42]))).toBe(false);
    expect(isWanted('others', { ...app, 'application.process.id': '7' }, new Set([42]))).toBe(true);
  });
  it('de Discord, seulement sa capture audio', () => {
    const discord = { 'application.process.binary': 'Discord' };
    expect(isWanted('discord', { ...discord, 'media.class': 'Stream/Input/Audio' }, new Set())).toBe(true);
    expect(isWanted('discord', { 'pipewire.access.portal.app_id': 'com.discordapp.Discord', 'media.class': 'Stream/Input/Audio' }, new Set())).toBe(true);
    expect(isWanted('discord', { ...discord, 'media.class': 'Stream/Output/Audio' }, new Set())).toBe(false);
    expect(isWanted('discord', { ...discord, 'media.class': 'Stream/Input/Video' }, new Set())).toBe(false);
    expect(isWanted('discord', { 'application.process.binary': 'firefox', 'media.class': 'Stream/Input/Audio' }, new Set())).toBe(false);
  });
});
