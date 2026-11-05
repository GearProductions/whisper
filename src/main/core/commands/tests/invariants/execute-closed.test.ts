// Invariant de l'exécuteur des commandes. Protégé : si un test échoue, corriger
// le code (ou la table livrée), pas le test.
//   Note 0.15.0 (docs/tickets/feat/0.15.0-executeur.md), « Ce que ça ne doit
//   pas faire » : ouvrir à un agent une commande fermée (run.allow,
//   run.always, run.deny : répondre à une autorisation), par quelque porte que
//   ce soit. Un agent ne s'accorde pas de droits (I-13 à I-18) : seul
//   l'utilisateur, à l'écran, répond à une demande d'autorisation.
// Sur la fonction pure (execute) et la vraie table livrée
// (resources/vibecoder/commands.json), lue sur le disque ; les opérations
// (ops) sont injectées : chacune relève son appel, rien ne doit en partir.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { execute, parseCommands, type CommandOps } from 'core/commands';
import { parseActions } from 'core/vibecoder';

const RES = path.resolve(__dirname, '../../../../../../resources/vibecoder');
const table = parseCommands(fs.readFileSync(path.join(RES, 'commands.json'), 'utf8'));
const defs = parseActions(JSON.parse(fs.readFileSync(path.join(RES, 'actions.fr.json'), 'utf8')));

// Un relevé où la Forme court et attend une réponse à sa demande d'autorisation :
// répondre aurait un effet.
const view: VibeView = {
  agentId: 'robot-1', time: 0, lang: 'fr', flow: 'create', agent: { model: 'opus', effort: 'high', mode: 'default' },
  repo: { branch: 'feat/x', base: 'master', changed: 0 }, error: null, steps: [], note: null,
  questions: [], modules: [], invariants: [], variants: [], commits: [], outputs: {}, checklist: [],
  actions: [], skills: [], pr: null, prs: null, draft: [], processes: [],
  runs: [{ id: 'forme', label: 'Forme', who: 'opus', state: 'asking', since: 1000, end: null, reply: '',
    permission: { tool: 'Bash', target: 'rm -rf build' } }],
};

// Des opérations qui relèvent chaque appel et réussissent toutes : un appel qui
// passe se voit.
function recordingOps() {
  const calls: string[] = [];
  const ops: CommandOps = {
    start: (action) => { calls.push(`start ${action}`); return { ok: true }; },
    direct: (action) => { calls.push(`direct ${action}`); return { ok: true }; },
    run: async (action, op) => { calls.push(`run ${action} ${op}`); return true; },
    proc: async (name, op) => { calls.push(`proc ${name} ${op}`); return true; },
  };
  return { calls, ops };
}

describe('execute : un agent ne répond jamais à une demande d’autorisation', () => {
  it('run.allow à la porte agent : refusée, aucune opération appelée', async () => {
    const { calls, ops } = recordingOps();

    const res = await execute(table, { command: 'run.allow', args: { action: 'forme' }, door: 'agent' }, { view, defs }, ops);

    // refusée
    expect(res.ok).toBe(false);
    // rien n'est parti : la demande attend toujours l'utilisateur
    expect(calls).toEqual([]);
  });

  it('run.always à la porte agent : refusée, aucune opération appelée', async () => {
    const { calls, ops } = recordingOps();

    const res = await execute(table, { command: 'run.always', args: { action: 'forme' }, door: 'agent' }, { view, defs }, ops);

    // refusée
    expect(res.ok).toBe(false);
    // rien n'est parti : aucune règle accordée
    expect(calls).toEqual([]);
  });

  it('run.deny à la porte agent : refusée, aucune opération appelée', async () => {
    const { calls, ops } = recordingOps();

    const res = await execute(table, { command: 'run.deny', args: { action: 'forme' }, door: 'agent' }, { view, defs }, ops);

    // refusée
    expect(res.ok).toBe(false);
    // rien n'est parti : même un refus est une réponse que l'agent ne donne pas
    expect(calls).toEqual([]);
  });

  it('témoin : run.allow à la porte écran atteint bien la course', async () => {
    const { calls, ops } = recordingOps();

    await execute(table, { command: 'run.allow', args: { action: 'forme' }, door: 'screen' }, { view, defs }, ops);

    // l'utilisateur répond : les refus ci-dessus tiennent à la porte, pas à la demande
    expect(calls).toEqual(['run forme allow']);
  });

  // Une porte que l'exécuteur ne connaît pas n'est pas l'écran : fermée par défaut.
  it('run.allow par une porte inconnue : refusée, aucune opération appelée', async () => {
    const { calls, ops } = recordingOps();
    const door = 'socket' as 'agent';

    const res = await execute(table, { command: 'run.allow', args: { action: 'forme' }, door }, { view, defs }, ops);

    // refusée
    expect(res.ok).toBe(false);
    // rien n'est parti
    expect(calls).toEqual([]);
  });
});
