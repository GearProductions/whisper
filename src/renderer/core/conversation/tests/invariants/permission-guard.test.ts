// Invariants (SPEC I-15, I-16, côté page) : une réponse ne part que pour la
// demande d'autorisation affichée, et jamais dans le délai qui suit l'arrivée
// d'une NOUVELLE demande (le clic visait la précédente). Protégé : si ce test
// échoue, corriger le code.
import { describe, expect, it, vi } from 'vitest';
import { createPermissionGuard } from 'core/conversation';

function setup() {
  let t = 0;
  const guard = createPermissionGuard(600, () => t);
  const send = vi.fn();
  return { guard, send, at: (ms: number) => { t = ms; } };
}

describe('réponse à une demande d’autorisation', () => {
  it('ignorée dans le délai qui suit une nouvelle demande', () => {
    const { guard, send, at } = setup();
    at(1000); guard.show(1);
    at(1599);
    expect(guard.answer(1, 'allow', send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('acceptée après le délai, pour la demande affichée', () => {
    const { guard, send, at } = setup();
    at(1000); guard.show(1);
    at(1600);
    expect(guard.answer(1, 'deny', send)).toBe(true);
    expect(send).toHaveBeenCalledWith('deny', 1);
  });

  it('la même demande réaffichée ne relance pas le délai', () => {
    const { guard, send, at } = setup();
    at(1000); guard.show(1);
    at(1500); guard.show(1);
    at(1700);
    expect(guard.answer(1, 'allow', send)).toBe(true);
  });

  it('une nouvelle demande relance le délai', () => {
    const { guard, send, at } = setup();
    at(1000); guard.show(1);
    at(2000); guard.show(2);
    at(2100);
    expect(guard.answer(2, 'allow', send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('jamais pour une demande qui n’est plus affichée', () => {
    const { guard, send, at } = setup();
    at(1000); guard.show(1);
    at(5000); guard.show(2);
    at(9000);
    expect(guard.answer(1, 'always', send)).toBe(false);
    guard.show(null);
    expect(guard.answer(2, 'always', send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
