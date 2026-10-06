// Invariant (SPEC I-11) : rien de ce que l'appli a coupé ne reste coupé, même
// un flux disparu pendant la dictée. WirePlumber retient la coupure d'une
// application (sa « mémoire » des flux) : un flux coupé qui disparaît avant
// d'être rétabli laisse l'application muette pour ses flux suivants. Bug vu
// en 0.5.0-rc.2 (Brave et Chromium muets après une dictée). Protégé : si ce
// test échoue, corriger le code.
import { describe, expect, it } from 'vitest';
import { createMuter, createStreamMuter, type PendingStore, type StreamTools } from 'core/sound';

// PipeWire et la mémoire de WirePlumber, en mémoire : un flux a une identité
// (`key`) ; un nouveau flux prend la coupure retenue pour son identité.
function pipewire() {
  const streams = new Map<string, { key: string; muted: boolean }>();
  const remembered = new Map<string, boolean>();
  let next = 100;
  const tools: StreamTools = {
    list: async () => [...streams.keys()],
    isMuted: async (id) => (streams.has(id) ? streams.get(id)!.muted : null),
    setMute: async (id, on) => {
      const s = streams.get(id);
      if (!s) return false;
      s.muted = on;
      remembered.set(s.key, on);
      return true;
    },
    keyOf: async (id) => streams.get(id)?.key ?? null,
    findByKey: async (key) => [...streams].filter(([, s]) => s.key === key).map(([id]) => id),
  };
  return {
    tools,
    open: (key: string) => { const id = String(next++); streams.set(id, { key, muted: remembered.get(key) ?? false }); return id; },
    close: (id: string) => { streams.delete(id); },
    muted: (id: string) => streams.get(id)!.muted,
  };
}
const memory = (): PendingStore & { keys: string[] } => {
  const m = { keys: [] as string[], load: () => m.keys, save: (k: string[]) => { m.keys = [...k]; } };
  return m;
};

describe('un flux disparu pendant la dictée', () => {
  it('l’application rouvre un flux avant la fin : il est rétabli', async () => {
    const pw = pipewire();
    const video = pw.open('Output/Audio:application.name:Brave');
    const m = createMuter(createStreamMuter(pw.tools, memory()));
    await m.mute('others', []);
    pw.close(video);
    const next = pw.open('Output/Audio:application.name:Brave'); // muet : retenu par WirePlumber
    expect(pw.muted(next)).toBe(true);
    await m.restore('others');
    expect(pw.muted(next)).toBe(false);
  });

  it('l’application rouvre un flux plus tard, même après un redémarrage de l’appli : il est rétabli', async () => {
    const pw = pipewire();
    const store = memory();
    const video = pw.open('Output/Audio:application.name:Brave');
    const first = createMuter(createStreamMuter(pw.tools, store));
    await first.mute('others', []);
    pw.close(video);
    await first.restore('others');
    const later = pw.open('Output/Audio:application.name:Brave');
    const restarted = createMuter(createStreamMuter(pw.tools, store));
    await restarted.heal();
    expect(pw.muted(later)).toBe(false);
    expect(restarted.pending()).toBe(0);
  });

  it('jamais pendant une dictée : ce qu’elle vient de couper le reste', async () => {
    const pw = pipewire();
    const store = memory();
    store.keys = ['Output/Audio:application.name:Brave'];
    const video = pw.open('Output/Audio:application.name:Brave');
    const m = createMuter(createStreamMuter(pw.tools, store));
    await m.mute('others', []);
    await m.heal();
    expect(pw.muted(video)).toBe(true);
    await m.restore('others');
    expect(pw.muted(video)).toBe(false);
  });
});

describe('dépannage : tout rétablir', () => {
  it('rétablit les flux de la cible, coupés par l’appli ou restés coupés', async () => {
    const pw = pipewire();
    const a = pw.open('Output/Audio:application.name:Brave');
    const b = pw.open('Output/Audio:application.name:Firefox');
    await pw.tools.setMute(a, true);
    const m = createMuter(createStreamMuter(pw.tools, memory()));
    await m.mute('others', []);
    expect(await m.force('others', [])).toBe(2);
    expect([pw.muted(a), pw.muted(b)]).toEqual([false, false]);
  });
});
