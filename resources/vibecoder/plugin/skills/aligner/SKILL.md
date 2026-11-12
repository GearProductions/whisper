---
name: aligner
description: "Check the invariants only — every « → invariant » line of the note truly observed by a test, every invariant test tied to a line — and, in the creator's worktree, fix the tests (3 rounds at most); gaps left go to <out>/align.md. Followed by invariants (Create) in its own run, after the red tests. In a PR (HEAD): a list, nothing fixed."
argument-hint: "<lang> <out> <ref>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Edit, Bash(git symbolic-ref *), Bash(git rev-parse *), Bash(git diff *), Bash(git ls-files *)"
---

# Align — note ↔ invariant tests, nothing else

`$ARGUMENTS` = `<lang> <out> <ref>`. `lang`: the user's language (`fr`, `en`…): `align.md` in it — the user reads it closely (note 0.15.0-stabilisation, as `ponytail.md`); your answer in English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `ref`:
- `WORKTREE` (the creator): the current branch, uncommitted and untracked files included. Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists (`git rev-parse --verify -q <ref>`); range `<base>...HEAD`. You **fix** the tests.
- `HEAD` (the reviewer): a pull request, checked out in this folder — read its files in the folder; base = `base` of the `<out>/pr-<n>.json` whose `head` is the current branch (`git rev-parse --abbrev-ref HEAD`; on a `pr-<n>` branch, that `<n>`); none → as for `WORKTREE`; range `origin/<base>...HEAD`. You **list only**: touch no file of the branch, run no command that writes (T-19); `align.md` is the one file you write.

Read, with the Read, Glob and Grep tools: the note (under `docs/tickets/`, named like the branch, or the one the range adds or changes) — its « Ce que ça ne doit pas faire » only; the invariant tests the range adds or changes (`git diff --name-only <range>`, for `WORKTREE` `git diff --name-only <base>` and `git ls-files --others --exclude-standard`; `tests/invariants/` folders, or where `AGENTS.md`, if present, puts them); the project's list of invariants, if any (e.g. `SPEC.md`); the guide (`docs/dev_guide/*.html`) §3.1 to §3.5, if present. Not the forme, not the code: the invariants are written from the note, the modules come later.

## 1. The list, first — exhaustive

Before judging anything, write the list, both ways, from the note and from the files (not from memory, not by sampling):
- every `→ invariant` line of the note → its test(s), or « none »;
- every test of every invariant file in the range → its note line or existing project invariant, or « none ».

The list is complete when no line and no test is left out. Then, and only then, check each entry.

## 2. Two checks, no more

- The test **truly observes** its line: the real system, an assertion on the property itself (a relation, an absence, a bound), the cases the line implies. A test that would still pass with the property broken counts as missing.
- The test is **tied**: to a note line or to an existing invariant of the project. A test without one → the note lacks a line, or the test is a variant.

Not checked, never reported: the forme and the files' headers, whether a line should be an invariant or a variant, the code. A line or a test that waits for a module not generated yet (the code is missing, red for that reason) is not a gap.

## 3. `WORKTREE`: fix, check again — 3 rounds at most

Gaps found → fix them yourself, in the tests only, by the rules of `${CLAUDE_SKILL_DIR}/../invariants/SKILL.md` (« Rules »: from the note, the real system, one test per case, comments, a relation rather than a value, protected files, no background command); the tests stay red, for the right reason (the code is missing, not a mistake of the test). Then redo the list and the two checks on what you changed and on what it touches: that is one round. **3 rounds at most**, in Vibe mode or not; gaps still there after the third → stop, no more fixes.

Never fixed by you, whatever the round: the note (« Ce que ça fait », « Ce que ça ne doit pas faire », « Où ça casse », a label `→ invariant`…), the forme, the code. A gap only they can close is `[toi]`: leave it, don't spend a round on it.

## `<out>/align.md`, in `lang`

Rewritten after each check; at the end, only what stands. One `##` per gap, its title naming the item (the note line, the test), **starting with its label**: `## [toi] …` or `## [agent] …`; under it, 1 to 3 lines: what is off, where (`file:line`), what to change. Most serious first. The page reads each title as a section: keep `##` and the label at the start of the title.
- `[toi]`: needs the user's decision — a change of contract (what the note does or must not do, an invariant label), or a note that makes a test impossible to write. Nothing else is `[toi]`: a gap in a test is `[agent]`.
- `[agent]`: the rest — a gap in a test that you could fix but did not (3 rounds spent). Never a gap you fixed: it is not listed.
- `HEAD`: the same list, **no label**, nothing fixed, the gaps in the same words.

Code names, paths and test titles stay as they are; the rest in `lang`, in plain words a developer who does not know the invariants by heart understands (say what a rule means, never a bare number). Nothing off → a single line without a title, « Aligned. » (`en`) or « Aligné. » (`fr`), followed by what you checked (lines and tests counted; `WORKTREE`: how many gaps fixed, in how many rounds), in `lang`. Write nothing else, anywhere (`HEAD`: nothing else in the folder at all).

Answer in English, 1 to 3 lines: the number of gaps fixed and the number left, and the most serious one left.
