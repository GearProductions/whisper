// Invariant de la preuve des invariants à la validation des modules (note 0.16.0,
// docs/tickets/feat/0.16.0-controle-en-trois-points.md, « Ce que ça ne doit pas faire ») :
//   - I-66 « Accepter en silence un invariant non prouvé : il remonte à l'utilisateur, en express aussi ».
// En express, l'orchestrateur ne valide pas les modules par sa CLI (step.validate) tant que la preuve du relevé ne passe
// pas : une ligne « → invariant » en [toi], ou pas de preuve.md. Chaque refus a son témoin : la même demande, la
// preuve passée, valide les modules.
// Le parcours (l'étape Modules pas faite, la ligne non prouvée au relevé) : core/vibecoder/tests/invariants/proof.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le SDK de Claude Code factices — chaque
// tour finit aussitôt, sans rien écrire —, git réel sur un dépôt d'essai). Le rythme se règle comme l'écran le règle
// (setVibe({ express })) ; les validations à la main par le ✓ que la page envoie (markVibe) ; celle de l'orchestrateur
// par le socket, à la porte du robot (commandFromSocket, step.validate) ; ce que la page voit : le dernier conv:vibe poussé.
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import {
  closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, slow, write, writeConfig,
} from 'app/tests/harness';

// La note, la Forme et les invariants validés enchaînent une dizaine de relevés.
vi.setConfig({ testTimeout: slow(20000) });

const electron = fakeElectron();
const claude = fakeClaude({ finish: true });
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

const BRANCH = 'feat/0.16.0-essai';
const NOTE_TEXT = ['# 0.16.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Ce que ça ne doit pas faire', '', '- Lire un autre fichier. → invariant', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
// Un module de la Forme ; le test d'invariant de la ligne, un cas.
const MOD = 'src/core/hello/index.ts';
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const INV_TEXT = "import { it } from 'vitest';\nit('ne lit rien d’autre', () => {});\n";

let root = '';
let dir = '';
let line = '';   // la ligne « → invariant » de la note, telle que la note la donne

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  root = profile('whisper-proof-gate-');
  // Le dépôt : la branche ajoute sa note et son test d'invariant (le premier commit), puis le module.
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: NOTE_TEXT });
  write(path.join(dir, INV), INV_TEXT);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'invariants');
  write(path.join(dir, MOD), 'export const hello = 1;\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'modules');
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], { agentSelected: 'a1' });
  line = (await import('core/vibecoder')).parseNote(NOTE_TEXT).mustNot[0].text;
});
afterEach(closeAll);

// Le dernier relevé poussé à la page.
const view = () => electron.windows.at(-1)!.sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as VibeView;
// Où en est la validation d'une étape : 'ok' (cochée), 'changed', 'cascade', null (jamais validée).
const checked = (step: string) => view().steps.find((s) => s.id === step)?.check?.state;
// preuve.md dans les sorties de l'agent.
const proof = (text: string) => write(path.join(root, 'vibecoder-out', 'a1', 'preuve.md'), text);
const PROVED = () => `## [prouvé] ${line}\n\nMutant : hello() lit un autre fichier ; le test échoue sur son assertion.\n`;
const TOI = () => `## [toi] ${line}\n\nLe test reste vert sur chaque mutant essayé.\n`;

// Un relevé, comme celui des 4 s.
async function survey() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await settle();
}
// Un ✓ de la page, puis le relevé qui suit.
async function mark(target: string) {
  const { markVibe } = await import('app/controllers');
  markVibe(target, 'ok');
  await settle();
  await survey();
}
// Le rythme réglé par l'écran.
async function express() {
  const { setVibe } = await import('app/controllers');
  setVibe({ express: true });
  await settle();
  await survey();
}
// L'orchestrateur valide les modules par sa CLI : step.validate à la porte du robot a1 ; sa réponse.
async function cliValidateModules() {
  const { commandFromSocket } = await import('app/controllers');
  const res = await commandFromSocket({ cmd: 'step.validate', args: { step: 'modules', verdict: 'ok' }, token: '', target: '' }, 'a1');
  await settle();
  await survey();
  return res;
}
// La note (sa vérification finit sans question), la Forme et les invariants validés, puis le rythme express.
async function upToModulesInExpress() {
  await mark('note');
  await survey();
  await mark('forme');
  await mark(`case:${INV}:ne lit rien d’autre`);
  await mark('invariants');
  await express();
}

describe('I-66 : en express, les modules ne sont pas validés sans preuve qui passe', () => {
  it('la ligne « → invariant » en [toi] : step.validate des modules refusé', async () => {
    await openPanel('a1');
    await upToModulesInExpress();
    proof(TOI());
    await survey();

    const res = await cliValidateModules();

    // témoin : le rythme est bien l'express
    expect(view().express).toBe(true);
    // la demande est refusée
    expect(res.ok).toBe(false);
    // les modules ne sont pas validés
    expect(checked('modules')).not.toBe('ok');

    // témoin : la même demande, la ligne prouvée, valide les modules (c'était bien la preuve qui retenait)
    proof(PROVED());
    await survey();
    await cliValidateModules();
    expect(checked('modules')).toBe('ok');
  });

  it('pas de preuve.md : step.validate des modules refusé', async () => {
    await openPanel('a1');
    await upToModulesInExpress();

    const res = await cliValidateModules();

    // témoin : le rythme est bien l'express
    expect(view().express).toBe(true);
    // la demande est refusée
    expect(res.ok).toBe(false);
    // les modules ne sont pas validés
    expect(checked('modules')).not.toBe('ok');

    // témoin : la même demande, la ligne prouvée, valide les modules
    proof(PROVED());
    await survey();
    await cliValidateModules();
    expect(checked('modules')).toBe('ok');
  });

  it('la ligne « → invariant » en [toi] : le relevé la porte, non prouvée', async () => {
    await openPanel('a1');
    await upToModulesInExpress();

    proof(TOI());
    await survey();

    // la ligne remonte à l'écran, parmi celles qui ne sont pas prouvées
    expect((view().proof?.lines ?? []).filter((l) => !l.proved).map((l) => l.line)).toContain(line);
  });
});
