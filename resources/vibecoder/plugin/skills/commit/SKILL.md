---
name: commit
description: "Commit the staged changes with the exact message of <out>/commit.md, then delete that file, and nothing else."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: haiku
effort: low
allowed-tools: "Read, Bash(git commit -F *), Bash(git status *), Bash(git log *)"
---

# Commit — the message the user just read

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, not used here — code-related work: your answer in English. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it).

1. `<out>/commit.md` missing or empty → say « Pas de message préparé. » / « No prepared message. » and stop.
2. Run exactly `git commit -F "<out>/commit.md"`. No `git add`, no `-a`, no `--amend`, no `--no-verify`, no other option; never edit the message.
3. It fails (a hook, nothing staged…) → keep `commit.md`, report the error in a few lines, stop.
4. It succeeds → delete the file: `rm -- "<out>/commit.md"`.

Answer in English, one line: `<short hash> <subject>`, or the error.
