---
name: publier-revue
description: "Publish, from the PR step (reviewer only), the review draft of pull request <n> on GitHub, as is, with the chosen verdict, and record the result in <out>/pr-<n>-review.json."
argument-hint: "<lang> <out> <n> <approve|comment|request-changes>, blank line, <draft>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Write, Bash(gh pr review *)"
---

# Publish the review

`$ARGUMENTS` = a first line `<lang> <out> <n> <verdict>`, a blank line, then the draft: everything after that blank line. `lang`: the user's language, not used here — code-related work: your answer in English. The draft is published as written. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it). `n`: a positive integer. `verdict`: `approve`, `comment` or `request-changes`. Anything else, or an empty draft → say so and publish nothing.

1. Write the draft exactly as given — no rewording, no addition, no summary — with the Write tool to `<out>/pr-<n>-review-draft.md`.
2. `gh pr review <n> --<verdict> --body-file <out>/pr-<n>-review-draft.md` (`--approve`, `--comment` or `--request-changes`). It fails (e.g. one cannot approve one's own PR) → report the error, write nothing, stop.
3. The review just published, without `gh api` (never use it): your login from `gh auth status` (the account it is logged in as), then `gh pr view <n> --json url,reviews` — the last entry of `reviews` whose `author.login` is you (its `state`, `submittedAt`), and the PR's `url`.
4. Write `<out>/pr-<n>-review.json`: `{"state":"APPROVED"|"COMMENTED"|"CHANGES_REQUESTED","url":"<the PR's url>","verdict":"<the verdict given>","body":"<the draft, exactly as published>","at":"<that entry's submittedAt>"}`, valid JSON (escape the draft: quotes, backslashes, newlines).

Change nothing else. Answer in English, one line: the verdict and the link.
