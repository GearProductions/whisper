---
name: modules
description: "Hand the remaining modules of the forme to parallel Opus subagents on disjoint files with ponytail, review each diff, then commit module by module, pure → orchestration → UI → doc, without pushing."
argument-hint: "<lang> <out>"
disable-model-invocation: true
---

# Modules — the rest of the Forme, in parallel, reviewed, one commit each

`$ARGUMENTS` = `<lang> <out>`. `lang`: language of your answer. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). The user hands you the remaining modules: generate, review and commit them without asking, as the developer of the guide would (`docs/dev_guide/*.html` §4.1, §5.1, §5.2, if present).

## 1. What remains

- Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists. Then `git log --format='%h %s' --name-only <base>..HEAD` and `git status --short`.
- The note's « Forme » (under `docs/tickets/`, named like the branch, or the one the branch adds or changes): the modules no commit of the branch touches, in its order. None → say so and stop.
- Uncommitted changes of a module → review and commit that module first (steps 3 and 4).

## 2. Generate, in waves

A module waits until the modules it uses are written: pure functions → orchestration → routes / IPC → UI → glue. Within a wave: one subagent per module, all started in the same message so they run in parallel, each on files no other subagent touches. Each one is an Agent call with `subagent_type: "vibecoder:developpeur"` (Opus, high effort, ponytail preloaded; if that type is unknown, `model: "opus"`) and a prompt that says:
- « Read `${CLAUDE_SKILL_DIR}/../module/SKILL.md` and follow it with the arguments `<lang> <out> <path — contract>`. »
- « Files you may create or change: <list>. Any other file must change → stop and say which one and why. »
- « Other modules are being written at the same time: errors in files outside your list are not yours — report them, don't fix them. »
- « Apply the ponytail skill. Commit nothing. »

## 3. Review each diff yourself

Before the next wave, for each module (`git diff -- <files>`, new files read in full): the four questions of §5.1 — out of the planned scope? a dependency added? I/O in a loop, an N+1, a blocking call? a read or write without the right scoping? — plus duplication with existing code, the file header true to the contract, its invariants green and untouched, its variants present, under ~400 lines. Fix small things yourself; otherwise a new subagent with the precise correction. Then the project's typecheck and tests, once per wave.

## 4. Commit, one module per commit

In the Forme's order (pure → orchestration → UI → doc): `git add -- <the module's files>`, then a commit whose message follows the project's convention — its `gear-commit-message` skill if present (read its `SKILL.md`, follow its format, skip the clipboard), else the guide §5.2: subject `<module> : <what>`, the contract in the body — plus the attribution trailer your instructions ask for. A change to an already-committed module → `git commit --fixup <sha> -- <files>`.

Never: push; edit a protected test to make it pass; close, kill or restart the user's running app (you may be running inside it).

## Answer

In `lang`: one line per commit (`<short hash> <subject>`), then what is left or what you had to decide.
