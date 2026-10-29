// Invariants du fichier d'un commit en Relire, et des versions de base (note
// 0.13.0, docs/tickets/feat/0.13.0-ameliorations-interface.md, « Ce que ça ne
// doit pas faire ») :
//   - écrire un fichier en Relire : le principal refuse Enregistrer pour un
//     fichier d'un commit, sans se fier à la page (I-37 / I-39 étendus) ;
//   - suivre un fichier d'un commit hors de Relire, ou désigné autrement que
//     par son id `c<rang>/<i>` du dernier relevé (I-37 étendu) ;
//   - lire la version de base d'un test ou d'un fichier supprimé, ou celles
//     d'un fichier d'un commit (son parent, la base de la PR), autrement que
//     par git, ou d'après un chemin fourni par une page (I-37).
// commitFile seul, sur un relevé écrit à la main :
// core/vibecoder/tests/invariants/commit-file.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, un lien réel qui sort du dossier de
// l'agent) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie) et le
// SDK de Claude Code (chaque message reçu ouvre un tour, sans rien écrire, qui
// dure jusqu'à interrupt()). Ce que la page voit : le relevé (conv:vibe) et les
// conv:vibeCode poussés au panneau, tous leurs champs. Même banc que
// module-code.test.ts.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { slow } from '../slow';

const fake = vi.hoisted(() => {
  type Handler = (...a: unknown[]) => void;
  class Win {
    sent: [string, unknown][] = [];
    handlers = new Map<string, Handler[]>();
    visible = false;
    webContents = {
      send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); },
      on: () => {}, setWindowOpenHandler: () => {},
    };
    on(ev: string, fn: Handler) { this.handlers.set(ev, [...(this.handlers.get(ev) || []), fn]); return this; }
    once(ev: string, fn: Handler) { return this.on(ev, fn); }
    emit(ev: string) { for (const fn of this.handlers.get(ev) || []) fn(); }
    loadFile() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setResizable() {} setBounds() {}
    getBounds() { return { x: 500, y: 500, width: 64, height: 64 }; }
    isVisible() { return this.visible; } isDestroyed() { return false; } isMinimized() { return false; }
    show() { this.visible = true; } showInactive() { this.visible = true; } hide() { this.visible = false; }
    focus() { this.emit('focus'); } restore() {} minimize() { this.visible = false; }
  }
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[] };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

// Claude Code : un tour par message reçu, qui ne finit qu'à interrupt().
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt }: { prompt: AsyncIterable<unknown> }) => {
      let stop = () => {};
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          void m;
          await new Promise<void>((ok) => { stop = ok; });
          yield { type: 'result', subtype: 'error_during_execution', is_error: true };
        }
      }()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => { stop(); } });
    },
  }),
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const settle = () => new Promise((r) => setTimeout(r, slow(300)));
let dir = '';
let secret = '';
let c2 = '';

// Ce que la page reçoit : le relevé (conv:vibe) et un fichier suivi, avec ses versions (conv:vibeCode).
type Survey = {
  invariants: { id: string; path: string; base?: string | null }[];
  modules: { path: string; files?: { id: string; path: string }[] }[];
  commits: { hash: string; subject: string; files: string[] }[];
};
type Code = {
  id: string;
  text: string | null;
  at?: { base: string | null; head: string | null; commit?: { before: string | null; after: string | null } };
};
const panel = () => fake.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as Survey;
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as Code | null);
// Les textes de fichier poussés à la page (null : absent, trop gros ou illisible).
const texts = () => codes().flatMap((c) => (c && c.text !== null ? [c.text] : []));
// Tout ce que la page a reçu des fichiers suivis : textes et versions.
const pushed = () => JSON.stringify(codes());
// Le dernier fichier poussé à la page sous cet id.
const lastCode = (id: string) => codes().filter((c) => c?.id === id).at(-1);
// L'id `c<rang>/<i>` que le dernier relevé donne à ce fichier de ce commit ; sans id, le cas ne peut pas commencer.
function commitId(subject: string, rel: string) {
  const rank = survey().commits.findIndex((c) => c.subject === subject);
  const i = rank < 0 ? -1 : survey().commits[rank].files.indexOf(rel);
  if (i < 0) throw new Error(`le relevé ne donne aucun id à ${rel} dans le commit ${subject}`);
  return `c${rank}/${i}`;
}
// L'id que le dernier relevé donne à ce fichier d'un module ; sans id, le cas ne peut pas commencer.
function idOf(rel: string) {
  const f = survey().modules.flatMap((m) => m.files ?? []).find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// Ce que le dernier relevé dit de ce test d'invariant ; sans lui, le cas ne peut pas commencer.
function testOf(rel: string) {
  const f = survey().invariants.find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne pas le test ${rel}`);
  return f;
}
// Le texte d'un fichier du dépôt à un commit, d'après git.
const gitText = (ref: string, rel: string) => git(dir, 'show', `${ref}:${rel}`).toString();
// Le commit où la branche part de main.
const forkPoint = () => git(dir, 'merge-base', 'main', 'HEAD').toString().trim();
// Ce que git voit changé dans le dépôt de l'agent.
const changed = () => git(dir, 'status', '--porcelain').toString();
// Un fichier remplacé par un lien qui mène hors du dossier de l'agent.
const linkOut = (rel: string) => { fs.rmSync(path.join(dir, rel)); fs.symlinkSync(secret, path.join(dir, rel)); };

const HELLO = 'src/core/hello/index.ts';
const GREET = 'src/core/hello/greet.ts';
const NOTE = 'docs/tickets/feat/0.13.0-essai.md';
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const INV_ADDED = 'src/core/hello/tests/invariants/added.test.ts';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-commit-file-')));
  // Hors du dossier de l'agent : un secret.
  secret = path.join(fake.userData, 'secret.ts');
  write(secret, 'SECRET_DEHORS');
  // Le dépôt : un module et son test d'invariant sur main.
  dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  write(path.join(dir, HELLO), 'HELLO_MAIN');
  write(path.join(dir, GREET), 'GREET_MAIN');
  write(path.join(dir, INV), "it('INV_MAIN', () => {});\n");
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  // La branche, trois commits : c1 (la note, hello changé, le test modifié, un test ajouté, greet supprimé),
  // c2 et c3 (hello changé à chaque fois) ; le fichier d'un commit suivi ici : hello dans c2.
  git(dir, 'checkout', '-q', '-b', 'feat/0.13.0-essai');
  write(path.join(dir, NOTE), ['# 0.13.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
    '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n'));
  write(path.join(dir, HELLO), 'HELLO_C1');
  write(path.join(dir, INV), "it('INV_BRANCHE', () => {});\n");
  write(path.join(dir, INV_ADDED), "it('INV_AJOUT', () => {});\n");
  git(dir, 'rm', '-q', GREET);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'c1');
  write(path.join(dir, HELLO), 'HELLO_C2');
  git(dir, 'commit', '-q', '-am', 'c2');
  c2 = git(dir, 'rev-parse', 'HEAD').toString().trim();
  write(path.join(dir, HELLO), 'HELLO_C3');
  git(dir, 'commit', '-q', '-am', 'c3');
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', autonomy: 'guide', pr: null } }],
  }));
});
afterEach(() => { vi.useRealTimers(); });

// L'agent en Relire, sur la PR 7 : la branche d'essai, chargée à sa référence
// locale (comme par le skill charger-pr), sa fiche dans les sorties de l'agent.
function review() {
  git(dir, 'update-ref', 'refs/vibecoder/pr/7', 'HEAD');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  write(path.join(fake.userData, 'vibecoder-out', 'a1', 'pr-7.json'),
    JSON.stringify({ number: 7, title: 'Essai', base: 'main', head: 'feat/0.13.0-essai', state: 'OPEN' }));
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'review', autonomy: 'guide', pr: 7 } }],
  }));
}

// Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
async function open() {
  const { state } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  state.icon = new fake.Win() as never;
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await settle();
}

// La page suit un fichier (ouvert sous sa carte ; null : fermé).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

// Enregistrer (Ctrl+S ou le bouton), tel que la page l'envoie.
async function save(id: unknown, text: unknown) {
  const { saveCode } = await import('app/controllers');
  await saveCode(id, text);
  await settle();
}

describe('un fichier d’un commit ne se suit qu’en Relire, par son id c<rang>/<i> du dernier relevé (I-37 étendu)', () => {
  it('témoin : en Relire, l’id d’un fichier d’un commit, son texte à la tête de la PR est poussé à la page', async () => {
    review();
    await open();

    await follow(commitId('c2', HELLO));

    // la page reçoit le texte que git donne à ce fichier à la tête de la PR
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
  });

  // Créer : sa propre branche, ses commits ne se suivent pas dans le panneau.
  it('en Créer, l’id d’un fichier d’un commit : rien n’est lu', async () => {
    await open();

    await follow(commitId('c2', HELLO));

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
    // sa version à ce commit n'est jamais poussée
    expect(pushed()).not.toContain('HELLO_C2');
  });

  it('en Relire, le chemin du fichier d’un commit à la place de son id : rien n’est lu', async () => {
    review();
    await open();

    await follow(HELLO);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
    // sa version à un commit n'est jamais poussée
    expect(pushed()).not.toContain('HELLO_C2');
  });

  it('en Relire, un id de commit absent du dernier relevé (c99/0) : rien n’est lu', async () => {
    review();
    await open();

    await follow('c99/0');

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('en Relire, un id qui commence comme celui d’un fichier d’un commit puis sort du dossier : le dehors n’est pas lu', async () => {
    review();
    await open();

    await follow(`${commitId('c2', HELLO)}/../../../secret.ts`);

    // le secret du dehors n'est jamais poussé
    expect(pushed()).not.toContain('SECRET_DEHORS');
    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });
});

describe('en Relire, le principal refuse Enregistrer pour un fichier d’un commit, sans se fier à la page (I-37 / I-39 étendus)', () => {
  it('le fichier d’un commit affiché, son id : rien n’est écrit', async () => {
    review();
    await open();
    await follow(commitId('c2', HELLO));

    await save(commitId('c2', HELLO), 'ECRIT_EN_RELIRE');

    // témoin : le fichier du commit est bien affiché
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('le fichier d’un commit affiché, son id : Enregistrer est refusé', async () => {
    const { saveCode } = await import('app/controllers');
    review();
    await open();
    await follow(commitId('c2', HELLO));

    const result = await saveCode(commitId('c2', HELLO), 'ECRIT_EN_RELIRE');

    // témoin : le fichier du commit est bien affiché
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  it('le fichier d’un commit affiché, son chemin à la place de l’id : rien n’est écrit', async () => {
    review();
    await open();
    await follow(commitId('c2', HELLO));

    await save(HELLO, 'ECRIT_EN_RELIRE');

    // témoin : le fichier du commit est bien affiché
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // le dépôt est inchangé
    expect(changed()).toBe('');
  });
});

describe('les versions d’un fichier d’un commit ne se lisent que par git, jamais sur le disque (I-37)', () => {
  it('son texte au parent du commit et au commit : ceux que git donne', async () => {
    review();
    await open();

    await follow(commitId('c2', HELLO));

    // avant le commit : le texte que git donne au parent du commit
    expect(lastCode(commitId('c2', HELLO))?.at?.commit?.before).toBe(gitText(`${c2}^`, HELLO));
    // après : le texte que git donne au commit
    expect(lastCode(commitId('c2', HELLO))?.at?.commit?.after).toBe(gitText(c2, HELLO));
  });

  it('son texte à la base de la PR et à sa tête : ceux que git donne', async () => {
    review();
    await open();

    await follow(commitId('c2', HELLO));

    // à la base : le texte que git donne au point de départ de la PR
    expect(lastCode(commitId('c2', HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // à la tête : le texte que git donne au dernier commit de la PR
    expect(lastCode(commitId('c2', HELLO))?.at?.head).toBe(gitText('HEAD', HELLO));
  });

  // Une copie de travail changée, pas commitée : le disque diffère de la tête de la PR.
  it('le fichier changé sur le disque : son texte sur le disque n’est jamais poussé', async () => {
    review();
    await open();
    write(path.join(dir, HELLO), 'HELLO_DISQUE');

    await follow(commitId('c2', HELLO));

    // témoin : le texte à la tête de la PR est bien poussé
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // le texte du disque n'est jamais poussé
    expect(pushed()).not.toContain('HELLO_DISQUE');
  });

  it('le fichier remplacé sur le disque par un lien qui sort du dossier : le dehors n’est pas lu', async () => {
    review();
    await open();
    linkOut(HELLO);

    await follow(commitId('c2', HELLO));

    // témoin : le texte à la tête de la PR est bien poussé
    expect(lastCode(commitId('c2', HELLO))?.text).toBe(gitText('HEAD', HELLO));
    // le secret du dehors n'est jamais poussé
    expect(pushed()).not.toContain('SECRET_DEHORS');
  });
});

describe('la version de base d’un fichier supprimé ne se lit que par git (I-37)', () => {
  it('un fichier du module supprimé par la branche : son texte à la base est celui que git donne', async () => {
    await open();

    await follow(idOf(GREET));

    // la page reçoit le texte que git donne au fichier au point de départ de la branche
    expect(lastCode(idOf(GREET))?.at?.base).toBe(gitText(forkPoint(), GREET));
  });

  it('le chemin d’un fichier supprimé à la place de son id : sa version à la base n’est pas lue', async () => {
    await open();

    await follow(GREET);

    // son texte à la base de la branche n'est jamais poussé
    expect(pushed()).not.toContain('GREET_MAIN');
  });
});

describe('la version de base d’un test d’invariant ne se lit que par git (I-37)', () => {
  // Le test changé sur le disque, pas commité : ni le disque ni le dernier commit ne sont sa base.
  it('en Créer, un test que la branche modifie : sa base est le texte que git lui donne au départ de la branche', async () => {
    write(path.join(dir, INV), "it('INV_DISQUE', () => {});\n");
    await open();

    const base = testOf(INV).base;

    // le relevé porte le texte que git donne au test au point de départ de la branche
    expect(base).toBe(gitText(forkPoint(), INV));
  });

  // Absent à la base : git n'a rien à donner, le disque n'est pas lu à sa place.
  it('en Créer, un test ajouté par la branche : pas de base', async () => {
    await open();

    const base = testOf(INV_ADDED).base;

    // aucun texte de base pour un test que la base n'a pas
    expect(base ?? null).toBeNull();
  });

  it('en Relire, un test que la PR modifie : sa base est le texte que git lui donne au départ de la PR', async () => {
    review();
    await open();

    const base = testOf(INV).base;

    // le relevé porte le texte que git donne au test au point de départ de la PR
    expect(base).toBe(gitText(forkPoint(), INV));
  });
});
