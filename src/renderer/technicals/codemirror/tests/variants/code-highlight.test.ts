// Variants de la coloration CodeMirror (note 0.11.0) : chaque langage donne ses
// classes vc-cx-*, un fichier d'un autre langage reste en texte.
import { ensureSyntaxTree, highlightingFor } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { highlightTree } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';
import { codeHighlight, languageFor } from 'technicals/codemirror';

// Les morceaux colorés du code : [texte, classe].
function spans(code: string, path: string): [string, string][] {
  const state = EditorState.create({ doc: code, extensions: [languageFor(path), codeHighlight] });
  const tree = ensureSyntaxTree(state, code.length, 5000);
  if (!tree) return [];
  const out: [string, string][] = [];
  highlightTree(tree, { style: (tags) => highlightingFor(state, tags) }, (from, to, cls) => out.push([code.slice(from, to), cls]));
  return out;
}
const classOf = (code: string, path: string, text: string) => spans(code, path).find(([s]) => s === text)?.[1];

describe('codemirror — coloration', () => {
  const TS = `// fin\nexport function add(a: number): Mur { return run("x", 42, true, null); }\n@deco class Mur {}`;
  it.each(['a.ts', 'a.tsx', 'a.mts', 'a.cts'])('TypeScript (%s)', (path) => {
    expect(classOf(TS, path, '// fin')).toBe('vc-cx-comment');
    expect(classOf(TS, path, 'function')).toBe('vc-cx-keyword');
    expect(classOf(TS, path, 'add')).toBe('vc-cx-function');
    expect(classOf(TS, path, 'run')).toBe('vc-cx-function');
    expect(classOf(TS, path, 'Mur')).toBe('vc-cx-type');
    expect(classOf(TS, path, '"x"')).toBe('vc-cx-string');
    expect(classOf(TS, path, '42')).toBe('vc-cx-constant');
    expect(classOf(TS, path, 'true')).toBe('vc-cx-constant');
    expect(classOf(TS, path, '@')).toBe('vc-cx-attr');
  });

  it.each(['a.js', 'a.jsx', 'A.MJS', 'a.cjs'])('JavaScript (%s)', (path) => {
    expect(classOf('const s = `x`; f(1);', path, 'const')).toBe('vc-cx-keyword');
    expect(classOf('const s = `x`; f(1);', path, '`x`')).toBe('vc-cx-string');
    expect(classOf('const s = `x`; f(1);', path, 'f')).toBe('vc-cx-function');
  });

  it('Rust : macros et durées de vie en attribut', () => {
    const rs = `fn f<'a>(x: &'a str) -> u8 { println!("x"); 1 }`;
    expect(classOf(rs, 'lib.rs', 'fn')).toBe('vc-cx-keyword');
    expect(classOf(rs, 'lib.rs', 'f')).toBe('vc-cx-function');
    expect(classOf(rs, 'lib.rs', "'a")).toBe('vc-cx-attr');
    expect(classOf(rs, 'lib.rs', 'println')).toBe('vc-cx-attr');
    expect(classOf(rs, 'lib.rs', '"x"')).toBe('vc-cx-string');
    expect(classOf(rs, 'lib.rs', '1')).toBe('vc-cx-constant');
  });

  it('Python', () => {
    const py = `# c\ndef f(x):\n    return None`;
    expect(classOf(py, 't.py', '# c')).toBe('vc-cx-comment');
    expect(classOf(py, 't.py', 'def')).toBe('vc-cx-keyword');
    expect(classOf(py, 't.py', 'f')).toBe('vc-cx-function');
    expect(classOf(py, 't.py', 'None')).toBe('vc-cx-constant');
  });

  it('Go', () => {
    const go = `func main() { var n int = 3; run("x") }`;
    expect(classOf(go, 'm.go', 'func')).toBe('vc-cx-keyword');
    expect(classOf(go, 'm.go', 'main')).toBe('vc-cx-function');
    expect(classOf(go, 'm.go', 'int')).toBe('vc-cx-type');
    expect(classOf(go, 'm.go', '"x"')).toBe('vc-cx-string');
  });

  it.each(['notes.md', 'Makefile', 'a.txt', 'a.ts.bak'])('un autre (%s) : en texte, sans classe', (path) => {
    expect(languageFor(path)).toEqual([]);
    expect(spans('function f() { return "x"; }', path)).toEqual([]);
  });
});
