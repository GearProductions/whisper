// Invariant des actions qui courent à part (note 0.9.0, « Ce que ça ne doit
// pas faire ») : avoir en cours en même temps deux actions qui modifient la
// branche, ou une lecture pendant une modification, qu'elles viennent d'un
// clic ou de l'orchestrateur. Une action arrêtée dont l'utilisateur n'a pas
// encore choisi Garder ou Annuler compte comme en cours.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, les actions livrées dans resources/),
// dans le décor commun (app/tests/harness) : faux Electron et faux SDK de
// Claude Code (chaque message reçu ouvre un tour, qui dure jusqu'à interrupt()).
// L'orchestrateur demande une action comme le fait son skill : run.start à la
// porte de son robot, par le socket (orchestratorAsks du décor).
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, closeAll, fakeClaude, fakeElectron, openPanel, orchestratorAsks, profile, repo, repoResources, settle, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

// Les skills des tours en cours.
const inProgress = () => claude.turns.filter((t) => !t.done).map((t) => t.skill);
let out = '';

// Deux actions qui modifient la branche, une lecture (resources/vibecoder/actions.fr.json).
const FORME = '/vibecoder:forme';
const INVARIANTS = '/vibecoder:invariants';
const PONYTAIL = '/vibecoder:ponytail';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  const root = profile('whisper-runs-');
  // Un dépôt sur une branche dont la note est écrite : la Forme, les invariants et la revue sont possibles.
  repo(path.join(root, 'projet'));
  out = path.join(root, 'vibecoder-out', 'a1');
  writeConfig(root, [{ id: 'a1', dir: path.join(root, 'projet'), name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
});
afterEach(closeAll);

describe('deux actions qui modifient la branche ne sont jamais en cours ensemble', () => {
  it('deux clics de suite, sans relevé entre eux : seule la première travaille', async () => {
    await openPanel('a1');

    await click('forme');
    await click('invariants');
    await settle();

    // la Forme travaille, les invariants ne sont pas partis
    expect(inProgress()).toEqual([FORME]);
  });

  it('demandée par l’orchestrateur puis cliquée : seule la première travaille', async () => {
    await openPanel('a1');

    await orchestratorAsks(out, 'forme');
    await click('invariants');
    await settle();

    // la Forme de l'orchestrateur travaille, le clic n'a rien lancé
    expect(inProgress()).toEqual([FORME]);
  });

  it('deux demandes de l’orchestrateur lues au même relevé : une seule travaille', async () => {
    await openPanel('a1');

    await orchestratorAsks(out, 'forme', 'invariants');

    // une des deux, pas les deux (laquelle part, et ce que devient l'autre, ne relèvent pas de l'invariant)
    expect(inProgress()).toHaveLength(1);
  });

  // Arrêtée sans que l'utilisateur ait choisi Garder ou Annuler : ce qu'elle a écrit peut encore être annulé.
  it('une action arrêtée, pas encore tranchée : une autre modification ne part pas', async () => {
    const { vibeRunOp } = await import('app/controllers');
    await openPanel('a1');
    await click('forme');
    await settle();

    vibeRunOp('forme', 'stop');
    await settle();
    await click('invariants');
    await settle();

    // les invariants n'ont jamais été envoyés à Claude Code
    expect(claude.turns.map((t) => t.skill)).not.toContain(INVARIANTS);

    // témoin : une fois la Forme gardée, le même clic part (c'était bien elle qui retenait)
    vibeRunOp('forme', 'keep');
    await settle();
    await click('invariants');
    await settle();
    expect(inProgress()).toEqual([INVARIANTS]);
  });
});

describe('une lecture n’est jamais en cours pendant une modification', () => {
  it('une modification puis une lecture, au clic : seule la modification travaille', async () => {
    await openPanel('a1');

    await click('forme');
    await click('ponytail');
    await settle();

    // la Forme travaille, Ponytail review n'est pas partie
    expect(inProgress()).toEqual([FORME]);
  });

  it('une lecture puis une modification, au clic : seule la lecture travaille', async () => {
    await openPanel('a1');

    await click('ponytail');
    await click('forme');
    await settle();

    // Ponytail review travaille, la Forme n'est pas partie
    expect(inProgress()).toEqual([PONYTAIL]);
  });

  it('une modification au clic, une lecture demandée par l’orchestrateur : seule la modification travaille', async () => {
    await openPanel('a1');

    await click('forme');
    await settle();
    await orchestratorAsks(out, 'ponytail');

    // la Forme travaille, Ponytail review n'est pas partie
    expect(inProgress()).toEqual([FORME]);
  });

  // Arrêtée sans que l'utilisateur ait choisi Garder ou Annuler : ce qu'elle a écrit peut encore être annulé.
  it('une modification arrêtée, pas encore tranchée : une lecture ne part pas', async () => {
    const { vibeRunOp } = await import('app/controllers');
    await openPanel('a1');
    await click('forme');
    await settle();

    vibeRunOp('forme', 'stop');
    await settle();
    await click('ponytail');
    await settle();

    // Ponytail review n'a jamais été envoyée à Claude Code
    expect(claude.turns.map((t) => t.skill)).not.toContain(PONYTAIL);

    // témoin : une fois la Forme gardée, le même clic part
    vibeRunOp('forme', 'keep');
    await settle();
    await click('ponytail');
    await settle();
    expect(inProgress()).toEqual([PONYTAIL]);
  });

  it('une modification et une lecture demandées par l’orchestrateur au même relevé : une seule travaille', async () => {
    await openPanel('a1');

    await orchestratorAsks(out, 'forme', 'ponytail');

    // l'une ou l'autre, pas les deux (laquelle part ne relève pas de l'invariant)
    expect(inProgress()).toHaveLength(1);
  });
});

// Invariant voisin (même note) : annuler, à l'arrêt d'une action, autre chose que
// ce qu'elle a écrit. Ici, le chemin de l'écran : vibeRunOp(id, 'undo') ramène le
// processus de CETTE action, jamais la conversation ni une autre course.
describe('Annuler, depuis l’écran, ne ramène que l’action annulée', () => {
  it('la conversation travaille, une lecture a été gardée : Annuler la Forme ne ramène que la Forme', async () => {
    const { vibeRunOp } = await import('app/controllers');
    await openPanel('a1');
    // la conversation travaille (une nouvelle demande, sans étape : elle reste dans la conversation)
    await click('new-request', { text: 'une page des réglages' });
    // une lecture, arrêtée et gardée
    await click('ponytail');
    await settle();
    vibeRunOp('ponytail', 'stop');
    await settle();
    vibeRunOp('ponytail', 'keep');
    await settle();
    // la Forme, arrêtée puis annulée
    await click('forme');
    await settle();
    vibeRunOp('forme', 'stop');
    await settle();

    vibeRunOp('forme', 'undo');
    await settle();

    // un seul retour en arrière, demandé au processus de la Forme
    expect(claude.rewound).toEqual([FORME]);
  });
});
