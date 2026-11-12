---
name: verifier
description: "Run the project's own verification commands — typecheck, tests, invariants, lint — and write the results to <out>/checks.json, asking the app for the ponytail review (`vibecoder run start ponytail`) when all run; or run one check again, the others kept."
argument-hint: "<lang> <out> <check> [prefix…]"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: Read, Glob, Grep, Write, Bash(node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" run start ponytail), Bash(date +%s%3N)
---

# Checks — the project's own commands

`$ARGUMENTS` = `<lang> <out> <check> [prefix…]`. `lang`: the user's language, not used here — code-related work: the `detail` texts and your answer in English. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `check`: `*` — every check; or a number `N` — only the item of rank `N` (from 0) of `<out>/checks.json`, run again; neither (an older `actions.<lang>.json`) → it is the first word of `prefix`, and `check` is `*`. `prefix`: everything after `check`, possibly empty — what the app puts before the project's commands, seen from where you run (e.g. `distrobox enter dev --`).

## First, the ponytail review

Only when `check` is `*` (one check run again: no ponytail review). Before any command, run `node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" run start ponytail` (the orchestrator's request, `${CLAUDE_SKILL_DIR}/../actions/SKILL.md`): the app starts the ponytail review in its own run, and both reads run together. Nothing else to do for it: don't wait for it, don't read `ponytail.md`.

## Which commands

From `AGENTS.md` (its commands section), read with `Read`, and nowhere else: no fallback on manifests (`package.json`, `Cargo.toml`…), the app only allows the commands written there. Only these kinds, each one if `AGENTS.md` has it:
- `typecheck` — the type check (`npm run typecheck`, `tsc`, `cargo check`, `mypy`…);
- `tests` — the whole test suite;
- `invariants` — the invariant tests alone, when the project has a command for them;
- `lint` — the linter.

A project in several parts (e.g. front and back) → one item per part and kind, named like `tests (backend)`. Run each from where `AGENTS.md` says.

## Running them

Run every command yourself, now, with Bash: `<prefix> <command>`, written as in `AGENTS.md`, the prefix exactly as given, adding none of your own. One command per call, bare: never composed or redirected (no `&&`, `;`, `|`, `2>&1`, `> file`, `tee`), never `cd`; its output is in the tool result, read it there. Read and search with `Read`, `Glob` and `Grep`, never `ls`, `cat` or `find`: any other command is denied. Empty prefix → the command as is; never add `distrobox`, `toolbox`, `podman` or `mise exec` because `AGENTS.md` or `CLAUDE.md` mentions a box: the app already knows where commands run. A command that could not start (refused, not found, no permission) → its item at `error`, with why in `detail`; never ask for a permission, never retry it another way. Never: install dependencies, build packages, start the app or a server, run end-to-end tests or comparison benches; never close, kill or restart the user's running app. At most 10 minutes per command.

## `<out>/checks.json`

`check` `*`: written only from the commands run in this run. Never read an existing `checks.json`, never reuse or copy a past result: overwrite it.

`check` `N`: read `<out>/checks.json`; run only the command of item `N` (the one its `name` designates, found as above), replace that item with its new result, keep every other item exactly as it is, in the same order, and set a new `time`. The file unreadable or without item `N` → run every check, as for `*`, without the ponytail review.

```json
{"items":[{"name":"typecheck","ok":true,"level":"ok","detail":"[agent] …"},{"name":"lint","ok":true,"level":"warning","detail":"[agent] …"}],"time":1760000000000}
```

- One item per command, in the order above.
- `level`: `error` — at least one error (a failing test, a type error, a lint *error*), or the command could not run; `warning` — no error, but warnings in its output (lint warnings, deprecations…), even if the command exited non-zero because of them (e.g. `--max-warnings 0`); `ok` — neither.
- `ok`: `false` for `error`, `true` for `ok` and `warning` (kept for older readers).
- `detail`: one short line in English, starting with a tag — `[toi]` when only a change of the note's contract would make the check pass (an invariant failing because the code must do what the note forbids, or the note makes a test impossible), else `[agent]` (every `ok` and `warning`, and any other failure) — ok: the counts (« [agent] 212 tests passed »); warning: how many and the first one, with `file:line` (« [agent] 3 warnings — src/a.ts:12 no-unused-vars »); error: the first failing test or error, with `file:line` and its message.
- `time`: when the checks finished, in milliseconds since the epoch: run `date +%s%3N` (no prefix) after the last command and use its output; never a guessed or old value.
- No command found in `AGENTS.md` → `{"items":[],"time":…}`, and say so.

Valid JSON only. Change nothing else. Answer in English, one line: all green, the warnings, or the failures.
