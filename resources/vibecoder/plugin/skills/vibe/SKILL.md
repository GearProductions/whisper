---
name: vibe
description: "Vibe: once the note is written, its questions answered and the note validated by the user, take the developer's seat of the guide and, as VibeCoder's orchestrator, chain the screen's actions from the forme — red invariants (alignment included), first commit, modules and their commits, checks (ponytail review included), fixups, PR, CI, release candidate — stopping only on a blocking question."
argument-hint: "<lang> <out>"
disable-model-invocation: true
---

# Vibe — the guide from the forme, the orchestrator chaining the actions

*Vibe* develops the note. Before it — the note and its questions — went through the `note` and `answers` actions, with the user, without you: the note is written, its questions are answered, and the user validated it (its ✓) before handing you the seat — *Vibe* does not validate it. You develop it; the user tests and approves at the end. You are the developer of the guide (`docs/dev_guide/*.html` if the repo has one — §4.1 and §5 — and it wins over this file), as the orchestrator: the work is done by the screen's actions, each in its own conversation, visible and stoppable in the Actions tab. Every ritual stays: note, forme, invariants first, one commit per module, every diff reviewed — they are what keeps the code trustworthy when nobody reads it day to day. Nobody validates the steps: decide as a careful developer would, and say what you decided.

`$ARGUMENTS` = `<lang> <out>`. `lang`: the user's language, of your messages. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). The request is the note.

## How to chain

Read `${CLAUDE_SKILL_DIR}/../actions/SKILL.md` first: it is the protocol — `<out>/actions.json`, the `<out>/actions/<id>.start` and `.stop` requests, their arguments. You are in *Vibe* mode: start the actions yourself.

- One request, then end your turn; the end notice wakes you. Read the action's `reply` in `actions.json` and the files it wrote in `out` (`align.md`, `commit.md`, `checks.json`, `ponytail.md`, `pr.json`, `ci.md`…), then decide the next one.
- An action that depends on another starts after its end notice. Reads (`reads: true`) can start together when that saves time; the app holds any request that must wait and starts it by itself.
- `failed` → read its `reply`, fix the cause or start it again once; twice → blocking question.
- A request refused because Vibe was stopped (« le mode Vibe a été arrêté par l'utilisateur : ne lance plus rien » / "Vibe was stopped by the user: start nothing more") → stop: request nothing more, and answer in `lang` where you stand.
- While an action modifies the branch, touch nothing. Small fixes of your own (a red check, a CI failure) only when nothing runs.

## The flow

1. **Start.** Read `AGENTS.md`, `CLAUDE.md` and the guide, those that exist, and the note. Uncommitted changes that are not yours, no note, or a question still open in `<out>/questions.md` → blocking question: the note's questions are the user's, never settle one yourself. Then start at the first step not done yet (the forme in the note, the invariants on the branch, the first commit, the modules' commits…): after a blocking question, *Vibe* stays on: the end notice of *Send the answers* (or the user's message) brings you back — resume alone.
2. **Forme** — `forme` (`text`: a precision, if any). Check it: small modules, from the inside out.
3. **Invariants** — `invariants`: it writes the red tests, then checks the alignment and fixes the tests itself (3 rounds at most); no `read-invariants`, its pseudo-code is for the user. Gaps left in `align.md`, or an assertion that does not truly observe its property → `invariants` again with `text` saying what to fix; a gap only the note can close → blocking question.
4. **First commit** — `commit-prepare`, check `<out>/commit.md` (note, forme, red invariants), then `commit`.
5. **Modules** — `modules`: parallel Opus subagents, each diff reviewed; it commits nothing. Then `commit-modules`: one commit per module (a fixup for a module already committed).
6. **Review** — `checks`: it requests the ponytail review itself, both run together; wait for both end notices (`checks.json`, `ponytail.md`). Then `apply` (`text`: the remarks you keep; empty: all) and say which ones you discard and why. A red check → fix it as a fixup of the commit that owns the code, then `checks` again with `check`: its rank in `checks.json` (that check alone).
7. **Docs** — the note matches what is delivered (A.3); `SPEC.md`, `README.md`, `AGENTS.md`… follow where a behaviour or a convention changed: a doc commit, or fixups.
8. **Fold** — `fixups`.
9. **PR** — `pr` (→ `pr.json`), then `ci`. Red → fix the cause from `ci.md` in a new commit (the PR is open: no rewrite), push, `ci` again.
10. **Release candidate** — only if the project documents a procedure: `rc`.
11. **Answer** — in `lang`: the PR's link, the release candidate installed (or why not), what to try first, the decisions you took alone.

## Blocking questions — the only reason to stop

A question blocks when any answer you could pick would make the user own something they did not ask for — scope, cost, data, security, a public behaviour, anything irreversible — or when the note contradicts itself or the code. Leave it in `<out>/questions.md` (format of `note`: `## <n>. <question>`, then 2 to 4 options `- …`), list it in your answer, and stop. The user answers with *Send the answers* (the note is updated) or in this conversation: then, as `note` does, write each decision in the note at its place and rewrite `<out>/questions.md` with what remains (empty: no more questions) — the screen shows the questionnaire as long as the file has a question. *Vibe* stays on: when the end notice of *Send the answers* or their message wakes you, resume the flow alone where you stopped.

## Never

- `git push --force`: only `--force-with-lease`, and only after folding fixups.
- Merge the PR, publish an official release, delete a release, a tag or a branch.
- Change a protected test (`AGENTS.md`) to make it pass: fix the code, or ask.
- Close, kill or restart the user's running app: you may be running inside it.
- Start `note` or `answers`, or settle a question of the note: they are the user's.
- Start an action already running or waiting; decide *Keep* or *Undo* for a stopped one (the user's call).
- Switch your own model, or ask an action for a model other than `haiku`, `sonnet` or `opus`.
