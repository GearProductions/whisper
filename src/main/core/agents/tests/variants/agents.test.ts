import { describe, expect, it, vi } from 'vitest';
import { createAgentRuntime, createSessions, parseThread, sessionDirs, splitReply, type AgentConfig } from 'core/agents';

const agent: AgentConfig = { id: 'a1', name: 'alpha', dir: '/home/u/p', mode: 'default', model: '', effort: '', sessionId: null };

describe('réponse', () => {
  it('texte sans le bloc, résumé audio', () => {
    expect(splitReply('Fait.\n```js\nx\n```\n<audio>C\'est **fait**.</audio>')).toEqual({ text: 'Fait.\n```js\nx\n```', audio: 'C\'est fait.' });
    expect(splitReply('Sans bloc, avec [un lien](https://x) et `code`.')).toEqual({ text: 'Sans bloc, avec [un lien](https://x) et `code`.', audio: 'Sans bloc, avec un lien et code.' });
    expect(splitReply('<audio>Seulement l\'audio.</audio>')).toEqual({ text: 'Seulement l\'audio.', audio: 'Seulement l\'audio.' });
  });
});

describe('transcription relue', () => {
  const t = '2026-09-30T09:30:00Z';
  const user = (content: unknown, extra = {}) => ({ type: 'user', timestamp: t, message: { content }, ...extra });
  const asst = (content: unknown[], usage?: Record<string, number>) => ({ type: 'assistant', timestamp: t, message: { content, usage } });
  it('commandes, sorties, compaction, tours regroupés, contexte', () => {
    const thread = parseThread([
      user('<command-name>/compact</command-name><command-args>court</command-args>'),
      user('<local-command-stdout>sortie</local-command-stdout>'),
      user('Résumé…', { isCompactSummary: true, isMeta: true }),
      user('consigne interne', { isMeta: true }),
      user([{ type: 'text', text: 'bonjour' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AA' } }]),
      asst([{ type: 'text', text: 'Je lis.' }, { type: 'tool_use', name: 'Read', input: { file_path: '/a' } }]),
      user([{ type: 'tool_result', content: 'x' }], { parent_tool_use_id: 'tu1' }),
      asst([{ type: 'text', text: 'Voilà <audio>Voilà.</audio>' }], { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 2 }),
    ]);
    expect(thread.map((e) => e.role + ('kind' in e ? `:${e.kind}` : ''))).toEqual(['user', 'system:output', 'system:compact', 'user', 'assistant']);
    expect(thread[0].text).toBe('/compact court');
    expect(thread[3]).toMatchObject({ text: 'bonjour', images: [{ media_type: 'image/png' }] });
    expect(thread[4]).toMatchObject({ text: 'Je lis.\n\nVoilà', audio: 'Voilà.', tools: [{ tool: 'Read', input: { file_path: '/a' } }] });
    expect(thread.contextTokens).toBe(17);
  });
});

describe('sessions d’un dossier', () => {
  it('les deux écritures du même dossier', () => {
    expect(sessionDirs('/home/u/p', () => '/var/home/u/p')).toEqual(['/home/u/p', '/var/home/u/p']);
    expect(sessionDirs('/srv/p', () => { throw new Error('disparu'); })).toEqual(['/srv/p']);
  });
  it('fusionnées, sans doublon, de la plus récente à la plus ancienne', async () => {
    const listSessions = vi.fn(async ({ dir }: { dir: string }) => (dir === '/home/u/p'
      ? [{ sessionId: 's1', summary: ' Une ', lastModified: 1 }]
      : [{ sessionId: 's1', summary: 'Une', lastModified: 1 }, { sessionId: 's2', summary: 'Deux', lastModified: 2 }]));
    const s = createSessions({ loadSdk: async () => ({ query: () => { throw new Error(); }, listSessions }) as never, realpath: (p) => p });
    expect(await s.sessions(agent)).toEqual([{ sessionId: 's2', title: 'Deux', lastModified: 2 }, { sessionId: 's1', title: 'Une', lastModified: 1 }]);
    expect(listSessions).toHaveBeenCalledWith({ dir: '/var/home/u/p', includeWorktrees: false, limit: 200 });
  });
});

describe('tours', () => {
  function runtime(script: (o: Record<string, never>) => AsyncGenerator<Record<string, unknown>>) {
    const q = { setPermissionMode: vi.fn(async () => {}), setModel: vi.fn(async () => {}), interrupt: vi.fn(async () => {}) };
    const sdk = { query: ({ options }: { options: Record<string, never> }) => Object.assign(script(options), q) };
    const rt = createAgentRuntime({ loadSdk: async () => sdk as never, launcher: (c) => (c === 'absent' ? null : { executable: 'claude' }), journal: () => {} });
    const hooks = { onChange: vi.fn(), onSession: vi.fn(), onPermission: vi.fn() };
    return { rt, hooks, q };
  }

  it('session retenue, réponse lue, non lue jusqu’à markRead', async () => {
    const { rt, hooks } = runtime(async function* t() {
      yield { type: 'system', subtype: 'init', session_id: 's9' };
      yield { type: 'result', subtype: 'success', is_error: false, result: 'Ok <audio>Ok.</audio>', modelUsage: { m: { contextWindow: 200000 } } };
    });
    await rt.send(agent, { text: 'salut' }, hooks);
    expect(hooks.onSession).toHaveBeenCalledWith('s9');
    expect(rt.lastReply('a1')).toEqual({ text: 'Ok', audio: 'Ok.', asked: 'salut' });
    expect(rt.state('a1')).toMatchObject({ status: 'idle', unread: true, contextWindow: 200000 });
    rt.markRead('a1');
    expect(rt.state('a1').unread).toBe(false);
  });

  it('le message du tour en cours est retenu, jusqu’à la fin du tour', async () => {
    const seen: unknown[] = [];
    let { rt, hooks } = runtime(async function* t() {
      seen.push(rt.sent('a1'));
      yield { type: 'result', subtype: 'success', is_error: false, result: 'Ok' };
    });
    expect(rt.sent('a1')).toBeNull();
    await rt.send(agent, { text: 'salut' }, hooks);
    expect(seen).toEqual([{ text: 'salut' }]);
    expect(rt.sent('a1')).toBeNull();
    ({ rt, hooks } = runtime(async function* t() { yield { type: 'result', subtype: 'error_during_execution' }; }));
    await rt.send(agent, { text: 'x' }, hooks);
    expect(rt.sent('a1')).toBeNull();
  });

  it('commande sans réponse écrite : « fait » ; échecs traduits', async () => {
    let { rt, hooks } = runtime(async function* t() { yield { type: 'result', subtype: 'success', is_error: false, result: '' }; });
    await rt.send(agent, { text: '/compact garder les tests' }, hooks);
    expect(rt.lastReply('a1')!.text).toBe('/compact : fait.');
    ({ rt, hooks } = runtime(async function* t() { yield { type: 'result', subtype: 'error_max_turns' }; }));
    await rt.send(agent, { text: 'x' }, hooks);
    expect(rt.lastReply('a1')).toMatchObject({ text: 'L\'agent s\'est arrêté : trop d\'étapes.', error: true });
    expect(rt.state('a1').status).toBe('error');
  });

  it('occupé ou Claude introuvable : refusé', async () => {
    const { rt, hooks } = runtime(async function* t() { await new Promise(() => {}); yield {}; });
    void rt.send(agent, { text: 'x' }, hooks);
    await vi.waitFor(() => expect(rt.state('a1').status).toBe('working'));
    await expect(rt.send(agent, { text: 'y' }, hooks)).rejects.toThrow('busy');
    await expect(rt.send({ ...agent, id: 'a2' }, { text: 'y' }, { ...hooks, command: 'absent' })).rejects.toThrow('notInstalled');
  });

  it('passer en « Accepter les modifications » accorde les modifications en attente, pas le reste', async () => {
    const answers: Record<string, unknown>[] = [];
    const { rt, hooks, q } = runtime(async function* t(o: Record<string, never>) {
      const can = o.canUseTool as unknown as (t: string, i: unknown) => Promise<Record<string, unknown>>;
      answers.push(...await Promise.all([can('Edit', { file_path: '/a' }), can('Bash', { command: 'ls' })]));
      yield { type: 'result', subtype: 'success', is_error: false, result: 'ok' };
    });
    const turn = rt.send(agent, { text: 'x' }, hooks);
    await vi.waitFor(() => expect(rt.pendingPermission('a1')).toMatchObject({ waiting: 1 }));
    rt.setMode('a1', 'acceptEdits');
    expect(q.setPermissionMode).toHaveBeenCalledWith('acceptEdits');
    expect(rt.pendingPermission('a1')).toMatchObject({ tool: 'Bash', waiting: 0 });
    rt.answer('a1', 'deny');
    await turn;
    expect(answers.map((a) => a.behavior)).toEqual(['allow', 'deny']);
  });
});
