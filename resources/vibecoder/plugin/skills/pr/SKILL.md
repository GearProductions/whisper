---
name: pr
description: "Push the branch and open its pull request with the project's title and description convention, or pick up the one already open, and record it in <out>/pr.json."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: "Read, Glob, Grep, Write, Bash(git status *), Bash(git log *), Bash(git diff *), Bash(git rev-parse *), Bash(git symbolic-ref *), Bash(git branch *), Bash(git push -u origin HEAD), Bash(git push --force-with-lease -u origin HEAD), Bash(gh pr view *), Bash(gh pr list *), Bash(gh pr create *), Bash(gh repo view *), Bash(mktemp *)"
---

# Open the PR (guide §5.2, A.3)

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: your answer in English. The title and description follow the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces).

## 1. Before

Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main` or `origin/master`; its name is the part after `origin/`. Stop and say why when:
- you are on the base branch;
- `fixup!`, `squash!` or `amend!` commits remain in `<base>..HEAD`: fold them first;
- tracked files have uncommitted changes (`git status --porcelain --untracked-files=no`): they would be missing from the PR.

## 2. Push

`git push -u origin HEAD`. Rejected because folding the fixups rewrote a branch pushed earlier → `git push --force-with-lease -u origin HEAD`. Rejected for any other reason (someone else pushed) → stop and report. Never `git push --force`.

## 3. The PR

- One already open for this branch (`gh pr view --json number,url,title,state`, state `OPEN`) → keep it as is: the push updated it.
- Otherwise `gh pr create --base <name> --head <branch> --title <title> --body-file <temporary file>`. Title and description: the project's convention — its `gear-commit-message` skill, `pr` case, if present (`.claude/skills/gear-commit-message/SKILL.md`, else `~/.claude/skills/gear-commit-message/SKILL.md`), and its last merged PRs (`gh pr list --state merged --limit 3 --json title,body`). Without a convention: the title is the note's title; the description starts with the link to the note (`<repo url>/blob/<branch>/<note path>`, `gh repo view --json url`), then « Ce que ça fait » in a few lines, then the modules, one line each (path — contract), then the invariants if any. End with the attribution line your own instructions ask for, if any.
- Never merge.

## 4. `<out>/pr.json`

`{"number":<n>,"url":"…","title":"…"}` — valid JSON, nothing else.

Answer in English, 1 to 3 lines: the PR's link, created or picked up.
