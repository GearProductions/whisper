// Règle de structure (SPEC I-34) : une page ne peut pas demander la lecture
// d'un fichier. Elle lit la liste des canaux du panneau au lieu d'observer un
// comportement ; une retouche se signale dans la PR. Ne connaît pas le
// comportement de l'appli. Utilisée par npm test.
import { describe, expect, it } from 'vitest';
import { PANEL_CHANNELS } from 'shared/bridge';

describe('fichiers de sortie lus (I-34)', () => {
  it('une page ne peut pas demander la lecture d’un fichier : aucun canal pour ça', () => {
    const all = [...PANEL_CHANNELS.send, ...PANEL_CHANNELS.invoke];
    expect(all.filter((c) => /output|tail|file/i.test(c))).toEqual(['conv:showFile']); // montré dans le gestionnaire, jamais lu ni ouvert (I-21)
  });
});
