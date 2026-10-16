---
name: worktree-pr
description: "Check out pull request <n> in its own git worktree, following the project's worktree convention, set it up to run (dependencies…), and record it in <out>/pr-<n>-worktree.json."
argument-hint: "<lang> <out> <n>"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: "Read, Glob, Grep, Write, Bash(gh pr view *), Bash(git fetch origin *), Bash(git worktree list *), Bash(git worktree add *), Bash(git show-ref *), Bash(git rev-parse *), Bash(mkdir *)"
---

# Open a PR in a worktree — the current working copy is never touched

`$ARGUMENTS` = `<lang> <out> <n>`. `lang`: the user's language, not used here — code-related work: your answer in English. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it). `n`: the PR number, a positive integer — anything else → say so and stop.

The app adds a temporary robot on the folder you record, after asking the user to trust it. Never `checkout`, `switch`, `stash`, `reset` or `merge` in the current working copy.

1. **The PR.** `gh pr view <n> --json number,title,url,author,baseRefName,headRefName,body,state --jq '{number, title, url, author: .author.login, base: .baseRefName, head: .headRefName, body, state}' > "<out>/pr-<n>.json"`, then `git fetch origin +pull/<n>/head:refs/vibecoder/pr/<n> <base>`. Either fails → report the error, stop.
2. **Already there?** `git worktree list --porcelain`: a worktree already on the PR's head (its `HEAD` equals `git rev-parse refs/vibecoder/pr/<n>`, or its branch is the PR's head branch) → reuse it: skip to step 5.
3. **The convention.** Look for how this project makes worktrees, in this order: a project skill about worktrees (`.claude/skills/*/SKILL.md`), a script (`package.json` scripts such as `setup-worktree`, `scripts/*worktree*`), a section of `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`. Note where worktrees go (e.g. `../<repo>-worktrees/<branch>`) and the setup steps (install dependencies, files copied from the main copy such as `.env`, links…). None → the folder is `../<repo>-worktrees/pr-<n>` next to the repository, and the setup is installing dependencies.
4. **Create it.** The branch: the PR's `head` if it only has `[A-Za-z0-9._/-]` and `git show-ref --verify --quiet refs/heads/<head>` finds no such local branch; else `pr-<n>`; that one exists too → say so, stop. The folder: the convention's, named after that branch. Then `mkdir -p` its parent and:
   ```bash
   git worktree add -b <branch> "<folder>" refs/vibecoder/pr/<n>
   ```
   A project script that creates the worktree itself from a base branch (not from the PR) is not used for this step: follow its location, then do its setup steps by hand.
5. **Set it up**, inside the worktree, with the convention's steps (the user is asked for each command outside this skill's tools): install dependencies with the project's package manager (`yarn install`, `npm ci`, `pnpm install`, `uv sync`, `cargo fetch`… after its lockfile), copy the untracked files the convention lists from the main copy. Do not start servers, run builds or tests, or touch the main copy. A step fails → go on, and say which.
6. **Record it, last** (the app watches this file): write `<out>/pr-<n>-worktree.json`:
   ```json
   { "dir": "<absolute path of the worktree folder>", "branch": "<branch>" }
   ```

Answer in English, two lines at most: `#<n> <title>` → the folder and branch (reused or created), the setup done and any step that failed; or the error.
