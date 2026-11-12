import { describe, expect, it } from 'vitest';
import { denialOf } from 'core/agents';

const err = { tool_use_id: 'tu1', is_error: true };
const use = (name: string, input: unknown = {}) => ({ name, input });

describe('denialOf', () => {
  it('mode qui ne demande jamais : refus, pas une lecture', () => {
    const text = "Permission to use Bash has been denied because Claude Code is running in don't ask mode.";
    expect(denialOf(err, text, use('Bash', { command: 'rm x' }))).toEqual({ toolUseId: 'tu1', tool: 'Bash', target: 'rm x', read: false });
  });

  it('règle qui refuse une commande : refus', () => {
    expect(denialOf(err, 'Permission to use Bash with command x has been denied.', use('Bash', { command: 'x' }))).toMatchObject({ tool: 'Bash', target: 'x', read: false });
  });

  it('règle de chemin sur Read : refus, lecture', () => {
    const text = '<tool_use_error>File is in a directory that is denied by your permission settings.</tool_use_error>';
    expect(denialOf(err, text, use('Read', { file_path: '/etc/passwd' }))).toEqual({ toolUseId: 'tu1', tool: 'Read', target: '/etc/passwd', read: true });
  });

  it('crochet PreToolUse : refus ; sur Glob, lecture', () => {
    expect(denialOf(err, 'PreToolUse:Write hook error: hors du projet', use('Write', { file_path: '/x' }))).toMatchObject({ tool: 'Write', read: false });
    expect(denialOf(err, 'PreToolUse:Glob hook error: hors du projet', use('Glob', { pattern: '*' }))).toMatchObject({ tool: 'Glob', target: '*', read: true });
  });

  it('une erreur qui n’est pas un refus, un résultat sans is_error : null', () => {
    expect(denialOf(err, '<tool_use_error>Blocked: standalone sleep 25</tool_use_error>', use('Bash'))).toBeNull();
    expect(denialOf(err, 'Exit code 1\nnpm ERR!', use('Bash'))).toBeNull();
    expect(denialOf({ tool_use_id: 'tu1' }, 'Permission to use Bash has been denied.', use('Bash'))).toBeNull();
    expect(denialOf({ tool_use_id: 'tu1', is_error: false }, 'Permission to use Bash has been denied.', use('Bash'))).toBeNull();
  });

  it('le texte cité plus loin, pas en tête : null', () => {
    expect(denialOf(err, 'Exit 1: Permission to use Bash has been denied.', use('Bash'))).toBeNull();
    expect(denialOf(err, ' Permission to use Bash has been denied.', use('Bash'))).toBeNull();
    expect(denialOf(err, 'oops\nPreToolUse:Write hook error: x', use('Write'))).toBeNull();
  });

  it('texte vide, crochet sans ": " : null', () => {
    expect(denialOf(err, '', use('Bash'))).toBeNull();
    expect(denialOf(err, 'PreToolUse:Write hook error:', use('Write'))).toBeNull();
  });

  it('tool_use absent : outil « ? », cible vide, pas une lecture', () => {
    expect(denialOf(err, 'Permission to use Bash has been denied.', undefined)).toEqual({ toolUseId: 'tu1', tool: '?', target: '', read: false });
  });

  it('la cible : une seule ligne, courte', () => {
    const d = denialOf(err, 'Permission to use Bash has been denied.', use('Bash', { command: `a\n${'b'.repeat(500)}` }));
    expect(d?.target).toBe('a');
    expect(denialOf(err, 'Permission to use Bash has been denied.', use('Bash', { command: 'c'.repeat(500) }))?.target).toHaveLength(160);
  });
});
