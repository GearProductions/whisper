---
name: relire
description: "Review a diff — one commit or the uncommitted changes — with the guide's four questions (§5.1), plus duplication and file headers, into <out>/review.md."
argument-hint: "<lang> <out> <commit | WORKTREE>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Bash(git show *), Bash(git diff *), Bash(git log *), Bash(git status *), Bash(git ls-files *), Bash(git grep *), Bash(git rev-parse *)"
---

# Review a diff (guide §5.1)

A conformity read, not a bug hunt: does this diff stay inside what was decided?

`$ARGUMENTS` = `<lang> <out> <target>`. `lang`: language of `review.md` and of your answer. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `target`: a commit hash → `git show <hash>`; `WORKTREE` → `git diff HEAD`, plus the untracked files (`git ls-files --others --exclude-standard`), read in full.

Context: the note (under `docs/tickets/`, named like the branch, or the one the branch adds or changes) — « Ce que ça fait », « Ce que ça ne doit pas faire », the « Forme » entry of each module the diff touches; if present, `AGENTS.md` (architecture rules, protected files) and the guide (`docs/dev_guide/*.html`) §5.1. Read the code around the diff, not only the diff.

## `<out>/review.md`, in `lang`

The four questions, each answered « Non. » / « No. » or with what and where (`file:line`), then the remarks:

```markdown
## Hors du périmètre prévu ?
## Une dépendance ajoutée ?
## De l'I/O dans une boucle, un N+1, une opération bloquante ?
## Une lecture ou une écriture sans le bon cloisonnement ?
## Remarques
- <file:line> — <what> — <why>
```

In English: `## Out of the planned scope?`, `## A dependency added?`, `## I/O in a loop, an N+1, a blocking operation?`, `## A read or write without the right scoping?`, `## Remarks`.

- Scope: compare with the module's contract and the note; name anything else the diff changes.
- Scoping: data of another tenant, user, agent or folder; a path or an id from outside used without a check.
- Remarks: duplication with existing code (name the existing one); a file header false to the contract or out of date; an import that breaks a « ne connaît pas »; a protected test changed; invariants or variants missing; dead code; a diff over ~400 lines (the module was too big). None → `- Rien.` / `- Nothing.`

Change nothing else, anywhere. Answer in `lang`, 1 to 3 lines: the verdict and the most important remark.
