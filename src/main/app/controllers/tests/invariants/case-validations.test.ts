// Invariant des validations de cas (note 0.15.0, docs/tickets/feat/0.15.0-invariants-par-cas.md,
// « Ce que ça ne doit pas faire ») :
//   - I-63 « Modifier un fichier du projet pour calculer, garder, convertir ou retirer une validation de cas ».
// Chaque absence a son témoin : le geste a bien eu lieu (la marque du cas posée ou retirée, gardée ou
// tombée au relevé, convertie).
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le SDK de Claude Code
// factices, git réel sur un dépôt d'essai). Les gestes de l'écran passent par le ✓ que la page envoie
// (markVibe, cible « case:<chemin>:<clé> ») ; ce que la page voit : le dernier conv:vibe poussé.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import {
  closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, slow, write, writeConfig,
} from 'app/tests/harness';

vi.setConfig({ testTimeout: slow(20000) });

const electron = fakeElectron();
const claude = fakeClaude({ finish: true });
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

const BRANCH = 'feat/0.15.0-essai';
const NOTE_TEXT = ['# 0.15.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
// Un test d'invariant : un code commun (l'import, une constante), un cas, puis deux cas de même titre.
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const INV_TEXT = [
  "import { it } from 'vitest';",
  'const un = 1;',
  "it('premier cas', () => {",
  '  void un;',
  '});',
  "it('même titre', () => {",
  '  void 1;',
  '});',
  "it('même titre', () => {",
  '  void 2;',
  '});',
  '',
].join('\n');
// Le second cas « même titre » retouché, dans son bloc seul.
const INV_CASE_EDITED = INV_TEXT.replace('  void 2;', '  void 3;');
// Le code commun retouché (la constante en tête), aucun bloc de cas touché.
const INV_COMMON_EDITED = INV_TEXT.replace('const un = 1;', 'const un = 2;');

let root = '';
let dir = '';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  root = profile('whisper-case-validations-');
  // Le dépôt : la branche ajoute sa note et son test d'invariant, commités.
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: NOTE_TEXT });
  write(path.join(dir, INV), INV_TEXT);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'invariants');
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], { agentSelected: 'a1' });
});
afterEach(closeAll);

// Le test d'invariant tel que le dernier relevé le pousse à la page.
const testFile = () => (electron.windows.at(-1)!.sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as VibeView)
  .invariants.find((f) => f.path === INV)!;
// Les validations de l'agent rangées dans le profil de l'appli (vibecoder-state.json).
const storedMarks = () => JSON.parse(fs.readFileSync(path.join(root, 'vibecoder-state.json'), 'utf8')).marks.a1;

// Chaque fichier du projet (hors .git/) et son contenu.
function projectFiles(): Record<string, string> {
  const all: Record<string, string> = {};
  for (const rel of fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (rel === '.git' || rel.startsWith(`.git${path.sep}`) || fs.lstatSync(path.join(dir, rel)).isDirectory()) continue;
    all[rel] = fs.readFileSync(path.join(dir, rel), 'utf8');
  }
  return all;
}

// Un relevé, comme celui des 4 s.
async function survey() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await settle();
}
// Un ✓ de la page sur un cas (Validé : 'ok', retirer la validation : null), puis le relevé qui suit.
async function markCase(key: string, verdict: 'ok' | null) {
  const { markVibe } = await import('app/controllers');
  markVibe(`case:${INV}:${key}`, verdict);
  await settle();
  await survey();
}

describe('I-63 : aucun fichier du projet n’est modifié pour calculer, garder, convertir ou retirer une validation de cas', () => {
  // Le second de deux cas de même titre : sa clé porte son numéro d'ordre.
  it('Valider un cas ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    const before = projectFiles();

    await markCase('même titre n° 2', 'ok');

    // témoin : le cas est bien validé, sous sa clé
    expect(testFile().marks['même titre n° 2']).toBe('ok');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  it('retirer la validation d’un cas ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await markCase('même titre n° 2', 'ok');
    const before = projectFiles();

    await markCase('même titre n° 2', null);

    // témoin : le cas n'a plus de validation
    expect(testFile().marks['même titre n° 2']).toBeNull();
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  // Un autre cas retouché sur le disque : le relevé recalcule les empreintes et garde la validation du premier.
  it('le relevé qui garde la validation d’un cas après la retouche d’un autre ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await markCase('premier cas', 'ok');
    write(path.join(dir, INV), INV_CASE_EDITED);
    const before = projectFiles();

    await survey();

    // témoin : le cas dont le bloc n'a pas changé reste validé
    expect(testFile().marks['premier cas']).toBe('ok');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  // Le code commun retouché sur le disque : le relevé fait tomber la validation du cas.
  it('le relevé qui fait tomber une validation de cas après un changement du code commun ne modifie aucun fichier du projet', async () => {
    await openPanel('a1');
    await markCase('premier cas', 'ok');
    write(path.join(dir, INV), INV_COMMON_EDITED);
    const before = projectFiles();

    await survey();

    // témoin : la validation du cas est tombée, à cause du code commun
    expect(testFile().commonChanged ?? []).toContain('premier cas');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });

  // Une validation posée avant cette version, sur le fichier entier (sans common), le fichier inchangé depuis.
  it('la conversion d’une validation de cas d’avant ne modifie aucun fichier du projet', async () => {
    const { blobSha } = await import('core/vibecoder');
    write(path.join(root, 'vibecoder-state.json'), JSON.stringify({
      marks: { a1: { [`case:${INV}:premier cas`]: { hash: blobSha(INV_TEXT), verdict: 'ok' } } }, drafts: {},
    }));
    const before = projectFiles();

    await openPanel('a1');
    await survey();

    // témoin : la validation est bien convertie, sur le bloc du cas et le code commun
    expect(storedMarks()[`case:${INV}:premier cas`]).toHaveProperty('common');
    // chaque fichier du projet a le même texte, aucun n'est créé ni supprimé
    expect(projectFiles()).toEqual(before);
  });
});
