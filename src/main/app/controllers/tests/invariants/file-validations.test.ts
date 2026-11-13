// Invariants des validations d'étape (note 0.15.0, docs/tickets/feat/0.15.0-ecran-statuts.md,
// « Ce que ça ne doit pas faire ») :
//   - I-60 « Toucher à l'index du dépôt (ce que `git commit` prend) en validant, en retirant une
//     validation ou en lisant les validations » ;
//   - I-61 « Écrire quoi que ce soit dans le dépôt ou sous `.git/` en validant ou en retenant une
//     version (elles vont dans le dossier de sorties de l'appli) » ;
//   - I-62 « Modifier un fichier du projet (note, Forme, tests, modules) en validant, en retirant une
//     validation ou en décochant une étape » — par l'écran comme par la CLI (step.validate).
// Chaque absence a son témoin : le geste a bien eu lieu (l'étape cochée, décochée ou jamais validée,
// la version retenue dans le dossier de sorties).
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le SDK de Claude Code
// factices — chaque tour finit aussitôt, sans rien écrire —, git réel sur un dépôt d'essai). Les gestes
// de l'écran passent par le ✓ que la page envoie (markVibe, conv:vibeMark) ; ceux de la CLI par le socket,
// à la porte du robot (commandFromSocket, step.validate) ; ce que la page voit : le dernier conv:vibe poussé.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import {
  closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, slow, write, writeConfig,
} from 'app/tests/harness';

// Une course validée jusqu'aux modules enchaîne une dizaine de relevés.
vi.setConfig({ testTimeout: slow(20000) });

const electron = fakeElectron();
const claude = fakeClaude({ finish: true });
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

const BRANCH = 'feat/0.15.0-essai';
const NOTE = `docs/tickets/${BRANCH}.md`;
const NOTE_TEXT = ['# 0.15.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
// La même note dont la conception a changé (une ligne de plus dans « Ce que ça fait ») : la note et les étapes qui suivent décochées.
const NOTE_REDESIGNED = NOTE_TEXT.replace('- un essai\n', '- un essai\n- une ligne ajoutée depuis\n');
// Un module de la Forme : son texte au dernier commit, celui que prend le prochain `git commit` (l'index), et le disque.
const MOD = 'src/core/hello/index.ts';
const MOD_HEAD = 'export const hello = 1;\n';
const MOD_STAGED = 'export const hello = 2;\n';
const MOD_DISK = 'export const hello = 3;\n';
// Le module corrigé après la validation des modules (par l'utilisateur ou un agent).
const MOD_FIXED = 'export const hello = 4;\n';
// Un test d'invariant de deux cas.
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const INV_TEXT = "import { it } from 'vitest';\nit('premier cas', () => {});\nit('second cas', () => {});\n";

let root = '';
let dir = '';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  root = profile('whisper-file-validations-');
  // Le dépôt : la branche ajoute sa note, un module et son test d'invariant, commités.
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: NOTE_TEXT });
  write(path.join(dir, MOD), MOD_HEAD);
  write(path.join(dir, INV), INV_TEXT);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'module');
  // Une modification du module mise dans l'index (git add), puis une autre sur le disque seulement.
  write(path.join(dir, MOD), MOD_STAGED);
  git(dir, 'add', MOD);
  write(path.join(dir, MOD), MOD_DISK);
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], { agentSelected: 'a1' });
});
afterEach(closeAll);

// Le dernier relevé poussé à la page.
const view = () => electron.windows.at(-1)!.sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as VibeView;
// Où en est la validation d'une étape, telle que le relevé la donne : 'ok' (cochée), 'changed', 'cascade', null (jamais validée).
const checked = (step: string) => view().steps.find((s) => s.id === step)?.check?.state;
// Le texte de chaque fichier retenu dans le dossier de sorties de l'agent (validated/) : les listes et les versions.
function versions(): string[] {
  const kept = path.join(root, 'vibecoder-out', 'a1', 'validated');
  if (!fs.existsSync(kept)) return [];
  return fs.readdirSync(kept, { recursive: true, encoding: 'utf8' })
    .filter((f) => fs.lstatSync(path.join(kept, f)).isFile())
    .map((f) => fs.readFileSync(path.join(kept, f), 'utf8'));
}

// Chaque fichier et dossier sous le dépôt, .git/ compris : son contenu et l'heure de sa dernière écriture.
function everything(): Record<string, string> {
  const all: Record<string, string> = {};
  for (const rel of fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const st = fs.lstatSync(path.join(dir, rel));
    all[rel] = st.isDirectory() ? 'dossier' : `${st.mtimeMs} ${fs.readFileSync(path.join(dir, rel)).toString('base64')}`;
  }
  return all;
}
// Chaque fichier du projet (hors .git/) et son contenu.
function projectFiles(): Record<string, string> {
  const all: Record<string, string> = {};
  for (const rel of fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (rel === '.git' || rel.startsWith(`.git${path.sep}`) || fs.lstatSync(path.join(dir, rel)).isDirectory()) continue;
    all[rel] = fs.readFileSync(path.join(dir, rel), 'utf8');
  }
  return all;
}
// L'index du dépôt, octet pour octet.
const indexBytes = () => fs.readFileSync(path.join(dir, '.git', 'index')).toString('base64');
// Ce que le prochain `git commit` prendrait (lu sans réécrire l'index).
const staged = () => git(dir, '--no-optional-locks', 'diff', '--cached');

// Un relevé, comme celui des 4 s.
async function survey() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await settle();
}
// Un ✓ de la page (Valider : 'ok', retirer la validation : null), puis le relevé qui suit.
async function mark(target: string, verdict: 'ok' | null) {
  const { markVibe } = await import('app/controllers');
  markVibe(target, verdict);
  await settle();
  await survey();
}
// L'agent principal valide (ok) ou retire la validation (null) d'une étape par sa CLI : step.validate à la porte du robot a1.
async function cliValidate(step: 'forme' | 'invariants' | 'modules', verdict: 'ok' | null) {
  const { commandFromSocket } = await import('app/controllers');
  await commandFromSocket({ cmd: 'step.validate', args: { step, verdict }, token: '', target: '' }, 'a1');
  await settle();
  await survey();
}
// Valider la note : la vérification de conception part, finit aussitôt sans question, et la note est validée.
async function validateNote() {
  await mark('note', 'ok');
  await survey();
}
// La note puis la Forme validées.
async function upToForme() {
  await validateNote();
  await mark('forme', 'ok');
}
// La note, la Forme et les invariants validés : les deux cas du test ✓, puis Valider les invariants.
async function upToInvariants() {
  await upToForme();
  await mark(`case:${INV}:premier cas`, 'ok');
  await mark(`case:${INV}:second cas`, 'ok');
  await mark('invariants', 'ok');
}
// Toute la course validée, jusqu'aux modules.
async function upToModules() {
  await upToInvariants();
  await mark('modules', 'ok');
}

describe('I-60 : l’index du dépôt n’est jamais touché, ni en validant, ni en retirant une validation, ni en lisant les validations', () => {
  it('Valider la note laisse l’index tel quel', async () => {
    await openPanel('a1');
    const index = indexBytes();
    const commit = staged();

    await validateNote();

    // témoin : la note est bien cochée
    expect(checked('note')).toBe('ok');
    // l'index est le même, octet pour octet
    expect(indexBytes()).toEqual(index);
    // le prochain commit prendrait toujours la même chose
    expect(staged()).toEqual(commit);
  });

  // La Forme retient les fichiers des modules, dont l'un a une version dans l'index et une autre sur le disque.
  it('Valider la Forme laisse l’index tel quel', async () => {
    await openPanel('a1');
    await validateNote();
    const index = indexBytes();
    const commit = staged();

    await mark('forme', 'ok');

    // témoin : la Forme est bien cochée
    expect(checked('forme')).toBe('ok');
    // l'index est le même, octet pour octet
    expect(indexBytes()).toEqual(index);
    // le prochain commit prendrait toujours la même chose
    expect(staged()).toEqual(commit);
  });

  // Les invariants retiennent les fichiers de test.
  it('Valider les invariants laisse l’index tel quel', async () => {
    await openPanel('a1');
    await upToForme();
    await mark(`case:${INV}:premier cas`, 'ok');
    await mark(`case:${INV}:second cas`, 'ok');
    const index = indexBytes();
    const commit = staged();

    await mark('invariants', 'ok');

    // témoin : les invariants sont bien cochés
    expect(checked('invariants')).toBe('ok');
    // l'index est le même, octet pour octet
    expect(indexBytes()).toEqual(index);
    // le prochain commit prendrait toujours la même chose
    expect(staged()).toEqual(commit);
  });

  it('Valider les modules laisse l’index tel quel', async () => {
    await openPanel('a1');
    await upToInvariants();
    const index = indexBytes();
    const commit = staged();

    await mark('modules', 'ok');

    // témoin : les modules sont bien cochés
    expect(checked('modules')).toBe('ok');
    // l'index est le même, octet pour octet
    expect(indexBytes()).toEqual(index);
    // le prochain commit prendrait toujours la même chose
    expect(staged()).toEqual(commit);
  });

  it('retirer la validation des modules laisse l’index tel quel', async () => {
    await openPanel('a1');
    await upToModules();
    const index = indexBytes();
    const commit = staged();

    await mark('modules', null);

    // témoin : les modules n'ont plus de validation
    expect(checked('modules')).toBeNull();
    // l'index est le même, octet pour octet
    expect(indexBytes()).toEqual(index);
    // le prochain commit prendrait toujours la même chose
    expect(staged()).toEqual(commit);
  });

  // Les validations sont lues à chaque relevé : les modules validés puis un module corrigé, puis des relevés seuls.
  it('les relevés qui lisent les validations laissent l’index tel quel', async () => {
    await openPanel('a1');
    await upToModules();
    write(path.join(dir, MOD), MOD_FIXED);
    const index = indexBytes();
    const commit = staged();

    await survey();
    await survey();

    // témoin : le relevé a bien lu la validation des modules et vu le module corrigé depuis
    expect(checked('modules')).toBe('changed');
    // l'index est le même, octet pour octet
    expect(indexBytes()).toEqual(index);
    // le prochain commit prendrait toujours la même chose
    expect(staged()).toEqual(commit);
  });

  it('Valider les modules par la CLI (step.validate) laisse l’index tel quel', async () => {
    await openPanel('a1');
    await upToInvariants();
    const index = indexBytes();
    const commit = staged();

    await cliValidate('modules', 'ok');

    // témoin : les modules sont bien cochés par la CLI
    expect(checked('modules')).toBe('ok');
    // l'index est le même, octet pour octet
    expect(indexBytes()).toEqual(index);
    // le prochain commit prendrait toujours la même chose
    expect(staged()).toEqual(commit);
  });
});

describe('I-61 : rien n’est écrit dans le dépôt ni sous .git/ en validant ou en retenant une version : elles vont dans le dossier de sorties', () => {
  it('Valider la note : rien n’est écrit dans le dépôt', async () => {
    await openPanel('a1');
    const before = everything();

    await validateNote();

    // témoin : la note est bien cochée
    expect(checked('note')).toBe('ok');
    // aucun fichier ni dossier du dépôt, .git/ compris, n'est créé, écrit ou supprimé
    expect(everything()).toEqual(before);
  });

  it('Valider la Forme : les versions des modules vont dans le dossier de sorties, rien n’est écrit dans le dépôt', async () => {
    await openPanel('a1');
    await validateNote();
    const before = everything();

    await mark('forme', 'ok');

    // témoin : la Forme est bien cochée
    expect(checked('forme')).toBe('ok');
    // témoin : la version du module telle que validée est retenue dans le dossier de sorties
    expect(versions()).toContain(MOD_DISK);
    // aucun fichier ni dossier du dépôt, .git/ compris, n'est créé, écrit ou supprimé
    expect(everything()).toEqual(before);
  });

  it('Valider les invariants : la version du test va dans le dossier de sorties, rien n’est écrit dans le dépôt', async () => {
    await openPanel('a1');
    await upToForme();
    await mark(`case:${INV}:premier cas`, 'ok');
    await mark(`case:${INV}:second cas`, 'ok');
    const before = everything();

    await mark('invariants', 'ok');

    // témoin : les invariants sont bien cochés
    expect(checked('invariants')).toBe('ok');
    // témoin : la version du test telle que validée est retenue dans le dossier de sorties
    expect(versions()).toContain(INV_TEXT);
    // aucun fichier ni dossier du dépôt, .git/ compris, n'est créé, écrit ou supprimé
    expect(everything()).toEqual(before);
  });

  it('Valider les modules : rien n’est écrit dans le dépôt', async () => {
    await openPanel('a1');
    await upToInvariants();
    const before = everything();

    await mark('modules', 'ok');

    // témoin : les modules sont bien cochés
    expect(checked('modules')).toBe('ok');
    // aucun fichier ni dossier du dépôt, .git/ compris, n'est créé, écrit ou supprimé
    expect(everything()).toEqual(before);
  });

  // Revalider après une correction retient la nouvelle version du module.
  it('revalider les modules après une correction : la nouvelle version va dans le dossier de sorties, rien n’est écrit dans le dépôt', async () => {
    await openPanel('a1');
    await upToModules();
    write(path.join(dir, MOD), MOD_FIXED);
    await survey();
    const before = everything();

    await mark('modules', 'ok');

    // témoin : les modules sont bien recochés
    expect(checked('modules')).toBe('ok');
    // témoin : la version corrigée du module est retenue dans le dossier de sorties
    expect(versions()).toContain(MOD_FIXED);
    // aucun fichier ni dossier du dépôt, .git/ compris, n'est créé, écrit ou supprimé
    expect(everything()).toEqual(before);
  });

  it('retirer la validation des modules : rien n’est écrit dans le dépôt', async () => {
    await openPanel('a1');
    await upToModules();
    const before = everything();

    await mark('modules', null);

    // témoin : les modules n'ont plus de validation
    expect(checked('modules')).toBeNull();
    // aucun fichier ni dossier du dépôt, .git/ compris, n'est créé, écrit ou supprimé
    expect(everything()).toEqual(before);
  });

  // Revalider par la CLI après une correction retient la nouvelle version du module.
  it('revalider les modules par la CLI (step.validate) après une correction : la nouvelle version va dans le dossier de sorties, rien n’est écrit dans le dépôt', async () => {
    await openPanel('a1');
    await upToModules();
    write(path.join(dir, MOD), MOD_FIXED);
    await survey();
    const before = everything();

    await cliValidate('modules', 'ok');

    // témoin : les modules sont bien recochés par la CLI
    expect(checked('modules')).toBe('ok');
    // témoin : la version corrigée du module est retenue dans le dossier de sorties
    expect(versions()).toContain(MOD_FIXED);
    // aucun fichier ni dossier du dépôt, .git/ compris, n'est créé, écrit ou supprimé
    expect(everything()).toEqual(before);
  });
});

describe('I-62 : aucun fichier du projet n’est modifié en validant, en retirant une validation ou en décochant une étape', () => {
  it('Valider la note ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    const before = projectFiles();

    await validateNote();

    // témoin : la note est bien cochée
    expect(checked('note')).toBe('ok');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  it('Valider la Forme ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await validateNote();
    const before = projectFiles();

    await mark('forme', 'ok');

    // témoin : la Forme est bien cochée
    expect(checked('forme')).toBe('ok');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  it('Valider les invariants ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await upToForme();
    await mark(`case:${INV}:premier cas`, 'ok');
    await mark(`case:${INV}:second cas`, 'ok');
    const before = projectFiles();

    await mark('invariants', 'ok');

    // témoin : les invariants sont bien cochés
    expect(checked('invariants')).toBe('ok');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  it('Valider les modules ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await upToInvariants();
    const before = projectFiles();

    await mark('modules', 'ok');

    // témoin : les modules sont bien cochés
    expect(checked('modules')).toBe('ok');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  it('retirer la validation de la Forme ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await upToForme();
    const before = projectFiles();

    await mark('forme', null);

    // témoin : la Forme n'a plus de validation
    expect(checked('forme')).toBeNull();
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  // La conception de la note changée sur le disque : le relevé décoche la note, puis la Forme en cascade.
  it('le relevé qui décoche les étapes après un changement de la note ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await upToForme();
    write(path.join(dir, NOTE), NOTE_REDESIGNED);
    const before = projectFiles();

    await survey();

    // témoin : la note est bien décochée, modifiée depuis sa validation
    expect(checked('note')).toBe('changed');
    // témoin : la Forme est bien décochée en cascade
    expect(checked('forme')).toBe('cascade');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  // Un module corrigé après la validation des modules : le relevé décoche les modules.
  it('le relevé qui décoche les modules après une correction ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await upToModules();
    write(path.join(dir, MOD), MOD_FIXED);
    const before = projectFiles();

    await survey();

    // témoin : les modules sont bien décochés, modifiés depuis leur validation
    expect(checked('modules')).toBe('changed');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  it('Valider la Forme par la CLI (step.validate) ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await validateNote();
    const before = projectFiles();

    await cliValidate('forme', 'ok');

    // témoin : la Forme est bien cochée par la CLI
    expect(checked('forme')).toBe('ok');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  it('retirer la validation des modules par la CLI (step.validate) ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await upToModules();
    const before = projectFiles();

    await cliValidate('modules', null);

    // témoin : les modules n'ont plus de validation
    expect(checked('modules')).toBeNull();
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });
});
