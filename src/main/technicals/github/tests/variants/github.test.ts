// Variants de gh (note 0.8.0, « Relire » et l'étape PR de « Créer ») : ce qui
// est lu de ses réponses ; un échec, ou une réponse illisible : null.
import { describe, expect, it } from 'vitest';
import { ciOf, githubReader, type GhRun } from 'technicals/github';

const answering = (text: string | null): GhRun => async () => text;

// Les formes lues sur gh pr view --json statusCheckRollup : CheckRun (status COMPLETED, IN_PROGRESS, QUEUED ; conclusion
// vide tant qu'il tourne) et StatusContext (state SUCCESS, FAILURE, ERROR, PENDING, EXPECTED).
const run = (name: string, status: string, conclusion = ''): object => ({ __typename: 'CheckRun', name, status, conclusion });
const done = (name: string, conclusion: string) => run(name, 'COMPLETED', conclusion);
const ctx = (context: string, state: string): object => ({ __typename: 'StatusContext', context, state });

describe('la CI d’après statusCheckRollup', () => {
  it('tous les checks SUCCESS (CheckRun et StatusContext) : ok', () => {
    expect(ciOf([done('a', 'SUCCESS'), ctx('b', 'SUCCESS')])).toEqual({ state: 'ok', failed: [] });
  });

  it('NEUTRAL ou SKIPPED : comptent comme passés', () => {
    expect(ciOf([done('a', 'NEUTRAL'), done('b', 'SKIPPED'), done('c', 'SUCCESS')])).toEqual({ state: 'ok', failed: [] });
  });

  it('un FAILURE, CANCELLED, TIMED_OUT (ou un statut ERROR, FAILURE) : ko, son nom', () => {
    expect(ciOf([done('a', 'SUCCESS'), done('b', 'FAILURE')])).toEqual({ state: 'ko', failed: ['b'] });
    expect(ciOf([done('c', 'CANCELLED')])).toEqual({ state: 'ko', failed: ['c'] });
    expect(ciOf([done('t', 'TIMED_OUT')])).toEqual({ state: 'ko', failed: ['t'] });
    expect(ciOf([ctx('s', 'ERROR'), ctx('f', 'FAILURE')])).toEqual({ state: 'ko', failed: ['s', 'f'] });
  });

  it('un en échec et un en cours : ko', () => {
    expect(ciOf([run('a', 'IN_PROGRESS'), done('b', 'FAILURE')])).toEqual({ state: 'ko', failed: ['b'] });
  });

  it('un QUEUED ou IN_PROGRESS (un statut PENDING) : pending', () => {
    expect(ciOf([done('a', 'SUCCESS'), run('b', 'QUEUED')])).toEqual({ state: 'pending', failed: [] });
    expect(ciOf([done('a', 'SUCCESS'), run('b', 'IN_PROGRESS')])).toEqual({ state: 'pending', failed: [] });
    expect(ciOf([done('a', 'SUCCESS'), ctx('s', 'PENDING')])).toEqual({ state: 'pending', failed: [] });
  });

  it('aucun check (juste après un push, dépôt sans CI) : pending', () => {
    expect(ciOf([])).toEqual({ state: 'pending', failed: [] });
  });

  it('un rollup illisible (pas un tableau, entrées sans forme) : pending, jamais ok', () => {
    for (const r of [undefined, null, 'x', 3, {}]) expect(ciOf(r)).toEqual({ state: 'pending', failed: [] });
    expect(ciOf([null, 'x', {}])).toEqual({ state: 'pending', failed: [] });
    expect(ciOf([done('a', 'SUCCESS'), null])).toEqual({ state: 'pending', failed: [] });
  });

  it('un échec sans nom lisible : ko quand même', () => {
    expect(ciOf([{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }])).toEqual({ state: 'ko', failed: [''] });
  });
});

describe('la PR d’une branche', () => {
  const card = '"number":7,"title":"t","url":"u","state":"MERGED","baseRefName":"main","headRefName":"feat/x"';

  it('sa fiche, aux noms de pr.json (base, head), plus ses checks (ci)', async () => {
    const gh = githubReader(answering(`{${card},"statusCheckRollup":[{"__typename":"CheckRun","name":"a","status":"COMPLETED","conclusion":"SUCCESS"}]}`));
    expect(await gh.prForBranch('feat/x')).toEqual({ number: 7, title: 't', url: 'u', state: 'MERGED', base: 'main', head: 'feat/x', ci: { state: 'ok', failed: [] } });
  });

  it('statusCheckRollup demandé dans son --json, la branche après --', async () => {
    const calls: string[][] = [];
    await githubReader(async (args) => { calls.push(args); return `{${card}}`; }).prForBranch('feat/x');
    expect(calls).toHaveLength(1);
    expect(calls[0].slice(0, 2)).toEqual(['pr', 'view']);
    expect(calls[0][calls[0].indexOf('--json') + 1].split(',')).toContain('statusCheckRollup');
    expect(calls[0].slice(-2)).toEqual(['--', 'feat/x']);
  });

  it('sans rollup dans la réponse : ci pending, jamais ok', async () => {
    expect((await githubReader(answering(`{${card}}`)).prForBranch('feat/x'))!.ci).toEqual({ state: 'pending', failed: [] });
  });

  it('gh en échec (pas de PR, pas connecté), ou une réponse illisible : null', async () => {
    expect(await githubReader(answering(null)).prForBranch('feat/x')).toBeNull();
    expect(await githubReader(answering('pas du json')).prForBranch('feat/x')).toBeNull();
    expect(await githubReader(answering('{"number":"7"}')).prForBranch('feat/x')).toBeNull();
  });
});

describe('les PR ouvertes', () => {
  it('trois listes telles que gh les donne : les miennes, à relire, toutes', async () => {
    const calls: string[][] = [];
    const gh = githubReader(async (args) => {
      calls.push(args);
      return args.includes('--author') ? '[{"number":1}]' : args.includes('--search') ? '[{"number":2}]' : '[{"number":1},{"number":2},{"number":3}]';
    });
    expect(await gh.openPrs()).toEqual({ mine: [{ number: 1 }], review: [{ number: 2 }], all: [{ number: 1 }, { number: 2 }, { number: 3 }] });
    expect(calls).toEqual([
      ['pr', 'list', '--author', '@me', '--json', 'number,title,author,url'],
      ['pr', 'list', '--search', 'review-requested:@me', '--json', 'number,title,author,url'],
      ['pr', 'list', '--limit', '100', '--json', 'number,title,author,url,reviewRequests'],
    ]);
  });

  it('à relire : aussi une PR dont la demande de relecture me nomme, que la recherche (en retard) ne voit pas encore ; une fois', async () => {
    const gh = githubReader(async (args) => (args.includes('--author') ? '[]' : args.includes('--search') ? '[{"number":2}]'
      : '[{"number":2,"reviewRequests":[{"login":"moi"}]},{"number":3,"reviewRequests":[{"login":"moi"}]},{"number":4,"reviewRequests":[{"login":"autre"},{"name":"équipe"}]}]'));
    const r = await gh.openPrs('moi');
    expect(r!.review).toEqual([{ number: 2 }, { number: 3 }]);
    expect(r!.all).toEqual([{ number: 2 }, { number: 3 }, { number: 4 }]);
  });

  it('sans identifiant lisible : la recherche seule', async () => {
    const gh = githubReader(async (args) => (args.includes('--search') ? '[]' : '[{"number":3,"reviewRequests":[{"login":"moi"}]}]'));
    expect((await gh.openPrs())!.review).toEqual([]);
    expect((await gh.openPrs('-x'))!.review).toEqual([]);
  });

  it('[] : aucune', async () => {
    expect(await githubReader(answering('[]')).openPrs()).toEqual({ mine: [], review: [], all: [] });
  });

  it('une liste en échec ou illisible : null (pas une liste vide)', async () => {
    expect(await githubReader(answering(null)).openPrs()).toBeNull();
    expect(await githubReader(answering('{}')).openPrs()).toBeNull();
    expect(await githubReader(async (args) => (args.includes('--search') ? null : '[]')).openPrs()).toBeNull();
  });
});

describe('l’état d’une PR', () => {
  it('OPEN, CLOSED, MERGED ; autre chose : null', async () => {
    expect(await githubReader(answering('{"state":"MERGED"}')).prState(7)).toBe('MERGED');
    expect(await githubReader(answering('{"state":"DRAFT"}')).prState(7)).toBeNull();
  });
});

describe('l’identifiant de l’utilisateur', () => {
  it('la ligne de gh api user, sans son saut de ligne', async () => {
    expect(await githubReader(answering('Reykugo-Gear\n')).login()).toBe('Reykugo-Gear');
  });

  it('gh en échec, ou autre chose qu’un identifiant : null', async () => {
    expect(await githubReader(answering(null)).login()).toBeNull();
    expect(await githubReader(answering('')).login()).toBeNull();
    expect(await githubReader(answering('-x')).login()).toBeNull();
    expect(await githubReader(answering('a b')).login()).toBeNull();
  });
});

describe('les personnes d’une PR', () => {
  it('l’auteur et les assignés ; un login douteux est écarté', async () => {
    const calls: string[][] = [];
    const gh = githubReader(async (args) => {
      calls.push(args);
      return JSON.stringify({
        author: { login: 'bob' }, assignees: [{ login: 'kb' }, { login: '-x' }],
      });
    });
    expect(await gh.prPeople(7)).toEqual({ author: 'bob', assignees: ['kb'] });
    expect(calls).toEqual([['pr', 'view', '--json', 'author,assignees', '--', '7']]);
  });

  it('un numéro qui n’est pas un entier positif : null, sans lancer gh', async () => {
    let ran = 0;
    const gh = githubReader(async () => { ran++; return '{}'; });
    for (const n of [0, -1, 1.5, '7', null, undefined]) expect(await gh.prPeople(n)).toBeNull();
    expect(ran).toBe(0);
  });

  it('gh en échec, ou une réponse illisible : null', async () => {
    expect(await githubReader(answering(null)).prPeople(7)).toBeNull();
    expect(await githubReader(answering('pas du json')).prPeople(7)).toBeNull();
    expect(await githubReader(answering('null')).prPeople(7)).toBeNull();
  });
});
