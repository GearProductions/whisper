// Invariant de gh dans VibeCoder. Protégé : si un test échoue, corriger le code.
//   Note 0.8.0, I-39 : le principal ne modifie jamais rien — gh n'est lancé
//   qu'en lecture (`pr view`, `pr list`), sans shell (I-27), derrière le
//   préfixe du réglage ou de la commande de l'agent ; aucun texte venu d'une
//   page ne devient un argument : une PR est un entier positif, une branche
//   (lue par git) ne peut pas devenir une option.
//   Note 0.12.0 docs/tickets/feat/0.12.0-gestion-des-branches.md, « Ce que ça
//   ne doit pas faire » : « Lister les PR ou les branches autrement qu'en
//   lecture seule (GH_READ, I-39) » : openPrs (qui remplace prsToReview) ne
//   lance que gh pr list.
// Un faux préfixe : node et un script qui relève ses arguments (ce que gh
// aurait reçu) et répond une fiche de PR.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { commandPrefix } from 'core/runner';
import { GH_READ, ghRun, githubReader, type GhRun } from 'technicals/github';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecoder-gh-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const LOG = path.join(tmp, 'appels.jsonl');
const FAKE = path.join(tmp, 'faux-prefixe.cjs');
fs.writeFileSync(FAKE, `require('fs').appendFileSync(${JSON.stringify(LOG)}, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write(process.argv.includes('list') ? '[]' : '{"number":7,"title":"t","url":"u","state":"OPEN","baseRefName":"main","headRefName":"feat/x"}');\n`);
const PREFIX = [process.execPath, FAKE];

// Ce que le faux préfixe a reçu, depuis le dernier appel.
function launched() {
  const lines = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean) : [];
  fs.rmSync(LOG, { force: true });
  return lines.map((l) => JSON.parse(l) as string[]);
}

// Un GhRun qui relève ses appels, sans rien lancer.
function recorder() {
  const calls: string[][] = [];
  const run: GhRun = async (args) => { calls.push(args); return null; };
  return { calls, run };
}

describe('seulement des sous-commandes en lecture', () => {
  it('GH_READ : pr view et pr list, rien d’autre', () => {
    expect(GH_READ.map((c) => c.join(' '))).toEqual(['pr view', 'pr list']);
  });

  it('pr merge n’est pas lancé', async () => {
    // refusé
    expect(await ghRun(tmp, PREFIX)(['pr', 'merge', '7'])).toBeNull();
    // sans que rien soit lancé
    expect(launched()).toEqual([]);
  });

  it('pr checkout n’est pas lancé', async () => {
    // refusé
    expect(await ghRun(tmp, PREFIX)(['pr', 'checkout', '7'])).toBeNull();
    // sans que rien soit lancé
    expect(launched()).toEqual([]);
  });

  it('gh api n’est pas lancé', async () => {
    // refusé
    expect(await ghRun(tmp, PREFIX)(['api', '-X', 'DELETE', 'repos/o/d'])).toBeNull();
    // sans que rien soit lancé
    expect(launched()).toEqual([]);
  });

  it('prForBranch, prState : chaque lancement est gh pr view ou gh pr list', async () => {
    const gh = githubReader(ghRun(tmp, PREFIX));
    await gh.prForBranch('feat/x');
    await gh.prState(7);
    const calls = launched();
    // gh a bien été lancé, une fois par appel
    expect(calls.length).toBe(2);
    // et seulement en lecture
    expect(calls.filter((a) => a[0] !== 'gh' || !GH_READ.some(([x, y]) => a[1] === x && a[2] === y))).toEqual([]);
  });

  it('openPrs : chaque lancement est gh pr list', async () => {
    const gh = githubReader(ghRun(tmp, PREFIX));

    await gh.openPrs();
    const calls = launched();

    // gh a bien été lancé
    expect(calls.length).toBeGreaterThan(0);
    // et seulement pour lister
    expect(calls.filter((a) => a[0] !== 'gh' || a[1] !== 'pr' || a[2] !== 'list')).toEqual([]);
  });
});

describe('derrière le préfixe, sans shell', () => {
  it('le préfixe du réglage (vibeCommandPrefix) précède gh', async () => {
    const prefix = commandPrefix(null, `"${process.execPath}" "${FAKE}"`, 'distrobox enter dev -- claude');
    await githubReader(ghRun(tmp, prefix)).prState(7);
    // le faux préfixe a reçu gh et ses arguments, tels quels
    expect(launched()).toEqual([['gh', 'pr', 'view', '--json', 'state', '--', '7']]);
  });

  it('sans réglage : la box de la commande de l’agent précède gh', () => {
    expect(commandPrefix(null, '', 'distrobox enter dev -- mise exec -- claude')).toEqual(['distrobox', 'enter', 'dev', '--']);
  });

  it('un argument n’est jamais interprété par un shell', async () => {
    const odd = '$(touch pwned); `touch pwned2` | x';
    await ghRun(tmp, PREFIX)(['pr', 'view', '--json', 'state', '--', odd]);
    // reçu tel quel
    expect(launched()).toEqual([['gh', 'pr', 'view', '--json', 'state', '--', odd]]);
    // rien n'a été exécuté
    expect([fs.existsSync(path.join(tmp, 'pwned')), fs.existsSync(path.join(tmp, 'pwned2'))]).toEqual([false, false]);
  });
});

describe('un texte venu d’ailleurs ne devient jamais un argument', () => {
  it('prState : un numéro en texte est refusé sans lancer gh', async () => {
    const { calls, run } = recorder();
    expect(await githubReader(run).prState('7')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('prState : un numéro suivi d’une option (« 7 --repo x ») est refusé sans lancer gh', async () => {
    const { calls, run } = recorder();
    expect(await githubReader(run).prState('7 --repo evil/x')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('prState : zéro ou un négatif est refusé sans lancer gh', async () => {
    const { calls, run } = recorder();
    expect([await githubReader(run).prState(0), await githubReader(run).prState(-7)]).toEqual([null, null]);
    expect(calls).toEqual([]);
  });

  it('prState : un non-entier est refusé sans lancer gh', async () => {
    const { calls, run } = recorder();
    expect([await githubReader(run).prState(7.5), await githubReader(run).prState(Number.NaN)]).toEqual([null, null]);
    expect(calls).toEqual([]);
  });

  it('prForBranch : une branche qui commence par « - » (--repo=…) est refusée sans lancer gh', async () => {
    const { calls, run } = recorder();
    expect(await githubReader(run).prForBranch('--repo=evil/x')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('prForBranch : une branche hors de [A-Za-z0-9._/-] est refusée sans lancer gh', async () => {
    const { calls, run } = recorder();
    expect(await githubReader(run).prForBranch('feat/x; rm -rf ~')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('prForBranch : la branche vient après « -- », jamais parmi les options', async () => {
    const { calls, run } = recorder();
    await githubReader(run).prForBranch('feat/x');
    expect(calls.map((a) => a.slice(-2))).toEqual([['--', 'feat/x']]);
  });
});
