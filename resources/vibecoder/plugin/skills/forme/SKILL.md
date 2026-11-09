---
name: forme
description: "Lay down the « Forme » section of the ticket note — modules, signatures, what each exposes, does not know and is used by, and its variants (test file and cases) — without writing any code."
argument-hint: "<lang> <out> [details…]"
disable-model-invocation: true
---

# Forme — modules and boundaries (guide §2, A.2)

`$ARGUMENTS` = `<lang> <out> [details…]`. `lang`: the user's language — of your answer and of the contracts' prose; module names, paths and signatures in English (or the project's convention). `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`): nothing to write there. Details: optional instructions from the user (names, signatures, a split) — they win over your choices.

The note: under `docs/tickets/`, the file named like the branch (`<type>/<name>` → `docs/tickets/<type>/<name>.md`), else the one the branch adds or changes. None → say so and stop.

Read first: the note; `AGENTS.md` if present (layers, module layout, naming, barrels, imports); the guide's §2 « La forme : dans la note et en tête des fichiers », §4.1 and A.2 if the repo has it (`docs/dev_guide/*.html`); the « Forme » of the project's previous notes (their layout); the code the note touches (`Grep`, `Glob`): reuse what exists before creating a module.

## Write the « Forme » section — in the note only

- One entry per module created or whose boundary changes: its path, then its contract — what it exposes (names and typed signatures), what it does not know, who uses it. This contract is also the header the file will carry (A.2); an existing file whose boundary changes → say its header changes.
- A fenced block, one module per entry, written to be read by a person, not packed: the path at the start of the line (relative to the repo root, or as previous notes write it), two spaces, the start of the contract; the rest on continuation lines indented by 4 spaces (not aligned under the contract, so lines stay short: about 80 characters, never a column of text pushed to the right), one idea per line (what it exposes, each signature on its own line; « ne connaît pas : … »; « utilisé par : … »); **a blank line between two entries**. A continuation line never starts with a path (under a folder entry it would be read as a module). The screen reads the modules from this layout.
- Modules that only compile together (one imports a constant of the other, a screen needs its executor): one entry, their paths at the head of the line separated by ` + ` (one space each side), then the contract after two spaces or more; one commit.
- Under each contract, its variants (guide §3.4), the first thing its developer writes, red, before the code: a continuation line `variants : <path>` — its ordinary test file, existing or `(à créer)`, where and as the project keeps them (e.g. `tests/variants/<name>.test.ts` beside the module) — then the cases to cover, one per line, `- <case>`, each starting with a word, never with a path (under a folder entry, a line starting with a path is read as a module). Nothing to test (docs, a skill's text, data a test of another module checks) → `variants : aucun`, and why in a few words. The user challenges their place and their cases with the contract.
- Each path checked: it exists, or the entry says `(à créer)`.
- Order = generation and commit order: pure functions → orchestration → routes / IPC → UI → glue and doc (§4.1). Small modules: a few hundred lines each, one commit each.
- The project's architecture rules hold; a module that would break one → say so in your answer instead.
- No code, no file created or changed besides the note. The developer names the modules (§2): a name or a split you are unsure of → write your best choice and ask in your answer.

## Answer

In `lang`, 1 to 3 lines: the modules (count, in order), then your questions if any.

Each question: one or two sentences of plain context first; the user's words, what they see or do; a number (I-xx, T-xx, F-xx), a function or a file name never alone, always with what it designates; options understandable without the code, the recommended one marked « (recommandé) » with its reason in a few words.
