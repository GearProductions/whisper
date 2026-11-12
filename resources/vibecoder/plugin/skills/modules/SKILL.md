---
name: modules
description: "Hand the remaining modules of the forme to parallel Sonnet subagents on disjoint files with ponytail, review each diff, and after each wave run the typecheck and the tests of the modified files with the project's tool (the full suite if it cannot pick them), then the full suite once at the very end, without committing: committing is the commiter-modules skill's job."
argument-hint: "<lang> <out> [prefix…]"
disable-model-invocation: true
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Edit, Agent, SendMessage, Bash(git symbolic-ref *), Bash(git log *), Bash(git status *), Bash(git diff *)"
---

# Modules — the rest of the Forme, in parallel, reviewed, not committed

`$ARGUMENTS` = `<lang> <out> [prefix…]`. `lang`: the user's language, not used here — code-related work: your answer in English. Code follows the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `prefix`: everything after `out`, possibly empty — what the app puts before the project's commands, seen from where you run (e.g. `distrobox enter dev --`): every typecheck and test command, yours and your subagents', is `<prefix> <command>`, the command exactly as `AGENTS.md` writes it, the prefix exactly as given, none of your own; empty → the command as is. The user hands you the remaining modules: generate and review them without asking, as the developer of the guide would (`docs/dev_guide/*.html` §4.1, §5.1, if present). Commit nothing: *Commit the modules* (skill `commiter-modules`) does it, one commit per module.

## 1. What remains

- Base: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists. Then `git log --format='%h %s' --name-only <base>..HEAD` and `git status --short`.
- The note's « Forme » (under `docs/tickets/`, named like the branch, or the one the branch adds or changes): the modules not started, in its order. None → say so and stop.
- A module is started when a commit without the note touches one of its files, or, the note committed, when one of its files changed without being committed. Its skeleton alone (the files as *Poser la forme* wrote them: carried by the note's commit, or uncommitted before any commit) is not started: it is still to generate, even if `git status` lists its files.
- A started module with uncommitted changes → it is written: review it with the first wave (step 3), don't generate it again.
- For each module, from the note: its « Forme » entry (its `variants :` line and cases included), the lines of « Ce que ça ne doit pas faire » that concern it, and the paths of its invariant tests. They go into its subagent's prompt.

## 2. Generate, in waves

A module waits until the modules it uses are written: pure functions → orchestration → routes / IPC → UI → glue. Within a wave: one subagent per module, all started in the same message so they run in parallel, each on files no other subagent touches. Each one is an Agent call with `subagent_type: "vibecoder:developpeur"` (Sonnet, high effort, ponytail preloaded; if that type is unknown, `model: "sonnet"`) and a prompt that says:
- « Fill the module's skeleton (don't recreate it). Module (Forme entry): <the entry, verbatim>. "Ne doit pas" lines: <each one, with its invariant / variant / review tag>. Its invariants (protected, must turn green): <paths>. »
- « Files you may create or change: <list>. Any other file must change → stop and say which one and why. »
- « Other modules are being written at the same time: errors in files outside your list are not yours — report them, don't fix them. »
- « Write its variants first, red, then the code (TDD): say how many were red before the code. Test its complex functions and technical code too (edge cases, bounds, errors, concurrency…), beyond the note's variants. »
- « The project's typecheck and test commands are launched as `<prefix> <command>`, the command as `AGENTS.md` writes it, the prefix being: <prefix> (empty: none). »
- « Apply the ponytail skill. Commit nothing. Don't request a review (`vibecoder run start review-diff`): I review your diff. »

## 3. Review each diff yourself

Before the next wave, for each module (`git diff -- <files>`, new files read in full): the four questions of §5.1 — out of the planned scope? a dependency added? I/O in a loop, an N+1, a blocking call? a read or write without the right scoping? — plus duplication with existing code, the file header true to the contract, its « ne doit pas » lines respected, its invariants green and untouched, its variants in the file its Forme entry names, covering its cases, and seen red before the code (its answer says so; otherwise send it back like any defect), under ~400 lines.
- Every remark of this review is applied, none left over: a small defect → fix it yourself. Code outside the note's contract (not a defect to fix: a contract decision) → tag `[toi]`, in the answer.
- Otherwise → `SendMessage` to the same subagent (its agent id) with the precise correction: it keeps its context, nothing to reread. `SendMessage` returns at once and the subagent works in the background: **do not end your turn, and do not move to the next wave or to the answer, until its reply has arrived** (its completion comes as a notification that wakes you in a new turn). Then review its new diff. Never finish a turn with a correction sent and not reread.
- Second failure → a new Agent call, same `subagent_type`, with `model: "opus"` (it overrides the agent's header), the same prompt plus what went wrong twice.

Then, by you, after each wave: the project's typecheck and the tests of the files that wave modified, with the project's own commands (its `AGENTS.md` « Commands » section, the only ones a run may launch; its way of selecting tests from changed files, e.g. a file argument). If the tool cannot pick them, run the full suite instead. Launch them exactly as `AGENTS.md` writes them, behind the prefix, bare: no `| tail`, no `2>&1`, no `&&`, no composition or redirection (a command outside the allowed ones is denied and fails the run). The tests of the changed files only if `AGENTS.md`'s commands take them as arguments (e.g. `npm test -- <files>`); otherwise the full suite. Read files with Read, Glob and Grep, never `ls`, `cat` or `find`. A wave is not done until it has run. A failure → back to the module that owns it, as above (a `SendMessage` again means waiting for the reply and rereading, then running them again). Nothing runs before the first wave (neither suite, nor typecheck); the subagents run their own module's tests.

## 4. End: the full suite

After the last wave is reviewed and green, run the project's **full** test suite exactly once, by you: *Generate the modules* is not finished until it has run. Never run it before the first wave or between two waves. A failure → back to the module that owns it, as in step 3, then run the full suite once more.

Never: commit or push; edit a protected test to make it pass; close, kill or restart the user's running app (you may be running inside it).

## Answer

In English: one line per module generated (its files, its tests, who wrote it: Sonnet, or Opus after two failures), then the result of the full suite, then the `[toi]` remarks (code outside the note's contract), then what is left or what you had to decide. Nothing is committed.
