// Invariant (SPEC I-29) : un journal impossible à écrire n'arrête jamais un
// agent. Protégé : si ce test échoue, corriger le code.
import { describe, expect, it } from 'vitest';
import { createJournal } from 'technicals/journal';

describe('journal des agents', () => {
  it('fichier inaccessible : aucune erreur', () => {
    const journal = createJournal(() => '/proc/interdit/agents.log');
    expect(() => journal({ id: 'a1', name: 'alpha' }, 'tour commencé', 'détail')).not.toThrow();
  });
  it('sans fichier : rien', () => {
    expect(() => createJournal(() => null)({ id: 'a1' }, 'x')).not.toThrow();
  });
});
