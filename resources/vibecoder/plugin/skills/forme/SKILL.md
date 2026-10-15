---
name: forme
description: "Lay down the « Forme » section of the ticket note — modules, signatures, what each exposes, does not know and is used by — without writing any code."
argument-hint: "<lang> <out> [details…]"
disable-model-invocation: true
---

# Forme — modules and boundaries (guide §2, A.2)

`$ARGUMENTS` = `<lang> <out> [details…]`. `lang`: language of your answer. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`): nothing to write there. Details: optional instructions from the user (names, signatures, a split) — they win over your choices.

The note: under `docs/tickets/`, the file named like the branch (`<type>/<name>` → `docs/tickets/<type>/<name>.md`), else the one the branch adds or changes. None → say so and stop.

Read first: the note; `AGENTS.md` if present (layers, module layout, naming, barrels, imports); the guide's §2 « La forme : dans la note et en tête des fichiers », §4.1 and A.2 if the repo has it (`docs/dev_guide/*.html`); the « Forme » of the project's previous notes (their layout); the code the note touches (`Grep`, `Glob`): reuse what exists before creating a module.

## Write the « Forme » section — in the note only

- One entry per module created or whose boundary changes: its path, then its contract — what it exposes (names and typed signatures), what it does not know, who uses it. This contract is also the header the file will carry (A.2); an existing file whose boundary changes → say its header changes.
- The layout of the previous notes, else a fenced block, one module per entry: the path at the start of the line (relative to the repo root, or as previous notes write it), two spaces or more, the contract; continuation lines indented under the contract. The screen reads the modules from this layout.
- Each path checked: it exists, or the entry says `(à créer)`.
- Order = generation and commit order: pure functions → orchestration → routes / IPC → UI → glue and doc (§4.1). Small modules: a few hundred lines each, one commit each.
- The project's architecture rules hold; a module that would break one → say so in your answer instead.
- No code, no file created or changed besides the note. The developer names the modules (§2): a name or a split you are unsure of → write your best choice and ask in your answer.

## Answer

In `lang`, 1 to 3 lines: the modules (count, in order), then your questions if any.
