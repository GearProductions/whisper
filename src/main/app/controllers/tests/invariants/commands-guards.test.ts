// Invariant de l'entrée des commandes (runCommand), note 0.15.0
// (docs/tickets/feat/0.15.0-executeur.md), « Ce que ça ne doit pas faire » :
// exécuter une commande sans les gardes de l'écran — deux actions qui écrivent
// en même temps (I-44), une action pas proposée ou masquée au relevé, un
// argument que l'écran refuserait. À la porte agent comme à la porte écran.
// L'état des autres boutons (Vibe ou Tirer grisées) est un variant : variants/commands.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, les actions et la table des commandes
// livrées dans resources/), dans le décor commun (app/tests/harness) : faux
// Electron et faux SDK de Claude Code (chaque message reçu ouvre un tour, qui
// dure jusqu'à interrupt()).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, closeAll, fakeClaude, fakeElectron, git, openPanel, profile, remote, repo, repoResources, settle, slow, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

// Les skills des tours en cours.
const inProgress = () => claude.turns.filter((t) => !t.done).map((t) => t.skill);
let root = '';

// Deux actions qui modifient la branche, une lecture (resources/vibecoder/actions.fr.json).
const FORME = '/vibecoder:forme';
const INVARIANTS = '/vibecoder:invariants';
const PONYTAIL = '/vibecoder:ponytail';
// La branche du dépôt d'essai ; le commit d'une branche d'un dépôt.
const head = () => git(path.join(root, 'projet'), 'rev-parse', '--abbrev-ref', 'HEAD').trim();
const commit = (dir: string, ref = 'HEAD') => git(dir, 'rev-parse', ref).trim();

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  root = profile('whisper-runs-');
  // Un dépôt sur une branche dont la note est écrite : la Forme, les invariants et la revue sont possibles.
  repo(path.join(root, 'projet'));
  writeConfig(root, [{ id: 'a1', dir: path.join(root, 'projet'), name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
});
afterEach(closeAll);

// Une commande passée à l'entrée pour le robot a1, comme le fera une porte.
async function command(name: string, args: object = {}, door: 'agent' | 'screen' = 'agent') {
  const { runCommand } = await import('app/controllers');
  const { loadConfig } = await import('app/settings');
  const agent = loadConfig().agents.find((a) => a.id === 'a1')!;
  const res = await runCommand(agent, { command: name, args, door });
  await settle();
  return res;
}

// Une action du dernier relevé du robot.
async function shown(id: string) {
  const { lastView } = await import('app/controllers');
  return lastView('a1')?.actions.find((a) => a.id === id);
}

describe('par l’entrée, deux actions qui écrivent ne sont jamais en cours ensemble (I-44)', () => {
  it('deux run.start de suite à la porte agent : seule la première travaille', async () => {
    await openPanel('a1');

    await command('run.start', { action: 'forme' });
    const second = await command('run.start', { action: 'invariants' });

    // la seconde est refusée
    expect(second.ok).toBe(false);
    // la Forme travaille, les invariants ne sont pas partis
    expect(inProgress()).toEqual([FORME]);
  });

  it('deux run.start de suite à la porte écran : seule la première travaille', async () => {
    await openPanel('a1');

    await command('run.start', { action: 'forme' }, 'screen');
    const second = await command('run.start', { action: 'invariants' }, 'screen');

    // la seconde est refusée
    expect(second.ok).toBe(false);
    // la Forme travaille, les invariants ne sont pas partis
    expect(inProgress()).toEqual([FORME]);
  });

  it('cliquée à l’écran puis demandée à l’entrée : seule la première travaille', async () => {
    await openPanel('a1');

    await click('forme');
    await settle();
    const asked = await command('run.start', { action: 'invariants' });

    // la demande est refusée
    expect(asked.ok).toBe(false);
    // la Forme du clic travaille, les invariants ne sont pas partis
    expect(inProgress()).toEqual([FORME]);
  });

  it('demandée à l’entrée puis cliquée à l’écran : seule la première travaille', async () => {
    await openPanel('a1');

    await command('run.start', { action: 'forme' });
    await click('invariants');
    await settle();

    // la Forme de l'entrée travaille, le clic n'a rien lancé
    expect(inProgress()).toEqual([FORME]);
  });

  it('une modification puis une lecture, à l’entrée : seule la modification travaille', async () => {
    await openPanel('a1');

    await command('run.start', { action: 'forme' });
    const read = await command('run.start', { action: 'ponytail' });

    // la lecture est refusée
    expect(read.ok).toBe(false);
    // la Forme travaille, Ponytail review n'est pas partie
    expect(inProgress()).toEqual([FORME]);
  });

  it('une lecture puis une modification, à l’entrée : seule la lecture travaille', async () => {
    await openPanel('a1');

    await command('run.start', { action: 'ponytail' });
    const write = await command('run.start', { action: 'forme' });

    // la modification est refusée
    expect(write.ok).toBe(false);
    // Ponytail review travaille, la Forme n'est pas partie
    expect(inProgress()).toEqual([PONYTAIL]);
  });

  // Arrêtée sans que l'utilisateur ait choisi Garder ou Annuler : ce qu'elle a écrit peut encore être annulé.
  it('une course arrêtée à l’entrée, pas encore tranchée : une autre modification ne part pas', async () => {
    await openPanel('a1');
    await command('run.start', { action: 'forme' });
    await command('run.stop', { action: 'forme' });

    const asked = await command('run.start', { action: 'invariants' });

    // la demande est refusée
    expect(asked.ok).toBe(false);
    // les invariants n'ont jamais été envoyés à Claude Code
    expect(claude.turns.map((t) => t.skill)).not.toContain(INVARIANTS);

    // témoin : une fois la Forme gardée, la même demande part (c'était bien elle qui retenait)
    await command('run.keep', { action: 'forme' });
    await command('run.start', { action: 'invariants' });
    expect(inProgress()).toEqual([INVARIANTS]);
  });

  it('une course qui modifie la branche en cours : un changement de branche demandé à l’entrée ne se fait pas', async () => {
    await openPanel('a1');
    await command('run.start', { action: 'forme' });
    const before = head();

    const asked = await command('switch-branch', { branch: 'main' });

    // la demande est refusée
    expect(asked.ok).toBe(false);
    // le dossier est resté sur la branche de la Forme
    expect(head()).toBe(before);
  });

  // Une action directe tient le dépôt tant que sa commande git tourne : ici un changement de branche que le hook
  // post-checkout du dépôt d'essai fait durer.
  it('une action directe en cours (changer de branche) : une course qui modifie la branche, demandée à l’entrée, ne part pas', async () => {
    const dir = path.join(root, 'projet');
    write(path.join(dir, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\nsleep 3\n');
    fs.chmodSync(path.join(dir, '.git', 'hooks', 'post-checkout'), 0o755);
    await openPanel('a1');
    // témoin : au relevé, Aller sur la branche est proposée et pas grisée
    expect(await shown('switch-branch')).toMatchObject({ hidden: false, disabled: null });

    // la Forme demandée pendant que git change de branche
    const [, asked] = await Promise.all([
      command('switch-branch', { branch: 'main' }),
      settle().then(() => command('run.start', { action: 'forme' })),
    ]);

    // la demande est refusée
    expect(asked.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(claude.turns).toEqual([]);
  }, slow(10_000));   // le hook tient git 3 s
});

describe('par l’entrée, une action pas proposée ou grisée au relevé ne part pas', () => {
  it('une action absente du relevé (une lecture du relecteur, en créateur) : rien n’est envoyé', async () => {
    await openPanel('a1');
    // témoin : le relevé du créateur ne la propose pas
    expect(await shown('review-note')).toBeUndefined();

    const res = await command('run.start', { action: 'review-note' });

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(claude.turns).toEqual([]);
  });

  it('une action masquée au relevé (les réponses, sans question ouverte) : rien n’est envoyé', async () => {
    await openPanel('a1');
    // témoin : le relevé la masque
    expect((await shown('answers'))?.hidden).toBe(true);

    const res = await command('run.start', { action: 'answers', answers: ['oui'] });

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(claude.turns).toEqual([]);
  });

  it('Pousser masquée au relevé : rien n’arrive sur l’origine', async () => {
    const dir = path.join(root, 'projet');
    const origin = remote(dir);
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'à pousser');
    await openPanel('a1');
    // témoin : le relevé la masque
    expect((await shown('push'))?.hidden).toBe(true);
    const before = commit(origin, 'feat/0.9.0-essai');

    const res = await command('push');

    // refusée
    expect(res.ok).toBe(false);
    // l'origine n'a rien reçu
    expect(commit(origin, 'feat/0.9.0-essai')).toBe(before);
  });
});

describe('par l’entrée, un argument que l’écran refuserait ne passe pas', () => {
  it('le rang d’un module que la Forme n’a pas : rien n’est envoyé', async () => {
    await openPanel('a1');

    const res = await command('run.start', { action: 'module', module: 99 });

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(claude.turns).toEqual([]);
  });

  it('un texte au-delà de la borne de la table : rien n’est envoyé', async () => {
    const { parseCommands } = await import('core/commands');
    const table = parseCommands(fs.readFileSync(path.join(process.cwd(), 'resources/vibecoder/commands.json'), 'utf8'));
    const max = table.commands.find((c) => c.name === 'run.start')!.args.properties!.text.maxLength!;
    await openPanel('a1');

    // un caractère de trop
    const res = await command('run.start', { action: 'note', text: 'x'.repeat(max + 1) });

    // refusée
    expect(res.ok).toBe(false);
    // rien n'a été envoyé à Claude Code
    expect(claude.turns).toEqual([]);
  });

  it('une branche qui n’est pas au relevé : le dossier ne change pas de branche', async () => {
    const dir = path.join(root, 'projet');
    await openPanel('a1');
    // créée après le relevé : git la connaît, le relevé non
    git(dir, 'branch', 'apres');
    const before = head();

    const res = await command('switch-branch', { branch: 'apres' });

    // refusée
    expect(res.ok).toBe(false);
    // le dossier est resté sur sa branche
    expect(head()).toBe(before);
  });

  it('une option à la place d’une branche : le dossier ne change pas de branche', async () => {
    await openPanel('a1');
    const before = head();

    const res = await command('switch-branch', { branch: '--orphan=x' });

    // refusée
    expect(res.ok).toBe(false);
    // le dossier est resté sur sa branche
    expect(head()).toBe(before);
  });
});
