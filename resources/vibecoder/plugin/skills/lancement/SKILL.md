---
name: lancement
description: "Find how to start the project (dev servers, front, services), how to prepare it and how it makes its worktrees, and propose them in <out>/lancement.json, for VibeCoder's Processes tab and worktrees."
argument-hint: "<lang> <out> [<what the user said>]"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Read, Glob, Grep, Write"
---

# Propose the commands that start and prepare the project

`$ARGUMENTS` = `<lang> <out> [<text>]`. `lang`: the user's language, for your answer. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `text`: optional, what the user wants (which services, a command they use).

VibeCoder starts each command itself, from the project folder (your working directory), with `bash -ic "<run>"`: the user's aliases and functions from `~/.bashrc` work. Each command runs in the foreground until stopped; the app keeps its log.

1. Look, in this order, for how a developer starts this project: `AGENTS.md`, `CLAUDE.md`, `README.md` (a « run », « start », « dev » section), `package.json` (`scripts`: `dev`, `start`, `serve`, `watch`), `process-compose.yaml` (or a parent folder's), `Makefile`, `docker-compose.yml` / `compose.yaml`, `Procfile`, `Cargo.toml`, `pyproject.toml`. Then `~/.bashrc` (and files it sources, like `~/.bash_aliases`): an alias or function that starts this project (it names the folder or its tools).
2. Keep only long-running commands (servers, watchers, front, services the project needs to run). Not builds, tests, installs, linters, one-shot scripts. A single orchestrator (`process-compose`, a launcher alias, `docker compose up`) covers what it starts: prefer it over its parts. Follow `text` when given.
3. **Once per project: the recipe.** The project file is `.vibecoder/project.json` in the project's main folder. It exists and has `setup` (or `worktree`) → leave that key out: the app never overwrites it. Otherwise, from the same files (and a project skill about worktrees, `.claude/skills/*/SKILL.md`, `scripts/*worktree*`):
   - `setup`: the one-shot commands that prepare a fresh copy, in order (install dependencies with the project's package manager after its lockfile, generated files it needs to run…). Not servers, builds of the app, tests.
   - `worktree`: only if the project has its own way to make worktrees (a script such as `setup-worktree` / `cleanup-worktree`). `create`: the command that creates one, run from the project folder; `remove`: the one that removes it; `dir`: where `create` puts it, relative to the project folder, `{branch}` for the branch name (e.g. `../<repo>-worktrees/{branch}`). The branch and the base are never written in a command: they come from the environment, quoted: `"$VIBECODER_BRANCH"` (the worktree's new branch) and `"$VIBECODER_BASE"` (the branch it starts from). No such script → no `worktree` (the app falls back to `git worktree add`, then `setup` in the worktree, and `git worktree remove`).
4. Write `<out>/lancement.json`, exactly this shape (JSON, nothing else; `setup` and `worktree` only when step 3 found them):

```json
{
  "commands": [
    { "name": "server", "run": "npm run dev" },
    { "name": "front", "run": "npm run dev", "cwd": "frontend" }
  ],
  "setup": ["yarn install"],
  "worktree": {
    "create": "yarn setup-worktree \"$VIBECODER_BRANCH\" \"$VIBECODER_BASE\"",
    "remove": "yarn cleanup-worktree \"$VIBECODER_BRANCH\"",
    "dir": "../projet-worktrees/{branch}"
  }
}
```

- `name`: short, letters, digits, `.`, `_`, `-` (it names the log file), unique.
- `run`, each `setup` line, `create`, `remove`: the command as typed in a terminal at the project folder (or at `cwd`).
- `cwd`: optional, a folder relative to the project folder.
- Nothing found → `{ "commands": [] }`.

Change nothing else, start nothing: the app runs these commands itself (the recipe when it prepares the project or creates and removes a worktree), never you. Answer in the user's language (`lang`), 1 to 3 lines: what is proposed and where it comes from; the app adopts the commands whose name is new, and `setup` and `worktree` only if `.vibecoder/project.json` does not have them yet.
