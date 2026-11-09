// Règle de structure : le code de la page n'insère jamais de HTML. Elle lit le
// code au lieu d'observer un comportement ; une retouche se signale dans la PR.
// Ce qu'une page montre passe par des composants, pas par du texte interprété
// comme du HTML (innerHTML, dangerouslySetInnerHTML…). Ne connaît pas le
// comportement de l'appli. Utilisée par npm test.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { insertsHtml, sources } from './sources';

describe('la page n’insère pas de HTML', () => {
  it('le code de la page : aucune insertion de HTML, hors des tests', () => {
    const all = sources(resolve(__dirname, '../../src/renderer'));
    expect(all.length).toBeGreaterThan(10);
    expect(all.filter(([, s]) => insertsHtml(s)).map(([p]) => p)).toEqual([]);
  });

  it('témoin : un texte qui écrit innerHTML est relevé par la règle', () => {
    expect(insertsHtml('el.innerHTML = x;')).toBe(true);
    expect(insertsHtml('<div dangerouslySetInnerHTML={{ __html: x }} />')).toBe(true);
  });

  it('un commentaire qui nomme dangerouslySetInnerHTML ne compte pas', () => {
    expect(insertsHtml('// jamais dangerouslySetInnerHTML\n/** ni innerHTML */\nconst a = 1;')).toBe(false);
  });
});
