// Variants du contrôle en trois points, côté contrôleurs (note 0.16.0, docs/tickets/feat/0.16.0-controle-en-trois-points.md,
// entrée « app/controllers runs + vibecoder ») : le moteur qui part seul quand la note est validée (la première fois ; revalidée
// en cours de parcours, il ne repart que s'il enchaînait quand elle a changé : note 0.16.0-ecran-essentiel), ses deux rythmes (les
// pauses du rythme par défaut, l'express qui n'en tient aucune), le ✓ de la note gardé ou tombé, les validations du système,
// la validation des modules par la CLI qui attend la preuve, preuve.md rangée avec les sorties de sa branche, les deux
// contrôles de l'appli (l'alignement n'écrit pas dans un test d'invariant d'avant la branche, la preuve ne change ni le
// dossier de travail ni l'index), leurs échecs (état illisible, fichier supprimé, course arrêtée).
// Les invariants de ces règles : app/controllers/tests/invariants (note-by-user, proof-gate, prove-rights) ; ici le reste.
// Dans un fichier à part de vibecoder.test.ts : celui-ci fausse git et le parcours pour tout le fichier (vi.mock), et ces
// cas ont besoin du vrai git et du vrai parcours.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le SDK de Claude Code factices, git réel sur
// un dépôt d'essai). Le moteur (vibe), l'alignement et la preuve durent jusqu'à ce que le cas finisse leur tour ; les autres
// courses (la vérification de conception…) finissent aussitôt. Ce que fait une course dans le projet est joué par le cas,
// qui écrit sur le disque et lance git comme le ferait une commande de son terminal.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import {
  click, closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, slow, write, writeConfig,
} from 'app/tests/harness';

vi.setConfig({ testTimeout: slow(20000) });

const LONG = ['/vibecoder:vibe', '/vibecoder:aligner', '/vibecoder:prouver', '/vibecoder:invariants'];
const electron = fakeElectron();
const claude = fakeClaude({ finish: (skill) => !LONG.includes(skill) });
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

const BRANCH = 'feat/0.16.0-essai';
const NOTE_FILE = `docs/tickets/${BRANCH}.md`;
const NOTE_TEXT = ['# 0.16.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
const NOTE_INV = NOTE_TEXT.replace('## Forme', '## Ce que ça ne doit pas faire\n\n- Lire un autre fichier. → invariant\n\n## Forme');
const MOD = 'src/core/hello/index.ts';
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const INV_TEXT = "import { it } from 'vitest';\nit('ne lit rien d’autre', () => {});\n";
const OLD_INV = 'src/core/hello/tests/invariants/ancien.test.ts';   // d'avant la branche, sur main
const PREFIX = 'distrobox enter dev --';
const ACCEPT_LINE = '- une ligne acceptée';
const ACCEPT = `**Accepter** — *Ce que ça fait* : « ${ACCEPT_LINE} »`;

let root = '';
let dir = '';
let out = '';

// Un dépôt d'essai (la note commitée, rien d'autre) : pour les cas du moteur et des rythmes.
function setup(note = NOTE_TEXT) {
  root = profile('whisper-control-');
  dir = path.join(root, 'projet');
  out = path.join(root, 'vibecoder-out', 'a1');
  repo(dir, { branch: BRANCH, note });
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], { agentSelected: 'a1', vibeCommandPrefix: PREFIX });
}

// Un dépôt où main porte un test d'invariant (d'avant la branche), la branche sa note, son test d'invariant et (module) son module.
function setupWithProof(module = true) {
  root = profile('whisper-control-');
  dir = path.join(root, 'projet');
  out = path.join(root, 'vibecoder-out', 'a1');
  repo(dir, { branch: BRANCH, note: NOTE_INV });
  git(dir, 'checkout', '-q', 'main');
  write(path.join(dir, OLD_INV), "import { it } from 'vitest';\nit('un ancien cas', () => {});\n");
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'ancien invariant');
  git(dir, 'checkout', '-q', BRANCH);
  git(dir, 'rebase', '-q', 'main');
  write(path.join(dir, INV), INV_TEXT);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'invariants');
  if (module) commitModule();
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], { agentSelected: 'a1', vibeCommandPrefix: PREFIX });
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
});
afterEach(closeAll);

// Le dernier relevé poussé à la page, la validation d'une étape (state, by), les tours du moteur.
const view = () => electron.windows.at(-1)!.sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as VibeView;
const checkOf = (step: string) => view().steps.find((s) => s.id === step)?.check;
const vibeTurns = () => claude.turns.filter((t) => t.skill === '/vibecoder:vibe');

async function survey() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await settle();
}
// Le moteur arrêté (halted) ou non, comme la porte de l'orchestrateur le voit.
async function halted() {
  return (await import('app/controllers')).vibeHalted('a1');
}
// Valider la note : une validation d'étape aussitôt, sans vérification ; deux relevés (le moteur part au relevé qui suit).
async function validateNote() {
  const { markVibe } = await import('app/controllers');
  markVibe('note', 'ok');
  await settle();
  await survey();
  await survey();
}
// Vérifier : l'action design-check, comme la page la lance ; elle finit aussitôt (sans question : rien n'est écrit), puis deux relevés.
async function check() {
  const { runVibeAction } = await import('app/controllers');
  expect(await runVibeAction('design-check', {})).toEqual({ ok: true });
  await settle();
  await survey();
  await survey();
}
const conceptions = () => claude.turns.filter((t) => t.skill === '/vibecoder:conception').length;
const REDESIGNED = NOTE_TEXT.replace('- un essai\n', '- un essai\n- une ligne ajoutée depuis\n');
// Le rythme réglé par l'écran, puis un relevé.
async function setExpress(on: boolean) {
  const { setVibe } = await import('app/controllers');
  setVibe({ express: on });
  await settle();
  await survey();
}
// L'orchestrateur demande par la porte de son robot ; sa réponse.
async function ask(cmd: string, args: object = {}) {
  const { commandFromSocket } = await import('app/controllers');
  const res = await commandFromSocket({ cmd, args, token: '', target: '' }, 'a1');
  await settle();
  return res;
}
// Le tour du moteur fini (il a dit où il en est) : sa conversation au repos.
async function endEngine() {
  vibeTurns().at(-1)!.end(true);
  await settle();
  await survey();
}
// Un module commité : le parcours passe après les modules.
function commitModule() {
  write(path.join(dir, MOD), 'export const hello = 1;\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'modules');
}

// Le même dépôt, la note pas encore commitée : le parcours se tient à la pause après les invariants, qui précède le
// premier commit (sans ligne « → invariant », la Forme posée suffit) ; commitNote : le premier commit, une fois repris.
function setupAtPause() {
  setup();
  git(dir, 'reset', '-q', 'HEAD~1');
}
function commitNote() {
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'note');
}

describe('Vérifier, puis valider la note : deux gestes', () => {
  it('Vérifier finie sans question : la note pas validée, rien ne part ; le relevé dit « rien trouvé »', async () => {
    setup();
    await openPanel('a1');

    await check();

    // témoin : la vérification a bien tourné
    expect(conceptions()).toBe(1);
    expect(checkOf('note')?.state).not.toBe('ok');
    expect(vibeTurns()).toHaveLength(0);
    expect(view().note?.verified).toBe('clean');
  });

  it('Vérifier finie avec une question : le relevé ne le dit pas, rien ne part', async () => {
    setup();
    write(path.join(out, 'questions.md'), '## 1. Une question ?\n');
    await openPanel('a1');

    await check();

    expect(conceptions()).toBe(1);
    expect(view().note?.verified ?? null).toBeNull();
    expect(checkOf('note')?.state).not.toBe('ok');
    expect(vibeTurns()).toHaveLength(0);
  });

  it('Valider la note après une vérification qui n’a rien trouvé : la note validée, l’action vibe part sans autre clic, aucune vérification ne part', async () => {
    setup();
    await openPanel('a1');
    await check();
    expect(vibeTurns()).toHaveLength(0);

    await validateNote();

    expect(checkOf('note')?.state).toBe('ok');
    expect(vibeTurns()).toHaveLength(1);
    expect(conceptions()).toBe(1);
  });

  it('Valider la note sans vérification : validée aussitôt, le moteur part, aucune vérification (le principal ne refuse pas)', async () => {
    setup();
    await openPanel('a1');

    await validateNote();

    expect(checkOf('note')?.state).toBe('ok');
    expect(vibeTurns()).toHaveLength(1);
    expect(conceptions()).toBe(0);
  });

  it('la note modifiée après cette vérification : le relevé dit « changée depuis » ; Valider la note : validée pour la note d’aujourd’hui, le moteur part', async () => {
    setup();
    await openPanel('a1');
    await check();
    write(path.join(dir, NOTE_FILE), REDESIGNED);
    await survey();

    expect(view().note?.verified).toBe('edited');
    expect(vibeTurns()).toHaveLength(0);

    await validateNote();

    expect(checkOf('note')?.state).toBe('ok');
    expect(vibeTurns()).toHaveLength(1);
    expect(conceptions()).toBe(1);
  });

  it('la conception validée est retenue dans les sorties (de quoi garder son ✓ après un « Accepter »)', async () => {
    setup();
    await openPanel('a1');
    await validateNote();
    const { blobSha, noteDesign } = await import('core/vibecoder');
    expect(fs.readFileSync(path.join(out, 'validated', blobSha(noteDesign(NOTE_TEXT))), 'utf8')).toBe(noteDesign(NOTE_TEXT));
  });

  it('Vérifier lancée par l’orchestrateur : sa fin rangée de même, jamais une validation', async () => {
    setup();
    await openPanel('a1');

    expect(await ask('run.start', { action: 'design-check' })).toMatchObject({ ok: true });
    await survey();
    await survey();

    expect(conceptions()).toBe(1);
    expect(view().note?.verified).toBe('clean');
    expect(checkOf('note')?.state).not.toBe('ok');
    expect(vibeTurns()).toHaveLength(0);
  });

  it('Vérifier relancée (la note changée entre-temps) : l’empreinte de la dernière course', async () => {
    setup();
    await openPanel('a1');
    await check();
    write(path.join(dir, NOTE_FILE), REDESIGNED);
    await survey();
    expect(view().note?.verified).toBe('edited');

    await check();

    expect(conceptions()).toBe(2);
    expect(view().note?.verified).toBe('clean');
    expect(vibeTurns()).toHaveLength(0);
  });

  it('Vérifier relancée avec une question, après une qui n’avait rien trouvé : « rien trouvé » retiré', async () => {
    setup();
    await openPanel('a1');
    await check();
    write(path.join(out, 'questions.md'), '## 1. Une question ?\n');

    await check();

    expect(view().note?.verified ?? null).toBeNull();
  });

  it('le moteur parti une fois : un relevé de plus ne le relance pas', async () => {
    setup();
    await openPanel('a1');
    await validateNote();
    await survey();
    await survey();

    expect(vibeTurns()).toHaveLength(1);
  });
});

describe('les deux rythmes', () => {
  it('le rythme par défaut, rien de commité : le moteur est arrêté au relevé, une demande de l’orchestrateur est refusée (halted)', async () => {
    setupAtPause();
    await openPanel('a1');
    await validateNote();
    await survey();

    // témoin : le parcours se tient après les invariants, avant le premier commit, au rythme par défaut
    expect(view().pause).toBe('invariants');
    expect(view().express).toBeFalsy();
    expect(await halted()).toBe(true);
    const res = await ask('run.start', { action: 'ponytail' });
    expect(res).toMatchObject({ ok: false, error: { code: 'halted' } });
    expect(claude.turns.map((t) => t.skill)).not.toContain('/vibecoder:ponytail');
  });

  it('Reprendre à cette pause : le moteur repart, la demande passe ; à la pause suivante il est arrêté de nouveau', async () => {
    setupAtPause();
    await openPanel('a1');
    await validateNote();
    await survey();
    await endEngine();   // il a dit où il en est
    expect(await halted()).toBe(false);   // au repos : hors Vibe

    await click('vibe');
    await settle();
    await survey();
    await survey();

    // le moteur est reparti, la pause d'où l'on part n'est plus tenue : la demande passe
    expect(vibeTurns()).toHaveLength(2);
    expect(view().pause).toBe('invariants');
    expect(await halted()).toBe(false);
    expect(await ask('run.start', { action: 'ponytail' })).toMatchObject({ ok: true });
    expect(claude.turns.map((t) => t.skill)).toContain('/vibecoder:ponytail');

    // la pause suivante est tenue
    commitNote();
    commitModule();
    await survey();
    await survey();
    expect(view().pause).toBe('modules');
    expect(await halted()).toBe(true);
    expect(await ask('run.start', { action: 'ci' })).toMatchObject({ ok: false, error: { code: 'halted' } });
  });

  // La note revalidée en cours de parcours : seule la première validation lance le moteur ; ensuite Valider la note rend son ✓
  // et remet les choses comme avant le changement (correction du 25 novembre, note 0.16.0-ecran-essentiel).
  for (const express of [false, true]) {
    it(`la note changée pendant l’essai, après les modules, le moteur arrêté${express ? ', en express' : ''} : Valider la note rend son ✓, rien ne part ; Reprendre : il repart`, async () => {
      setupAtPause();
      await openPanel('a1');
      if (express) await setExpress(true);
      await validateNote();
      await survey();
      await endEngine();
      commitNote();
      commitModule();
      await survey();
      await survey();
      expect(vibeTurns()).toHaveLength(1);
      expect((await import('app/controllers')).vibeOn('a1')).toBe(false);   // témoin : le moteur ne tourne pas (la pause, ou son tour fini)

      write(path.join(dir, NOTE_FILE), REDESIGNED);   // l'agent y écrit une décision, pendant l'essai
      await survey();
      await survey();
      expect(checkOf('note')?.state).not.toBe('ok');   // témoin : la note « modifiée depuis », son ✓ à reposer

      await validateNote();
      await survey();

      expect(checkOf('note')?.state).toBe('ok');
      expect(vibeTurns()).toHaveLength(1);
      expect((await import('app/controllers')).vibeOn('a1')).toBe(false);
      expect(view().actions.find((x) => x.id === 'vibe')).toMatchObject({ hidden: false });   // Reprendre reste proposé

      await click('vibe');
      await settle();
      await survey();
      expect(vibeTurns()).toHaveLength(2);
    });
  }

  it('le moteur tournait quand la note a changé (la pause de la note l’a arrêté) : Valider la note le relance, sans autre clic', async () => {
    setup();
    await openPanel('a1');
    await validateNote();
    expect(await halted()).toBe(false);   // témoin : le moteur tourne
    write(path.join(dir, NOTE_FILE), REDESIGNED);   // une décision écrite dans la note pendant qu'il enchaîne
    await survey();
    await survey();
    expect(view().pause).toBe('note');
    expect(await halted()).toBe(true);
    await endEngine();

    await validateNote();

    expect(checkOf('note')?.state).toBe('ok');
    expect(vibeTurns()).toHaveLength(2);
  });

  it('arrêté par la note, puis la note revenue à son texte validé (plus de pause) : une revalidation plus tard ne relance rien', async () => {
    setup();
    await openPanel('a1');
    await validateNote();
    write(path.join(dir, NOTE_FILE), REDESIGNED);
    await survey();
    await survey();
    expect(await halted()).toBe(true);
    await endEngine();
    write(path.join(dir, NOTE_FILE), NOTE_TEXT);   // revenue : son ✓ avec elle, la pause levée, le moteur toujours arrêté
    await survey();
    await survey();
    expect(checkOf('note')?.state).toBe('ok');
    expect(vibeTurns()).toHaveLength(1);

    write(path.join(dir, NOTE_FILE), REDESIGNED);   // changée de nouveau, le moteur arrêté cette fois
    await survey();
    await survey();
    await validateNote();

    expect(checkOf('note')?.state).toBe('ok');
    expect(vibeTurns()).toHaveLength(1);
  });

  it('en express : aucune pause tenue, les demandes passent', async () => {
    setupAtPause();
    await openPanel('a1');
    await setExpress(true);
    await validateNote();
    await survey();

    expect(view().express).toBe(true);
    expect(view().pause).toBe('invariants');
    expect(await halted()).toBe(false);
    expect(await ask('run.start', { action: 'ponytail' })).toMatchObject({ ok: true });
    commitNote();
    commitModule();
    await survey();
    expect(view().pause).toBe('modules');
    expect(await halted()).toBe(false);
  });

  it('passé en express à une pause : le moteur repart sans autre clic', async () => {
    setupAtPause();
    await openPanel('a1');
    await validateNote();
    await survey();
    await endEngine();
    expect(vibeTurns()).toHaveLength(1);

    await setExpress(true);
    await survey();

    expect(vibeTurns()).toHaveLength(2);
    expect(await halted()).toBe(false);
  });

  it('passé en express avant de valider la note : rien ne part avant sa validation', async () => {
    setup();   // la note commitée, sans son ✓ : la pause de la note
    await openPanel('a1');

    await setExpress(true);
    await survey();
    await survey();

    // témoin : la note attend, c'est sa pause
    expect(view().pause).toBe('note');
    expect(vibeTurns()).toHaveLength(0);

    await validateNote();
    expect(vibeTurns()).toHaveLength(1);
  });

  it('passé en express à une pause, la note changée entre-temps : rien ne repart', async () => {
    setupAtPause();
    await openPanel('a1');
    await validateNote();
    await survey();
    await endEngine();
    write(path.join(dir, NOTE_FILE), NOTE_TEXT.replace('- un essai\n', '- un essai\n- une ligne ajoutée depuis\n'));

    await setExpress(true);
    await survey();

    expect(vibeTurns()).toHaveLength(1);
  });

  it('revenu au rythme par défaut en route : la pause suivante est tenue', async () => {
    setupAtPause();
    await openPanel('a1');
    await setExpress(true);
    await validateNote();
    await survey();
    expect(await halted()).toBe(false);
    commitNote();
    commitModule();
    await survey();
    expect(view().pause).toBe('modules');
    expect(await halted()).toBe(false);

    await setExpress(false);
    await survey();

    expect(view().express).toBeFalsy();
    expect(await halted()).toBe(true);
  });

  it('passé en express : rien d’écrit dans les réglages de l’agent ; l’appli relancée, le rythme par défaut, la pause tenue', async () => {
    setupAtPause();
    await openPanel('a1');
    await validateNote();
    await setExpress(true);
    const config = fs.readFileSync(path.join(root, 'config.json'), 'utf8');

    // rien d'écrit dans les réglages
    expect(config).not.toContain('express');
    expect((await import('app/controllers')).expressOn('a1')).toBe(true);

    // l'appli relancée : le rythme par défaut ; le moteur relancé tient la pause (arrêté, hors Vibe : rien ne travaille)
    closeAll();
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await openPanel('a1');
    const controllers = await import('app/controllers');
    expect(controllers.expressOn('a1')).toBe(false);
    controllers.vibeStart({ id: 'a1' });
    expect(controllers.vibeOn('a1')).toBe(true);
    await survey();
    await survey();
    expect(view().express).toBeFalsy();
    expect(view().pause).toBe('invariants');
    expect(controllers.vibeOn('a1')).toBe(false);
  });
});

describe('le ✓ de la note', () => {
  it('la note validée puis un « Accepter » envoyé et écrit tel quel : son ✓ reste', async () => {
    setup();
    await openPanel('a1');
    await validateNote();
    expect(checkOf('note')?.state).toBe('ok');
    // une nouvelle question, et la réponse « Accepter » choisie telle quelle
    write(path.join(out, 'questions.md'), `## 1. Une question ?\n- ${ACCEPT}\n- **Refuser** — *Ce que ça fait* : « ${ACCEPT_LINE} »\n`);
    await survey();
    const { runVibeAction } = await import('app/controllers');
    expect(await runVibeAction('answers', { answers: [ACCEPT] })).toEqual({ ok: true });
    await settle();

    // l'agent écrit le texte accepté dans la note, à sa place
    write(path.join(dir, NOTE_FILE), NOTE_TEXT.replace('- un essai\n', `- un essai\n${ACCEPT_LINE}\n`));
    await survey();
    await survey();

    expect(checkOf('note')?.state).toBe('ok');
    expect(view().pause).not.toBe('note');
  });

  it('un « Accepter » écrit avec un mot changé, ou une réponse libre : le ✓ tombe', async () => {
    setup();
    await openPanel('a1');
    await validateNote();
    write(path.join(out, 'questions.md'), `## 1. Une question ?\n- ${ACCEPT}\n`);
    await survey();
    const { runVibeAction } = await import('app/controllers');
    await runVibeAction('answers', { answers: ['Oui, pourquoi pas.'] });
    await settle();

    write(path.join(dir, NOTE_FILE), NOTE_TEXT.replace('- un essai\n', `- un essai\n${ACCEPT_LINE}\n`));
    await survey();
    await survey();

    expect(checkOf('note')?.state).not.toBe('ok');
  });

  it('la note validée puis changée autrement, en express aussi : son ✓ tombe, le moteur est arrêté', async () => {
    setup();
    await openPanel('a1');
    await setExpress(true);
    await validateNote();
    expect(checkOf('note')?.state).toBe('ok');
    expect(await halted()).toBe(false);

    write(path.join(dir, NOTE_FILE), NOTE_TEXT.replace('- un essai\n', '- un essai\n- une ligne ajoutée depuis\n'));
    await survey();
    await survey();

    expect(view().express).toBe(true);
    expect(checkOf('note')?.state).not.toBe('ok');
    expect(view().pause).toBe('note');
    expect(await halted()).toBe(true);
  });

  it('l’appli relancée entre-temps : un « Accepter » ne garde plus le ✓ (les textes acceptés sont en mémoire)', async () => {
    setup();
    await openPanel('a1');
    await validateNote();
    write(path.join(out, 'questions.md'), `## 1. Une question ?\n- ${ACCEPT}\n`);
    await survey();
    const { runVibeAction } = await import('app/controllers');
    await runVibeAction('answers', { answers: [ACCEPT] });
    await settle();
    closeAll();
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await openPanel('a1');

    write(path.join(dir, NOTE_FILE), NOTE_TEXT.replace('- un essai\n', `- un essai\n${ACCEPT_LINE}\n`));
    await survey();
    await survey();

    expect(checkOf('note')?.state).not.toBe('ok');
  });
});

describe('les validations du système', () => {
  it('la Forme faite, hors Vibe : validée par le système au relevé', async () => {
    setup();
    await openPanel('a1');
    await validateNote();
    const { setVibe } = await import('app/controllers');
    setVibe({ vibe: false });
    await settle();

    await survey();

    expect(view().vibe).toBe(false);
    expect(checkOf('forme')).toMatchObject({ state: 'ok', by: 'system' });
    // la note : à l'utilisateur seul, ni « système » ni autre chemin
    expect(checkOf('note')?.by).toBeUndefined();
  });

  // La Forme et les invariants validés par le système (l'alignement fait), puis la validation de la Forme retirée à la main.
  async function formeRetired() {
    setupWithProof();
    write(path.join(out, 'align.md'), 'Aligné.\n');
    await openPanel('a1');
    await validateNote();
    await survey();
    expect(checkOf('invariants')).toMatchObject({ state: 'ok', by: 'system' });   // témoin
    const { markVibe } = await import('app/controllers');
    markVibe('forme', null);
    await settle();
    await survey();
  }

  it('la Forme retirée, les invariants faits : ni l’une ni l’autre reposée aux relevés qui suivent', async () => {
    await formeRetired();
    await survey();

    expect(checkOf('forme')?.state).not.toBe('ok');
    expect(checkOf('invariants')?.state).not.toBe('ok');
  });

  it('le contenu de l’étape changé après le retrait : validée de nouveau par le système', async () => {
    await formeRetired();
    // la section Forme de la note (hors conception : le ✓ de la note reste) : le contenu de la Forme change
    write(path.join(dir, NOTE_FILE), NOTE_INV.replace('hello() ·', 'hello(), réécrit ·'));
    git(dir, 'commit', '-q', '-am', 'forme corrigée');
    await survey();
    await survey();   // la marque posée au relevé d'avant, montrée par celui-ci

    expect(checkOf('forme')).toMatchObject({ state: 'ok', by: 'system' });
  });

  it('la validation de la Forme retirée à la main, puis l’appli relancée : pas reposée, les invariants non plus ; le contenu changé ensuite : validée de nouveau', async () => {
    await formeRetired();
    closeAll();
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await openPanel('a1');
    await survey();
    await survey();

    expect(checkOf('forme')?.state).not.toBe('ok');
    expect(checkOf('invariants')?.state).not.toBe('ok');

    write(path.join(dir, NOTE_FILE), NOTE_INV.replace('hello() ·', 'hello(), réécrit ·'));
    git(dir, 'commit', '-q', '-am', 'forme corrigée');
    await survey();
    await survey();

    expect(checkOf('forme')).toMatchObject({ state: 'ok', by: 'system' });
  });

  it('la sortie preuve.md : au relevé, et rangée avec les sorties de sa branche quand le dossier en change', async () => {
    setup(NOTE_INV);
    write(path.join(out, 'preuve.md'), '## [prouvé] Lire un autre fichier. → invariant\n\nMutant : x.\n');
    await openPanel('a1');
    await survey();
    expect(view().outputs['preuve.md']).toBeDefined();

    git(dir, 'switch', '-q', 'main');
    await survey();
    expect(view().outputs['preuve.md']).toBeUndefined();
    expect(fs.existsSync(path.join(out, 'branches', 'feat-0.16.0-essai', 'preuve.md'))).toBe(true);

    git(dir, 'switch', '-q', BRANCH);
    await survey();
    expect(view().outputs['preuve.md']).toBeDefined();
  });
});

// Après l'essai sur gt-plugins (25 novembre, note 0.16.0-ecran-essentiel) : le système ne pose aucun verdict de test, et un
// test d'invariant réécrit après le premier regard ramène la pause après les invariants.
describe('les tests d’invariants changés après leur validation', () => {
  const REWRITTEN = INV_TEXT.replace('() => {}', '() => { /* réécrit par une correction */ }');
  // La lecture en pseudo-code d'un texte du test (la pause attend que tout soit lu).
  async function read(text: string) {
    const { blobSha } = await import('core/vibecoder');
    write(path.join(out, 'invariants', `${blobSha(text)}.md`), `# ${INV}\n## ne lit rien d’autre\n\nrien d’autre n’est lu\n`);
  }
  // Les invariants validés par le système (alignés, lus, commités), le moteur en route.
  async function validated(express = false) {
    setupWithProof();
    write(path.join(out, 'align.md'), 'Aligné.\n');
    await read(INV_TEXT);
    await openPanel('a1');
    if (express) await setExpress(true);
    await validateNote();
    await survey();
    expect(checkOf('invariants')).toMatchObject({ state: 'ok', by: 'system' });   // témoin
  }
  async function rewrite() {
    write(path.join(dir, INV), REWRITTEN);
    await read(REWRITTEN);
    await survey();
    await survey();
  }

  it('aucun verdict de test n’est posé par le système : « Validé » reste à l’utilisateur', async () => {
    await validated();
    await survey();

    expect(view().invariants.flatMap((f) => Object.values(f.marks))).toEqual([null]);
  });

  it('au rythme par défaut : la pause après les invariants revient, le moteur arrêté, les modules pas validables ; Reprendre : validés, la pause levée', async () => {
    await validated();
    expect(await halted()).toBe(false);   // témoin : le moteur enchaîne

    await rewrite();

    expect(checkOf('invariants')?.state).toBe('changed');
    expect(view().pause).toBe('invariants');
    expect(await halted()).toBe(true);
    expect(await ask('run.start', { action: 'ponytail' })).toMatchObject({ ok: false, error: { code: 'halted' } });
    // les modules pas validables, et le refus nomme l'étape qui manque et pourquoi (T-43)
    const refusal = await ask('step.validate', { step: 'modules', verdict: 'ok' }) as unknown as { ok: boolean; error: { code: string; details: { reason: string } } };
    expect(refusal).toMatchObject({ ok: false, error: { code: 'not-offered' } });
    expect(refusal.error.details.reason).toMatch(/invariants step is not validated.*tests changed/);
    await survey();
    expect(checkOf('invariants')?.state).toBe('changed');   // aucun relevé ne les revalide

    await endEngine();
    await click('vibe');
    await settle();
    await survey();
    await survey();

    expect(checkOf('invariants')?.state).toBe('ok');
    expect(view().pause ?? null).not.toBe('invariants');
    expect(await halted()).toBe(false);
    expect(vibeTurns()).toHaveLength(2);
  });

  it('le moteur au repos (une correction dans la conversation) : à cette pause, l’agent ne lance pas ce qui bâtit sur les tests ; les invariants restent lançables ; Reprendre : la demande passe', async () => {
    await validated();
    await endEngine();   // son tour fini : hors Vibe
    await rewrite();
    expect(view().pause).toBe('invariants');
    expect(await halted()).toBe(false);   // témoin : ce n'est pas le moteur arrêté qui refuse

    for (const action of ['modules', 'commit-prepare', 'prove', 'checks']) {
      expect(await ask('run.start', { action })).toMatchObject({ ok: false, error: { code: 'halted' } });
    }
    expect(claude.turns.map((t) => t.skill)).not.toContain('/vibecoder:modules');
    expect(await ask('run.start', { action: 'read-invariants' })).not.toMatchObject({ error: { code: 'halted' } });   // elle finit aussitôt
    await survey();

    await click('vibe');
    await settle();
    await survey();
    expect(await ask('run.start', { action: 'ponytail' })).toMatchObject({ ok: true });
  });

  it('en express : pas de pause, le système les revalide, le moteur enchaîne', async () => {
    await validated(true);

    await rewrite();

    expect(checkOf('invariants')).toMatchObject({ state: 'ok', by: 'system' });
    expect(view().pause ?? null).not.toBe('invariants');
    expect(await halted()).toBe(false);
  });
});

// Vu le 26 novembre sur gt-plugins : la note en retouche (elle a perdu son ✓), l'agent relançait la forme après chaque réponse,
// et la vérification suivante attendait derrière. À la pause « note », on ne touche qu'à la note (correctif note-en-retouche).
describe('la note en retouche : on ne touche qu’à la note', () => {
  async function noteChanged() {
    setup();
    await openPanel('a1');
    await validateNote();
    commitModule();
    write(path.join(dir, NOTE_FILE), REDESIGNED);   // une décision écrite après les modules
    await survey();
    await survey();
    expect(view().pause).toBe('note');   // témoin
    await endEngine();
    expect(await halted()).toBe(false);   // témoin : ce n'est pas le moteur arrêté qui refuse
  }

  it('la forme, les tests, les modules, la revue, la PR : refusés à l’agent, halted, avec la raison', async () => {
    await noteChanged();
    for (const action of ['forme', 'align', 'read-invariants', 'modules', 'prove', 'checks', 'pr']) {
      const res = await ask('run.start', { action }) as unknown as { ok: boolean; error?: { code: string; details: { reason?: string } } };
      expect(res).toMatchObject({ ok: false, error: { code: 'halted' } });
      expect(res.error!.details.reason).toMatch(/note/);
    }
    expect(claude.turns.map((t) => t.skill)).not.toContain('/vibecoder:forme');
  });

  it('Vérifier la note reste lançable par l’agent', async () => {
    await noteChanged();
    expect(await ask('run.start', { action: 'design-check' })).not.toMatchObject({ error: { code: 'halted' } });
  });

  it('la note revalidée : la forme repart', async () => {
    await noteChanged();
    await validateNote();
    expect(view().pause ?? null).not.toBe('note');
    expect(await ask('run.start', { action: 'forme' })).not.toMatchObject({ error: { code: 'halted' } });
  });
});

describe('une validation d’étape retirée à la main : la pause sur l’étape', () => {
  // Le moteur au travail (relancé à la pause des invariants, ou en express), puis la validation de la Forme retirée à la main.
  async function engineThenRetired(express: boolean) {
    setupWithProof(false);
    write(path.join(out, 'align.md'), 'Aligné.\n');
    await openPanel('a1');
    if (express) await setExpress(true);
    await validateNote();
    await survey();
    if (!express) {
      await endEngine();
      await click('vibe');
      await settle();
      await survey();
      await survey();
    }
    const { vibeOn } = await import('app/controllers');
    expect(vibeOn('a1')).toBe(true);   // témoin : le moteur travaille
    await retire();
  }
  async function retire() {
    const { markVibe } = await import('app/controllers');
    markVibe('forme', null);
    await settle();
    await survey();
    await survey();
  }
  // Le ✓ de la Forme revalidé à la main (le retrait oublié).
  async function revalidate() {
    const { markVibe } = await import('app/controllers');
    markVibe('forme', 'ok');
    await settle();
    await survey();
    await survey();
  }
  // Le moteur au repos à la pause, puis la Forme retirée.
  async function atRestThenRetired() {
    setupWithProof(false);
    write(path.join(out, 'align.md'), 'Aligné.\n');
    await openPanel('a1');
    await validateNote();
    await survey();
    await endEngine();
    await retire();
    expect(view().pause).toBe('withdrawn:forme');   // témoin
  }
  const REWRITTEN = () => NOTE_INV.replace('hello() ·', 'hello(), réécrit ·');

  it.each([false, true])('le moteur en route (express : %s), la validation de la Forme retirée à la main : arrêté au relevé, une demande refusée (halted), le relevé dit la pause sur la Forme', async (express) => {
    await engineThenRetired(express);

    expect(view().pause).toBe('withdrawn:forme');
    expect(await halted()).toBe(true);
    expect(await ask('run.start', { action: 'ponytail' })).toMatchObject({ ok: false, error: { code: 'halted' } });
    expect(claude.turns.map((t) => t.skill)).not.toContain('/vibecoder:ponytail');
  });

  it('passé en express à cette pause : rien ne part', async () => {
    await atRestThenRetired();
    expect(vibeTurns()).toHaveLength(1);

    await setExpress(true);
    await survey();

    expect(vibeTurns()).toHaveLength(1);
    expect((await import('app/controllers')).vibeOn('a1')).toBe(false);
  });

  it('Valider la note à cette pause : rien ne part, ni aux relevés suivants une fois la pause levée', async () => {
    await atRestThenRetired();

    await validateNote();   // la note revalidée, le retrait toujours là
    expect(vibeTurns()).toHaveLength(1);
    expect(view().pause).toBe('withdrawn:forme');

    await revalidate();   // la pause levée : la demande est oubliée, pas retentée
    await survey();
    expect(view().pause ?? '').not.toMatch(/^withdrawn:/);
    expect(vibeTurns()).toHaveLength(1);
  });

  it('Reprendre demandé à cette pause (l’action vibe par la CLI) : refusé, le moteur reste arrêté', async () => {
    await engineThenRetired(false);
    expect(vibeTurns()).toHaveLength(2);

    expect(await ask('vibe')).toMatchObject({ ok: false });

    expect(vibeTurns()).toHaveLength(2);
    expect(await halted()).toBe(true);
  });

  it('l’étape revalidée à la main : plus de pause au relevé, le moteur toujours arrêté ; Reprendre : il repart, la demande passe', async () => {
    await engineThenRetired(false);
    await revalidate();
    await survey();

    expect(view().pause ?? '').not.toMatch(/^withdrawn:/);
    expect(vibeTurns()).toHaveLength(2);
    expect((await import('app/controllers')).vibeOn('a1')).toBe(false);

    await endEngine();
    expect(await ask('vibe')).toMatchObject({ ok: true });
    await survey();
    expect(vibeTurns()).toHaveLength(3);
    expect(await ask('run.start', { action: 'ponytail' })).toMatchObject({ ok: true });
  });

  it('le contenu de l’étape changé : plus de pause, le moteur toujours arrêté ; Reprendre de même', async () => {
    await engineThenRetired(false);
    write(path.join(dir, NOTE_FILE), REWRITTEN());
    git(dir, 'commit', '-q', '-am', 'forme corrigée');
    await survey();
    await survey();

    expect(view().pause ?? '').not.toMatch(/^withdrawn:/);
    expect(vibeTurns()).toHaveLength(2);
    expect((await import('app/controllers')).vibeOn('a1')).toBe(false);

    await endEngine();
    expect(await ask('vibe')).toMatchObject({ ok: true });
    await survey();
    expect(vibeTurns()).toHaveLength(3);
  });

  it('l’appli relancée, le retrait toujours là : la pause au relevé, Reprendre pas proposé', async () => {
    await atRestThenRetired();
    closeAll();
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await openPanel('a1');
    await survey();
    await survey();

    expect(view().pause).toBe('withdrawn:forme');
    expect(view().actions.find((a) => a.id === 'vibe')?.disabled).toBeTruthy();
    expect(await ask('vibe')).toMatchObject({ ok: false });
  });
});

describe('la validation des modules par la CLI attend la preuve', () => {
  const line = () => 'Lire un autre fichier. → invariant';
  const PROVED = () => `## [prouvé] ${line()}\n\nMutant : hello() lit un autre fichier ; le test échoue sur son assertion.\n`;
  const validateModules = async () => {
    const res = await ask('step.validate', { step: 'modules', verdict: 'ok' });
    await survey();
    return res;
  };
  async function upToProof() {
    setupWithProof();
    write(path.join(out, 'align.md'), 'Aligné.\n');
    await openPanel('a1');
    await validateNote();
    await survey();
  }

  it('sans preuve qui passe : refusée ; avec : validés, par le système', async () => {
    await upToProof();
    // témoin : la Forme et les invariants sont validés par le système, rien à la main
    expect(checkOf('invariants')).toMatchObject({ state: 'ok', by: 'system' });

    // refusée, et le refus dit pourquoi (T-43) : la preuve
    const unproved = await validateModules();
    expect(unproved).toMatchObject({ ok: false, error: { code: 'not-offered' } });
    expect((unproved as unknown as { error: { details: { reason: string } } }).error.details.reason).toMatch(/proof/);
    expect(checkOf('modules')?.state).not.toBe('ok');

    write(path.join(out, 'preuve.md'), PROVED());
    await survey();
    expect(await validateModules()).toMatchObject({ ok: true });
    expect(checkOf('modules')).toMatchObject({ state: 'ok', by: 'system' });
  });

  it('la preuve passée, un module corrigé puis la validation des modules par la CLI : validés, sans preuve relancée', async () => {
    await upToProof();
    write(path.join(out, 'preuve.md'), PROVED());
    await survey();
    // un module corrigé après la preuve (un commit de plus)
    write(path.join(dir, MOD), 'export const hello = 2;\n');
    git(dir, 'commit', '-q', '-am', 'correction');
    await survey();

    expect(await validateModules()).toMatchObject({ ok: true });
    expect(checkOf('modules')?.state).toBe('ok');
    expect(claude.turns.map((t) => t.skill)).not.toContain('/vibecoder:prouver');
  });

  it('les modules retirés à la main, la preuve passée : leur validation par la CLI refusée', async () => {
    await upToProof();
    write(path.join(out, 'preuve.md'), PROVED());
    await survey();
    expect(await validateModules()).toMatchObject({ ok: true });   // témoin
    const { markVibe } = await import('app/controllers');
    markVibe('modules', null);
    await settle();
    await survey();

    expect(await validateModules()).toMatchObject({ ok: false });
    expect(checkOf('modules')?.state).not.toBe('ok');
  });

  it('une preuve passée mais effacée par l’appli (fichiers touchés) : refusée de nouveau', async () => {
    await upToProof();
    write(path.join(out, 'preuve.md'), PROVED());
    await survey();
    fs.rmSync(path.join(out, 'preuve.md'));
    await survey();

    expect(await validateModules()).toMatchObject({ ok: false });
  });
});

/* ---- Les deux contrôles de l'appli : la course Vérifier l'alignement, la course Prouver les invariants ---- */

type Hook = (input: Record<string, unknown>, toolUseId: string | undefined, o: { signal: AbortSignal }) => Promise<Record<string, unknown> | undefined>;
// Ce que décide le contrôle des fichiers de la course pour l'appel `tool(input)`, appelé comme le SDK l'appelle.
async function verdict(options: Record<string, unknown>, tool: string, input: Record<string, unknown>): Promise<'deny' | 'pass'> {
  const groups = ((options.hooks as Record<string, unknown> | undefined)?.PreToolUse ?? []) as { matcher?: string; hooks: Hook[] }[];
  const answers: (Record<string, unknown> | undefined)[] = [];
  for (const group of groups) {
    if (group.matcher && group.matcher !== '*' && !new RegExp(`^(?:${group.matcher})$`).test(tool)) continue;
    for (const hook of group.hooks) {
      answers.push(await hook({ hook_event_name: 'PreToolUse', session_id: 's1', transcript_path: '', cwd: dir, tool_name: tool, tool_input: input, tool_use_id: 't1' },
        't1', { signal: new AbortController().signal }));
    }
  }
  const denies = (a: Record<string, unknown> | undefined) =>
    (a?.hookSpecificOutput as Record<string, unknown> | undefined)?.permissionDecision === 'deny' || a?.decision === 'block';
  return answers.some(denies) ? 'deny' : 'pass';
}

// L'action `id` lancée comme un bouton (startRun), quel que soit l'état de la branche, son skill appelé ; son tour.
async function startCourse(id: string, skill: string) {
  const { startRun, runsOf } = await import('app/controllers');
  const { loadConfig, vibeActions, ensureVibeFiles } = await import('app/settings');
  const { agentList, vibeLang } = await import('core/config');
  ensureVibeFiles();
  const cfg = loadConfig();
  const def = vibeActions(vibeLang(cfg)).find((d) => d.id === id)!;
  startRun(agentList(cfg)[0], def, { text: `/vibecoder:${skill}`, images: [] }, cfg);
  await settle();
  return {
    turn: claude.turns.find((t) => t.skill === `/vibecoder:${skill}`),
    run: () => runsOf({ id: 'a1' }).find((r) => r.id === id),
  };
}

describe('Vérifier l’alignement : les tests d’invariants d’avant la branche', () => {
  const NEW_INV = 'src/core/hello/tests/invariants/nouveau.test.ts';
  beforeEach(() => {
    setupWithProof(false);
    // Les tests d'invariants de la branche portés par le commit de la note : l'étape Invariants n'est faite que par l'alignement.
    git(dir, 'reset', '-q', '--soft', 'HEAD~1');
    write(path.join(dir, NEW_INV), "import { it } from 'vitest';\nit('un nouveau cas', () => {});\n");
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '--amend', '--no-edit');
  });

  it('un test d’invariant d’avant la branche : son écriture refusée, la raison le nomme protégé ; un que la branche crée : écrit', async () => {
    await openPanel('a1');
    const { turn } = await startCourse('align', 'aligner');

    expect(await verdict(turn!.options, 'Write', { file_path: path.join(dir, NEW_INV), content: 'x' })).toBe('pass');
    expect(await verdict(turn!.options, 'Write', { file_path: path.join(dir, OLD_INV), content: 'x' })).toBe('deny');
  });

  it('une autre action (Écrire les invariants) : pas de liste, l’écriture passe', async () => {
    await openPanel('a1');
    const { turn } = await startCourse('invariants', 'invariants');

    expect(await verdict(turn!.options, 'Write', { file_path: path.join(dir, OLD_INV), content: 'x' })).toBe('pass');
  });

  it('finie, un test d’avant la branche supprimé pendant sa course : la course en échec, sa réponse nomme le fichier', async () => {
    await openPanel('a1');
    const { turn, run } = await startCourse('align', 'aligner');
    fs.rmSync(path.join(dir, OLD_INV));

    turn!.end(true);
    await settle(1000);

    expect(run()?.state).toBe('failed');
    expect(run()?.reply).toContain(OLD_INV);
  });

  it('arrêtée après avoir changé un test d’avant la branche : nommé de même, align.md effacé', async () => {
    await openPanel('a1');
    write(path.join(out, 'align.md'), 'Aligné.\n');
    const { run } = await startCourse('align', 'aligner');
    write(path.join(dir, OLD_INV), "it('vert', () => {});\n");
    const { vibeRunOp } = await import('app/controllers');

    await vibeRunOp('align', 'stop');
    await settle(1000);

    expect(run()?.reply).toContain(OLD_INV);
    expect(fs.existsSync(path.join(out, 'align.md'))).toBe(false);
  });

  it('un test d’avant la branche changé, la course finie : align.md effacé, l’étape Invariants pas faite au relevé', async () => {
    await openPanel('a1');
    await validateNote();
    const { turn } = await startCourse('align', 'aligner');
    write(path.join(out, 'align.md'), 'Aligné.\n');   // la course l'écrit
    write(path.join(out, 'liens.md'), '## une règle\n');   // et son rattachement, qui range les tests à l'écran
    write(path.join(dir, OLD_INV), "it('vert', () => {});\n");

    turn!.end(true);
    await settle(1000);
    await survey();

    expect(fs.existsSync(path.join(out, 'align.md'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'liens.md'))).toBe(false);
    expect(view().steps.find((s) => s.id === 'invariants')?.status).not.toBe('done');
  });

  it('aucun test d’avant la branche changé : align.md reste', async () => {
    await openPanel('a1');
    await validateNote();
    const { turn, run } = await startCourse('align', 'aligner');
    write(path.join(out, 'align.md'), 'Aligné.\n');   // la course l'écrit
    write(path.join(out, 'liens.md'), '## une règle\n');

    turn!.end(true);
    await settle(1000);

    expect(run()?.state).toBe('done');
    expect(fs.existsSync(path.join(out, 'align.md'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'liens.md'))).toBe(true);
    // témoin : les tests sont alignés, l'étape Invariants est faite (le cas qui précède la défait en effaçant align.md)
    await survey();
    expect(view().steps.find((s) => s.id === 'invariants')?.status).toBe('done');
  });

  it('la liste des tests d’avant la branche illisible : la course ne part pas, en échec', async () => {
    await openPanel('a1');
    fs.renameSync(path.join(dir, '.git'), path.join(dir, '.git-off'));

    const { turn, run } = await startCourse('align', 'aligner');
    await settle(500);

    expect(turn).toBeUndefined();
    expect(run()?.state).toBe('failed');
    expect(run()?.reply).not.toBe('');
  });
});

describe('Prouver les invariants : le dossier de travail et l’index relevés', () => {
  const PROOF = '## [prouvé] Lire un autre fichier. → invariant\n\nMutant : hello() lit un autre fichier.\n';
  beforeEach(setupWithProof);

  it('l’état du dossier de travail illisible à la fin : la course en échec, sa réponse le dit, preuve.md effacée', async () => {
    await openPanel('a1');
    const { turn, run } = await startCourse('prove', 'prouver');
    write(path.join(out, 'preuve.md'), PROOF);
    // git ne répond plus : le dépôt disparaît du dossier pendant la course
    fs.renameSync(path.join(dir, '.git'), path.join(dir, '.git-off'));

    turn!.end(true);
    await settle(1000);

    expect(run()?.state).toBe('failed');
    expect(run()?.reply).toMatch(/pas pu être lu|could not be read/);
    expect(fs.existsSync(path.join(out, 'preuve.md'))).toBe(false);
  });

  it('un fichier du projet supprimé pendant la preuve : la course en échec, le fichier nommé, preuve.md effacée', async () => {
    await openPanel('a1');
    const { turn, run } = await startCourse('prove', 'prouver');
    write(path.join(out, 'preuve.md'), PROOF);
    fs.rmSync(path.join(dir, MOD));

    turn!.end(true);
    await settle(1000);

    expect(run()?.state).toBe('failed');
    expect(run()?.reply).toContain(MOD);
    expect(fs.existsSync(path.join(out, 'preuve.md'))).toBe(false);
  });

  it('la preuve finie sans rien toucher, deux fois de suite : faite, preuve.md reste (rien ne reste de la première)', async () => {
    await openPanel('a1');
    for (let i = 0; i < 2; i++) {
      claude.turns.length = 0;
      const { turn, run } = await startCourse('prove', 'prouver');
      write(path.join(out, 'preuve.md'), PROOF);
      turn!.end(true);
      await settle(1000);
      expect(run()?.state).toBe('done');
    }
    expect(fs.existsSync(path.join(out, 'preuve.md'))).toBe(true);
  });

  it('un fichier de la course dans le dossier de travail avant la preuve, laissé tel quel : pas une différence', async () => {
    write(path.join(dir, 'src/core/hello/brouillon.ts'), 'export const brouillon = 1;\n');
    git(dir, 'add', 'src/core/hello/brouillon.ts');
    await openPanel('a1');
    const { turn, run } = await startCourse('prove', 'prouver');
    write(path.join(out, 'preuve.md'), PROOF);

    turn!.end(true);
    await settle(1000);

    expect(run()?.state).toBe('done');
    expect(fs.existsSync(path.join(out, 'preuve.md'))).toBe(true);
  });

  it('l’état du dossier de travail illisible au départ : la course ne part pas, en échec', async () => {
    await openPanel('a1');
    fs.renameSync(path.join(dir, '.git'), path.join(dir, '.git-off'));

    const { turn, run } = await startCourse('prove', 'prouver');
    await settle(500);

    expect(turn).toBeUndefined();
    expect(run()?.state).toBe('failed');
    expect(run()?.reply).not.toBe('');
  });

  it('arrêtée pendant la comparaison de fin : sa réponse nomme tout de même le fichier touché, preuve.md effacée', async () => {
    await openPanel('a1');
    const { turn, run } = await startCourse('prove', 'prouver');
    write(path.join(out, 'preuve.md'), PROOF);
    fs.rmSync(path.join(dir, MOD));
    const { runOp } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    const { agentList } = await import('core/config');

    turn!.end(true);
    await new Promise((r) => setImmediate(r));   // la fin est prise, sa comparaison court (git)
    await runOp(agentList(loadConfig())[0], 'prove', 'stop');   // direct (pas par le socket de l'écran) : la comparaison de la fin n'est pas rendue
    await settle(1000);

    expect(run()?.state).toBe('stopped');
    expect(run()?.reply).toContain(MOD);
    expect(fs.existsSync(path.join(out, 'preuve.md'))).toBe(false);
  });

  it('un lien posé pendant la preuve : son contenu n’est pas lu (ni suivi), le fichier est tout de même nommé', async () => {
    await openPanel('a1');
    const { turn, run } = await startCourse('prove', 'prouver');
    write(path.join(out, 'preuve.md'), PROOF);
    fs.symlinkSync(path.join(root, 'config.json'), path.join(dir, 'lien'));
    const read = vi.spyOn(fs, 'readFileSync');

    turn!.end(true);
    await settle(1000);
    const reads = read.mock.calls.map(([f]) => String(f)).filter((f) => f.endsWith(`${path.sep}lien`));
    read.mockRestore();

    expect(reads).toEqual([]);
    expect(run()?.state).toBe('failed');
    expect(run()?.reply).toContain('lien');
  });
});
