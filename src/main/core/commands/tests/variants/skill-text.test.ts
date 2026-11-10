// Variantes de skill-text : la section produite par une petite table écrite à la main.
import { describe, expect, it } from 'vitest';
import { skillArgs, type CommandDef, type CommandTable } from 'core/commands';
import type { ActionDef } from 'core/vibecoder';

const cmd = (name: string, props: Record<string, string>): CommandDef => ({
  name, description: name, kind: 'write', agent: true,
  args: { type: 'object', properties: Object.fromEntries(Object.entries(props).map(([k, description]) => [k, { type: 'string', description }])) },
});
const table: CommandTable = {
  schemaVersion: 1, target: 'x', errors: [],
  commands: [
    cmd('run.start', { action: 'an action id.', text: 'the request.', module: '0-based rank.', model: 'a model' }),
    cmd('run.stop', { action: 'the id of a run' }),
    cmd('proc.stop', { name: 'a command name.' }),
    cmd('proc.restart', { name: 'a command name' }),
  ],
};
const def = (id: string, text: string, kind: ActionDef['kind'] = 'send', step: ActionDef['step'] = 'note'): ActionDef =>
  ({ id, flow: 'both', step, kind, needs: 'none', label: id, hint: '', text });
const defs = [
  def('note', '/vibecoder:note {{text}}'),
  def('check', '/vibecoder:check {{module}}'),
  def('ask', '{{text}}', 'send', null),
  def('guide', '{{text}}', 'prefill'),
];

const BIN = 'node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs"';

describe('skillArgs', () => {
  it('actions : run start avec les clés dans l\'ordre du schéma, les descriptions de la table, text pour les actions qui le lisent', () => {
    const out = skillArgs(table, defs, 'actions');
    expect(out).toContain(`${BIN} run start <id> [key=value…]`);
    expect(out).toContain('`text` (the request; only `note` read it');
    expect(out.indexOf('`text`')).toBeLessThan(out.indexOf('`module`'));
    expect(out.indexOf('`module`')).toBeLessThan(out.indexOf('`model`'));
    expect(out).toContain('`model` (a model)');
    expect(out).toContain('`<id>`: an action id)');
  });

  it('actions : run stop, run wait (en tâche de fond), run list ; aucune boîte aux lettres', () => {
    const out = skillArgs(table, defs, 'actions');
    expect(out).toContain(`${BIN} run stop <id>\``);
    expect(out).toContain('`<id>`: the id of a run)');
    expect(out).toContain(`${BIN} run wait <id>\``);
    expect(out).toContain('background');
    expect(out).toContain(`${BIN} run list\``);
    expect(out).not.toMatch(/<out>\/actions|\.start|\.stop/);
  });

  it('actions : ni ask (pas de course), ni guide (prefill), ni la clé action', () => {
    const out = skillArgs(table, defs, 'actions');
    expect(out).not.toContain('`ask`');
    expect(out).not.toContain('`guide`');
    expect(out).not.toContain('`action` (');
  });

  it('processus : proc list, stop, restart, logs, la description de name ; aucun run/<nom>', () => {
    const out = skillArgs(table, defs, 'processus');
    for (const verb of ['list', 'stop <name>', 'restart <name>', 'logs <name>']) expect(out).toContain(`${BIN} proc ${verb}\``);
    expect(out).toContain('`<name>`: a command name');
    expect(out).not.toMatch(/run\/<name>|\.stop|\.restart/);
  });

  it('une description absente de la table est une faute', () => {
    expect(() => skillArgs({ ...table, commands: table.commands.slice(0, 3) }, defs, 'processus')).toThrow('proc.restart.name');
  });
});
