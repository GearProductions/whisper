---
name: publier-revue
description: "Publish the review draft of pull request <n> on GitHub, as is, with the chosen verdict, and record the result in <out>/pr-<n>-review.json."
argument-hint: "<lang> <out> <n> <approve|comment|request-changes>, blank line, <draft>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Write, Bash(mktemp *), Bash(gh pr review *), Bash(gh api *)"
---

# Publish the review

`$ARGUMENTS` = a first line `<lang> <out> <n> <verdict>`, a blank line, then the draft: everything after that blank line. `lang`: the user's language, not used here — code-related work: your answer in English. The draft is published as written. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it). `n`: a positive integer. `verdict`: `approve`, `comment` or `request-changes`. Anything else, or an empty draft → say so and publish nothing.

1. Write the draft exactly as given — no rewording, no addition, no summary — to a temporary file: `mktemp -t vibecoder-review.XXXXXX`, then the Write tool on that path.
2. `gh pr review <n> --<verdict> --body-file <that file>` (`--approve`, `--comment` or `--request-changes`). It fails (e.g. one cannot approve one's own PR) → report the error, write nothing, stop.
3. The review just published: your login (`gh api user --jq .login`), then `gh api --paginate repos/{owner}/{repo}/pulls/<n>/reviews --jq '.[] | {state, url: .html_url, user: .user.login}'` — the last entry whose `user` is you.
4. Write `<out>/pr-<n>-review.json`: `{"state":"APPROVED"|"COMMENTED"|"CHANGES_REQUESTED","url":"…"}`, valid JSON.

Change nothing else. Answer in English, one line: the verdict and the link.
