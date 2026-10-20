---
name: base
description: "Only if the branch's PR is merged: switch to the base branch, pull it and delete the merged local branch; otherwise say so and do nothing."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Bash(gh pr view *), Bash(git status *), Bash(git branch *), Bash(git switch *), Bash(git pull *), Bash(git log *), Bash(git rev-parse *)"
---

# Back to the base, once the PR is merged

Do it now, without asking: run the steps below on the current repository, then answer. This is your task; nothing else is coming.

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: your answer in English. `out`: nothing to write there.

1. The branch: `git branch --show-current`. Its PR: `gh pr view --json state,baseRefName,headRefOid`.
2. `state` is not `MERGED` (open, closed, no PR) → say so, do nothing else.
3. Tracked files with uncommitted changes (`git status --porcelain --untracked-files=no`) → say so, do nothing.
4. `git switch <baseRefName>`, then `git pull --ff-only`.
5. `git branch -d <branch>`. Refused as « not fully merged » (the PR was squashed or rebased) → `git branch -D <branch>` only if `git rev-parse <branch>` equals the PR's `headRefOid` (all its commits were in the merged PR); otherwise keep the branch and say why.

Never delete a remote branch; nothing else.

Answer in English, one line: the base and its last commit, the branch deleted or kept.
