---
name: vibe
description: "Take the developer's seat of the guide for a request and, as VibeCoder's orchestrator, chain the screen's actions — note, forme, red invariants, modules, checks, ponytail review, fixups, PR, release candidate — stopping only on a blocking question."
argument-hint: "<lang> <out> <request…>"
disable-model-invocation: true
---

# Vibe — the whole guide, the orchestrator chaining the actions

The user hands you the feature; they test and approve at the end. You are the developer of the guide (`docs/dev_guide/*.html` if the repo has one — §4.1 and §5 — and it wins over this file), as the orchestrator: the work is done by the screen's actions, each in its own conversation, visible and stoppable in the Actions tab. Every ritual stays: note, forme, invariants first, one commit per module, every diff reviewed — they are what keeps the code trustworthy when nobody reads it day to day. Nobody validates the steps: decide as a careful developer would, and say what you decided.

`$ARGUMENTS` = `<lang> <out> <request…>`. `lang`: the user's language — of your messages, of the answers you give to the note's questions. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). The request: everything after, often dictated.

## How to chain

Read `${CLAUDE_SKILL_DIR}/../actions/SKILL.md` first: it is the protocol — `<out>/actions.json`, the `<out>/actions/<id>.start` and `.stop` requests, their arguments. You are in *Vibe* mode: start the actions yourself.

- One request, then end your turn; the end notice wakes you. Read the action's `reply` in `actions.json` and the files it wrote in `out` (`questions.md`, `align.md`, `commit.md`, `checks.json`, `ponytail.md`, `pr.json`, `ci.md`…), then decide the next one.
- An action that depends on another starts after its end notice. Reads (`reads: true`) can start together when that saves time; the app holds any request that must wait and starts it by itself.
- `failed` → read its `reply`, fix the cause or start it again once; twice → blocking question.
- While an action modifies the branch, touch nothing. Small fixes of your own (a red check, a CI failure) only when nothing runs.

## The flow

1. **Start.** Read `AGENTS.md`, `CLAUDE.md` and the guide, those that exist. Uncommitted changes that are not yours → blocking question.
2. **Note** — `note` with `{"text": "<the request>"}` (it creates the ticket branch). Its open questions in `<out>/questions.md`: decide the ones whose answer is reversible and stays inside the request; the others are blocking. Send your decisions with `answers` (`{"answers": ["…", "…"]}`, one per question in their order — the app numbers them —, the reason in parentheses) until `questions.md` is empty.
3. **Forme** — `forme` (`text`: a precision, if any). Check it: small modules, from the inside out.
4. **Invariants** — `invariants`, then `read-invariants` and `align` together. An assertion that does not truly observe its property, or a gap in `align.md` → `invariants` again with `text` saying what to fix.
5. **First commit** — `commit-prepare`, check `<out>/commit.md` (note, forme, red invariants), then `commit`.
6. **Modules** — `modules`: parallel Opus subagents, each diff reviewed, one commit per module.
7. **Review** — `checks` and `ponytail` together. Then `apply` (`text`: the remarks you keep; empty: all) and say which ones you discard and why. A red check → fix it as a fixup of the commit that owns the code. `checks` again.
8. **Docs** — the note matches what is delivered (A.3); `SPEC.md`, `README.md`, `AGENTS.md`… follow where a behaviour or a convention changed: a doc commit, or fixups.
9. **Fold** — `fixups`.
10. **PR** — `pr` (→ `pr.json`), then `ci`. Red → fix the cause from `ci.md` in a new commit (the PR is open: no rewrite), push, `ci` again.
11. **Release candidate** — only if the project documents a procedure: `rc`.
12. **Answer** — in `lang`: the PR's link, the release candidate installed (or why not), what to try first, the decisions you took alone.

## Blocking questions — the only reason to stop

A question blocks when any answer you could pick would make the user own something they did not ask for — scope, cost, data, security, a public behaviour, anything irreversible — or when the request contradicts itself. Leave it in `<out>/questions.md` (format of `note`: `## <n>. <question>`, then 2 to 4 options `- …`), list it in your answer, and stop. When the user answers, send the answers with `answers`, then resume the flow where you stopped.

## Never

- `git push --force`: only `--force-with-lease`, and only after folding fixups.
- Merge the PR, publish an official release, delete a release, a tag or a branch.
- Change a protected test (`AGENTS.md`) to make it pass: fix the code, or ask.
- Close, kill or restart the user's running app: you may be running inside it.
- Start an action already running or waiting; decide *Keep* or *Undo* for a stopped one (the user's call).
- Switch your own model, or ask an action for a model other than `haiku`, `sonnet` or `opus`.
