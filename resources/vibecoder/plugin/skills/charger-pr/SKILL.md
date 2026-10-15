---
name: charger-pr
description: "Fetch pull request <n> into the local ref refs/vibecoder/pr/<n> without touching the working copy, and write its details to <out>/pr-<n>.json."
argument-hint: "<lang> <out> <n>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Read, Bash(gh pr view *), Bash(git fetch origin *)"
---

# Load a PR for review — the working copy is never touched

`$ARGUMENTS` = `<lang> <out> <n>`. `lang`: language of your answer. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it). `n`: the PR number, a positive integer — anything else → say so and stop.

1. The details:
   ```bash
   gh pr view <n> --json number,title,url,author,baseRefName,headRefName,body --jq '{number, title, url, author: .author.login, base: .baseRefName, head: .headRefName, body}' > "<out>/pr-<n>.json"
   ```
   It fails → report the error, stop.
2. The code, with `<base>` = the `base` of the file just written (this also updates `origin/<base>`):
   ```bash
   git fetch origin +pull/<n>/head:refs/vibecoder/pr/<n> <base>
   ```

Nothing else: no checkout, switch, merge, pull, worktree or stash.

Answer in `lang`, one line: `#<n> <title>` (`<head>` → `<base>`), or the error.
