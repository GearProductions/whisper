---
name: conception
description: "Check the design of the ticket note, in one pass, before its validation — forgotten cases, contradictions, edge cases of numeric rules, unreachable visible behaviour, a line that is rather an invariant or a variant — and write its suggestions after the questions in <out>/questions.md. Never edits the note."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Bash(git show *), Bash(git diff *), Bash(git log *), Bash(git status *), Bash(git ls-files *), Bash(git ls-tree *), Bash(git grep *), Bash(git rev-parse *), Bash(git symbolic-ref *), Bash(git merge-base *)"
---

# Design check — the note, before its validation

Does the design hold? Read it as someone who must build it tomorrow.

`$ARGUMENTS` = `<lang> <out>`. `lang`: the language of the suggestions and of your answer; identifiers, paths and signatures stay as they are. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces).

Read: the note (under `docs/tickets/`, named like the branch, or the one the branch adds or changes); `AGENTS.md`, if present; the guide (`docs/dev_guide/*.html`) §2 and §3.1 to §3.3, if present; the existing code the note says it touches, enough to judge. One pass: no loop.

## Look for

- Forgotten cases: an input, a state, a failure or a user gesture the note does not say.
- Contradictions between lines (« Ce que ça fait », « Ce que ça ne doit pas faire », « Où ça casse », « Forme »).
- Edge cases of numeric rules: a single option, an empty group, an overrun of the bound, zero, the exact limit.
- A visible behaviour that cannot be reached, front included: trace it in the existing code, from the click or the input to the screen; what the note promises but nothing can trigger or show.
- A line that is rather an invariant (critical, invisible on screen: §3.2), or rather a variant — the label is the developer's to decide, so suggest, never rule.

Only what you can name and place in the note. No style remark, no wording remark, no suggestion for a later ticket. Nothing found is a good answer.

## `<out>/questions.md`, in `lang`

Read it first: it holds the questions still open. Rewrite it whole with that content untouched, then your suggestions after it, numbered on from the last `## <n>.`:

```markdown
## <n>. [important] <suggestion, as a question>
<the note's line it concerns (« … »), what is missing or off, and why it matters: plain language, no bare number or file name>
- **Accepter** — *<rubrique>, <puce>* : « <exact text to write there> »
- **Refuser**
```

The level comes first in the title, `[important]` or `[secondaire]` (these two words, whatever `lang`). Important: a design decision, a write to disk, a gap that makes the feature useless. Secondary: a detail the developer accepts or rejects at a glance.

Each answer is one list line in three parts: the choice in bold, `**Accepter**` or `**Refuser**` (`en`: `**Accept**`, `**Reject**`); where, in italics: the note's heading and the bullet (`*Ce que ça fait, puce 3*`); the exact text to add or replace, quoted « … » (for a Forme or other line to rewrite, the whole new line). Separators: ` — ` before the place, ` : ` before the quote. A suggestion accepted is written into the note by the app's *Envoyer les réponses*, as any answer: so the quote is what enters the note, as is. One suggestion per case, the most serious first.

Nothing found → leave `questions.md` as it is (do not create it). Never edit the note, never write any other file.

## Answer

In `lang`, 1 to 3 lines: the number of suggestions written, the most serious first; or that the design holds.
