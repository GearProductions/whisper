import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { commandRules, listSkill, projectCommands, runRules, skillTools, vibeCliCall } from 'core/vibecoder';

const dirs = { skill: '/p/skills/forme', out: '/o/out' };
const skillMd = (field: string) => `---\nname: forme\n${field}\n---\n\nCorps\n`;
const repoAgents = fs.readFileSync(path.join(__dirname, '../../../../../../AGENTS.md'), 'utf8');

describe('listSkill', () => {
  it('le skill du gabarit, variante comprise', () => {
    expect(listSkill('forme', '/vibecoder:forme fr {{note}}')).toBe('forme');
    expect(listSkill('verifier', '/vibecoder:verifier--haiku {{note}}')).toBe('verifier--haiku');
  });
  it('answers : note', () => {
    expect(listSkill('answers', '{{texte}}')).toBe('note');
  });
  it('un texte sans skill : null', () => {
    expect(listSkill('x', 'Fais ceci')).toBeNull();
    expect(listSkill('x', 'dis /vibecoder:forme')).toBeNull();
  });
});

describe('skillTools', () => {
  it('une règle par entrée', () => {
    expect(skillTools(skillMd('allowed-tools: Read, Bash(git log *), Bash(gh api *)'), dirs)).toEqual(['Read', 'Bash(git log *)', 'Bash(gh api *)']);
  });
  it('une virgule dans des parenthèses reste dans sa règle', () => {
    expect(skillTools(skillMd('allowed-tools: Bash(echo a, b), Read'), dirs)).toEqual(['Bash(echo a, b)', 'Read']);
  });
  it('${CLAUDE_SKILL_DIR} et ${VIBECODER_OUT} remplacés', () => {
    expect(skillTools(skillMd('allowed-tools: "Bash(node ${CLAUDE_SKILL_DIR}/x.mjs *), Write(${VIBECODER_OUT}/*)"'), dirs))
      .toEqual(['Bash(node /p/skills/forme/x.mjs *)', 'Write(/o/out/*)']);
  });
  it('sans allowed-tools, SKILL.md absent ou vide : []', () => {
    expect(skillTools(skillMd(''), dirs)).toEqual([]);
    expect(skillTools(null, dirs)).toEqual([]);
    expect(skillTools('', dirs)).toEqual([]);
    expect(skillTools(skillMd('allowed-tools:'), dirs)).toEqual([]);
  });
  it('espaces et entrées vides ignorés, fins de ligne CRLF comprises', () => {
    expect(skillTools('---\r\nallowed-tools:  Read ,, Grep, \r\n---\r\n', dirs)).toEqual(['Read', 'Grep']);
  });
});

describe('projectCommands', () => {
  it('l’AGENTS.md de ce dépôt : tests, typage, jokers ; ni npm start ni dist', () => {
    const c = projectCommands(repoAgents);
    expect(c).toEqual(expect.arrayContaining(['npm run typecheck', 'npm test', 'npm run test:invariants', 'npm run test:front-diff -- *', 'npm run test:main-diff -- *']));
    expect(c).not.toContain('npm start');
    expect(c).not.toContain('npm run dist:linux');
    expect(c).not.toContain('npm run dist:win');
    expect(new Set(c).size).toBe(c.length);
  });
  it('plusieurs commandes sur une ligne, dans l’ordre', () => {
    expect(projectCommands('## Commandes\n\n- Tests : `npm test` · typage : `npm run typecheck`\n')).toEqual(['npm test', 'npm run typecheck']);
  });
  it('un bloc de code de la section : une commande par ligne', () => {
    expect(projectCommands('## Commands\n\n```bash\nnpm start\n$ cargo check\ncargo clippy -- -D warnings\nvitest run\n```\n'))
      .toEqual(['cargo check', 'cargo clippy -- -D warnings', 'vitest run']);
  });
  it('les mots : tsc, lint, vitest ; pas un bout de mot', () => {
    expect(projectCommands('## Commandes\n`tsc --noEmit` `npm run lint` `npm run build` `npm run latest` `npx eslint .`\n')).toEqual(['tsc --noEmit', 'npm run lint']);
  });
  it('sans doublon', () => {
    expect(projectCommands('## Commandes\n`npm test` `npm test`\n')).toEqual(['npm test']);
  });
  it('une ligne de code hors de la section : ignorée ; la section s’arrête au titre suivant de même rang ou plus haut', () => {
    expect(projectCommands('`npm run lint`\n## Commandes\n`npm test`\n### Détail\n`npm run typecheck`\n## Autre\n`vitest`\n')).toEqual(['npm test', 'npm run typecheck']);
  });
  it('pas de section, AGENTS.md absent ou vide : []', () => {
    expect(projectCommands('# A\n`npm test`\n')).toEqual([]);
    expect(projectCommands(null)).toEqual([]);
    expect(projectCommands('')).toEqual([]);
  });
});

describe('commandRules', () => {
  it('avec préfixe : les deux règles préfixées seulement', () => {
    expect(commandRules(['npm test'], 'distrobox enter dev --')).toEqual(['Bash(distrobox enter dev -- npm test)', 'Bash(distrobox enter dev -- npm test *)']);
  });
  it('préfixe vide : sans préfixe', () => {
    expect(commandRules(['npm test'], '')).toEqual(['Bash(npm test)', 'Bash(npm test *)']);
  });
  it('aucune commande : []', () => {
    expect(commandRules([], 'x')).toEqual([]);
  });
});

describe('runRules', () => {
  const agentsMd = '## Commandes\n`npm test` `npm run typecheck`\n';
  it('la liste du skill puis les commandes, sans doublon', () => {
    const rules = runRules({ skillMd: skillMd('allowed-tools: Read, Bash(P npm test), Read'), skillDir: dirs.skill, out: dirs.out, agentsMd, prefix: 'P' });
    expect(rules).toEqual(['Read', 'Bash(P npm test)', 'Bash(P npm test *)', 'Bash(P npm run typecheck)', 'Bash(P npm run typecheck *)']);
  });
  it('une variante de modèle : aussi la règle du dossier du skill de base, dont l\'agent lit le texte', () => {
    const md = skillMd('allowed-tools: "Bash(node ${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs run start ponytail)"');
    const rule = (d: string) => `Bash(node ${d}/../../bin/vibecoder.mjs run start ponytail)`;
    const of = (skillDir: string) => runRules({ skillMd: md, skillDir, out: '/o', agentsMd: null, prefix: '' });
    expect(of('/p/skills/verifier--haiku')).toEqual([rule('/p/skills/verifier--haiku'), rule('/p/skills/verifier')]);
    expect(of('/p/skills/verifier--opus--high')).toEqual([rule('/p/skills/verifier--opus--high'), rule('/p/skills/verifier')]);
    expect(of('/p/skills/verifier')).toEqual([rule('/p/skills/verifier')]);
  });
  it('sans skill ni AGENTS.md : []', () => {
    expect(runRules({ skillMd: null, skillDir: '/s', out: '/o', agentsMd: null, prefix: 'P' })).toEqual([]);
  });
});

describe('vibeCliCall', () => {
  const plugin = '/home/u/.config/app/vibecoder/plugin';
  const call = (command: unknown, tool = 'Bash') => vibeCliCall(tool, { command }, plugin);
  it('node + la CLI du plugin, avec ou sans guillemets, chemin non normalisé (le dossier d’un skill) compris', () => {
    expect(call(`node ${plugin}/bin/vibecoder.mjs status`)).toBe(true);
    expect(call(`node "${plugin}/bin/vibecoder.mjs" run start ponytail`)).toBe(true);
    expect(call(`node "${plugin}/skills/vibe/../../bin/vibecoder.mjs" run list`)).toBe(true);
    expect(call(`node "${plugin}/skills/verifier--haiku/../verifier/../../bin/vibecoder.mjs" run start ponytail`)).toBe(true);
    expect(call(`node "${plugin}/bin/vibecoder.mjs"`)).toBe(true);
  });
  it('des arguments entre guillemets, un point-virgule ou un saut de ligne dedans compris', () => {
    expect(call(`node "${plugin}/bin/vibecoder.mjs" run start apply --text "- a.ts:L3 ; b\nc"`)).toBe(true);
    expect(call(`node "${plugin}/bin/vibecoder.mjs" run start apply --text '- a $x | b'`)).toBe(true);
  });
  it('une autre commande, un autre script, une autre sorte d’appel : non', () => {
    expect(call('npm test')).toBe(false);
    expect(call(`node ${plugin}/bin/autre.mjs status`)).toBe(false);
    expect(call(`node /etc/vibecoder.mjs status`)).toBe(false);
    expect(call(`node ${plugin}/../evil/bin/vibecoder.mjs status`)).toBe(false);
    expect(call(`node -e "1" ${plugin}/bin/vibecoder.mjs`)).toBe(false);
    expect(call(`nodejs ${plugin}/bin/vibecoder.mjs status`)).toBe(false);
    expect(call(`node ${plugin}/bin/vibecoder.mjs status`, 'Read')).toBe(false);
    expect(vibeCliCall('Bash', { command: 42 }, plugin)).toBe(false);
    expect(vibeCliCall('Bash', null, plugin)).toBe(false);
  });
  it('une composition ou une redirection : non', () => {
    const cli = `node ${plugin}/bin/vibecoder.mjs status`;
    for (const tail of [' ; rm -rf x', ' && ls', ' || ls', ' | cat', ' > f', ' < f', ' >> f', ' & ', ' $(id)', ' `id`', ' "$HOME"', '\nrm x', ' (ls)', ' 2>&1']) {
      expect(call(cli + tail)).toBe(false);
    }
    expect(call(`ls; ${cli}`)).toBe(false);
    expect(call(`cd /tmp && ${cli}`)).toBe(false);
  });
});
