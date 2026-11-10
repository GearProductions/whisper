---
name: note
description: "Write or update the ticket note from a request, following the project's note skill or the guide, with the open questions written to <out>/questions.md and never into the note."
argument-hint: "<lang> <out> <request…>"
disable-model-invocation: true
---

# Note — the ticket note (guide §2)

`$ARGUMENTS` = `<lang> <out> <request…>`. `lang` (`fr` or `en`): the user's language — of the note's text, of `questions.md` and of your answer; identifiers, paths, signatures and pseudo-code stay in English. `out`: absolute path of the agent's output folder (it ends with `vibecoder-out/<agent id>` and may contain spaces). The request: everything after, often dictated — raw material, not a text to copy.

## The note

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
## 1. [important] <question>
<one or two sentences of context>
- <option>
- <option> (recommandé: <reason>)
```

After the number, the level: `[important]` (a design decision, a write to disk, a gap that would make the feature useless) or `[secondaire]` (a precision the user accepts or refuses by reading quickly); never none. The screen reads the lines under the title, before the options, as the question's text: put the context there. A clear question beats a short one. The context is plain language: what is going on, what is at stake, why a choice is needed; the user's own words when the question comes from their request, and what they see or do (a button, a step, a message). A number (`I-xx`, `T-xx`), a function or a file never stands alone: it comes with what it is, in plain words. Options must make sense without reading the code; mark the recommended one « (recommandé) » (`lang`) with its reason in a few words. Same for the questions in your answer.

No question → write the file empty: it means « no more questions ». Any answer, whatever its path — the screen's message (« Réponses aux questions ouvertes… » / « Answers to the open questions… ») or the user answering in the conversation: write each decision in the note, at its place; an answer asking for your advice → give it in your reply and keep the question; an answer leaving it to you → decide, and say what you chose. Then rewrite `questions.md` with what remains (empty: no more questions) — the screen shows the questionnaire as long as the file has a question.

## Answer

In `lang`: the note's path, then the open questions, one line each.
