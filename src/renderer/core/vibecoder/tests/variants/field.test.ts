import { describe, expect, it } from 'vitest';
import { withPrefill, withSkill } from 'core/vibecoder';

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

describe('withSkill', () => {
  it('le skill en tête du champ', () => {
    expect(withSkill('relis ça', 'ponytail', ['ponytail'])).toBe('/ponytail relis ça');
  });

  it('une pastille déjà là est remplacée', () => {
    expect(withSkill('/ponytail relis ça', 'gear-guide', ['ponytail', 'gear-guide'])).toBe('/gear-guide relis ça');
  });

  it('un texte qui commence par un chemin reste entier', () => {
    expect(withSkill('/home/u/x.ts à revoir', 'ponytail', ['ponytail'])).toBe('/ponytail /home/u/x.ts à revoir');
  });
});
