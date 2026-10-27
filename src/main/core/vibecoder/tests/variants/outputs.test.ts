import { describe, expect, it } from 'vitest';
import { isOutputName, parseChecklist, parseQuestions, parseReading, newWorktreeCard, questionsRule, worktreeCard } from 'core/vibecoder';

const READING_FR = `# src/main/core/x/tests/invariants/x.test.ts

## un chemin hors du dossier : refusé

\`\`\`pseudo
it("refuse un chemin qui sort du dossier", () => {
  // étant donné : un dossier et un fichier à côté
  // quand : on demande ../secret
  // alors : rien
  expect(safePath(dir, "../secret")).toBeNull()
})
\`\`\`

Cas limites :
- a/../../secret
- un lien qui sort
Garantit : I-34, la page ne fait pas lire un autre fichier
Attention : le realpath est simulé

## un chemin simple : accepté

\`\`\`pseudo
it("accepte", () => {})
\`\`\`

Garantit : la note, « Lire un fichier qu'une page désigne »
`;

describe('parseReading : un fichier de test lu en pseudo-code', () => {
  const cases = parseReading(READING_FR);

  it('un cas par titre ##, tel que dans le test', () => {
    expect(cases.map((c) => c.title)).toEqual(['un chemin hors du dossier : refusé', 'un chemin simple : accepté']);
  });

  it('le pseudo-code est le bloc du cas, sans ses clôtures', () => {
    expect(cases[1].pseudo).toBe('it("accepte", () => {})');
  });

  it('les cas limites sont la liste qui suit « Cas limites : »', () => {
    expect(cases[0].edges).toEqual(['a/../../secret', 'un lien qui sort']);
  });

  it('« Garantit : » donne ce qu\'il garantit', () => {
    expect(cases[0].guarantees).toBe('I-34, la page ne fait pas lire un autre fichier');
  });

  it('« Attention : » donne le point d\'attention', () => {
    expect(cases[0].warning).toBe('le realpath est simulé');
  });

  it('sans « Attention : », pas de point d\'attention', () => {
    expect(cases[1].warning).toBeNull();
  });

  it('un ## dans le bloc de pseudo-code n\'ouvre pas de cas', () => {
    expect(parseReading('## a\n```pseudo\n## pas un cas\n```\n').map((c) => c.title)).toEqual(['a']);
  });

  it('en anglais : Edge cases, Guarantees, Warning', () => {
    expect(parseReading('## a case\n\nEdge cases:\n- empty\nGuarantees: nothing leaks\nWarning: a mock\n')).toEqual([
      { title: 'a case', pseudo: '', edges: ['empty'], guarantees: 'nothing leaks', warning: 'a mock' },
    ]);
  });
});

describe('parseQuestions : questions.md', () => {
  it('`## n. question` puis ses réponses proposées', () => {
    expect(parseQuestions('## 1. Combien de PR à la fois ?\n- Une\n- Plusieurs\n')).toEqual([
      { n: 1, text: 'Combien de PR à la fois ?', options: ['Une', 'Plusieurs'] },
    ]);
  });

  it('le texte sous le titre complète la question', () => {
    expect(parseQuestions('## 2. Quel modèle ?\nLe banc n\'a pas tranché.\n- Sonnet\n')[0].text).toBe('Quel modèle ? Le banc n\'a pas tranché.');
  });

  it('une question sans réponse proposée', () => {
    expect(parseQuestions('## 1. Pourquoi ?\n')[0].options).toEqual([]);
  });

  it('fichier vide : plus de question', () => {
    expect(parseQuestions('')).toEqual([]);
  });
});

describe('parseChecklist : les cases d\'une liste', () => {
  it('cochées ou non, les autres lignes ignorées', () => {
    expect(parseChecklist('# Plan\n- [ ] Ouvrir le panneau\n- [x] Dicter\n* [X] Envoyer\n- pas une case\n')).toEqual([
      { text: 'Ouvrir le panneau', done: false }, { text: 'Dicter', done: true }, { text: 'Envoyer', done: true },
    ]);
  });
});

describe('isOutputName : les sorties d\'une PR', () => {
  it('pr-12.json : lu', () => {
    expect(isOutputName('pr-12.json')).toBe(true);
  });

  it('pr-12-ecran.md : lu', () => {
    expect(isOutputName('pr-12-ecran.md')).toBe(true);
  });

  it('pr-0.json : refusé (pas de PR 0)', () => {
    expect(isOutputName('pr-0.json')).toBe(false);
  });

  it('pr-12-autre.md : refusé', () => {
    expect(isOutputName('pr-12-autre.md')).toBe(false);
  });
});

describe('worktreeCard : la fiche du worktree d’une PR (F-110)', () => {
  it('pr-12-worktree.json : un nom de sortie connu', () => {
    expect(isOutputName('pr-12-worktree.json')).toBe(true);
  });

  it('le dossier, chemin absolu, et la branche', () => {
    expect(worktreeCard(JSON.stringify({ dir: '/p-worktrees/pr-12', branch: 'pr-12' }))).toEqual({ dir: '/p-worktrees/pr-12', branch: 'pr-12' });
    expect(worktreeCard(JSON.stringify({ dir: '/p' }))).toEqual({ dir: '/p', branch: '' });
  });

  it('refusée : chemin relatif, caractère de contrôle, pas un texte, illisible', () => {
    for (const dir of ['p-worktrees/pr-12', '/p\n-x', 12, '']) expect(worktreeCard(JSON.stringify({ dir }))).toBeNull();
    expect(worktreeCard('{ pas du json')).toBeNull();
    expect(worktreeCard(null)).toBeNull();
  });
});

describe('newWorktreeCard : la branche d’une nouvelle demande dans un worktree', () => {
  it('new-worktree.json : un nom de sortie connu', () => {
    expect(isOutputName('new-worktree.json')).toBe(true);
  });

  it('la branche, un ref sûr', () => {
    expect(newWorktreeCard(JSON.stringify({ branch: 'feat/G2-3-bouton' }))).toEqual({ branch: 'feat/G2-3-bouton' });
  });

  it('refusée : une option, « .. », un espace, un caractère de contrôle, pas un texte, illisible', () => {
    for (const branch of ['-x', 'feat/../x', 'feat/a b', 'feat/x\n', 12, '']) expect(newWorktreeCard(JSON.stringify({ branch }))).toBeNull();
    expect(newWorktreeCard('{ pas du json')).toBeNull();
    expect(newWorktreeCard(null)).toBeNull();
  });
});

describe('questionsRule : la ligne de la consigne', () => {
  it('nomme questions.md dans le dossier de sorties, tel quel (espaces compris)', () => {
    const line = questionsRule('/home/x/vibecoder-out/mon agent');
    expect(line).toContain('/home/x/vibecoder-out/mon agent/questions.md');
    expect(line).toContain('note');
    expect(line.split('\n')).toHaveLength(1);
  });
});
