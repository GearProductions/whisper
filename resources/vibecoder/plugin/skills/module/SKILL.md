---
name: module
description: "Generate one module of the ticket's forme, with the loop of the modules skill for a single one: written by the developpeur agent, its diff reviewed, the defects fixed in the same run, the typecheck and its tests rerun until green, without committing. Reports only the [toi] remarks."
argument-hint: "<lang> <out> <path — contract> [prefix]"
disable-model-invocation: true
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Edit, Agent, SendMessage"
---

# Module — the modules loop, for one module

`$ARGUMENTS` = `<lang> <out> <module>`, then `prefix` on the next line. `lang`, `out`: as in the `modules` skill. `module`: `<path> — <contract>`, an entry of the note's « Forme », on one line. `prefix`: the line after it, possibly empty — what the app puts before the project's commands, as in the `modules` skill: you and your developer launch every typecheck and test command behind it.

Follow `${CLAUDE_SKILL_DIR}/../modules/SKILL.md` for this one module:

- Step 1: no list of what remains. Your module is the one in `module`: its Forme entry, its « ne doit pas » lines and its invariant tests are read from the note (the entry of the argument, verbatim). A started module with uncommitted changes → review it, don't generate it again; its skeleton alone (see « What remains » of the `modules` skill) is not started: generate it.
- Step 2: one wave of one, one `vibecoder:developpeur` agent.
- Step 3: its diff reviewed by you, every remark applied (`[toi]` for what leaves the note's contract; after a `SendMessage` to the developer, wait for its reply and reread its new diff before going on: never end the turn with a correction sent and not reread), then the typecheck and the tests of the files it modified, until green.
- Step 4 is skipped: no full suite, the developer runs it. Don't request *Relire le diff* (`vibecoder run start review-diff`) either: your review replaces it.

Commit nothing.

## Answer

In English: the files written, who wrote them (Sonnet, or Opus after two failures), the typecheck and tests run and their result, then only the `[toi]` remarks (code outside the note's contract). No `[agent]` remark left unapplied.
