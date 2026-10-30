// Variantes de app/settings : artifacts-left.json, lu sans jamais lever.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData } }));

const file = () => path.join(fake.userData, 'artifacts-left.json');
const load = async () => (await import('app/settings'));

beforeEach(() => { fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-settings-')); });
afterEach(() => { fs.rmSync(fake.userData, { recursive: true, force: true }); });

describe('leftArtifacts / saveLeftArtifacts', () => {
  it('fichier absent : rien', async () => {
    expect((await load()).leftArtifacts()).toEqual({});
  });

  it('écrit puis relu à l’identique', async () => {
    const { leftArtifacts, saveLeftArtifacts } = await load();
    saveLeftArtifacts({ a2: '/dossier/a' });
    expect(leftArtifacts()).toEqual({ a2: '/dossier/a' });
  });

  it.each(['pas du json', 'null', '[]', '["/x"]', '"/x"', '42'])('contenu %s : rien, sans lever', async (content) => {
    fs.writeFileSync(file(), content);
    expect((await load()).leftArtifacts()).toEqual({});
  });

  it('une valeur qui n’est pas une chaîne est écartée', async () => {
    fs.writeFileSync(file(), JSON.stringify({ a: '/ok', b: 3, c: null, d: { x: 1 }, e: ['/x'] }));
    expect((await load()).leftArtifacts()).toEqual({ a: '/ok' });
  });
});
