// Variantes des lectures : chaque réponse, sur un relevé écrit à la main, suit le schéma de sa commande dans la
// vraie table (resources/vibecoder/commands.json) ; les cas vides (pas de dépôt, pas de PR, processus inconnu) ;
// le partage entre proposées et grisées ; jamais l'id du robot.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VibeAction, VibeRun, VibeView } from 'shared/bridge';
import { actionsOf, logsOf, nextOf, parseCommands, procsOf, runsOf, schemaError, statusOf } from 'core/commands';
import { parseActions } from 'core/vibecoder';

const RES = path.resolve(__dirname, '../../../../../../resources/vibecoder');
const table = parseCommands(fs.readFileSync(path.join(RES, 'commands.json'), 'utf8'));
const defs = parseActions(JSON.parse(fs.readFileSync(path.join(RES, 'actions.fr.json'), 'utf8')));
const response = (name: string) => table.commands.find((c) => c.name === name)!.response!;
const conforms = (name: string, value: unknown) => expect(schemaError(response(name), value), name).toBeNull();

const act = (id: string, over: Partial<VibeAction> = {}): VibeAction => ({
  id, step: 'modules', label: id, hint: '', who: 'agent', models: [], model: null, kind: 'send', needs: 'none', usesText: false,
  primary: false, disabled: null, hidden: false, ...over,
});
const run = (id: string, state: VibeRun['state'], since: number, over: Partial<VibeRun> = {}): VibeRun => ({
  id, label: id, who: 'sonnet', state, since, end: null, reply: '', permission: null, ...over,
});

const view: VibeView = {
  agentId: 'robot-42', time: 0, lang: 'fr', flow: 'create', vibe: true, agent: { model: 'opus', effort: 'high', mode: 'default' },
  repo: { branch: 'feat/x', base: 'master', changed: 3 }, error: null,
  steps: [
    { id: 'note', status: 'done', facts: '' }, { id: 'forme', status: 'done', facts: '' }, { id: 'invariants', status: 'done', facts: '' },
    { id: 'modules', status: 'current', facts: '' }, { id: 'revue', status: 'todo', facts: '' }, { id: 'pr', status: 'todo', facts: '' },
  ],
  note: { id: 'n', path: 'docs/tickets/feat/x.md', text: '', before: null, filled: true, mustNot: [], mark: null, formeMark: null },
  questions: [], modules: [], invariants: [], variants: [], commits: [], outputs: {}, checklist: [],
  actions: [
    act('module', { primary: true }),
    act('modules'),
    act('commit', { disabled: 'Une action est en cours' }),
    act('pr', { step: 'pr', hidden: true, disabled: 'Pas encore' }),
    act('guide', { step: null }),
    act('push', { step: null, direct: { running: false, last: null, only: true } }),
  ],
  skills: [], pr: { number: 7, title: 'Un bouton', url: 'https://x/7', author: 'me', base: 'master', head: 'feat/x', body: '', state: 'OPEN' },
  prs: null, draft: [],
  processes: [
    { name: 'dev', run: 'npm start', status: 'running', since: 1000, exit: null, log: 'ready\n' },
    { name: 'front', run: 'vite', status: 'failed', since: 900, exit: 1, log: '' },
    { name: 'db', run: 'mongod', status: 'stopped', since: null, exit: null, log: '' },
  ],
  runs: [  // la plus récente d'abord
    run('modules', 'asking', 3000, { permission: { tool: 'Bash', target: 'rm x' }, reply: 'ok' }),
    run('invariants', 'done', 2000, { end: 2500, reply: 'fini' }),
    run('forme', 'stopped', 1500, { end: 1600 }),
    run('note', 'kept', 1000, { end: 1200 }),
  ],
};
const empty: VibeView = { ...view, repo: null, error: 'pas un dépôt', steps: [], note: null, pr: null, vibe: undefined, actions: [], processes: undefined, runs: undefined };

describe('les lectures suivent le schéma de leur commande', () => {
  it('chaque réponse, sur un relevé plein puis sur un relevé vide', () => {
    for (const v of [view, empty]) {
      conforms('status', statusOf(v));
      conforms('next', nextOf(v));
      conforms('actions', actionsOf(v, defs));
      conforms('runs', runsOf(v));
      conforms('procs', procsOf(v));
      conforms('logs', logsOf(v, 'dev'));
      conforms('logs', logsOf(v, 'inconnu'));
    }
  });

  it("n'expose jamais l'id du robot, ni son nom en clé", () => {
    const all = JSON.stringify([statusOf(view), nextOf(view), actionsOf(view, defs), runsOf(view), procsOf(view), logsOf(view, 'dev')]);
    expect(all).not.toContain('robot-42');
    expect(all).not.toMatch(/"agentId?"/);
  });
});

describe('status', () => {
  it('le dépôt, le parcours, l\'étape, la note, la PR, le mode Vibe et les courses qui retiennent', () => {
    expect(statusOf(view)).toEqual({
      branch: 'feat/x', base: 'master', flow: 'create', step: 'modules', note: 'docs/tickets/feat/x.md',
      pr: { number: 7, title: 'Un bouton', url: 'https://x/7', state: 'OPEN' }, vibe: true,
      running: [{ action: 'modules', state: 'asking', since: 3000 }, { action: 'forme', state: 'stopped', since: 1500 }],
    });
  });

  it('sans dépôt ni PR ni note : des null, vibe faux, rien en cours', () => {
    expect(statusOf(empty)).toEqual({ branch: null, base: null, flow: 'create', step: null, note: null, pr: null, vibe: false, running: [] });
  });
});

describe('next', () => {
  it('les proposées (ni masquées ni grisées, la principale dite) et les grisées avec leur raison', () => {
    expect(nextOf(view)).toEqual({
      proposed: [{ action: 'module', primary: true }, { action: 'modules', primary: false }, { action: 'guide', primary: false }, { action: 'push', primary: false }],
      disabled: [{ action: 'commit', reason: 'Une action est en cours' }],
    });
  });
});

describe('actions, runs, procs, logs', () => {
  it('actions : celles du relevé, dans l\'ordre du catalogue, avec leur course, leur voie directe et leurs arguments lus', () => {
    const got = actionsOf({ ...view, actions: [act('push'), act('module'), act('guide'), act('commit')] }, defs);
    expect(got.map((a) => a.action)).toEqual(defs.map((d) => d.id).filter((id) => ['push', 'module', 'guide', 'commit'].includes(id)));
    const by = Object.fromEntries(got.map((a) => [a.action, a]));
    expect(by.push).toMatchObject({ run: false, direct: 'only' });
    expect(by.commit).toMatchObject({ run: true, direct: 'also' });
    expect(by.module).toMatchObject({ run: true, direct: null, args: ['module'] });
    expect(by.guide).toMatchObject({ step: null, run: false });
  });

  it('runs : la plus ancienne d\'abord, sans l\'avancement', () => {
    expect(runsOf(view).map((r) => r.action)).toEqual(['note', 'forme', 'invariants', 'modules']);
    expect(runsOf(view)[3]).toEqual({ action: 'modules', label: 'modules', who: 'sonnet', state: 'asking', since: 3000, end: null, reply: 'ok', permission: { tool: 'Bash', target: 'rm x' } });
  });

  it('procs : sans le journal ; logs : celui du relevé tel quel, null pour un nom inconnu', () => {
    expect(procsOf(view)[0]).toEqual({ name: 'dev', run: 'npm start', status: 'running', since: 1000, exit: null });
    expect(procsOf(empty)).toEqual([]);
    expect(logsOf(view, 'dev')).toEqual({ name: 'dev', log: 'ready\n' });
    expect(logsOf(view, 'nope')).toBeNull();
    expect(logsOf(empty, 'dev')).toBeNull();
  });
});
