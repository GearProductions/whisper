import { describe, expect, it } from 'vitest';
import { fieldOf, withPrefill } from 'core/vibecoder';

describe('withPrefill', () => {
  it('champ vide : le texte, {{quote}} remplacé par la citation sur une ligne', () => {
    expect(withPrefill('', 'À propos de « {{quote}} » : ', ' une\n  ligne ')).toBe('À propos de « une ligne » : ');
  });

  it('champ rempli : ajouté à la ligne', () => {
    expect(withPrefill('déjà là  ', 'Retour : ', '')).toBe('déjà là\nRetour : ');
  });

  it('une citation de plus de 300 caractères : coupée à 300, « … » compris', () => {
    expect(withPrefill('', '{{quote}}', 'x'.repeat(400))).toBe(`${'x'.repeat(299)}…`);
  });

  it('une citation qui ressemble à un motif de remplacement part telle quelle', () => {
    expect(withPrefill('', '« {{quote}} »', '$& et $1')).toBe('« $& et $1 »');
  });
});

describe('fieldOf', () => {
  const a = (id: string, step: string | null, more: Partial<Parameters<typeof fieldOf>[0]> = {}) =>
    ({ id, step, kind: 'send', needs: 'none', usesText: true, ...more }) as Parameters<typeof fieldOf>[0];

  it('une action d\'étape qui prend un texte : le champ de son étape', () => {
    expect(fieldOf(a('note', 'note', { needs: 'text' }))).toBe('note');
    expect(fieldOf(a('forme', 'forme'))).toBe('forme');
  });

  it('Tout dérouler : le champ du bandeau', () => {
    expect(fieldOf(a('vibe', null, { needs: 'text' }))).toBe('vibe');
  });

  it('aucun champ : sans texte, texte donné par la vue, préparée, message de la conversation', () => {
    expect(fieldOf(a('checks', 'revue', { usesText: false }))).toBeNull();
    expect(fieldOf(a('apply', 'revue'))).toBeNull();
    expect(fieldOf(a('case-ko', 'invariants', { kind: 'prefill' }))).toBeNull();
    expect(fieldOf(a('ask', null, { needs: 'text' }))).toBeNull();
    expect(fieldOf(a('guide', null))).toBeNull();
  });
});
