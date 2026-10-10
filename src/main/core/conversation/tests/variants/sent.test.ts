import { describe, expect, it } from 'vitest';
import type { Thread } from 'core/agents';
import { withSent } from 'core/conversation';

const since = Date.parse('2026-10-09T10:00:00Z');
const thread = (...entries: Thread): Thread => Object.assign(entries, { contextTokens: 42 });
const before = { role: 'user' as const, text: 'avant', images: [], time: since - 60000 };
const reply = { role: 'assistant' as const, text: 'réponse', tools: [], time: since - 30000 };
const sent = { text: 'bonjour', images: [{ mediaType: 'image/png', data: 'AA' }] };

describe('le message envoyé s\'affiche aussitôt (F-68)', () => {
  it('pas encore dans la transcription : ajouté tel qu\'envoyé, à l\'heure de l\'envoi', () => {
    const out = withSent(thread(before, reply), sent, since);
    expect(out.map((e) => e.text)).toEqual(['avant', 'réponse', 'bonjour']);
    expect(out[2]).toEqual({ role: 'user', text: 'bonjour', images: [{ type: 'base64', media_type: 'image/png', data: 'AA' }], time: since });
    expect(out.contextTokens).toBe(42);
  });

  it('déjà dans la transcription : jamais deux fois', () => {
    const written = { role: 'user' as const, text: 'bonjour', images: [], time: since + 1500 };
    expect(withSent(thread(before, reply, written), sent, since).map((e) => e.text)).toEqual(['avant', 'réponse', 'bonjour']);
    const noTime = { role: 'user' as const, text: 'bonjour', images: [], time: null }; // heure absente : reconnu à son texte
    expect(withSent(thread(before, noTime), sent, since)).toHaveLength(2);
  });

  it('hors tour : le fil tel quel', () => {
    const t = thread(before, reply);
    expect(withSent(t, null, null)).toBe(t);
  });
});
