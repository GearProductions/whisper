// Variants du clic droit d'un robot et du « + » (note 0.10.0) : le sous-menu
// Worktrees d'un agent sans parent à la racine d'un dépôt (branche, sinon le
// nom du dossier ; vide : une ligne grisée), absent pour un enfant ou hors
// dépôt ; Ouvrir un agent ici → openHere ; « + » → newAgent puis syncFamilies.
// Sur la vraie config (fichiers sur disque) ; faux : Electron (le menu relève
// son modèle) et les contrôleurs qui lancent git ou créent un agent.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Item = { label?: string; enabled?: boolean; submenu?: Item[]; click?: () => void };
const fake = vi.hoisted(() => ({
  userData: '',
  template: [] as unknown[],
  free: [] as { dir: string; branch: string | null }[],
  calls: [] as unknown[][],
}));

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  Menu: { buildFromTemplate: (t: unknown[]) => { fake.template = t; return { popup: () => {} }; } },
  BrowserWindow: class {}, shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
}));
vi.mock('app/controllers', async (orig) => ({
  ...await orig<object>(),
  freeWorktrees: async (a: { dir: string }) => (a.dir === repo ? { free: fake.free } : null),   // hors dépôt : null
  openHere: async (...a: unknown[]) => { fake.calls.push(['openHere', ...a]); },
  newAgent: (...a: unknown[]) => { fake.calls.push(['newAgent', ...a]); },
  syncFamilies: async () => { fake.calls.push(['syncFamilies']); },
}));

const AGENT = { model: '', effort: '', mode: 'default', sessionId: null };
let repo = '';
const items = () => fake.template as Item[];
const worktreesMenu = () => items().find((i) => i.label === 'Worktrees');

beforeEach(() => {
  vi.resetModules();
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-menus-'));
  fake.calls = [];
  fake.free = [];
  repo = path.join(fake.userData, 'projet');
  const plain = path.join(fake.userData, 'notes');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  fs.mkdirSync(plain, { recursive: true });
  fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agentCommand: process.execPath,
    agents: [
      { ...AGENT, id: 'a1', name: 'projet', dir: repo },
      { ...AGENT, id: 'a2', name: 'essai', dir: path.join(fake.userData, 'wt'), parent: { id: 'a1' } },
      { ...AGENT, id: 'a3', name: 'notes', dir: plain },
    ],
    agentFolders: [{ dir: path.join(fake.userData, 'libre'), color: '#22c55e' }],
  }));
});

async function open(id: string) {
  const { state } = await import('app/state');
  state.icon = {} as never;
  const { openAgentMenu } = await import('app/menus');
  await openAgentMenu(id);
}

describe('clic droit : Worktrees', () => {
  it('les worktrees sans agent : la branche, sinon le dossier ; Ouvrir un agent ici → openHere', async () => {
    const wt = path.join(fake.userData, 'wt', 'detache');
    fake.free = [{ dir: path.join(fake.userData, 'wt', 'essai'), branch: 'feat/essai' }, { dir: wt, branch: null }];
    await open('a1');
    const subs = worktreesMenu()!.submenu!;
    expect(subs.map((s) => s.label)).toEqual([
      `feat/essai — ${path.join(fake.userData, 'wt', 'essai')}`.replace(fake.userData, '~'),
      `detache — ${wt}`.replace(fake.userData, '~'),
    ]);
    subs[1].submenu![0].click!();
    expect(subs[1].submenu![0].label).toBe('Ouvrir un agent ici');
    expect(fake.calls).toEqual([['openHere', expect.objectContaining({ id: 'a1' }), wt]]);
  });

  it('aucun worktree libre : une ligne grisée', async () => {
    await open('a1');
    expect(worktreesMenu()!.submenu).toEqual([{ label: 'Aucun worktree sans agent', enabled: false }]);
  });

  it('pas de sous-menu pour un enfant, ni hors dépôt', async () => {
    fake.free = [{ dir: '/x', branch: 'b' }];
    await open('a2');
    expect(worktreesMenu()).toBeUndefined();
    expect(items().find((i) => i.label === 'Couleur du dossier')).toBeUndefined();   // celle du parent
    await open('a3');
    expect(worktreesMenu()).toBeUndefined();
  });
});

describe('« + »', () => {
  it('un dossier favori : newAgent puis syncFamilies', async () => {
    const { state } = await import('app/state');
    state.icon = {} as never;
    const { openAddAgentMenu } = await import('app/menus');
    openAddAgentMenu();
    items().find((i) => i.label?.includes('libre'))!.click!();
    expect(fake.calls).toEqual([['newAgent', path.join(fake.userData, 'libre')], ['syncFamilies']]);
  });
});
