import { describe, expect, it } from 'vitest';
import { robotState, runSignal } from 'core/vibecoder';

describe('runSignal : les courses pas vues dans leur état', () => {
  it('sans course, ou rien à signaler : null', () => {
    expect(runSignal([])).toBeNull();
    expect(runSignal(['stopped', 'kept', 'undone'].map((state) => ({ state: state as never, noticed: null })))).toBeNull();
  });

  it('une course qui travaille : working, après asking, failed et done', () => {
    expect(runSignal([{ state: 'running', noticed: null }])).toBe('working');
    expect(runSignal([{ state: 'running', noticed: null }, { state: 'done', noticed: null }])).toBe('done');
    expect(runSignal([{ state: 'running', noticed: null }, { state: 'failed', noticed: null }])).toBe('failed');
    expect(runSignal([{ state: 'running', noticed: null }, { state: 'asking', noticed: null }])).toBe('asking');
    expect(runSignal([{ state: 'running', noticed: null }, { state: 'done', noticed: 'done' }])).toBe('working');
  });

  it('une question vue reste sur le robot tant qu\'elle attend', () => {
    expect(runSignal([{ state: 'asking', noticed: 'asking' }])).toBe('asking');
  });

  it('un état déjà vu ne signale plus ; un nouvel état, si', () => {
    expect(runSignal([{ state: 'done', noticed: 'done' }])).toBeNull();
    expect(runSignal([{ state: 'done', noticed: 'asking' }])).toBe('done');
  });

  it('asking d\'abord, puis failed, puis done', () => {
    expect(runSignal([{ state: 'done', noticed: null }, { state: 'failed', noticed: null }])).toBe('failed');
    expect(runSignal([{ state: 'done', noticed: null }, { state: 'failed', noticed: null }, { state: 'asking', noticed: null }])).toBe('asking');
  });
});

describe('robotState : la conversation d\'abord', () => {
  it('conversation active : son état, le signal ignoré', () => {
    expect(robotState({ status: 'working', unread: false }, 'failed')).toEqual({ status: 'working', unread: false });
    expect(robotState({ status: 'asking', unread: true }, 'done')).toEqual({ status: 'asking', unread: true });
    expect(robotState({ status: 'error', unread: false }, 'asking')).toEqual({ status: 'error', unread: false });
    expect(robotState({ status: 'asking', unread: false }, 'working')).toEqual({ status: 'asking', unread: false });
  });

  it('au repos : asking → asking, working → working, failed → error, done → non-lu', () => {
    expect(robotState({ status: 'idle', unread: false }, 'working')).toEqual({ status: 'working', unread: false });
    expect(robotState({ status: 'idle', unread: false }, 'asking')).toEqual({ status: 'asking', unread: false });
    expect(robotState({ status: 'idle', unread: true }, 'failed')).toEqual({ status: 'error', unread: true });
    expect(robotState({ status: 'idle', unread: false }, 'done')).toEqual({ status: 'idle', unread: true });
  });

  it('sans signal : la conversation telle quelle', () => {
    expect(robotState({ status: 'idle', unread: true }, null)).toEqual({ status: 'idle', unread: true });
  });
});
