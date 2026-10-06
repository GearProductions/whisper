// Invariant (SPEC I-13) : une demande d'autorisation montre ce qui va
// s'exécuter EN ENTIER et TEL QUEL (ni chemin raccourci, ni coupure
// silencieuse) ; au-delà de la borne, la coupure est dite. Outil inconnu : ses
// paramètres bruts. Protégé : si ce test échoue, corriger le code.
import { describe, expect, it } from 'vitest';
import { PERMISSION_MAX, permissionText } from 'core/conversation';

describe('texte d’une demande d’autorisation', () => {
  it('la commande en entier, chemins compris', () => {
    const command = 'cd /home/u/projet && rm -rf /var/home/u/projet/build\n&& npm test';
    expect(permissionText('Bash', { command })).toContain(command);
  });

  it('au-delà de la borne : coupé, et dit', () => {
    const command = 'x'.repeat(PERMISSION_MAX + 10);
    const text = permissionText('Bash', { command });
    expect(text).toContain('x'.repeat(PERMISSION_MAX));
    expect(text).toMatch(/10 caractères de plus ne sont pas affichés : dans le doute, refusez/);
  });

  it('outil inconnu : ses paramètres bruts', () => {
    const input = { foo: 'bar', deep: { x: 1 } };
    expect(permissionText('mcp__srv__danger', input)).toContain(JSON.stringify(input, null, 2));
  });
});
