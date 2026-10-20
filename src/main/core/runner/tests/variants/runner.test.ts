// Variants des commandes du projet (note 0.8.0, « Lancer le projet ») : le
// fichier lu, la proposition adoptée, la box de l'agent, la fin d'un journal.
import { describe, expect, it } from 'vitest';
import { agentSidePrefix, boxPrefix, commandAt, commandPrefix, DEFAULT_SHELL, logTail, parseProject, projectSlug, projectText } from 'core/runner';

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
