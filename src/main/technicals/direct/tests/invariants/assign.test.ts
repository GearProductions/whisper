// Invariant de S'assigner la PR et de Me retirer de la PR. Protégé : si un
// test échoue, corriger le code.
//   Note 0.13.0 docs/tickets/feat/0.13.0-fusionner-creer-relire.md, « Ce que
//   ça ne doit pas faire » : « S'assigner une PR, ou s'en retirer, […] ou
//   lancer autre chose que gh pr edit <n> --add-assignee <identifiant> /
//   --remove-assignee <identifiant>, arguments fixes (comme --add-reviewer,
//   F-114, I-39) ». Ici : la commande lancée, et les refus (okNumber,
//   okLogin) sans rien lancer. Au clic seulement, jamais par l'agent :
//   app/controllers/tests/invariants/reviewer.test.ts.
// Un Launch qui relève ce qu'on lancerait, sans rien lancer (le banc de
// direct.test.ts).
import { describe, expect, it } from 'vitest';
import { directRunner, type Launch } from 'technicals/direct';

const DIR = '/tmp/vibecoder-assign/depot';
const OUT = '/tmp/vibecoder-assign/sorties';
const PREFIX = ['distrobox', 'enter', 'dev', '--'];

// Ce qu'on aurait lancé ; chaque commande réussit, sans rien dire.
function recorder() {
  const calls: string[][] = [];
  const launch: Launch = async (argv) => {
    calls.push(argv);
    return { exit: 0, stdout: '', stderr: '' };
  };
  return { calls, runner: directRunner({ dir: DIR, out: OUT, prefix: PREFIX, launch }) };
}

describe('S’assigner la PR : gh pr edit <n> --add-assignee <identifiant>, rien d’autre', () => {
  it('assign : <préfixe> gh pr edit <n> --add-assignee <identifiant>, une seule commande', async () => {
    const { calls, runner } = recorder();

    await runner.assign(7, 'Reykugo-Gear');

    // une seule commande, aux arguments fixes (ni titre, ni base, ni relecteur, ni label)
    expect(calls).toEqual([[...PREFIX, 'gh', 'pr', 'edit', '7', '--add-assignee', 'Reykugo-Gear']]);
  });

  // Une option à la place de l'identifiant : elle deviendrait un argument de gh.
  it('assign : un identifiant qui est une option (--remove-assignee=x) est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign(7, '--remove-assignee=x');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('assign : un identifiant qui commence par « - » (-x) est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign(7, '-x');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  // gh accepte une liste séparée par des virgules : on assignerait quelqu'un d'autre.
  it('assign : plusieurs identifiants (a,b) sont refusés sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign(7, 'kb,mallory');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('assign : un identifiant avec un espace est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign(7, 'kb --repo evil/x');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('assign : un identifiant vide est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign(7, '');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('assign : un identifiant qui n’est pas un texte est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign(7, ['kb', '--add-reviewer', 'x']);

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('assign : un numéro en texte (« 7 ») est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign('7', 'kb');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('assign : « 7 --repo evil/x » est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign('7 --repo evil/x', 'kb');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('assign : zéro est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign(0, 'kb');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('assign : un numéro négatif est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign(-7, 'kb');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('assign : un numéro non entier est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.assign(7.5, 'kb');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });
});

describe('Me retirer de la PR : gh pr edit <n> --remove-assignee <identifiant>, rien d’autre', () => {
  it('unassign : <préfixe> gh pr edit <n> --remove-assignee <identifiant>, une seule commande', async () => {
    const { calls, runner } = recorder();

    await runner.unassign(7, 'Reykugo-Gear');

    // une seule commande, aux arguments fixes (ni titre, ni base, ni relecteur, ni label)
    expect(calls).toEqual([[...PREFIX, 'gh', 'pr', 'edit', '7', '--remove-assignee', 'Reykugo-Gear']]);
  });

  // Une option à la place de l'identifiant : elle deviendrait un argument de gh.
  it('unassign : un identifiant qui est une option (--add-assignee=x) est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.unassign(7, '--add-assignee=x');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  // gh accepte une liste séparée par des virgules : on retirerait quelqu'un d'autre.
  it('unassign : plusieurs identifiants (a,b) sont refusés sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.unassign(7, 'kb,bob');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('unassign : un identifiant avec un espace est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.unassign(7, 'kb --repo evil/x');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('unassign : un identifiant qui n’est pas un texte est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.unassign(7, null);

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('unassign : un numéro en texte (« 7 ») est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.unassign('7', 'kb');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('unassign : « 7 --repo evil/x » est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.unassign('7 --repo evil/x', 'kb');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });

  it('unassign : zéro est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.unassign(0, 'kb');

    // refusé
    expect(result.ok).toBe(false);
    // rien n'est lancé
    expect(calls).toEqual([]);
  });
});
