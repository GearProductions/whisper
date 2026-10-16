---
name: ci
description: "Read the CI state of the branch and, when it fails, give the probable cause and the proposed fix in <out>/ci.md, without fixing anything."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: "Read, Glob, Grep, Write, Bash(gh pr checks *), Bash(gh pr view *), Bash(gh run list *), Bash(gh run view *), Bash(git branch *), Bash(git log *), Bash(git show *), Bash(git rev-parse *)"
---

# CI diagnosis

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: `ci.md` and your answer in English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces).

1. The branch's checks: `gh pr checks` (its PR), else `gh run list --branch <branch> --limit 5`. Still running → say what is pending.
2. Each failed run: `gh run view <id> --log-failed` (the error is near the end), then the files it points to, and the workflow file (`.github/workflows/`) for what the failing step runs.
3. Each failure: the probable cause — the code, a test, or the CI environment (OS, versions, network, a flaky test)? — tied to the branch commit that brought it if there is one (`git log`, `git show`). The proposed fix: which file, what change, and as which commit (a fixup of that commit before the PR is open, a new commit after).

## `<out>/ci.md`, in English

A first line with the overall state (✓, ✗ or ⏳, with counts), then one `##` per failed check: the cause, the evidence (a few log lines in a code block), the fix. All green → the first line only.

Fix nothing, rerun nothing. Answer in English, 1 to 3 lines: the state and the main cause.
