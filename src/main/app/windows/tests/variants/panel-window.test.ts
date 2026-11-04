/** panel-window (variantes) — la fenêtre classique : cadre du système, barre des
 *  tâches, ni au premier plan ni sur tous les bureaux, taille retenue ; la
 *  fermer quitte l'appli. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const opts: Record<string, unknown>[] = [];
  const calls: string[] = [];
  const on = new Map<string, () => void>();
  class Win {
    webContents = { on() {}, setWindowOpenHandler() {} };
    constructor(o: Record<string, unknown>) { opts.push(o); }
    on(ev: string, fn: () => void) { on.set(ev, fn); return this; }
    once() { return this; }
    loadFile() {}
    setAlwaysOnTop() { calls.push('setAlwaysOnTop'); } setVisibleOnAllWorkspaces() { calls.push('setVisibleOnAllWorkspaces'); }
  }
  return { Win, opts, calls, on, vibeSize: undefined as { width: number; height: number } | undefined, quit: vi.fn() };
});

vi.mock('electron', () => ({ BrowserWindow: fake.Win, app: { quit: fake.quit } }));
vi.mock('app/controllers', () => ({ pushAgents() {}, runsTab() {}, selectAgent() {} }));
vi.mock('app/settings', () => ({ loadConfig: () => ({ vibeSize: fake.vibeSize }), page: (p: string) => p, preload: (p: string) => p, saveConfig() {} }));

const { createWindow } = await import('../../panel-window');

describe('createWindow', () => {
  beforeEach(() => { fake.opts.length = 0; fake.calls.length = 0; fake.quit.mockClear(); fake.vibeSize = undefined; });

  it('une fenêtre classique : cadre, barre des tâches, ni au premier plan ni sur tous les bureaux', () => {
    createWindow();
    const o = fake.opts[0];
    expect(o).not.toHaveProperty('frame');
    expect(o).not.toHaveProperty('skipTaskbar');
    expect(o).not.toHaveProperty('alwaysOnTop');
    expect(o).not.toHaveProperty('resizable');
    expect(fake.calls).toEqual([]);
  });

  it('la taille retenue (vibeSize), au moins la taille minimale', () => {
    fake.vibeSize = { width: 1500, height: 700 };
    createWindow();
    expect(fake.opts[0]).toMatchObject({ width: 1500, height: 700 });
    fake.vibeSize = { width: 100, height: 100 };
    createWindow();
    expect(fake.opts[1]).toMatchObject({ width: 960, height: 600 });
  });

  it('fermer la fenêtre quitte l\'appli', () => {
    createWindow();
    fake.on.get('closed')!();
    expect(fake.quit).toHaveBeenCalled();
  });
});
