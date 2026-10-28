// Variants de gh (note 0.8.0, « Relire » et l'étape PR de « Créer ») : ce qui
// est lu de ses réponses ; un échec, ou une réponse illisible : null.
import { describe, expect, it } from 'vitest';
import { githubReader, type GhRun } from 'technicals/github';

const answering = (text: string | null): GhRun => async () => text;

describe('la PR d’une branche', () => {
  it('sa fiche, aux noms de pr.json (base, head)', async () => {
    const gh = githubReader(answering('{"number":7,"title":"t","url":"u","state":"MERGED","baseRefName":"main","headRefName":"feat/x"}'));
    expect(await gh.prForBranch('feat/x')).toEqual({ number: 7, title: 't', url: 'u', state: 'MERGED', base: 'main', head: 'feat/x' });
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
      ['pr', 'list', '--limit', '100', '--json', 'number,title,author,url'],
    ]);
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
