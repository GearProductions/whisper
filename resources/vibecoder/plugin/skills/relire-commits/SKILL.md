---
name: relire-commits
description: "Review pull request <n> commit by commit — the four questions, duplication, file headers, a first commit holding note + forme + invariants — into <out>/pr-<n>-commits.md."
argument-hint: "<lang> <out> <n>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Bash(git show *), Bash(git diff *), Bash(git log *), Bash(git grep *), Bash(git ls-tree *)"
---

# Review the commits of a PR (guide §5.4, §5.1, §5.2)

The diff, commit by commit, before any summary.

`$ARGUMENTS` = `<lang> <out> <n>`. `lang`: the user's language, not used here — code-related work: the review and your answer in English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `n`: the PR number.

The PR is the branch of this folder (`HEAD`), checked out; its base is the `base` of `<out>/pr-<n>.json`. The commits: `git log --reverse --format='%h %s' origin/<base>..HEAD`, then `git show <hash>` for each. The note (under `docs/tickets/`, added or changed by the PR) and its « Forme »: the contract of each module. Also `AGENTS.md` and the guide (`docs/dev_guide/*.html`) §5, if present.

## For each commit

- The four questions (§5.1): out of its scope? a dependency added? I/O in a loop, an N+1, a blocking call? a read or write without the right scoping (tenant, user, folder; a path or an id from outside unchecked)?
- Duplication with code that already exists (`git grep <name> HEAD`): name it.
- File headers still true to the contract; no import breaking a « ne connaît pas ».
- Glue code and whatever touches rights or data: read in full. A generic module: judge it by its imports.
- The story (§5.2): the first commit holds the note, the forme and the red invariants; then one commit per module, with its variants and its contract in the message; no `wip`, `fix`, `retry` or `fixup!` commit; over ~400 lines, the module was too big; an invariant test changed after the first commit (they are protected) — say it.

## `<out>/pr-<n>-commits.md`, in English

One section per commit, in order, titled exactly `## <short hash> <subject>`; under it, list lines with the findings (`file:line` — what — why), or a single line saying it holds. A problem with the history itself (order, mixed modules, no first commit) goes under the commit concerned.

Change nothing. Answer in English, 1 to 3 lines: the commits read and the most serious finding.
