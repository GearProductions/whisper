/** syntax — la coloration du code d'origine d'un test (Code, Voir le fichier),
 *  d'après l'extension de son fichier : TypeScript / JavaScript, Rust, Python,
 *  Go ; un autre : en texte. Mots-clés, chaînes, commentaires, nombres et
 *  constantes, fonctions (appelées ou déclarées), types (une majuscule, les
 *  types du langage), attributs (Rust #[…], macros nom! et durées de vie 'a ;
 *  décorateurs @).
 *  Les morceaux, bout à bout, redonnent le code tel quel ; codeLines les range
 *  par ligne (un commentaire ou une chaîne sur plusieurs lignes est coupé).
 *  Ne connaît pas : le DOM, React (des morceaux, jamais du HTML : I-40), la
 *  coloration du pseudo-code (highlight).
 *  Utilisé par : app/panel/vibecoder (invariants). */

export type CodeKind = 'keyword' | 'string' | 'comment' | 'constant' | 'function' | 'type' | 'attr' | 'text';
export type CodeToken = { kind: CodeKind; text: string };
type Lang = { token: RegExp; keywords: Set<string>; constants: Set<string>; types: Set<string>; declare: Set<string> };

const words = (s: string) => new Set(s.split(' '));
const NUMBER = String.raw`\b(?:0[xXbBoO][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)\w*`;
const WORD = String.raw`[\p{L}_$][\p{L}\p{N}_$]*`;
const C_COMMENT = String.raw`\/\/.*|\/\*[\s\S]*?(?:\*\/|$)`;
const LINE_STRING = (q: string) => `${q}(?:\\\\.|[^${q}\\\\\\n])*${q}?`;   // jusqu'à la fin de la ligne si elle n'est pas fermée
// Un morceau : commentaire, chaîne, attribut, nombre, mot — dans cet ordre ; entre eux, du texte.
const tokenRe = (comment: string, string: string, attr: string) =>
  new RegExp(`(?<comment>${comment})|(?<string>${string})|(?<attr>${attr})|(?<number>${NUMBER})|(?<word>${WORD})`, 'gu');

const JS: Lang = {
  token: tokenRe(C_COMMENT, `${LINE_STRING("'")}|${LINE_STRING('"')}|\`(?:\\\\[\\s\\S]|[^\`\\\\])*\`?`, '@[\\p{L}_$][\\p{L}\\p{N}_$]*'),
  keywords: words('break case catch class const continue debugger default delete do else export extends finally for from function '
    + 'if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await '
    + 'as type interface enum implements declare readonly keyof satisfies namespace abstract private protected public'),
  constants: words('true false null undefined NaN Infinity'),
  types: words('string number boolean bigint symbol any unknown never object'),
  declare: words('function class interface type enum'),
};

const RUST: Lang = {
  token: tokenRe(C_COMMENT,
    // brute (r#"…"#, autant de # pour fermer), octets ou texte "…" (sur plusieurs lignes), caractère 'a' '\n' '\u{…}'
    String.raw`(?<![\p{L}\p{N}_])b?r(?<hashes>#*)"[\s\S]*?(?:"\k<hashes>|$)|(?<![\p{L}\p{N}_])b?"(?:\\[\s\S]|[^"\\])*"?|(?<![\p{L}\p{N}_])b?'(?:\\(?:u\{[\da-fA-F]*\}|x[\da-fA-F]{2}|.)|[^'\\\n])'`,
    // #[…] #![…] (un niveau de crochets dedans), une macro nom!, une durée de vie 'a
    String.raw`#!?\[(?:[^\[\]\n]|\[[^\]\n]*\])*\]?|[\p{L}_][\p{L}\p{N}_]*!(?!=)|'[\p{L}_][\p{L}\p{N}_]*`),
  keywords: words('as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub '
    + 'ref return self Self static struct super trait type unsafe use where while'),
  constants: words('true false'),
  types: words('i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str'),
  declare: words('fn struct enum trait type'),
};

const PYTHON: Lang = {
  token: tokenRe('#.*',
    String.raw`(?<![\p{L}\p{N}_])[rRbBuUfF]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|${LINE_STRING('"')}|${LINE_STRING("'")})`,
    String.raw`@[\p{L}_][\p{L}\p{N}_.]*`),
  keywords: words('and as assert async await break class continue def del elif else except finally for from global if import in is '
    + 'lambda nonlocal not or pass raise return try while with yield match case'),
  constants: words('True False None self cls'),
  types: words('int float str bool bytes list dict set tuple object'),
  declare: words('def class'),
};

const GO: Lang = {
  token: tokenRe(C_COMMENT, `${LINE_STRING('"')}|${LINE_STRING("'")}|\`[^\`]*\`?`, '(?!)'),
  keywords: words('break case chan const continue default defer else fallthrough for func go goto if import interface map package '
    + 'range return select struct switch type var'),
  constants: words('true false nil iota'),
  types: words('bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 '
    + 'uint64 uintptr any'),
  declare: words('func type'),
};

const BY_EXT: Record<string, Lang> = { ts: JS, tsx: JS, js: JS, jsx: JS, mjs: JS, cjs: JS, mts: JS, cts: JS, rs: RUST, py: PYTHON, go: GO };

// Le langage d'un chemin d'après son extension ; null : inconnu (en texte).
const langOf = (path: string) => BY_EXT[/\.([A-Za-z]+)$/.exec(path)?.[1].toLowerCase() ?? ''] ?? null;

// Le code d'un fichier en morceaux colorés ; bout à bout, ils redonnent `code`.
export function codeTokens(code: string, path: string): CodeToken[] {
  const lang = langOf(path);
  if (!lang) return code ? [{ kind: 'text', text: code }] : [];
  const out: CodeToken[] = [];
  const push = (kind: CodeKind, text: string) => {
    const last = out[out.length - 1];
    if (kind === 'text' && last?.kind === 'text') last.text += text;
    else if (text) out.push({ kind, text });
  };
  let at = 0;
  let declaring = false;   // le mot d'avant déclare (fn, def, function…) : celui-ci est une fonction ou un type
  for (const m of code.matchAll(lang.token)) {
    push('text', code.slice(at, m.index));
    at = m.index + m[0].length;
    const g = m.groups!;
    const word = m[0];
    let kind: CodeKind = g.comment != null ? 'comment' : g.string != null ? 'string' : g.attr != null ? 'attr' : g.number != null ? 'constant' : 'text';
    if (g.word != null) {
      kind = lang.keywords.has(word) ? 'keyword'
        : lang.constants.has(word) || /^[A-Z][A-Z\d_]+$/.test(word) ? 'constant'
          : lang.types.has(word) ? 'type'
            : code[at] === '(' || (declaring && !/^[A-Z]/.test(word)) ? 'function'
              : /^[A-Z]/.test(word) ? 'type' : 'text';
      declaring = lang.declare.has(word);
    } else declaring = false;
    push(kind, word);
  }
  push('text', code.slice(at));
  return out;
}

// Les morceaux, ligne par ligne (autant de lignes que code.split('\n')).
export function codeLines(code: string, path: string): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  for (const t of codeTokens(code, path)) {
    t.text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ kind: t.kind, text: part });
    });
  }
  return lines;
}
