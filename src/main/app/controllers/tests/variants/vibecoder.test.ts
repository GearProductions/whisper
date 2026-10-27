// Variants du contrôleur de VibeCoder (note 0.8.0) : ce que le relevé lit et
// envoie au panneau, et le chemin d'une action jusqu'à l'agent.
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, core) ; faux : Electron (fenêtres qui relèvent ce qu'on leur
// envoie), le SDK de Claude Code (relève les messages), git (ses faits, réglés
// par le cas), les fichiers livrés (ceux du dépôt) et le parcours (vibeView
// rend ce qu'il reçoit, pour le regarder).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneyInput } from 'core/vibecoder';

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
  return {
    Win, userData: '', windows: [] as InstanceType<typeof Win>[], facts: null as unknown, messages: [] as unknown[],
    shown: null as string | null, diff: null as string | null, edited: [] as unknown[][], opened: [] as string[],
    tabs: [] as (string | null)[], steps: [] as { id: string; status: string }[],
    git: (() => null) as (args: string[]) => string | null, calls: [] as unknown[][],
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: { openExternal: (url: string) => { fake.opened.push(url); } }, dialog: {}, clipboard: {}, nativeImage: {},
}));

// Claude Code : chaque message reçu est relevé, et le tour finit aussitôt.
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt }: { prompt: AsyncIterable<{ message: { content: unknown } }> }) => Object.assign((async function* run() {
      for await (const m of prompt) {
        fake.messages.push(m.message.content);
        yield { type: 'result', subtype: 'success', is_error: false, result: 'ok' };
      }
    }()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => {} }),
  }),
}));

vi.mock('technicals/git', () => ({
  gitRun: () => async (args: string[]) => fake.git(args),
  gitReader: () => ({ facts: async () => fake.facts, show: async () => fake.shown, commit: async () => fake.diff }),
  okRef: (ref: string) => /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]+$/.test(ref),
}));

// L'éditeur : relève ce qu'on lui fait ouvrir.
vi.mock('technicals/editor', () => ({
  findEditor: () => ({ name: 'éditeur', open: () => {}, openFile: (file: string, line?: number) => { fake.edited.push([file, line]); } }),
}));

// Les fichiers livrés : ceux du dépôt (resources/).
vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

vi.mock('core/vibecoder', async (original) => ({
  ...await original<typeof import('core/vibecoder')>(),
  vibeView: (input: JourneyInput) => ({
    ...input, pr: input.pr && { number: input.pr }, steps: fake.steps, commits: input.repo?.commits ?? [], invariants: [], variants: [], modules: [], questions: [],
    checklist: [{ text: 'Chaque diff a été relu', done: null, manual: true }, { text: 'La note est à jour', done: false }],
    actions: input.actions.map((a) => ({
      ...a, who: input.who[a.id], model: input.model[a.id], models: input.model[a.id] ? ['haiku', 'sonnet', 'opus'] : [], primary: false, disabled: null,
    })),
  }),
}));

// Les actions directes, la recette et les worktrees : relevés (0.12.0-worktrees).
const OK = { ok: true, line: 'ok', detail: '' };
vi.mock('technicals/direct', async (original) => ({
  ...await original<typeof import('technicals/direct')>(),
  directRunner: ({ out: o }: { out: string }) => ({
    loadPr: async (n: number) => {
      fake.calls.push(['loadPr', n]);
      fs.writeFileSync(path.join(o, `pr-${n}.json`), JSON.stringify({ number: n, head: 'feat/x', base: 'main' }));
      return OK;
    },
    fetchBranch: async (b: string) => { fake.calls.push(['fetch', b]); return OK; },
    switchTo: async (b: string) => { fake.calls.push(['switch', b]); return OK; },
    toBase: async (b: string, base: string) => { fake.calls.push(['toBase', b, base]); return OK; },
  }),
}));
vi.mock('app/controllers/recipe', async (original) => ({
  ...await original<typeof import('app/controllers/recipe')>(),
  createWorktree: async (home: { id: string }, w: unknown) => {
    fake.calls.push(['createWorktree', home.id, w]);
    return { ok: true, line: 'worktree créé', dir: '/wt' };
  },
}));
vi.mock('app/controllers/worktrees', async (original) => ({
  ...await original<typeof import('app/controllers/worktrees')>(),
  prWorktreeReady: async (a: { id: string }, ...rest: unknown[]) => { fake.calls.push(['prWorktreeReady', a.id, ...rest]); },
  removeWorktreeChild: async (a: { id: string }) => { fake.calls.push(['removeWorktreeChild', a.id]); return { ok: true, line: 'worktree retiré' }; },
  // L'enfant de la nouvelle demande : enregistré, en Créer.
  openChild: async (parent: { id: string }, dir: string, o: unknown) => {
    fake.calls.push(['openChild', parent.id, dir, o]);
    const { loadConfig, saveConfig } = await import('app/settings');
    const child = { id: 'c1', dir, name: 'enfant', model: '', effort: '', mode: 'default', sessionId: null, parent: { id: parent.id },
      view: 'vibecoder' as const, vibe: { flow: 'create' as const, pr: null } };
    saveConfig({ agents: [...loadConfig().agents, child] });
    return child;
  },
}));

// Les courses : vraies ; runsTab relevé au passage.
vi.mock('app/controllers/runs', async (original) => {
  const runs = await original<typeof import('app/controllers/runs')>();
  return { ...runs, runsTab: (id: string | null) => { fake.tabs.push(id); runs.runsTab(id); } };
});

const NOTE = '# 0.8.0 — essai\n\n## Ce que ça fait\n\n- un essai\n';
const TEST = 'it(\'un cas\', () => {});\n';
const settle = () => new Promise((r) => setTimeout(r, 150));
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
let dir = '';
let out = '';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.messages = [];
  fake.edited = [];
  fake.shown = null;
  fake.diff = null;
  fake.opened = [];
  fake.tabs = [];
  fake.steps = [];
  fake.git = () => null;
  fake.calls = [];
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-vibecoder-'));
  dir = path.join(fake.userData, 'projet');
  out = path.join(fake.userData, 'vibecoder-out', 'a1');   // les sorties de l'agent
  write(path.join(dir, 'docs/tickets/feat/0.8.0-essai.md'), NOTE);
  write(path.join(dir, 'src/x/tests/invariants/x.test.ts'), TEST);
  fake.facts = {
    branch: 'feat/0.8.0-essai', base: 'origin/main', head: 'h', commits: [],
    changed: ['docs/tickets/feat/0.8.0-essai.md', 'src/x/tests/invariants/x.test.ts'],
  };
  write(path.join(out, 'ponytail.md'), '- rien à redire\n');
  write(path.join(out, 'secret.txt'), 'pas une sortie');
  write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), JSON.stringify([
    { id: 'checks', flow: 'create', step: 'revue', kind: 'send', label: 'Lancer les vérifications', text: '/vibecoder:verifier {{lang}} {{out}}' },
    { id: 'ask', flow: 'both', step: null, kind: 'send', needs: 'text', label: 'Demander', text: '{{text}} (PR {{pr}})' },
  ]));
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null, view: 'vibecoder' }],
  }));
});
afterEach(() => { vi.useRealTimers(); });

// Le panneau ouvert sur l'agent, la page prête : ses relevés reçus.
async function open() {
  const { state } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  state.icon = new fake.Win() as never;
  openConversation('a1');
  const panel = fake.windows.at(-1)!;
  panel.emit('ready-to-show');
  await panelReady();
  await settle();
  const vibes = () => panel.sent.filter(([ch]) => ch === 'conv:vibe').map(([, v]) => v as JourneyInput | null);
  return { vibes, view: () => vibes().at(-1) };
}

describe('le relevé', () => {
  it('lit la note du ticket, les tests de la branche et leur lecture, les sorties sous leurs noms connus', async () => {
    const { blobSha } = await import('core/vibecoder');
    write(path.join(out, 'invariants', `${blobSha(TEST)}.md`), '# lecture\n');
    write(path.join(out, 'invariants', `${'f'.repeat(40)}.md`), '# une version précédente\n');   // toutes les lectures
    write(path.join(out, 'invariants', 'notes.md'), 'pas une lecture');                        // pas un nom connu
    const v = (await open()).view()!;
    expect(v.note).toMatchObject({ path: 'docs/tickets/feat/0.8.0-essai.md', text: NOTE, before: null });
    expect(v.tests).toEqual([{ path: 'src/x/tests/invariants/x.test.ts', blob: blobSha(TEST), text: TEST }]);
    expect(v.readings).toHaveLength(2);
    expect(v.readings).toEqual(expect.arrayContaining([
      { blob: blobSha(TEST), text: '# lecture\n', time: expect.any(Number) },
      { blob: 'f'.repeat(40), text: '# une version précédente\n', time: expect.any(Number) },
    ]));
    expect(Object.keys(v.outputs)).toEqual(['ponytail.md']); // secret.txt : pas un nom connu
  });

  it.skipIf(process.platform === 'win32')('une sortie qui est un lien n’est pas lue', async () => {
    write(path.join(fake.userData, 'dehors.md'), 'hors du dossier de sorties');
    fs.symlinkSync(path.join(fake.userData, 'dehors.md'), path.join(out, 'review.md'));
    expect((await open()).view()!.outputs).not.toHaveProperty('review.md');
  });

  it('un fichier d’actions vide ([]) : aucun bouton, pas ceux livrés', async () => {
    write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), '[]');
    expect((await open()).view()!.actions).toEqual([]);
  });

  it('un fichier d’actions illisible : ceux livrés', async () => {
    write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), '[ pas du json');
    expect((await open()).view()!.actions.map((a) => a.id)).toContain('note');
  });

  it('git introuvable ou pas un dépôt : le relevé part quand même, et dit pourquoi', async () => {
    fake.facts = null;
    const v = (await open()).view()!;
    expect(v).toMatchObject({ repo: null, note: null, tests: [] });
    expect(v.error).toEqual(expect.any(String));
  });

  it('list (0.11.0) : les fichiers d’un dossier et de ses sous-dossiers, relatifs au dépôt ; ni lien, ni caché, ni dehors', async () => {
    write(path.join(dir, 'src/m/index.ts'), 'a');
    write(path.join(dir, 'src/m/sous/b.ts'), 'b');
    write(path.join(dir, 'src/m/.cache/c.ts'), 'c');
    write(path.join(dir, 'src/m/.env'), 'd');
    write(path.join(fake.userData, 'dehors.ts'), 'dehors');
    if (process.platform !== 'win32') {
      fs.symlinkSync(path.join(fake.userData, 'dehors.ts'), path.join(dir, 'src/m/lien.ts'));
      fs.symlinkSync(fake.userData, path.join(dir, 'src/m/lien-dossier'));
    }
    const { list } = (await open()).view()!;
    expect(list!('src/m').sort()).toEqual(['src/m/index.ts', 'src/m/sous/b.ts']);
    expect(list!('src/m/index.ts')).toEqual(['src/m/index.ts']);   // un fichier : lui-même
    expect(list!('../dehors.ts')).toEqual([]);
    expect(list!(path.join(fake.userData, 'dehors.ts'))).toEqual([]);
    expect(list!('src/absent')).toEqual([]);
    const { lastView } = await import('app/controllers');
    expect(lastView('a1')).toMatchObject({ agentId: 'a1' });
    expect(lastView('inconnu')).toBeNull();
  });

  it('list : sans node_modules, target, dist ni build ; au plus 1 000 fichiers, les premiers trouvés', async () => {
    write(path.join(dir, 'src/m/index.ts'), 'a');
    for (const d of ['node_modules', 'target', 'dist', 'build', 'sous/node_modules']) write(path.join(dir, 'src/m', d, 'x.js'), 'x');
    write(path.join(dir, 'src/m/dist.ts'), 'un fichier, pas un dossier');
    for (let i = 0; i < 1005; i++) write(path.join(dir, 'src/n', `f${i}.ts`), '');
    const { list } = (await open()).view()!;
    expect(list!('src/m').sort()).toEqual(['src/m/dist.ts', 'src/m/index.ts']);
    expect(list!('src/n')).toHaveLength(1000);
  });

  it('une action qui génère des modules : sa course retient le module (runModule → startRun)', async () => {
    write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), JSON.stringify([
      { id: 'modules', flow: 'create', step: 'modules', kind: 'send', label: 'Générer les modules restants', text: '/vibecoder:modules {{lang}} {{out}}' },
    ]));
    await open();
    const { runVibeAction, lockingRuns } = await import('app/controllers');
    expect(runVibeAction('modules', {})).toEqual({ ok: true });
    expect(lockingRuns('a1')).toEqual([expect.objectContaining({ id: 'modules', module: '*' })]);
    await settle();
  });

  it('revenu à la conversation : null, une fois', async () => {
    const { vibes } = await open();
    const { pushAgents, setVibe } = await import('app/controllers');
    setVibe({ view: 'conversation' });
    pushAgents();
    await settle();
    expect(vibes().filter((v) => v === null)).toHaveLength(1);
    expect(vibes().at(-1)).toBeNull();
    const { loadConfig } = await import('app/settings');
    expect(loadConfig().agents[0]).not.toHaveProperty('view');
  });
});

describe('une action', () => {
  it('refusée si la page passe autre chose que ses arguments, ou une action inconnue', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('ask', { text: 'une question', pr: '12; rm -rf ~' })).toMatchObject({ ok: false });
    expect(runVibeAction('ask', { text: 'x'.repeat(20001), pr: 12 })).toMatchObject({ ok: false });
    expect(runVibeAction('checks', 'pas un objet')).toMatchObject({ ok: false });
    expect(runVibeAction('inconnue', {})).toMatchObject({ ok: false });
    await settle();
    expect(fake.messages).toEqual([]);
  });

  it('une action d’étape court à part : son gabarit rempli, rien d’autre ; à sa fin, l’avis à la conversation', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('checks', {})).toEqual({ ok: true });
    await settle();
    expect(fake.messages).toEqual([`/vibecoder:verifier fr ${out}`, expect.stringMatching(/^VibeCoder : « Lancer les vérifications » terminée — ok\. /)]);
  });

  it('{{prefix}} : le préfixe des commandes vu de l’agent qui reçoit le message (0.9.0)', async () => {
    write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), JSON.stringify([
      { id: 'checks', flow: 'create', step: 'revue', kind: 'send', label: 'Lancer les vérifications', text: '/vibecoder:verifier {{lang}} {{out}} {{prefix}}' },
    ]));
    const cfgFile = path.join(fake.userData, 'config.json');
    write(cfgFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(cfgFile, 'utf8')), vibeCommandPrefix: 'distrobox enter dev --' }));
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('checks', {})).toEqual({ ok: true });
    await settle();
    expect(fake.messages[0]).toBe(`/vibecoder:verifier fr ${out} distrobox enter dev --`);
  });
});

describe('followBranch : les sorties de Créer suivent la branche', () => {
  const at = (...p: string[]) => path.join(out, ...p);
  const has = (...p: string[]) => fs.existsSync(at(...p));
  // Sur feat/a : ce que ses skills ont écrit, une lecture d'invariants et une fiche de PR (Relire).
  async function onA() {
    const { followBranch } = await import('app/controllers');
    write(at('.branche'), 'feat/a');
    write(at('questions.md'), '## 1. a ?\n');
    write(at('review.md'), 'relu sur a\n');
    write(at('invariants', `${'0'.repeat(40)}.md`), '# lecture\n');
    write(at('pr-3.json'), '{}');
    return followBranch;
  }

  it('d’une feature à une autre : les sorties de la première sont mises de côté, les lectures et les PR restent', async () => {
    (await onA())(out, 'feat/b', 'origin/main');
    expect([has('questions.md'), has('review.md'), has('branches', 'feat-a', 'questions.md'), has('branches', 'feat-a', 'review.md')])
      .toEqual([false, false, true, true]);
    expect([has('invariants', `${'0'.repeat(40)}.md`), has('pr-3.json'), fs.readFileSync(at('.branche'), 'utf8')]).toEqual([true, true, 'feat/b']);
  });

  it('d’une feature à la base : la base ne voit pas les sorties de la feature', async () => {
    (await onA())(out, 'main', 'origin/main');
    expect([has('questions.md'), has('branches', 'feat-a', 'questions.md')]).toEqual([false, true]);
  });

  it('de la base à une nouvelle branche : rien ne bouge (la feature garde ce que ses skills ont écrit)', async () => {
    const { followBranch } = await import('app/controllers');
    write(at('.branche'), 'main');
    write(at('questions.md'), '## 1. a ?\n');
    followBranch(out, 'feat/0.9.0-x', 'origin/main');
    expect([has('questions.md'), has('branches')]).toEqual([true, false]);
  });

  it('revenir sur une feature rend ses sorties, et met de côté celles de la branche quittée', async () => {
    const followBranch = await onA();
    followBranch(out, 'feat/b', 'origin/main');
    write(at('review.md'), 'relu sur b\n');
    followBranch(out, 'feat/a', 'origin/main');
    expect([fs.readFileSync(at('review.md'), 'utf8'), has('questions.md'), has('branches', 'feat-a')]).toEqual(['relu sur a\n', true, false]);
    expect(fs.readFileSync(at('branches', 'feat-b', 'review.md'), 'utf8')).toBe('relu sur b\n');
  });
});

// L'agent en Relire, sur la PR 12.
function review() {
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'review', autonomy: 'guide', pr: 12 } }],
  }));
}
const HASH = 'a'.repeat(40);

describe('rc.2', () => {
  it('une action sur un autre modèle : la variante de son skill ; un modèle hors des choix : ignoré, rendu dans ignored (0.11.0)', async () => {
    write(path.join(fake.userData, 'vibecoder', 'plugin', 'skills', 'verifier', 'SKILL.md'), '---\ncontext: fork\nmodel: haiku\n---\n');
    await open();
    const { runVibeAction, startAction, vibeAgent, lastView } = await import('app/controllers');
    const { loadConfig, vibeActions } = await import('app/settings');
    const agent = vibeAgent()!;
    const def = vibeActions('fr').find((a) => a.id === 'checks')!;
    expect(startAction(agent, def, { model: 'fable' }, lastView('a1')!, loadConfig())).toEqual({ ok: true, ignored: ['model'] });
    await settle();
    expect(fake.messages[0]).toBe(`/vibecoder:verifier fr ${out}`);
    fake.messages = [];
    expect(runVibeAction('checks', { model: 'sonnet' })).toEqual({ ok: true });
    await settle();
    expect(fake.messages[0]).toBe(`/vibecoder:verifier--sonnet fr ${out}`);
  });

  it('les variantes des skills : générées à côté, hors manifeste, réécrites à chaque démarrage', async () => {
    const { ensureVibeFiles } = await import('app/settings');
    const variant = path.join(fake.userData, 'vibecoder', 'plugin', 'skills', 'aligner--haiku', 'SKILL.md');
    ensureVibeFiles();
    expect(fs.readFileSync(variant, 'utf8')).toContain('\nmodel: haiku\neffort: low\n');
    expect(Object.keys(JSON.parse(fs.readFileSync(path.join(fake.userData, 'vibecoder', '.defaults.json'), 'utf8')))
      .filter((k) => k.includes('--'))).toEqual([]);
    fs.writeFileSync(variant, 'retouché');
    ensureVibeFiles();
    expect(fs.readFileSync(variant, 'utf8')).toContain('\nmodel: haiku\n');
  });

  it('le brouillon de revue : une remarque modifiée sur place ; un texte vide ne la change pas', async () => {
    review();
    await open();
    const { draftVibe } = await import('app/controllers');
    const { vibeStore } = await import('app/settings');
    draftVibe({ add: { target: 'note', text: 'trop vague' } });
    draftVibe({ edit: { id: 1, text: 'la forme est trop vague' } });
    draftVibe({ edit: { id: 1, text: '  ' } });
    expect(vibeStore().drafts.a1[12]).toEqual([{ id: 1, target: 'note', text: 'la forme est trop vague' }]);
  });

  it('Relire : un fichier d\'un commit, à la tête de la PR, écrit en lecture seule sous files/ et ouvert à la ligne', async () => {
    review();
    fake.facts = { ...fake.facts as object, commits: [{ hash: HASH, subject: 'core/x', files: ['src/x.ts'] }] };
    fake.shown = 'export const x = 1;\n';
    await open();
    const { openVibeItem } = await import('app/controllers');
    await openVibeItem('c0/0', 7);
    const file = path.join(out, 'files', 'pr-12', 'src', 'x.ts');
    expect(fake.edited).toEqual([[fs.realpathSync.native(file), 7]]);
    expect(fs.readFileSync(file, 'utf8')).toBe(fake.shown);
    if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o444);
    await openVibeItem('c0/0', 7);   // déjà là, en lecture seule : remplacé
    expect(fake.edited).toHaveLength(2);
  });

  it('un commit : son diff écrit sous files/ et ouvert ; gh: sa page GitHub, d\'après l\'origine du dépôt', async () => {
    write(path.join(dir, '.git', 'config'), '[remote "origin"]\n\turl = git@github.com:o/d.git\n');
    fake.facts = { ...fake.facts as object, commits: [{ hash: HASH, subject: 'core/x', files: [] }] };
    fake.diff = 'commit aaaa\n+x\n';
    await open();
    const { openVibeItem } = await import('app/controllers');
    await openVibeItem('c0');
    await openVibeItem('gh:c0');
    expect(fake.edited).toEqual([[fs.realpathSync.native(path.join(out, 'files', `${HASH}.diff`)), undefined]]);
    expect(fake.opened).toEqual([`https://github.com/o/d/commit/${HASH}`]);
  });

  it('Créer : un fichier d\'un commit, la copie de travail ; un chemin à la place d\'un id : rien', async () => {
    write(path.join(dir, 'src', 'x.ts'), 'x');
    fake.facts = { ...fake.facts as object, commits: [{ hash: HASH, subject: 'core/x', files: ['src/x.ts'] }] };
    await open();
    const { openVibeItem } = await import('app/controllers');
    await openVibeItem('/etc/passwd', 1);
    await openVibeItem('gh:https://exemple.fr');
    await openVibeItem('c0/0', 3);
    expect(fake.edited).toEqual([[fs.realpathSync.native(path.join(dir, 'src', 'x.ts')), 3]]);
    expect(fake.opened).toEqual([]);
  });
});

describe('rc.7', () => {
  it('une case du § A.3 cochée à la main : validée pour le commit de tête ; une case calculée, ou sans commit : rien', async () => {
    await open();
    const { markVibe } = await import('app/controllers');
    const { vibeStore } = await import('app/settings');
    markVibe('a3:0', 'ok');
    expect(vibeStore().marks.a1 ?? {}).toEqual({});   // pas encore de commit sur la branche
    fake.facts = { ...fake.facts as object, commits: [{ hash: 'b'.repeat(40), subject: 'note', files: [] }, { hash: HASH, subject: 'core/x', files: [] }] };
    const { refreshVibe } = await import('app/controllers');
    await refreshVibe({ now: true });
    markVibe('a3:1', 'ok');   // calculée d'après le dépôt
    markVibe('a3:9', 'ok');   // hors de la liste
    markVibe('a3:0', 'ok');
    expect(vibeStore().marks.a1).toEqual({ 'a3:0': { hash: HASH, verdict: 'ok' } });
  });
});

describe('0.11.0 : invariants existants et courses', () => {
  it('runsSeen : true → les courses de l’agent affiché vues, false → aucun ; autre valeur : rien', async () => {
    await open();
    const { setVibe } = await import('app/controllers');
    setVibe({ runsSeen: true });
    setVibe({ runsSeen: false });
    setVibe({ runsSeen: 'a2' });
    expect(fake.tabs).toEqual(['a1', null]);
  });

  it('runsSeen false après avoir quitté VibeCoder : l’onglet Actions fermé quand même', async () => {
    await open();
    const { setVibe } = await import('app/controllers');
    setVibe({ runsSeen: true });
    setVibe({ view: 'conversation' });
    setVibe({ runsSeen: false });
    expect(fake.tabs).toEqual(['a1', null]);
  });

  it('le panneau fermé : l’onglet Actions fermé', async () => {
    await open();
    const { setVibe } = await import('app/controllers');
    setVibe({ runsSeen: true });
    fake.windows.at(-1)!.emit('closed');
    expect(fake.tabs).toEqual(['a1', null]);
  });

  it('Vibe (0.12.0) : lancé par son action ; en cours, les étapes faites reçoivent leur ✓ ; arrêté, elles le gardent', async () => {
    write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), JSON.stringify([
      { id: 'vibe', flow: 'create', step: null, kind: 'send', label: 'Vibe', text: '/vibecoder:vibe {{lang}} {{out}}' },
    ]));
    fake.steps = [{ id: 'note', status: 'done' }, { id: 'forme', status: 'todo' }];
    const { vibes } = await open();
    const { runVibeAction, setVibe } = await import('app/controllers');
    const { vibeStore } = await import('app/settings');
    const { blobSha } = await import('core/vibecoder');
    expect(vibes().at(-1)).toMatchObject({ vibe: false });
    expect(vibeStore().marks.a1 ?? {}).toEqual({});   // hors Vibe : aucun ✓ donné
    expect(runVibeAction('vibe', {})).toEqual({ ok: true });
    await settle();
    expect(fake.messages[0]).toBe(`/vibecoder:vibe fr ${out}`);
    expect(vibes().some((v) => v?.vibe === true)).toBe(true);
    expect(vibeStore().marks.a1).toEqual({ note: { hash: blobSha(NOTE), verdict: 'ok' } });
    setVibe({ vibe: false });
    fake.steps = [{ id: 'note', status: 'done' }, { id: 'forme', status: 'done' }];
    await settle();
    expect(vibes().at(-1)).toMatchObject({ vibe: false });
    expect(vibeStore().marks.a1).toEqual({ note: { hash: blobSha(NOTE), verdict: 'ok' } });   // gardé, rien de plus
  });

  it('le relevé passe repo.dirty au parcours (VibeModule.uncommitted)', async () => {
    fake.facts = { ...fake.facts as object, dirty: ['src/x/index.ts'] };
    expect((await open()).view()!.repo).toMatchObject({ dirty: ['src/x/index.ts'] });
  });

  it('✓ Rien à écrire : validé pour le texte de la note ; oublié par null', async () => {
    await open();
    const { markVibe } = await import('app/controllers');
    const { vibeStore } = await import('app/settings');
    const { blobSha } = await import('core/vibecoder');
    markVibe('nothing', 'ok');
    expect(vibeStore().marks.a1).toEqual({ nothing: { hash: blobSha(NOTE), verdict: 'ok' } });
    markVibe('nothing', null);
    expect(vibeStore().marks.a1).toEqual({});
  });
});

describe('0.12.0-worktrees : Ici, Dans un worktree, Retirer, Nouvelle demande', () => {
  const ACTIONS = [
    { id: 'load-pr', flow: 'review', step: 'pr', kind: 'send', needs: 'none', reads: true, label: 'Charger', text: '/vibecoder:charger-pr {{lang}} {{out}} {{pr}}' },
    { id: 'pr-here', flow: 'review', step: 'pr', kind: 'send', needs: 'none', label: 'Ici', text: 'ici {{pr}}' },
    { id: 'pr-worktree', flow: 'review', step: 'pr', kind: 'send', needs: 'none', label: 'Dans un worktree', text: 'worktree {{pr}}' },
    { id: 'remove-worktree', flow: 'both', step: 'pr', kind: 'send', needs: 'none', label: 'Retirer', text: 'retirer' },
    { id: 'base', flow: 'create', step: 'pr', kind: 'send', needs: 'none', label: 'Base', text: 'base' },
    { id: 'note', flow: 'create', step: 'note', kind: 'send', needs: 'text', label: 'Rédiger la note', text: '/vibecoder:note {{lang}} {{out}} {{text}}' },
    { id: 'new-worktree', flow: 'both', step: null, kind: 'send', needs: 'text', reads: true, label: 'Nouvelle demande', text: '/vibecoder:nouvelle-demande {{lang}} {{out}} {{text}}' },
  ];
  // git : la branche du dossier et son état (status), réglés par le cas.
  const gitWith = (status: string | null, branch = 'main') => {
    fake.git = (args) => (args[0] === 'status' ? status : args[0] === 'rev-parse' ? `${branch}\n` : null);
  };
  // Le parcours est faux ici (vibeView rend son entrée) : direct, celui que le relevé lui donne.
  const directOf = async (id: string) => ((await import('app/controllers')).lastView('a1') as unknown as JourneyInput | null)?.direct?.[id];
  const until = async (ok: () => boolean | Promise<boolean>) => {
    for (let i = 0; i < 60 && !await ok(); i++) await settle();
  };
  beforeEach(() => {
    write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), JSON.stringify(ACTIONS));
    write(path.join(out, 'pr-12.json'), JSON.stringify({ number: 12, head: 'feat/x', base: 'main' }));
  });

  it('le relevé : place (le fichier du projet du parent), child, recipe, et en Relire checkout (le dossier lui-même)', async () => {
    review();
    gitWith(' M a.txt\n');
    write(path.join(dir, '.vibecoder', 'project.json'), JSON.stringify({ commands: [], prWorktree: 'worktree' }));
    const v = (await open()).view()!;
    expect([v.place, v.child, v.recipe, v.checkout]).toEqual([{ pr: 'worktree', feature: 'ask' }, false, null, { branch: 'main', dirty: true }]);
  });

  it('le relevé, sans fichier du projet ni git : ask, ask ; checkout null', async () => {
    review();
    const v = (await open()).view()!;
    expect([v.place, v.checkout]).toEqual([{ pr: 'ask', feature: 'ask' }, null]);
  });

  it('Ici, propre au clic : la tête de pr-12.json rapatriée, puis git switch', async () => {
    review();
    gitWith('');
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('pr-here', { direct: true })).toEqual({ ok: true });
    await until(async () => (await directOf('pr-here'))?.running === false);
    expect(fake.calls).toEqual([['fetch', 'feat/x'], ['switch', 'feat/x']]);
    expect((await directOf('pr-here'))?.last).toMatchObject({ ok: true });
  });

  it('Ici, des modifications au clic, ou git status sans réponse : refusé, pas de git switch', async () => {
    for (const status of [' M a.txt\n', null]) {
      vi.resetModules();
      fake.calls = [];
      review();
      gitWith(status);
      await open();
      const { runVibeAction } = await import('app/controllers');
      runVibeAction('pr-here', { direct: true });
      await until(async () => (await directOf('pr-here'))?.running === false);
      expect(fake.calls.filter(([c]) => c === 'switch')).toEqual([]);
      expect((await directOf('pr-here'))?.last).toMatchObject({ ok: false, line: expect.stringMatching(/^Refused/) });
    }
  });

  it('base : des modifications au clic → refusé, rien lancé ; propre → toBase', async () => {
    gitWith(' M a.txt\n');
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('base', { direct: true });
    await until(async () => (await directOf('base'))?.running === false);
    expect(fake.calls).toEqual([]);
    gitWith('');
    runVibeAction('base', { direct: true });
    await until(async () => fake.calls.length > 0);
    expect(fake.calls).toEqual([['toBase', 'feat/0.8.0-essai', 'main']]);
  });

  it('Dans un worktree : la tête rapatriée, la recette (pr-12, base la tête, départ refs/vibecoder/pr/12), puis le robot', async () => {
    review();
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('pr-worktree', { direct: true });
    await until(async () => (await directOf('pr-worktree'))?.running === false);
    expect(fake.calls).toEqual([
      ['fetch', 'feat/x'],
      ['createWorktree', 'a1', { branch: 'pr-12', base: 'feat/x', start: 'refs/vibecoder/pr/12' }],
      ['prWorktreeReady', 'a1', 12, '/wt', 'pr-12'],
    ]);
    expect((await directOf('pr-worktree'))?.last).toMatchObject({ ok: true, line: 'worktree créé' });
  });

  it('load-pr réussi, prWorktree réglé : la suite dans le même job ; ask : rien de plus', async () => {
    review();
    gitWith('');
    write(path.join(dir, '.vibecoder', 'project.json'), JSON.stringify({ commands: [], prWorktree: 'here' }));
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('load-pr', { direct: true, pr: 12 });
    await until(async () => (await directOf('load-pr'))?.running === false);
    expect(fake.calls).toEqual([['loadPr', 12], ['fetch', 'feat/x'], ['switch', 'feat/x']]);
    expect((await directOf('pr-here'))?.last).toMatchObject({ ok: true });
    fake.calls = [];
    write(path.join(dir, '.vibecoder', 'project.json'), JSON.stringify({ commands: [] }));
    runVibeAction('load-pr', { direct: true, pr: 12 });
    await until(async () => fake.calls.length > 0 && (await directOf('load-pr'))?.running === false);
    expect(fake.calls).toEqual([['loadPr', 12]]);
  });

  it('Retirer le worktree (direct) : removeWorktreeChild ; plus de message au parent', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('remove-worktree', { direct: true });
    await until(async () => (await directOf('remove-worktree'))?.running === false);
    expect(fake.calls).toEqual([['removeWorktreeChild', 'a1']]);
    expect(fake.messages).toEqual([]);
  });

  it('Nouvelle demande, retenue : au relevé, la fiche supprimée, le worktree depuis origin/<base>, l’enfant affiché, puis sa note avec la demande', async () => {
    await open();
    const { refreshVibe, runVibeAction, vibeAgent } = await import('app/controllers');
    expect(runVibeAction('new-worktree', { text: 'ajouter un bouton' })).toEqual({ ok: true });
    await until(() => fake.messages.length > 0);
    expect(fake.messages[0]).toBe(`/vibecoder:nouvelle-demande fr ${out} ajouter un bouton`);
    write(path.join(out, 'new-worktree.json'), JSON.stringify({ branch: 'feat/0.13.0-bouton' }));
    await refreshVibe({ now: true });
    expect(fs.existsSync(path.join(out, 'new-worktree.json'))).toBe(false);
    await until(() => vibeAgent()?.id === 'c1');
    await refreshVibe({ now: true });
    await until(() => fake.messages.length > 1);
    expect(fake.calls).toEqual([
      ['createWorktree', 'a1', { branch: 'feat/0.13.0-bouton', base: 'main', start: 'origin/main' }],
      ['openChild', 'a1', '/wt', { name: 'feat/0.13.0-bouton', create: true }],
    ]);
    expect(fake.messages[1]).toBe(`/vibecoder:note fr ${path.join(fake.userData, 'vibecoder-out', 'c1')} ajouter un bouton`);
    // une fois seulement
    await refreshVibe({ now: true });
    await settle();
    expect(fake.messages.filter((m) => String(m).startsWith('/vibecoder:note'))).toHaveLength(1);
  });

  it('Nouvelle demande : une fiche sans demande retenue est supprimée, rien d’autre', async () => {
    write(path.join(out, 'new-worktree.json'), JSON.stringify({ branch: 'feat/0.13.0-bouton' }));
    await open();
    await settle();
    expect(fs.existsSync(path.join(out, 'new-worktree.json'))).toBe(false);
    expect(fake.calls).toEqual([]);
    expect(fake.messages).toEqual([]);
  });
});
