---
name: suivant
description: "Commit the module just reviewed (as the commiter-modules skill does: one commit per module, the project's message convention), then implement the given next module exactly as the module skill does, without pushing."
argument-hint: "<lang> <out> <path — contract>"
disable-model-invocation: true
context: fork
model: opus
effort: high
---

# Next — commit the reviewed module, then generate the next one

`$ARGUMENTS` = `<lang> <out> <module>`. `lang`: the user's language, not used here — code-related work: your answer in English. The commit message and the code follow the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `module`: `<path> — <contract>`, the entry of the note's « Forme » to implement next.

## 1. Commit the module in progress

The user reviewed the uncommitted changes and clicked « commit, then next »: these changes are the module in progress. Read `${CLAUDE_SKILL_DIR}/../commiter-modules/SKILL.md` and follow it with no module (each module with uncommitted changes, one commit each; a fixup for a module already committed). Nothing changed → go to 2. A hook fails → stop and report.

## 2. Implement the next module

If `<module>` is the one you just committed, take instead the first module of the Forme that no commit of the branch touches. Then read `${CLAUDE_SKILL_DIR}/../module/SKILL.md` and follow it for that module.

Never push.

## Answer

In English, 1 to 3 lines: the commits (`<short hash> <subject>`), the module generated, the test results.
