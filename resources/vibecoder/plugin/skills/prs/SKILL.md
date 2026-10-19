---
name: prs
description: "List the pull requests of the repository where the user's review is requested, into <out>/prs.json."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Write, Bash(gh pr list *)"
---

# My PRs to review

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: your answer in English. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it).

Run exactly this, from the repository:

```bash
gh pr list --search "review-requested:@me" --json number,title,author,url --jq '[.[] | {number, title, author: .author.login, url}]' > "<out>/prs.json"
```

The file is a JSON array, `[]` when there is none. `gh` fails (not logged in, no GitHub remote) → write `[]` to `<out>/prs.json` and report the error.

Change nothing else. Answer in English, one line: how many PRs, or the error.
