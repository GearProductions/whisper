// Le décor commun des tests qui démarrent le principal réel sans fenêtre (contrôleurs, fenêtres, état,
// réglages et fichiers sur disque, git réel sur un dépôt d'essai) : le faux d'Electron et celui du SDK de
// Claude Code, les ressources livrées, le profil et le dépôt d'essai, le socket ouvert comme au lancement,
// le clic d'un bouton, les demandes de l'orchestrateur (run.start par la porte de son robot : orchestratorAsks, le seul
// endroit que la CLI retouche), l'attente du relevé. Hors des dossiers protégés : une retouche se
// signale dans la PR.
// Ne connaît pas : ce que vérifient les tests (aucun expect, aucun témoin : ils restent dans les fichiers
// protégés, et échouent si ce décor ne fait plus rien).
// Utilisé par : les tests d'invariants et de variants qui démarrent le principal (app/controllers, app).
//
// Emploi. vi.mock est remonté en tête du fichier, mais ses fabriques ne tournent qu'au premier import
// d'electron (dans le cas, après vi.resetModules()) : elles peuvent donc lire les constantes du fichier.
//
//   import { afterEach, beforeEach, vi } from 'vitest';
//   import { click, closeAll, fakeClaude, fakeElectron, openPanel, orchestratorAsks, profile, remote, repo,
//     repoResources, settle, writeConfig } from 'app/tests/harness';
//
//   const electron = fakeElectron();       // fakeElectron({ app: { isPackaged: true }, dialog: … }) : un export de plus ou remplacé
//   const claude = fakeClaude();           // fakeClaude({ finish: true }) : le tour finit aussitôt, sur un succès
//   vi.mock('electron', () => electron.module);
//   vi.mock('technicals/claude', () => claude.module);
//   vi.mock('technicals/paths', () => repoResources());
//
//   beforeEach(() => {
//     vi.resetModules();
//     vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });   // le relevé des 4 s ne tourne pas
//     const root = profile('whisper-essai-');   // aussi : remet à zéro les fenêtres, tours et boîtes
//     repo(`${root}/projet`);                    // writeConfig(root, [{ id: 'a1', dir: …, … }])
//   });
//   afterEach(closeAll);
//   // dans un cas : const panel = await openPanel('a1'); await click('forme'); expect(claude.turns)…
//
// Les faux sont créés une fois, en haut du fichier ; profile() les remet à zéro à chaque cas (leurs
// tableaux gardent leur identité : on les lit en direct, on ne les réassigne pas).
export { fakeElectron, FakeWin, type ElectronFake, type DialogFake } from './electron';
export { fakeClaude, type ClaudeFake, type Turn } from './claude';
export { repoResources, type PathsModule } from './resources';
export { profile, write, writeConfig } from './profile';
export { git, repo, remote } from './git';
export { openPanel, click, orchestratorAsks, settle, closeAll } from './app';
export { slow } from 'app/controllers/tests/slow';
