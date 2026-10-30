import { describe, expect, it } from 'vitest';
import { matchArtifacts, matchCommands, mentionQuery, pickArtifact, slashQuery } from 'core/conversation';
import type { VibeArtifact } from 'technicals/bridge';

const art = (name: string): VibeArtifact => ({ id: name, name, kind: 'text', size: 0, time: 0, url: null, truncated: false });

describe('mentionQuery : où s\'ouvre la liste du @ (8)', () => {
  it('en début de champ, après un espace ou un retour à la ligne', () => {
    expect(mentionQuery('@pl', 3)).toEqual({ start: 0, query: 'pl' });
    expect(mentionQuery('voir @pl', 8)).toEqual({ start: 5, query: 'pl' });
    expect(mentionQuery('voir\n@', 6)).toEqual({ start: 5, query: '' });
  });

  it('pas au milieu d\'un mot : une adresse e-mail ne l\'ouvre pas', () => {
    expect(mentionQuery('a@b.fr', 6)).toBeNull();
    expect(mentionQuery('a@', 2)).toBeNull();
  });

  it('pas après un espace tapé depuis le @, ni sans @', () => {
    expect(mentionQuery('@plan ', 6)).toBeNull();
    expect(mentionQuery('rien', 4)).toBeNull();
  });

  it('seul ce qui précède le curseur compte', () => {
    expect(mentionQuery('@plan suite', 3)).toEqual({ start: 0, query: 'pl' });
  });

  it('@types/node se tape : la liste est vide quand rien ne correspond', () => {
    expect(mentionQuery('@types/node', 11)?.query).toBe('types/node');
    expect(matchArtifacts([art('plan.md')], 'types/node')).toEqual([]);
  });
});

describe('matchArtifacts', () => {
  const list = [art('docs/plan.md'), art('Plan.md'), art('replan.md')];

  it('le début du nom d\'abord, sans casse', () => {
    expect(matchArtifacts(list, 'PLAN').map((a) => a.name)).toEqual(['Plan.md', 'docs/plan.md', 'replan.md']);
  });

  it('saisie vide : tout, au plus 50', () => {
    const many = Array.from({ length: 80 }, (_, i) => art(`f${i}`));
    expect(matchArtifacts(many, '')).toHaveLength(50);
  });
});

describe('pickArtifact', () => {
  it('le chemin remplace le @… tapé, le reste du champ suit', () => {
    expect(pickArtifact('voir @pl et lire', 8, 5, '/p/artifacts/plan.md'))
      .toEqual({ value: 'voir /p/artifacts/plan.md et lire', caret: 26 });
  });

  it('en fin de champ : un espace derrière, curseur après', () => {
    expect(pickArtifact('@pl', 3, 0, 'plan.md')).toEqual({ value: 'plan.md ', caret: 8 });
  });
});

describe('les commandes « / » ne changent pas (F-70)', () => {
  it('un @ ne les ouvre pas, un / n\'ouvre pas le @', () => {
    expect(slashQuery('@pl', 3)).toBeNull();
    expect(mentionQuery('/pl', 3)).toBeNull();
    expect(slashQuery('/pl', 3)).toBe('pl');
    expect(matchCommands([{ name: 'plan' } as never], 'pl')).toHaveLength(1);
  });
});
