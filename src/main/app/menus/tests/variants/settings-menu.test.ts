// Variants du menu ⚙ Réglages (openSettings) : posé sur la fenêtre (rien sans
// elle), la liste de la forme (sans collage, premier plan, texte transcrit,
// mode de lecture, bascules des agents), le volume en 25/50/75/100 % qui
// passe par setVolume. Faux : Electron et setVolume (la config est sur disque).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Item = { label?: string; type?: string; checked?: boolean; submenu?: Item[]; click?: () => void };
const fake = vi.hoisted(() => ({
  userData: '', template: [] as unknown[], popups: [] as unknown[], volumes: [] as number[],
}));

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData, getVersion: () => '1.2.3', isPackaged: true, quit: () => {} },
  Menu: { buildFromTemplate: (t: unknown[]) => { fake.template = t; return { popup: (o: unknown) => { fake.popups.push(o); } }; } },
  BrowserWindow: class {}, shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
}));
vi.mock('app/controllers', async (orig) => ({ ...await orig<object>(), setVolume: (v: number) => { fake.volumes.push(v); } }));

const labels = () => (fake.template as Item[]).map((i) => i.label);

beforeEach(() => {
  vi.resetModules();
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-settings-'));
  fake.template = []; fake.popups = []; fake.volumes = [];
  fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({ speakVolume: 0.5 }));
});

async function open(panel: boolean) {
  const { state } = await import('app/state');
  state.panel = panel ? ({} as never) : null;
  const { openSettings } = await import('app/menus');
  openSettings([{ deviceId: 'm1', label: 'Micro USB' }]);
  return state.panel;
}

describe('openSettings', () => {
  it('sans fenêtre : pas de menu', async () => {
    await open(false);
    expect(fake.template).toEqual([]);
  });

  it('posé sur la fenêtre, avec la liste des réglages et rien de plus', async () => {
    const panel = await open(true);
    expect(fake.popups).toEqual([{ window: panel }]);
    const l = labels();
    expect(l).toEqual(expect.arrayContaining(['Langue', 'Micro', 'Bip de début / fin', 'Lecture à voix haute', 'Agents Claude Code',
      'Ouvrir le dossier whisper', 'Modifier la configuration (vocabulaire…)', 'Quitter']));
    for (const gone of ['Coller automatiquement là où est le curseur', 'Afficher le texte transcrit']) expect(l).not.toContain(gone);
    expect(l.find((x) => x?.startsWith('Toujours au premier plan'))).toBeUndefined();
    const speak = (fake.template as Item[]).find((i) => i.label === 'Lecture à voix haute')!.submenu!.map((i) => i.label);
    expect(speak).not.toContain('Presse-papiers');
    const agents = (fake.template as Item[]).find((i) => i.label === 'Agents Claude Code')!.submenu!.map((i) => i.label);
    expect(agents).not.toContain('Afficher les agents');
    expect(agents).toContain('Dossier de VibeCoder');
  });

  it('volume : 25/50/75/100 %, le courant coché, le choix passe par setVolume', async () => {
    await open(true);
    const vol = (fake.template as Item[]).find((i) => i.label === 'Lecture à voix haute')!.submenu!.find((i) => i.label === 'Volume')!.submenu!;
    expect(vol.map((v) => [v.label, v.checked])).toEqual([['25 %', false], ['50 %', true], ['75 %', false], ['100 %', false]]);
    vol[2].click!();
    expect(fake.volumes).toEqual([0.75]);
  });
});
