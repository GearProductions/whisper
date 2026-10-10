import { describe, expect, it } from 'vitest';
import { parseThread } from 'core/agents';

// Une notification de tâche telle que Claude Code l'écrit dans la transcription
// (relevée telle quelle, Claude Code 2.1.285).
const notification = {
  type: 'user', timestamp: '2026-10-05T12:52:23.144Z', origin: { kind: 'task-notification' }, promptSource: 'system',
  message: { role: 'user', content: '<task-notification>\n<task-id>bymg21eo5</task-id>\n<status>stopped</status>\n<summary>Background shell command didn\'t finish</summary>\n</task-notification>' },
};
const said = (text: string, extra = {}) => ({ type: 'user', timestamp: '2026-10-05T12:50:00Z', message: { role: 'user', content: text }, ...extra });

describe('fil : seuls vos messages sont « Vous » (F-66)', () => {
  it('une notification de Claude Code n\'est pas un message de l\'utilisateur', () => {
    expect(parseThread([said('bonjour'), notification]).map((e) => e.text)).toEqual(['bonjour']);
    expect(parseThread([said('x', { origin: { kind: 'autre-machine' } })])).toHaveLength(0);
  });

  it('un message tapé ou dicté reste, avec ou sans origine', () => {
    expect(parseThread([said('ancien'), said('tapé', { origin: { kind: 'human' }, promptSource: 'typed' })]).map((e) => e.text))
      .toEqual(['ancien', 'tapé']);
  });
});
