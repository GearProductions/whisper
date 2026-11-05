// Variantes des skills livrés : la section des arguments de `actions` et de `processus`, régénérée d'après la vraie
// table et le vrai catalogue, se retrouve telle quelle dans leur SKILL.md : il échoue quand le SKILL.md prend du retard.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCommands, skillArgs } from 'core/commands';
import { parseActions } from 'core/vibecoder';

const RES = path.resolve(__dirname, '../../../../../../resources/vibecoder');
const table = parseCommands(fs.readFileSync(path.join(RES, 'commands.json'), 'utf8'));
const defs = parseActions(JSON.parse(fs.readFileSync(path.join(RES, 'actions.en.json'), 'utf8')));

describe('les SKILL.md livrés', () => {
  it.each(['actions', 'processus'] as const)('%s contient la section produite par la table', (skill) => {
    const md = fs.readFileSync(path.join(RES, 'plugin/skills', skill, 'SKILL.md'), 'utf8');
    expect(md).toContain(skillArgs(table, defs, skill));
  });
});
