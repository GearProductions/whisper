// Variants de app/dev (note 0.13.0-recharger-interface) : l'état d'après out/ (redémarrer, recharger, rien),
// relu toutes les 2 s ; recharger les fenêtres ; relancer ; rien en version empaquetée.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ root: '', packaged: false, calls: [] as string[], reloads: 0 }));
vi.mock('electron', () => ({
  app: {
    get isPackaged() { return fake.packaged; }, getAppPath: () => fake.root,
    relaunch: () => { fake.calls.push('relaunch'); }, quit: () => { fake.calls.push('quit'); },
  },
  BrowserWindow: { getAllWindows: () => [1, 2].map(() => ({ webContents: { reloadIgnoringCache: () => { fake.reloads++; } } })) },
}));

const write = (rel: string, text: string) => {
  const file = path.join(fake.root, 'out', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const tick = () => vi.advanceTimersByTime(2000);

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  fake.root = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-dev-'));
  fake.packaged = false;
  fake.calls = [];
  fake.reloads = 0;
  write('main/index.js', 'm1');
  write('main/preload-panel.js', 'p1');
  write('renderer/app/panel/conversation.html', 'h1');
});
afterEach(() => { vi.useRealTimers(); fs.rmSync(fake.root, { recursive: true, force: true }); });

it('rien de reconstruit, ou à l’identique : pas d’état', async () => {
  const dev = await import('app/dev');
  const onChange = vi.fn();
  dev.startDev(onChange);
  write('main/index.js', 'm1');
  tick();
  expect([dev.devState(), onChange.mock.calls.length]).toEqual([null, 0]);
});

it('les pages reconstruites : recharger ; rechargées, plus rien', async () => {
  const dev = await import('app/dev');
  const onChange = vi.fn();
  dev.startDev(onChange);
  write('renderer/app/panel/conversation.html', 'h2');
  tick();
  expect([dev.devState(), onChange.mock.calls.length]).toEqual(['reload', 1]);
  dev.reloadPages();
  expect([fake.reloads, dev.devState(), fake.calls]).toEqual([2, null, []]);
});

it('un pont ou le principal reconstruit : redémarrer, qui relance puis quitte', async () => {
  const dev = await import('app/dev');
  dev.startDev(() => {});
  write('main/preload-panel.js', 'p2');
  write('renderer/app/panel/conversation.html', 'h2');
  tick();
  expect(dev.devState()).toBe('restart');
  dev.restartApp();
  expect(fake.calls).toEqual(['relaunch', 'quit']);
});

it('empaquetée : jamais d’état, ni rechargement, ni relance', async () => {
  fake.packaged = true;
  const dev = await import('app/dev');
  dev.startDev(() => {});
  write('main/index.js', 'm2');
  tick();
  dev.reloadPages();
  dev.restartApp();
  expect([dev.devState(), fake.reloads, fake.calls]).toEqual([null, 0, []]);
});

it('recharger relit out/ à l’instant : le principal reconstruit depuis le dernier relevé → rien de rechargé', async () => {
  const dev = await import('app/dev');
  dev.startDev(() => {});
  write('renderer/app/panel/conversation.html', 'h2');
  tick();
  expect(dev.devState()).toBe('reload');
  write('main/preload-panel.js', 'p2');   // avant le relevé suivant
  dev.reloadPages();
  expect(fake.reloads).toBe(0);
});

it('redémarrer pendant une construction (out/main vide) : pas de relance', async () => {
  const dev = await import('app/dev');
  dev.startDev(() => {});
  write('main/index.js', 'm2');
  tick();
  expect(dev.devState()).toBe('restart');
  fs.rmSync(path.join(fake.root, 'out', 'main'), { recursive: true });
  dev.restartApp();
  expect(fake.calls).toEqual([]);
});
