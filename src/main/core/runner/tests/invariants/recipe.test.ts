// Invariants de la recette du fichier du projet (setup, worktree.create,
// worktree.remove), lancée par l'appli sans IA. Protégés : si un test échoue,
// corriger le code.
//   Note 0.12.0 docs/tickets/feat/0.12.0-worktrees.md, « Ce que ça ne doit pas
//   faire » :
//   - « Mettre un nom de branche dans le texte d'une commande : il passe par
//     les variables VIBECODER_BRANCH et VIBECODER_BASE » ;
//   - « Lancer autre chose que les commandes du fichier du projet (I-42 étendu
//     à setup et worktree) » : chaque étape est une commande du fichier,
//     derrière le préfixe, dans le shell du fichier — ou, sans commande, le
//     git de repli, liste fermée, sans shell ni --force ; une proposition
//     n'écrit jamais par-dessus un setup ou un worktree déjà réglé.
// I-42 de base (le rang, les demandes de l'agent) : runner.test.ts.
// Fonctions pures : appelées telles quelles.
import { describe, expect, it } from 'vitest';
import { createSteps, mergeProject, parseProject, recipeEnv, removeSteps, setupSteps, worktreeDir, type Project } from 'core/runner';

const BRANCH = 'feat/12-ajout-export';
const HOME = '/depots/projet';
const START = 'origin/main';
const SETTING = 'distrobox enter dev --';
const PREFIX = ['distrobox', 'enter', 'dev', '--'];
const SETUP = ['yarn install', 'yarn build:types'];
const CREATE = 'yarn setup-worktree "$VIBECODER_BRANCH" "$VIBECODER_BASE"';
const REMOVE = 'yarn cleanup-worktree "$VIBECODER_BRANCH"';

const project = (extra: object) => parseProject(JSON.stringify({ commands: [], ...extra })) as Project;
const withRecipe = project({ setup: SETUP, worktree: { create: CREATE, remove: REMOVE, dir: '../projet-worktrees/{branch}' } });
const withoutRecipe = project({ setup: SETUP });
// Un argv du fichier : le préfixe, le shell du fichier (bash -ic par défaut), le texte.
const fileArgv = (text: string) => [...PREFIX, 'bash', '-ic', text];

describe('la branche passe par l’environnement, jamais par le texte d’une commande', () => {
  it('créer avec worktree.create : aucun argument ne contient la branche', () => {
    const steps = createSteps(withRecipe, { home: HOME, branch: BRANCH, start: START }, '', SETTING);

    // la recette a bien des étapes
    expect(steps.length).toBeGreaterThan(0);
    // aucun argument d'aucune étape ne mentionne la branche
    expect(steps.flatMap((s) => s.argv).filter((a) => a.includes(BRANCH))).toEqual([]);
  });

  it('créer sans worktree.create : la branche n’est dans le texte d’aucune commande du shell', () => {
    const steps = createSteps(withoutRecipe, { home: HOME, branch: BRANCH, start: START }, '', SETTING);
    const shellTexts = steps.filter((s) => s.argv.includes('-ic')).map((s) => s.argv.at(-1)!);

    // le setup suit bien git worktree add, dans le shell du fichier
    expect(shellTexts.length).toBeGreaterThan(0);
    // aucun texte passé au shell ne mentionne la branche
    expect(shellTexts.filter((t) => t.includes(BRANCH))).toEqual([]);
  });

  it('créer sans worktree.create : la branche est un argument à elle seule, d’un git sans shell', () => {
    const steps = createSteps(withoutRecipe, { home: HOME, branch: BRANCH, start: START }, '', SETTING);
    const withBranch = steps.filter((s) => s.argv.includes(BRANCH));

    // une seule étape porte la branche, comme argument entier
    expect(withBranch).toHaveLength(1);
    // cette étape est git, juste après le préfixe
    expect(withBranch[0].argv[PREFIX.length]).toBe('git');
    // et aucun shell ne la lance
    expect(withBranch[0].argv).not.toContain('-ic');
  });

  it('retirer avec worktree.remove : aucun argument ne contient la branche', () => {
    const steps = removeSteps(withRecipe, { home: HOME, dir: worktreeDir(withRecipe, HOME, BRANCH) }, '', SETTING);

    // la recette a bien des étapes
    expect(steps.length).toBeGreaterThan(0);
    // aucun argument d'aucune étape ne mentionne la branche
    expect(steps.flatMap((s) => s.argv).filter((a) => a.includes(BRANCH))).toEqual([]);
  });

  it('la branche et la base données sont celles des variables', () => {
    const env = recipeEnv(BRANCH, 'main');

    // VIBECODER_BRANCH : la branche, VIBECODER_BASE : la base
    expect(env).toEqual({ VIBECODER_BRANCH: BRANCH, VIBECODER_BASE: 'main' });
  });

  it('une branche avec des caractères de shell : pas de variables, donc pas de recette', () => {
    const env = recipeEnv('feat/x; touch pwned', 'main');

    // refusée
    expect(env).toBeNull();
  });

  it('une branche qui commence par « - » : pas de variables', () => {
    const env = recipeEnv('--force', 'main');

    // refusée
    expect(env).toBeNull();
  });

  it('une base avec « .. » : pas de variables', () => {
    const env = recipeEnv(BRANCH, '../main');

    // refusée
    expect(env).toBeNull();
  });
});

describe('rien d’autre que les commandes du fichier du projet (I-42 étendu à setup et worktree)', () => {
  it('préparer : les commandes setup du fichier, dans leur ordre, derrière le préfixe, au dossier donné, rien d’autre', () => {
    const steps = setupSteps(withRecipe, '/depots/projet-worktrees/x', '', SETTING);

    // exactement les commandes du fichier, chacune dans le shell du fichier, après le préfixe
    expect(steps.map((s) => s.argv)).toEqual(SETUP.map(fileArgv));
    // toutes au dossier donné
    expect(steps.filter((s) => s.cwd !== '/depots/projet-worktrees/x')).toEqual([]);
  });

  it('créer avec worktree.create : d’abord worktree.create au dossier du parent, puis seulement des commandes du fichier', () => {
    const steps = createSteps(withRecipe, { home: HOME, branch: BRANCH, start: START }, '', SETTING);
    const allowed = [CREATE, ...SETUP].map((t) => JSON.stringify(fileArgv(t)));

    // la première étape : worktree.create, au dossier du parent
    expect(steps[0]).toEqual({ argv: fileArgv(CREATE), cwd: HOME });
    // aucune étape qui ne soit une commande du fichier
    expect(steps.filter((s) => !allowed.includes(JSON.stringify(s.argv)))).toEqual([]);
  });

  it('créer sans worktree.create : git -C <parent> worktree add -b <branche> <dossier> <départ>, puis le setup du fichier au worktree, rien d’autre', () => {
    const dir = worktreeDir(withoutRecipe, HOME, BRANCH);

    const steps = createSteps(withoutRecipe, { home: HOME, branch: BRANCH, start: START }, '', SETTING);

    // la première étape : le git de repli, derrière le préfixe, sans shell
    expect(steps[0].argv).toEqual([...PREFIX, 'git', '-C', HOME, 'worktree', 'add', '-b', BRANCH, dir, START]);
    // ensuite : le setup du fichier, au worktree, et rien d'autre
    expect(steps.slice(1)).toEqual(setupSteps(withoutRecipe, dir, '', SETTING));
  });

  it('retirer avec worktree.remove : worktree.remove, derrière le préfixe, rien d’autre', () => {
    const steps = removeSteps(withRecipe, { home: HOME, dir: '/depots/projet-worktrees/x' }, '', SETTING);

    // une seule étape : la commande du fichier
    expect(steps.map((s) => s.argv)).toEqual([fileArgv(REMOVE)]);
  });

  it('retirer sans worktree.remove : git -C <parent> worktree remove <dossier>, sans --force, rien d’autre', () => {
    const steps = removeSteps(withoutRecipe, { home: HOME, dir: '/depots/projet-worktrees/x' }, '', SETTING);

    // une seule étape : le git de repli, derrière le préfixe, sans shell ni --force
    expect(steps.map((s) => s.argv)).toEqual([[...PREFIX, 'git', '-C', HOME, 'worktree', 'remove', '/depots/projet-worktrees/x']]);
  });

  it('une proposition n’écrit jamais par-dessus un worktree déjà réglé, même quand elle apporte un setup', () => {
    const current = JSON.stringify({ commands: [], worktree: { create: 'mon-script creer', remove: 'mon-script retirer' } });
    const proposal = JSON.stringify({ commands: [], setup: SETUP, worktree: { create: CREATE, remove: REMOVE } });

    const merged = mergeProject(current, proposal);

    // le setup qui manquait est adopté : le fichier est bien réécrit
    expect(merged).not.toBeNull();
    // le worktree de l'utilisateur est resté tel quel
    expect(JSON.parse(merged!).worktree).toEqual({ create: 'mon-script creer', remove: 'mon-script retirer' });
  });

  it('une proposition n’écrit jamais par-dessus un setup déjà réglé, même quand elle apporte un worktree', () => {
    const current = JSON.stringify({ commands: [], setup: ['mon-install'] });
    const proposal = JSON.stringify({ commands: [], setup: SETUP, worktree: { create: CREATE } });

    const merged = mergeProject(current, proposal);

    // le worktree qui manquait est adopté : le fichier est bien réécrit
    expect(merged).not.toBeNull();
    // le setup de l'utilisateur est resté tel quel
    expect(JSON.parse(merged!).setup).toEqual(['mon-install']);
  });
});
