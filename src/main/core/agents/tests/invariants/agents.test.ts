// Invariants des agents Claude Code. Protégés : si un test échoue, corriger le
// code.
//   I-14 : « Toujours autoriser » n'accorde que des règles, pour la session.
//   I-15 : une réponse ne vaut que pour la demande en tête de file (`key`).
//   I-17 : aucune demande ne se perd (une demande sans réponse bloque Claude
//          Code indéfiniment) : en file, annulées proprement, refusées en fin
//          de tour.
//   I-19 : interrompre = demander à Claude Code d'arrêter ; tuer seulement
//          après le délai de grâce.
//   I-24 : la consigne <audio> ne va que dans le prompt système de NOS sessions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgentRuntime, queryOptions, sessionRules, type AgentConfig } from 'core/agents';

type Options = Record<string, unknown> & {
  canUseTool: (tool: string, input: unknown, o: { suggestions?: unknown[]; signal?: AbortSignal }) => Promise<Record<string, unknown>>;
  abortController: AbortController;
};

// Un SDK factice : chaque tour joue `script`, avec les options reçues.
function setup(script: (o: Options) => AsyncGenerator<Record<string, unknown>>) {
  const queries: { options: Options; interrupt: ReturnType<typeof vi.fn> }[] = [];
  const sdk = {
    query: ({ options }: { options: Options }) => {
      const gen = script(options);
      const q = Object.assign(gen, {
        interrupt: vi.fn(async () => {}),
        setPermissionMode: vi.fn(async () => {}),
        setModel: vi.fn(async () => {}),
      });
      queries.push({ options, interrupt: q.interrupt });
      return q;
    },
  };
  const runtime = createAgentRuntime({ loadSdk: async () => sdk as never, launcher: () => ({ executable: '/bin/claude' }), journal: () => {} });
  const agent: AgentConfig = { id: 'a1', name: 'alpha', dir: '/tmp/projet', mode: 'default', model: '', effort: '', sessionId: null };
  const hooks = { command: '', instructions: 'CONSIGNE-AUDIO', onChange: () => {}, onSession: () => {}, onPermission: vi.fn() };
  return { runtime, agent, hooks, queries };
}
const done = { type: 'result', subtype: 'success', result: 'fini <audio>Fini.</audio>', is_error: false };

afterEach(() => { vi.useRealTimers(); });

describe('file des demandes d’autorisation (I-15, I-17)', () => {
  it('deux demandes parallèles : l’une après l’autre, aucune perdue', async () => {
    let answers: Record<string, unknown>[] = [];
    const { runtime, agent, hooks } = setup(async function* turn(o) {
      answers = await Promise.all([o.canUseTool('Read', { file_path: '/a' }, {}), o.canUseTool('Read', { file_path: '/b' }, {})]);
      yield done;
    });
    const turn = runtime.send(agent, { text: 'lis' }, hooks);
    await vi.waitFor(() => expect(runtime.pendingPermission('a1')).toMatchObject({ waiting: 1 }));
    const first = runtime.pendingPermission('a1')!;
    expect(first.input).toEqual({ file_path: '/a' });
    expect(runtime.answer('a1', 'allow', first.key)).toBe(true);
    const second = runtime.pendingPermission('a1')!;
    expect(second.input).toEqual({ file_path: '/b' });
    expect(runtime.answer('a1', 'deny', second.key)).toBe(true);
    await turn;
    expect(answers.map((a) => a.behavior)).toEqual(['allow', 'deny']);
    expect(runtime.pendingPermission('a1')).toBeNull();
  });

  it('réponse pour une demande qui n’est plus en tête : rien n’est répondu', async () => {
    let settled = 0;
    const { runtime, agent, hooks } = setup(async function* turn(o) {
      await Promise.all([o.canUseTool('Bash', { command: 'a' }, {}), o.canUseTool('Bash', { command: 'b' }, {})].map((p) => p.then(() => { settled++; })));
      yield done;
    });
    const turn = runtime.send(agent, { text: 'x' }, hooks);
    await vi.waitFor(() => expect(runtime.pendingPermission('a1')).not.toBeNull());
    const first = runtime.pendingPermission('a1')!;
    runtime.answer('a1', 'allow', first.key);
    expect(runtime.answer('a1', 'allow', first.key)).toBe(false); // déjà répondue : la suivante n'est pas touchée
    await Promise.resolve();
    expect(settled).toBe(1);
    runtime.answer('a1', 'deny', runtime.pendingPermission('a1')!.key);
    await turn;
  });

  it('demande annulée par Claude Code : elle quitte la file, la suivante s’affiche', async () => {
    const cancel = new AbortController();
    const { runtime, agent, hooks } = setup(async function* turn(o) {
      const a = o.canUseTool('Edit', { file_path: '/a' }, { signal: cancel.signal });
      const b = o.canUseTool('Edit', { file_path: '/b' }, {});
      await a; await b;
      yield done;
    });
    const turn = runtime.send(agent, { text: 'x' }, hooks);
    await vi.waitFor(() => expect(runtime.pendingPermission('a1')).toMatchObject({ waiting: 1 }));
    cancel.abort();
    expect(runtime.pendingPermission('a1')).toMatchObject({ input: { file_path: '/b' }, waiting: 0 });
    expect(hooks.onPermission).toHaveBeenLastCalledWith(expect.objectContaining({ input: { file_path: '/b' } }));
    runtime.answer('a1', 'allow', runtime.pendingPermission('a1')!.key);
    await turn;
  });

  it('fin de tour : les demandes restées en attente sont refusées', async () => {
    let late: Promise<Record<string, unknown>> | null = null;
    const { runtime, agent, hooks } = setup(async function* turn(o) {
      late = o.canUseTool('Bash', { command: 'ls' }, {});
      yield done;
    });
    await runtime.send(agent, { text: 'x' }, hooks);
    await expect(late!).resolves.toMatchObject({ behavior: 'deny' });
    expect(runtime.pendingPermission('a1')).toBeNull();
  });
});

describe('« Toujours autoriser » (I-14)', () => {
  const suggestions = [
    { type: 'addRules', behavior: 'allow', destination: 'projectSettings', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }] },
    { type: 'addRules', behavior: 'allow', destination: 'userSettings', rules: [{ toolName: 'Read' }] },
    { type: 'addRules', behavior: 'deny', destination: 'session', rules: [{ toolName: 'Bash' }] },
    { type: 'setMode', mode: 'bypassPermissions', destination: 'session' },
    { type: 'addDirectories', directories: ['/'], destination: 'session' },
    { type: 'addRules', behavior: 'allow', destination: 'session', rules: [] },
  ];

  it('seulement des règles d’autorisation, et pour la session', () => {
    const rules = sessionRules(suggestions);
    expect(rules).toHaveLength(2);
    for (const r of rules) expect(r).toEqual({ type: 'addRules', behavior: 'allow', rules: expect.any(Array), destination: 'session' });
  });

  it('la réponse transmise ne contient que ces règles', async () => {
    let reply: Record<string, unknown> = {};
    const { runtime, agent, hooks } = setup(async function* turn(o) {
      reply = await o.canUseTool('Bash', { command: 'npm test' }, { suggestions });
      yield done;
    });
    const turn = runtime.send(agent, { text: 'x' }, hooks);
    await vi.waitFor(() => expect(runtime.pendingPermission('a1')).not.toBeNull());
    runtime.answer('a1', 'always', runtime.pendingPermission('a1')!.key);
    await turn;
    expect(reply.behavior).toBe('allow');
    const updates = reply.updatedPermissions as Record<string, unknown>[];
    expect(updates.every((u) => u.type === 'addRules' && u.behavior === 'allow' && u.destination === 'session')).toBe(true);
    expect(JSON.stringify(reply)).not.toMatch(/setMode|addDirectories|projectSettings|userSettings|localSettings/);
  });
});

describe('interrompre (I-19)', () => {
  it('on demande d’abord à Claude Code d’arrêter ; tué seulement après le délai', async () => {
    vi.useFakeTimers();
    const { runtime, agent, hooks, queries } = setup(async function* turn(o) {
      yield { type: 'system', subtype: 'init', session_id: 's1' };
      await new Promise((_ok, ko) => o.abortController.signal.addEventListener('abort', () => ko(new Error('aborted'))));
    });
    const turn = runtime.send(agent, { text: 'x' }, hooks);
    await vi.waitFor(() => expect(queries).toHaveLength(1));
    runtime.interrupt('a1');
    expect(queries[0].interrupt).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4900);
    expect(queries[0].options.abortController.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(queries[0].options.abortController.signal.aborted).toBe(true);
    await turn;
    expect(runtime.state('a1').status).toBe('idle');
  });
});

describe('la consigne <audio> (I-24)', () => {
  const agent: AgentConfig = { id: 'a1', name: 'alpha', dir: '/tmp/p', mode: 'default', model: '', effort: '', sessionId: null };
  it('dans le prompt système de la session, et nulle part ailleurs', () => {
    const o = queryOptions(agent, { executable: '/bin/claude' }, 'CONSIGNE-AUDIO');
    expect(o.systemPrompt).toEqual({ type: 'preset', preset: 'claude_code', append: 'CONSIGNE-AUDIO' });
    expect(JSON.stringify(o).split('CONSIGNE-AUDIO')).toHaveLength(2);
    expect(o.settingSources).toEqual(['user', 'project', 'local']);
  });
  it('vide : aucune consigne', () => {
    expect(queryOptions(agent, { executable: '/bin/claude' }, '').systemPrompt).toEqual({ type: 'preset', preset: 'claude_code' });
  });
  it('un tour la passe telle quelle au SDK', async () => {
    const { runtime, agent: a, hooks, queries } = setup(async function* turn() { yield done; });
    await runtime.send(a, { text: 'x' }, hooks);
    expect(queries[0].options.systemPrompt).toEqual({ type: 'preset', preset: 'claude_code', append: 'CONSIGNE-AUDIO' });
  });
});
