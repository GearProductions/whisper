---
name: commiter-modules
description: "Commit the uncommitted changes of every module of the forme that has some, one commit per module (one for modules that only compile together) following the project's message convention, a fixup for a module already committed (a new commit once the PR is open), without pushing."
argument-hint: "<lang> <out> [prefix…]"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: Read, Glob, Grep, Write, Bash(git add *), Bash(git commit *), Bash(gh pr view *), Bash(rm -r "${VIBECODER_OUT}/commit-tree" "${VIBECODER_OUT}/commit-tree.idx")
---

# Commit the modules — one commit per module (guide §5.2, §5.3)

`$ARGUMENTS` = `<lang> <out> [prefix…]`. `lang`: the user's language, not used here — code-related work: your answer in English. Commit messages follow the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`): the commit message and the trees to type go there. `prefix`: everything after `out`, possibly empty — what the app puts before the project's commands, seen from where you run (e.g. `distrobox enter dev --`).

The code is written and the user (or the orchestrator) asked to commit it: commit, don't review, don't change a line.

## 1. What to commit

- Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that `git rev-parse --verify` finds. Then `git status --short` (untracked files included) and `git log --format='%h %s' --name-only <base>..HEAD`.
- The note (under `docs/tickets/`, named like the branch, or the one the branch adds or changes) and its « Forme »: each changed file belongs to the module one of whose paths is that file or contains it.
- Every module with changed files, in the Forme's order (pure → orchestration → UI → doc).
- Nothing to commit → say so and stop. Changed files no module owns: leave them, and say so.

## 2. One commit per module

For each module, in that order, after §3 (it may add later modules to this one: one group, one commit, one message naming each module; they are not committed again):
- **Already committed** (a commit of the branch **other than its first one** touches its files: `git log --format=%h <base>..HEAD -- <its files>`, without the oldest commit of the branch — the first commit holds the note, the forme, the red invariants and the skeletons they need to compile; a module whose files only it touches is not committed yet, it gets its own commit below, never a fixup of that first commit), and the branch's PR not open yet (`gh pr view --json state` : none, or not `OPEN`) → a fixup, never a new commit: `git commit --fixup <sha> -- <files>`, `<sha>` the commit that owns each file (`git log --format=%h <base>..HEAD -- <file>`, the latest, never the first commit of the branch), a new file going to the module's commit; one fixup per owner. The rules of the project's `gear-fix-up` skill, if present (`.claude/skills/gear-fix-up/SKILL.md`).
- **Already committed, PR open** → a new commit per module, saying why (the PR's history is never rewritten): no fixup, no amend.
- **Otherwise** → `git add -- <its files>`, then `git commit -F <out>/commit-message.txt -- <its files>` (the message written there first; only those paths, whatever else is staged). The message: the project's convention — its `gear-commit-message` skill if present (`.claude/skills/gear-commit-message/SKILL.md`: follow its rules and format, skip the clipboard), else the guide §5.2 (`docs/dev_guide/*.html`) and the style of `git log <base>`: subject `<module> : <what changes>`, a blank line, the module's contract in a few lines (what it exposes, what it does not know, who uses it). End with the attribution trailer your own instructions ask for, if any.

A hook fails → stop there and report it; never `--no-verify`. Never push, amend, rebase or reset; never edit a file of the project (only what goes under `<out>`).

## 3. Before each commit — type what it will contain, outside the working folder

Before each commit (fixup included): check that it will compile on its own, **without touching the working folder or the real index** (the app may be running there, and the modules not yet committed are in it). Each command below is one Bash call, never chained (`&&`, `;`, `|`) nor redirected, its paths written in full (`<out>` as given) and **in double quotes**, exactly as below (`<out>` may contain spaces).

1. `GIT_INDEX_FILE="<out>/commit-tree.idx" git read-tree HEAD`, then `GIT_INDEX_FILE="<out>/commit-tree.idx" git add -- <the group's files>`.
2. `GIT_INDEX_FILE="<out>/commit-tree.idx" git checkout-index -a --prefix="<out>/commit-tree/"`: the tree the commit will hold.
3. `ln -s <working folder>/node_modules "<out>/commit-tree/node_modules"` (no `install`).
4. `cd <out>/commit-tree`, then, as a Bash call of its own, the project's typecheck: `<prefix> <command>`, the command exactly as the commands section of `AGENTS.md` writes it (its typecheck line), the prefix exactly as given, none of your own. Only that: no test, no build, no other tool, no other source for the command (not `package.json`, not `Cargo.toml`). Then `cd <working folder>`, whatever the result. `AGENTS.md` has no typecheck line: skip this step, keep the commit, and say in the answer that it was not checked.
5. `rm -r "<out>/commit-tree" "<out>/commit-tree.idx"`, whatever the result (also before step 1, if a stopped run left them; an error because they are absent is fine). Not `rm -rf`: it is on the deny list, and reopening it would reopen it whole.

It fails (a typecheck that ran), the errors naming files of a later module of the Forme that has changes (an import of its file, a symbol it defines) → that module joins this group: add its files, redo from 1. Otherwise stop there, say so with the errors: this commit and the ones after it are not made, the files stay uncommitted. Never amend, rebase or `--no-verify` to catch it up; the developer decides.

## Answer

In English: one line per commit (`<short hash> <subject>`) with its typecheck result (or « not checked »), then what was left uncommitted, if anything.
