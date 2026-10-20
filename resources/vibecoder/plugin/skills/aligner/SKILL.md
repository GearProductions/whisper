---
name: aligner
description: "Check that note, forme and invariant tests (and the code, if any) agree — every « → invariant » line truly observed by a test, every test tied to a line, the forme matching the files — and list the gaps in <out>/align.md. Also followed by invariants (Create), in its own run, after the red tests."
argument-hint: "<lang> <out> <ref>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Bash(git show *), Bash(git diff *), Bash(git log *), Bash(git status *), Bash(git ls-files *), Bash(git ls-tree *), Bash(git grep *), Bash(git rev-parse *), Bash(git symbolic-ref *), Bash(git merge-base *)"
---

# Align — note ↔ forme ↔ invariants (↔ code)

`$ARGUMENTS` = `<lang> <out> <ref>`. `lang`: the user's language, not used here — code-related work: `align.md` and your answer in English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `ref`:
- `WORKTREE`: the current branch, uncommitted and untracked files included. Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists; range `<base>...HEAD`.
- `refs/vibecoder/pr/<n>`: a pull request, never checked out — read with `git show <ref>:<path>`, search with `git grep <pattern> <ref>`; base = `base` in `<out>/pr-<n>.json`, range `origin/<base>...<ref>`.

Read: the note (under `docs/tickets/`, named like the branch, or the one the range adds or changes) — its « Ce que ça ne doit pas faire » and « Forme »; the invariant tests the range adds or changes (`tests/invariants/` folders, or where `AGENTS.md`, if present, puts them); the code of the Forme's modules, if it exists; the project's list of invariants, if any (e.g. `SPEC.md`); the guide (`docs/dev_guide/*.html`) §3.1 to §3.5, if present.

## Check

- Each `→ invariant` line has a test that **truly observes** it: the real system, an assertion on the property itself (a relation, an absence, a bound), the cases the line implies. A test that would still pass with the property broken counts as missing.
- Each invariant test is tied to a note line or to an existing invariant of the project. A test without one → the note lacks a line, or the test is a variant.
- Lines marked `→ invariant` that are not critical or are visible on screen (§3.2) — and the reverse.
- Forme ↔ files: each module's path exists or is created by the range; a file the range adds belongs to a module; each file header agrees with its contract (exposes, does not know, used by); no import breaks a « ne connaît pas ».
- The code, if any, does what « Ce que ça fait » says, and nothing the note excludes.

## `<out>/align.md`

One `##` per gap, its title naming the item (the note line, the test, the module); under it, 1 to 3 lines: what is off, where (`file:line`), what to change. Most serious first. Nothing off → a single line without a title, « Aligned. », followed by what you checked (counts). Write nothing else, anywhere.

Answer in English, 1 to 3 lines: the number of gaps and the most serious one.
