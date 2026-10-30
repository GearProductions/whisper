// Variants du contrôleur de VibeCoder (note 0.8.0) : ce que le relevé lit et
// envoie au panneau, et le chemin d'une action jusqu'à l'agent.
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, core) ; faux : Electron (fenêtres qui relèvent ce qu'on leur
// envoie), le SDK de Claude Code (relève les messages), git (ses faits, réglés
// par le cas), gh (les PR ouvertes, réglées par le cas), les fichiers livrés (ceux du dépôt) et le parcours (vibeView
// rend ce qu'il reçoit, pour le regarder).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneyInput } from 'core/vibecoder';
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
  return {
    Win, userData: '', windows: [] as InstanceType<typeof Win>[], facts: null as unknown, messages: [] as unknown[],
    shown: null as string | null, diff: null as string | null, edited: [] as unknown[][], opened: [] as string[],
    tabs: [] as (string | null)[], steps: [] as { id: string; status: string }[],
    git: (() => null) as (args: string[]) => string | null, calls: [] as unknown[][], noChild: false,
    branches: null as string[] | null, synced: [] as string[], prs: null as unknown, login: 'moi' as string | null,
    dev: null as 'reload' | 'restart' | null, answer: 0, busy: false, release: (() => {}) as (v?: unknown) => void,
    fork: null as string | null, reads: [] as unknown[][],
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: { openExternal: (url: string) => { fake.opened.push(url); } }, clipboard: {}, nativeImage: {},
  dialog: { showMessageBox: async (o: { message: string }) => { fake.calls.push(['dialog', o.message]); return { response: fake.answer }; } },
}));
// L'appli lancée depuis les sources (app/dev) : son état réglé par le cas, ses actions relevées.
vi.mock('app/dev', () => ({
  devState: () => fake.dev,
  reloadPages: () => { fake.calls.push(['reloadPages']); },
  restartApp: () => { fake.calls.push(['restartApp']); },
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
        if (fake.busy) await new Promise((r) => { fake.release = r; });   // un tour qui dure : l'agent au travail
        yield { type: 'result', subtype: 'success', is_error: false, result: 'ok' };
      }
    }()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => {} }),
  }),
}));

vi.mock('technicals/git', () => ({
  gitRun: () => async (args: string[]) => fake.git(args),
  gitReader: () => ({
    facts: async () => fake.facts, commit: async () => fake.diff,
    show: async (ref: string, p: string) => { fake.reads.push(['show', ref, p]); return fake.shown; },
    forkPoint: async (base: string) => { fake.reads.push(['forkPoint', base]); return fake.fork; },
    branches: async () => fake.branches, sync: async (base: string) => { fake.synced.push(base); return { behind: 1, baseAhead: 2 }; },
  }),
  okRef: (ref: string) => /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]+$/.test(ref),
}));

// gh : les PR ouvertes du dépôt, réglées par le cas ; le reste sans réponse.
vi.mock('technicals/github', async (original) => ({
  ...await original<typeof import('technicals/github')>(),
  githubReader: () => ({ prForBranch: async () => null, prState: async () => null, openPrs: async () => fake.prs, login: async () => fake.login }),
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
    ...input, pr: input.pr && { number: input.pr }, prs: input.github?.prs ?? null, steps: fake.steps, commits: input.repo?.commits ?? [], invariants: [], variants: [], modules: [], questions: [],
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
    sameRepo: async (n: number) => { fake.calls.push(['sameRepo', n]); return OK; },
    fetchBranch: async (b: string) => { fake.calls.push(['fetch', b]); return OK; },
    pullBranch: async (b: string) => { fake.calls.push(['pull', b]); return OK; },
    switchTo: async (...b: string[]) => { fake.calls.push(['switch', ...b]); return OK; },
    stash: async () => { fake.calls.push(['stash']); return OK; },
    toBase: async (b: string, base: string) => { fake.calls.push(['toBase', b, base]); return OK; },
    fetchAll: async () => { fake.calls.push(['fetchAll']); return OK; },
    pull: async () => { fake.calls.push(['pull']); return OK; },
    rebase: async (onto: string) => { fake.calls.push(['rebase', onto]); return OK; },
    push: async () => { fake.calls.push(['push']); return OK; },
    requestReview: async (n: number, login: string) => { fake.calls.push(['requestReview', n, login]); return OK; },
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
    if (fake.noChild) return null;   // la question de confiance refusée
    const { loadConfig, saveConfig } = await import('app/settings');
    const child = { id: 'c1', dir, name: 'enfant', model: '', effort: '', mode: 'default', sessionId: null, parent: { id: parent.id },
      view: 'vibecoder' as const, vibe: { flow: 'create' as const, pr: null } };
    saveConfig({ agents: [...loadConfig().agents, child] });
    return child;
  },
}));

// Copier un artefact : relevé, puis une erreur inattendue (un droit d'écriture manquant…) ; le reste, vrai.
vi.mock('app/controllers/artifacts', async (original) => ({
  ...await original<typeof import('app/controllers/artifacts')>(),
  copyArtifact: async (a: { id: string }, id: string) => { fake.calls.push(['copyArtifact', a.id, id]); throw new Error('EACCES: permission denied'); },
  pickArtifacts: async (a: { id: string }) => { fake.calls.push(['pickArtifacts', a.id]); return { ok: true, line: 'Added by dialog.', detail: '' }; },
  addArtifacts: async (a: { id: string }, paths: unknown) => { fake.calls.push(['addArtifacts', a.id, paths]); if (fake.busy) await new Promise((r) => { fake.release = r; }); return { ok: true, line: 'Added by drop.', detail: '' }; },
}));

// Les courses : vraies ; runsTab relevé au passage.
vi.mock('app/controllers/runs', async (original) => {
  const runs = await original<typeof import('app/controllers/runs')>();
  return { ...runs, runsTab: (id: string | null) => { fake.tabs.push(id); runs.runsTab(id); } };
});

const NOTE = '# 0.8.0 — essai\n\n## Ce que ça fait\n\n- un essai\n';
const TEST = 'it(\'un cas\', () => {});\n';
const settle = () => new Promise((r) => setTimeout(r, slow(150)));
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
  fake.fork = null;
  fake.reads = [];
  fake.diff = null;
  fake.opened = [];
  fake.tabs = [];
  fake.steps = [];
  fake.git = () => null;
  fake.calls = [];
  fake.branches = ['main', 'feat/x'];
  fake.synced = [];
  fake.prs = null;
  fake.login = 'moi';
  fake.dev = null;
  fake.answer = 0;
  fake.busy = false;
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-vibecoder-'));
  dir = path.join(fake.userData, 'projet');
  out = path.join(fake.userData, 'vibecoder-out', 'a1');   // les sorties de l'agent
  write(path.join(dir, 'docs/tickets/feat/0.8.0-essai.md'), NOTE);
  write(path.join(dir, 'src/x/tests/invariants/x.test.ts'), TEST);
  fake.facts = {
    branch: 'feat/0.8.0-essai', base: 'origin/main', head: 'h', commits: [], dirty: [],
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
    expect(v.tests).toEqual([{ path: 'src/x/tests/invariants/x.test.ts', blob: blobSha(TEST), text: TEST, base: null }]);
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

  it('le texte d’un test à la base (0.13.0) : git show au forkPoint de repo.base, un forkPoint par relevé ; pas d’un variant', async () => {
    fake.fork = 'f0';
    fake.shown = 'BASE';
    fake.facts = { ...fake.facts as object, changed: [...(fake.facts as { changed: string[] }).changed, 'src/y/tests/invariants/y.test.ts', 'src/z/tests/variants/z.test.ts'] };
    write(path.join(dir, 'src/y/tests/invariants/y.test.ts'), TEST);
    write(path.join(dir, 'src/z/tests/variants/z.test.ts'), TEST);
    const { vibes, view } = await open();
    const v = view()!;
    expect(v.tests.map((t) => t.base)).toEqual(['BASE', 'BASE', null]);
    // par relevé envoyé : un forkPoint, puis un show par test d'invariants
    expect(fake.reads).toEqual(vibes().flatMap(() => [['forkPoint', 'origin/main'],
      ['show', 'f0', 'src/x/tests/invariants/x.test.ts'], ['show', 'f0', 'src/y/tests/invariants/y.test.ts']]));
    expect(v).not.toHaveProperty('list');
  });

  it('le texte d’un test à la base : null absent à la base, ou sans base ; sans test, aucun git', async () => {
    fake.fork = 'f0';
    fake.shown = null;   // absent à la base
    expect((await open()).view()!.tests[0].base).toBeNull();
    vi.resetModules();
    fake.fork = null;    // pas de base
    fake.reads = [];
    expect((await open()).view()!.tests[0].base).toBeNull();
    expect(fake.reads.filter(([c]) => c === 'show')).toEqual([]);
    vi.resetModules();
    fake.facts = { ...fake.facts as object, changed: ['docs/tickets/feat/0.8.0-essai.md'] };
    fake.reads = [];
    expect((await open()).view()!.tests).toEqual([]);
    expect(fake.reads).toEqual([]);
  });

  it('lastView : le dernier relevé de l’agent, null pour un autre', async () => {
    await open();
    const { lastView } = await import('app/controllers');
    expect(lastView('a1')).toMatchObject({ agentId: 'a1' });
    expect(lastView('inconnu')).toBeNull();
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

  it('un fichier d\'un commit ne s\'ouvre plus dans l\'éditeur ; un chemin à la place d\'un id : rien', async () => {
    write(path.join(dir, 'src', 'x.ts'), 'x');
    fake.facts = { ...fake.facts as object, commits: [{ hash: HASH, subject: 'core/x', files: ['src/x.ts'] }] };
    await open();
    const { openVibeItem } = await import('app/controllers');
    await openVibeItem('/etc/passwd', 1);
    await openVibeItem('gh:https://exemple.fr');
    await openVibeItem('c0/0', 3);
    expect(fake.edited).toEqual([]);
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

describe('0.12.0 : Créer et Relire sur le même dossier, chaque choix une action directe', () => {
  const ACTIONS = [
    { id: 'load-pr', flow: 'review', step: 'pr', kind: 'send', needs: 'none', reads: true, label: 'Charger', text: '/vibecoder:charger-pr {{lang}} {{out}} {{pr}}' },
    { id: 'pr-here', flow: 'review', step: 'pr', kind: 'send', needs: 'none', label: 'Changer de branche', text: 'ici {{pr}}' },
    { id: 'pr-worktree', flow: 'review', step: 'pr', kind: 'send', needs: 'none', label: 'Dans un nouveau worktree', text: 'worktree {{pr}}' },
    { id: 'unload-pr', flow: 'review', step: 'pr', kind: 'send', needs: 'none', label: 'Décharger', text: 'décharger' },
    { id: 'remove-worktree', flow: 'both', step: 'pr', kind: 'send', needs: 'none', label: 'Retirer', text: 'retirer' },
    { id: 'base', flow: 'create', step: 'pr', kind: 'send', needs: 'none', label: 'Base', text: 'base' },
    { id: 'note', flow: 'create', step: 'note', kind: 'send', needs: 'text', label: 'Rédiger la note', text: '/vibecoder:note {{lang}} {{out}} {{text}}' },
    { id: 'new-request', flow: 'both', step: null, kind: 'send', needs: 'text', reads: true, label: 'Nouvelle demande', text: '/vibecoder:nouvelle-demande {{lang}} {{out}} {{text}}' },
    { id: 'new-here', flow: 'both', step: null, kind: 'send', needs: 'none', label: 'Changer de branche', text: 'ici' },
    { id: 'new-worktree', flow: 'both', step: null, kind: 'send', needs: 'none', label: 'Dans un nouveau worktree', text: 'worktree' },
    { id: 'stash', flow: 'both', step: null, kind: 'send', needs: 'none', label: 'Mettre de côté', text: 'de côté' },
    ...['switch-branch', 'pull', 'rebase', 'push', 'fetch', 'request-review'].map((id) => ({ id, flow: 'both', step: null, kind: 'send', needs: 'none', label: id, text: id })),
  ];
  // git : la branche du dossier et son état (status, ou une fonction : à chaque appel), réglés par le cas.
  const gitWith = (status: string | null | (() => string | null), branch = 'main') => {
    fake.git = (args) => (args[0] === 'status' ? (typeof status === 'function' ? status() : status) : args[0] === 'rev-parse' ? `${branch}\n` : null);
  };
  // Le parcours est faux ici (vibeView rend son entrée) : direct, celui que le relevé lui donne.
  const directOf = async (id: string) => ((await import('app/controllers')).lastView('a1') as unknown as JourneyInput | null)?.direct?.[id];
  const done = async (id: string) => (await directOf(id))?.running === false;
  const until = async (ok: () => boolean | Promise<boolean>) => {
    for (let i = 0; i < 60 && !await ok(); i++) await settle();
  };
  const vibeOf = async () => (await import('app/settings')).loadConfig().agents[0].vibe;
  // Une nouvelle demande retenue, sa fiche relevée : request au relevé.
  async function requestPending() {
    const { refreshVibe, runVibeAction } = await import('app/controllers');
    expect(runVibeAction('new-request', { text: 'ajouter un bouton' })).toEqual({ ok: true });
    await until(() => fake.messages.length > 0);
    write(path.join(out, 'new-request.json'), JSON.stringify({ branch: 'feat/0.13.0-bouton' }));
    await refreshVibe({ now: true });
  }
  beforeEach(() => {
    write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), JSON.stringify(ACTIONS));
    write(path.join(out, 'pr-12.json'), JSON.stringify({ number: 12, head: 'feat/x', base: 'main' }));
  });

  it('le relevé : child, recipe et checkout (le dossier lui-même, d’après facts) dans les deux parcours ; plus de place', async () => {
    review();
    fake.facts = { ...fake.facts as object, branch: 'main', dirty: ['a.txt'] };
    let v = (await open()).view()!;
    expect([v.child, v.recipe, v.checkout, v.request]).toEqual([false, null, { branch: 'main', dirty: true }, null]);
    expect(v).not.toHaveProperty('place');
    vi.resetModules();
    write(path.join(fake.userData, 'config.json'), JSON.stringify({ agentsEnabled: true, agents: [{ id: 'a1', dir, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null, view: 'vibecoder' }] }));
    v = (await open()).view()!;
    expect(v.checkout).toEqual({ branch: 'main', dirty: true });
  });

  it('Relire lit la copie de travail : la note et les tests du dossier ; checkout d’après facts', async () => {
    review();
    write(path.join(out, 'pr-12.json'), JSON.stringify({ number: 12, head: 'feat/0.8.0-essai', base: 'main' }));
    const v = (await open()).view()!;
    expect(v.note).toMatchObject({ path: 'docs/tickets/feat/0.8.0-essai.md', text: NOTE });
    expect(v.tests).toEqual([expect.objectContaining({ path: 'src/x/tests/invariants/x.test.ts', text: TEST })]);
    expect(v.checkout).toEqual({ branch: 'feat/0.8.0-essai', dirty: false });
  });

  it('Changer de branche (pr-here), propre au clic : la tête de pr-12.json rapatriée, git switch, puis git pull --ff-only', async () => {
    review();
    gitWith('');
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('pr-here', { direct: true })).toEqual({ ok: true });
    await until(() => done('pr-here'));
    expect(fake.calls).toEqual([['fetch', 'feat/x'], ['switch', 'feat/x'], ['pull', 'feat/x']]);
    expect((await directOf('pr-here'))?.last).toMatchObject({ ok: true });
  });

  it('pr-here, unload-pr, new-here : des modifications au clic, ou git status sans réponse → refusé, pas de git switch', async () => {
    for (const id of ['pr-here', 'unload-pr', 'new-here']) {
      for (const status of [' M a.txt\n', null]) {
        vi.resetModules();
        fake.calls = [];
        fake.messages = [];
        review();
        gitWith(status);
        await open();
        if (id === 'new-here') await requestPending();
        const { runVibeAction } = await import('app/controllers');
        expect(runVibeAction(id, { direct: true })).toEqual({ ok: true });
        await until(() => done(id));
        expect(fake.calls.filter(([c]) => c === 'switch')).toEqual([]);
        expect((await directOf(id))?.last).toMatchObject({ ok: false, line: expect.stringMatching(/^Refused/) });
      }
    }
    expect(await vibeOf()).toMatchObject({ flow: 'review', pr: 12 });   // rien n'a changé
  });

  it('base : des modifications au clic → refusé, rien lancé ; propre → toBase', async () => {
    gitWith(' M a.txt\n');
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('base', { direct: true });
    await until(() => done('base'));
    expect(fake.calls).toEqual([]);
    gitWith('');
    runVibeAction('base', { direct: true });
    await until(async () => fake.calls.length > 0);
    expect(fake.calls).toEqual([['toBase', 'feat/0.8.0-essai', 'main']]);
  });

  it('Dans un nouveau worktree : la tête rapatriée, la recette (pr-12, base la tête, départ origin/<tête>), puis le robot', async () => {
    review();
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('pr-worktree', { direct: true });
    await until(() => done('pr-worktree'));
    expect(fake.calls).toEqual([
      ['fetch', 'feat/x'],
      ['createWorktree', 'a1', { branch: 'pr-12', base: 'feat/x', start: 'origin/feat/x' }],
      ['prWorktreeReady', 'a1', 12, '/wt', 'pr-12'],
    ]);
    expect((await directOf('pr-worktree'))?.last).toMatchObject({ ok: true, line: 'worktree créé' });
  });

  it('load-pr : pas d’un fork, loadPr, puis la base de la fiche rapatriée ; même avec un prWorktree d’avant (plus de suite)', async () => {
    review();
    gitWith('');
    write(path.join(dir, '.vibecoder', 'project.json'), JSON.stringify({ commands: [], prWorktree: 'here' }));
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('load-pr', { direct: true, pr: 12 });
    await until(async () => fake.calls.length > 0 && await done('load-pr'));
    await settle();
    expect(fake.calls).toEqual([['sameRepo', 12], ['loadPr', 12], ['fetch', 'main']]);
  });

  it('Mettre de côté : git stash, puis le dossier relu ; propre → ok, encore des modifications → l’échec ; rien d’autre ne suit', async () => {
    review();
    let status = ' M a.txt\n';
    gitWith(() => status);
    await open();
    const { runVibeAction } = await import('app/controllers');
    status = '';
    runVibeAction('stash', { direct: true });
    await until(() => done('stash'));
    expect((await directOf('stash'))?.last).toMatchObject({ ok: true });
    status = '?? reste.txt\n';
    runVibeAction('stash', { direct: true });
    await until(async () => (await directOf('stash'))?.last?.ok === false);
    expect((await directOf('stash'))?.last).toMatchObject({ ok: false, line: expect.stringMatching(/still has changes/) });
    expect(fake.calls).toEqual([['stash'], ['stash']]);
  });

  it('Mettre de côté : jamais par l’agent (DIRECT_ONLY), ni sans le clic « direct »', async () => {
    review();
    gitWith(' M a.txt\n');
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('stash', {})).toMatchObject({ ok: false });
    await settle();
    expect([fake.calls, fake.messages]).toEqual([[], []]);
  });

  it('Décharger, propre : la base du dépôt (git), puis la PR plus suivie', async () => {
    review();
    gitWith('', 'feat/x');
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('unload-pr', { direct: true });
    await until(() => done('unload-pr'));
    expect(fake.calls).toEqual([['switch', 'main']]);
    expect(await vibeOf()).toMatchObject({ flow: 'review', pr: null });
  });

  it('Retirer le worktree (direct) : removeWorktreeChild ; plus de message au parent', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('remove-worktree', { direct: true });
    await until(() => done('remove-worktree'));
    expect(fake.calls).toEqual([['removeWorktreeChild', 'a1']]);
    expect(fake.messages).toEqual([]);
  });

  it('Nouvelle demande : au relevé, la fiche supprimée et request donné ; rien de créé ni de lancé', async () => {
    gitWith('');
    await open();
    await requestPending();
    expect(fake.messages[0]).toBe(`/vibecoder:nouvelle-demande fr ${out} ajouter un bouton`);
    expect(fs.existsSync(path.join(out, 'new-request.json'))).toBe(false);
    const { lastView } = await import('app/controllers');
    expect((lastView('a1') as unknown as JourneyInput).request).toBe('feat/0.13.0-bouton');
    await settle();
    expect(fake.calls).toEqual([]);
  });

  it('new-here : la base rapatriée, git switch -c depuis origin/<base>, le dossier en Créer, puis sa note avec la demande', async () => {
    review();
    gitWith('');
    await open();
    await requestPending();
    const { refreshVibe, runVibeAction } = await import('app/controllers');
    runVibeAction('new-here', { direct: true });
    await until(() => done('new-here'));
    expect(fake.calls).toEqual([['fetch', 'main'], ['switch', 'feat/0.13.0-bouton', 'origin/main']]);
    expect(await vibeOf()).toMatchObject({ flow: 'create' });
    await refreshVibe({ now: true });
    await until(() => fake.messages.length > 1);
    expect(fake.messages[1]).toBe(`/vibecoder:note fr ${out} ajouter un bouton`);
    await refreshVibe({ now: true });
    await settle();
    expect(fake.messages.filter((m) => String(m).startsWith('/vibecoder:note'))).toHaveLength(1);   // une fois
  });

  it('new-worktree : la base rapatriée, le worktree depuis origin/<base>, l’enfant affiché, puis sa note avec la demande', async () => {
    gitWith('');
    await open();
    await requestPending();
    const { refreshVibe, runVibeAction, vibeAgent } = await import('app/controllers');
    runVibeAction('new-worktree', { direct: true });
    await until(() => vibeAgent()?.id === 'c1');
    await refreshVibe({ now: true });
    await until(() => fake.messages.length > 1);
    expect(fake.calls).toEqual([
      ['fetch', 'main'],
      ['createWorktree', 'a1', { branch: 'feat/0.13.0-bouton', base: 'main', start: 'origin/main' }],
      ['openChild', 'a1', '/wt', { name: 'feat/0.13.0-bouton', create: true }],
    ]);
    expect(fake.messages[1]).toBe(`/vibecoder:note fr ${path.join(fake.userData, 'vibecoder-out', 'c1')} ajouter un bouton`);
  });

  it('new-worktree, la question de confiance refusée : l’échec le dit, la demande reste retenue', async () => {
    gitWith('');
    await open();
    await requestPending();
    fake.noChild = true;
    try {
      const { lastView, refreshVibe, runVibeAction } = await import('app/controllers');
      runVibeAction('new-worktree', { direct: true });
      await until(() => done('new-worktree'));
      expect((await directOf('new-worktree'))?.last).toMatchObject({ ok: false, line: expect.stringMatching(/request stays here/) });
      await refreshVibe({ now: true });
      expect((lastView('a1') as unknown as JourneyInput).request).toBe('feat/0.13.0-bouton');
    } finally {
      fake.noChild = false;
    }
  });

  it('new-here, new-worktree sans demande retenue : refusés ; une fiche sans demande est supprimée, rien d’autre', async () => {
    write(path.join(out, 'new-request.json'), JSON.stringify({ branch: 'feat/0.13.0-bouton' }));
    const v = (await open()).view()!;
    await settle();
    expect(fs.existsSync(path.join(out, 'new-request.json'))).toBe(false);
    expect(v.request).toBeNull();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('new-here', { direct: true })).toMatchObject({ ok: false });
    expect(runVibeAction('new-worktree', { direct: true })).toMatchObject({ ok: false });
    expect([fake.calls, fake.messages]).toEqual([[], []]);
  });

  it('passer en Relire sans PR suivie : la PR ouverte du dernier relevé de Créer suivie, sa fiche écrite (rien de chargé)', async () => {
    write(path.join(out, 'pr.json'), '{}');
    const { view } = await open();
    const { setVibe } = await import('app/controllers');
    const pr = { number: 34, title: 'Essai', url: 'u', author: 'moi', base: 'main', head: 'feat/0.8.0-essai', body: '', state: 'OPEN' };
    const { lastView } = await import('app/controllers');
    Object.assign(lastView('a1')!, { pr, reviewable: true });   // le relevé de Créer : la PR ouverte de la branche (gh)
    expect(view()!.flow).toBe('create');
    setVibe({ flow: 'review' });
    expect(await vibeOf()).toMatchObject({ flow: 'review', pr: 34 });
    expect(JSON.parse(fs.readFileSync(path.join(out, 'pr-34.json'), 'utf8'))).toEqual(pr);
    await settle();
    expect(fake.calls).toEqual([]);
  });

  it('passer en Relire : refusé sans reviewable au dernier relevé ; sinon, depuis Créer, toujours la PR de la branche suivie', async () => {
    review();
    await open();
    const { lastView, setVibe } = await import('app/controllers');
    setVibe({ flow: 'create' });
    await settle();
    Object.assign(lastView('a1')!, { flow: 'create', pr: { number: 34, state: 'MERGED', head: 'h', base: 'main' }, reviewable: false });
    setVibe({ flow: 'review' });
    expect(await vibeOf()).toMatchObject({ flow: 'create', pr: 12 });
    expect(fs.existsSync(path.join(out, 'pr-34.json'))).toBe(false);
    await settle();
    Object.assign(lastView('a1')!, { flow: 'create', pr: { number: 34, state: 'OPEN', head: 'h', base: 'main' }, reviewable: true });
    setVibe({ flow: 'review' });
    expect(await vibeOf()).toMatchObject({ flow: 'review', pr: 34 });   // la PR 12 suivie avant : celle de la branche la remplace
  });

  // 0.12.0-gestion-des-branches
  // 0.13.0-recharger-interface
  it('Recharger l\'interface : seulement les pages reconstruites ; l\'état au relevé', async () => {
    const { view } = await open();
    const { refreshVibe, setVibe } = await import('app/controllers');
    setVibe({ reloadUi: true });   // rien de reconstruit : rien
    fake.dev = 'restart';
    setVibe({ reloadUi: true });   // le principal reconstruit : recharger casserait, rien
    fake.dev = 'reload';
    await refreshVibe({ now: true });
    expect((view() as { dev?: string } | null)?.dev).toBe('reload');
    setVibe({ reloadUi: true });
    expect(fake.calls).toEqual([['reloadPages']]);
  });

  it('Redémarrer : seulement le principal reconstruit ; aucun agent au travail : aussitôt', async () => {
    await open();
    const { setVibe } = await import('app/controllers');
    fake.dev = 'reload';
    setVibe({ restartApp: true });
    fake.dev = 'restart';
    setVibe({ restartApp: true });
    await until(() => fake.calls.length > 0);
    expect(fake.calls).toEqual([['restartApp']]);
  });

  it('Redémarrer avec des agents au travail : la question d\'abord ; Non : rien ; Oui : relancée', async () => {
    await open();
    const { setVibe } = await import('app/controllers');
    const { sendToAgent, lastView } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    fake.dev = 'restart';
    fake.busy = true;
    const cfg = loadConfig();
    expect(sendToAgent(cfg.agents![0], { text: 'une question', images: [] }, cfg)).toEqual({ ok: true });   // un tour qui dure
    await until(() => fake.messages.length > 0);
    setVibe({ restartApp: true });
    await until(() => fake.calls.length > 0);
    await new Promise((r) => setTimeout(r, 50));
    expect(fake.calls).toEqual([['dialog', 'Des agents tournent : voulez-vous quand même redémarrer ?']]);
    fake.calls = [];
    fake.answer = 1;
    setVibe({ restartApp: true });
    await until(() => fake.calls.length > 1);
    expect(fake.calls).toEqual([['dialog', 'Des agents tournent : voulez-vous quand même redémarrer ?'], ['restartApp']]);
    expect(lastView('a1')).toBeTruthy();
    fake.busy = false;
    fake.release();
  });

  it('le relevé : branches locales et état distant (sync sur la base sans origin/), sans fetch ; les PR ouvertes en Créer aussi, false en échec', async () => {
    fake.prs = { mine: [{ number: 1 }], review: [], all: [{ number: 1 }, { number: 2 }] };
    const { view } = await open();
    expect(view()).toMatchObject({ branches: ['main', 'feat/x'], sync: { behind: 1, baseAhead: 2 } });
    expect(fake.synced.length > 0 && fake.synced.every((b) => b === 'main')).toBe(true);
    const { setVibe } = await import('app/controllers');
    setVibe({ prs: true });
    await until(() => !!view()?.github?.prs);
    expect(view()!.github!.prs).toEqual(fake.prs);
    fake.prs = null;   // gh en échec : false, affiché à la place de la liste
    setVibe({ prs: true });
    await until(() => view()?.github?.prs === false);
    expect(fake.calls).toEqual([]);   // aucun fetch au relevé
  });

  it('Actualiser, Pull, Pousser : fetchAll, pull, push, au clic', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');
    for (const id of ['fetch', 'pull', 'push']) {
      expect(runVibeAction(id, { direct: true })).toEqual({ ok: true });
      await until(() => done(id));
    }
    expect(fake.calls).toEqual([['fetchAll'], ['pull'], ['push']]);
  });

  it('Me demander en relecture : une PR de Toutes les PR, ni des miennes ni à relire ; mon identifiant, puis les listes relues', async () => {
    fake.prs = { mine: [{ number: 1 }], review: [{ number: 2 }], all: [{ number: 1 }, { number: 2 }, { number: 3 }] };
    const { view } = await open();
    const { runVibeAction, setVibe } = await import('app/controllers');
    setVibe({ prs: true });
    await until(() => !!view()?.github?.prs);
    // la mienne, une déjà à relire, une hors de la liste, pas un numéro : refusées, rien de lancé
    for (const pr of [1, 2, 9, '3']) expect(runVibeAction('request-review', { direct: true, pr: pr as number })).toMatchObject({ ok: false });
    expect(fake.calls).toEqual([]);
    fake.prs = { mine: [{ number: 1 }], review: [{ number: 2 }, { number: 3 }], all: [{ number: 1 }, { number: 2 }, { number: 3 }] };
    expect(runVibeAction('request-review', { direct: true, pr: 3 })).toEqual({ ok: true });
    await until(() => done('request-review'));
    expect(fake.calls).toEqual([['requestReview', 3, 'moi']]);
    await until(() => (view()?.github?.prs as { review: unknown[] } | undefined)?.review.length === 2);   // la PR passe dans À relire
  });

  it('Me demander en relecture : sans identifiant (gh api user en échec), rien de lancé', async () => {
    fake.prs = { mine: [], review: [], all: [{ number: 3 }] };
    fake.login = null;
    const { view } = await open();
    const { runVibeAction, setVibe } = await import('app/controllers');
    setVibe({ prs: true });
    await until(() => !!view()?.github?.prs);
    runVibeAction('request-review', { direct: true, pr: 3 });
    await until(() => done('request-review'));
    expect(fake.calls).toEqual([]);
  });

  it('Rebase : origin/<base> rapatriée par défaut, ou une branche locale ; une autre → refusé', async () => {
    gitWith('');
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('rebase', { direct: true, onto: 'origin/feat/x' })).toMatchObject({ ok: false });
    runVibeAction('rebase', { direct: true });
    await until(() => done('rebase'));
    runVibeAction('rebase', { direct: true, onto: 'feat/x' });
    await until(() => fake.calls.length === 4 && done('rebase'));
    expect(fake.calls).toEqual([['fetch', 'main'], ['rebase', 'origin/main'], ['fetch', 'main'], ['rebase', 'feat/x']]);
  });

  it('switch-branch : une branche du relevé, le dossier propre ; le changement oublie les derniers Rebase et Pousser', async () => {
    gitWith('');
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('switch-branch', { direct: true, branch: 'feat/inconnue' })).toMatchObject({ ok: false });
    expect(runVibeAction('switch-branch', { direct: true })).toMatchObject({ ok: false });
    runVibeAction('rebase', { direct: true });
    await until(() => done('rebase'));
    runVibeAction('push', { direct: true });
    await until(() => done('push'));
    runVibeAction('switch-branch', { direct: true, branch: 'feat/x' });
    await until(() => done('switch-branch'));
    expect(fake.calls.at(-1)).toEqual(['switch', 'feat/x']);
    expect([await directOf('rebase'), await directOf('push')]).toEqual([undefined, undefined]);
  });

  it('Créer une branche (new-here, sans demande) : le nom saisi, son départ ; rien ne suit (ni Créer, ni note)', async () => {
    review();
    gitWith('');
    await open();
    const { refreshVibe, runVibeAction } = await import('app/controllers');
    expect(runVibeAction('new-here', { direct: true, branch: 'feat/x' })).toMatchObject({ ok: false });       // déjà une branche locale
    expect(runVibeAction('new-here', { direct: true, branch: '-x' })).toMatchObject({ ok: false });           // pas un ref sûr
    expect(runVibeAction('new-here', { direct: true, branch: 'feat/y', start: 'origin/x' })).toMatchObject({ ok: false });
    runVibeAction('new-here', { direct: true, branch: 'feat/y', start: 'feat/x' });
    await until(() => done('new-here'));
    expect(fake.calls).toEqual([['fetch', 'main'], ['switch', 'feat/y', 'feat/x']]);
    await refreshVibe({ now: true });
    await settle();
    expect(await vibeOf()).toMatchObject({ flow: 'review', pr: 12 });
    expect(fake.messages).toEqual([]);
  });

  it('Créer une branche dans un worktree (new-worktree, sans demande) : depuis origin/<base>, l’enfant ouvert, pas de note', async () => {
    gitWith('');
    await open();
    const { refreshVibe, runVibeAction, vibeAgent } = await import('app/controllers');
    runVibeAction('new-worktree', { direct: true, branch: 'feat/y' });
    await until(() => vibeAgent()?.id === 'c1');
    await refreshVibe({ now: true });
    await settle();
    expect(fake.calls).toEqual([
      ['fetch', 'main'],
      ['createWorktree', 'a1', { branch: 'feat/y', base: 'main', start: 'origin/main' }],
      ['openChild', 'a1', '/wt', { name: 'feat/y', create: true }],
    ]);
    expect(fake.messages).toEqual([]);
  });

  // Un autre dossier : rien de celui-ci ne bouge, une action qui modifie la branche ne la retient pas.
  it('Créer une branche dans un worktree pendant une action qui modifie la branche : le worktree est créé', async () => {
    gitWith('');
    await open();
    const { lockingRuns, runVibeAction, vibeAgent } = await import('app/controllers');
    expect(runVibeAction('note', { text: 'une demande' })).toEqual({ ok: true });
    expect(lockingRuns('a1')).toEqual([expect.objectContaining({ id: 'note', reads: false })]);
    expect(runVibeAction('new-worktree', { direct: true, branch: 'feat/y' })).toEqual({ ok: true });
    await until(() => vibeAgent()?.id === 'c1');
    expect(fake.calls).toContainEqual(['createWorktree', 'a1', { branch: 'feat/y', base: 'main', start: 'origin/main' }]);
  });

  it('Changer de branche (new-here) pendant une action qui modifie la branche : refusé', async () => {
    gitWith('');
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('note', { text: 'une demande' })).toEqual({ ok: true });
    expect(runVibeAction('new-here', { direct: true, branch: 'feat/y' })).toMatchObject({ ok: false });
  });

  it('load-pr réussi, en Créer : la PR suivie', async () => {
    gitWith('');
    await open();
    const { runVibeAction } = await import('app/controllers');
    runVibeAction('load-pr', { direct: true, pr: 12 });
    await until(() => done('load-pr'));
    expect(await vibeOf()).toMatchObject({ pr: 12 });
  });

  it('Rédiger la note sur la base, en Créer : la nouvelle demande (son message, la demande retenue)', async () => {
    fake.facts = { ...fake.facts as object, branch: 'main' };
    await open();
    const { refreshVibe, runVibeAction, lastView } = await import('app/controllers');
    expect(runVibeAction('note', { text: 'ajouter un bouton' })).toEqual({ ok: true });
    await until(() => fake.messages.length > 0);
    expect(fake.messages[0]).toBe(`/vibecoder:nouvelle-demande fr ${out} ajouter un bouton`);
    write(path.join(out, 'new-request.json'), JSON.stringify({ branch: 'feat/0.13.0-bouton' }));
    await refreshVibe({ now: true });
    expect((lastView('a1') as unknown as JourneyInput).request).toBe('feat/0.13.0-bouton');
  });
});

describe('0.13.0 : les artefacts', () => {
  beforeEach(() => {
    write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), JSON.stringify([
      { id: 'copy-artifact', flow: 'both', step: null, kind: 'send', needs: 'none', label: 'Copier dans le projet', text: 'copier' },
      { id: 'add-artifact', flow: 'both', step: null, kind: 'send', needs: 'none', label: 'Ajouter', text: 'ajouter' },
    ]));
    write(path.join(out, 'artifacts', 'notes.md'), '# notes\n');
  });
  const directOf = async (id = 'copy-artifact') => ((await import('app/controllers')).lastView('a1') as unknown as JourneyInput | null)?.direct?.[id];

  it('copy-artifact : jamais à l’agent, ni sans le clic, ni sans un id du relevé ; une erreur de la copie rendue au relevé', async () => {
    const { view } = await open();
    const { runVibeAction } = await import('app/controllers');
    const id = (view() as unknown as { artifacts: { id: string; name: string }[] }).artifacts.find((a) => a.name === 'notes.md')!.id;
    expect(runVibeAction('copy-artifact', { artifact: id })).toMatchObject({ ok: false });
    expect(runVibeAction('copy-artifact', { direct: true })).toMatchObject({ ok: false });
    expect(runVibeAction('copy-artifact', { direct: true, artifact: 'notes.md' })).toMatchObject({ ok: false });
    expect(runVibeAction('copy-artifact', { direct: true, artifact: id })).toEqual({ ok: true });
    for (let i = 0; i < 60 && (await directOf())?.running !== false; i++) await settle();
    expect((await directOf())?.last).toMatchObject({ ok: false, line: 'EACCES: permission denied' });
    expect([fake.calls, fake.messages]).toEqual([[['copyArtifact', 'a1', id]], []]);
  });

  it('add-artifact : jamais à l’agent, ni sans le clic ; le clic n’ouvre que la boîte de dialogue, sans chemin', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('add-artifact', { paths: ['/etc/passwd'] })).toMatchObject({ ok: false });
    expect(runVibeAction('add-artifact', { direct: true, paths: ['/etc/passwd'], dropped: ['/etc/passwd'] })).toEqual({ ok: true });
    for (let i = 0; i < 60 && (await directOf('add-artifact'))?.running !== false; i++) await settle();
    expect(fake.calls).toEqual([['pickArtifacts', 'a1']]);
    expect(fake.messages).toEqual([]);
  });

  it('un dépôt : refusé sans agent affiché ou si l’action n’est pas au relevé, sans lire de chemin', async () => {
    const { dropOnArtifacts } = await import('app/controllers');
    expect(dropOnArtifacts(['/etc/passwd'])).toMatchObject({ ok: false });
    await open();
    write(path.join(fake.userData, 'vibecoder', 'actions.fr.json'), '[]');
    await (await import('app/controllers')).refreshVibe({ now: true });
    expect(dropOnArtifacts(['/etc/passwd'])).toMatchObject({ ok: false });
    expect(fake.calls).toEqual([]);
  });

  it('un dépôt : la même action directe que le bouton, son résultat au relevé ; un second pendant le premier refusé', async () => {
    await open();
    const { dropOnArtifacts } = await import('app/controllers');
    const paths = ['/tmp/a.md'];
    fake.busy = true;   // la copie tient jusqu'à fake.release : l'ajout reste « en cours »
    expect(dropOnArtifacts(paths)).toEqual({ ok: true });
    await settle();
    expect((await directOf('add-artifact'))?.running).toBe(true);
    expect(dropOnArtifacts(paths)).toMatchObject({ ok: false });
    fake.busy = false;
    fake.release();
    for (let i = 0; i < 60 && (await directOf('add-artifact'))?.running !== false; i++) await settle();
    expect((await directOf('add-artifact'))?.last).toMatchObject({ ok: true, line: 'Added by drop.' });
    expect(fake.calls).toEqual([['addArtifacts', 'a1', paths]]);
  });
});
