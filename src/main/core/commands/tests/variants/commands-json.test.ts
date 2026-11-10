// Variantes de la vraie table (resources/vibecoder/commands.json) : elle passe parseCommands, run.start garde
// exactement les arguments de parseRequest, chacun lu par une action, une commande par action directe.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, parseCommands, schemaError, type JsonSchema } from 'core/commands';
import { okRef } from 'helpers';
import { ADD_FILE_MAX, DIRECT_ONLY, EFFORT_LEVELS, SKILL_MODELS, ownRun, parseActions, readArgs, REQUEST_ARGS } from 'core/vibecoder';

const RES = path.resolve(__dirname, '../../../../../../resources/vibecoder');
const text = fs.readFileSync(path.join(RES, 'commands.json'), 'utf8');
const table = parseCommands(text);
const names = table.commands.map((c) => c.name);
const catalogue = (lang: string) => parseActions(JSON.parse(fs.readFileSync(path.join(RES, `actions.${lang}.json`), 'utf8')));
const start = table.commands.find((c) => c.name === 'run.start')!;
const OTHERS = ['load-pr', 'pr-here', 'pr-worktree', 'vibe', 'guide', 'new-request', 'propose-run'];
const get = (name: string) => table.commands.find((c) => c.name === name)!;
const argsOf = (name: string) => get(name).args.properties ?? {};

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
    expect(table.commands.filter((c) => c.kind === 'read').map((c) => c.name)).toEqual(['status', 'next', 'actions', 'runs', 'run.wait', 'procs', 'logs', 'artifacts', 'artifact', 'draft']);
    expect(Object.keys(table.commands.find((c) => c.name === 'logs')!.args.properties!)).toEqual(['name']);
  });

  it('proc.start, proc.stop et proc.restart disent que seuls les noms des commandes du projet comptent', () => {
    for (const name of ['proc.start', 'proc.stop', 'proc.restart']) {
      const c = table.commands.find((x) => x.name === name)!;
      expect(c.args.properties!.name.description).toMatch(/only the names of the project's commands count/);
    }
  });
});

describe('run.start', () => {
  const props = start.args.properties!;

  it('garde exactement les arguments de parseRequest (verdict compris), plus action et pieces ; verdict : l\'enum des trois', () => {
    expect(Object.keys(props).filter((k) => !['action', 'pieces'].includes(k)).sort()).toEqual([...REQUEST_ARGS].sort());
    expect(props.pieces).toBeDefined();
    expect(props.verdict).toMatchObject({ type: 'string', enum: ['approve', 'comment', 'request-changes'] });
    expect(start.args.required).toEqual(['action']);
  });

  it('run.stop, run.keep, run.undo : leur description dit no-run', () => {
    for (const name of ['run.stop', 'run.keep', 'run.undo']) {
      expect(table.commands.find((c) => c.name === name)!.description, name).toMatch(/no-run/);
    }
  });

  it('run.start dit la réponse en attente ; runs, l\'état queued', () => {
    expect(start.description).toMatch(/queued: true/);
    expect(start.description).toMatch(/\bby\b/);
    const runs = get('runs');
    expect(runs.description).toMatch(/queued/);
    expect(runs.response!.items!.properties!.state.enum).toContain('queued');
    expect(runs.response!.items!.properties!.by).toBeDefined();
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

describe('run.wait', () => {
  const wait = get('run.wait');

  it('une lecture ouverte aux agents, l\'action en argument, la course en réponse', () => {
    expect([wait.kind, wait.agent, wait.args.required]).toEqual(['read', true, ['action']]);
    expect(Object.keys(argsOf('run.wait'))).toEqual(['action']);
    expect(wait.description).toMatch(/connection/);
    expect(wait.description).toMatch(/no-run/);
    expect(Object.keys(wait.response!.properties!)).toEqual(['action', 'state', 'reply']);
    expect(wait.response!.properties!.state.enum).toEqual(['done', 'failed', 'stopped']);
    expect(schemaError(wait.response!, { action: 'forme', state: 'done', reply: 'ok' })).toBeNull();
  });
});

describe('les pièces jointes du champ', () => {
  it('pieces dans run.start, guide, new-request, propose-run, et dans aucune autre', () => {
    expect(table.commands.filter((c) => c.args.properties?.pieces).map((c) => c.name).sort()).toEqual(['guide', 'new-request', 'propose-run', 'run.start']);
  });

  it('pieces : images, files, selection, aux bornes de prepareMessage, rien d\'autre', () => {
    const pieces = argsOf('guide').pieces ?? ({} as JsonSchema);
    expect(pieces).toMatchObject({ type: 'object', additionalProperties: false });
    expect(Object.keys(pieces.properties!)).toEqual(['images', 'files', 'selection']);
    expect(pieces.properties!.images).toMatchObject({ type: 'array', maxItems: 20 });
    expect(Object.keys(pieces.properties!.images.items!.properties!)).toEqual(['name', 'type', 'data']);
    expect(pieces.properties!.files).toMatchObject({ type: 'array', maxItems: 50, items: { type: 'string' } });
    expect(pieces.properties!.selection).toMatchObject({ type: 'string', maxLength: 100000 });
    expect(schemaError(get('guide').args, { pieces: { files: ['/a'], selection: 'x', images: [{ name: 'a.png', type: 'image/png', data: 'AA==' }] } })).toBeNull();
    expect(schemaError(get('guide').args, { pieces: { files: Array(51).fill('/a') } })).toMatch(/at most 50/);
    expect(schemaError(get('guide').args, { pieces: { extra: 1 } })).toMatch(/unknown/);
  });
});

describe('add-artifact', () => {
  const files = argsOf('add-artifact').files ?? ({} as JsonSchema);
  const item = files.items ?? ({} as JsonSchema);

  it('files : des { path } ou des { name, content } en base64, rien d\'autre ; folder reste', () => {
    expect(files).toMatchObject({ type: 'array', maxItems: 1000 });
    expect(Object.keys(item.properties!)).toEqual(['path', 'name', 'content']);
    expect(item.additionalProperties).toBe(false);
    expect(item.properties!.content.maxLength).toBe(Math.ceil(ADD_FILE_MAX / 3) * 4);
    expect(get('add-artifact').args.required).toEqual(['files']);
    expect(Object.keys(argsOf('add-artifact'))).toEqual(['files', 'folder']);
    // ponytail: le schéma n'a pas de anyOf : « path ou name et content » est dit par la description, refusé par droppedFiles
    expect(files.description).toMatch(/path/);
    expect(files.description).toMatch(/name and content/);
  });

  it('un schéma valide accepte l\'une ou l\'autre forme, refuse une clé de trop et un contenu trop long', () => {
    const args = get('add-artifact').args;
    expect(schemaError(args, { files: [{ path: '/a/b' }, { name: 'n.txt', content: 'AA==' }], folder: 'd0' })).toBeNull();
    expect(schemaError(args, {})).toMatch(/files: required/);
    expect(schemaError(args, { files: [{ path: '/a', url: 'x' }] })).toMatch(/unknown/);
    expect(schemaError(args, { files: [{ name: 'n', content: 'A'.repeat(item.properties!.content.maxLength! + 1) }] })).toMatch(/at most/);
  });
});

describe('les commandes du ticket socket', () => {
  it('proc.start, artifacts, artifact, draft, draft.add, draft.edit, draft.remove : présentes, ouvertes aux agents', () => {
    for (const name of ['proc.start', 'artifacts', 'artifact', 'draft', 'draft.add', 'draft.edit', 'draft.remove']) {
      expect(names.filter((n) => n === name), name).toHaveLength(1);
      expect(get(name).agent, name).toBe(true);
    }
    expect(['proc.start', 'draft.add', 'draft.edit', 'draft.remove'].map((n) => get(n).kind)).toEqual(Array(4).fill('write'));
    expect(Object.keys(argsOf('proc.start'))).toEqual(['name']);
  });

  it('les lectures ont leur réponse, et aucune n\'a d\'argument pr', () => {
    for (const name of ['artifacts', 'artifact', 'draft']) {
      expect(get(name).kind).toBe('read');
      expect(get(name).response, name).toBeDefined();
    }
    for (const c of table.commands.filter((x) => x.kind === 'read')) expect(argsOf(c.name).pr, c.name).toBeUndefined();
    for (const name of ['draft', 'draft.add', 'draft.edit', 'draft.remove']) expect(argsOf(name).pr, name).toBeUndefined();
  });

  it('artifact : un id a<i> ; sa réponse : name, kind, text ou base64, truncated, ou null', () => {
    expect(Object.keys(argsOf('artifact'))).toEqual(['artifact']);
    expect(get('artifact').args.required).toEqual(['artifact']);
    const r = get('artifact').response!;
    expect(r.type).toEqual(['object', 'null']);
    expect(Object.keys(r.properties!)).toEqual(['name', 'kind', 'text', 'base64', 'truncated']);
    expect(r.required).toEqual(['name', 'kind', 'truncated']);
    expect(r.properties!.kind.enum).toEqual(['markdown', 'text', 'page', 'media']);
  });

  it('artifacts : le dossier (son chemin réel), ses fichiers et ses dossiers par id', () => {
    const r = get('artifacts').response!;
    expect(r.required).toEqual(['dir', 'files', 'folders']);
    expect(Object.keys(r.properties!.files.items!.properties!)).toEqual(['id', 'name', 'kind', 'size', 'time']);
    expect(Object.keys(r.properties!.folders.items!.properties!)).toEqual(['id', 'name']);
  });

  it('le brouillon : la PR suivie jamais en argument ; target ≤ 300 sans saut de ligne, text ≤ 5 000', () => {
    for (const name of ['draft', 'draft.add', 'draft.edit', 'draft.remove']) expect(get(name).description, name).toMatch(/followed pull request/);
    expect(Object.keys(argsOf('draft.add'))).toEqual(['target', 'text']);
    expect(Object.keys(argsOf('draft.edit'))).toEqual(['id', 'text']);
    expect(Object.keys(argsOf('draft.remove'))).toEqual(['id']);
    const add = get('draft.add').args;
    expect(add.required).toEqual(['target', 'text']);
    expect(argsOf('draft.add').target.maxLength).toBe(300);
    expect(argsOf('draft.add').text.maxLength).toBe(5000);
    expect(argsOf('draft.edit').text.maxLength).toBe(5000);
    expect(schemaError(add, { target: 'a.ts:3', text: 'x' })).toBeNull();
    expect(schemaError(add, { target: 'a.ts\n3', text: 'x' })).toMatch(/does not match/);
    expect(schemaError(add, { target: 'a'.repeat(301), text: 'x' })).toMatch(/at most 300/);
    expect(schemaError(get('draft.edit').args, { id: 1, text: 'y' })).toBeNull();
    expect(schemaError(get('draft.remove').args, { id: 'x' })).toMatch(/integer/);
    expect(get('draft').response!.required).toEqual(['pr', 'remarks']);
  });

  it('comment et case-ko ont quitté la table : ce sont des gestes de la page', () => {
    expect(names).not.toContain('comment');
    expect(names).not.toContain('case-ko');
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
    // draft.add a son propre pattern (pas de saut de ligne), qui n'est pas celui d'une ref
    const patterns = table.commands.filter((c) => c.name !== 'draft.add').flatMap((c) => nodes(c.args, c.name)).filter(([, s]) => s.pattern).map(([, s]) => s.pattern!);
    expect(patterns).toHaveLength(6);
    for (const p of patterns) {
      for (const ref of ['main', 'feat/a.b-c', '-x', 'a..b', 'a b', '']) expect(new RegExp(p, 'u').test(ref), `${p} ${ref}`).toBe(okRef(ref));
    }
  });
});

describe('les actions directes', () => {
  it('une commande par action DIRECT_ONLY et par chacune des 7 autres, nommée de son id', () => {
    for (const id of [...DIRECT_ONLY, ...OTHERS]) expect(names.filter((n) => n === id), id).toHaveLength(1);
    expect(table.commands.filter((c) => [...DIRECT_ONLY, ...OTHERS].includes(c.name)).every((c) => c.kind === 'write' && c.agent)).toBe(true);
  });

  it('commit, publish, base : leur forme directe est une commande, ouverte aux agents, aux arguments que runDirect lit', () => {
    for (const id of ['commit', 'publish', 'base']) {
      expect(names.filter((n) => n === id), id).toHaveLength(1);
      expect(get(id)).toMatchObject({ kind: 'write', agent: true });
      expect(get(id).description, id).toMatch(/without an agent/);
    }
    expect(argsOf('commit')).toEqual({});
    expect(argsOf('base')).toEqual({});
    expect(argsOf('publish')).toEqual({ verdict: expect.objectContaining({ type: 'string', enum: ['approve', 'comment', 'request-changes'] }) });
    expect(get('publish').args.required).toEqual(['verdict']);
    expect(get('commit').args.additionalProperties).toBe(false);
    expect(schemaError(get('publish').args, { verdict: 'approve' })).toBeNull();
    expect(schemaError(get('publish').args, { verdict: 'ok' })).toBeTruthy();
    expect(schemaError(get('publish').args, {})).toMatch(/verdict: required/);
    expect(schemaError(get('base').args, { x: 1 })).toMatch(/unknown/);
  });

  it('chaque id est une action du catalogue', () => {
    const ids = catalogue('fr').map((d) => d.id);
    for (const id of [...DIRECT_ONLY, ...OTHERS, 'commit', 'publish', 'base']) expect(ids).toContain(id);
  });
});
