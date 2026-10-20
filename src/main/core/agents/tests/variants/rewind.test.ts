import { describe, expect, it, vi } from 'vitest';
import { createAgentRuntime, queryOptions, type AgentConfig } from 'core/agents';

const entry: AgentConfig = { id: 'a1~forme', name: 'a1', dir: '/tmp/a1', mode: 'default', model: '', effort: '', sessionId: null };
const done = { type: 'result', subtype: 'success', result: 'fini', is_error: false };

// Un SDK factice : `rewound` répond aux rewindFiles ; `queries` les options de
// chaque processus, `received` les messages reçus par chacun.
function setup(rewound: unknown = { canRewind: true, filesChanged: ['a.ts', 'b.ts'] }) {
  const queries: Record<string, unknown>[] = [];
  const received: Record<string, unknown>[][] = [];
  const sdk = {
    query: ({ prompt, options }: { prompt: AsyncIterable<Record<string, unknown>>; options: Record<string, unknown> }) => {
      const mine: Record<string, unknown>[] = [];
      queries.push(options);
      received.push(mine);
      return Object.assign((async function* proc() { for await (const m of prompt) { mine.push(m); yield done; } }()), {
        interrupt: vi.fn(async () => {}), setPermissionMode: vi.fn(async () => {}), setModel: vi.fn(async () => {}),
        rewindFiles: vi.fn(async () => rewound),
      });
    },
  };
  const rt = createAgentRuntime({ loadSdk: async () => sdk as never, launcher: () => ({ executable: 'claude' }), journal: () => {} });
  const hooks = { checkpoint: true, onChange: () => {}, onSession: () => {}, onPermission: () => {} };
  return { rt, hooks, queries, received };
}

describe('rewind', () => {
  it('checkpoint : suivi des fichiers demandé au SDK, sinon rien', () => {
    expect(queryOptions(entry, { executable: 'claude' }, '', { checkpoint: true })).toMatchObject({ enableFileCheckpointing: true });
    expect(queryOptions(entry, { executable: 'claude' }, '')).not.toHaveProperty('enableFileCheckpointing');
  });

  it('checkpoint changé entre deux tours : nouveau processus', async () => {
    const { rt, hooks, queries } = setup();
    await rt.send(entry, { text: 'un' }, { ...hooks, checkpoint: false });
    await rt.send(entry, { text: 'deux' }, hooks);
    expect(queries).toHaveLength(2);
  });

  it('chaque message a son uuid ; ramené : le nombre de fichiers', async () => {
    const { rt, hooks, received } = setup();
    await rt.send(entry, { text: 'un' }, hooks);
    await rt.send(entry, { text: 'deux' }, hooks);
    const [a, b] = received[0].map((m) => m.uuid);
    expect(a).toEqual(expect.any(String));
    expect(b).not.toBe(a);
    expect(await rt.rewind(entry.id)).toEqual({ ok: true, files: 2 });
  });

  it('sans processus, ou refusé par Claude Code : ok false avec la raison', async () => {
    expect(await setup().rt.rewind('inconnu')).toMatchObject({ ok: false, files: 0, error: expect.any(String) });
    const { rt, hooks } = setup({ canRewind: false, error: 'pas de point de reprise' });
    await rt.send(entry, { text: 'un' }, hooks);
    expect(await rt.rewind(entry.id)).toEqual({ ok: false, files: 0, error: 'pas de point de reprise' });
  });

  it('processus fermé : plus rien à ramener', async () => {
    const { rt, hooks } = setup();
    await rt.send(entry, { text: 'un' }, hooks);
    await rt.close(entry.id);
    expect(await rt.rewind(entry.id)).toMatchObject({ ok: false, files: 0 });
  });
});
