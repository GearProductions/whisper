// Variantes de la vraie table (resources/vibecoder/commands.json) : elle passe parseCommands, run.start garde
// exactement les arguments de parseRequest, chacun lu par une action, une commande par action directe.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, parseCommands, type JsonSchema } from 'core/commands';
import { okRef } from 'helpers';
import { DIRECT_ONLY, EFFORT_LEVELS, SKILL_MODELS, ownRun, parseActions, readArgs, REQUEST_ARGS } from 'core/vibecoder';

const RES = path.resolve(__dirname, '../../../../../../resources/vibecoder');
const text = fs.readFileSync(path.join(RES, 'commands.json'), 'utf8');
const table = parseCommands(text);
const names = table.commands.map((c) => c.name);
const catalogue = (lang: string) => parseActions(JSON.parse(fs.readFileSync(path.join(RES, `actions.${lang}.json`), 'utf8')));
const start = table.commands.find((c) => c.name === 'run.start')!;
const OTHERS = ['load-pr', 'pr-here', 'pr-worktree', 'vibe', 'guide', 'new-request', 'comment', 'case-ko', 'propose-run'];

// Chaque nœud d'un schéma, avec son chemin.
const nodes = (schema: JsonSchema, at: string): [string, JsonSchema][] => [
  [at, schema],
  ...Object.entries(schema.properties ?? {}).flatMap(([k, s]) => nodes(s, `${at}.${k}`)),
  ...(schema.items ? nodes(schema.items, `${at}[]`) : []),
];

describe('la table livrée', () => {
  it('chaque argument et chaque propriété de réponse a une description', () => {
    for (const c of table.commands) {
      for (const [at, s] of [...nodes(c.args, `${c.name} args`), ...(c.response ? nodes(c.response, `${c.name} response`) : [])]) {
        if (!at.endsWith('args') && !at.endsWith('response')) expect(s.description, at).toBeTruthy();
      }
    }
  });

  it('seules les trois réponses à une autorisation sont fermées aux agents', () => {
    expect(table.commands.filter((c) => !c.agent).map((c) => c.name)).toEqual(['run.allow', 'run.always', 'run.deny']);
  });

  it('chaque lecture a sa réponse, et logs son nom en argument', () => {
    expect(table.commands.filter((c) => c.kind === 'read').map((c) => c.name)).toEqual(['status', 'next', 'actions', 'runs', 'procs', 'logs']);
    expect(Object.keys(table.commands.find((c) => c.name === 'logs')!.args.properties!)).toEqual(['name']);
  });

  it('proc.stop et proc.restart disent que seuls les noms des commandes du projet comptent', () => {
    for (const name of ['proc.stop', 'proc.restart']) {
      const c = table.commands.find((x) => x.name === name)!;
      expect(c.args.properties!.name.description).toMatch(/only the names of the project's commands count/);
    }
  });
});

describe('run.start', () => {
  const props = start.args.properties!;

  it('garde exactement les arguments de parseRequest, plus action, verdict compris ; verdict : l\'enum des trois', () => {
    expect(Object.keys(props).filter((k) => k !== 'action').sort()).toEqual([...REQUEST_ARGS].sort());
    expect(props.verdict).toMatchObject({ type: 'string', enum: ['approve', 'comment', 'request-changes'] });
    expect(start.args.required).toEqual(['action']);
  });

  it('run.stop, run.keep, run.undo : leur description dit no-run', () => {
    for (const name of ['run.stop', 'run.keep', 'run.undo']) {
      expect(table.commands.find((c) => c.name === name)!.description, name).toMatch(/no-run/);
    }
  });

  it('chaque argument est lu par une action ownRun (son gabarit) ou par l\'action elle-même (model, effort)', () => {
    const read = new Set(catalogue('fr').filter(ownRun).flatMap((d) => readArgs(d)));
    for (const key of REQUEST_ARGS) expect(read.has(key as never) || ['model', 'effort'].includes(key), key).toBe(true);
  });

  it('l\'enum de l\'action est celle des actions ownRun du catalogue, en français comme en anglais', () => {
    const ids = (lang: string) => catalogue(lang).filter(ownRun).map((d) => d.id);
    expect(props.action.enum).toEqual(ids('fr'));
    expect(ids('en')).toEqual(ids('fr'));
  });

  it('les types et les bornes suivent ce que gardent parseRequest et buildMessage', () => {
    const type = (k: string) => props[k].type;
    expect(['module', 'pr', 'check'].map(type)).toEqual(['integer', 'integer', 'integer']);
    expect(['text', 'commit', 'file', 'model', 'effort'].map(type)).toEqual(Array(5).fill('string'));
    expect(props.text.maxLength).toBe(20000);
    expect(props.model.enum).toEqual(SKILL_MODELS);
    expect(props.effort.enum).toEqual(EFFORT_LEVELS);
    expect(props.answers).toMatchObject({ type: 'array', maxItems: 50, items: { type: 'string', maxLength: 2000 } });
  });
});

describe('errors', () => {
  const errors = (JSON.parse(text) as { errors?: { code: string; message: string; todo: string }[] }).errors ?? [];

  it('les codes sont ceux d\'ERROR_CODES, ni plus ni moins, dans l\'ordre', () => {
    expect(errors.map((e) => e.code)).toEqual([...ERROR_CODES]);
  });

  it('chaque code a un message et un todo non vides', () => {
    for (const e of errors) {
      expect(e.message?.trim(), `${e.code} message`).toBeTruthy();
      expect(e.todo?.trim(), `${e.code} todo`).toBeTruthy();
    }
  });
});

describe('les pattern de ref', () => {
  it('chacun accepte et refuse comme okRef', () => {
    const patterns = table.commands.flatMap((c) => nodes(c.args, c.name)).filter(([, s]) => s.pattern).map(([, s]) => s.pattern!);
    expect(patterns).toHaveLength(6);
    for (const p of patterns) {
      for (const ref of ['main', 'feat/a.b-c', '-x', 'a..b', 'a b', '']) expect(new RegExp(p, 'u').test(ref), `${p} ${ref}`).toBe(okRef(ref));
    }
  });
});

describe('les actions directes', () => {
  it('une commande par action DIRECT_ONLY et par chacune des 9 autres, nommée de son id', () => {
    for (const id of [...DIRECT_ONLY, ...OTHERS]) expect(names.filter((n) => n === id), id).toHaveLength(1);
    expect(table.commands.filter((c) => [...DIRECT_ONLY, ...OTHERS].includes(c.name)).every((c) => c.kind === 'write' && c.agent)).toBe(true);
  });

  it('chaque id est une action du catalogue', () => {
    const ids = catalogue('fr').map((d) => d.id);
    for (const id of [...DIRECT_ONLY, ...OTHERS]) expect(ids).toContain(id);
  });
});
