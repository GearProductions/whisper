---
name: note
description: "Write or update the ticket note from a request, following the project's note skill or the guide, with the open questions written to <out>/questions.md and never into the note."
argument-hint: "<lang> <out> <request…>"
disable-model-invocation: true
---

# Note — the ticket note (guide §2)

`$ARGUMENTS` = `<lang> <out> <request…>`. `lang` (`fr` or `en`): the user's language — of the note's text, of `questions.md` and of your answer; identifiers, paths, signatures and pseudo-code stay in English. `out`: absolute path of the agent's output folder (it ends with `vibecoder-out/<agent id>` and may contain spaces). The request: everything after, often dictated — raw material, not a text to copy.

## The note

0. On the base branch (`origin/HEAD`, else `main`, else `master`)? First create the ticket branch named after the note — `<type>/<note file name without .md>`, or the project's branch convention — with `git switch -c` (uncommitted files follow). The screen finds the note through the branch name.
1. The project or user skill `gear-prompt-specs-to-feature-note`: read its `SKILL.md` (`.claude/skills/<name>/` at the repo root, else `~/.claude/skills/<name>/`) and follow it — dictation cleanup, sections, marks, never inventing, file name, living note. Where it puts the questions in chat, do what « Questions » below says.
2. Without it: the guide (`docs/dev_guide/*.html`: §2, §3.1 to §3.3, A.1; find the sections with `Grep` on `<h[12]>`), else these rules:
   - one file, `docs/tickets/<type>/<ticket or version>-<slug>.md`, `<type>` = `feat`, `fix`, `refactor` or `chore`, named like the project's other notes; a note for this ticket exists → update it in place: final state only, the why of a choice in parentheses;
   - only the sections that serve, titled exactly `## Ce que ça fait`, `## Ce que ça ne doit pas faire`, `## Où ça casse`, `## Ce que ça touche`, `## Forme`, `## Pistes pour plus tard` — whatever `lang`: the screen reads the note by these titles;
   - each « ne doit pas » line ends with its mark: `→ invariant` only if critical and invisible on screen (§3.2), else `→ variant suffit`, `→ vu en review` or `→ structure`;
   - every line comes from the request, the code or an existing note: never invent a requirement, a number or a module; a path you write exists, or says « à créer ».
3. Write nothing else in the repository. Commit nothing.

## Questions — never in the note

Anything unclear, contradictory or missing is an open question. Write them all to `<out>/questions.md`, in `lang`, with 2 to 4 short options each when possible:

```markdown
## 1. <question>
- <option>
- <option>
```

No question → write the file empty: it means « no more questions ». When the answers come back (« Réponses aux questions ouvertes… » / « Answers to the open questions… »): write each decision in the note, at its place; an answer asking for your advice → give it in your reply and keep the question; an answer leaving it to you → decide, and say what you chose. Then rewrite `questions.md` with what remains.

## Answer

In `lang`: the note's path, then the open questions, one line each.
