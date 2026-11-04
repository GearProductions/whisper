// Variants des artefacts du projet (note 0.13.0, le panneau Artefacts, le dossier du projet) : le
// dossier (partagé par un dépôt et son worktree, créé ou non), la liste du relevé (sous-dossiers, ni dossier caché ni lien, au plus 1 000) et la copie
// dans le dossier choisi (annulée, un fichier du même nom, le nom de base).
// Sur le vrai contrôleur et de vrais fichiers (userData temporaire) ; faux :
// Electron (les boîtes de dialogue répondent ce que le cas règle) et
// controllers/vibecoder (l'agent affiché et son dernier relevé, réglés par le cas).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';

type Box = { buttons: string[]; defaultId?: number; cancelId?: number };
const fake = vi.hoisted(() => ({
  userData: '', dir: '', shown: 'a1' as string | null, view: null as unknown,
  pick: { canceled: false, filePaths: [] as string[] }, opened: [] as unknown[], asked: [] as Box[], answer: (o: Box) => o.cancelId ?? 0,
}));
vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  dialog: {
    showOpenDialog: async (o: unknown) => { fake.opened.push(o); return fake.pick; },
    showMessageBox: async (o: Box) => { fake.asked.push(o); return { response: fake.answer(o) }; },
  },
}));
vi.mock('app/windows', () => ({ conversationNotice: () => {} }));
vi.mock('app/controllers/agents', () => ({ viewAgent: () => (fake.shown ? { id: fake.shown, dir: fake.dir } : null) }));
vi.mock('app/controllers/vibecoder', () => ({
  lastView: (id: string) => (id === fake.shown ? fake.view : null),
}));

const { addArtifacts, copyArtifact, listArtifacts, projectArtifactsDir, projectArtifactsPath, resolveArtifact } = await import('app/controllers/artifacts');

const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
let arts = '';   // le dossier du projet de l'agent
let chosen = '';
let agent: AgentConfig;
const names = () => listArtifacts('a1', arts, 10).artifacts.map((a) => a.name);
const dirs = () => listArtifacts('a1', arts, 10).dirs.map((d) => d.name);
// Le relevé que la page a reçu : les artefacts du disque.
const survey = () => { fake.view = { ...(({ artifacts, dirs }) => ({ artifacts, artifactDirs: dirs }))(listArtifacts('a1', arts, 10)) } as Partial<VibeView>; };
const idOf = (name: string) => (fake.view as VibeView).artifacts!.find((a) => a.name === name)!.id;
const dirOf = (name: string) => (fake.view as VibeView).artifactDirs!.find((d) => d.name === name)!.id;

beforeEach(() => {
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-artefacts-')));
  fake.shown = 'a1';
  fake.asked = [];
  fake.opened = [];
  fake.answer = (o) => o.cancelId ?? 0;
  chosen = path.join(fake.userData, 'choisi');
  fs.mkdirSync(chosen, { recursive: true });
  fake.pick = { canceled: false, filePaths: [chosen] };
  fake.dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(fake.dir, { recursive: true });
  arts = projectArtifactsPath(fake.dir);
  agent = { id: 'a1', dir: fake.dir, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null };
});

describe('le dossier du projet', () => {
  const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });

  it('un dépôt et son worktree : le même dossier ; un autre dépôt, un autre', () => {
    const repo = path.join(fake.userData, 'depot');
    const tree = path.join(fake.userData, 'depot-worktrees', 'enfant');
    const other = path.join(fake.userData, 'autre');
    for (const d of [repo, other]) { fs.mkdirSync(d, { recursive: true }); git(d, 'init', '-q', '-b', 'main'); git(d, 'commit', '-q', '--allow-empty', '-m', 'init'); }
    git(repo, 'worktree', 'add', '-q', '-b', 'enfant', tree);

    expect(projectArtifactsPath(tree)).toBe(projectArtifactsPath(repo));
    expect(projectArtifactsPath(other)).not.toBe(projectArtifactsPath(repo));
    expect(path.relative(path.join(fake.userData, 'vibecoder-artifacts'), projectArtifactsPath(repo))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('projectArtifactsPath ne crée rien, projectArtifactsDir crée', () => {
    expect(fs.existsSync(arts)).toBe(false);
    expect(projectArtifactsDir(fake.dir)).toBe(arts);
    expect(fs.statSync(arts).isDirectory()).toBe(true);
  });
});

describe('listArtifacts', () => {
  it('les fichiers des sous-dossiers, sous leur chemin sous artifacts/', () => {
    write(path.join(arts, 'notes.md'), 'n');
    write(path.join(arts, 'maquettes', 'web', 'accueil.html'), 'p');
    expect(names()).toEqual(['maquettes/web/accueil.html', 'notes.md']);
  });

  it('un fichier caché est listé, un dossier caché n’est pas entré', () => {
    write(path.join(arts, 'notes.md'), 'n');
    write(path.join(arts, '.brouillon.md'), 'b');
    write(path.join(arts, '.cache', 'x.md'), 'x');
    expect(names()).toEqual(['.brouillon.md', 'notes.md']);
  });

  it('ni lien vers un fichier, ni lien vers un dossier, ni le dossier du projet en lien', () => {
    write(path.join(arts, 'notes.md'), 'n');
    write(path.join(fake.userData, 'dehors', 'secret.md'), 's');
    fs.symlinkSync(path.join(fake.userData, 'dehors', 'secret.md'), path.join(arts, 'lien.md'));
    fs.symlinkSync(path.join(fake.userData, 'dehors'), path.join(arts, 'dossier'));
    expect(names()).toEqual(['notes.md']);
    fs.rmSync(arts, { recursive: true });
    fs.symlinkSync(path.join(fake.userData, 'dehors'), arts);
    expect(names()).toEqual([]);
  });

  it('au plus 1 000 fichiers ; les dossiers ne comptent pas', () => {
    for (let i = 0; i < 1005; i++) write(path.join(arts, `f${i}.txt`), '');
    fs.mkdirSync(path.join(arts, 'zz-vide'));
    expect(names()).toHaveLength(1000);
    expect(dirs()).toEqual(['zz-vide']);
  });

  it('les dossiers, même vides, sous leur chemin et leur id d<i> dans l’ordre des noms', () => {
    fs.mkdirSync(path.join(arts, 'vide'), { recursive: true });
    write(path.join(arts, 'maquettes', 'web', 'accueil.html'), 'p');
    expect(listArtifacts('a1', arts, 10).dirs).toEqual([
      { id: 'd0', name: 'maquettes' }, { id: 'd1', name: 'maquettes/web' }, { id: 'd2', name: 'vide' },
    ]);
  });

  it('ni dossier caché (ni ce qu’il contient), ni dossier en lien', () => {
    write(path.join(arts, '.cache', 'x.md'), 'x');
    write(path.join(fake.userData, 'dehors', 'secret.md'), 's');
    fs.symlinkSync(path.join(fake.userData, 'dehors'), path.join(arts, 'lien'));
    fs.mkdirSync(path.join(arts, 'ok'));
    expect(dirs()).toEqual(['ok']);
  });

  it('pas de dossier du projet : aucun', () => {
    expect(names()).toEqual([]);
    expect(dirs()).toEqual([]);
  });

  it('truncated : un texte au-delà de la limite reçue', () => {
    write(path.join(arts, 'long.txt'), 'x'.repeat(11));
    write(path.join(arts, 'court.txt'), 'x'.repeat(10));
    expect(listArtifacts('a1', arts, 10).artifacts.map((a) => [a.name, a.truncated])).toEqual([['court.txt', false], ['long.txt', true]]);
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
  // Au-delà de 130 000 chemins, un push(...tableau) lève RangeError : le rapport est partagé, sans fusion.
  // Trop long sous Windows (NTFS, antivirus) : le rapport partagé ne dépend pas du système.
  it.skipIf(process.platform === 'win32')('un dossier de plus de 130 000 fichiers : tous copiés, le rapport sans erreur', async () => {
    const lot = path.join(fake.userData, 'depot', 'lot');
    const count = 130_001;
    for (let d = 0; d <= count / 1000; d++) {
      const dir = path.join(lot, `d${d}`);
      fs.mkdirSync(dir, { recursive: true });
      for (let i = 0; i < 1000 && d * 1000 + i < count; i++) fs.writeFileSync(path.join(dir, `f${i}`), '');
    }
    const r = await addArtifacts(agent, [lot]);
    expect(r.line).toBe(`${count} ajoutés.`);
    expect(r.ok).toBe(true);
  }, 60_000);

  it('la boîte de dialogue annulée : rien n’est copié', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    survey();
    fake.pick = { canceled: true, filePaths: [] };
    const r = await copyArtifact(agent, [idOf('notes.md')]);
    expect(r.ok).toBe(true);
    expect(fs.readdirSync(chosen)).toEqual([]);
  });

  it('sous son nom de base, sans ses sous-dossiers', async () => {
    write(path.join(arts, 'maquettes', 'accueil.html'), 'PAGE');
    survey();
    await copyArtifact(agent, [idOf('maquettes/accueil.html')]);
    expect(fs.readdirSync(chosen, { recursive: true })).toEqual(['accueil.html']);
    expect(fs.readFileSync(path.join(chosen, 'accueil.html'), 'utf8')).toBe('PAGE');
  });

  it('un fichier du même nom, Annuler (le défaut) : inchangé', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    write(path.join(chosen, 'notes.md'), 'MIEN');
    survey();
    fake.answer = (o) => o.defaultId ?? 0;
    await copyArtifact(agent, [idOf('notes.md')]);
    expect(fake.asked[0].buttons[fake.asked[0].defaultId!]).toBe('Annuler');
    expect(fake.asked[0].cancelId).toBe(fake.asked[0].defaultId);
    expect(fs.readFileSync(path.join(chosen, 'notes.md'), 'utf8')).toBe('MIEN');
  });

  it('un fichier du même nom, Remplacer : remplacé', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    write(path.join(chosen, 'notes.md'), 'MIEN');
    survey();
    fake.answer = (o) => o.buttons.indexOf('Remplacer');
    const r = await copyArtifact(agent, [idOf('notes.md')]);
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
    const r = await copyArtifact(agent, [idOf('notes.md')]);
    expect(r.ok).toBe(false);
    expect(fs.readFileSync(ailleurs, 'utf8')).toBe('AILLEURS');
  });

  it('la sélection : plusieurs fichiers, une seule boîte de dialogue, Remplacer demandé pour le seul pris', async () => {
    write(path.join(arts, 'a.md'), 'A');
    write(path.join(arts, 'b.md'), 'B');
    write(path.join(chosen, 'b.md'), 'MIEN');
    survey();
    fake.answer = (o) => o.buttons.indexOf('Remplacer');
    const r = await copyArtifact(agent, [idOf('a.md'), idOf('b.md')]);
    expect(r.ok).toBe(true);
    expect(fake.opened).toHaveLength(1);
    expect(fake.asked).toHaveLength(1);
    expect(fs.readFileSync(path.join(chosen, 'a.md'), 'utf8')).toBe('A');
    expect(fs.readFileSync(path.join(chosen, 'b.md'), 'utf8')).toBe('B');
  });

  it('un dossier : copié avec son contenu, numéroté s’il existe déjà, jamais remplacé ni mêlé', async () => {
    write(path.join(arts, 'maquettes', 'web', 'accueil.html'), 'PAGE');
    write(path.join(chosen, 'maquettes', 'mien.md'), 'MIEN');
    survey();
    fake.answer = (o) => o.buttons.indexOf('Remplacer');
    const r = await copyArtifact(agent, [dirOf('maquettes')]);
    expect(r.ok).toBe(true);
    expect(fake.asked).toEqual([]);
    expect(fs.readFileSync(path.join(chosen, 'maquettes', 'mien.md'), 'utf8')).toBe('MIEN');
    expect(fs.readdirSync(path.join(chosen, 'maquettes'))).toEqual(['mien.md']);
    expect(fs.readFileSync(path.join(chosen, 'maquettes-2', 'web', 'accueil.html'), 'utf8')).toBe('PAGE');
  });

  it('un id inconnu ou un chemin dans la sélection, ou une sélection vide : refusé, aucune boîte de dialogue', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    survey();
    for (const ids of [[idOf('notes.md'), 'a99'], [idOf('notes.md'), '../x'], [], ['d0']]) {
      expect((await copyArtifact(agent, ids)).ok).toBe(false);
    }
    expect(fake.opened).toEqual([]);
    expect(fs.readdirSync(chosen)).toEqual([]);
  });

  it('un dossier devenu un lien après le relevé : refusé, sa cible n’est pas copiée', async () => {
    write(path.join(arts, 'maquettes', 'a.md'), 'A');
    write(path.join(fake.userData, 'dehors', 'secret.md'), 'S');
    survey();
    fs.rmSync(path.join(arts, 'maquettes'), { recursive: true });
    fs.symlinkSync(path.join(fake.userData, 'dehors'), path.join(arts, 'maquettes'));
    expect((await copyArtifact(agent, [dirOf('maquettes')])).ok).toBe(false);
    expect(fs.readdirSync(chosen)).toEqual([]);
  });

  it('un artefact devenu lien après le relevé : refusé, rien n’est copié', async () => {
    write(path.join(arts, 'notes.md'), 'NOTES');
    survey();
    fs.rmSync(path.join(arts, 'notes.md'));
    fs.symlinkSync(fake.userData, path.join(arts, 'notes.md'));
    const r = await copyArtifact(agent, [idOf('notes.md')]);
    expect(r.ok).toBe(false);
    expect(fs.readdirSync(chosen)).toEqual([]);
  });
});

describe('addArtifacts', () => {
  const dropped = () => { const f = path.join(fake.userData, 'depot', 'rapport.md'); write(f, 'R'); return f; };

  it('rien de copié (un chemin relatif) : ok false', async () => {
    const r = await addArtifacts(agent, ['rapport.md']);
    expect(r.ok).toBe(false);
    expect(fs.existsSync(arts)).toBe(false);
  });

  it('un copié, un échec : ok false, la ligne dit les deux', async () => {
    const f = dropped();
    const r = await addArtifacts(agent, [f, path.join(fake.userData, 'absent.md')]);
    expect(r.ok).toBe(false);
    expect(r.line).toMatch(/1 ajouté.*1 échec/);
    expect(fs.readFileSync(path.join(arts, 'rapport.md'), 'utf8')).toBe('R');
  });

  it('sur un dossier du relevé : copié dedans, sans rien écraser', async () => {
    write(path.join(arts, 'maquettes', 'rapport.md'), 'ANCIEN');
    survey();
    const r = await addArtifacts(agent, [dropped()], dirOf('maquettes'));
    expect(r.ok).toBe(true);
    expect(fs.readFileSync(path.join(arts, 'maquettes', 'rapport.md'), 'utf8')).toBe('ANCIEN');
    expect(fs.readFileSync(path.join(arts, 'maquettes', 'rapport-2.md'), 'utf8')).toBe('R');
  });

  it('un id absent, inconnu ou en forme de chemin : à la racine', async () => {
    write(path.join(arts, 'maquettes', 'x.md'), 'x');
    survey();
    for (const folder of [undefined, 'd99', '../..', fake.userData, 'a0']) await addArtifacts(agent, [dropped()], folder);
    expect(fs.readdirSync(arts).sort()).toEqual(['maquettes', 'rapport-2.md', 'rapport-3.md', 'rapport-4.md', 'rapport-5.md', 'rapport.md']);
    expect(fs.readdirSync(path.join(arts, 'maquettes'))).toEqual(['x.md']);
    expect(fs.readdirSync(fake.userData)).not.toContain('rapport.md');
  });

  it('un dossier déposé : copié sous le dossier visé, numéroté s’il existe', async () => {
    write(path.join(arts, 'maquettes', 'lot', 'vieux.md'), 'V');
    write(path.join(fake.userData, 'depot', 'lot', 'neuf.md'), 'N');
    survey();
    await addArtifacts(agent, [path.join(fake.userData, 'depot', 'lot')], dirOf('maquettes'));
    expect(fs.readdirSync(path.join(arts, 'maquettes', 'lot'))).toEqual(['vieux.md']);
    expect(fs.readFileSync(path.join(arts, 'maquettes', 'lot-2', 'neuf.md'), 'utf8')).toBe('N');
  });

  it('le dossier visé devenu un lien après le relevé : rien n’arrive dans sa cible', async () => {
    write(path.join(arts, 'maquettes', 'x.md'), 'x');
    fs.mkdirSync(path.join(fake.userData, 'dehors'));
    survey();
    const id = dirOf('maquettes');
    fs.rmSync(path.join(arts, 'maquettes'), { recursive: true });
    fs.symlinkSync(path.join(fake.userData, 'dehors'), path.join(arts, 'maquettes'));
    const r = await addArtifacts(agent, [dropped()], id);
    expect(r.ok).toBe(false);
    expect(fs.readdirSync(path.join(fake.userData, 'dehors'))).toEqual([]);
  });

  it('le dossier du projet devenu un lien : rien n’arrive dans sa cible', async () => {
    fs.mkdirSync(path.join(fake.userData, 'dehors'));
    fs.mkdirSync(path.dirname(arts), { recursive: true });
    fs.symlinkSync(path.join(fake.userData, 'dehors'), arts);
    const r = await addArtifacts(agent, [dropped()]);
    expect(r.ok).toBe(false);
    expect(fs.readdirSync(path.join(fake.userData, 'dehors'))).toEqual([]);
  });
});
