---
name: suivant
description: "Commit the module just reviewed (one commit, the project's message convention), then implement the given next module exactly as the module skill does, without pushing."
argument-hint: "<lang> <out> <path — contract>"
disable-model-invocation: true
context: fork
model: opus
effort: high
---

# Next — commit the reviewed module, then generate the next one

`$ARGUMENTS` = `<lang> <out> <module>`. `lang`: the user's language, not used here — code-related work: your answer in English. The commit message and the code follow the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `module`: `<path> — <contract>`, the entry of the note's « Forme » to implement next.

## 1. Commit the module in progress

The user reviewed the uncommitted changes and clicked « commit, then next »: these changes are the module in progress.
- Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists. Changes: `git status --short`, `git diff HEAD`. The note's « Forme » (under `docs/tickets/`, named like the branch).
- Nothing changed → go to 2.
- The changes span several modules of the Forme → commit nothing; say which files belong to which module, and stop.
- A changed file already owned by an earlier commit of the branch (`git log --format=%h <base>..HEAD -- <file>`) does not go in this commit: it is a fixup of its owner, `git commit --fixup <sha> -- <files>` (the rules of the project's `gear-fix-up` skill, if present).
- The message: the project's convention — its `gear-commit-message` skill if present (`.claude/skills/gear-commit-message/SKILL.md`, else `~/.claude/skills/gear-commit-message/SKILL.md`: follow its rules and format, skip the clipboard), else the guide §5.2 (`docs/dev_guide/*.html`) and the style of `git log <base>`: subject `<module> : <what changes>`, body = the module's contract in a few lines. End with the attribution trailer your own instructions ask for, if any.
- `git add -- <the module's files>`, then commit with that message (`git commit -F <temporary file>`). A hook fails → stop and report; never `--no-verify`.

## 2. Implement the next module

If `<module>` is the one you just committed, take instead the first module of the Forme that no commit of the branch touches. Then read `${CLAUDE_SKILL_DIR}/../module/SKILL.md` and follow it for that module.

Never push.

## Answer

In English, 1 to 3 lines: the commit (`<short hash> <subject>`), the module generated, the test results.
