---
name: relire-note
description: "Review the ticket note of pull request <n> — debatable decisions, gaps, misclassified invariants — into <out>/pr-<n>-note.md, the first step of the guide's review."
argument-hint: "<lang> <out> <n>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Bash(git show *), Bash(git diff *), Bash(git log *), Bash(git grep *), Bash(git ls-tree *)"
---

# Review the note of a PR (guide §5.4, first step)

Does one agree with the decisions? If not, there is no point reading the code.

`$ARGUMENTS` = `<lang> <out> <n>`. `lang`: language of the review and of your answer. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `n`: the PR number.

The PR is the ref `refs/vibecoder/pr/<n>`, never checked out; its base is the `base` of `<out>/pr-<n>.json`; range `origin/<base>...refs/vibecoder/pr/<n>`. The note: the file under `docs/tickets/` the range adds or changes (`git diff --name-only <range> -- docs/tickets`), read with `git show refs/vibecoder/pr/<n>:<path>`. No note → say so in the file (a feature without its note) and stop.

Also read: the PR's description (`body` in the JSON); the guide (`docs/dev_guide/*.html`) §2 and §3.1 to §3.3, and `AGENTS.md`, if present; the code the note says it touches, at the PR's ref, enough to judge.

## Look for

- Decisions to discuss: a choice with a real cost (data, security, money, performance, an old behaviour kept « just in case »), an option not considered, a « Pistes pour plus tard » item that belongs in this ticket — or the reverse.
- Gaps: a behaviour the diff has and the note doesn't say; « Où ça casse » silent on a load that matters; no « Forme » for new modules, or contracts that don't say what a module does not know; « Ce que ça touche » missing what the diff touches.
- Misclassified lines (§3.1, §3.2): `→ invariant` on something visible on screen or not critical; a critical, invisible constraint left to review; a number taken for the invariant (§3.3); an intention not yet testable.
- Open questions or history left in the note: it shows its final state only.

## `<out>/pr-<n>-note.md`, in `lang`

A `##` section for each kind — decisions to discuss, gaps, misclassified lines — each item a list line quoting the note (« … ») and saying why in one or two sentences. Leave out an empty section. Nothing to say → one line saying the note holds.

Change nothing else. Answer in `lang`, 1 to 3 lines: the verdict and the main point.
