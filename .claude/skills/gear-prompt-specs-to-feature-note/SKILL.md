---
name: gear-prompt-specs-to-feature-note
description: "Turn my spoken or rough specs into a clean ticket note in the format of the 'Développer avec l'IA' guide (§2, template A.1), written in the repo under docs/tickets/<type>/. Usage: /gear-prompt-specs-to-feature-note [<version>] <what I want, in my own words>. Cleans up dictation (transcription errors, repetitions, hesitations), sorts what I said into the note's sections, marks each « ne doit pas » line → invariant / variant / review / structure, never invents a requirement, and lists the open questions in chat instead of the note. Use when I dictate or paste specs and ask for a note, 'note de ticket', 'feature note', 'mets ça au propre', 'transforme en note'."
argument-hint: "[<version>] <specs en vrac>"
allowed-tools: Read, Glob, Grep, Bash, Write, Edit
---

# Prompt specs → feature note

The user's prompt is raw material: often dictated, with transcription errors (especially on technical terms), repetitions, second thoughts. You turn it into the ticket note of the guide, clean and ready to be discussed. You write **one file**, the note; never project code.

## The guide wins

Read, in the guide `docs/dev_guide/guide-travail-dev-ia.html` (repo root): §2 « La note de ticket » (all its subsections), §3.1 and §3.2 (what is an invariant), A.1 « Template de note ». Locate them with `Grep` pattern `<h[12]>` (`-n`) — headings have no `id` — then `Read` from the heading's line up to the next `<h1` (for §2) or the next `<h1`/`<h2`. Anything below that contradicts what you read → follow the guide, and add one line `gear-prompt-specs-to-feature-note à mettre à jour : <point>.` No guide file → say so and stop.

Read `AGENTS.md` too: its layers (`app/`, `core/`, `helpers/`, `technicals/`, in `src/main/` and in `src/renderer/`; `src/preload/`, `src/shared/bridge`) are the vocabulary of « Ce que ça touche » and « Forme ». `SPEC.md` holds the expected behaviour (F-…), the invariants (I-…) and the scenarios (S-…): cite their ids when a line of the note refers to one, and reuse an existing invariant rather than restating it.

## Never invent

- Every line of the note comes from the prompt, from the existing code, or from an existing note. Nothing else.
- A section the prompt says nothing about → leave it out (the guide fills only the sections that serve the ticket). Exception: « Ce que ça touche », which you may fill from the code (below).
- « Forme »: the developer names modules and signatures (§2). Write it only from what the prompt states, as `<path>  expose … · ne connaît pas … · utilisé par …`. Nothing stated → leave the section out and say so in chat.
- Something unclear, contradictory or missing (a number, a limit, who can do what) → it is an open question: in chat, not in the note (§2: open questions are not a section).

## Clean up the dictation

- Fix obvious transcription errors, using the repo's vocabulary: names from `AGENTS.md`, `README.md`, file and folder names (`Grep`/`Glob` to check a term). A doubtful fix → keep the word and ask in chat.
- Drop hesitations, repetitions and abandoned ideas; keep the last version of each decision.
- Final state only, no history (« on avait dit… » goes away). The why of a choice, when the user gave one, in parentheses.
- French, short sentences, present tense, technical terms in backticks. UI labels as in the app (in French here), in italics.

## Steps

1. **Version**: this repo has no ticket id; a note is named after the version that ships it. From the arguments; otherwise the version of the notes already on the branch (`git diff --name-only master...HEAD -- docs/tickets`, plus untracked ones); otherwise the next patch of `package.json`'s version for a bug, the next minor for the rest. Not sure → ask once.
2. **Type** (§4.2): feature, amélioration, bug, migration or refonte, from what the prompt describes. Shapes the note:
   - bug → short: the symptom, how to reproduce, what the fix must not break. Mini bug → no note: say so and stop.
   - amélioration → read the existing code first (`Grep` the terms of the prompt): the main risk is duplicating existing logic. Name what already exists in « Ce que ça touche ».
   - refonte → the target behaviour and what may break must be written; missing → open question.
3. **Ce que ça touche**: the modules, routes, files the prompt points to, checked in the repo (a path you write must exist, or be marked « à créer »).
4. **Ce que ça ne doit pas faire**: one line per constraint, each marked as in §3.1's table:
   - `→ invariant` only if critical **and** invisible on screen (§3.2's three questions). Business invariants (rôles, données d'un autre utilisateur, coûts GPU…) → `→ invariant (à décider à plusieurs)`.
   - `→ variant suffit`, `→ vu en review` (visible on screen), `→ structure` (imports, file headers, lint).
5. **Où ça casse**: only volumes or loads the prompt gives. A volume that matters but is unknown → open question (« on mesure avant de coder »).
6. **Pistes pour plus tard**: what the prompt postpones or hesitates about without deciding.

## The file

In the repo, as the guide says (§2): `docs/tickets/<type>/<version>-<slug>.md`, committed with the code — never in the Obsidian vault.
- `<type>` = the Conventional Commits type: `feat` (feature, amélioration), `fix` (bug), `refactor` (refonte), `chore` (migration).
- `<slug>` = a few words of the title, lowercase, hyphens, no accents (`son-reste-coupe`).

A note for this ticket already exists (`Glob` `docs/tickets/*/*-<slug>.md`, or a note on the same subject among those of the version) → it is a living note: update it in place with `Edit`, keep what the prompt doesn't change, and list in chat what the prompt replaced.

Layout (template A.1, empty sections removed, no front matter):

```
# <version> — <titre>

## Ce que ça fait
## Ce que ça ne doit pas faire
## Où ça casse
## Ce que ça touche
## Forme
## Pistes pour plus tard
```

## Output in chat

Minimum: no recap of the note, the user reads the file.
```
Note : <path>
Questions ouvertes : (à régler en appel, §2)
1. <question>
À vérifier : <corrected terms you were unsure of, or « Forme à poser : c'est toi qui nommes les modules (§2). »>
```
Omit a line with nothing to say.
