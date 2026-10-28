// Invariant des actions directes de VibeCoder. Protégé : si un test échoue, corriger le code.
//   Note 0.8.0, « Ce que ça ne doit pas faire » ; SPEC I-39, F-114 : le
//   principal ne modifie le dépôt ou GitHub que par ses actions directes, au
//   clic de leur bouton, et seulement par une liste fermée de commandes (git
//   commit, fetch, switch, pull, branch, stash ; gh pr review, et gh pr view
//   pour lire), sans shell (I-27), git et gh derrière le préfixe ; aucun texte d'une page n'en devient
//   un argument (une PR : un entier positif ; un verdict : l'un des trois ;
//   une branche : un ref sûr ; un fichier : écrit par l'appli dans les
//   sorties). Les modules en lecture (technicals/git, technicals/github)
//   restent en lecture.
//   Note 0.12.0 docs/tickets/refactor/0.12.0-creer-relire-meme-dossier.md,
//   « Ce que ça ne doit pas faire » : « Lancer git stash autrement que git
//   stash push -u (arguments fixes, liste fermée DIRECT_GIT) » ; et une PR se
//   charge par sa seule branche (git fetch origin <tête>), plus de
//   refs/vibecoder/pr/<n>.
//   Note 0.12.0 docs/tickets/feat/0.12.0-gestion-des-branches.md, « Ce que ça
//   ne doit pas faire » : « Lancer Pull ou Rebase autrement que par la liste
//   fermée des commandes directes, aux arguments fixes (DIRECT_GIT, F-114) » ;
//   « Pousser sans un clic sur Pousser, ou autrement que git push
//   --force-with-lease (jamais --force seul) » ; « Laisser un rebase en cours
//   après un conflit : git rebase --abort aussitôt » (sur du vrai git :
//   rebase.test.ts). DIRECT_GIT gagne rebase et push ; GIT_READ gagne
//   for-each-ref (lister les branches locales, en lecture).
// Un Launch qui relève ce qu'on lancerait, sans rien lancer ; et un faux
// préfixe (node et un script) pour ce que gh recevrait vraiment.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DIRECT_GH, DIRECT_GIT, directRunner, type Launch } from 'technicals/direct';
import { GIT_READ } from 'technicals/git';
import { GH_READ } from 'technicals/github';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecoder-direct-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const DIR = path.join(tmp, 'depot');
const OUT = path.join(tmp, 'sorties');
const PREFIX = ['distrobox', 'enter', 'dev', '--'];
const SRC = path.resolve(__dirname, '../../../..');   // src/main

// Ce qu'on aurait lancé, et la réponse de chaque commande (gh pr view :
// `answer` ; le code de sortie : `exit`, 0 par défaut).
function recorder(answer = '{"state":"MERGED"}', exit = (_argv: string[]) => 0) {
  const calls: string[][] = [];
  const launch: Launch = async (argv) => {
    calls.push(argv);
    const view = argv.includes('view');
    return { exit: exit(argv), stdout: view ? answer : '', stderr: '' };
  };
  return { calls, runner: directRunner({ dir: DIR, out: OUT, prefix: PREFIX, launch }) };
}
const CARD = JSON.stringify({ number: 7, title: 't', url: 'u', author: { login: 'bob' }, baseRefName: 'main', headRefName: 'feat/x', body: 'b', state: 'OPEN' });
const commitMd = (text: string) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'commit.md'), text); };

describe('seulement la liste fermée', () => {
  it('DIRECT_GIT : commit, fetch, switch, pull, branch, stash, rebase, push ; DIRECT_GH : pr review, pr view ; rien d’autre', () => {
    expect([...DIRECT_GIT]).toEqual(['commit', 'fetch', 'switch', 'pull', 'branch', 'stash', 'rebase', 'push']);
    expect(DIRECT_GH.map((c) => c.join(' '))).toEqual(['pr review', 'pr view']);
  });

  it('commit : <préfixe> git commit -F <sorties>/commit.md, rien d’autre (ni add, ni -a, ni --amend, ni --no-verify)', async () => {
    commitMd('feat: x\n');
    const { calls, runner } = recorder();
    await runner.commit();
    expect(calls).toEqual([[...PREFIX, 'git', '-C', DIR, 'commit', '-F', path.join(OUT, 'commit.md')]]);
  });

  it('publish : gh pr review <n> --<verdict> --body-file <fichier écrit par l’appli>, derrière le préfixe', async () => {
    const { calls, runner } = recorder();
    await runner.publish(7, 'request-changes', '- [note] à revoir', 'u');
    expect(calls).toEqual([[...PREFIX, 'gh', 'pr', 'review', '7', '--request-changes', '--body-file', path.join(OUT, 'pr-7-review-body.md')]]);
  });

  it('stash : <préfixe> git -C <dépôt> stash push -u, rien d’autre (ni pop, ni drop, ni clear, ni autre argument)', async () => {
    const { calls, runner } = recorder();

    await runner.stash();

    // une seule commande, aux arguments fixes
    expect(calls).toEqual([[...PREFIX, 'git', '-C', DIR, 'stash', 'push', '-u']]);
  });

  it('loadPr : gh pr view (lecture), puis git fetch origin <tête> (tous deux derrière le préfixe), la branche de la PR seulement', async () => {
    const { calls, runner } = recorder(CARD);

    await runner.loadPr(7);

    // la fiche, puis la seule branche de la PR
    expect(calls).toEqual([
      [...PREFIX, 'gh', 'pr', 'view', '--json', 'number,title,url,author,baseRefName,headRefName,body,state', '--', '7'],
      [...PREFIX, 'git', '-C', DIR, 'fetch', 'origin', 'feat/x'],
    ]);
  });

  it('loadPr : aucune référence refs/vibecoder ni pull/<n>/head n’est passée à git', async () => {
    const { calls, runner } = recorder(CARD);

    await runner.loadPr(7);

    // aucun argument ne nomme une référence de l'appli ou de GitHub
    expect(calls.flat().filter((a) => a.includes('refs/vibecoder') || a.includes('pull/'))).toEqual([]);
  });

  it('toBase, PR fusionnée : gh pr view, puis git switch <base>, git pull --ff-only, git branch -d <branche>', async () => {
    const { calls, runner } = recorder('{"state":"MERGED"}');
    await runner.toBase('feat/x', 'main');
    expect(calls).toEqual([
      [...PREFIX, 'gh', 'pr', 'view', '--json', 'state', '--', 'feat/x'],
      [...PREFIX, 'git', '-C', DIR, 'switch', 'main'],
      [...PREFIX, 'git', '-C', DIR, 'pull', '--ff-only'],
      [...PREFIX, 'git', '-C', DIR, 'branch', '-d', 'feat/x'],
    ]);
  });

  it('toBase, PR ouverte : seulement gh pr view, aucun git', async () => {
    const { calls, runner } = recorder('{"state":"OPEN"}');
    expect((await runner.toBase('feat/x', 'main')).ok).toBe(false);
    expect(calls).toEqual([[...PREFIX, 'gh', 'pr', 'view', '--json', 'state', '--', 'feat/x']]);
  });

  it('toBase, PR fermée sans fusion : seulement gh pr view, aucun git', async () => {
    const { calls, runner } = recorder('{"state":"CLOSED"}');
    expect((await runner.toBase('feat/x', 'main')).ok).toBe(false);
    expect(calls.map((a) => a[PREFIX.length] ?? a[0])).toEqual(['gh']);
  });

  it('chaque argument arrive tel quel à gh, sans shell (un faux préfixe relève ce qu’il reçoit)', async () => {
    const log = path.join(tmp, 'appels.jsonl');
    const fake = path.join(tmp, 'faux-prefixe.cjs');
    fs.writeFileSync(fake, `require('fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');\n`);
    const odd = path.join(tmp, 'sorties $(touch pwned) `touch pwned2`');
    await directRunner({ dir: tmp, out: odd, prefix: [process.execPath, fake] }).publish(7, 'comment', 'x', 'u');
    // reçu tel quel
    expect(fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l))).toEqual([
      ['gh', 'pr', 'review', '7', '--comment', '--body-file', path.join(odd, 'pr-7-review-body.md')]]);
    // rien n'a été exécuté
    expect([fs.existsSync(path.join(tmp, 'pwned')), fs.existsSync(path.join(tmp, 'pwned2'))]).toEqual([false, false]);
  });
});

describe('Pull, Rebase, Pousser : la liste fermée, aux arguments fixes', () => {
  it('pull : <préfixe> git -C <dépôt> pull --ff-only --autostash, rien d’autre (la branche suivie, aucun argument donné)', async () => {
    const { calls, runner } = recorder();

    await runner.pull();

    // une seule commande, aux arguments fixes
    expect(calls).toEqual([[...PREFIX, 'git', '-C', DIR, 'pull', '--ff-only', '--autostash']]);
  });

  it('rebase, réussi : <préfixe> git -C <dépôt> rebase --autostash <onto>, rien d’autre', async () => {
    const { calls, runner } = recorder();

    await runner.rebase('origin/main');

    // une seule commande, aux arguments fixes et la branche donnée en dernier
    expect(calls).toEqual([[...PREFIX, 'git', '-C', DIR, 'rebase', '--autostash', 'origin/main']]);
  });

  it('rebase, en échec (un conflit) : git rebase --abort aussitôt après, et l’échec rendu', async () => {
    // git rebase échoue, git rebase --abort réussit
    const { calls, runner } = recorder(undefined, (argv) => (argv.includes('rebase') && !argv.includes('--abort') ? 1 : 0));

    const result = await runner.rebase('origin/main');

    // le rebase, puis son abandon, rien d'autre
    expect(calls).toEqual([
      [...PREFIX, 'git', '-C', DIR, 'rebase', '--autostash', 'origin/main'],
      [...PREFIX, 'git', '-C', DIR, 'rebase', '--abort'],
    ]);
    // l'échec est rendu
    expect(result.ok).toBe(false);
  });

  it('rebase : jamais suivi d’un git push, réussi ou non', async () => {
    const ok = recorder();
    const failed = recorder(undefined, (argv) => (argv.includes('rebase') && !argv.includes('--abort') ? 1 : 0));

    await ok.runner.rebase('origin/main');
    await failed.runner.rebase('origin/main');

    // aucun push après un rebase réussi
    expect(ok.calls.filter((a) => a.includes('push'))).toEqual([]);
    // aucun push après un rebase en échec
    expect(failed.calls.filter((a) => a.includes('push'))).toEqual([]);
  });

  it('push : <préfixe> git -C <dépôt> push --force-with-lease, rien d’autre', async () => {
    const { calls, runner } = recorder();

    await runner.push();

    // une seule commande, aux arguments fixes
    expect(calls).toEqual([[...PREFIX, 'git', '-C', DIR, 'push', '--force-with-lease']]);
    // jamais --force seul
    expect(calls.flat()).not.toContain('--force');
  });

  it('fetchAll : <préfixe> git -C <dépôt> fetch origin, rien d’autre', async () => {
    const { calls, runner } = recorder();

    await runner.fetchAll();

    // une seule commande, aux arguments fixes
    expect(calls).toEqual([[...PREFIX, 'git', '-C', DIR, 'fetch', 'origin']]);
  });
});

describe('un texte venu d’une page ne devient jamais un argument', () => {
  it('rebase : une branche qui commence par « - » (--exec=…) est refusée sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.rebase('--exec=touch pwned');

    // refusé
    expect(result.ok).toBe(false);
    // sans que rien soit lancé
    expect(calls).toEqual([]);
  });

  it('rebase : une branche hors de [A-Za-z0-9._/-], ou avec « .. », est refusée sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const shell = await runner.rebase('main; rm -rf ~');
    const dots = await runner.rebase('../main');

    // des caractères hors du ref sûr : refusé
    expect(shell.ok).toBe(false);
    // « .. » : refusé
    expect(dots.ok).toBe(false);
    // sans que rien soit lancé
    expect(calls).toEqual([]);
  });

  it('rebase : une branche qui n’est pas un texte est refusée sans rien lancer', async () => {
    const { calls, runner } = recorder();

    const result = await runner.rebase(['main', '--exec=touch pwned']);

    // refusé
    expect(result.ok).toBe(false);
    // sans que rien soit lancé
    expect(calls).toEqual([]);
  });

  it('loadPr : un numéro en texte (« 7 ») est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder(CARD);
    expect((await runner.loadPr('7')).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('loadPr : « 7 --repo evil/x » est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder(CARD);
    expect((await runner.loadPr('7 --repo evil/x')).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('loadPr : zéro, un négatif, un non-entier sont refusés sans rien lancer', async () => {
    const { calls, runner } = recorder(CARD);
    for (const n of [0, -7, 7.5, Number.NaN]) expect((await runner.loadPr(n)).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('loadPr : une base rendue par gh qui commence par « - » n’est pas passée à git fetch', async () => {
    const { calls, runner } = recorder(JSON.stringify({ ...JSON.parse(CARD), baseRefName: '--upload-pack=touch pwned' }));
    expect((await runner.loadPr(7)).ok).toBe(false);
    expect(calls.filter((a) => a.includes('fetch'))).toEqual([]);
  });

  it('loadPr : une tête rendue par gh qui commence par « - » n’est pas passée à git fetch', async () => {
    const { calls, runner } = recorder(JSON.stringify({ ...JSON.parse(CARD), headRefName: '--upload-pack=touch pwned' }));

    // refusé
    expect((await runner.loadPr(7)).ok).toBe(false);
    // aucun git fetch lancé
    expect(calls.filter((a) => a.includes('fetch'))).toEqual([]);
  });

  it('publish : un verdict hors des trois (« --admin », « merge ») est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();
    expect((await runner.publish(7, '--admin', 'x', 'u')).ok).toBe(false);
    expect((await runner.publish(7, 'merge', 'x', 'u')).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('publish : un numéro en texte est refusé sans rien lancer', async () => {
    const { calls, runner } = recorder();
    expect((await runner.publish('7', 'approve', 'x', 'u')).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('publish : le brouillon va dans un fichier, jamais dans les arguments', async () => {
    const body = '--delete-branch $(touch pwned)\n- [note] ok';
    const { calls, runner } = recorder();
    await runner.publish(7, 'comment', body, 'u');
    // aucun argument ne contient le texte du brouillon
    expect(calls.flat().filter((a) => a.includes('delete-branch') || a.includes('[note]'))).toEqual([]);
    // il est dans le fichier passé à --body-file
    expect(fs.readFileSync(path.join(OUT, 'pr-7-review-body.md'), 'utf8')).toBe(body);
  });

  it('toBase : une branche qui commence par « - » (--force) est refusée sans rien lancer', async () => {
    const { calls, runner } = recorder();
    expect((await runner.toBase('--force', 'main')).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('toBase : une branche ou une base hors de [A-Za-z0-9._/-], ou avec « .. », est refusée sans rien lancer', async () => {
    const { calls, runner } = recorder();
    expect((await runner.toBase('feat/x; rm -rf ~', 'main')).ok).toBe(false);
    expect((await runner.toBase('feat/x', '../main')).ok).toBe(false);
    expect((await runner.toBase('feat/x', 'main\0-D')).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('toBase : une branche égale à sa base est refusée sans rien lancer', async () => {
    const { calls, runner } = recorder();
    expect((await runner.toBase('main', 'main')).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe('rien sans un clic', () => {
  it('créer le lanceur ne lance rien', async () => {
    const { calls } = recorder();
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toEqual([]);
  });

  it('seul app/controllers/vibecoder importe technicals/direct', () => {
    const files = (dir: string): string[] => fs.readdirSync(dir).flatMap((n) => {
      const p = path.join(dir, n);
      return fs.statSync(p).isDirectory() ? (n === 'tests' ? [] : files(p)) : /\.tsx?$/.test(n) ? [p] : [];
    });
    const importers = files(SRC).filter((f) => /from ['"](technicals\/direct|\.\/direct)['"]/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f)).filter((f) => !f.startsWith(path.join('technicals', 'direct')));
    expect(importers).toEqual([path.join('app', 'controllers', 'vibecoder.ts')]);
  });

  it('le contrôleur ne lance le lanceur que depuis runVibeAction, sur args.direct === true (jamais au relevé)', () => {
    const text = fs.readFileSync(path.join(SRC, 'app', 'controllers', 'vibecoder.ts'), 'utf8');
    // ses fonctions de premier niveau, par nom
    const fns = Object.fromEntries(text.split(/\n(?=(?:export )?(?:async )?function )/).map((chunk) => [/function (\w+)/.exec(chunk)?.[1] ?? '', chunk]));
    const using = (needle: string) => Object.keys(fns).filter((name) => name && fns[name].includes(needle));
    expect(using('directRunner(')).toEqual(['runDirect']);
    expect(using('runDirect(').filter((n) => n !== 'runDirect')).toEqual(['runVibeAction']);
    expect(fns.runVibeAction).toMatch(/\.direct === true[^\n]*runDirect\(/);
  });
});

describe('les modules en lecture restent en lecture', () => {
  it('GIT_READ n’a gagné que for-each-ref (les branches locales), GH_READ rien', () => {
    expect([...GIT_READ]).toEqual(['rev-parse', 'status', 'diff', 'log', 'show', 'for-each-ref']);
    expect(GH_READ.map((c) => c.join(' '))).toEqual(['pr view', 'pr list']);
  });

  it('technicals/git et technicals/github n’importent pas technicals/direct', () => {
    for (const m of ['git', 'github']) {
      const dir = path.join(SRC, 'technicals', m);
      for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
        expect(fs.readFileSync(path.join(dir, f), 'utf8')).not.toMatch(/technicals\/direct/);
      }
    }
  });
});
