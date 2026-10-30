---
name: invariants
description: "Write the red invariant tests of the ticket from the note's « → invariant » lines, or from the pseudo-code given, in the project's language and test framework, then check the alignment (aligner, <out>/align.md) and fix the tests, 3 rounds at most, without committing."
argument-hint: "<lang> <out> [pseudo-code…]"
disable-model-invocation: true
context: fork
model: opus
effort: high
---

# Invariants — red, from the note (guide §3)

`$ARGUMENTS` = `<lang> <out> [pseudo-code…]`. `lang`: the user's language, not used here — code-related work: your answer in English. The tests follow the project's convention (`AGENTS.md`), else English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces): only `align.md` is written there. Pseudo-code: optional, written by the developer — when given, it is the test to write, every case and every assertion of it, translated into the project's language and test framework.

## Read first

- The note: under `docs/tickets/`, the file named like the branch (`<type>/<name>` → `docs/tickets/<type>/<name>.md`), else the one the branch adds or changes. Its « Ce que ça ne doit pas faire » lines marked `→ invariant` are the tests to write (one already covered by an existing test → skip it, say so). Its « Forme »: the names and signatures to call.
- `AGENTS.md`, if present: where invariants live, how they are written (e.g. an « Écrire un invariant » section), the language of code and comments, the test commands, the protected folders.
- The guide (`docs/dev_guide/*.html`) §3.1 to §3.6, if present.
- Two or three existing invariant tests: their style, harness and helpers — reuse them.

## Rules — the developer checks every one

- From the note, not from the code: never read an implementation to shape a test. The test states the property.
- Never mock the system under test: the real thing for what belongs to the system (real files, real processes, real database, real IPC); a fake server only for what is external (a third-party API, a model server). A pure function is simply called.
- One test per case, even if it means repeating code (« quitte à répéter »): no loop or hidden table over cases (a table only if `AGENTS.md` allows it, one commented line per entry).
- A one-line comment before each edge case and before each assertion: what it checks, in plain words.
- A relation, an absence or a bound rather than a value: `toEqual(other)`, `not.toContain(secret)`, `toBeLessThan(limit)`. The number lives in config; the test runs with a small limit (§3.3).
- Titles are sentences (an `it` title; a Rust fn name such as `a_token_is_never_logged`). Setup, action and checks separated by a blank line; explicit names; one assertion per fact.
- Where: the module's `tests/invariants/` folder, or what `AGENTS.md` says; cross-module ones in the root `tests/invariants/`. File header: what it guards (the note line, the project's invariant id such as `I-12`), and that it is protected: if it fails, fix the code.
- The code does not exist yet → only the skeleton the test needs to compile: the Forme's signatures with their file header, bodies that fail (`throw new Error('not implemented')`, `todo!()`, `raise NotImplementedError`). No implementation. In a compiled language, never leave the test suite uncompilable.
- Apply the `ponytail` skill (`.claude/skills/ponytail/SKILL.md`, else `~/.claude/skills/ponytail/SKILL.md`) to helpers and harness — reuse, no new dependency — never to the cases.
- Existing invariant files are protected: change one only if the note changes that invariant, and say so.
- Nothing in the background: this run ends when you answer, and a command still running is lost. Never set `run_in_background`, never end the `Bash` command with `&`, never answer « still running ». A long command (the mutants, a full test run) runs in the foreground, in batches that each fit under Bash's maximum timeout (600000 ms): split by file or by mutant, run the batches one after the other. What did not run (batches left, mutants not tried) is named in the answer, never implied.

## Then

Run the project's invariant command (else its test command on your files). Every new test must fail — on its assertion or on its call to the missing code, never on a mistake of its own (syntax, import path, helper). A test that already passes → check it really observes the property, and say so. Commit nothing.

## Then, the alignment — in this same run

Read `${CLAUDE_SKILL_DIR}/../aligner/SKILL.md` and follow it with `<lang> <out> WORKTREE`: it writes `<out>/align.md`. The modules come at a later step: a Forme module not written yet is not a gap here.

- « Aligned. » → done.
- Gaps → fix the invariant tests (same rules as above; still red), then follow the aligner again: it rewrites `align.md`. **3 rounds of fixes at most.** Gaps still there after the third → stop: no more fixes.
- A gap only the note or the forme can close (a missing line, a module that doesn't match): not yours — leave it in `align.md`, don't spend a round on it.

Answer in English, 1 to 3 lines: the files, the number of cases, red confirmed (or what passes and why), the alignment — « Aligned. » after how many rounds, or the gaps that remain — and what did not run, if anything (rule « Nothing in the background »).
