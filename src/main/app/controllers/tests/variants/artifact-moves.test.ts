// Variants du sort des artefacts (note 0.13.0, « Le lien entre un dossier et des
// artefacts laissés ») : un retour ne rend que les entrées du même dossier (un
// dossier voisin au même début de chemin n'est pas le même), une entrée qui part
// emporte son dossier de sorties vide, la file d'attente ne casse jamais.
// Sur le vrai module et de vrais fichiers (userData temporaire) ; faux : Electron
// (le chemin du profil) et la bulle (les échecs qu'on lui dit).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from 'core/agents';

const fake = vi.hoisted(() => ({ userData: '', bubbles: [] as unknown[][] }));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData } }));
vi.mock('app/windows', () => ({ showBubble: (...a: unknown[]) => { fake.bubbles.push(a); } }));

const { eraseOutputs, retireArtifacts, returnArtifacts } = await import('app/controllers/artifact-moves');

const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file: string) => fs.readFileSync(file, 'utf8');
const outOf = (id: string) => path.join(fake.userData, 'vibecoder-out', id);
const arts = (id: string) => path.join(outOf(id), 'artifacts');
const left = (): Record<string, string> => {
  const file = path.join(fake.userData, 'artifacts-left.json');
  return fs.existsSync(file) ? JSON.parse(read(file)) : {};
};
const agent = (id: string, dir: string): AgentConfig =>
  ({ id, dir, name: id, model: '', effort: '', mode: 'default', sessionId: null });
const dirOf = (name: string) => { const d = path.join(fake.userData, name); fs.mkdirSync(d, { recursive: true }); return d; };

beforeEach(() => {
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-artifact-moves-v-')));
  fake.bubbles = [];
});

describe('returnArtifacts', () => {
  it('un dossier voisin au même début de chemin : ses artefacts ne vont pas à cet agent', async () => {
    write(path.join(arts('x1'), 'a.md'), 'VOISIN');
    await retireArtifacts(agent('x1', dirOf('projet-bis')), null);

    await returnArtifacts(agent('x9', dirOf('projet')));

    expect(read(path.join(arts('x1'), 'a.md'))).toBe('VOISIN');
    expect(fs.existsSync(arts('x9'))).toBe(false);
    expect(Object.keys(left())).toEqual(['x1']);
  });

  it('un dossier à lui : les artefacts arrivent, l’entrée et le dossier de sorties vide partent', async () => {
    write(path.join(arts('x1'), 'a.md'), 'LAISSE');
    const dir = dirOf('projet');
    await retireArtifacts(agent('x1', dir), null);

    await returnArtifacts(agent('x9', dir));

    expect(read(path.join(arts('x9'), 'a.md'))).toBe('LAISSE');
    expect(left()).toEqual({});
    expect(fs.existsSync(outOf('x1'))).toBe(false);
  });

  it('un dossier de sorties qui n’est pas vide reste', async () => {
    write(path.join(arts('x1'), 'a.md'), 'LAISSE');
    write(path.join(outOf('x1'), 'commit.md'), 'SORTIE');
    const dir = dirOf('projet');
    await retireArtifacts(agent('x1', dir), null);

    await returnArtifacts(agent('x9', dir));

    expect(read(path.join(outOf('x1'), 'commit.md'))).toBe('SORTIE');
  });
});

describe('retireArtifacts', () => {
  it('sans artefact : l’entrée ne reste pas', async () => {
    await retireArtifacts(agent('x1', dirOf('projet')), null);

    expect(left()).toEqual({});
  });

  it('une entrée posée entre-temps n’est pas perdue', async () => {
    write(path.join(arts('x1'), 'a.md'), 'A');
    write(path.join(arts('x2'), 'b.md'), 'B');
    await Promise.all([
      retireArtifacts(agent('x1', dirOf('un')), agent('p', dirOf('parent'))),
      retireArtifacts(agent('x2', dirOf('deux')), null),
    ]);

    expect(Object.keys(left())).toEqual(['x2']);
    expect(read(path.join(arts('p'), 'a.md'))).toBe('A');
  });
});

describe('eraseOutputs', () => {
  it('sans artefact : tout le dossier part', async () => {
    write(path.join(outOf('x1'), 'commit.md'), 'SORTIE');

    await eraseOutputs('x1');

    expect(fs.existsSync(outOf('x1'))).toBe(false);
  });

  // La décision se prend sur le disque : artifacts-left.json illisible et impossible à écrire
  // (un dossier à sa place), l'entrée manque, les artefacts restent quand même.
  it('l’entrée n’a pas pu être sauvée ni lue : les artefacts restent, le reste part', async () => {
    fs.mkdirSync(path.join(fake.userData, 'artifacts-left.json'));
    write(path.join(arts('x1'), 'a.md'), 'A');
    write(path.join(outOf('x1'), 'commit.md'), 'SORTIE');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await retireArtifacts(agent('x1', dirOf('projet')), null);

    await eraseOutputs('x1');

    log.mockRestore();
    expect(read(path.join(arts('x1'), 'a.md'))).toBe('A');
    expect(fs.existsSync(path.join(outOf('x1'), 'commit.md'))).toBe(false);
  });

  it('un dossier absent : rien ne rejette ni ne renaît', async () => {
    await eraseOutputs('x1');
    await retireArtifacts(agent('x1', dirOf('projet')), null);
    await eraseOutputs('x1');

    expect(fs.existsSync(outOf('x1'))).toBe(false);
  });
});
