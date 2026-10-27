---
name: charger-pr
description: "Write the details of pull request <n> to <out>/pr-<n>.json and fetch its branch and its base from origin, without touching the working copy: the app then offers to switch this folder to it."
argument-hint: "<lang> <out> <n>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Read, Bash(gh pr view *), Bash(git fetch origin *)"
---

# Load a PR for review — its details and its branch, the working copy untouched

`$ARGUMENTS` = `<lang> <out> <n>`. `lang`: the user's language, not used here — code-related work: your answer in English. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it). `n`: the PR number, a positive integer — anything else → say so and stop.

1. A PR from a fork does not load (its branch is not on `origin`):
   ```bash
   gh pr view <n> --json isCrossRepository --jq .isCrossRepository
   ```
   `true` → say `Refused: PR #<n> comes from a fork; only PRs whose branch is on origin load.`, stop. It fails → report the error, stop.
2. The details:
   ```bash
   gh pr view <n> --json number,title,url,author,baseRefName,headRefName,body,state --jq '{number, title, url, author: .author.login, base: .baseRefName, head: .headRefName, body, state}' > "<out>/pr-<n>.json"
   ```
   It fails → report the error, stop. `state` is `OPEN`, `CLOSED` or `MERGED`: a closed or merged PR still loads, but the screen offers nothing to review.
3. Its branch and its base, with `<head>` and `<base>` = the `head` and `base` of the file just written (this updates `origin/<head>` and `origin/<base>`):
   ```bash
   git fetch origin <head> <base>
   ```
   It fails → report the error, stop.

Nothing else: no checkout, switch, merge, pull, worktree or stash — the app offers the switch to the PR's branch, the user chooses.

Answer in English, one line: `#<n> <title>` (`<head>` → `<base>`, and its state unless `OPEN`), or the error.
