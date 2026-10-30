// Variants de module-code pour les artefacts (note 0.13.0, le panneau
// Artefacts) : un texte au-delà de artifactTextMax est coupé (le début
// seulement, truncated), un binaire s'affiche en texte (pas refusé), une page
// n'est pas suivie, Enregistrer refusé pour un artefact.
// Sur le vrai contrôleur et de vrais fichiers (userData temporaire, config.json
// à petite limite) ; faux : Electron, la fenêtre (relève ce qu'on lui envoie) et
// controllers/vibecoder (l'agent affiché et son dernier relevé, réglés par le cas).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';

const fake = vi.hoisted(() => ({ userData: '', view: null as unknown, sent: [] as unknown[] }));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData }, dialog: {}, shell: {}, clipboard: {}, nativeImage: {} }));
vi.mock('app/controllers/vibecoder', () => ({
  vibeAgent: () => ({ id: 'a1', dir: fake.userData }),
  lastView: (id: string) => (id === 'a1' ? fake.view : null),
  refreshVibe: () => {},
}));

const { state } = await import('app/state');
const { followCode, saveCode } = await import('app/controllers/module-code');
const { listArtifacts, projectArtifactsPath } = await import('app/controllers/artifacts');

const MAX = 16;
let arts = '';
const write = (name: string, data: string | Buffer) => {
  const file = path.join(arts, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};
// Le relevé reçu par la page, puis l'artefact de ce nom suivi.
const follow = (name: string) => {
  fake.view = { artifacts: listArtifacts('a1', arts, MAX) } as Partial<VibeView>;
  const id = (fake.view as VibeView).artifacts!.find((a) => a.name === name)!.id;
  followCode(id);
  return id;
};
const last = () => fake.sent.at(-1) as { id: string; text: string | null; truncated?: boolean; at?: unknown } | null;

beforeEach(() => {
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-module-code-a-')));
  fake.sent = [];
  arts = projectArtifactsPath(fake.userData);
  fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({ artifactTextMax: MAX }));
  state.panel = { isDestroyed: () => false, webContents: { send: (_ch: string, c: unknown) => fake.sent.push(c) } } as never;
});
afterEach(() => followCode(null));

it('au-delà de artifactTextMax : le début seulement, truncated', async () => {
  write('long.txt', '0123456789abcdef-LA-SUITE');
  const id = follow('long.txt');
  await vi.waitFor(() => expect(last()).toEqual({ id, text: '0123456789abcdef', time: expect.any(Number), truncated: true }));
});

it('à la limite : entier, sans truncated ni at', async () => {
  write('notes.md', '0123456789abcdef');
  const id = follow('notes.md');
  await vi.waitFor(() => expect(last()).toEqual({ id, text: '0123456789abcdef', time: expect.any(Number) }));
});

it('un binaire s’affiche en texte, décodé en UTF-8', async () => {
  write('donnees.bin', Buffer.from([0x00, 0xff, 0x41, 0x0a]));
  const id = follow('donnees.bin');
  await vi.waitFor(() => expect(last()).toMatchObject({ id, text: '\u0000�A\n' }));
});

it('poussé à chaque changement', async () => {
  write('notes.md', 'AVANT');
  follow('notes.md');
  await vi.waitFor(() => expect(last()?.text).toBe('AVANT'));
  write('notes.md', 'APRES');
  await vi.waitFor(() => expect(last()?.text).toBe('APRES'));
});

it('une page : rien de lu, null poussé', () => {
  write('accueil.html', '<p>PAGE</p>');
  follow('accueil.html');
  expect(fake.sent).toEqual([null]);
});

it('Enregistrer un artefact suivi : refusé, le fichier inchangé', async () => {
  write('notes.md', 'AVANT');
  const id = follow('notes.md');
  await vi.waitFor(() => expect(last()?.text).toBe('AVANT'));
  expect(saveCode(id, 'APRES').ok).toBe(false);
  expect(fs.readFileSync(path.join(arts, 'notes.md'), 'utf8')).toBe('AVANT');
});
