// Variants des commandes du projet (note 0.8.0, « Lancer le projet ») : le
// fichier lu, la proposition adoptée ou fusionnée (0.11.0), la box de l'agent, la fin d'un journal.
import { describe, expect, it } from 'vitest';
import { agentSidePrefix, boxPrefix, commandAt, commandPrefix, DEFAULT_SHELL, logTail, mergeProject, parseProject, projectSlug, projectText } from 'core/runner';

describe('le fichier du projet', () => {
  it('ses commandes valides, dans l’ordre ; le shell par défaut : bash -ic', () => {
    const p = parseProject(JSON.stringify({ commands: [
      { name: 'serveur', run: 'npm run dev' },
      { name: 'serveur', run: 'doublon' },
      { name: '../x', run: 'nom en chemin' },
      { name: 'vide', run: '  ' },
      { name: 'front', run: 'gear front', cwd: 'web' },
      'pas un objet',
    ] }));
    expect(p).toEqual({ commands: [{ name: 'serveur', run: 'npm run dev' }, { name: 'front', run: 'gear front', cwd: 'web' }], shell: DEFAULT_SHELL });
  });

  it('un autre shell, s’il est une liste de mots', () => {
    expect(parseProject('{"commands":[],"shell":["zsh","-ic"]}')?.shell).toEqual(['zsh', '-ic']);
    expect(parseProject('{"commands":[],"shell":"zsh -ic"}')?.shell).toEqual(DEFAULT_SHELL);
  });

  it('illisible, ou sans liste de commandes : null', () => {
    expect(parseProject(null)).toBeNull();
    expect(parseProject('{ pas du json')).toBeNull();
    expect(parseProject('{"commands":{}}')).toBeNull();
    expect(parseProject('[]')).toBeNull();
  });

  it('une proposition : le texte du fichier, sans ce qui ne va pas ; sans commande valide, rien', () => {
    expect(projectText('{"commands":[{"name":"dev","run":"npm run dev","extra":1}]}'))
      .toBe('{\n  "commands": [\n    {\n      "name": "dev",\n      "run": "npm run dev"\n    }\n  ]\n}\n');
    expect(projectText('{"commands":[]}')).toBeNull();
    expect(projectText('du texte')).toBeNull();
  });
});

describe('le nom d’une commande (0.11.0)', () => {
  it('des espaces au milieu, pas aux bords ; jamais / ni ..', () => {
    const names = (n: string[]) => parseProject(JSON.stringify({ commands: n.map((name) => ({ name, run: 'x' })) }))?.commands.map((c) => c.name);
    expect(names(['install deps', 'a b.c-d_e', ' x', 'y ', 'a/b', '..', 'a\tb'])).toEqual(['install deps', 'a b.c-d_e']);
  });
});

describe('une proposition, le fichier existant (0.11.0)', () => {
  const current = '{"commands":[{"name":"dev","run":"mon dev","cwd":"web"},{"name":"x","bad":1}],"prefix":"","mien":true}';

  it('seules les commandes de nom nouveau, à la fin ; le reste du fichier tel quel', () => {
    const merged = mergeProject(current, JSON.stringify({ commands: [
      { name: 'dev', run: 'npm run dev' }, { name: 'x', run: 'ok' }, { name: 'test', run: 'npm test' }, { name: '../y', run: 'z' },
    ], shell: ['zsh', '-c'], prefix: 'sudo' }));
    expect(JSON.parse(merged!)).toEqual({ commands: [
      { name: 'dev', run: 'mon dev', cwd: 'web' }, { name: 'x', bad: 1 }, { name: 'test', run: 'npm test' },
    ], prefix: '', mien: true });
  });

  it('rien de nouveau, ou un fichier illisible : null', () => {
    expect(mergeProject(current, '{"commands":[{"name":"dev","run":"autre"}]}')).toBeNull();
    expect(mergeProject(current, 'pas du json')).toBeNull();
    expect(mergeProject('{ cassé', '{"commands":[{"name":"t","run":"t"}]}')).toBeNull();
    expect(mergeProject('{"commands":{}}', '{"commands":[{"name":"t","run":"t"}]}')).toBeNull();
  });
});

describe('la box de l’agent', () => {
  it('distrobox enter <box> -- … : la commande y passe', () => {
    expect(boxPrefix('distrobox enter dev -- mise exec -- claude')).toEqual(['distrobox', 'enter', 'dev', '--']);
    expect(boxPrefix('/usr/bin/distrobox enter --name dev -- claude')).toEqual(['/usr/bin/distrobox', 'enter', '--name', 'dev', '--']);
    const p = parseProject('{"commands":[{"name":"g","run":"gear"}]}');
    expect(commandAt(p, 0, 'distrobox enter dev -- claude')?.argv).toEqual(['distrobox', 'enter', 'dev', '--', 'bash', '-ic', 'gear']);
  });

  it('une autre commande, ou aucune : sans box', () => {
    expect(boxPrefix('')).toEqual([]);
    expect(boxPrefix('claude')).toEqual([]);
    expect(boxPrefix('toolbox enter dev -- claude')).toEqual([]);
    expect(boxPrefix('distrobox enter dev')).toEqual([]);
  });
});

describe('le préfixe des commandes (processus, gh)', () => {
  const box = 'distrobox enter dev -- mise exec -- claude';
  it('par défaut : la box de la commande de l’agent', () => {
    expect(commandPrefix(null, '', box)).toEqual(['distrobox', 'enter', 'dev', '--']);
  });

  it('le réglage vibeCommandPrefix l’emporte', () => {
    expect(commandPrefix(null, 'toolbox run -c dev', box)).toEqual(['toolbox', 'run', '-c', 'dev']);
  });

  it('le fichier du projet l’emporte sur tout ; « "" » : aucun préfixe', () => {
    expect(commandPrefix(parseProject('{"commands":[],"prefix":"podman exec dev"}'), 'toolbox run', box)).toEqual(['podman', 'exec', 'dev']);
    expect(commandPrefix(parseProject('{"commands":[],"prefix":""}'), 'toolbox run', box)).toEqual([]);
    const p = parseProject('{"commands":[{"name":"g","run":"gear"}],"prefix":"podman exec dev"}');
    expect(commandAt(p, 0, box)?.argv).toEqual(['podman', 'exec', 'dev', 'bash', '-ic', 'gear']);
  });

  it('vu de l’agent : sans la box où il tourne déjà', () => {
    expect(agentSidePrefix(null, '', box)).toEqual([]);
    expect(agentSidePrefix(parseProject('{"commands":[],"prefix":"distrobox enter dev -- mise exec --"}'), '', box)).toEqual(['mise', 'exec', '--']);
    expect(agentSidePrefix(null, 'distrobox enter autre --', box)).toEqual(['distrobox', 'enter', 'autre', '--']);
    expect(agentSidePrefix(null, 'toolbox run -c dev', 'claude')).toEqual(['toolbox', 'run', '-c', 'dev']);
    expect(agentSidePrefix(parseProject('{"commands":[],"prefix":""}'), '', box)).toEqual([]);
  });

  it('une proposition ne pose pas de préfixe', () => {
    expect(projectText('{"commands":[{"name":"g","run":"gear"}],"prefix":"sh -c x"}')).not.toContain('prefix');
  });
});

describe('la fin d’un journal', () => {
  it('les dernières lignes, sans couleurs, une barre de progression à son dernier état', () => {
    expect(logTail('a\nb\n\x1b[32mvert\x1b[0m\n10%\r50%\r100%\n', 3)).toBe('b\nvert\n100%');
  });

  it('un journal vide : rien', () => {
    expect(logTail('', 5)).toBe('');
  });
});

it('le nom du fichier du projet : le chemin du dossier, en lettres sûres', () => {
  expect(projectSlug('/var/home/u/dev/Gear/Projets/gt-plugins')).toBe('var-home-u-dev-Gear-Projets-gt-plugins');
  expect(projectSlug('C:\\Users\\u\\projet x')).toBe('C-Users-u-projet-x');
});

describe('la recette du fichier du projet (0.12.0)', () => {
  it('setup et worktree valides ; une valeur mal formée : comme absente ; prWorktree, featureWorktree (F-111) : ignorés', () => {
    expect(parseProject(JSON.stringify({ commands: [], setup: ['yarn'], worktree: { create: 'c', dir: '../w/{branch}', x: 1 }, prWorktree: 'here', featureWorktree: 'worktree' })))
      .toEqual({ commands: [], shell: DEFAULT_SHELL, setup: ['yarn'], worktree: { create: 'c', dir: '../w/{branch}' } });
    expect(parseProject(JSON.stringify({ commands: [], setup: ['yarn', ''], worktree: { create: 1 }, prWorktree: 'oui', featureWorktree: null })))
      .toEqual({ commands: [], shell: DEFAULT_SHELL });
    expect(parseProject(JSON.stringify({ commands: [], setup: 'yarn' }))?.setup).toBeUndefined();
  });

  it('une proposition sans commande mais avec un setup : adoptée, sans prWorktree ni featureWorktree', () => {
    const text = projectText(JSON.stringify({ commands: [], setup: ['yarn'], prWorktree: 'here', featureWorktree: 'ask' }));
    expect(JSON.parse(text!)).toEqual({ commands: [], setup: ['yarn'] });
  });

  it('fusion : setup et worktree seulement si le fichier n’a pas la clé, même mal formée', () => {
    const proposal = JSON.stringify({ commands: [], setup: ['yarn'], worktree: { remove: 'r' } });
    expect(JSON.parse(mergeProject('{"commands":[]}', proposal)!)).toEqual({ commands: [], setup: ['yarn'], worktree: { remove: 'r' } });
    expect(mergeProject('{"commands":[],"setup":"cassé","worktree":{}}', proposal)).toBeNull();
    expect(mergeProject('{"commands":[]}', '{"commands":[],"prWorktree":"here"}')).toBeNull();
  });
});
