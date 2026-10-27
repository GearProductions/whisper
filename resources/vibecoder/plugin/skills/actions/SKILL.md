---
name: actions
description: "See where VibeCoder's actions stand (running, waiting, done) and ask the app to start or stop one. Use when the user asks how the actions are doing, or to start or stop one."
argument-hint: "<lang> <out>"
---

# The screen's actions (VibeCoder's Actions tab)

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, of your answers. `out`: your VibeCoder output folder, the additional working directory ending with `vibecoder-out/<agent id>` (may contain spaces); invoked without arguments, take that one.

You are the orchestrator, the lead developer of VibeCoder. The screen's actions (*Write the note*, *Write the invariants (red), then check the alignment*, *Run the checks and the ponytail review*…) do not run in this conversation: each one runs on its own, in its own Claude Code conversation, with its skill, model and effort. You follow them and, when asked, start or stop them — by files the app reads.

## Their state: `<out>/actions.json`

```json
{ "actions": [{ "id", "label", "reads" }],
  "runs": [{ "id", "label", "state", "reads", "since", "end", "reply" }],
  "waiting": [{ "id", "reason" }] }
```

- `actions`: the ones you may start. `reads: true` = it only reads (reviews, checks…); otherwise it modifies the branch.
- `runs[].state`: `running`, `asking` (waits for the user's permission), `stopped` (stopped, waiting for the user's *Keep* or *Undo*), `done`, `failed`, `kept`, `undone`. `reply`: its last answer.
- `waiting`: start requests held back, and why.

Read it when the user asks (« où en sont les actions ? »): answer in a few lines — what runs, since when, what waits and why, what ended and how.

## Start, stop

- **Start**: write `<out>/actions/<id>.start` containing a JSON object of its arguments, `{}` if none. Only these keys: `text` (the request or precision the action takes), `module` (0-based rank of the module in the note's « Forme »; none: the first one no commit touches), `commit` (a hash of the branch), `file` (an invariant test, `*`: all of them), `pr` (number), `check` (0-based rank of an item of `<out>/checks.json`: that check alone, run again; none: all of them), `model` (`haiku`, `sonnet` or `opus`, for an action in a sub-context), `answers` (array of strings: the answers to the note's open questions, in their order, not numbered; at most 50 of 2 000 characters).
- **Stop**: create the empty file `<out>/actions/<id>.stop`.
- The app reads these files and deletes each one once applied. One action at a time if it modifies the branch; reads run together, but never during a modification. A start that must wait stays in place, shown in `waiting`, and starts by itself when the way is clear: don't ask again.
- After writing a start request, end your turn. When an action ends, the app sends you one line « VibeCoder : « <label> » … État : <out>/actions.json »: it wakes you.
- A request the app neither starts nor holds (unreadable, unknown action, not offered on screen, already running, invalid argument) is deleted, and you get one line « VibeCoder : demande <id> refusée — <reason> »: fix the cause before asking again, never the same request unchanged. An argument the action does not read, or a model it does not offer, does not refuse it: it starts, and the line says « VibeCoder : demande <id> partie, arguments ignorés : <keys> » (in English: « VibeCoder: request <id> … »).

## Rules

- Outside *Vibe*: start or stop an action only when the user asks for it. *Vibe* on: you chain them yourself (skill `vibe`). *Vibe* stopped (a request refused « Vibe was stopped by the user »): start nothing more.
- Never start an action already running or waiting. Never edit files an action is modifying.
- `ponytail` (the ponytail review): requested by `checks` (skill `verifier`) when it starts, not by you; `align` likewise runs inside `invariants`.
- A stopped action waits for the user's *Keep* or *Undo* on the screen: not yours to decide.
