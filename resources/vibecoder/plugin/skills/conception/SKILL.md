---
name: conception
description: "Check the design of the ticket note, in one pass, before its validation — forgotten cases, contradictions, edge cases of numeric rules, unreachable visible behaviour, a line that is rather an invariant or a variant — and write its suggestions after the questions in <out>/questions.md; a re-check reads only what changed since the last one and reports only what blocks. Never edits the note."
argument-hint: "<lang> <out>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write"
---

# Design check — the note, before its validation

Does the design hold, and is it the right design? Read it as the developer's design partner, the one they brainstorm with — not only a checker: someone who must build it tomorrow, and who would rather build less.

`$ARGUMENTS` = `<lang> <out>`. `lang`: the language of the suggestions and of your answer; identifiers, paths and signatures stay as they are. `out`: the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces).

Read: the note (under `docs/tickets/`, named like the branch, or the one the branch adds or changes); `AGENTS.md`, if present; the guide (`docs/dev_guide/*.html`) §2 and §3.1 to §3.3, if present; the existing code the note says it touches, enough to judge. One pass: no loop.

## First check or re-check

`<out>/conception/<the note's file name>` (e.g. `<out>/conception/0.15.0-cli.md`) holds that note's text as you last checked it.

- Absent → **first check**: the whole note; both levels.
- Present → **re-check** (the user pressed *Revérifier*): read only what changed, `git diff --no-index -- <out>/conception/<name> <note>`, and the direct consequences of those changes on the rest of the note. Report **only `[important]`** suggestions; no `[secondaire]` on a re-check. Do not raise again what the earlier check already raised and the user answered (accepted or refused), nor what « Où ça casse » already lists as to be measured.

At the end, whatever you found, write `<out>/conception/<name>` with the `Write` tool: the note's full current text, as is.

Tools: read files with `Read`, `Glob` and `Grep`, write with `Write`; `Bash` only to read git (`git show`, `git diff`, `git log`…), one command per call. A command refused is cited at the head of your answer.

## Step back first

Before the details, the direction — the most valuable remark you can make, and the one a line-by-line check never makes:

- **The wrong direction**: the note solves the problem the hard way while something that already exists in the code would do (reuse a view, a list, a mechanism the app already has instead of building a new one). Read the code the note touches with that question.
- **Over-engineering** (the `ponytail` lens: `.claude/skills/ponytail/SKILL.md`, else the plugin's, `${CLAUDE_SKILL_DIR}/../ponytail/SKILL.md`): a rule, an option, a setting, a layer, a language or a case nobody asked for; a mechanism whose complexity outweighs its use; flexibility for a later ticket.
- **A fragile core**: a part that keeps calling for more rules (heuristics, parsing, special cases) — the sign that a simpler approach exists. Say which one.

Such a remark is `[important]`; its **Accepter** describes the other approach in a sentence or two, and what it lets the note drop. Never rewrite the note's intent: propose, the developer decides. On a re-check, only if the changes brought it.

## Look for

- Forgotten cases: an input, a state, a failure or a user gesture the note does not say.
- Contradictions between lines (« Ce que ça fait », « Ce que ça ne doit pas faire », « Où ça casse », « Forme »).
- Edge cases of numeric rules: a single option, an empty group, an overrun of the bound, zero, the exact limit.
- A visible behaviour that cannot be reached, front included: trace it in the existing code, from the click or the input to the screen; what the note promises but nothing can trigger or show.
- A line that is rather an invariant (critical, invisible on screen: §3.2), or rather a variant — the label is the developer's to decide, so suggest, never rule.

Only what you can name and place in the note. No style remark, no wording remark, no suggestion for a later ticket.

**When to stop.** A suggestion is `[important]` only if, without it, the feature fails, the note contradicts itself, something critical (a write to disk, a permission, a leak) is left open, or the design goes the wrong way or does too much (« Step back first »). A precision the developer would settle while coding is not important. An unknown that only a measurement can settle (what a library emits, how a tool behaves) is not a question to argue: suggest once to add it to « Où ça casse » as « to measure before coding », then never again. **« Nothing blocking » is the expected answer once the design holds**: say so in one line and write no suggestion.

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

Nothing found → leave `questions.md` as it is (do not create it). Never edit the note; write no other file than `questions.md` and `<out>/conception/<name>`.

## Answer

In `lang`, 1 to 3 lines: first check or re-check; the number of suggestions written, the most serious first; or « rien de bloquant » (`en`: « nothing blocking ») — the design holds.
