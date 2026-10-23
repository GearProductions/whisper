// Invariants de Voir le code (note 0.11.0,
// docs/tickets/feat/0.11.0-code-des-modules.md, « Ce que ça ne doit pas
// faire ») :
//   - la page ne désigne un fichier du module que par son id dans le dernier
//     relevé, jamais par un chemin ; le principal ne lit que le fichier
//     ouvert, d'un module touché par la branche, rien hors du dossier de
//     l'agent (I-37, élargi aux fichiers des modules) ;
//   - Enregistrer n'écrit que le fichier affiché, désigné par son id, dans le
//     dossier de l'agent, et seulement au geste de l'utilisateur (exception à
//     I-39) ;
//   - pas d'enregistrement pendant une course qui génère le module ni pendant
//     un tour de la conversation (le principal recalcule codeLock avant
//     d'écrire, sans se fier à la page).
// Note 0.11.0 (docs/tickets/feat/0.11.0-editer-invariants-et-note.md) : la
// note et les tests d'invariants de la branche se lisent aussi par leur id, en
// Créer seulement (I-37 élargi ; adapté avec accord) — ici la note, en Créer
// et en Relire ; le reste : note-and-tests-save.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, un lien réel qui sort du dossier de
// l'agent) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie) et le
// SDK de Claude Code (chaque message reçu ouvre un tour, sans rien écrire, qui
// dure jusqu'à interrupt()). Ce que la page
// voit d'un fichier : les conv:vibeCode poussés au panneau.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  // Chaque tour reçu par Claude Code : le skill appelé (ou le premier mot du message), et s'il est fini.
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], turns: [] as { skill: string; done: boolean }[] };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

// Claude Code : un tour par message reçu, relevé, qui ne finit qu'à interrupt().
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt }: { prompt: AsyncIterable<{ message: { content: unknown } }> }) => {
      let stop = () => {};
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          const turn = { skill: String(m.message.content).split(' ')[0], done: false };
          fake.turns.push(turn);
          await new Promise<void>((ok) => { stop = ok; });
          turn.done = true;
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
const settle = () => new Promise((r) => setTimeout(r, 300));
let dir = '';
let secret = '';

// Ce que la page reçoit : le relevé (conv:vibe) et le texte d'un fichier (conv:vibeCode).
type Survey = {
  note: { id: string } | null;
  modules: { path: string; file: { id: string } | null; files: { id: string; path: string }[] }[];
};
const panel = () => fake.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as Survey;
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as { id: string; text: string | null } | null);
// Les textes de fichier poussés à la page (null : trop gros ou illisible, pas un texte).
const texts = () => codes().flatMap((c) => (c && c.text !== null ? [c.text] : []));
// L'id que le dernier relevé donne à ce fichier d'un module ; sans id, le cas ne peut pas commencer.
function idOf(rel: string) {
  const f = survey().modules.flatMap((m) => m.files ?? []).find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// L'id que le dernier relevé donne à la note ; sans id, le cas ne peut pas commencer.
function noteId() {
  const n = survey().note;
  if (!n) throw new Error('le relevé ne donne aucune note');
  return n.id;
}
// Les skills (ou premiers mots) des tours en cours.
const inProgress = () => fake.turns.filter((t) => !t.done).map((t) => t.skill);
// Le rang d'un module dans le dernier relevé (VibeArgs.module).
const rankOf = (modulePath: string) => survey().modules.findIndex((m) => m.path === modulePath);
// Ce que git voit changé dans le dépôt de l'agent.
const changed = () => git(dir, 'status', '--porcelain').toString();
// Un fichier remplacé par un lien qui mène hors du dossier de l'agent.
const linkOut = (rel: string) => { fs.rmSync(path.join(dir, rel)); fs.symlinkSync(secret, path.join(dir, rel)); };

const HELLO = 'src/core/hello/index.ts';
const GREET = 'src/core/hello/greet.ts';
const NOTE = 'docs/tickets/feat/0.11.0-essai.md';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.turns = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-module-code-')));
  // Hors du dossier de l'agent : un secret.
  secret = path.join(fake.userData, 'secret.ts');
  write(secret, 'SECRET_DEHORS');
  // Le dépôt : deux modules sur main ; la branche, sa note (sa Forme les nomme), touche le premier seulement.
  dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  write(path.join(dir, HELLO), 'HELLO_MAIN');
  write(path.join(dir, GREET), 'GREET_MAIN');
  write(path.join(dir, 'src/core/autre/index.ts'), 'AUTRE_TEXTE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', 'feat/0.11.0-essai');
  write(path.join(dir, NOTE), ['# 0.11.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
    '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', 'src/core/autre    autre() · ne connaît pas : le DOM', '```', ''].join('\n'));
  write(path.join(dir, HELLO), 'HELLO_TEXTE');
  write(path.join(dir, GREET), 'GREET_TEXTE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'hello');
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
    JSON.stringify({ number: 7, title: 'Essai', base: 'main', head: 'feat/0.11.0-essai', state: 'OPEN' }));
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

// La page suit un fichier (l'accordéon déplié sur lui ; null : replié).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

// Un clic sur une action de l'écran (Générer ce module, Générer les modules restants…).
async function click(id: string, args: object = {}) {
  const { runVibeAction } = await import('app/controllers');
  runVibeAction(id, args);
  await settle();
}

// Un message envoyé à la conversation par le champ : un tour commence.
async function ask(text: string) {
  const { sendDraft } = await import('app/controllers');
  sendDraft({ text });
  await settle();
}

// Enregistrer (Ctrl+S ou le bouton), tel que la page l'envoie.
async function save(id: unknown, text: unknown) {
  const { saveCode } = await import('app/controllers');
  await saveCode(id, text);
  await settle();
}

describe('Voir le code : le principal ne lit que le fichier ouvert, d’un module touché (ou en Créer la note), dans le dossier de l’agent (I-37)', () => {
  it('témoin : l’id d’un fichier d’un module touché, son texte est poussé à la page', async () => {
    await open();

    await follow(idOf(HELLO));

    // la page reçoit le texte du fichier tel qu'il est sur le disque
    expect(texts()).toContain(fs.readFileSync(path.join(dir, HELLO), 'utf8'));
  });

  it('le relevé ne donne aucun fichier à un module que la branche ne touche pas', async () => {
    await open();

    const autre = survey().modules.find((m) => m.path === 'src/core/autre')!;

    // aucun id à suivre pour ce module
    expect(autre.files).toEqual([]);
  });

  it('le relevé liste les fichiers d’un module touché, sans leur texte', async () => {
    await open();

    const sent = JSON.stringify(survey());

    // témoin : le fichier touché est bien listé, par son chemin
    expect(survey().modules.flatMap((m) => m.files ?? []).map((f) => f.path)).toContain(HELLO);
    // son texte n'y est pas
    expect(sent).not.toContain('HELLO_TEXTE');
    // celui de l'autre fichier touché non plus
    expect(sent).not.toContain('GREET_TEXTE');
  });

  it('un chemin du dépôt à la place d’un id : rien n’est lu', async () => {
    await open();

    await follow(HELLO);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un chemin relatif qui sort du dossier (../secret.ts) : rien n’est lu', async () => {
    await open();

    await follow('../secret.ts');

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un chemin absolu hors du dossier : rien n’est lu', async () => {
    await open();

    await follow(secret);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('l’id de la note, en Créer : son texte est poussé à la page', async () => {
    await open();

    await follow(survey().note!.id);

    // la page reçoit la note telle qu'elle est sur le disque
    expect(texts()).toContain(fs.readFileSync(path.join(dir, NOTE), 'utf8'));
  });

  // Relire : la PR d'un autre, sa note ne se lit pas pour être modifiée.
  it('l’id de la note, en Relire : rien n’est lu', async () => {
    review();
    await open();

    await follow(noteId());

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('l’id du dossier d’un module que la branche ne touche pas : rien n’est lu', async () => {
    await open();

    await follow(survey().modules.find((m) => m.path === 'src/core/autre')!.file!.id);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  // Le relevé a listé le fichier ; il devient ensuite un lien vers le dehors.
  it('un fichier du module remplacé, après le relevé, par un lien qui sort du dossier : le dehors n’est pas lu', async () => {
    await open();
    const id = idOf(GREET);
    linkOut(GREET);

    await follow(id);

    // le secret du dehors n'est jamais poussé
    expect(JSON.stringify(codes())).not.toContain('SECRET_DEHORS');
  });

  it('un autre fichier du module, changé sur le disque, n’est pas lu : seul l’ouvert l’est', async () => {
    await open();
    await follow(idOf(HELLO));

    write(path.join(dir, GREET), 'GREET_CHANGE');
    await settle();

    // le nouveau texte de l'autre fichier n'est jamais poussé
    expect(JSON.stringify(codes())).not.toContain('GREET_CHANGE');
    // son ancien texte non plus
    expect(JSON.stringify(codes())).not.toContain('GREET_TEXTE');
  });

  it('l’accordéon replié (null) : le fichier changé sur le disque n’est plus lu', async () => {
    await open();
    await follow(idOf(HELLO));
    await follow(null);

    write(path.join(dir, HELLO), 'HELLO_CHANGE');
    await settle();

    // le nouveau texte n'est jamais poussé
    expect(JSON.stringify(codes())).not.toContain('HELLO_CHANGE');
  });
});

describe('Enregistrer n’écrit que le fichier affiché, par son id, dans le dossier de l’agent, au geste (exception à I-39)', () => {
  it('témoin : le fichier affiché, par son id, reçoit le texte', async () => {
    await open();
    await follow(idOf(HELLO));

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // le fichier sur le disque porte le texte enregistré
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_ENREGISTRE');
    // et rien d'autre n'a changé dans le dépôt
    expect(changed()).toBe(` M ${HELLO}\n`);
  });

  it('l’id d’un autre fichier du module que celui affiché : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));

    await save(idOf(GREET), 'GREET_ENREGISTRE');

    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('aucun fichier affiché : rien n’est écrit', async () => {
    await open();

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('un chemin du dépôt à la place de l’id : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));

    await save(HELLO, 'HELLO_ENREGISTRE');

    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('un chemin qui sort du dossier (../secret.ts) à la place de l’id : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));

    await save('../secret.ts', 'ECRIT_DEHORS');

    // le fichier du dehors est inchangé
    expect(fs.readFileSync(secret, 'utf8')).toBe('SECRET_DEHORS');
  });

  it('un chemin absolu hors du dossier à la place de l’id : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));

    await save(secret, 'ECRIT_DEHORS');

    // le fichier du dehors est inchangé
    expect(fs.readFileSync(secret, 'utf8')).toBe('SECRET_DEHORS');
  });

  // Affiché, puis remplacé par un lien vers le dehors avant Enregistrer.
  it('le fichier affiché remplacé par un lien qui sort du dossier : le dehors n’est pas écrit', async () => {
    await open();
    await follow(idOf(GREET));
    const id = idOf(GREET);
    linkOut(GREET);

    await save(id, 'ECRIT_DEHORS');

    // le fichier du dehors est inchangé
    expect(fs.readFileSync(secret, 'utf8')).toBe('SECRET_DEHORS');
  });

  it('sans geste : suivre un fichier, relever, le voir changer sur le disque n’écrit rien', async () => {
    const { refreshVibe } = await import('app/controllers');
    await open();
    await follow(idOf(HELLO));

    await refreshVibe({ now: true });
    await settle();
    write(path.join(dir, HELLO), 'HELLO_CHANGE');
    await settle();
    await refreshVibe({ now: true });
    await settle();

    // seul le changement fait sur le disque apparaît, avec son texte
    expect(changed()).toBe(` M ${HELLO}\n`);
    // le fichier porte ce texte-là, rien n'est venu l'écraser
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_CHANGE');
  });
});

describe('pas d’enregistrement pendant une course qui génère le module ni pendant un tour : le principal recalcule codeLock, sans se fier à la page', () => {
  it('une course qui génère ce module (Générer ce module) : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));
    await click('module', { module: rankOf('src/core/hello') });

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // témoin : la génération de ce module travaille
    expect(inProgress()).toContain('/vibecoder:module');
    // le fichier sur le disque est inchangé
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_TEXTE');
  });

  it('une course qui génère ce module : Enregistrer est refusé', async () => {
    const { saveCode } = await import('app/controllers');
    await open();
    await follow(idOf(HELLO));
    await click('module', { module: rankOf('src/core/hello') });

    const result = await saveCode(idOf(HELLO), 'HELLO_ENREGISTRE');

    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  // '*' : la course retient tous les modules.
  it('une course qui génère les modules restants (Générer les modules restants) : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));
    await click('modules');

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // témoin : la génération des modules restants travaille
    expect(inProgress()).toContain('/vibecoder:modules');
    // le fichier sur le disque est inchangé
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_TEXTE');
  });

  it('une course qui génère les modules restants : Enregistrer est refusé', async () => {
    const { saveCode } = await import('app/controllers');
    await open();
    await follow(idOf(HELLO));
    await click('modules');

    const result = await saveCode(idOf(HELLO), 'HELLO_ENREGISTRE');

    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  it('un tour de la conversation en cours : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));
    await ask('corrige hello');

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // témoin : le tour de la conversation travaille
    expect(inProgress()).toContain('corrige');
    // le fichier sur le disque est inchangé
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_TEXTE');
  });

  it('un tour de la conversation en cours : Enregistrer est refusé', async () => {
    const { saveCode } = await import('app/controllers');
    await open();
    await follow(idOf(HELLO));
    await ask('corrige hello');

    const result = await saveCode(idOf(HELLO), 'HELLO_ENREGISTRE');

    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  // Témoin de la règle : seule la course de ce module (ou de tous) retient l'enregistrement.
  it('une course qui génère un autre module : le fichier affiché est enregistré', async () => {
    await open();
    await follow(idOf(HELLO));
    await click('module', { module: rankOf('src/core/autre') });

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // témoin : la génération de l'autre module travaille
    expect(inProgress()).toContain('/vibecoder:module');
    // le fichier sur le disque porte le texte enregistré
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_ENREGISTRE');
  });
});
