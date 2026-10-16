---
name: verifier
description: "Run the project's own verification commands — typecheck, tests, invariants, lint — and write the results to <out>/checks.json."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Read, Glob, Grep, Write"
---

# Checks — the project's own commands

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: the `detail` texts and your answer in English. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces).

## Which commands

From `AGENTS.md` (its commands section) first, else the project's manifests: `package.json` scripts, `Cargo.toml` (`cargo check`, `cargo test`, `cargo clippy` if the project uses it), `pyproject.toml` (pytest, ruff, mypy if configured), a `Makefile`. Only these kinds, each one if the project has it:
- `typecheck` — the type check (`npm run typecheck`, `tsc`, `cargo check`, `mypy`…);
- `tests` — the whole test suite;
- `invariants` — the invariant tests alone, when the project has a command for them;
- `lint` — the linter.

A project in several parts (e.g. front and back) → one item per part and kind, named like `tests (backend)`. Run each from where `AGENTS.md` says. Never: install dependencies, build packages, start the app or a server, run end-to-end tests or comparison benches; never close, kill or restart the user's running app. At most 10 minutes per command.

## `<out>/checks.json`

```json
{"items":[{"name":"typecheck","ok":true,"level":"ok","detail":"…"},{"name":"lint","ok":true,"level":"warning","detail":"…"}],"time":1760000000000}
```

- One item per command run, in the order above.
- `level`: `error` — at least one error (a failing test, a type error, a lint *error*), or the command could not run; `warning` — no error, but warnings in its output (lint warnings, deprecations…), even if the command exited non-zero because of them (e.g. `--max-warnings 0`); `ok` — neither.
- `ok`: `false` for `error`, `true` for `ok` and `warning` (kept for older readers).
- `detail`: one short line in English — ok: the counts (« 212 tests passed »); warning: how many and the first one, with `file:line` (« 3 warnings — src/a.ts:12 no-unused-vars »); error: the first failing test or error, with `file:line` and its message.
- `time`: when the checks finished, in milliseconds since the epoch (`date +%s%3N`).
- No command found → `{"items":[],"time":…}`, and say so.

Valid JSON only. Change nothing else. Answer in English, one line: all green, the warnings, or the failures.
