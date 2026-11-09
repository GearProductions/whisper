// Variants de l'entrée des commandes (runCommand) : l'état d'un bouton au relevé (Vibe grisée, Tirer
// grisée). Déplacés de invariants/commands-guards.test.ts (note 0.15.0, assainir les invariants), sur le
// décor commun (app/tests/harness) ; fichier à part parce que commands.test.ts remplace les contrôleurs.
// Sur le vrai principal (contrôleurs, état, fichiers sur disque, git réel sur un dépôt d'essai et son origin) ;
// faux : Electron et le SDK de Claude Code (chaque message reçu ouvre un tour).
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeClaude, fakeElectron, git, openPanel, profile, remote, repo, repoResources, settle, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

describe('par l’entrée, l’état d’un bouton au relevé (le vrai principal)', () => {
  let root = '';

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
    root = profile('whisper-commands-');
    repo(path.join(root, 'projet'));
    writeConfig(root, [{ id: 'a1', dir: path.join(root, 'projet'), name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
  });
  afterEach(closeAll);

  // Une commande passée à l'entrée pour le robot a1, comme le fera une porte.
  async function command(name: string, args: object = {}, door: 'agent' | 'screen' = 'agent') {
    const { runCommand } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    const robot = loadConfig().agents.find((a) => a.id === 'a1')!;
    const res = await runCommand(robot, { command: name, args, door });
    await settle();
    return res;
  }

  // Une action du dernier relevé du robot.
  async function shown(id: string) {
    const { lastView } = await import('app/controllers');
    return lastView('a1')?.actions.find((a) => a.id === id);
  }

  it('Vibe grisée au relevé (la note pas validée) : rien n’est envoyé, le mode Vibe ne démarre pas', async () => {
    const { vibeOn } = await import('app/controllers');
    await openPanel('a1');
    // témoin : le relevé la grise
    expect((await shown('vibe'))?.disabled).toBeTruthy();

    const res = await command('vibe');

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(claude.turns).toEqual([]);
    // le mode Vibe n'est pas en cours
    expect(vibeOn('a1')).toBe(false);
  });

  it('Tirer grisée au relevé (déjà à jour) : un commit poussé depuis n’est pas tiré', async () => {
    const dir = path.join(root, 'projet');
    const origin = remote(dir);
    await openPanel('a1');
    // témoin : au relevé, la branche est à jour, Tirer est grisée
    expect((await shown('pull'))?.disabled).toBeTruthy();
    // un commit poussé sur l'origine après le relevé
    const other = path.join(root, 'autre');
    git(root, 'clone', '-q', '-b', 'feat/0.9.0-essai', origin, other);
    git(other, 'commit', '-q', '--allow-empty', '-m', 'ailleurs');
    git(other, 'push', '-q');
    const before = git(dir, 'rev-parse', 'HEAD').trim();

    const res = await command('pull');

    // refusée
    expect(res.ok).toBe(false);
    // la branche locale n'a pas bougé
    expect(git(dir, 'rev-parse', 'HEAD').trim()).toBe(before);
  });
});
