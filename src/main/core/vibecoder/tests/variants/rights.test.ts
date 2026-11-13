import { describe, expect, it } from 'vitest';
import { DENIED, denyRules, listSkill, NEVER, runRules, skillOpens, skillTools, vibeCliCall } from 'core/vibecoder';

const dirs = { skill: '/p/skills/forme', out: '/o/out' };
const skillMd = (field: string) => `---\nname: forme\n${field}\n---\n\nCorps\n`;
const bash = (...cmds: string[]) => cmds.map((c) => `Bash(${c})`);

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

describe('skillOpens', () => {
  const denied = ['git push', 'git rebase', 'git checkout', 'git branch -D', 'gh', 'node *vibecoder.mjs*'];

  it('git push --force-with-lease -u origin HEAD ouvre git push', () => {
    expect(skillOpens(bash('git push --force-with-lease -u origin HEAD'), denied)).toEqual(['git push']);
  });
  it('gh pr view * ouvre gh', () => {
    expect(skillOpens(bash('gh pr view *'), denied)).toEqual(['gh']);
  });
  it('GIT_SEQUENCE_EDITOR=true git rebase * ouvre git rebase (assignations de tête ôtées)', () => {
    expect(skillOpens(bash('GIT_SEQUENCE_EDITOR=true git rebase *'), denied)).toEqual(['git rebase']);
    expect(skillOpens(bash('A=1 B="x y" C=\'z\' git rebase *'), denied)).toEqual(['git rebase']);
  });
  it('la CLI entre guillemets, par skills/verifier/../../bin, ouvre la CLI', () => {
    expect(skillOpens(bash('node "/p/skills/verifier/../../bin/vibecoder.mjs" run start ponytail'), denied)).toEqual(['node *vibecoder.mjs*']);
    expect(skillOpens(bash('node "/p/skills/vibe/../../bin/vibecoder.mjs" *'), denied)).toEqual(['node *vibecoder.mjs*']);
  });

  it('git branch * n’ouvre pas git branch -D', () => {
    expect(skillOpens(bash('git branch *'), denied)).toEqual([]);
  });
  it('git checkout-index … n’ouvre pas git checkout (frontière de mot)', () => {
    expect(skillOpens(bash('git checkout-index -a'), denied)).toEqual([]);
    expect(skillOpens(bash('git pushx'), denied)).toEqual([]);
  });
  it('Read, Write : rien', () => {
    expect(skillOpens(['Read', 'Write', 'Write(/o/**)', 'Bash'], denied)).toEqual([]);
  });

  it('une règle plus courte que la commande refusée ne l’ouvre pas', () => {
    expect(skillOpens(bash('git *'), denied)).toEqual([]);
    expect(skillOpens(bash('git'), denied)).toEqual([]);
  });
  it('le suffixe :* vaut ` *`', () => {
    expect(skillOpens(bash('git push:*'), denied)).toEqual(['git push']);
  });
  it('dans l’ordre de denied, sans doublon', () => {
    const tools = bash('git rebase *', 'git push *', 'git push -u origin HEAD');
    expect(skillOpens(tools, denied)).toEqual(['git push', 'git rebase']);
    expect(skillOpens(tools, ['git push', 'git push', 'git rebase'])).toEqual(['git push', 'git rebase']);
  });
  it('NEVER n’est jamais ouvert : gh repo view * n’ouvre pas gh repo', () => {
    expect(skillOpens(bash('gh repo view *', 'gh pr merge 1', 'gh release create'), DENIED)).toEqual([]);
  });
  it('aucune règle ou aucun refus : rien', () => {
    expect(skillOpens([], denied)).toEqual([]);
    expect(skillOpens(bash('git push *'), [])).toEqual([]);
  });
});

describe('denyRules', () => {
  it('avec préfixe : la commande seule puis derrière le préfixe', () => {
    expect(denyRules(['curl'], 'distrobox enter dev --')).toEqual(['Bash(curl *)', 'Bash(distrobox enter dev -- curl *)']);
  });
  it('préfixe vide : la première seule', () => {
    expect(denyRules(['curl'], '')).toEqual(['Bash(curl *)']);
  });
  it('une commande git : aussi derrière ses options globales -C et -c (Claude Code ne les ôte pas), préfixe compris', () => {
    expect(denyRules(['git push'], 'P')).toEqual([
      'Bash(git push *)', 'Bash(P git push *)',
      'Bash(git -C * push *)', 'Bash(P git -C * push *)',
      'Bash(git -c * push *)', 'Bash(P git -c * push *)',
    ]);
    expect(denyRules(['git reset * --hard'], '')).toEqual(['Bash(git reset * --hard *)', 'Bash(git -C * reset * --hard *)', 'Bash(git -c * reset * --hard *)']);
  });
  it('plusieurs commandes : dans l’ordre, deux règles chacune', () => {
    expect(denyRules(['a', 'b'], 'P')).toEqual(['Bash(a *)', 'Bash(P a *)', 'Bash(b *)', 'Bash(P b *)']);
  });
  it('aucune commande : []', () => {
    expect(denyRules([], 'P')).toEqual([]);
  });
});

describe('runRules', () => {
  const md = (tools: string) => skillMd(`allowed-tools: "${tools}"`);
  const of = (tools: string | null, prefix = '') => runRules({ skillMd: tools === null ? null : md(tools), skillDir: dirs.skill, out: dirs.out, prefix });
  const PR = 'Read, Glob, Grep, Write, Bash(git push -u origin HEAD), Bash(git push --force-with-lease -u origin HEAD), Bash(gh pr view *), Bash(gh pr create *), Bash(gh repo view *), Bash(git branch *)';

  it('skill pr : allow Read, Glob, Grep, Write, Bash ; deny sans git push ni les gh qu’il ouvre, avec git commit et rm -rf', () => {
    const { allow, deny } = of(PR, 'P');
    expect(allow).toEqual(['Read', 'Glob', 'Grep', 'Write', 'Bash']);
    expect(deny).not.toContain('Bash(git push *)');
    expect(deny).not.toContain('Bash(gh pr create *)');
    expect(deny).toContain('Bash(git commit *)');
    expect(deny).toContain('Bash(P git commit *)');
    expect(deny).toContain('Bash(rm -rf *)');
    // ce qu'aucun skill ne rouvre, ni gh pr checkout que celui-ci n'ouvre pas
    for (const c of [...NEVER, 'gh pr checkout', 'git branch -D']) expect(deny).toContain(`Bash(${c} *)`);
  });
  it('les graphies ordinaires des commandes qui détruisent ou écrivent : rm -fr, rm -Rf, rm -r -f, git reset -q --hard, git -C x push', () => {
    const { deny } = of(null);
    for (const c of ['rm -fr', 'rm -Rf', 'rm -r -f', 'git reset * --hard', 'git -C * push', 'git -c * commit']) expect(deny).toContain(`Bash(${c} *)`);
  });
  it('skill note : allow sans Bash(…), rien d’ouvert', () => {
    const { allow, deny } = of('Read, Glob, Grep, Write(/o/out/**), Edit');
    expect(allow).toEqual(['Read', 'Glob', 'Grep', 'Write(/o/out/**)', 'Edit', 'Bash']);
    expect(deny).toEqual(denyRules(DENIED, ''));
  });
  it('sans SKILL.md : allow [Bash], deny tout DENIED', () => {
    expect(of(null, 'P')).toEqual({ allow: ['Bash'], deny: denyRules(DENIED, 'P') });
  });
  it('allow sans doublon, Bash d’un skill compris', () => {
    expect(of('Read, Bash, Read').allow).toEqual(['Read', 'Bash']);
  });
  it('la CLI du skill ouverte par un chemin entre guillemets', () => {
    const { deny } = of('Read, Bash(node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" *)');
    expect(deny).not.toContain('Bash(node *vibecoder.mjs* *)');
    expect(deny).toContain('Bash(git push *)');
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
