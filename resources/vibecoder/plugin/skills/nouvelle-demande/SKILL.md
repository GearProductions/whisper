---
name: nouvelle-demande
description: "Suggest the branch name of a new request, following the project's branch convention, into <out>/new-request.json; the app shows it prefilled, the user accepts or changes it, then creates it here or in a new worktree. Creates nothing, starts nothing."
argument-hint: "<lang> <out> <request…>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Read, Glob, Grep, Write, Bash(git branch *)"
---

# New request — only a suggested branch name

Do it now, without asking: suggest the branch name, write the file, then answer. This is your task; nothing else is coming.

`$ARGUMENTS` = `<lang> <out> <request…>`. `lang`: the user's language, for your answer. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). The request: everything after, often dictated — read it for its subject, never copy it.

1. **The convention.** The project's branch convention if it has one (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, the project or user skill `gear-prompt-specs-to-feature-note`, `git branch -a` for the names already used). Otherwise, like a ticket note (`docs/tickets/<type>/<ticket or version>-<slug>.md`), the branch is `<type>/<ticket>-<slug>`, or without a ticket `<type>/<version>-<slug>`:
   - `<type>`: `feat`, `fix`, `refactor` or `chore`, after the request;
   - `<ticket>`: the ticket id the request names (e.g. `GT-123`), if any;
   - `<version>`: none named in the request → the next patch of the project's version (`package.json`, `Cargo.toml`, `pyproject.toml`…) for a bug, the next minor for the rest;
   - `<slug>`: a few words of the subject, lowercase, hyphens, no accents (`son-reste-coupe`).
2. **A safe name.** Only `A-Z a-z 0-9 . _ / -`; no leading `-`, no `..`, no `//`, nothing ending in `/`, `.` or `.lock`. Already a branch (`git branch -a --list "<branch>" "*/<branch>"` finds it) → add `-2`, `-3`…
3. **Write** `<out>/new-request.json`, exactly (JSON, nothing else):
   ```json
   { "branch": "feat/0.12.0-export-csv" }
   ```

Nothing else: no branch, worktree, switch, stash, note, install or command — it is only a suggestion: the app shows it prefilled, the user accepts or changes it, then the app creates the branch here or in a worktree with its robot, in *Créer*, and sends the request. Never write the request into the file.

Answer in `lang`, one line: the suggested branch name.
