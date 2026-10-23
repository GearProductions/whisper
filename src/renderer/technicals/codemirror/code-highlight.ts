/** code-highlight — les réglages CodeMirror de la coloration du code :
 *  languageFor (le langage d'un fichier d'après son extension : TypeScript /
 *  JavaScript, Rust, Python, Go ; un autre : en texte) et codeHighlight (les
 *  jetons Lezer vers les classes vc-cx-*, dont la palette vit dans vibecoder.css).
 *  Ne connaît pas : React, le pont, le métier.
 *  Utilisé par : app/panel/vibecoder (code-view). */

import { go } from '@codemirror/lang-go';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tagHighlighter, tags as t } from '@lezer/highlight';

const BY_EXT: Record<string, () => Extension> = {
  js: () => javascript(), mjs: () => javascript(), cjs: () => javascript(),
  jsx: () => javascript({ jsx: true }),
  ts: () => javascript({ typescript: true }), mts: () => javascript({ typescript: true }), cts: () => javascript({ typescript: true }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  rs: rust, py: python, go,
};

// Le langage d'un chemin d'après son extension ; inconnu : [] (en texte).
export const languageFor = (path: string): Extension =>
  BY_EXT[/\.([A-Za-z]+)$/.exec(path)?.[1].toLowerCase() ?? '']?.() ?? [];

// Un jeton prend la classe du tag le plus précis qui le désigne (function(definition(variableName)) → function).
export const codeHighlight: Extension = syntaxHighlighting(tagHighlighter([
  { tag: [t.keyword, t.self], class: 'vc-cx-keyword' },
  { tag: [t.string, t.regexp], class: 'vc-cx-string' },
  { tag: t.comment, class: 'vc-cx-comment' },
  { tag: [t.number, t.bool, t.null, t.atom, t.constant(t.variableName)], class: 'vc-cx-constant' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'vc-cx-function' },
  { tag: [t.typeName, t.className], class: 'vc-cx-type' },
  { tag: [t.meta, t.annotation, t.macroName, t.special(t.variableName)], class: 'vc-cx-attr' },   // @, macro!, 'a
]));
