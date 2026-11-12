---
name: ponytail
description: "Review the whole branch with ponytail-review, plus note/code alignment, duplication, edge cases, security, dead code and leftovers, one remark per line in <out>/ponytail.md, changing nothing. Started by the app (Run the checks), alongside the checks."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write"
---

# Ponytail review of the branch

The technical review: the code, what could not be foreseen. The structure and the contract (the note's Forme and « ne doit pas » lines) are already validated: don't go back on them. Code that does not do what the note says stays reported (tag `note`), like any other defect of the code.

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language (`fr`, `en`…): `ponytail.md` and your answer in it — the review is read closely, technical subtleties included. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces).

Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists (`git rev-parse --verify -q <ref>`). The diff: `git diff <base>...HEAD` (the commits: `git log --format='%h %s' <base>..HEAD`). Read the changed files in full, and the code next to them.

## What to look for

1. The `ponytail-review` skill: read its `SKILL.md` (`.claude/skills/ponytail-review/` at the repo root) and apply it to the diff, with its tags (`delete`, `stdlib`, `native`, `yagni`, `shrink`). Missing → hunt the same: dead flexibility, abstractions with one user, a hand-rolled standard library, a dependency doing what the platform does.
2. Then, beyond over-engineering:
   - `note`: the code does not do what the note says (under `docs/tickets/`, named like the branch) — behaviour, Forme, a « ne doit pas » line not held: a defect of the code, not a reason to rewrite the note;
   - `duplicate`: logic that already exists elsewhere in the repo (name it);
   - `edge`: an input not handled — empty, missing, too big, concurrent, a failing call;
   - `security`: a path, an id or a text from outside used unchecked, a secret logged, a command built through a shell;
   - `dead`: code nothing calls, a flag never set;
   - `leftover`: traces of a concept the branch removed or renamed (names, comments, config keys, docs).

## `<out>/ponytail.md`, in `lang`

One remark per list line, the most useful first: `- <file>:L<line> [agent] — <tag>: <what> — <why, or what replaces it>`. The address `<file>:L<line>` opens the line, as is: no backticks, nothing before it (the app finds the remark by it, then reads the label right after). The label: `[agent]` for nearly all (the agent fixes it); `[toi]` only for a change of contract (a remark that can only be settled by changing the note's behaviour, Forme or « ne doit pas » lines), the user decides. The tag stays in English (`delete`, `stdlib`, `native`, `yagni`, `shrink`, `note`, `duplicate`, `edge`, `security`, `dead`, `leftover`); the rest in `lang`, code names as they are. Then, out of the list, ponytail-review's score line, in `lang` (`net: -<N> lines possible.` / `net : -<N> lignes possibles.`). Nothing to cut or fix → the single line, in `lang` (`Lean already. Ship.` / `Déjà sobre. On livre.`). Only what you would really change: no style nits.

Modify nothing else. Answer in `lang`, 1 to 3 lines: the number of remarks and the two that matter most.
