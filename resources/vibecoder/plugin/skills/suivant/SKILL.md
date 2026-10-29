---
name: suivant
description: "Commit the module just reviewed (as the commiter-modules skill does: one commit per module, the project's message convention), then, the commit made, ask the app to generate the next module in its own run (<out>/actions/module.start), without generating it nor pushing; a failing hook: stop without asking."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
---

# Next — commit the reviewed module, then ask for the next one

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: your answer in English. The commit message follows the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces).

## 1. Commit the module in progress

The user reviewed the uncommitted changes and clicked « commit, then next »: these changes are the module in progress. Read `${CLAUDE_SKILL_DIR}/../commiter-modules/SKILL.md` and follow it with no module (each module with uncommitted changes, one commit each; a fixup for a module already committed). Nothing changed → go to 2.

A commit fails (a hook, anything) → stop and report: do not write the request of 2.

## 2. Ask for the next module

Write the empty file `<out>/actions/module.start` (the orchestrator's request, `${CLAUDE_SKILL_DIR}/../actions/SKILL.md`): once this run ends, the app generates, in its own run, the first module of the Forme that no commit of the branch touches. Generate nothing yourself, don't wait for it.

Never push.

## Answer

In English, 1 to 2 lines: the commits (`<short hash> <subject>`), and whether the next module was requested (or the failure that stopped it).
