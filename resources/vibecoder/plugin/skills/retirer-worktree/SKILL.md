---
name: retirer-worktree
description: "Remove the worktree of pull request <n> recorded in <out>/pr-<n>-worktree.json, refusing if it has uncommitted changes, then delete that file."
argument-hint: "<lang> <out> <n>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Read, Bash(git worktree list *), Bash(git worktree remove *), Bash(git -C * status *), Bash(rm *)"
---

# Remove a PR's worktree

`$ARGUMENTS` = `<lang> <out> <n>`. `lang`: the user's language, not used here — code-related work: your answer in English. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it). `n`: the PR number, a positive integer — anything else → say so and stop.

1. Read `<out>/pr-<n>-worktree.json`: `{ "dir": …, "branch": … }`. Missing → say « no worktree recorded for #<n> », stop.
2. `dir` is not listed by `git worktree list --porcelain` (already gone) → go to step 4.
3. `git -C "<dir>" status --porcelain`: any line (changes, untracked files) → say so, list them briefly, and stop: nothing is removed, the file stays. Otherwise `git worktree remove "<dir>"` (never `--force`). It fails → report the error, stop.
4. `rm "<out>/pr-<n>-worktree.json"` (the app then removes the PR's robot).

Keep the branch and `refs/vibecoder/pr/<n>`; never touch the main working copy.

Answer in English, one line: the worktree removed, or why not.
