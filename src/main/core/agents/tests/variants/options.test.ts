// Variants de la consigne d'outils (note 0.15.0, « Une consigne d'outils commune à toutes les courses ») :
// TOOL_RULE, la même pour toutes les courses ; systemAppend la met après la consigne de l'appli quand la
// session a des droits (une course), jamais pour la conversation ; queryOptions la passe en systemPrompt.append.
import { describe, expect, it } from 'vitest';
import { launchKey, queryOptions, rightsOptions, systemAppend, TOOL_RULE, type AgentConfig, type RunRights } from 'core/agents';

const agent: AgentConfig = { id: 'a1', name: 'alpha', dir: '/tmp/p', mode: 'default', model: '', effort: '', sessionId: null };
const rights: RunRights = { allow: ['Read'], deny: [], check: () => ({ allow: true }) };
const claude = { executable: 'claude' };

describe('TOOL_RULE', () => {
  it('nomme Bash, Read, Glob et Grep', () => {
    for (const tool of ['Bash', 'Read', 'Glob', 'Grep']) expect(TOOL_RULE).toContain(tool);
  });

  it('une consigne courte : non vide, quelques lignes', () => {
    expect(TOOL_RULE.trim()).not.toBe('');
    expect(TOOL_RULE.split('\n').length).toBeLessThanOrEqual(8);
  });

  it('plus d’« un appel par commande » ni de liste à recopier', () => {
    expect(TOOL_RULE).not.toMatch(/One Bash call per command/i);
    expect(TOOL_RULE).not.toMatch(/allowed list/i);
  });

  it('lire par Read plutôt que par Bash ; une commande refusée se contourne ou se signale, sans la répéter', () => {
    expect(TOOL_RULE).toMatch(/Read.*rather than.*Bash/is);
    expect(TOOL_RULE).toMatch(/denied/i);
    expect(TOOL_RULE).toMatch(/work around/i);
    expect(TOOL_RULE).toMatch(/report/i);
    expect(TOOL_RULE).toMatch(/not retry|never retry|don't retry/i);
  });
});

describe('rightsOptions', () => {
  it('dontAsk, allowedTools = rights.allow, disallowedTools = rights.deny', () => {
    const o = rightsOptions({ allow: ['Read', 'Bash'], deny: ['Bash(git push *)'], check: () => ({ allow: true }) });
    expect(o).toMatchObject({ permissionMode: 'dontAsk', allowedTools: ['Read', 'Bash'], disallowedTools: ['Bash(git push *)'] });
  });

  it('queryOptions : les refus passent par-dessus le mode de l’agent', () => {
    const o = queryOptions({ ...agent, mode: 'auto' }, claude, '', { rights: { ...rights, deny: ['Bash(sudo *)'] } });
    expect(o).toMatchObject({ permissionMode: 'dontAsk', disallowedTools: ['Bash(sudo *)'] });
  });

  it('la conversation : aucun disallowedTools', () => {
    expect(queryOptions(agent, claude, '')).not.toHaveProperty('disallowedTools');
  });
});

describe('launchKey', () => {
  const key = (deny?: string[]) => launchKey(agent, '', '', deny && { rights: { ...rights, deny } });

  it('deux courses aux refus différents : deux clés ; mêmes refus : même clé', () => {
    expect(key(['Bash(git push *)'])).toBe(key(['Bash(git push *)']));
    expect(key(['Bash(git push *)'])).not.toBe(key(['Bash(git push *)', 'Bash(sudo *)']));
    expect(key([])).not.toBe(key());
  });
});

describe('systemAppend', () => {
  it('avec des droits : la consigne de l’appli, une ligne vide, puis TOOL_RULE', () => {
    expect(systemAppend('CONSIGNE', rights)).toBe(`CONSIGNE\n\n${TOOL_RULE}`);
  });

  it('sans droits (la conversation) : les instructions seules, sans TOOL_RULE', () => {
    expect(systemAppend('CONSIGNE')).toBe('CONSIGNE');
    expect(systemAppend('CONSIGNE')).not.toContain(TOOL_RULE);
  });

  it('avec des droits et sans consigne : TOOL_RULE seule, sans ligne vide en tête', () => {
    expect(systemAppend('', rights)).toBe(TOOL_RULE);
  });

  it('sans droits et sans consigne : vide', () => {
    expect(systemAppend('')).toBe('');
  });
});

describe('queryOptions : systemPrompt.append', () => {
  it('une course : la consigne de l’appli puis TOOL_RULE', () => {
    expect(queryOptions(agent, claude, 'CONSIGNE', { rights }).systemPrompt).toEqual({ type: 'preset', preset: 'claude_code', append: `CONSIGNE\n\n${TOOL_RULE}` });
  });

  it('la conversation : la consigne seule', () => {
    expect(queryOptions(agent, claude, 'CONSIGNE').systemPrompt).toEqual({ type: 'preset', preset: 'claude_code', append: 'CONSIGNE' });
  });

  it('la conversation sans consigne : append absent', () => {
    expect(queryOptions(agent, claude, '').systemPrompt).toEqual({ type: 'preset', preset: 'claude_code' });
  });

  it('une course sans consigne : TOOL_RULE seule', () => {
    expect(queryOptions(agent, claude, '', { rights }).systemPrompt).toEqual({ type: 'preset', preset: 'claude_code', append: TOOL_RULE });
  });
});
