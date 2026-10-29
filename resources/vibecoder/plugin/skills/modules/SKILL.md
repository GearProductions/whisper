---
name: modules
description: "Hand the remaining modules of the forme to parallel Sonnet subagents on disjoint files with ponytail, review each diff and run the full test suite once per wave, without committing: committing is the commiter-modules skill's job."
argument-hint: "<lang> <out>"
disable-model-invocation: true
model: opus
effort: high
---

# Modules — the rest of the Forme, in parallel, reviewed, not committed

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: your answer in English. Code follows the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). The user hands you the remaining modules: generate and review them without asking, as the developer of the guide would (`docs/dev_guide/*.html` §4.1, §5.1, if present). Commit nothing: *Commit the modules* (skill `commiter-modules`) does it, one commit per module.

## 1. What remains

- Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists. Then `git log --format='%h %s' --name-only <base>..HEAD` and `git status --short`.
- The note's « Forme » (under `docs/tickets/`, named like the branch, or the one the branch adds or changes): the modules no commit of the branch touches and with no uncommitted changes, in its order. None → say so and stop.
- Uncommitted changes of a module → it is written: review it with the first wave (step 3), don't generate it again.
- For each module, from the note: its « Forme » entry, the lines of « Ce que ça ne doit pas faire » that concern it, and the paths of its invariant tests. They go into its subagent's prompt.

## 2. Generate, in waves

A module waits until the modules it uses are written: pure functions → orchestration → routes / IPC → UI → glue. Within a wave: one subagent per module, all started in the same message so they run in parallel, each on files no other subagent touches. Each one is an Agent call with `subagent_type: "vibecoder:developpeur"` (Sonnet, high effort, ponytail preloaded; if that type is unknown, `model: "sonnet"`) and a prompt that says:
- « Read `${CLAUDE_SKILL_DIR}/../module/SKILL.md` and follow it with the arguments `<lang> <out> <path — contract>`. »
- « Module (Forme entry): <the entry, verbatim>. "Ne doit pas" lines: <each one, with its invariant / variant / review tag>. Its invariants (protected, must turn green): <paths>. »
- « Files you may create or change: <list>. Any other file must change → stop and say which one and why. »
- « Other modules are being written at the same time: errors in files outside your list are not yours — report them, don't fix them. »
- « Apply the ponytail skill. Commit nothing. »

## 3. Review each diff yourself

Before the next wave, for each module (`git diff -- <files>`, new files read in full): the four questions of §5.1 — out of the planned scope? a dependency added? I/O in a loop, an N+1, a blocking call? a read or write without the right scoping? — plus duplication with existing code, the file header true to the contract, its « ne doit pas » lines respected, its invariants green and untouched, its variants present, under ~400 lines.
- Small defect → fix it yourself.
- Otherwise → `SendMessage` to the same subagent (its agent id) with the precise correction: it keeps its context, nothing to reread. Review its new diff.
- Second failure → a new Agent call, same `subagent_type`, with `model: "opus"` (it overrides the agent's header), the same prompt plus what went wrong twice.

Then the project's typecheck and **full** test suite, once per wave, by you: a wave is not done until it has run. A failure → back to the module that owns it, as above.

Never: commit or push; edit a protected test to make it pass; close, kill or restart the user's running app (you may be running inside it).

## Answer

In English: one line per module generated (its files, its tests, who wrote it: Sonnet, or Opus after two failures), then what is left or what you had to decide. Nothing is committed.
