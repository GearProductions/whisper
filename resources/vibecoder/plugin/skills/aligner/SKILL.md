---
name: aligner
description: "Check the invariants only — every « → invariant » line of the note truly observed by a test, every invariant test tied to a line — and, in the creator's worktree, fix the tests (3 rounds at most); gaps left go to <out>/align.md, and which test guards which line to <out>/liens.md. Followed by invariants (Create) in its own run, after the red tests. In a PR (HEAD): a list and the links, nothing fixed, nothing written in the branch."
argument-hint: "<lang> <out> [base=<base>] <ref>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Edit"
---

# Align — note ↔ invariant tests, nothing else

`$ARGUMENTS` = `<lang> <out> [base=<base>] <ref>`. `base=<base>`: optional, the base branch, given by the app right after `out` (an empty value, `base=` or `note=` alone, counts as not given) (absent → the search below; the note is always searched). `lang`: the user's language (`fr`, `en`…): `align.md` in it — the user reads it closely (note 0.15.0-stabilisation, as `ponytail.md`); your answer in English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `ref`:
- `WORKTREE` (the creator): the current branch, uncommitted and untracked files included. Base: `base=` if given, else `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists (`git rev-parse --verify -q <ref>`); range `<base>...HEAD`. You **fix** the tests.
- `HEAD` (the reviewer): a pull request, checked out in this folder — read its files in the folder; base = `base` of the `<out>/pr-<n>.json` whose `head` is the current branch (`git rev-parse --abbrev-ref HEAD`; on a `pr-<n>` branch, that `<n>`); none → as for `WORKTREE`; range `origin/<base>...HEAD`. You **list only**: touch no file of the branch, run no command that writes (T-19); `align.md` and `liens.md`, both in `<out>`, are the only files you write.

Read, with the Read, Glob and Grep tools: the note (under `docs/tickets/`, named like the branch, on the disk even if git ignores it, else the one the range adds or changes) — its « Ce que ça ne doit pas faire » only; the invariant tests the range adds or changes (`git diff --name-only <range>`, for `WORKTREE` `git diff --name-only <base>` and `git ls-files --others --exclude-standard`; `tests/invariants/` folders, or where `AGENTS.md`, if present, puts them); the project's list of invariants, if any (e.g. `SPEC.md`); the guide (`docs/dev_guide/*.html`) §3.1 to §3.5, if present; `<out>/preuve.md`, if it exists (the proof of the invariants by mutation, skill `prouver`: a `## [toi]` section says a test stayed green, and the mutant that did not shake it). Not the forme, not the code: the invariants are written from the note, the modules come later.

When `preuve.md` names a test that stayed green, that test does not observe its line: the gap is the rule the mutant broke, said **in the note's words** — fix the test so that it observes that rule, never by reading the mutant's code to shape an assertion.

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

Never fixed by you, whatever the round: the note (« Ce que ça fait », « Ce que ça ne doit pas faire », « Où ça casse », a label `→ invariant`…), the forme, the code, and any invariant test file that existed before the branch (a case the branch added to such a file included): the app refuses you the write, and a command that changes one fails the run. A gap there is `[toi]`: leave it, don't spend a round on it. Only the invariant test files the branch creates are corrected.
A gap only the note, the forme or the code can close is `[toi]` too.

## `<out>/align.md`, in `lang`

Rewritten after each check; at the end, only what stands. One `##` per gap, its title naming the item (the note line, the test), **starting with its label**: `## [toi] …` or `## [agent] …`; under it, 1 to 3 lines: what is off, where (`file:line`), what to change. Most serious first. The page reads each title as a section: keep `##` and the label at the start of the title.
- `[toi]`: needs the user's decision — a change of contract (what the note does or must not do, an invariant label), a note that makes a test impossible to write, or a gap in a test file from before the branch (protected). Nothing else is `[toi]`: a gap in a test the branch creates is `[agent]`.
- `[agent]`: the rest — a gap in a test that you could fix but did not (3 rounds spent). Never a gap you fixed: it is not listed.
- `HEAD`: the same list, **no label**, nothing fixed, the gaps in the same words.

Code names, paths and test titles stay as they are; the rest in `lang`, in plain words a developer who does not know the invariants by heart understands (say what a rule means, never a bare number). Nothing off → a single line without a title, « Aligned. » (`en`) or « Aligné. » (`fr`), followed by what you checked (lines and tests counted; `WORKTREE`: how many gaps fixed, in how many rounds), in `lang`. Write nothing else, anywhere, but `liens.md` below (`HEAD`: nothing else in `<out>`, nothing in the branch).

## `<out>/liens.md` — which test guards which line (`WORKTREE` and `HEAD`)

The list of §1, as the screen reads it: it is what ranges each test under its rule on the user's screen. Without it, every `→ invariant` line shows « no test » at the pause where the user looks at the rules. Write it with the Write tool at the end, whole, whatever you found (aligned or not), from the final state of the tests — it is not a gap file, and it carries no label:

```markdown
## <the note line, copied as it is written, without its « → invariant » mark>
- <path of the test file, from the repo root> :: <title of the test>
- <path> :: <title>

## <the next line>
```

- One `##` per `→ invariant` line of the note, all of them, in the note's order. A line no test guards: its title alone, no bullet.
- Under it, every test tied to it: those the branch writes, and those of files from before the branch that already observe it (the screen names these without their code). A test tied to two lines goes under each. A test tied only to an existing invariant of the project (`I-…`), or to nothing, is not listed.
- The title: the literal one of its `it(…)` / `test(…)` (or the name of its `fn` / `def`), without the titles of the `describe` blocks around it.
- A title carried by several tests of the same file: the first is written as it is, the following with their order number in that file, from the second on: `<title> n° 2`, `<title> n° 3`… (a bare title carried by several tests ranges none of them on the screen).
- Copy the line and each title character for character — the screen matches them — never reworded, translated, shortened or wrapped.
- Nothing else in the file: no label, no comment, no summary.

`HEAD` (a PR): the same file, the same format, written in `<out>` only, never in the branch. The tests of files from before the PR count, as for `WORKTREE`; the PR's tests come from the range, the others from reading the invariant test files of the folder. Still nothing fixed.

Answer in English, 1 to 3 lines: the number of gaps fixed and the number left, and the most serious one left.
