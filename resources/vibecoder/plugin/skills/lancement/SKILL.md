---
name: lancement
description: "Find how to start the project (dev servers, front, services) and propose its commands in <out>/lancement.json, for VibeCoder's Processes tab."
argument-hint: "<lang> <out> [<what the user said>]"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Read, Glob, Grep, Write"
---

# Propose the commands that start the project

`$ARGUMENTS` = `<lang> <out> [<text>]`. `lang`: the user's language, for your answer. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `text`: optional, what the user wants (which services, a command they use).

VibeCoder starts each command itself, from the project folder (your working directory), with `bash -ic "<run>"`: the user's aliases and functions from `~/.bashrc` work. Each command runs in the foreground until stopped; the app keeps its log.

1. Look, in this order, for how a developer starts this project: `AGENTS.md`, `CLAUDE.md`, `README.md` (a « run », « start », « dev » section), `package.json` (`scripts`: `dev`, `start`, `serve`, `watch`), `process-compose.yaml` (or a parent folder's), `Makefile`, `docker-compose.yml` / `compose.yaml`, `Procfile`, `Cargo.toml`, `pyproject.toml`. Then `~/.bashrc` (and files it sources, like `~/.bash_aliases`): an alias or function that starts this project (it names the folder or its tools).
2. Keep only long-running commands (servers, watchers, front, services the project needs to run). Not builds, tests, installs, linters, one-shot scripts. A single orchestrator (`process-compose`, a launcher alias, `docker compose up`) covers what it starts: prefer it over its parts. Follow `text` when given.
3. Write `<out>/lancement.json`, exactly this shape (JSON, nothing else):

```json
{
  "commands": [
    { "name": "server", "run": "npm run dev" },
    { "name": "front", "run": "npm run dev", "cwd": "frontend" }
  ]
}
```

- `name`: short, letters, digits, `.`, `_`, `-` (it names the log file), unique.
- `run`: the command as typed in a terminal at the project folder (or at `cwd`).
- `cwd`: optional, a folder relative to the project folder.
- Nothing found → `{ "commands": [] }`.

Change nothing else, start nothing. Answer in the user's language (`lang`), 1 to 3 lines: the commands proposed and where they come from; they appear in the Processes tab if no project file exists yet (otherwise: « Modify the commands » to merge them by hand).
