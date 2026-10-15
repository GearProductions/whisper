---
name: vibe
description: "Take the developer's seat of the guide for a request and run the whole flow — note, forme, red invariants, modules by parallel Opus subagents, reviews, ponytail-review, folded fixups, PR, release candidate — stopping only on a blocking question."
argument-hint: "<lang> <out> <request…>"
disable-model-invocation: true
---

# Vibe — the whole guide, in the developer's seat

The user hands you the feature; they test and approve at the end. You are the developer of the guide (`docs/dev_guide/*.html` if the repo has one — §4.1 and §5 — and it wins over this file). Every ritual stays: note, forme, invariants first, one commit per module, every diff reviewed — they are what keeps the code trustworthy when nobody reads it day to day. Nobody validates the steps: decide as a careful developer would, and say what you decided.

`$ARGUMENTS` = `<lang> <out> <request…>`. `lang`: language of your messages and of what you write in `out`. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces). The request: everything after, often dictated.

## The step skills

Each step has its skill next to this one: `${CLAUDE_SKILL_DIR}/../<name>/SKILL.md`. « Follow `<name>` » = read that file and do what it says, with `<lang> <out>` and the arguments shown; they cannot be called with the Skill tool. Write the same files in `out` as they do (`questions.md`, `checks.json`, `ponytail.md`, `pr.json`…): the screen follows the journey through them. The project's and the user's skills they rely on (`gear-…`, `ponytail`, `ponytail-review`) are read the same way, and their confirmation prompts are skipped: the user handed you the feature.

## The flow

1. **Start.** Read `AGENTS.md`, `CLAUDE.md` and the guide, those that exist. Base: `origin/HEAD`, else `main`, else `master`. Uncommitted changes that are not yours → blocking question.
2. **Note** — follow `note` with the request (it creates the ticket branch). Its open questions: decide the ones whose answer is reversible and stays inside the request, and write each decision in the note (the why in parentheses); the others are blocking. Then `<out>/questions.md` is empty.
3. **Forme** — follow `forme`. You name the modules and their signatures: small modules, from the inside out.
4. **Invariants** — follow `invariants`: red, from the note. Then reread each assertion as `lire-invariants` would: does it truly observe the property? Fix the test before going on.
5. **First commit** — follow `commit-preparer`, then `commit`: the note, the forme (headers, skeletons), the red invariants.
6. **Modules** — follow `modules`: subagents of type `vibecoder:developpeur` (Opus, high effort; else `model: "opus"`), in parallel on disjoint files, each applying `ponytail`; every diff reviewed with the four questions; one commit per module, pure → orchestration → UI → doc.
7. **Checks** — follow `verifier` (→ `checks.json`). Red → fix it as a fixup of the commit that owns the code (`git commit --fixup <sha> -- <files>`), then check again.
8. **Review** — one subagent of type `vibecoder:relecteur` (Opus, high effort; else `model: "opus"`) follows `ponytail` (→ `ponytail.md`). Apply the remarks you judge right, each as a fixup of the commit that owns the code, and nothing else; say which ones you discard and why. Checks again.
9. **Docs** — the note matches what is delivered (A.3); the project's docs (`SPEC.md`, `README.md`, `AGENTS.md`…) follow where a behaviour or a convention changed: a doc commit, or fixups.
10. **Fold** — follow `fixups`.
11. **PR** — follow `pr` (→ `pr.json`). Wait for its CI (`gh pr checks --watch`); red → find the cause as `ci` does, fix it in a new commit (the PR is open: no rewrite), push, wait again.
12. **Release candidate** — only if the project documents a procedure: follow `rc`.
13. **Answer** — in `lang`: the PR's link, the release candidate installed (or why not), what to try first, the decisions you took alone.

## Blocking questions — the only reason to stop

A question blocks when any answer you could pick would make the user own something they did not ask for — scope, cost, data, security, a public behaviour, anything irreversible — or when the request contradicts itself. Write them to `<out>/questions.md` (the format of `note`: `## <n>. <question>`, then 2 to 4 options `- …`), list them in your answer, and stop. When the answers come (« Réponses aux questions ouvertes… » / « Answers to the open questions… »), apply them as that message asks, then resume the flow where you stopped.

## Never

- `git push --force`: only `--force-with-lease`, and only after folding fixups.
- Merge the PR, publish an official release, delete a release, a tag or a branch.
- Change a protected test (`AGENTS.md`) to make it pass: fix the code, or ask.
- Close, kill or restart the user's running app: you may be running inside it.
- Switch your own model, or start a subagent on a model this file does not name.
