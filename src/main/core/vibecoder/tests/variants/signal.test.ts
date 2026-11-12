import { describe, expect, it } from 'vitest';
import { noticedOnShow, robotState, runSignal } from 'core/vibecoder';

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

describe('runSignal : le questionnaire de l\'agent (la pastille « ? »)', () => {
  it('aucune course, une question : asking', () => {
    expect(runSignal([], 1)).toBe('asking');
  });

  it('une course finie ou en échec pas vue et une question : asking, pas done ni failed', () => {
    expect(runSignal([{ state: 'done', noticed: null }], 1)).toBe('asking');
    expect(runSignal([{ state: 'failed', noticed: null }], 1)).toBe('asking');
  });

  it('une course qui travaille et une question : asking', () => {
    expect(runSignal([{ state: 'running', noticed: null }], 2)).toBe('asking');
  });

  it('questions 0 (ou omis) : inchangé', () => {
    expect(runSignal([], 0)).toBeNull();
    expect(runSignal([{ state: 'done', noticed: null }], 0)).toBe('done');
    expect(runSignal([{ state: 'failed', noticed: null }], 0)).toBe('failed');
    expect(runSignal([{ state: 'running', noticed: null }], 0)).toBe('working');
  });

  it('un nombre négatif ne signale rien', () => {
    expect(runSignal([], -1)).toBeNull();
    expect(runSignal([{ state: 'done', noticed: null }], -3)).toBe('done');
  });

  it('une course qui attend et une question : asking ; des courses sans rien à signaler et une question : asking', () => {
    expect(runSignal([{ state: 'asking', noticed: null }], 1)).toBe('asking');
    expect(runSignal(['stopped', 'kept', 'undone'].map((state) => ({ state: state as never, noticed: null })), 1)).toBe('asking');
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

describe('noticedOnShow : afficher l\'agent ne vide que « fini »', () => {
  it('une course finie pas vue : vue, runSignal ne signale plus done', () => {
    const run = { state: 'done' as const, noticed: null };
    const noticed = noticedOnShow(run);
    expect(noticed).toBe('done');
    expect(runSignal([{ ...run, noticed }])).toBeNull();
  });

  it('une course en échec pas vue : inchangée, runSignal garde failed', () => {
    const run = { state: 'failed' as const, noticed: null };
    const noticed = noticedOnShow(run);
    expect(noticed).toBeNull();
    expect(runSignal([{ ...run, noticed }])).toBe('failed');
  });

  it('une course qui attend ou travaille : inchangée', () => {
    expect(noticedOnShow({ state: 'asking', noticed: null })).toBeNull();
    expect(noticedOnShow({ state: 'asking', noticed: 'asking' })).toBe('asking');
    expect(noticedOnShow({ state: 'running', noticed: null })).toBeNull();
  });
});
