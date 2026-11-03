---
name: module
description: "Implement one module of the ticket's forme, and only it, with its file header and variants, the ponytail way, then run the project's typecheck and this module's tests, without committing; then ask the app to review the diff in its own run (<out>/actions/review-diff.start), unless started by the modules skill."
argument-hint: "<lang> <out> <path — contract>"
disable-model-invocation: true
context: fork
model: sonnet
effort: high
---

# Module — one module, by its contract (guide §4.1)

`$ARGUMENTS` = `<lang> <out> <module>`. `lang`: the user's language, not used here — code-related work: your answer in English. The code itself follows the project's convention (`AGENTS.md`), else English. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces): only the review request below goes there. `module`: `<path> — <contract>`, an entry of the note's « Forme ».

## Read first

- `AGENTS.md` and `CLAUDE.md`, if present: commands, architecture rules, protected files, language of code and comments.
- The note (under `docs/tickets/`, named like the branch, or the one the branch adds or changes): « Ce que ça fait », « Ce que ça ne doit pas faire », the « Forme » entry of this module and of its neighbours. Skip it if the prompt already gave you the Forme entry and its « ne doit pas » lines.
- The invariant tests that concern this module: they must turn green.
- The code around: what already exists (reuse it), the modules this one uses, its callers.
- The `ponytail` skill — already preloaded (the `developpeur` agent): don't reread it; otherwise read `.claude/skills/ponytail/SKILL.md`, else `~/.claude/skills/ponytail/SKILL.md` — and apply it: the simplest code that works, no new dependency, nothing for later.

## Do

- This module only, as its contract says: same names, signatures and boundaries. Its file header (guide A.2: what the file does, what it does not know, who uses it), true.
- Its variants (ordinary tests) where and as the project keeps them (e.g. `tests/variants/`).
- A signature of the Forme turns out wrong, or another module must change → don't redesign: stop and say what and why. The developer decides.
- Never touch an invariant test to make it pass (they are protected): fix the code. An invariant that looks wrong → stop and say so.
- Run the project's typecheck and the tests of this module only — its invariants and its variants — never the whole suite (commands from `AGENTS.md`, `package.json`, `Cargo.toml`…). Failures in files you did not touch: report them, don't fix them.
- Never start, stop, kill or restart the user's running app (you may be running inside it); leave no server running.
- Commit nothing.

## Then: ask for the review

Module written (even with failing tests: the review says so too) → write `<out>/actions/review-diff.start` containing `{}` (`${CLAUDE_SKILL_DIR}/../actions/SKILL.md`): once this run ends, the app reviews the uncommitted changes in its own run (*Relire le diff*, another agent: the guide's four questions, duplication, headers, into `<out>/review.md`). Don't review the diff yourself.

Not when: the `modules` skill started you (your prompt says other modules are being written at the same time: it reviews your diff itself), or you stopped without writing the module (a wrong signature, an invariant that looks wrong, a question).

## Answer

In English, 1 to 3 lines: the files written, the results (typecheck, invariants, variants), whether the review was requested, what you skipped or question.
