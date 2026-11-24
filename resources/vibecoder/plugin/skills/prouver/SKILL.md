---
name: prouver
description: "Prove the invariants by mutation, in read mode: for each « → invariant » line of the note, break its rule in a copy of the code made outside the working folder, run its test alone — it must go red on an assertion — and write <out>/preuve.md, one section per line ([prouvé] with its mutant, or [toi]). Changes nothing in the project (the app checks the working folder and the index at the end)."
argument-hint: "<lang> <out> [note=<path>] [base=<ref>] [prefix…]"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Edit"
---

# Prove — a test that stays green protects nothing (note 0.16.0)

`$ARGUMENTS` = `<lang> <out> [note=<path>] [base=<ref>] [prefix…]`. `note=<path>` and `base=<ref>`: optional, given by the app right after `out` (an empty value, `base=` or `note=` alone, counts as not given); absent → the note is searched as below, the base as in `commiter-modules` § 1. `lang`: the language of `preuve.md` (the user reads it) and of its tags; your answer in English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `prefix`: everything after `out` and its named arguments, possibly empty — what the app puts before the project's commands (e.g. `distrobox enter dev --`): every typecheck and test command is `<prefix> <command>`, the command as `AGENTS.md` writes it, the prefix exactly as given, none of your own.

You are in read mode: nothing is written in the project, **ever**. Not by `Write` or `Edit` (the app refuses them), not by a command either — no `git add`, `checkout`, `stash`, `restore`…, no build, no formatter, no command run from the working folder that writes there. At the end the app compares the working folder and the index to their state at your start: one file that differs fails the run, names the file and deletes `preuve.md`. A mutation lives only in the copy.

## 1. The lines

The note: `note=` if given, else under `docs/tickets/` the file named like the branch, on the disk even if git ignores it, else the one the branch adds or changes. Its « Ce que ça ne doit pas faire » lines marked `→ invariant`, in order — their text exactly as the note writes it (bullet removed, the `→ invariant` label kept): the app finds a line by that text. None → write `<out>/preuve.md` as one line, « Rien à prouver. » (`en`: « Nothing to prove. »), and stop.

For each line, its test(s): the invariant test files (`AGENTS.md` says where; `tests/invariants/`) whose header or title names the line or its project invariant id. None found → the line is `[toi]`: no test observes it.

Each test file is new or earlier: it existed before the branch when `git cat-file -e <sha>:<path>` succeeds, `<sha>` = `git merge-base <base> HEAD` (one command per call). A case the branch added to an earlier file counts as earlier.

## 2. The copy

Its folder, `<tree>`: `<tmp>/tree`, `<tmp>` = what `printenv CLAUDE_CODE_TMPDIR` prints (the run's temporary folder: the app erases it when you end, however you end); empty → `<out>/prove-tree`, which you remove at the end with `rm -r`.

Make it by copying files, never by git: `git ls-files -z --cached --others --exclude-standard`, each file copied with its path (`xargs -0 cp --parents -t "<tree>"`; a file deleted in the working folder makes `cp` complain: ignore it). Then link each `node_modules` of the working folder at its place in the copy, never `install`: as `commiter-modules` § 3 step 3 (one `ln -s` per place that has one). Paths in double quotes (`<out>` may contain spaces). Every test and typecheck command runs from the copy, `cd "<tree>" && <prefix> <command>`, never from the working folder.

## 3. For each line — a mutant that counts

Once per test file of the line:

1. **Intact copy**: the test file alone, as `AGENTS.md` writes its test command with a file argument (none takes one: its invariant command). It must be green. Red → the line is `[toi]` (« red on the intact copy »: the modules are not complete, or the test is wrong).
2. **The mutant**: break the rule of the line in the code, in the copy, with `Edit` — the smallest change that makes the property false (a guard removed, a bound widened, a check skipped, a path no longer checked…). Never a change to a test.
3. **Typecheck**: the project's typecheck line of `AGENTS.md`, in the copy: it must pass. Red → this mutant is discarded.
4. **The test again**, on the mutant: it must go red **on an assertion** (`AssertionError`, `expected … to …`), not at load or start (import, syntax, type or `not implemented` error, timeout, crash). Green, or red for another reason → this mutant is discarded.
5. Put the original file back in the copy (copy it again from the working folder) before the next mutant.

A mutant discarded → another one, **3 at most** per line, each a different way to break the rule. One test file of the line going red on an assertion proves the line.

Foreground only: nothing in the background, no `&`, no `run_in_background`; each command under Bash's maximum (600000 ms), one test file per command. What did not run is named in your answer, never implied.

## 4. `<out>/preuve.md`, in `lang`

Written once, at the end, with `Write`; one `##` per line of the note, in its order, **the title starting with the tag then the line**: `## [prouvé] <line>` (`en`: `## [proved] <line>`) or `## [toi] <line>`. Nothing else is a tag; a title without one is not a proof.

- `[prouvé]`, then: the mutant (file:line of the copy, the change in one sentence), the test file and the assertion that failed, the typecheck green.
- `[toi]`, then why, in plain words: no test; red on the intact copy; no mutant that counts after 3 tries (what was tried); a test **stayed green** on a mutant that counts. For a test that stayed green, always say, in this order: the test file and « new » (the branch creates it) or « from before the branch » (it is protected: never corrected, whatever the cause), the rule the mutant broke **in the note's words**, and the mutant. `aligner` reads it to correct the test; the orchestrator reads it to know whether a correction is possible.

Nothing else written, anywhere: no other file in `out`, none in the project.

Answer in English, 1 to 3 lines: lines proved out of lines in the note, the `[toi]` ones with their reason in a few words, and what did not run.
