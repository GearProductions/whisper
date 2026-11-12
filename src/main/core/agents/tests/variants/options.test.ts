// Variants de la consigne d'outils (note 0.15.0, « Une consigne d'outils commune à toutes les courses ») :
// TOOL_RULE, la même pour toutes les courses ; systemAppend la met après la consigne de l'appli quand la
// session a des droits (une course), jamais pour la conversation ; queryOptions la passe en systemPrompt.append.
import { describe, expect, it } from 'vitest';
import { queryOptions, systemAppend, TOOL_RULE, type AgentConfig, type RunRights } from 'core/agents';

const agent: AgentConfig = { id: 'a1', name: 'alpha', dir: '/tmp/p', mode: 'default', model: '', effort: '', sessionId: null };
const rights: RunRights = { allow: ['Read'], check: () => ({ allow: true }) };
const claude = { executable: 'claude' };

describe('TOOL_RULE', () => {
  it('nomme Bash, Read, Glob, Grep et Write', () => {
    for (const tool of ['Bash', 'Read', 'Glob', 'Grep', 'Write']) expect(TOOL_RULE).toContain(tool);
  });

  it('une consigne courte : non vide, quelques lignes', () => {
    expect(TOOL_RULE.trim()).not.toBe('');
    expect(TOOL_RULE.split('\n').length).toBeLessThanOrEqual(8);
  });

  it('interdit cd, enchaînement, redirection et variable ; la liste, écrite comme elle', () => {
    expect(TOOL_RULE).toMatch(/\bcd\b/);
    for (const op of [';', '&&', '||', '|', '>']) expect(TOOL_RULE).toContain(op);
    expect(TOOL_RULE).toMatch(/variable/i);
    expect(TOOL_RULE).toMatch(/list/i);
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
