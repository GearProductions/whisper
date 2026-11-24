---
name: modules
description: "Hand the remaining modules of the forme to one developer agent (at most 4 code modules, written in the forme's order) or, beyond, to parallel Sonnet subagents on disjoint files, with ponytail; check each diff for conformity, and after each wave run the typecheck and the tests of the modified files with the project's tool (the full suite if it cannot pick them), then the full suite once at the very end, without committing: committing is the commiter-modules skill's job."
argument-hint: "<lang> <out> [note=<path>] [base=<ref>] [prefix…]"
disable-model-invocation: true
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Edit, Agent, SendMessage"
---

# Modules — the rest of the Forme, generated, checked, not committed

`$ARGUMENTS` = `<lang> <out> [note=<path>] [base=<ref>] [prefix…]`. `lang`: the user's language, not used here — code-related work: your answer in English. Code follows the project's convention. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). `note=<path>` (the ticket note) and `base=<ref>` (the base branch): optional, given by the app right after `out` (an empty value, `base=` or `note=` alone, counts as not given); given → use them, don't search; absent (skill launched by hand) → search as in step 1. `prefix`: everything after `out` and its named arguments, possibly empty — what the app puts before the project's commands, seen from where you run (e.g. `distrobox enter dev --`): every typecheck and test command, yours and your subagents', is `<prefix> <command>`, the command from `AGENTS.md`, the prefix exactly as given, none of your own; empty → the command as is. The user hands you the remaining modules: generate and review them without asking, as the developer of the guide would (`docs/dev_guide/*.html` §4.1, §5.1, if present). Commit nothing: *Commit the modules* (skill `commiter-modules`) does it, after *Prove the invariants* (skill `prouver`, its own action: not yours).

## 1. What remains

- Base: `base=` if given, else `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), else `origin/main`, `origin/master`, `main` or `master`, the first that exists. Then `git log --format='%h %s' --name-only <base>..HEAD` and `git status --short`.
- The note's « Forme » (`note=` if given, else under `docs/tickets/`, named like the branch, on the disk even if git ignores it, else the one the branch adds or changes): the modules not started, in its order. None → say so and stop.
- A module is started when a commit without the note touches one of its files, or, the note committed, when one of its files changed without being committed. A note git ignores (`git check-ignore -q <note>`) is in no commit: the oldest commit of the branch stands for the note's commit. Its skeleton alone (the files as *Poser la forme* wrote them: carried by the note's commit, or uncommitted before any commit) is not started: it is still to generate, even if `git status` lists its files.
- A started module with uncommitted changes → it is written: review it with the first wave (step 3), don't generate it again.
- For each module, from the note: its « Forme » entry (its `variants :` line and cases included), the lines of « Ce que ça ne doit pas faire » that concern it, and the paths of its invariant tests. They go into its developer's prompt, with the note's path (the developer does not search for it).

## 2. Generate

Count the code modules of the Forme still to write, not counting those marked `variants : aucun` (docs, skills' text).
- **At most 4**: one `vibecoder:developpeur` agent writes them all, one after the other, in the Forme's order, in one context: for each module its variants red first, then its code. The `variants : aucun` modules go to the same agent, after the code ones (no variants step); the prompt below lists every module's entry, « ne doit pas » lines, invariants and files, in order. One wave of one agent.
- **More than 4**: waves, as below.

In waves, a module waits until the modules it uses are written: pure functions → orchestration → routes / IPC → UI → glue. Within a wave: one subagent per module, all started in the same message so they run in parallel, each on files no other subagent touches. Each one is an Agent call with `subagent_type: "vibecoder:developpeur"` (Sonnet, high effort, ponytail preloaded; if that type is unknown, `model: "sonnet"`) and a prompt that says:
- « Fill the module's skeleton (don't recreate it). The ticket note is <the note's path>: you don't need to search for it. Module (Forme entry): <the entry, verbatim>. "Ne doit pas" lines: <each one, with its invariant / variant / review tag>. Its invariants (protected, must turn green): <paths>. »
- « Files you may create or change: <list>. Any other file must change → stop and say which one and why. »
- « (Waves only) Other modules are being written at the same time: errors in files outside your list are not yours — report them, don't fix them. »
- « Write its variants first, red, then the code (TDD; several modules: each in turn, its red variants before its code): say how many were red before the code. Test its complex functions and technical code too (edge cases, bounds, errors, concurrency…), beyond the note's variants. »
- « The project's typecheck and test commands are launched as `<prefix> <command>`, the command as `AGENTS.md` writes it, the prefix being: <prefix> (empty: none). »
- « Apply the ponytail skill. Commit nothing. Don't request a review (`vibecoder run start review-diff`): I review your diff. »

## 3. Check each diff yourself — conformity, not a bug hunt

Before the next wave (or the answer, for one agent), for each module (`git diff -- <files>`, new files read in full), a quick conformity read: the four questions of §5.1 — out of the planned scope and the permitted files? a dependency added? I/O in a loop, an N+1, a blocking call? a read or write without the right scoping? — plus the file header true to the contract, its variants in the file its Forme entry names, covering its cases, seen red then green (its answer says so; otherwise send it back like any defect), its invariants green and untouched. Not here: duplication, edge cases, security, dead code and the module's « ne doit pas » lines — the ponytail review of the branch (`checks`) reads everything right after and owns them.
- Every remark of this check is applied, none left over: a small defect → fix it yourself. Code outside the note's contract (not a defect to fix: a contract decision) → tag `[toi]`, in the answer.
- Otherwise → `SendMessage` to the same subagent (its agent id) with the precise correction: it keeps its context, nothing to reread. `SendMessage` returns at once and the subagent works in the background: **do not end your turn, and do not move to the next wave or to the answer, until its reply has arrived** (its completion comes as a notification that wakes you in a new turn). Then review its new diff. Never finish a turn with a correction sent and not reread.
- Second failure → a new Agent call, same `subagent_type`, with `model: "opus"` (it overrides the agent's header), the same prompt plus what went wrong twice.

Then, by you, after each wave: the project's typecheck and the tests of the files that wave modified, with the project's own commands (its `AGENTS.md` « Commands » section, the ones to launch; its way of selecting tests from changed files, e.g. a file argument). If the tool cannot pick them, run the full suite instead. Launch them behind the prefix, the prefix exactly as given. The tests of the changed files only if `AGENTS.md`'s commands take them as arguments (e.g. `npm test -- <files>`); otherwise the full suite. Read files with Read, Glob and Grep, never `ls`, `cat` or `find`. A wave is not done until it has run. A failure → back to the module that owns it, as above (a `SendMessage` again means waiting for the reply and rereading, then running them again). Nothing runs before the first wave (neither suite, nor typecheck); the subagents run their own module's tests.

## 4. End: the full suite

After the last wave is reviewed and green, run the project's **full** test suite exactly once, by you: *Generate the modules* is not finished until it has run. Never run it before the first wave or between two waves. A failure → back to the module that owns it, as in step 3, then run the full suite once more.

Never: commit or push; edit a protected test to make it pass; close, kill or restart the user's running app (you may be running inside it).

## Answer

In English: one line per module generated (its files, its tests, who wrote it: Sonnet, or Opus after two failures), then the result of the full suite, then the `[toi]` remarks (code outside the note's contract), then what is left or what you had to decide. Nothing is committed.
