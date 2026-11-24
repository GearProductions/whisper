import { describe, expect, it } from 'vitest';
import { isOutputName, parseChecklist, parseProof, parseQuestions, parseReading, newRequestCard, proofOf, questionsRule, toiCount, worktreeCard } from 'core/vibecoder';

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

  it('`## 1. [important] Quoi ?` : n 1, level important, text sans le crochet', () => {
    expect(parseQuestions('## 1. [important] Quoi ?\n- Ça\n')).toEqual([
      { n: 1, text: 'Quoi ?', options: ['Ça'], level: 'important' },
    ]);
  });

  it('`## 2. [secondaire] …` : level secondary', () => {
    const [q] = parseQuestions('## 2. [secondaire] Quel nom ?\n');
    expect([q.n, q.level, q.text]).toEqual([2, 'secondary', 'Quel nom ?']);
  });

  it('sans niveau, `[toi]` ou `[x]` en tête : pas de level, text entier', () => {
    const qs = parseQuestions('## 1. Quoi ?\n## 2. [toi] Quoi ?\n## 3. [x] Quoi ?\n');
    expect(qs.map((q) => [q.text, 'level' in q])).toEqual([['Quoi ?', false], ['[toi] Quoi ?', false], ['[x] Quoi ?', false]]);
  });

  it('le niveau plus loin dans le titre : pas de level', () => {
    const [q] = parseQuestions('## 1. Quoi [important] ?\n');
    expect([q.text, 'level' in q]).toEqual(['Quoi [important] ?', false]);
  });

  it('un questionnaire d\'avant : numéros, ordre et réponses inchangés, mêlé à des niveaux', () => {
    const qs = parseQuestions('## 3. Trois ?\n- a\n- b\n## [secondaire] Sans numéro ?\n## 7) [important] Sept ?\n1. oui\n');
    expect(qs.map((q) => [q.n, q.text, q.options, q.level])).toEqual([
      [3, 'Trois ?', ['a', 'b'], undefined],
      [2, 'Sans numéro ?', [], 'secondary'],
      [7, 'Sept ?', ['oui'], 'important'],
    ]);
  });

  it('le niveau seul, sans question : text vide, level posé ; la ligne suivante complète le texte', () => {
    expect(parseQuestions('## 1. [important]\nQuoi ?\n')[0]).toEqual({ n: 1, text: 'Quoi ?', options: [], level: 'important' });
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

  it('ecran.md : lu (une sortie de branche) ; pr-12-ecran.md : refusé (avant la 0.13.0)', () => {
    expect([isOutputName('ecran.md'), isOutputName('pr-12-ecran.md')]).toEqual([true, false]);
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

describe('newRequestCard : la branche d’une nouvelle demande', () => {
  it('new-request.json : un nom de sortie connu ; new-worktree.json : plus lu', () => {
    expect(isOutputName('new-request.json')).toBe(true);
    expect(isOutputName('new-worktree.json')).toBe(false);
  });

  it('la branche, un ref sûr', () => {
    expect(newRequestCard(JSON.stringify({ branch: 'feat/G2-3-bouton' }))).toEqual({ branch: 'feat/G2-3-bouton' });
  });

  it('refusée : une option, « .. », un espace, un caractère de contrôle, pas un texte, illisible', () => {
    for (const branch of ['-x', 'feat/../x', 'feat/a b', 'feat/x\n', 12, '']) expect(newRequestCard(JSON.stringify({ branch }))).toBeNull();
    expect(newRequestCard('{ pas du json')).toBeNull();
    expect(newRequestCard(null)).toBeNull();
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

// La preuve des invariants par mutation (note 0.16.0) : preuve.md.
const L1 = 'Lire un autre fichier. → invariant';
const L2 = 'Écrire hors du dossier. → invariant';

describe('preuve.md : une sortie connue', () => {
  it('preuve.md est un nom connu ; pr-1-preuve.md non', () => {
    expect([isOutputName('preuve.md'), isOutputName('pr-1-preuve.md')]).toEqual([true, false]);
  });
});

describe('parseProof : les rubriques de preuve.md', () => {
  it('[prouvé] : la ligne, prouvée, son mutant en détail', () => {
    expect(parseProof(`## [prouvé] ${L1}\n\nMutant : lit /etc/passwd.\nLe test échoue.\n`)).toEqual([
      { line: L1, proved: true, detail: 'Mutant : lit /etc/passwd.\nLe test échoue.' },
    ]);
  });

  it('[proved], en anglais : de même', () => {
    expect(parseProof(`## [proved] ${L1}\nMutant: reads it.\n`)).toEqual([{ line: L1, proved: true, detail: 'Mutant: reads it.' }]);
  });

  it('[toi] : la ligne, pas prouvée, sa raison en détail', () => {
    expect(parseProof(`## [toi] ${L1}\n\nLe test reste vert.\n`)).toEqual([{ line: L1, proved: false, detail: 'Le test reste vert.' }]);
  });

  it('une étiquette inconnue, ou aucune : pas prouvée', () => {
    expect(parseProof(`## [vert] ${L1}\nx\n## ${L2}\ny\n`).map((r) => [r.line, r.proved])).toEqual([[L1, false], [L2, false]]);
  });

  it('les rubriques dans l’ordre ; le texte avant la première est ignoré ; sans rubrique : rien', () => {
    expect(parseProof(`Intro\n## [prouvé] ${L1}\na\n## [toi] ${L2}\nb\n`).map((r) => r.line)).toEqual([L1, L2]);
    expect(parseProof('Rien à prouver.\n')).toEqual([]);
    expect(parseProof('')).toEqual([]);
  });

  it('fins de ligne Windows, espaces en bout de titre', () => {
    expect(parseProof(`## [prouvé] ${L1}  \r\nmutant\r\n`)).toEqual([{ line: L1, proved: true, detail: 'mutant' }]);
  });
});

describe('proofOf : l’état de la preuve pour les lignes de la note', () => {
  const proved = (l: string) => `## [prouvé] ${l}\n\nMutant.\n`;
  const toi = (l: string) => `## [toi] ${l}\n\nRaison.\n`;

  it('la note sans ligne « → invariant » : rien à prouver, avec ou sans fichier', () => {
    expect(proofOf('Rien à prouver.\n', [])).toEqual({ state: 'none', lines: [] });
    expect(proofOf(null, [])).toEqual({ state: 'none', lines: [] });
  });

  it('des lignes dans la note, pas de fichier : la preuve manque', () => {
    expect(proofOf(null, [L1])).toEqual({ state: 'missing', lines: [{ line: L1, proved: false, detail: '' }] });
  });

  it('une ligne de la note sans rubrique : la preuve manque', () => {
    const p = proofOf(proved(L1), [L1, L2]);
    expect(p.state).toBe('missing');
    expect(p.lines.map((l) => [l.line, l.proved])).toEqual([[L1, true], [L2, false]]);
  });

  it('une rubrique [toi] : la preuve est bloquée', () => {
    expect(proofOf(toi(L1), [L1])).toEqual({ state: 'blocked', lines: [{ line: L1, proved: false, detail: 'Raison.' }] });
  });

  it('chaque ligne de la note prouvée : la preuve passe', () => {
    expect(proofOf(proved(L1) + proved(L2), [L1, L2]).state).toBe('ok');
  });

  it('une ligne manquante l’emporte sur une ligne [toi]', () => {
    expect(proofOf(toi(L1), [L1, L2]).state).toBe('missing');
  });

  it('une rubrique d’une ligne qui n’est pas dans la note : ignorée', () => {
    expect(proofOf(proved(L1) + proved('Autre. → invariant'), [L1]).state).toBe('ok');
  });

  it('la ligne se compare à l’espace près', () => {
    expect(proofOf(proved(`  Lire   un autre fichier. → invariant `), [L1]).state).toBe('ok');
  });

  it('deux rubriques pour la même ligne, une [toi] : pas prouvée', () => {
    expect(proofOf(proved(L1) + toi(L1), [L1]).state).toBe('blocked');
  });
});

describe('toiCount : les rubriques [toi] d’un fichier de retour', () => {
  it('« Aligné. » : aucune', () => {
    expect(toiCount('Aligné.\n')).toBe(0);
    expect(toiCount('')).toBe(0);
  });

  it('deux [toi] et une [agent] : deux', () => {
    expect(toiCount('## [toi] a\nx\n## [agent] b\ny\n## [toi] c\nz\n')).toBe(2);
  });

  it('[toi] ailleurs qu’en titre : pas compté', () => {
    expect(toiCount('Voir [toi]\n### [toi] a\n## a [toi]\n')).toBe(0);
  });
});
