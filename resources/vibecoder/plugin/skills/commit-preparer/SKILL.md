---
name: commit-preparer
description: "Pick and stage the files of the next commit — one module, note + forme + invariants for the first one, or a fixup of an earlier commit (the note or the forme changed since, before the PR) — and write its exact message to <out>/commit.md, without committing."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: sonnet
effort: low
allowed-tools: "Read, Glob, Grep, Write, Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git rev-list *), Bash(git rev-parse *), Bash(git symbolic-ref *), Bash(git add *), Bash(git restore --staged *), Bash(gh pr view *)"
---

# Prepare the commit — shown before it is made

The user reads the message on screen, then clicks « Commit »: you prepare, you never commit.

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: your answer in English. The message follows the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces).

## 1. State

Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists (`git rev-parse --verify -q <ref>`). Then `git rev-list --count <base>..HEAD`, `git log --format='%h %s' <base>..HEAD`, `git status --short`; the note (under `docs/tickets/`, named like the branch, or the one the branch adds or changes) and its « Forme ». Nothing changed → say so, write nothing.

First `gh pr view --json state,number` (before anything about fixups): `OPEN` → the branch's PR is open, its history is not rewritten. An error (no PR) or any other state → no open PR.

## 2. The files — one commit, one module (guide §5.2)

- First commit of the branch: the note (with its Forme), the file headers or skeletons, the red invariant tests.
- Otherwise one module: its files and its tests — the first in the Forme's order (pure → orchestration → UI → doc) among those changed. The rest waits for the next commit: say so.
- A file already owned by an earlier commit of the branch (`git log --format=%h <base>..HEAD -- <file>`):
  - PR open → never a fixup or an amend. It is a new commit of its own: stage it and write a message that says why the file changes again (the reason, not only the what), in the module's subject style.
  - No open PR → a fixup of that commit, prepared here like any other commit, and before any module: the next commit is the fixup of the oldest of these owners (each file's owner: the latest commit of the branch that touches it). Stage only the files it owns; the message is exactly `fixup! <that commit's subject>` (what `git commit --fixup` writes), no body. The note (its Forme too) and the invariant tests changed after the first commit thus go to the first commit. Not a fixup: a module's file whose only owner is the first commit (a skeleton) — it goes with that module's own commit. The other changes wait for the next commit: say so. The project's `gear-fix-up` skill, if present (`.claude/skills/gear-fix-up/SKILL.md`), for its routing rules.
- Docs only (`SPEC.md`, `README.md`, `AGENTS.md`…) → a doc commit.

Stage exactly those: `git add -- <paths>`. Files already staged that don't belong → `git restore --staged -- <paths>`, and say so.

## 3. The message → `<out>/commit.md`

The project's convention: its `gear-commit-message` skill if present (`.claude/skills/gear-commit-message/SKILL.md`): follow its rules and format, write to the file instead of the clipboard. Otherwise the guide §5.2 (`docs/dev_guide/*.html`) and the style of `git log <base>`: subject `<module> : <what changes>`, a blank line, then the module's contract in a few lines (what it exposes, what it does not know, who uses it); first commit: the note, the forme and the red invariants. End with the attribution trailer your own instructions ask for, if any: the `commit` skill adds nothing. Change after the PR opened: the body starts with why the module changes again. A fixup: `fixup! <subject>` alone, nothing else (no body, no trailer): the fold keeps its target's message.

The file holds the exact message only — subject, blank line, body — no code fence, no comment.

Answer in English, 1 to 3 lines: the subject (`fixup! …` for a fixup), the staged files (count), what was left out.
