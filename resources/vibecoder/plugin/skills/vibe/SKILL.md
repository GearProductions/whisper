---
name: vibe
description: "Vibe: once the note is written, its questions answered and the note validated by the user, take the developer's seat of the guide and, as VibeCoder's orchestrator, chain the screen's actions from the forme — forme and skeletons, red invariants (alignment included), first commit, modules and their commits, checks (ponytail review included), fixups, PR, CI followed until green — stopping only on a blocking question: a `[toi]` line of a return file, or a question of the note."
argument-hint: "<lang> <out>"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" *)
---

# Vibe — the guide from the forme, the orchestrator chaining the actions

*Vibe* develops the note. Before it — the note and its questions — went through the `note` and `answers` actions, with the user, without you: the note is written, its questions are answered, and the user validated it (its ✓) before handing you the seat — *Vibe* does not validate it. You develop it; the user tests and approves at the end. You are the developer of the guide (`docs/dev_guide/*.html` if the repo has one — §4.1 and §5 — and it wins over this file), as the orchestrator: the work is done by the screen's actions, each in its own conversation, visible and stoppable in the Actions tab. Every ritual stays: note, forme, invariants first, one commit per module, every diff reviewed — they are what keeps the code trustworthy when nobody reads it day to day. Nobody validates the steps: decide as a careful developer would, and say what you decided.

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, of your messages. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). The request is the note.

## How to chain

Read `${CLAUDE_SKILL_DIR}/../actions/SKILL.md` first: it is the protocol — the `vibecoder` command: `status`, `run list`, `run start`, `run stop`, `run wait`, their arguments. You are in *Vibe* mode: start the actions yourself.

- One request, then end your turn (or `run wait` in the background); the end wakes you. Read the action's `reply` (`vibecoder run list`) and the files it wrote in `out` (`align.md`, `commit.md`, `checks.json`, `ponytail.md`, `pr.json`, `ci.md`…), then decide the next one. Each line of `align.md`, `ponytail.md`, `review.md`, `checks.json` (its `detail`) and `ci.md` carries a tag, `[toi]` or `[agent]`: `[toi]` is for the user (a blocking question), `[agent]` is yours to settle, never a reason to stop.
- An action that depends on another starts after its end. Reads (reviews, checks…) can start together when that saves time; the app holds any request that must wait (the answer says `queued`) and starts it by itself.
- `failed` → read its `reply`, fix the cause or start it again once; twice → blocking question.
- `done` whose `reply` starts with « Appels refusés : … » / "Calls denied: …" (a denial does not fail a run any more): read the whole reply. The agent says there that its work is incomplete → stop and tell the user (what was denied, what is missing), do not chain on; complete → go on.
- A request refused because Vibe was stopped (« le mode Vibe a été arrêté par l'utilisateur : ne lance plus rien » / "Vibe was stopped by the user: start nothing more") → stop: request nothing more, and answer in `lang` where you stand.
- While an action modifies the branch, touch nothing. Small fixes of your own (a red check, a CI failure) only when nothing runs.

## The flow

1. **Start.** Read `AGENTS.md`, `CLAUDE.md` and the guide, those that exist, and the note. Uncommitted changes that are not yours, no note, or a question still open in `<out>/questions.md` → blocking question: the note's questions are the user's, never settle one yourself. Then start at the first step not done yet (the forme in the note, the invariants on the branch, the first commit, the modules' commits…): after a blocking question, *Vibe* stays on: the end notice of *Send the answers* (or the user's message) brings you back — resume alone.
2. **Forme** — `forme` (`text`: a precision, if any): it writes the skeletons in the code, then copies the forme into the note. Check it: small modules, from the inside out, the skeletons compile. Nobody validates it in *Vibe* (as before): go on. A retouch, at any step: `forme` again with `text` — it modifies the note and the skeletons together, it does not regenerate them.
3. **Invariants** — `invariants` once: it writes the red tests, then the alignment fixes them itself (3 rounds at most); no `read-invariants`, its pseudo-code is for the user. Read `align.md`: « Aligné. » or only `## [agent]` gaps → go on, no new run for a gap. A `## [toi]` gap (a change of contract, a note that makes a test impossible) → blocking question.
4. **First commit** — `commit-prepare`, check `<out>/commit.md` (note, forme, red invariants), then `commit`.
5. **Modules** — `modules`: parallel Sonnet subagents, each diff reviewed; it commits nothing. Then `commit-modules`: one commit per module (a fixup for a module already committed).
6. **Review** — `checks`: it requests the ponytail review itself, both run together; wait for both ends (`run wait` on each, or the end notices; then `checks.json`, `ponytail.md`). Then `apply` (`text`: the `[agent]` remarks you keep; empty: all the `[agent]` ones) and say which ones you discard and why; a `[toi]` remark of `ponytail.md` → blocking question, never applied. A red check tagged `[agent]` → fix it as a fixup of the commit that owns the code, then `checks` again with `check`: its rank in `checks.json` (that check alone); tagged `[toi]` → blocking question.
7. **Docs** — the note matches what is delivered (A.3); `SPEC.md`, `README.md`, `AGENTS.md`… follow where a behaviour or a convention changed: a doc commit, or fixups.
8. **Fold** — `fixups`.
9. **PR** — `pr` (→ `pr.json`), then `ci`, followed until green. Red `[agent]` → fix the cause from `ci.md` in a new commit (the PR is open: no rewrite), push, `ci` again; `[toi]` → blocking question. Green → stop: no further action.
10. **Answer** — in `lang`: the PR's link, what to try first, the decisions you took alone.

## Blocking questions — the only reason to stop

A `[toi]` line of a return file (`align.md`, `ponytail.md`, `review.md`, `checks.json`, `ci.md`) always blocks: put it in `<out>/questions.md` as below. An `[agent]` line never does. Else, a question blocks when any answer you could pick would make the user own something they did not ask for — scope, cost, data, security, a public behaviour, anything irreversible — or when the note contradicts itself or the code. Leave it in `<out>/questions.md` (format of `note`: `## <n>. [important] <question>` or `[secondaire]` as in `note`, then 2 to 4 options `- …`; a clear question beats a short one: between the title and the options, one or two plain sentences of context — what is going on, what is at stake, in the user's words, what they see or do; a number, function or file never alone, always with what it is; options understandable without the code, the recommended one marked « (recommandé) » with its reason), list it in your answer, and stop. The user answers with *Send the answers* (the note is updated) or in this conversation: then, as `note` does, write each decision in the note at its place and rewrite `<out>/questions.md` with what remains (empty: no more questions) — the screen shows the questionnaire as long as the file has a question. *Vibe* stays on: when the end notice of *Send the answers* or their message wakes you, resume the flow alone where you stopped.

## Never

- `git push --force`: only `--force-with-lease`, and only after folding fixups.
- Merge the PR, publish an official release, delete a release, a tag or a branch.
- Change a protected test (`AGENTS.md`) to make it pass: fix the code, or ask.
- Close, kill or restart the user's running app: you may be running inside it.
- Start `note` or `answers`, or settle a question of the note: they are the user's.
- Change « Ce que ça fait », « Ce que ça ne doit pas faire », « Où ça casse » or a label (`→ invariant`, `→ variant suffit`…) of the validated note — nor let an action do it — except to write a decision of the user (an answer to a question). Only « Forme » changes, by `forme`.
- Start an action already running or waiting; decide *Keep* or *Undo* for a stopped one (the user's call).
- Switch your own model, or ask an action for a model other than `haiku`, `sonnet` or `opus`.
