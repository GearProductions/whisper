---
name: ecran
description: "Write the manual test plan of pull request <n> — how to run it and what to try on screen — as a checklist in <out>/pr-<n>-ecran.md."
argument-hint: "<lang> <out> <n>"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: "Read, Glob, Grep, Write, Bash(git show *), Bash(git diff *), Bash(git log *), Bash(git ls-tree *), Bash(git grep *)"
---

# On screen — the manual test plan of a PR (guide §5.4)

The eye sees in two seconds what no test captures.

`$ARGUMENTS` = `<lang> <out> <n>`. `lang`: language of the plan and of your answer. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `n`: the PR number.

The PR is the branch of this folder (`HEAD`), checked out: read its files in the folder; its base is the `base` of `<out>/pr-<n>.json`; range `origin/<base>...HEAD`. Read: the note (« Ce que ça fait », the lines marked `→ vu en review`), the project's scenarios or spec if any (`SPEC.md`, `docs/`), `README.md` and `AGENTS.md` (how to run the project), and the parts of the diff the user sees.

## `<out>/pr-<n>-ecran.md`, in `lang`: checkboxes only

- First, how to run the PR: it is checked out in this folder, so the project's install and run commands here (`AGENTS.md`, `README.md`) — or the release candidate to install, if the project publishes one for PRs. If it cannot run beside the version the user is running, say so in a box; never close or kill that version yourself.
- Then one box per thing to try: a concrete action and what must be seen (« Envoyer le formulaire vide : le message d'erreur s'affiche sous le champ, rien n'est enregistré »). The behaviour the note promises, each `→ vu en review` line, the edge cases a user meets (empty, long, an error, offline, twice at once), and what must not change elsewhere.
- In the order a user would go; 5 to 20 boxes; nothing a test already proves.

Format: `- [ ] …`, one per line, nothing else. Change nothing else. Answer in `lang`, one line: the number of boxes.
