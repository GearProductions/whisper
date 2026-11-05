// Variantes de table : chaque faute de parseCommands est refusée et nommée, toutes ensemble.
import { describe, expect, it } from 'vitest';
import { AGENT_CLOSED, parseCommands } from 'core/commands';

const args = { type: 'object', properties: {}, additionalProperties: false };
const read = { name: 'run.list', description: 'Lists runs.', kind: 'read', agent: true, args, response: { type: 'array', items: { type: 'string' } } };
const closed = { name: 'run.allow', description: 'Answers.', kind: 'write', agent: false, reason: 'Only the user.', args };
const table = (commands: object[], extra: object = {}) => JSON.stringify({ schemaVersion: 1, target: 'The repo.', commands, ...extra });
const refused = (commands: object[]) => () => parseCommands(table(commands));

describe('parseCommands', () => {
  it('accepte une table valide et la rend', () => {
    const parsed = parseCommands(table([read, closed]));
    expect(parsed.commands.map((c) => c.name)).toEqual(['run.list', 'run.allow']);
    expect(AGENT_CLOSED).toContain('run.allow');
  });

  it('refuse un JSON illisible et une schemaVersion inconnue', () => {
    expect(() => parseCommands('{')).toThrow(/illisible/);
    expect(() => parseCommands(table([], { schemaVersion: 2 }))).toThrow(/schemaVersion 2/);
  });

  it.each<[string, object[], RegExp]>([
    ['deux commandes du même nom', [read, read], /run\.list : nom déjà pris/],
    ['une description vide', [{ ...read, description: ' ' }], /run\.list : description vide/],
    ['un argument sans type', [{ ...read, args: { ...args, properties: { n: { description: 'x' } } } }], /run\.list args\.n : sans type/],
    ['un type inconnu', [{ ...read, args: { ...args, properties: { n: { type: 'strng' } } } }], /args\.n : type inconnu/],
    ['un enum qui n\'est pas une liste', [{ ...read, args: { ...args, properties: { n: { type: 'string', enum: 'a' } } } }], /args\.n : enum doit être une liste/],
    ['un mot-clé hors SCHEMA_KEYS', [{ ...read, args: { ...args, properties: { n: { type: 'string', format: 'uri' } } } }], /args\.n : mot-clé « format »/],
    ['un mot-clé hors liste, en profondeur', [{ ...read, response: { type: 'array', items: { type: 'object', oneOf: [] } } }], /response\[\] : mot-clé « oneOf »/],
    ['args qui n\'est pas fermé', [{ ...read, args: { type: 'object' } }], /run\.list args : un objet avec additionalProperties: false/],
    ['une lecture sans response', [{ ...read, response: undefined }], /run\.list : une lecture sans response/],
    ['une commande de AGENT_CLOSED ouverte', [{ ...closed, agent: undefined }], /run\.allow : ouverte aux agents/],
    ['un doublon ouvert d\'une commande fermée', [closed, { ...closed, agent: true }], /run\.allow : ouverte aux agents/],
    ['une fermée hors de la liste', [{ ...closed, name: 'run.list' }], /run\.list : fermée aux agents hors/],
    ['une fermée sans reason', [{ ...closed, reason: '' }], /run\.allow : fermée sans reason/],
    ['un agentId en argument', [{ ...read, args: { ...args, properties: { agentId: { type: 'string' } } } }], /args\.agentId : un id de robot/],
    ['un agent profond dans la réponse', [{ ...read, response: { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' } } } } }], /response\[\]\.agent : un id de robot/],
  ])('refuse %s', (_, commands, message) => {
    expect(refused(commands)).toThrow(message);
  });

  it('nomme toutes les fautes d\'un coup', () => {
    expect(refused([{ ...read, description: '' }, { ...closed, reason: '' }])).toThrow(/run\.list : description vide[\s\S]*run\.allow : fermée sans reason/);
  });
});
