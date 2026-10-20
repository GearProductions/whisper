---
name: verifier
description: "Ask the app for the ponytail review (<out>/actions/ponytail.start), then run the project's own verification commands — typecheck, tests, invariants, lint — and write the results to <out>/checks.json."
argument-hint: "<lang> <out> [prefix…]"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Read, Glob, Grep, Write, Bash"
---

# Checks — the project's own commands

`$ARGUMENTS` = `<lang> <out> [prefix…]`. `lang`: the user's language, not used here — code-related work: the `detail` texts and your answer in English. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `prefix`: everything after `out`, possibly empty — what the app puts before the project's commands, seen from where you run (e.g. `distrobox enter dev --`).

## First, the ponytail review

Before any command, write `<out>/actions/ponytail.start` containing `{}` (the orchestrator's request, `${CLAUDE_SKILL_DIR}/../actions/SKILL.md`): the app starts the ponytail review in its own run, and both reads run together. Nothing else to do for it: don't wait for it, don't read `ponytail.md`.

## Which commands

From `AGENTS.md` (its commands section) first, else the project's manifests: `package.json` scripts, `Cargo.toml` (`cargo check`, `cargo test`, `cargo clippy` if the project uses it), `pyproject.toml` (pytest, ruff, mypy if configured), a `Makefile`. Only these kinds, each one if the project has it:
- `typecheck` — the type check (`npm run typecheck`, `tsc`, `cargo check`, `mypy`…);
- `tests` — the whole test suite;
- `invariants` — the invariant tests alone, when the project has a command for them;
- `lint` — the linter.

A project in several parts (e.g. front and back) → one item per part and kind, named like `tests (backend)`. Run each from where `AGENTS.md` says.

## Running them

Run every command yourself, now, with Bash: `<prefix> <command>`, the prefix exactly as given, adding none of your own. Empty prefix → the command as is; never add `distrobox`, `toolbox`, `podman` or `mise exec` because `AGENTS.md` or `CLAUDE.md` mentions a box: the app already knows where commands run. A command that could not start (refused, not found, no permission) → its item at `error`, with why in `detail`; never ask for a permission, never retry it another way. Never: install dependencies, build packages, start the app or a server, run end-to-end tests or comparison benches; never close, kill or restart the user's running app. At most 10 minutes per command.

## `<out>/checks.json`

Written only from the commands run in this run. Never read an existing `checks.json`, never reuse or copy a past result: overwrite it.

```json
{"items":[{"name":"typecheck","ok":true,"level":"ok","detail":"…"},{"name":"lint","ok":true,"level":"warning","detail":"…"}],"time":1760000000000}
```

- One item per command run, in the order above.
- `level`: `error` — at least one error (a failing test, a type error, a lint *error*), or the command could not run; `warning` — no error, but warnings in its output (lint warnings, deprecations…), even if the command exited non-zero because of them (e.g. `--max-warnings 0`); `ok` — neither.
- `ok`: `false` for `error`, `true` for `ok` and `warning` (kept for older readers).
- `detail`: one short line in English — ok: the counts (« 212 tests passed »); warning: how many and the first one, with `file:line` (« 3 warnings — src/a.ts:12 no-unused-vars »); error: the first failing test or error, with `file:line` and its message.
- `time`: when the checks finished, in milliseconds since the epoch: run `date +%s%3N` (no prefix) after the last command and use its output; never a guessed or old value.
- No command found → `{"items":[],"time":…}`, and say so.

Valid JSON only. Change nothing else (`actions/ponytail.start` aside). Answer in English, one line: all green, the warnings, or the failures.
