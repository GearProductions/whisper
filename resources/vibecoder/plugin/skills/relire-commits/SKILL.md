---
name: relire-commits
description: "Review the code of pull request <n> in one pass over its whole diff — the four questions, duplication, the note and its Forme followed, bugs, file headers — into <out>/pr-<n>-commits.md, one `##` title per finding. The reviewer's read-only code review."
argument-hint: "<lang> <out> <n>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write"
---

# Review the code of a PR (guide §5.4, §5.1)

The whole diff, in one pass. Not the history of the commits.

`$ARGUMENTS` = `<lang> <out> <n>`. `lang`: the user's language, not used here — code-related work: the review and your answer in English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `n`: the PR number.

The PR is the branch of this folder (`HEAD`), checked out; its base is the `base` of `<out>/pr-<n>.json`. The diff: `git diff origin/<base>...HEAD` (the file list first: `git diff --stat origin/<base>...HEAD`), read in one pass, with `Read` on the files that need their context. The note (under `docs/tickets/`, named like the branch on the disk, else added or changed by the PR) and its « Forme »: the contract of each module. No note and `docs/tickets/` ignored here (`git check-ignore -q docs/tickets/x.md`): the author kept it out of the project, no reproach. Also `AGENTS.md` and the guide (`docs/dev_guide/*.html`) §5, if present.

## What to look for

- The four questions (§5.1): out of its scope? a dependency added? I/O in a loop, an N+1, a blocking call? a read or write without the right scoping (tenant, user, folder; a path or an id from outside unchecked)?
- Duplication with code that already exists (`git grep <name> HEAD`): name it.
- Does the code follow the note and its Forme: the signatures, what a module must not know, what it must not do.
- Bugs: wrong conditions, unhandled cases, races, errors swallowed.
- File headers still true to the contract; no import breaking a « ne connaît pas ».
- Glue code and whatever touches rights or data: read in full. A generic module: judge it by its imports.

Say nothing about the history of the commits (their order, the first commit, one commit per module, `wip` or `fix` commits, a file in the wrong commit, a module too big: the PR is squashed), nor about a protected test the PR changes (the app says it on that test) — except a protected test file the PR deletes, or a case it removes: the app says nothing there, name it as a finding.

## `<out>/pr-<n>-commits.md`, in English

One finding per `## <title>` heading (a short title naming the problem), in order of seriousness; under it, its detail: `file:line` — what — why, in a few lines. The page splits the findings on the `##` headings outside code blocks; a text before the first heading is an introduction, keep it to one line or none. No finding: a single line without a heading saying the code holds (e.g. « No finding. »), nothing else.

Change nothing. Answer in English, 1 to 3 lines: the number of findings and the most serious.
