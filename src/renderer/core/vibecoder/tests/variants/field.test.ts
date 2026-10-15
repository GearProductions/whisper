import { describe, expect, it } from 'vitest';
import { withPrefill } from 'core/vibecoder';

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
