// Invariants des réglages. Protégés : si un test échoue, corriger le code.
//   I-8  : aucun agent sélectionné au lancement (une dictée ne part pas chez
//          Claude parce qu'un robot l'était la veille).
//   I-23 : un dossier jamais choisi passe par la question de confiance.
import { describe, expect, it } from 'vitest';
import { needsTrust, startupPatch, withDefaults } from 'core/config';

describe('au lancement (I-8)', () => {
  it('l’agent sélectionné la veille est oublié', () => {
    const cfg = withDefaults({ agentsEnabled: true, agentSelected: 'a1', agents: [{ id: 'a1', dir: '/p' }] });
    expect({ ...cfg, ...startupPatch(cfg) }.agentSelected).toBeNull();
  });
  it('rien à changer sans agent sélectionné', () => {
    expect(startupPatch(withDefaults({}))).toBeNull();
  });
});

describe('confiance d’un dossier (I-23)', () => {
  const cfg = withDefaults({ agentFolders: [{ dir: '/connu', color: '#22c55e' }, '/ancien-format'], agents: [{ id: 'a', dir: '/avec-agent' }] });
  it('dossier jamais choisi : la question est posée', () => {
    expect(needsTrust(cfg, '/inconnu')).toBe(true);
    expect(needsTrust(cfg, '/connu/sous-dossier')).toBe(true);
  });
  it('dossier favori : déjà accordée', () => {
    expect(needsTrust(cfg, '/connu')).toBe(false);
    expect(needsTrust(cfg, '/ancien-format')).toBe(false);
    expect(needsTrust(cfg, '/avec-agent')).toBe(false);
  });
});
