import { describe, expect, it } from 'vitest';
import { followsEnd } from 'core/conversation';
import type { Message, Thread } from 'technicals/bridge';

const m = (role: Message['role']): Message => ({ role, text: role, kind: null, context: '', files: [], time: null, audio: false, images: [], tools: [] });
const thread = (over: Partial<Thread> = {}): Thread => ({
  mode: 'full', key: 'alpha', live: true, name: 'alpha', color: '#000', title: '', status: 'idle',
  messages: [m('user'), m('assistant'), m('user'), m('assistant')], ...over,
});
const reading = { atEnd: false, working: false }; // on lit plus haut

describe('le fil descend après ce rendu (F-66)', () => {
  it('⤢ : réduit → agrandi, le fil s\'ouvre en bas', () => {
    expect(followsEnd(thread({ mode: 'compact' }), thread({ mode: 'full' }), reading)).toBe(true);
  });

  it('autre conversation, réduit, demande d\'autorisation : en bas', () => {
    expect(followsEnd(null, thread(), reading)).toBe(true);
    expect(followsEnd(thread(), thread({ key: 'beta' }), reading)).toBe(true);
    expect(followsEnd(thread({ mode: 'compact' }), thread({ mode: 'compact' }), reading)).toBe(true);
    expect(followsEnd(thread(), thread({ permission: { key: 1 } as Thread['permission'] }), reading)).toBe(true);
  });

  it('agrandi, message arrivé : en bas si l\'on y était, sans arracher la lecture', () => {
    const grown = thread({ messages: [...thread().messages, m('user')] });
    expect(followsEnd(thread(), grown, { atEnd: true, working: false })).toBe(true);
    expect(followsEnd(thread(), grown, reading)).toBe(false);
    expect(followsEnd(thread(), thread({ status: 'working' }), { atEnd: true, working: true })).toBe(true);
    expect(followsEnd(thread(), thread(), { atEnd: true, working: false })).toBe(false);
  });
});
