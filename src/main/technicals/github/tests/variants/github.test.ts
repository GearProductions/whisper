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

describe('les PR à relire', () => {
  it('la liste telle que gh la donne ; [] : aucune', async () => {
    expect(await githubReader(answering('[{"number":3,"title":"t","author":{"login":"kb"},"url":"u"}]')).prsToReview())
      .toEqual([{ number: 3, title: 't', author: { login: 'kb' }, url: 'u' }]);
    expect(await githubReader(answering('[]')).prsToReview()).toEqual([]);
  });

  it('gh en échec : null (pas une liste vide)', async () => {
    expect(await githubReader(answering(null)).prsToReview()).toBeNull();
  });
});

describe('l’état d’une PR', () => {
  it('OPEN, CLOSED, MERGED ; autre chose : null', async () => {
    expect(await githubReader(answering('{"state":"MERGED"}')).prState(7)).toBe('MERGED');
    expect(await githubReader(answering('{"state":"DRAFT"}')).prState(7)).toBeNull();
  });
});
