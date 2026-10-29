// Variants des artefacts de l'agent (note 0.13.0, le panneau Artefacts) : la
// liste du relevé (sous-dossiers, ni caché ni lien, au plus 1 000) et la copie
// dans le dossier choisi (annulée, un fichier du même nom, le nom de base).
// Sur le vrai contrôleur et de vrais fichiers (userData temporaire) ; faux :
// Electron (les boîtes de dialogue répondent ce que le cas règle) et
// controllers/vibecoder (l'agent affiché et son dernier relevé, réglés par le cas).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';

type Box = { buttons: string[]; defaultId?: number; cancelId?: number };
const fake = vi.hoisted(() => ({
  userData: '', shown: 'a1' as string | null, view: null as unknown,
  pick: { canceled: false, filePaths: [] as string[] }, asked: [] as Box[], answer: (o: Box) => o.cancelId ?? 0,
}));
vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  dialog: {
    showOpenDialog: async () => fake.pick,
    showMessageBox: async (o: Box) => { fake.asked.push(o); return { response: fake.answer(o) }; },
  },
}));
vi.mock('app/controllers/vibecoder', async (actual) => ({
  listFiles: (await actual<typeof import('app/controllers/vibecoder')>()).listFiles,
  vibeAgent: () => (fake.shown ? { id: fake.shown } : null),
  lastView: (id: string) => (id === fake.shown ? fake.view : null),
}));

const { copyArtifact, listArtifacts, resolveArtifact } = await import('app/controllers/artifacts');

const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
let out = '';
let arts = '';
let chosen = '';
let agent: AgentConfig;
const names = () => listArtifacts('a1', out, 10).map((a) => a.name);
// Le relevé que la page a reçu : les artefacts du disque.
const survey = () => { fake.view = { artifacts: listArtifacts('a1', out, 10) } as Partial<VibeView>; };
const idOf = (name: string) => (fake.view as VibeView).artifacts!.find((a) => a.name === name)!.id;

beforeEach(() => {
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-artefacts-')));
  fake.shown = 'a1';
  fake.asked = [];
  fake.answer = (o) => o.cancelId ?? 0;
  out = path.join(fake.userData, 'vibecoder-out', 'a1');
  arts = path.join(out, 'artifacts');
  chosen = path.join(fake.userData, 'choisi');
  fs.mkdirSync(chosen, { recursive: true });
  fake.pick = { canceled: false, filePaths: [chosen] };
  agent = { id: 'a1', dir: path.join(fake.userData, 'projet'), name: 'essai', model: '', effort: '', mode: 'default', sessionId: null };
});

describe('listArtifacts', () => {
  it('les fichiers des sous-dossiers, sous leur chemin sous artifacts/', () => {
    write(path.join(arts, 'notes.md'), 'n');
    write(path.join(arts, 'maquettes', 'web', 'accueil.html'), 'p');
    expect(names()).toEqual(['maquettes/web/accueil.html', 'notes.md']);
  });

  it('ni fichier ni dossier caché', () => {
    write(path.join(arts, 'notes.md'), 'n');
    write(path.join(arts, '.brouillon.md'), 'b');
    write(path.join(arts, '.cache', 'x.md'), 'x');
    expect(names()).toEqual(['notes.md']);
  });

  it('ni lien vers un fichier, ni lien vers un dossier, ni artifacts/ en lien', () => {
    write(path.join(arts, 'notes.md'), 'n');
    write(path.join(fake.userData, 'dehors', 'secret.md'), 's');
    fs.symlinkSync(path.join(fake.userData, 'dehors', 'secret.md'), path.join(arts, 'lien.md'));
    fs.symlinkSync(path.join(fake.userData, 'dehors'), path.join(arts, 'dossier'));
    expect(names()).toEqual(['notes.md']);
    fs.rmSync(arts, { recursive: true });
    fs.symlinkSync(path.join(fake.userData, 'dehors'), arts);
    expect(names()).toEqual([]);
  });

  it('au plus 1 000', () => {
    for (let i = 0; i < 1005; i++) write(path.join(arts, `f${i}.txt`), '');
    expect(names()).toHaveLength(1000);
  });

  it('pas de dossier artifacts/ : aucun', () => {
    expect(names()).toEqual([]);
  });

  it('truncated : un texte au-delà de la limite reçue', () => {
    write(path.join(arts, 'long.txt'), 'x'.repeat(11));
    write(path.join(arts, 'court.txt'), 'x'.repeat(10));
    expect(listArtifacts('a1', out, 10).map((a) => [a.name, a.truncated])).toEqual([['court.txt', false], ['long.txt', true]]);
  });
});

describe('resolveArtifact', () => {
  it('une page en bac à sable, un media sans, un texte jamais', () => {
    write(path.join(arts, 'a.html'), 'p');
    write(path.join(arts, 'b.png'), 'i');
    write(path.join(arts, 'c.md'), 't');
    survey();
    expect(resolveArtifact(new URL(`vibe-artifact://a1/${idOf('a.html')}`))).toMatchObject({ type: 'text/html', sandbox: true });
    expect(resolveArtifact(new URL(`vibe-artifact://a1/${idOf('b.png')}`))).toMatchObject({ type: 'image/png', sandbox: false });
    expect(resolveArtifact(new URL(`vibe-artifact://a1/${idOf('c.md')}`))).toBeNull();
  });

  it('l’agent n’est plus affiché : rien', () => {
    write(path.join(arts, 'a.html'), 'p');
    survey();
    fake.shown = null;
    expect(resolveArtifact(new URL('vibe-artifact://a1/a0'))).toBeNull();
  });
});

describe('copyArtifact', () => {
  it('la boîte de dialogue annulée : rien n’est copié', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    survey();
    fake.pick = { canceled: true, filePaths: [] };
    const r = await copyArtifact(agent, idOf('notes.md'));
    expect(r.ok).toBe(true);
    expect(fs.readdirSync(chosen)).toEqual([]);
  });

  it('sous son nom de base, sans ses sous-dossiers', async () => {
    write(path.join(arts, 'maquettes', 'accueil.html'), 'PAGE');
    survey();
    await copyArtifact(agent, idOf('maquettes/accueil.html'));
    expect(fs.readdirSync(chosen, { recursive: true })).toEqual(['accueil.html']);
    expect(fs.readFileSync(path.join(chosen, 'accueil.html'), 'utf8')).toBe('PAGE');
  });

  it('un fichier du même nom, Annuler (le défaut) : inchangé', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    write(path.join(chosen, 'notes.md'), 'MIEN');
    survey();
    fake.answer = (o) => o.defaultId ?? 0;
    await copyArtifact(agent, idOf('notes.md'));
    expect(fake.asked[0].buttons[fake.asked[0].defaultId!]).toBe('Annuler');
    expect(fake.asked[0].cancelId).toBe(fake.asked[0].defaultId);
    expect(fs.readFileSync(path.join(chosen, 'notes.md'), 'utf8')).toBe('MIEN');
  });

  it('un fichier du même nom, Remplacer : remplacé', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    write(path.join(chosen, 'notes.md'), 'MIEN');
    survey();
    fake.answer = (o) => o.buttons.indexOf('Remplacer');
    const r = await copyArtifact(agent, idOf('notes.md'));
    expect(r.ok).toBe(true);
    expect(fs.readFileSync(path.join(chosen, 'notes.md'), 'utf8')).toBe('NOTES');
  });

  it('Remplacer, mais le fichier du même nom est un lien : rien n’est écrit au bout du lien', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    const ailleurs = path.join(fake.userData, 'ailleurs.md');
    write(ailleurs, 'AILLEURS');
    fs.symlinkSync(ailleurs, path.join(chosen, 'notes.md'));
    survey();
    fake.answer = (o) => o.buttons.indexOf('Remplacer');
    const r = await copyArtifact(agent, idOf('notes.md'));
    expect(r.ok).toBe(false);
    expect(fs.readFileSync(ailleurs, 'utf8')).toBe('AILLEURS');
  });

  it('un artefact devenu lien après le relevé : refusé, rien n’est copié', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    survey();
    fs.rmSync(path.join(arts, 'notes.md'));
    fs.symlinkSync(path.join(out, '..'), path.join(arts, 'notes.md'));
    const r = await copyArtifact(agent, idOf('notes.md'));
    expect(r.ok).toBe(false);
    expect(fs.readdirSync(chosen)).toEqual([]);
  });
});
