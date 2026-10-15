---
name: fixups
description: "Fold the branch's fixup! commits into their targets with an autosquash rebase before the PR, refusing once the PR is open if the project forbids rewriting, and never pushing."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: "Read, Bash(git status *), Bash(git log *), Bash(git rev-parse *), Bash(git symbolic-ref *), Bash(git merge-base *), Bash(git rebase *), Bash(GIT_SEQUENCE_EDITOR=true git rebase *), Bash(gh pr view *)"
---

# Fold the fixups (guide §5.3)

`$ARGUMENTS` = `<lang> <out>`. `lang`: language of your answer. `out`: the agent's output folder: nothing to write there.

The user clicked « fold the fixups »: that click is the confirmation — don't ask again.

1. Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists. On the base branch itself → say so, stop.
2. `git log --format='%h %s' <base>..HEAD`: no `fixup!`, `squash!` or `amend!` commit → « Rien à replier. » / « Nothing to fold. », stop.
3. PR open (`gh pr view --json state -q .state` prints `OPEN`): the guide (`docs/dev_guide/*.html` §5.3) and the project's `gear-fix-up` skill (read its `SKILL.md` if present: `.claude/skills/gear-fix-up/`, else `~/.claude/skills/gear-fix-up/`) say whether history may still be rewritten. Forbidden, or unclear → refuse, say why and what the project does instead (usually a new commit), stop.
4. Fold in place, on the branch's own fork point (no new base commit comes in):
   `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash --autostash "$(git merge-base HEAD <base>)"`
5. Conflict → `git rebase --abort` (back to the state before), report the commit being replayed and the conflicting files, stop. Never resolve it yourself.
6. Success → show `git log --format='%h %s' <base>..HEAD` and the undo command, `git reset --hard ORIG_HEAD`. Branch already pushed (`git rev-parse --verify -q @{u}`) → say that the next push needs `--force-with-lease` (the PR action does it).

Never push. Never `git push --force`.

Answer in `lang`, 1 to 3 lines: how many commits were folded, the new log, the undo command.
