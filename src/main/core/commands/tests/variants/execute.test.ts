// Variantes de l'exécuteur (execute), sur la vraie table livrée (resources/vibecoder/commands.json) : la commande
// inconnue, la porte, la conversion des arguments, le relevé absent, les lectures (schéma, jamais l'id du robot), les
// écritures vers les opérations injectées (chacune relève ses appels), les refus traduits, une opération qui lève, les
// codes et textes des erreurs, les codes de la table livrée.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VibeAction, VibeRun, VibeView } from 'shared/bridge';
import { ERROR_CODES, execute, parseCommands, schemaError, type CommandContext, type CommandOps, type CommandRequest, type CommandResponse, type OpOutcome } from 'core/commands';
import { parseActions } from 'core/vibecoder';

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
      ['run.stop', { action: 'modules' }], ['proc.stop', { name: 'dev' }], ['pull', {}], ['vibe', {}]];
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

  it('vibe, guide, new-request, propose-run : absente ou masquée au relevé, not-offered sans appel', async () => {
    const o = ops();
    const hidden = { ...view, actions: view.actions.map((a) => (a.id === 'guide' ? { ...a, hidden: true } : a)) };
    expect(code(await go({ command: 'new-request', args: { text: 'a' } }, o))).toBe('not-offered');
    expect(code(await go({ command: 'propose-run' }, o))).toBe('not-offered');
    expect(code(await go({ command: 'guide' }, o, { view: hidden, defs }))).toBe('not-offered');
    expect(o.calls).toEqual([]);
  });

  it('une direct masquée ou absente du relevé : not-offered, rien d\'appelé', async () => {
    const o = ops();
    expect(code(await go({ command: 'push' }, o))).toBe('not-offered');
    expect(code(await go({ command: 'fetch' }, o))).toBe('not-offered');
    expect(o.calls).toEqual([]);
  });

  it('comment, case-ko, add-artifact : not-offered', async () => {
    const o = ops();
    for (const [command, args] of [['comment', { quote: 'q' }], ['case-ko', { quote: 'q' }], ['add-artifact', {}]] as const) {
      expect(code(await go({ command, args }, o)), command).toBe('not-offered');
    }
    expect(o.calls).toEqual([]);
  });

  it('run.stop : ops.run ; false : no-run', async () => {
    const o = ops();
    expect(await go({ command: 'run.stop', args: { action: 'modules' } }, o)).toEqual({ ok: true, result: null });
    expect(o.calls).toEqual([['run', 'modules', 'stop']]);
    const none = ops({ ok: true }, { run: async () => false });
    expect(code(await go({ command: 'run.undo', args: { action: 'modules' } }, none))).toBe('no-run');
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
