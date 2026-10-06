// Invariant (SPEC I-27) : aucun programme n'est lancé par un shell. Chemins,
// texte dicté, commande d'un agent ne sont jamais interprétés : execFile et
// spawn, avec des arguments. Protégé : si ce test échoue, corriger le code.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): [string, string][] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'tests' ? [] : sources(p);
    return /\.tsx?$/.test(n) ? [[p, readFileSync(p, 'utf8')] as [string, string]] : [];
  });
}

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
