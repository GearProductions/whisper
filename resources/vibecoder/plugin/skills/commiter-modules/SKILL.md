---
name: commiter-modules
description: "Commit the uncommitted changes of one module of the forme, or of every module that has some, one commit per module following the project's message convention, a fixup for a module already committed, without pushing."
argument-hint: "<lang> <out> [path — contract]"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: "Read, Glob, Grep, Write, Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git rev-parse *), Bash(git symbolic-ref *), Bash(git add *), Bash(git commit *)"
---

# Commit the modules — one commit per module (guide §5.2, §5.3)

`$ARGUMENTS` = `<lang> <out> [module]`. `lang`: the user's language, not used here — code-related work: your answer in English. Commit messages follow the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces): nothing to write there. `module`: everything after `out`, `<path> — <contract>`, an entry of the note's « Forme »; empty: every module with uncommitted changes.

The code is written and the user (or the orchestrator) asked to commit it: commit, don't review, don't change a line.

## 1. What to commit

- Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists. Then `git status --short` (untracked files included) and `git log --format='%h %s' --name-only <base>..HEAD`.
- The note (under `docs/tickets/`, named like the branch, or the one the branch adds or changes) and its « Forme »: each changed file belongs to the module whose path is that file or contains it.
- With `module`: its changed files only. Without: every module with changed files, in the Forme's order (pure → orchestration → UI → doc).
- Nothing to commit → say so and stop. Changed files no module owns: leave them, and say so.

## 2. One commit per module

For each module, in that order:
- **Already committed** (a commit of the branch touches its files: `git log --format=%h <base>..HEAD -- <its files>`) → a fixup, never a new commit: `git commit --fixup <sha> -- <files>`, `<sha>` the commit that owns each file (`git log --format=%h <base>..HEAD -- <file>`, the latest), a new file going to the module's commit; one fixup per owner. The rules of the project's `gear-fix-up` skill, if present (`.claude/skills/gear-fix-up/SKILL.md`, else `~/.claude/skills/gear-fix-up/SKILL.md`).
- **Otherwise** → `git add -- <its files>`, then `git commit -F <temporary file outside the repo> -- <its files>` (only those paths, whatever else is staged). The message: the project's convention — its `gear-commit-message` skill if present (`.claude/skills/gear-commit-message/SKILL.md`, else `~/.claude/skills/gear-commit-message/SKILL.md`: follow its rules and format, skip the clipboard), else the guide §5.2 (`docs/dev_guide/*.html`) and the style of `git log <base>`: subject `<module> : <what changes>`, a blank line, the module's contract in a few lines (what it exposes, what it does not know, who uses it). End with the attribution trailer your own instructions ask for, if any.

A hook fails → stop there and report it; never `--no-verify`. Never push, amend, rebase or reset; never edit a file.

## Answer

In English: one line per commit (`<short hash> <subject>`), then what was left uncommitted, if anything.
