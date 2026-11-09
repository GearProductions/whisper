import { describe, expect, it, vi } from 'vitest';
import { createAgentRuntime, type AgentConfig } from 'core/agents';

type Msg = Record<string, unknown>;
type Proc = {
  options: Record<string, unknown> & { abortController: AbortController; resume?: string };
  received: unknown[];
  ended: boolean;
  interrupted: (() => void) | null;
};
const done = { type: 'result', subtype: 'success', result: 'fini <audio>Fini.</audio>', is_error: false };

// Un SDK factice dont chaque query() joue un processus : `init`, puis un tour
// (assistant + result) par message lu dans son entrée ; il se termine quand
// l'entrée se ferme. `oneShot` : meurt après son premier tour. `slow` : un tour
// qui dure jusqu'à interrupt().
function setup(kind: 'normal' | 'oneShot' | 'slow' = 'normal') {
  const procs: Proc[] = [];
  const sdk = {
    query: ({ prompt, options }: { prompt: AsyncIterable<Msg>; options: Proc['options'] }) => {
      const p: Proc = { options, received: [], ended: false, interrupted: null };
      procs.push(p);
      async function* proc() {
        try {
          yield { type: 'system', subtype: 'init', session_id: `s-${procs.length}` };
          for await (const m of prompt) {
            p.received.push((m as { message: { content: unknown } }).message.content);
            yield { type: 'assistant', message: { content: [] } };
            if (kind === 'slow') {
              await new Promise<void>((ok) => { p.interrupted = ok; });
              yield { type: 'result', subtype: 'error_during_execution', is_error: true };
            } else yield done;
            if (kind === 'oneShot') return;
          }
        } finally { p.ended = true; }
      }
      return Object.assign(proc(), {
        interrupt: vi.fn(async () => { if (p.interrupted) p.interrupted(); }),
        setPermissionMode: vi.fn(async () => {}),
        setModel: vi.fn(async () => {}),
      });
    },
  };
  const runtime = createAgentRuntime({ loadSdk: async () => sdk as never, launcher: () => ({ executable: '/bin/claude' }), journal: () => {} });
  const agent = (id: string): AgentConfig => ({ id, name: id, dir: `/tmp/${id}`, mode: 'default', model: '', effort: '', sessionId: null });
  // Comme le contrôleur : la session créée est retenue sur l'agent.
  const hooksFor = (a: AgentConfig) => ({ command: '', instructions: '', onChange: () => {}, onSession: vi.fn((s: string) => { a.sessionId = s; }), onPermission: () => {} });
  return { runtime, procs, agent, hooksFor };
}

describe('un processus par agent, qui vit entre les tours (I-33)', () => {
  it('deux tours : un seul processus, la session créée une fois, chaque message transmis', async () => {
    const { runtime, procs, agent, hooksFor } = setup();
    const a = agent('a1');
    const hooks = hooksFor(a);
    await runtime.send(a, { text: 'un' }, hooks);
    expect(runtime.state('a1').status).toBe('idle');
    expect(procs[0].ended).toBe(false); // le tour est fini, pas le processus
    await runtime.send(a, { text: 'deux' }, hooks);
    expect(procs).toHaveLength(1);
    expect(procs[0].received).toEqual(['un', 'deux']);
    expect(hooks.onSession).toHaveBeenCalledTimes(1);
    expect(runtime.lastReply('a1')).toMatchObject({ text: 'fini', asked: 'deux' });
  });

  it('interrompre n’arrête que le tour : le processus reste', async () => {
    const { runtime, procs, agent, hooksFor } = setup('slow');
    const a = agent('a1');
    const turn = runtime.send(a, { text: 'long' }, hooksFor(a));
    await vi.waitFor(() => expect(procs[0].received).toHaveLength(1));
    runtime.interrupt('a1');
    await turn;
    expect(runtime.state('a1').status).toBe('idle');
    expect(procs[0].ended).toBe(false);
    expect(procs[0].options.abortController.signal.aborted).toBe(false);
  });

  it('« Nouvelle session » / « Retirer » : fermé par la fin de son entrée, pas tué', async () => {
    const { runtime, procs, agent, hooksFor } = setup();
    const a = agent('a1');
    await runtime.send(a, { text: 'x' }, hooksFor(a));
    runtime.forget('a1');
    await vi.waitFor(() => expect(procs[0].ended).toBe(true));
    expect(procs[0].options.abortController.signal.aborted).toBe(false);
    expect(runtime.active()).toBe(0);
  });

  it('mort entre deux tours : le suivant en relance un, qui reprend la session', async () => {
    const { runtime, procs, agent, hooksFor } = setup('oneShot');
    const a = agent('a1');
    const hooks = hooksFor(a);
    await runtime.send(a, { text: 'un' }, hooks);
    await vi.waitFor(() => expect(procs[0].ended).toBe(true));
    await runtime.send(a, { text: 'deux' }, hooks);
    expect(procs).toHaveLength(2);
    expect(procs[1].options.resume).toBe('s-1');
    expect(procs[1].received).toEqual(['deux']);
  });
});
