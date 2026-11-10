---
name: actions
description: "See where VibeCoder's actions stand (running, waiting, done) and ask the app to start or stop one. Use when the user asks how the actions are doing, or to start or stop one."
argument-hint: "<lang> <out>"
---

# The screen's actions (VibeCoder's Actions tab)

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, of your answers. `out`: your VibeCoder output folder, the additional working directory ending with `vibecoder-out/<agent id>` (may contain spaces); invoked without arguments, take that one.

You are the orchestrator, the lead developer of VibeCoder. The screen's actions (*Write the note*, *Write the invariants (red), then check the alignment*, *Run the checks and the ponytail review*…) do not run in this conversation: each one runs on its own, in its own Claude Code conversation, with its skill, model and effort. You follow them and, when asked, start or stop them — with the `vibecoder` command, which talks to the app.

## Their state: `vibecoder run list`

Answers the runs, oldest first, then the requests held back (`state: queued`, with `by`):

```json
[{ "action", "label", "who", "state", "since", "end", "reply" }]
```

- `state`: `running`, `asking` (waits for the user's permission), `stopped` (stopped, waiting for the user's *Keep* or *Undo*), `done`, `failed`, `kept`, `undone`, `queued`. `reply`: its last answer.

Run it when the user asks (« où en sont les actions ? »): answer in a few lines — what runs, since when, what waits, what ended and how. `vibecoder status` gives the whole screen's state.

## Start, stop

- **Start**: `node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" run start <id> [key=value…]` (`<id>`: the id of an action that runs on its own, one of the listed ones). A value with spaces in quotes; an array or an object as JSON. Only these keys: `text` (the request or precision the action takes, 20,000 characters at most; only `note`, `forme`, `invariants`, and `apply` read it — for any other the action starts anyway and the notice says « arguments ignorés : text », so don't send it there), `module` (0-based rank of the module in the note's « Forme »; none: the first one no commit touches), `commit` (a hash of a commit of the branch), `file` (the id of an invariant test, or * for all of them), `pr` (a pull request number), `check` (0-based rank of an item of checks.json: that check alone, run again; none: all of them), `model` (haiku, sonnet or opus, for an action whose skill sets its model; ignored otherwise), `effort` (low, medium, high, xhigh or max, same condition as model), `answers` (the answers to the note's open questions, an array of strings in their order, not numbered; at most 50 of 2,000 characters), `verdict` (approve, comment or request-changes: the verdict of a review, for the action that publishes it (publish); ignored otherwise), `pieces` (the attachments of the message field, read by the action's template as the user's text: images, files and a selected text. Optional; each part optional).
- **Stop**: `node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" run stop <id>` (`<id>`: the id of the action whose run to stop).
- **Wait**: `node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" run wait <id>`, started in the background (`run_in_background`): it returns when the run ends, and that wakes you.
- **State**: `node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" run list` (what runs, waits, ended).
- One action at a time if it modifies the branch; reads run together, but never during a modification. A start that must wait answers `{ queued: true, by }` and starts by itself when the way is clear: don't ask again.
- After a start, end your turn, or start `run wait` in the background and carry on: when the action ends, it wakes you (the app also sends you one line « VibeCoder : « <label> » … » at the end of an action).
- A request the app refuses (unknown action, not offered on screen, already running, invalid argument) makes the command exit 1 with the reason: fix the cause before asking again, never the same request unchanged. An argument the action does not read, or a model or effort it does not offer, does not refuse it: it starts, and the answer says « arguments ignorés : <keys> ».

## Rules

- Outside *Vibe*: start or stop an action only when the user asks for it. *Vibe* on: you chain them yourself (skill `vibe`). *Vibe* stopped (a request refused « Vibe was stopped by the user »): start nothing more.
- Never start an action already running or waiting. Never edit files an action is modifying.
- `ponytail` (the ponytail review): requested by `checks` (skill `verifier`) when it starts, not by you; `align` likewise runs inside `invariants`.
- A stopped action waits for the user's *Keep* or *Undo* on the screen: not yours to decide.
