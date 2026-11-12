---
name: ecran
description: "Write the manual test plan of the branch — how to run it and what to try on screen — as a checklist in <out>/ecran.md. The « Relire à l'écran » category of the Revue step, for the creator and the reviewer alike."
argument-hint: "<lang> <out> <ref>"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: "Read, Glob, Grep, Write, Bash(git symbolic-ref *), Bash(git rev-parse *), Bash(git diff *), Bash(git ls-files *)"
---

# On screen — the manual test plan of a branch (guide §5.4)

The eye sees in two seconds what no test captures.

`$ARGUMENTS` = `<lang> <out> <ref>`. `lang`: language of the plan and of your answer. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `ref`:
- `WORKTREE`: the creator's current branch, uncommitted and untracked files included. Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists (`git rev-parse --verify -q <ref>`); range `<base>...HEAD`; the untracked files: `git ls-files --others --exclude-standard`.
- `HEAD`: a pull request, checked out in this folder (the reviewer) — read its files in the folder; base = `base` of the `<out>/pr-<n>.json` whose `head` is the current branch (`git rev-parse --abbrev-ref HEAD`; on a `pr-<n>` branch, that `<n>`); none → as for `WORKTREE`; range `origin/<base>...HEAD`.

Read: the note (« Ce que ça fait », the lines marked `→ vu en review`), the project's scenarios or spec if any (`SPEC.md`, `docs/`), `README.md` and `AGENTS.md` (how to run the project), and the parts of the diff the user sees (`git diff <range>`); all read with Read, Glob and Grep.

## `<out>/ecran.md`, in `lang`: checkboxes only

- First, how to run the branch: it is checked out in this folder, so the project's install and run commands here (`AGENTS.md`, `README.md`). If it cannot run beside the version the user is running, say so in a box; never close or kill that version yourself.
- Then one box per thing to try: a concrete action and what must be seen (« Envoyer le formulaire vide : le message d'erreur s'affiche sous le champ, rien n'est enregistré »). The behaviour the note promises, each `→ vu en review` line, the edge cases a user meets (empty, long, an error, offline, twice at once), and what must not change elsewhere.
- In the order a user would go; 5 to 20 boxes; nothing a test already proves.

Format: `- [ ] …`, one per line, nothing else. Change nothing else. Answer in `lang`, one line: the number of boxes.
