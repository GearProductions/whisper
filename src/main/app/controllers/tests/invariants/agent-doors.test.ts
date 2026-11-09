// Invariants des portes des agents (note 0.15.0, docs/tickets/feat/0.15.0-cli.md,
// « Ce que ça ne doit pas faire ») :
//   - accepter un agent extérieur quand le réglage « Autoriser les agents
//     extérieurs » est désactivé (par défaut) ;
//   - faire agir un agent sur un autre robot que le sien : celui de son jeton
//     (un robot), ou celui de son dossier courant pour un agent extérieur (le
//     robot affiché s'il est sur ce dossier, sinon le premier ; un
//     sous-dossier compte comme son projet) ;
//   - lancer, à une porte d'agent, ce que cette porte n'autorise pas (répondre à
//     une demande d'autorisation : run.allow, run.always, run.deny). La table et
//     l'exécuteur le tiennent déjà (core/commands/tests/invariants/agent-closed.test.ts
//     et execute-closed.test.ts) ; ici, qu'un robot et un agent extérieur passent
//     bien par la porte agent, pas par celle de l'écran.
// Les jetons, sur le disque et vers la page : agent-tokens.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, état, réglages et fichiers sur disque,
// git réel sur deux dépôts d'essai, le vrai socket TCP et son vrai client, les
// actions et la table livrées), par le décor commun (app/tests/harness) ;
// faux : Electron et le SDK de Claude Code (chaque message reçu ouvre un tour,
// qui dure jusqu'à interrupt() ; les options de chaque processus relevées : sa
// demande d'autorisation, canUseTool, se pose comme Claude Code la poserait).
// Deux robots, a1 (affiché) et a2, chacun sur son dépôt, chaque dépôt sur sa
// branche : la branche que rend `status` dit sur quel robot la commande a agi. Un agent parle à l'appli comme la CLI : une
// ligne sur le socket, le port et le jeton lus dans live.json (agent
// extérieur) ou donnés par l'appli (robotToken, un robot).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from 'core/agents';
import { send } from 'technicals/socket';
import { click, closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);
// Claude Code : un tour par message reçu, qui ne finit qu'à interrupt() ; les options de chaque processus lancé.
type Ask = (tool: string, input: unknown, o: object) => Promise<unknown>;
const claude = fakeClaude();
const processes: { canUseTool?: Ask }[] = [];
vi.mock('technicals/claude', () => ({
  ...claude.module,
  loadSdk: async () => {
    const sdk = await (claude.module.loadSdk as () => Promise<{ query(a: { options: { canUseTool?: Ask } }): unknown }>)();
    return { ...sdk, query: (a: { options: { canUseTool?: Ask } }) => { processes.push(a.options); return sdk.query(a); } };
  },
}));
vi.mock('technicals/paths', () => repoResources());

let root = '';
// Les dépôts des deux robots, et un dépôt sans robot.
let dirA = '';
let dirB = '';
let dirNone = '';

const robot = (id: string, dir: string): AgentConfig => ({ id, dir, name: id, model: 'opus', effort: 'high', mode: 'default', sessionId: null,
  view: 'vibecoder', vibe: { flow: 'create', autonomy: 'guide', pr: null } });
const live = () => JSON.parse(fs.readFileSync(path.join(root, 'live.json'), 'utf8')) as { port: number; token?: string };
// La branche d'un dépôt, lue par git.
const branchOf = (dir: string) => git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').trim();

// L'appli lancée : a1 et a2 dans la config, le réglage tel que donné, le panneau ouvert sur a1.
async function launched(outsideAgents: boolean) {
  writeConfig(root, [robot('a1', dirA), robot('a2', dirB)], { outsideAgents });
  await openPanel('a1');
}

// Une commande d'un agent, comme la CLI l'envoie : une ligne sur le socket, depuis `target`.
async function agentSends(token: string | undefined, target: string, cmd: string, args: object = {}) {
  const answer = await send(live().port, { cmd, args, token: token as string, target });
  await settle();
  return answer as { ok: boolean; result?: unknown };
}
// La branche que rend `status` à cet agent, depuis `target` : celle du robot sur lequel il agit.
const statusBranch = async (token: string | undefined, target: string) =>
  ((await agentSends(token, target, 'status')).result as { branch?: string } | undefined)?.branch;
// Les actions des courses d'un robot, lues par son propre jeton, depuis son dossier.
async function runsOf(id: string, dir: string) {
  const answer = await agentSends(await robotTokenOf(id), dir, 'runs');
  return ((answer.result ?? []) as { action: string }[]).map((r) => r.action);
}

// Le jeton d'un robot, tel que l'appli le donne à ce qu'elle lance pour lui.
const robotTokenOf = async (id: string) => (await import('app/controllers')).robotToken(id);

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  processes.length = 0;
  root = profile('whisper-agent-doors-');
  // Chaque dépôt sur sa branche, sa note écrite : la Forme est possible.
  dirA = path.join(root, 'projet');
  dirB = path.join(root, 'projet2');
  dirNone = path.join(root, 'autre');
  repo(dirA, { branch: 'feat/0.9.0-un' });
  repo(dirB, { branch: 'feat/0.9.0-deux' });
  repo(dirNone, { branch: 'feat/0.9.0-trois' });
  write(path.join(dirB, 'sous', 'dossier', 'a.txt'), 'x\n');
});
afterEach(closeAll);

describe('un agent extérieur n’est pas accepté quand le réglage est désactivé', () => {
  it('le jeton extérieur, accepté réglage activé, est refusé une fois le réglage désactivé depuis la page', async () => {
    await launched(true);
    const outside = live().token;
    const before = await agentSends(outside, dirA, 'status');
    // témoin : réglage activé, le jeton extérieur ouvre le socket
    expect(before.ok).toBe(true);

    await electron.ipc.get('settings')!({ sender: electron.windows.at(-1)!.webContents }, { set: 'outsideAgents', value: false });
    await settle();
    const status = await agentSends(outside, dirA, 'status');
    const start = await agentSends(outside, dirA, 'run.start', { action: 'forme' });

    // une lecture est refusée
    expect(status.ok).toBe(false);
    // une action est refusée
    expect(start.ok).toBe(false);
    // et rien n'est parti
    expect(claude.turns).toEqual([]);
  });

  // Un agent qui aurait gardé le jeton d'un lancement où le réglage était activé.
  it('le jeton extérieur d’un lancement précédent, l’appli relancée réglage désactivé : refusé, rien ne part', async () => {
    await launched(true);
    const outside = live().token;
    const before = await agentSends(outside, dirA, 'status');
    // témoin : réglage activé, le jeton extérieur ouvre le socket
    expect(before.ok).toBe(true);
    const { closeSocket, openSocket, commandFromSocket } = await import('app/controllers');
    closeSocket();
    writeConfig(root, [robot('a1', dirA), robot('a2', dirB)], { outsideAgents: false });
    await openSocket(commandFromSocket);

    const start = await agentSends(outside, dirA, 'run.start', { action: 'forme' });

    // l'action est refusée
    expect(start.ok).toBe(false);
    // et rien n'est parti
    expect(claude.turns).toEqual([]);
  });
});

describe('un robot n’agit que sur lui-même', () => {
  it('témoin : les deux dépôts sont sur des branches différentes', () => {
    // la branche rendue par status suffit à dire de quel robot il s'agit
    expect(branchOf(dirB)).not.toBe(branchOf(dirA));
  });

  // Le jeton de a1 depuis le dossier de a2 : c'est toujours a1.
  it('le jeton de a1, depuis le dossier de a2 : status rend l’état de a1', async () => {
    await launched(false);

    const branch = await statusBranch(await robotTokenOf('a1'), dirB);

    // la branche rendue est celle du dépôt de a1
    expect(branch).toBe(branchOf(dirA));
  });

  // a2 n'est pas affiché, et la cible est le dossier du robot affiché.
  it('le jeton de a2 (non affiché), depuis le dossier de a1 (affiché) : status rend l’état de a2', async () => {
    await launched(false);

    const branch = await statusBranch(await robotTokenOf('a2'), dirA);

    // la branche rendue est celle du dépôt de a2
    expect(branch).toBe(branchOf(dirB));
  });

  it('le jeton de a1 lance forme depuis le dossier de a2 : la course est à a1, pas à a2', async () => {
    await launched(false);

    const start = await agentSends(await robotTokenOf('a1'), dirB, 'run.start', { action: 'forme' });

    // témoin : la demande est acceptée
    expect(start.ok).toBe(true);
    // la course est dans celles de a1
    expect(await runsOf('a1', dirA)).toContain('forme');
    // elle n'est pas dans celles de a2
    expect(await runsOf('a2', dirB)).not.toContain('forme');
  });

  // Un robot retiré de la config : son jeton ne doit pas retomber sur le robot de la cible.
  it('le jeton d’un robot retiré de la config, depuis le dossier d’un autre : refusé, rien ne part', async () => {
    await launched(false);
    const removed = await robotTokenOf('a2');
    writeConfig(root, [robot('a1', dirA)], { outsideAgents: false });

    const start = await agentSends(removed, dirA, 'run.start', { action: 'forme' });

    // la demande est refusée
    expect(start.ok).toBe(false);
    // et rien n'est parti
    expect(claude.turns).toEqual([]);
  });
});

describe('un agent extérieur n’agit que sur le robot de son dossier', () => {
  // a1 est affiché ; l'agent est dans un sous-dossier du projet de a2.
  it('depuis un sous-dossier du dépôt de a2 (non affiché) : status rend l’état de a2, pas celui de l’affiché', async () => {
    await launched(true);

    const branch = await statusBranch(live().token, path.join(dirB, 'sous', 'dossier'));

    // la branche rendue est celle du dépôt de a2
    expect(branch).toBe(branchOf(dirB));
  });

  it('depuis le dépôt de a2, forme lancée : la course est à a2, pas à l’affiché', async () => {
    await launched(true);

    const start = await agentSends(live().token, dirB, 'run.start', { action: 'forme' });

    // témoin : la demande est acceptée
    expect(start.ok).toBe(true);
    // la course est dans celles de a2
    expect(await runsOf('a2', dirB)).toContain('forme');
    // elle n'est pas dans celles de a1
    expect(await runsOf('a1', dirA)).not.toContain('forme');
  });

  // Aucun robot sur ce dossier : l'agent ne retombe pas sur le robot affiché.
  it('depuis un dépôt sans robot : la demande est refusée, rien ne part', async () => {
    await launched(true);
    const outside = live().token;
    const elsewhere = await agentSends(outside, dirA, 'status');
    // témoin : le jeton extérieur ouvre le socket, depuis le dossier d'un robot
    expect(elsewhere.ok).toBe(true);

    const start = await agentSends(outside, dirNone, 'run.start', { action: 'forme' });

    // la demande est refusée
    expect(start.ok).toBe(false);
    // et rien n'est parti
    expect(claude.turns).toEqual([]);
  });

  // /projet2 commence par /projet : ce n'est pas un sous-dossier de a1.
  it('depuis le dépôt de a2, dont le chemin prolonge celui de a1 : status ne rend pas l’état de a1', async () => {
    await launched(true);

    const status = await agentSends(live().token, dirB, 'status');

    // témoin : la lecture est acceptée
    expect(status.ok).toBe(true);
    // la branche rendue n'est pas celle du dépôt de a1
    expect((status.result as { branch?: string }).branch).not.toBe(branchOf(dirA));
  });
});

describe('un robot et un agent extérieur passent par la porte agent : ils ne répondent pas à une demande d’autorisation', () => {
  // La Forme lancée par l'écran pose une demande d'autorisation, comme Claude Code avant une commande ; un
  // relevé la montre. Rend : la demande a-t-elle reçu une réponse ?
  async function asking() {
    await click('forme');
    await settle();
    let answered = false;
    void processes.at(-1)!.canUseTool!('Bash', { command: 'rm -rf build' }, {}).then(() => { answered = true; });
    const { refreshVibe } = await import('app/controllers');
    await refreshVibe({ now: true });
    await settle();
    return () => answered;
  }

  it('le jeton de a1 : run.allow de sa course qui demande est refusée, la demande attend toujours', async () => {
    await launched(false);
    const answered = await asking();
    const token = await robotTokenOf('a1');
    const runs = await agentSends(token, dirA, 'runs');
    // témoin : la Forme de a1 attend une réponse à sa demande
    expect(runs.result).toMatchObject([{ action: 'forme', state: 'asking' }]);

    const allow = await agentSends(token, dirA, 'run.allow', { action: 'forme' });

    // refusée
    expect(allow.ok).toBe(false);
    // la demande n'a reçu aucune réponse
    expect(answered()).toBe(false);
  });

  it('l’agent extérieur : run.allow de la course du robot de son dossier, qui demande, est refusée, la demande attend toujours', async () => {
    await launched(true);
    const answered = await asking();
    const outside = live().token;
    const runs = await agentSends(outside, dirA, 'runs');
    // témoin : la Forme de a1 attend une réponse à sa demande
    expect(runs.result).toMatchObject([{ action: 'forme', state: 'asking' }]);

    const allow = await agentSends(outside, dirA, 'run.allow', { action: 'forme' });

    // refusée
    expect(allow.ok).toBe(false);
    // la demande n'a reçu aucune réponse
    expect(answered()).toBe(false);
  });
});
