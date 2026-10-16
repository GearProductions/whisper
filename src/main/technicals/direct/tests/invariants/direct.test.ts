// Invariant des actions directes de VibeCoder. Protégé : si un test échoue, corriger le code.
//   Note 0.8.0, « Ce que ça ne doit pas faire » ; SPEC I-39, F-114 : le
//   principal ne modifie le dépôt ou GitHub que par quatre actions, au clic de
//   leur bouton, et seulement par une liste fermée de commandes (git commit,
//   fetch, switch, pull, branch ; gh pr review, et gh pr view pour lire), sans
//   shell (I-27), gh derrière le préfixe ; aucun texte d'une page n'en devient
//   un argument (une PR : un entier positif ; un verdict : l'un des trois ;
//   une branche : un ref sûr ; un fichier : écrit par l'appli dans les
//   sorties). Les modules en lecture (technicals/git, technicals/github)
//   restent en lecture.
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

// Ce qu'on aurait lancé, et la réponse de chaque commande (gh pr view : `answer`).
function recorder(answer = '{"state":"MERGED"}') {
  const calls: string[][] = [];
  const launch: Launch = async (argv) => {
    calls.push(argv);
    const view = argv.includes('view');
    return { exit: 0, stdout: view ? answer : '', stderr: '' };
  };
  return { calls, runner: directRunner({ dir: DIR, out: OUT, prefix: PREFIX, launch }) };
}
const CARD = JSON.stringify({ number: 7, title: 't', url: 'u', author: { login: 'bob' }, baseRefName: 'main', headRefName: 'feat/x', body: 'b', state: 'OPEN' });
const commitMd = (text: string) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'commit.md'), text); };

describe('seulement la liste fermée', () => {
  it('DIRECT_GIT : commit, fetch, switch, pull, branch ; DIRECT_GH : pr review, pr view ; rien d’autre', () => {
    expect([...DIRECT_GIT]).toEqual(['commit', 'fetch', 'switch', 'pull', 'branch']);
    expect(DIRECT_GH.map((c) => c.join(' '))).toEqual(['pr review', 'pr view']);
  });

  it('commit : git commit -F <sorties>/commit.md, rien d’autre (ni add, ni -a, ni --amend, ni --no-verify)', async () => {
    commitMd('feat: x\n');
    const { calls, runner } = recorder();
    await runner.commit();
    expect(calls).toEqual([['git', '-C', DIR, 'commit', '-F', path.join(OUT, 'commit.md')]]);
  });

  it('publish : gh pr review <n> --<verdict> --body-file <fichier écrit par l’appli>, derrière le préfixe', async () => {
    const { calls, runner } = recorder();
    await runner.publish(7, 'request-changes', '- [note] à revoir', 'u');
    expect(calls).toEqual([[...PREFIX, 'gh', 'pr', 'review', '7', '--request-changes', '--body-file', path.join(OUT, 'pr-7-review-body.md')]]);
  });

  it('loadPr : gh pr view (lecture), puis git fetch origin +pull/<n>/head:refs/vibecoder/pr/<n> <base>', async () => {
    const { calls, runner } = recorder(CARD);
    await runner.loadPr(7);
    expect(calls).toEqual([
      [...PREFIX, 'gh', 'pr', 'view', '--json', 'number,title,url,author,baseRefName,headRefName,body,state', '--', '7'],
      ['git', '-C', DIR, 'fetch', 'origin', '+pull/7/head:refs/vibecoder/pr/7', 'main'],
    ]);
  });

  it('toBase, PR fusionnée : gh pr view, puis git switch <base>, git pull --ff-only, git branch -d <branche>', async () => {
    const { calls, runner } = recorder('{"state":"MERGED"}');
    await runner.toBase('feat/x', 'main');
    expect(calls).toEqual([
      [...PREFIX, 'gh', 'pr', 'view', '--json', 'state', '--', 'feat/x'],
      ['git', '-C', DIR, 'switch', 'main'],
      ['git', '-C', DIR, 'pull', '--ff-only'],
      ['git', '-C', DIR, 'branch', '-d', 'feat/x'],
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

describe('un texte venu d’une page ne devient jamais un argument', () => {
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
  it('GIT_READ et GH_READ n’ont rien gagné', () => {
    expect([...GIT_READ]).toEqual(['rev-parse', 'status', 'diff', 'log', 'show']);
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
