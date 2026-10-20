---
name: ponytail
description: "Review the whole branch with ponytail-review, plus note/code alignment, duplication, edge cases, security, dead code and leftovers, one remark per line in <out>/ponytail.md, changing nothing. Started by verifier (Run the checks), alongside the checks."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Bash(git diff *), Bash(git log *), Bash(git show *), Bash(git status *), Bash(git grep *), Bash(git rev-parse *), Bash(git symbolic-ref *), Bash(git merge-base *)"
---

# Ponytail review of the branch

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: `ponytail.md` and your answer in English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces).

Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists. The diff: `git diff <base>...HEAD` (the commits: `git log --format='%h %s' <base>..HEAD`). Read the changed files in full, and the code next to them.

## What to look for

1. The `ponytail-review` skill: read its `SKILL.md` (`.claude/skills/ponytail-review/` at the repo root, else `~/.claude/skills/ponytail-review/`) and apply it to the diff, with its tags (`delete`, `stdlib`, `native`, `yagni`, `shrink`). Missing → hunt the same: dead flexibility, abstractions with one user, a hand-rolled standard library, a dependency doing what the platform does.
2. Then, beyond over-engineering:
   - `note`: the note (under `docs/tickets/`, named like the branch) and the code disagree — behaviour, Forme, a « ne doit pas » line not held;
   - `duplicate`: logic that already exists elsewhere in the repo (name it);
   - `edge`: an input not handled — empty, missing, too big, concurrent, a failing call;
   - `security`: a path, an id or a text from outside used unchecked, a secret logged, a command built through a shell;
   - `dead`: code nothing calls, a flag never set;
   - `leftover`: traces of a concept the branch removed or renamed (names, comments, config keys, docs).

## `<out>/ponytail.md`, in English

One remark per list line, the most useful first: `- <file>:L<line> — <tag>: <what> — <why, or what replaces it>`. Then, out of the list, ponytail-review's score line `net: -<N> lines possible.` Nothing to cut or fix → the single line `Lean already. Ship.` Only what you would really change: no style nits.

Modify nothing else. Answer in English, 1 to 3 lines: the number of remarks and the two that matter most.
