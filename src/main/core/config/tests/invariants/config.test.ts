// Invariants des réglages. Protégés : si un test échoue, corriger le code.
// (I-8 retiré en 0.14.0 avec l'icône : l'agent sélectionné est l'agent affiché.)
//   I-23 : un dossier jamais choisi passe par la question de confiance.
import { describe, expect, it } from 'vitest';
import { needsTrust, withDefaults } from 'core/config';

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
