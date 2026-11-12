// Variantes de l'exécuteur (execute), sur la vraie table livrée (resources/vibecoder/commands.json) : la commande
// inconnue, la porte, la conversion des arguments, le relevé absent, les lectures (schéma, jamais l'id du robot), les
// écritures vers les opérations injectées (chacune relève ses appels), les refus traduits, une opération qui lève, les
// codes et textes des erreurs, les codes de la table livrée (et le texte de bad-token, celui du protocole).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VibeAction, VibeRun, VibeView } from 'shared/bridge';
import { ERROR_CODES, execute, parseCommands, schemaError, type CommandContext, type CommandOps, type CommandRequest, type CommandResponse, type OpOutcome } from 'core/commands';
import { parseActions } from 'core/vibecoder';
import { BAD_TOKEN } from 'technicals/socket';

const RES = path.resolve(__dirname, '../../../../../../resources/vibecoder');
const table = parseCommands(fs.readFileSync(path.join(RES, 'commands.json'), 'utf8'));
const defs = parseActions(JSON.parse(fs.readFileSync(path.join(RES, 'actions.fr.json'), 'utf8')));

const act = (id: string, over: Partial<VibeAction> = {}): VibeAction => ({
  id, step: 'modules', label: id, hint: '', who: 'agent', models: [], model: null, kind: 'send', needs: 'none', usesText: false,
  primary: false, disabled: null, hidden: false, ...over,
});
const run = (id: string, state: VibeRun['state'], since: number): VibeRun => ({
  id, label: id, who: 'sonnet', state, since, end: null, reply: '', permission: null,
});
const view: VibeView = {
  agentId: 'robot-42', time: 0, lang: 'fr', flow: 'create', vibe: true, agent: { model: 'opus', effort: 'high', mode: 'default' },
  repo: { branch: 'feat/x', base: 'master', changed: 3 }, error: null,
  steps: [{ id: 'modules', status: 'current', facts: '' }],
  note: { id: 'n', path: 'docs/tickets/feat/x.md', text: '', before: null, filled: true, mustNot: [], mark: null, formeMark: null },
  questions: [], modules: [], invariants: [], variants: [], commits: [], outputs: {}, checklist: [],
  actions: [
    act('module'), act('modules'), act('pr', { hidden: true }), act('commit', { disabled: 'Une action est en cours' }),
    act('vibe', { step: null }), act('guide', { step: null }), act('pull', { step: null }), act('load-pr', { step: null }), act('comment', { step: null }),
    act('case-ko', { step: null }), act('add-artifact', { step: null }), act('push', { step: null, hidden: true }),
  ],
  skills: [], pr: null, prs: null, draft: [],
  processes: [{ name: 'dev', run: 'npm start', status: 'running', since: 1000, exit: null, log: 'ready\n' }],
  runs: [run('modules', 'running', 3000)],
};
const ctx: CommandContext = { view, defs };

// Des opérations qui relèvent chaque appel ; `outcome` : ce que rendent start et direct.
function ops(outcome: OpOutcome = { ok: true }, over: Partial<CommandOps> = {}) {
  const calls: unknown[][] = [];
  const o: CommandOps = {
    start: (...a) => { calls.push(['start', ...a]); return outcome; },
    direct: (...a) => { calls.push(['direct', ...a]); return outcome; },
    run: async (...a) => { calls.push(['run', ...a]); return true; },
    proc: async (...a) => { calls.push(['proc', ...a]); return true; },
    artifact: async (...a) => { calls.push(['artifact', ...a]); return { name: 'a.md', kind: 'markdown', text: 'x', truncated: false }; },
    draft: (...a) => { calls.push(['draft', ...a]); return outcome; },
    wait: async (...a) => { calls.push(['wait', ...a]); return { action: 'modules', state: 'done', reply: 'fini' }; },
    ...over,
  };
  return { calls, ops: o };
}
const go = (req: Partial<CommandRequest> & { command: string }, o = ops(), c = ctx) =>
  execute(table, { door: 'screen', ...req }, c, o.ops);
const code = (r: CommandResponse) => (r.ok ? null : r.error.code);
const details = (r: CommandResponse) => (r.ok ? null : r.error.details);

describe('execute : la commande et la porte', () => {
  it('unknown-command : une commande hors table, rien d\'appelé', async () => {
    const o = ops();
    const r = await go({ command: 'format-disk' }, o);
    expect(code(r)).toBe('unknown-command');
    expect(o.calls).toEqual([]);
  });

  it('closed : run.allow, run.always, run.deny à la porte agent, rien d\'appelé ; à l\'écran, ops.run appelée', async () => {
    for (const c of ['run.allow', 'run.always', 'run.deny']) {
      const o = ops();
      const r = await go({ command: c, args: { action: 'modules' }, door: 'agent' }, o);
      expect(code(r), c).toBe('closed');
      expect(details(r)).toHaveProperty('reason');
      expect(o.calls).toEqual([]);
    }
    const o = ops();
    expect((await go({ command: 'run.allow', args: { action: 'modules' } }, o)).ok).toBe(true);
    expect(o.calls).toEqual([['run', 'modules', 'allow']]);
  });
});

describe('execute : les arguments', () => {
  it('conversion : module « 2 » arrive à ops.start en 2', async () => {
    const o = ops();
    const r = await go({ command: 'run.start', args: { action: 'module', module: '2' } }, o);
    expect(r.ok).toBe(true);
    expect(o.calls).toEqual([['start', 'module', { module: 2 }]]);
  });

  it('« abc » : invalid-args, la faute dit son chemin', async () => {
    const o = ops();
    const r = await go({ command: 'run.start', args: { action: 'module', module: 'abc' } }, o);
    expect(code(r)).toBe('invalid-args');
    expect(String(details(r)?.fault)).toContain('module');
    expect(o.calls).toEqual([]);
  });

  it('une clé inconnue, un requis manquant : invalid-args, rien d\'appelé', async () => {
    const o = ops();
    expect(code(await go({ command: 'run.start', args: { action: 'module', agentId: 'x' } }, o))).toBe('invalid-args');
    expect(code(await go({ command: 'run.start', args: {} }, o))).toBe('invalid-args');
    expect(code(await go({ command: 'run.start', args: 'module' }, o))).toBe('invalid-args');
    expect(o.calls).toEqual([]);
  });

  it('args absent : {}', async () => {
    const o = ops();
    expect((await go({ command: 'status' }, o)).ok).toBe(true);
    await go({ command: 'pull' }, o);
    expect(o.calls).toEqual([['direct', 'pull', {}]]);
  });
});

describe('execute : le relevé', () => {
  it('no-survey : relevé null, toute commande', async () => {
    const sent: [string, unknown][] = [['status', {}], ['logs', { name: 'dev' }], ['run.start', { action: 'module' }],
      ['run.stop', { action: 'modules' }], ['proc.stop', { name: 'dev' }], ['pull', {}], ['vibe', {}],
      ['artifacts', {}], ['artifact', { artifact: 'a1' }], ['draft', {}], ['draft.remove', { id: 1 }], ['proc.start', { name: 'dev' }]];
    for (const [command, args] of sent) {
      const o = ops();
      const r = await go({ command, args }, o, { view: null, defs });
      expect(code(r), command).toBe('no-survey');
      expect(o.calls).toEqual([]);
    }
  });
});

describe('execute : les lectures', () => {
  it('chaque réponse suit le schéma de sa commande, sans id de robot', async () => {
    const sent: [string, unknown][] = [['status', {}], ['next', {}], ['actions', {}], ['runs', {}], ['procs', {}], ['logs', { name: 'dev' }]];
    const all: unknown[] = [];
    for (const [command, args] of sent) {
      const r = await go({ command, args });
      if (!r.ok) throw new Error(`${command} : ${r.error.code}`);
      expect(schemaError(table.commands.find((c) => c.name === command)!.response!, r.result), command).toBeNull();
      all.push(r.result);
    }
    expect(JSON.stringify(all)).not.toContain('robot-42');
    expect(JSON.stringify(all)).not.toMatch(/"agentId?"/);
  });

  it('runs : les courses, puis celles en attente (state queued, by), conformes au schéma', async () => {
    const queued = [{ action: 'forme', by: 'modules' }, { action: 'ponytail', by: 'modules' }];
    const r = await go({ command: 'runs' }, ops(), { view, defs, queued });
    if (!r.ok) throw new Error(r.error.code);
    expect(r.result).toEqual([
      expect.objectContaining({ action: 'modules', state: 'running' }),
      { action: 'forme', state: 'queued', by: 'modules' },
      { action: 'ponytail', state: 'queued', by: 'modules' },
    ]);
    expect(schemaError(table.commands.find((c) => c.name === 'runs')!.response!, r.result)).toBeNull();
  });

  it('artifacts : artifactsOf ; draft : draftOf ; artifact : ops.artifact, null : unknown-artifact', async () => {
    const v = { ...view, artifactsDir: '/p/artifacts', artifacts: [{ id: 'a1', name: 'a.md', kind: 'markdown', size: 3, time: 5, url: 'x' }], artifactDirs: [{ id: 'd1', name: 'sub' }],
      pr: { number: 7 }, draft: [{ id: 1, target: 'a:1', text: 'rm' }] } as unknown as VibeView;
    const c = { view: v, defs };
    const o = ops();
    const list = await go({ command: 'artifacts' }, o, c);
    expect(list).toEqual({ ok: true, result: { dir: '/p/artifacts', files: [{ id: 'a1', name: 'a.md', kind: 'markdown', size: 3, time: 5 }], folders: [{ id: 'd1', name: 'sub' }] } });
    expect(await go({ command: 'draft' }, o, c)).toEqual({ ok: true, result: { pr: 7, remarks: [{ id: 1, target: 'a:1', text: 'rm' }] } });
    expect(await go({ command: 'artifact', args: { artifact: 'a1' } }, o, c)).toMatchObject({ ok: true, result: { name: 'a.md' } });
    expect(o.calls).toEqual([['artifact', 'a1']]);
    const none = ops({ ok: true }, { artifact: async () => null });
    const r = await go({ command: 'artifact', args: { artifact: 'a9' } }, none, c);
    expect([code(r), details(r)]).toEqual(['unknown-artifact', { artifact: 'a9' }]);
  });

  it('logs d\'un nom inconnu : unknown-process', async () => {
    const r = await go({ command: 'logs', args: { name: 'nope' } });
    expect(code(r)).toBe('unknown-process');
  });
});

describe('execute : les écritures', () => {
  it('run.start : action absente du relevé, not-offered sans appel', async () => {
    const o = ops();
    expect(code(await go({ command: 'run.start', args: { action: 'review-diff' } }, o))).toBe('not-offered');
    expect(o.calls).toEqual([]);
  });

  // La règle de la boîte aux lettres et de l'écran : une masquée sans griser reste possible (Écrire les invariants).
  it('run.start : action masquée au relevé, ops.start appelée (startAction juge)', async () => {
    const o = ops();
    await go({ command: 'run.start', args: { action: 'pr' } }, o);
    expect(o.calls).toEqual([['start', 'pr', {}]]);
  });

  it('run.start : ops.start(action, les args sans action) ; ignored rendu ; une écriture répond null', async () => {
    const o = ops();
    const r = await go({ command: 'run.start', args: { action: 'module', text: 'hello', module: 1 } }, o);
    expect(r).toEqual({ ok: true, result: null });
    expect(o.calls).toEqual([['start', 'module', { text: 'hello', module: 1 }]]);
    const i = ops({ ok: true, ignored: ['model'] });
    expect(await go({ command: 'run.start', args: { action: 'module' } }, i)).toEqual({ ok: true, result: { ignored: ['model'] } });
  });

  it('pull, load-pr : ops.direct ; vibe, guide : ops.start', async () => {
    const o = ops();
    await go({ command: 'pull' }, o);
    await go({ command: 'load-pr', args: { pr: 7 } }, o);
    await go({ command: 'vibe' }, o);
    await go({ command: 'guide', args: { text: 'a' } }, o);
    expect(o.calls).toEqual([['direct', 'pull', {}], ['direct', 'load-pr', { pr: 7 }], ['start', 'vibe', {}], ['start', 'guide', { text: 'a' }]]);
  });

  it('commit, publish (verdict), base : ops.direct avec leurs arguments ; un verdict hors des trois : invalid-args', async () => {
    const o = ops();
    const withAll = { ...view, actions: [...view.actions, act('publish'), act('base')] };
    const goAll = (req: Partial<CommandRequest> & { command: string }) => go(req, o, { view: withAll, defs });
    expect((await goAll({ command: 'commit' })).ok).toBe(true);
    expect((await goAll({ command: 'publish', args: { verdict: 'request-changes' } })).ok).toBe(true);
    expect((await goAll({ command: 'base' })).ok).toBe(true);
    expect(o.calls).toEqual([['direct', 'commit', {}], ['direct', 'publish', { verdict: 'request-changes' }], ['direct', 'base', {}]]);
    expect(code(await goAll({ command: 'publish', args: { verdict: 'ok' } }))).toBe('invalid-args');
    expect(code(await goAll({ command: 'publish' }))).toBe('invalid-args');
    expect(code(await go({ command: 'base' }, o))).toBe('not-offered');   // absente du relevé de ce fichier
    expect(o.calls).toHaveLength(3);
  });

  it('vibe, guide, new-request, propose-run : absente ou masquée au relevé, not-offered sans appel (porte agent)', async () => {
    const o = ops();
    const hidden = { ...view, actions: view.actions.map((a) => (a.id === 'guide' ? { ...a, hidden: true } : a)) };
    expect(code(await go({ command: 'new-request', args: { text: 'a' }, door: 'agent' }, o))).toBe('not-offered');
    expect(code(await go({ command: 'propose-run', door: 'agent' }, o))).toBe('not-offered');
    expect(code(await go({ command: 'guide', door: 'agent' }, o, { view: hidden, defs }))).toBe('not-offered');
    expect(o.calls).toEqual([]);
  });

  it('une direct absente du relevé : not-offered, rien d\'appelé (les deux portes)', async () => {
    const o = ops();
    expect(code(await go({ command: 'fetch' }, o))).toBe('not-offered');
    expect(code(await go({ command: 'fetch', door: 'agent' }, o))).toBe('not-offered');
    expect(o.calls).toEqual([]);
  });

  it('comment, case-ko : unknown-command, rien d\'appelé ; add-artifact : ops.direct avec files et folder', async () => {
    const o = ops();
    for (const [command, args] of [['comment', { quote: 'q' }], ['case-ko', { quote: 'q' }]] as const) {
      expect(code(await go({ command, args }, o)), command).toBe('unknown-command');
    }
    expect(o.calls).toEqual([]);
    const files = [{ path: '/tmp/a.png' }, { name: 'b.txt', content: 'aGk=' }];
    expect((await go({ command: 'add-artifact', args: { files, folder: 'd1' } }, o)).ok).toBe(true);
    expect(o.calls).toEqual([['direct', 'add-artifact', { files, folder: 'd1' }]]);
  });

  it('porte écran : une action directe masquée présente au relevé, ops.direct ; porte agent : la même, not-offered', async () => {
    const o = ops();
    expect((await go({ command: 'push' }, o)).ok).toBe(true);
    expect(o.calls).toEqual([['direct', 'push', {}]]);
    const a = ops();
    expect(code(await go({ command: 'push', door: 'agent' }, a))).toBe('not-offered');
    expect(a.calls).toEqual([]);
  });

  it('draft.add, draft.edit, draft.remove : ops.draft ; reason no-pr : no-pr ; args : invalid-args', async () => {
    const o = ops();
    await go({ command: 'draft.add', args: { target: 'src/a.ts:3', text: 'rm' } }, o);
    await go({ command: 'draft.edit', args: { id: 2, text: 'rm2' } }, o);
    await go({ command: 'draft.remove', args: { id: 2 } }, o);
    expect(o.calls).toEqual([['draft', { add: { target: 'src/a.ts:3', text: 'rm' } }], ['draft', { edit: { id: 2, text: 'rm2' } }], ['draft', { remove: 2 }]]);
    const add = { command: 'draft.add', args: { target: 't', text: 'x' } };
    expect(code(await go(add, ops({ ok: false, reason: 'no-pr', error: 'Aucune PR' })))).toBe('no-pr');
    expect(code(await go(add, ops({ ok: false, reason: 'args', error: 'x' })))).toBe('invalid-args');
  });

  it('proc.start : ops.proc start ; un nom hors du relevé : unknown-process', async () => {
    const o = ops();
    expect(code(await go({ command: 'proc.start', args: { name: 'nope' } }, o))).toBe('unknown-process');
    expect(o.calls).toEqual([]);
    expect(await go({ command: 'proc.start', args: { name: 'dev' } }, o)).toEqual({ ok: true, result: null });
    expect(o.calls).toEqual([['proc', 'dev', 'start']]);
  });

  it('run.stop : ops.run ; false : no-run', async () => {
    const o = ops();
    expect(await go({ command: 'run.stop', args: { action: 'modules' } }, o)).toEqual({ ok: true, result: null });
    expect(o.calls).toEqual([['run', 'modules', 'stop']]);
    const none = ops({ ok: true }, { run: async () => false });
    expect(code(await go({ command: 'run.undo', args: { action: 'modules' } }, none))).toBe('no-run');
  });

  it('run.wait : la réponse de ops.wait ; null : no-run ; action absente : invalid-args ; porte agent, même retenue', async () => {
    const o = ops();
    expect(await go({ command: 'run.wait', args: { action: 'modules' } }, o)).toEqual({ ok: true, result: { action: 'modules', state: 'done', reply: 'fini' } });
    expect(o.calls).toEqual([['wait', 'modules']]);
    const agent = ops();
    expect((await go({ command: 'run.wait', args: { action: 'modules' }, door: 'agent' }, agent)).ok).toBe(true);
    expect(agent.calls).toEqual([['wait', 'modules']]);
    const none = ops({ ok: true }, { wait: async () => null });
    const r = await go({ command: 'run.wait', args: { action: 'forme' } }, none);
    expect([code(r), details(r)]).toEqual(['no-run', { action: 'forme' }]);
    const missing = ops();
    expect(code(await go({ command: 'run.wait', args: {} }, missing))).toBe('invalid-args');
    expect(missing.calls).toEqual([]);
  });

  it('proc.restart : nom hors du relevé, unknown-process ; sinon ops.proc', async () => {
    const o = ops();
    expect(code(await go({ command: 'proc.restart', args: { name: 'nope' } }, o))).toBe('unknown-process');
    expect(o.calls).toEqual([]);
    expect(await go({ command: 'proc.restart', args: { name: 'dev' } }, o)).toEqual({ ok: true, result: null });
    expect(o.calls).toEqual([['proc', 'dev', 'restart']]);
  });
});

describe('execute : les refus traduits', () => {
  const refuse = (outcome: Omit<OpOutcome, 'ok'>, command = 'run.start', args: unknown = { action: 'module' }) =>
    go({ command, args }, ops({ ...outcome, ok: false }));

  it('same, busy, changing (avec by), worktree', async () => {
    expect(code(await refuse({ reason: 'same' }))).toBe('same');
    for (const reason of ['busy', 'changing']) {
      const r = await refuse({ reason, by: 'modules', error: 'texte' });
      expect([code(r), details(r)]).toEqual([reason, { by: 'modules' }]);
    }
    expect(code(await refuse({ reason: 'worktree', error: 'texte' }))).toBe('worktree');
  });

  it('disabled : le texte du relevé tel quel', async () => {
    const r = await refuse({ reason: 'disabled', error: 'Une action est en cours' });
    expect([code(r), details(r)]).toEqual(['disabled', { reason: 'Une action est en cours' }]);
  });

  it('action : not-offered ; args : invalid-args ; une clé d\'argument : invalid-args { arg }', async () => {
    expect(code(await refuse({ reason: 'action', error: 'x' }))).toBe('not-offered');
    const a = await refuse({ reason: 'args', error: 'x' });
    expect([code(a), details(a)]).toEqual(['invalid-args', {}]);
    const m = await refuse({ reason: 'module', error: 'Module inconnu' });
    expect([code(m), details(m)]).toEqual(['invalid-args', { arg: 'module' }]);
    const p = await refuse({ reason: 'pr', error: 'x' }, 'load-pr', { pr: 7 });
    expect(details(p)).toEqual({ arg: 'pr' });
  });

  it('aucune clé, ou une clé qui n\'est pas un argument : refused avec le texte', async () => {
    for (const reason of [undefined, 'draft', 'note']) {
      const r = await refuse({ reason, error: 'Pas de brouillon' });
      expect([code(r), details(r)], String(reason)).toEqual(['refused', { reason: 'Pas de brouillon' }]);
    }
  });
});

describe('execute : la fin du travail (done), la même réponse pour toutes les portes', () => {
  const withRename = { view: { ...view, actions: [...view.actions, act('rename-artifact', { step: null })] }, defs };
  const args = { artifacts: ['a1'], name: 'n.md' };
  // Le départ accepté, puis `done` : ce que rend la fin du travail ; `waited` dit si done a été attendue.
  const ending = (done: OpOutcome | Promise<OpOutcome>, direct: Omit<OpOutcome, 'ok' | 'done'> = {}) => {
    const flag = { waited: false };
    const finished = Promise.resolve(done).then((d) => { flag.waited = true; return d; });
    return { flag, ops: ops({ ok: true, ...direct, done: finished }) };
  };
  const renameWith = (done: OpOutcome | Promise<OpOutcome>, door: 'screen' | 'agent' = 'screen', direct = {}) =>
    go({ command: 'rename-artifact', args, door }, ending(done, direct).ops, withRename);

  it('done refusé unknown-artifact : unknown-artifact { reason }', async () => {
    const r = await renameWith({ ok: false, reason: 'unknown-artifact', error: 'Id inconnu' });
    expect([code(r), details(r)]).toEqual(['unknown-artifact', { reason: 'Id inconnu' }]);
  });

  it('done refusé par une clé d\'argument (name) : invalid-args { arg }', async () => {
    const r = await renameWith({ ok: false, reason: 'name', error: 'Nom refusé' });
    expect([code(r), details(r)]).toEqual(['invalid-args', { arg: 'name' }]);
  });

  it('done refusé failed : failed { message }', async () => {
    const r = await renameWith({ ok: false, reason: 'failed', error: 'disque plein' });
    expect([code(r), details(r)]).toEqual(['failed', { message: 'disque plein' }]);
  });

  it('done refusé refused, sans clé, ou d\'une clé qui n\'est pas un argument : refused { reason }', async () => {
    for (const reason of ['refused', undefined, 'note']) {
      const r = await renameWith({ ok: false, reason, error: 'Nom pris' });
      expect([code(r), details(r)], String(reason)).toEqual(['refused', { reason: 'Nom pris' }]);
    }
  });

  it('done ok : ok ; ignored gardé (celui du départ, ou celui de la fin)', async () => {
    expect(await renameWith({ ok: true })).toEqual({ ok: true, result: null });
    expect(await renameWith({ ok: true }, 'screen', { ignored: ['model'] })).toEqual({ ok: true, result: { ignored: ['model'] } });
    expect(await renameWith({ ok: true, ignored: ['effort'] })).toEqual({ ok: true, result: { ignored: ['effort'] } });
  });

  it('la même réponse à la porte agent qu\'à l\'écran', async () => {
    const done = { ok: false, reason: 'unknown-artifact', error: 'Id inconnu' };
    expect(await renameWith(done, 'agent')).toEqual(await renameWith(done, 'screen'));
  });

  it('done attendue avant de répondre : la réponse ne vient pas avant la fin', async () => {
    let end!: (o: OpOutcome) => void;
    const e = ending(new Promise<OpOutcome>((resolve) => { end = resolve; }));
    const reply = go({ command: 'rename-artifact', args }, e.ops, withRename);
    let settled = false;
    void reply.then(() => { settled = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect([e.flag.waited, settled]).toEqual([false, false]);
    end({ ok: false, reason: 'unknown-artifact' });
    expect(code(await reply)).toBe('unknown-artifact');
    expect(e.flag.waited).toBe(true);
  });

  it('départ refusé tout de suite (busy) : done jamais attendue', async () => {
    const done = new Promise<OpOutcome>(() => {});   // ne se résout jamais : l'attendre ferait échouer le test par délai
    const o = ops({ ok: false, reason: 'busy', by: 'modules', done });
    const r = await go({ command: 'rename-artifact', args }, o, withRename);
    expect([code(r), details(r)]).toEqual(['busy', { by: 'modules' }]);
  });

  it('un done qui rejette : failed { message }, sans lever', async () => {
    const r = await renameWith(Promise.reject(new Error('disque coupé')));
    expect([code(r), details(r)]).toEqual(['failed', { message: 'disque coupé' }]);
  });

  it('sans done : le refus du départ traduit comme avant, unknown-artifact et failed compris', async () => {
    const one = (reason: string) => go({ command: 'rename-artifact', args }, ops({ ok: false, reason, error: 'x' }), withRename);
    expect([code(await one('unknown-artifact')), details(await one('unknown-artifact'))]).toEqual(['unknown-artifact', { reason: 'x' }]);
    expect([code(await one('failed')), details(await one('failed'))]).toEqual(['failed', { message: 'x' }]);
  });
});

describe('execute : ne lève jamais', () => {
  it('une op qui lève : failed { message }', async () => {
    const boom = (): never => { throw new Error('git a planté'); };
    const cases: [string, unknown, Partial<CommandOps>][] = [
      ['run.start', { action: 'module' }, { start: boom }], ['pull', {}, { direct: boom }],
      ['run.stop', { action: 'modules' }, { run: async () => boom() }], ['proc.stop', { name: 'dev' }, { proc: async () => boom() }],
    ];
    for (const [command, args, over] of cases) {
      const r = await go({ command, args }, ops({ ok: true }, over));
      expect([code(r), details(r)], command).toEqual(['failed', { message: 'git a planté' }]);
    }
  });
});

describe('execute : le mode Vibe arrêté (ctx.halted)', () => {
  it('run.start et une commande de départ : halted, aucune opération appelée ; une lecture passe', async () => {
    const o = ops();
    const halted = { ...ctx, halted: true };
    expect(code(await go({ command: 'run.start', args: { action: 'forme' }, door: 'agent' }, o, halted))).toBe('halted');
    expect(code(await go({ command: 'vibe', door: 'agent' }, o, halted))).toBe('halted');
    expect(o.calls).toEqual([]);
    expect((await go({ command: 'status', door: 'agent' }, o, halted)).ok).toBe(true);
  });
});

describe('execute : les erreurs', () => {
  it('toute erreur : un code d\'ERROR_CODES, message et todo de la table', async () => {
    const outcomes: [string, unknown, OpOutcome?][] = [
      ['nope', {}], ['run.allow', { action: 'x' }], ['run.start', {}], ['logs', { name: 'nope' }], ['push', {}],
      ['run.start', { action: 'module' }, { ok: false, reason: 'busy', by: 'x' }],
      ['run.start', { action: 'module' }, { ok: false, error: 'x' }],
    ];
    for (const [command, args, outcome] of outcomes) {
      const r = await go({ command, args, door: 'agent' }, ops(outcome));
      if (r.ok) throw new Error(command);
      const def = table.errors.find((e) => e.code === r.error.code)!;
      expect(ERROR_CODES).toContain(r.error.code);
      expect([r.error.message, r.error.todo]).toEqual([def.message, def.todo]);
    }
  });
});

describe('execute : la table livrée', () => {
  it('ses codes sont ceux d\'ERROR_CODES ; le texte de bad-token est celui du protocole (que le protocole seul rend)', () => {
    expect(table.errors.map((e) => e.code)).toEqual([...ERROR_CODES]);
    const bad = table.errors.find((e) => e.code === 'bad-token')!;
    expect({ message: bad.message, todo: bad.todo }).toEqual({ message: BAD_TOKEN.error.message, todo: BAD_TOKEN.error.todo });
  });
});
