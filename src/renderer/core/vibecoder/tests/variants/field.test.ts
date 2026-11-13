import { describe, expect, it } from 'vitest';
import { codeBlock, takesConversation, withPrefill } from 'core/vibecoder';
import type { VibeAction } from 'technicals/bridge';

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

  it('un bloc : cité en entier, ses lignes gardées, sans limite', () => {
    const code = `  const a = 1;\n${'x'.repeat(400)}`;
    expect(withPrefill('', 'À propos de « {{quote}} » : ', code, true)).toBe(`À propos de « ${code} » : `);
  });

  it('un bloc et un gabarit sans {{quote}} (fix) : le bloc à la suite du texte', () => {
    expect(withPrefill('avant', 'Retour : ', 'a\nb', true)).toBe('avant\nRetour :\na\nb');
  });

  it('sans bloc, un gabarit sans {{quote}} ne cite rien', () => {
    expect(withPrefill('', 'Retour : ', 'a')).toBe('Retour : ');
  });
});

describe('codeBlock', () => {
  const code = 'un\ndeux\ntrois';

  it('un clic : la ligne du clic', () => {
    expect(codeBlock(code, 4, 4)).toBe('deux');
    expect(codeBlock(code, 0, 0)).toBe('un');
    expect(codeBlock(code, code.length, code.length)).toBe('trois');
  });

  it('une sélection : les lignes entières qu\'elle touche, dans les deux sens', () => {
    expect(codeBlock(code, 1, 5)).toBe('un\ndeux');
    expect(codeBlock(code, 5, 1)).toBe('un\ndeux');
  });

  it('une sélection qui finit au début d\'une ligne ne la prend pas', () => {
    expect(codeBlock(code, 3, 8)).toBe('deux');
  });

  it('une première ligne vide : elle seule', () => {
    expect(codeBlock('\nx', 0, 0)).toBe('');
  });
});

describe('takesConversation', () => {
  const a = (id: string, more: Partial<VibeAction> = {}) =>
    ({ id, kind: 'send', needs: 'none', ...more }) as Pick<VibeAction, 'id' | 'kind' | 'needs'>;

  it('Rédiger la note, Nouvelle demande : le champ de la conversation', () => {
    expect(takesConversation(a('note', { needs: 'text' }))).toBe(true);
    expect(takesConversation(a('new-request', { needs: 'text' }))).toBe(true);
  });

  it('Poser la forme, Écrire les invariants (ils partent sans texte) : non', () => {
    expect(takesConversation(a('forme'))).toBe(false);
    expect(takesConversation(a('invariants'))).toBe(false);
  });

  it('une préparée, apply (la vue donne le texte), une action sans texte : non', () => {
    expect(takesConversation(a('case-ko', { kind: 'prefill', needs: 'text' }))).toBe(false);
    expect(takesConversation(a('apply', { needs: 'text' }))).toBe(false);
    expect(takesConversation(a('checks'))).toBe(false);
  });
});
