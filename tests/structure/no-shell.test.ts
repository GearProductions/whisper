// Règle de structure (SPEC I-27) : aucun programme n'est lancé par un shell.
// Elle lit le code au lieu d'observer un comportement ; une retouche se signale
// dans la PR. Chemins, texte dicté, commande d'un agent ne sont jamais
// interprétés : execFile et spawn, avec des arguments. Ne connaît pas le
// comportement de l'appli. Utilisée par npm test.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sources } from './sources';

describe('pas de shell', () => {
  const all = [...sources(resolve(__dirname, '../../src/main')), ...sources(resolve(__dirname, '../../src/preload'))];

  it('trouve le code', () => expect(all.length).toBeGreaterThan(10));

  it.each([
    // child_process.exec, pas RegExp.prototype.exec
    ['exec / execSync', /(?<![.\w$])exec(Sync)?\s*\(|import\s*{[^}]*\bexec(Sync)?\b[^}]*}\s*from\s*['"](node:)?child_process['"]/],
    ['shell: true', /shell\s*:\s*true/],
    ['sh -c / cmd /c', /['"](sh|bash|cmd(\.exe)?)['"]\s*,\s*\[\s*['"](-c|\/c)['"]/],
  ])('%s : absent', (_name, re) => {
    expect(all.filter(([, s]) => re.test(s)).map(([p]) => p)).toEqual([]);
  });
});
