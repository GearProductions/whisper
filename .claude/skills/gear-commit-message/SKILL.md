---
name: gear-commit-message
description: "Build the commit message for the pending changes following the commit convention of the 'Développer avec l'IA' guide (§5.2), as practised in this repo, and copy it to the clipboard. Usage: /gear-commit-message [pr]. Detects the case from git state: first commit of the branch (note + forme + invariants, or the red test of a bug), one module commit with its contract, a change to an already-committed module (before the PR: redirects to /gear-fix-up; after: new commit with the why), or the PR title and description with `pr` (PRs are merged without squash here). Never runs git commit. Use when I ask for a commit message, 'message de commit', or the PR title/description."
argument-hint: "[pr]"
allowed-tools: Bash, Read, Glob, Grep
---

# Commit message — guide convention (§5.2), whisper-dictation style

Produce the message, copy it to the clipboard, show it. **Never run `git commit`, `git rebase` or `git push`.**

Output: the message in a code block, then one line `Copié.` — plus at most one warning line. No explanation.

## The guide, then this repo

Before building the message, read the guide `docs/dev_guide/guide-travail-dev-ia.html` (repo root): §5.2 « Les commits racontent le design », plus §4.2 « Par type de ticket » for case A and §5.3 « Corriger un commit précédent » for case C. Locate them with `Grep` pattern `<h[12]>` (`-n`), then `Read` from the heading's line up to the next `<h1` or `<h2`. Heading missing → find the section by its title in that index. No guide file → say so and stop.

The guide gives the principles (one commit per module, the first commit holds note + forme + invariants, the contract in the message). This repo has its own **format**, described below: where the guide's format differs (`chore(<TICKET>)`, `exposes:` lines, ticket ids, final squash), follow this file — it is not a contradiction to report. Anything else below that contradicts the guide → follow the guide, and add one warning line `gear-commit-message à mettre à jour : <point>.`

## Convention of this repo

- No ticket id. The ticket is its note: `docs/tickets/<type>/<version>-<slug>.md` (type = `feat`, `fix`, `refactor`, `chore`). Branches: `<type>/<slug>`.
- Everything in French, typographie française (espace avant `:`, guillemets « »).
- Subject: `<module> : <ce qui change, une ligne>`. Module = its path from `src/`, without `src/` (`main/core/sound`, `main/app`, `shared`); for the pages, the window or module name is enough (`panel`, `icon`, `core/speech`). Not a module (CI, scripts, bench) → a short name: `CI : …`, `Banc du principal (tests/main-diff)`.
- Body: the module's contract in prose, 1 to 5 lines wrapped at 72 columns — what it exposes and does, what it does not know, who uses it — then, if useful, what the commit settles (the invariant it turns green, a choice made). Plain sentences, no `exposes:` labels. A list (`- …`) when the commit holds several pure files.
  ```
  main/core/sound : rétablir une application dont le flux a disparu ; dépannage

  Les flux coupés gardent leur identité (celle sous laquelle WirePlumber
  retient la coupure). Un flux disparu avant d'être rétabli laisse son
  application « à rétablir » : son prochain flux est rétabli (heal), jamais
  pendant une dictée. L'invariant du bug passe.
  ```
- No `wip`, `fix`, `retry` commits: iterations go into the module's commit.
- No `Co-Authored-By` line: it is added by whoever commits, not by this skill.

## Step 1 — Gather (one Bash call)

Run from the repo root, so that file paths and `docs/tickets/` resolve the same way everywhere:

```bash
cd "$(git rev-parse --show-toplevel)"
git branch --show-current; git rev-list --count master..HEAD; git log --format='%h %s' master..HEAD
git status --short; git diff HEAD --stat
git diff --name-only master...HEAD -- docs/tickets; git status --short -- docs/tickets
gh pr view --json state -q .state 2>/dev/null
```

- Working tree clean → `Rien à commiter.` and stop (not with `pr`: it works on the commits).
- On `master` → warn `Tu es sur master : crée une branche de ticket d'abord.` and stop.
- PR open = `gh` returns `OPEN`. `gh` unavailable → assume not open and say so in the warning line.

Find the ticket note, in this order: `docs/tickets/*/*-<slug>.md` with the branch slug (`refactor/main-typescript` → `*-main-typescript.md`); else the note added or changed on the branch or in the working tree; several or none → ask which one. Version = the note's filename prefix (`0.5.0`), type = its folder. Read its « Forme » section when a contract is needed.

## Step 2 — Pick the case

For each changed file, `git log --format=%h master..HEAD -- <file>` tells whether an earlier branch commit already owns it. Some files owned, others not → split: `Fixup pour <owned files> : /gear-fix-up`, then case B for the rest.

**A. First commit** (count = 0). Expected content depends on the ticket type (§4.2, note folder or branch prefix):
- `feat`, `refactor`, `chore` → the note with its « Forme », file headers or skeletons, the red invariants for the lines marked `→ invariant`:
  ```
  <version> : note, forme et invariants du <sujet>

  Note : <note path>. Invariants (rouges) : <invariants folders>.
  ```
  Note or « Forme » missing → warning `Le 1er commit devrait contenir la note et la forme, plus les invariants rouges s'il y en a (§5.2).`
- `fix` → the failing reproduction test (an invariant when the note marks it so), plus a short note unless it's a mini bug:
  ```
  Bug : <symptôme, une ligne> (invariant, rouge)

  <cause connue, depuis quand, où on l'a vu>. Invariant écrit avant le
  correctif : il échoue.
  ```
  No test → warning `Un bug commence par un test qui échoue avant le fix (§4.2).`
- `chore` (migration) → the tests of what the library does for us, written against the old version.

**B. New module** (no changed file is owned by an earlier commit). One module + its variants.
- Contract, in order of preference: the module's block in the note's « Forme »; the header comment of its main file (ce qu'il fait, ce qu'il ne connaît pas, qui l'utilise); otherwise what the diff exports, with the warning `Contrat absent de la note et de l'en-tête.` Never invent a boundary.
- Diff over 400 lines → warning `> 400 lignes : module probablement trop gros (§5.1).` A big module may be split into several coherent commits, never code on one side and its tests on the other.
- Changes span several modules (unrelated folders, or pages + principal) → don't build one message. Warning: `Un commit par module (§5.2) :` followed by one line per group of files, and stop.
- Only docs (`SPEC.md`, `README.md`, `AGENTS.md`, the note) → `<version> : doc` or `Doc : <sujet> (<SPEC ids> ; README ; note)`, the body listing what each document gained.

**C. Change to an already-committed module**:
- PR **not open** → no message: it's a fixup. Output only `Fixup, pas un nouveau commit : /gear-fix-up` and stop.
- PR **open** → ordinary commit (§5.3), the why in the body, the note mention if it changed:
  ```
  <module> : <ce qui change>

  <pourquoi, découvert en faisant quoi>. Note à jour (« <rubrique> »).
  ```

**D. `pr` argument** — PRs are merged with a merge commit, not squashed: the branch commits stay on `master`, and the PR carries the summary the guide puts in the squash message. Produce its title and description, shaped like the previous PRs (`gh pr view <n> --json title,body` on the last merged one if in doubt):
- Title: `<version> : <titre de la note>`.
- Body, in Markdown:
  ```
  ## Ce que ça fait

  <la rubrique « Ce que ça fait » de la note, résumée>

  Note du ticket : `<note path>`.

  ## Forme

  - `<module>` : <contrat en une ligne>   ← one line per module commit of the branch

  ## Invariants

  - <invariant> (<ids SPEC>)              ← only if the branch adds or changes some
  ```
- `fixup!`, `squash!` or `amend!` commits still on the branch → warning `Fixups non repliés : ils arriveraient sur master (/gear-fix-up fold).`

## Step 3 — Clipboard

Write the text to a temp file and copy it, so multi-line text and non-ASCII characters survive:
- Linux: `wl-copy < <file>` or `xclip -selection clipboard < <file>`
- Windows: `powershell -NoProfile -Command "Get-Content -Raw -Encoding UTF8 <file> | Set-Clipboard"`
- macOS: `pbcopy < <file>`

No clipboard tool → skip the copy and say `Non copié.`
