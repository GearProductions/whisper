// Variantes de skill-text : la section produite par une petite table écrite à la main.
import { describe, expect, it } from 'vitest';
import { skillArgs, type CommandDef, type CommandTable } from 'core/commands';
import type { ActionDef } from 'core/vibecoder';

const cmd = (name: string, props: Record<string, string>): CommandDef => ({
  name, description: name, kind: 'write', agent: true,
  args: { type: 'object', properties: Object.fromEntries(Object.entries(props).map(([k, description]) => [k, { type: 'string', description }])) },
});
const table: CommandTable = {
  schemaVersion: 1, target: 'x',
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

describe('skillArgs', () => {
  it('actions : les clés dans l\'ordre du schéma, les descriptions de la table, text pour les actions qui le lisent', () => {
    const out = skillArgs(table, defs, 'actions');
    expect(out).toContain('`<out>/actions/<id>.start`');
    expect(out).toContain('`<out>/actions/<id>.stop`');
    expect(out).toContain('`text` (the request; only `note` read it');
    expect(out.indexOf('`text`')).toBeLessThan(out.indexOf('`module`'));
    expect(out.indexOf('`module`')).toBeLessThan(out.indexOf('`model`'));
    expect(out).toContain('`model` (a model)');
    expect(out).toContain('`<id>`: an action id)');
    expect(out).toContain('`<id>`: the id of a run)');
  });

  it('actions : ni ask (pas de course), ni guide (prefill), ni la clé action', () => {
    const out = skillArgs(table, defs, 'actions');
    expect(out).not.toContain('`ask`');
    expect(out).not.toContain('`guide`');
    expect(out).not.toContain('`action` (');
  });

  it('processus : arrêt et redémarrage, la description de name', () => {
    expect(skillArgs(table, defs, 'processus')).toBe([
      '- **Stop**: create the empty file `<out>/run/<name>.stop` (`<name>`: a command name).',
      '- **Restart** (or start a stopped one): create the empty file `<out>/run/<name>.restart` (`<name>`: a command name).',
    ].join('\n'));
  });

  it('une description absente de la table est une faute', () => {
    expect(() => skillArgs({ ...table, commands: table.commands.slice(0, 3) }, defs, 'processus')).toThrow('proc.restart.name');
  });
});
