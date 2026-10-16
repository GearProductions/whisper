// Variants de la coloration du code d'un test (note 0.8.0, rc.10 : « Code » et
// « Voir le fichier ») : chaque langage, et les morceaux qui redonnent le code.
import { describe, expect, it } from 'vitest';
import { codeLines, codeTokens, type CodeKind } from 'core/vibecoder';

// Les morceaux d'un genre, dans l'ordre.
const of = (code: string, path: string, kind: CodeKind) => codeTokens(code, path).filter((t) => t.kind === kind).map((t) => t.text);
const joined = (code: string, path: string) => codeTokens(code, path).map((t) => t.text).join('');

const TS = `import { it, expect } from 'vitest';
/* bloc
   sur deux lignes */
// Un test : l'apostrophe d'un commentaire n'ouvre rien
it("refuse", async () => {
  const n: number = 0x1F + 1_000 + 2.5e3;
  expect(await run(\`a \${n}\`)).toBe(null); // fin
});
export class Mur implements Porte { readonly MAX = 3; }
`;

const RS = `#[cfg(test)]
mod tests {
    use super::*;
    /// doc
    #[test]
    fn refuse<'a>(x: &'a str) -> Result<(), String> {
        let c = 'x'; let e = '\\n'; let b = b'a';
        let raw = r#"un "guillemet" dedans"#;
        assert_eq!(parse("1"), Some(1u32));
        println!("{}", x != "y");
        Ok(())
    }
}
`;

const PY = `@pytest.mark.parametrize("x", [1, 2])
def test_refuse(x):
    """Une docstring
    sur deux lignes."""
    s = f"{x}" + r'\\d' + 'it\\'s'  # commentaire
    assert MyError is not None and x > 0.5
`;

const GO = 'package main\n\n// Commentaire\nfunc TestRefuse(t *testing.T) {\n\tvar r rune = \'x\'\n\ts := `brut\nsur deux lignes`\n\tif err != nil { t.Fatal("non", 42) }\n}\n';

describe('les morceaux redonnent le code tel quel', () => {
  it.each([['a.test.ts', TS], ['lib.rs', RS], ['test_a.py', PY], ['a_test.go', GO], ['a.txt', TS], ['b.tsx', '']])('%s', (path, code) => {
    expect(joined(code, path)).toBe(code);
    expect(codeLines(code, path).map((l) => l.map((t) => t.text).join('')).join('\n')).toBe(code);
    expect(codeLines(code, path).length).toBe(code.split('\n').length);
  });

  it('un code tronqué (chaîne, commentaire ou r#" non fermés) aussi', () => {
    for (const [code, path] of [['"abc', 'a.ts'], ['/* abc', 'a.ts'], ['r#"abc', 'a.rs'], ['"""abc', 'a.py'], ['`abc', 'a.go'], ["'", 'a.rs']]) {
      expect(joined(code, path)).toBe(code);
    }
  });
});

describe('TypeScript, JavaScript', () => {
  it('mots-clés, chaînes, commentaires, nombres, fonctions, types', () => {
    expect(of(TS, 'a.ts', 'keyword')).toEqual(['import', 'from', 'async', 'const', 'await', 'export', 'class', 'implements', 'readonly']);
    expect(of(TS, 'a.ts', 'string')).toEqual(["'vitest'", '"refuse"', '`a ${n}`']);
    expect(of(TS, 'a.ts', 'comment')).toEqual(['/* bloc\n   sur deux lignes */', '// Un test : l\'apostrophe d\'un commentaire n\'ouvre rien', '// fin']);
    expect(of(TS, 'a.ts', 'constant')).toEqual(['0x1F', '1_000', '2.5e3', 'null', 'MAX', '3']);
    expect(of(TS, 'a.ts', 'function')).toEqual(['it', 'expect', 'run', 'toBe']);
    expect(of(TS, 'a.ts', 'type')).toEqual(['number', 'Mur', 'Porte']);
  });

  it('jsx, mjs, cjs, mts : le même langage', () => {
    for (const ext of ['js', 'jsx', 'mjs', 'cjs', 'mts', 'tsx']) expect(of('const a = 1;', `x.${ext}`, 'keyword')).toEqual(['const']);
  });
});

describe('Rust', () => {
  it('attributs #[…], macros nom!, durées de vie \'a', () => {
    expect(of(RS, 'a.rs', 'attr')).toEqual(['#[cfg(test)]', '#[test]', "'a", "'a", 'assert_eq!', 'println!']);
  });

  it('caractères, octets, chaînes brutes r#"…"# (guillemets dedans)', () => {
    expect(of(RS, 'a.rs', 'string')).toEqual(["'x'", "'\\n'", "b'a'", 'r#"un "guillemet" dedans"#', '"1"', '"{}"', '"y"']);
  });

  it('mots-clés, fonctions (déclarée, appelées), types, nombres à suffixe', () => {
    expect(of(RS, 'a.rs', 'keyword')).toEqual(['mod', 'use', 'super', 'fn', 'let', 'let', 'let', 'let']);
    expect(of(RS, 'a.rs', 'function')).toEqual(['refuse', 'parse', 'Some', 'Ok']);
    expect(of(RS, 'a.rs', 'type')).toEqual(['str', 'Result', 'String']);
    expect(of(RS, 'a.rs', 'constant')).toEqual(['1u32']);
    expect(of(RS, 'a.rs', 'comment')).toEqual(['/// doc']);
  });
});

describe('Python', () => {
  it('décorateurs, triples guillemets, préfixes f et r, commentaires #', () => {
    expect(of(PY, 'a.py', 'attr')).toEqual(['@pytest.mark.parametrize']);
    expect(of(PY, 'a.py', 'string')).toEqual(['"x"', '"""Une docstring\n    sur deux lignes."""', 'f"{x}"', "r'\\d'", "'it\\'s'"]);
    expect(of(PY, 'a.py', 'comment')).toEqual(['# commentaire']);
  });

  it('mots-clés, constantes, fonction déclarée, types', () => {
    expect(of(PY, 'a.py', 'keyword')).toEqual(['def', 'assert', 'is', 'not', 'and']);
    expect(of(PY, 'a.py', 'constant')).toEqual(['1', '2', 'None', '0.5']);
    expect(of(PY, 'a.py', 'function')).toEqual(['test_refuse']);
    expect(of(PY, 'a.py', 'type')).toEqual(['MyError']);
  });
});

describe('Go', () => {
  it('chaînes brutes `…` sur plusieurs lignes, runes, mots-clés, nil, fonctions (une majuscule aussi), types', () => {
    expect(of(GO, 'a.go', 'string')).toEqual(["'x'", '`brut\nsur deux lignes`', '"non"']);
    expect(of(GO, 'a.go', 'keyword')).toEqual(['package', 'func', 'var', 'if']);
    expect(of(GO, 'a.go', 'constant')).toEqual(['nil', '42']);
    expect(of(GO, 'a.go', 'function')).toEqual(['TestRefuse', 'Fatal']);
    expect(of(GO, 'a.go', 'type')).toEqual(['T', 'rune']);
  });
});

describe('un langage inconnu', () => {
  it('tout en texte', () => {
    expect(codeTokens('fn x() { "a" }', 'notes.md')).toEqual([{ kind: 'text', text: 'fn x() { "a" }' }]);
    expect(codeTokens('x', 'Makefile')).toEqual([{ kind: 'text', text: 'x' }]);
  });
});
