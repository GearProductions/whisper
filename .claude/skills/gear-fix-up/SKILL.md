---
name: gear-fix-up
description: "Fold corrections into the right branch commit, following the 'Développer avec l'IA' guide (§5.3). Usage: /gear-fix-up [status|fold|help]. With no argument: routes each pending change to the branch commit that owns it and creates the `git commit --fixup` commits. `fold` replays them into their targets (autosquash rebase on master) before opening the PR. `status` lists what is pending. `help` explains everything doable with fixups. Refuses to rewrite history once the PR is open. Use when I say 'fixup', 'replier', 'corriger un commit précédent', 'j'ai modifié un module déjà commité', 'autosquash'."
argument-hint: "[status|fold|help]"
allowed-tools: Bash, Read, Glob, Grep, AskUserQuestion
---

# Fixups — guide §5.3

Rule of the guide: a module already committed gets corrected **in its own commit**. Before the PR: fixup, then fold. After the PR is open: an ordinary new commit (→ `/gear-commit-message`), never a rewrite.

In this repo, PRs are merged with a merge commit, **not squashed**: every branch commit lands on `master` as is. Where the guide counts on the final squash to clean up, here nothing does — a `fixup!` must be folded before the merge.

Output: terse. One line per action done, the commands you ran, one warning line max. No explanation unless `help`. Fixed strings below are French: translate them if the user writes in English.

## The guide wins

Before any plan (not for `help`), read §5.3 « Corriger un commit précédent » of the guide `docs/dev_guide/guide-travail-dev-ia.html` (repo root): locate it with `Grep` pattern `<h[12]>` (`-n`), then `Read` from the heading's line up to the next `<h1` or `<h2`. Heading missing → find the section by its title in that index. The merge without squash (above) is this repo's choice, not a contradiction. Anything else in this skill that contradicts the guide → follow the guide, and add one warning line `gear-fix-up à mettre à jour : <point>.` No guide file → say so and stop. The confirmation rule below stays, whatever the guide says.

## Plan, then confirm, then run — always

Nothing that writes to git (add, commit, rebase, reset, push) runs before an explicit yes:

1. **Plan**: the exact commands, in order, in one code block, each followed by a short `# <what it does>` comment. Add the targets (`<sha> <subject> ← <files>`) and the files left aside.
2. **Confirm**: one `AskUserQuestion` — « Je lance » / « J'annule » (a third option when relevant, e.g. « Sans le push »). « Other » lets the user amend the plan: rebuild it and ask again.
3. **Run** exactly the confirmed commands, nothing more. A command fails or the state differs from the plan → stop, show the error, rebuild a plan.

Read-only commands (log, status, diff) need no confirmation. One confirmation covers one plan: a follow-up action (fold after the fixups, push after the fold) gets its own plan and its own yes.

## Step 0 — State (one Bash call; skip for `help`)

Every command of this skill (probe and plans) runs from the repo root, so paths from `git status` match the `git add`/`commit` lines:

```bash
cd "$(git rev-parse --show-toplevel)"
git branch --show-current; git status --short
git log --format='%h %s' master..HEAD
gh pr view --json state -q .state 2>/dev/null
git rev-parse --verify -q '@{u}' >/dev/null && echo pushed
```

- On `master` → `Tu es sur master : pas de fixup ici.` Stop.
- No commit on the branch → `Aucun commit à corriger : c'est un premier commit (/gear-commit-message).` Stop.
- PR `OPEN` → `PR ouverte : pas de fixup, nouveau commit avec le pourquoi (/gear-commit-message).` Stop (`status` still runs, it writes nothing), unless the user explicitly insists on rewriting (then see « PR ouverte » below).
  PR open **with `fixup!` commits already on the branch** (opened before folding) → `Fixups déjà dans la PR : sans squash, ils arriveraient sur master. À replier avant la fusion.` Folding them is a rewrite: propose it (see « PR ouverte » below), the user decides.
- `gh` unavailable → assume no PR, and say so in the warning line.

## No argument — create the fixups

1. For each changed file (staged, unstaged, untracked), find its owner: `git log --format=%h master..HEAD -- <file>`.
   - Note file (`docs/tickets/**`) → the first commit of the branch.
   - One owner → that commit.
   - Several owners → the file's hunks may belong to different modules: ask with one `AskUserQuestion` (the owners as options, subjects shown).
   - No owner (new file, or file untouched by the branch) → not a fixup. List it under `Nouveau module, pas un fixup (/gear-commit-message) :` and keep it out of every fixup.
2. Plan one command line per target, then confirm and run (see « Plan, then confirm, then run »):
   ```bash
   git add -- <files> && git commit --fixup <sha> -- <files>   # <subject of sha>
   ```
   The `-- <files>` on the commit keeps anything already staged from leaking into the wrong commit.
   If the change alters what a module exposes: its file header (Ne connaît pas / Utilisé par…) must be in the same fixup (§2 « La forme : dans la note et en tête des fichiers »), and the contract in the target's message is now wrong → propose `--fixup=amend:<sha>` with the updated contract.
3. End with: `Avant la PR : /gear-fix-up fold`.

Special fixups, only when the user asks:
- Change the target commit's **message** too (e.g. its contract lines): `git commit --fixup=amend:<sha>` — the fold replaces the target message with the fixup's.
- Change **only** the message, no content: `git commit --fixup=reword:<sha>`.
- Split one file between two commits: stage hunks non-interactively is not possible here — tell the user to run `git add -p <file>` themselves, then rerun `/gear-fix-up`.

## `status`

List `fixup!`/`squash!`/`amend!` commits not yet folded (`git log --format='%h %s' master..HEAD | grep -E '^[0-9a-f]+ (fixup|squash|amend)!'`), then pending changes with their owner (same routing as above, but create nothing). Nothing pending → `Rien à replier.`

## `fold` — replay fixups into their targets

1. Nothing to fold → `Rien à replier.` Stop.
2. Plan: the fixups to fold, each with its target (`fixup! X → <sha> X`), and the command:
   ```bash
   GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash --autostash master   # replie les fixups dans leurs cibles
   ```
   Dirty working tree → say that `--autostash` sets the changes aside and puts them back. Branch already pushed → say that a `git push --force-with-lease` will be needed afterwards (separate plan). Then confirm and run.
3. Success → show `git log --format='%h %s' master..HEAD`, then `Annuler : git reset --hard ORIG_HEAD`. If pushed: new plan with `git push --force-with-lease`, its own confirmation.
4. Conflict → do not resolve silently. Show the conflicted files and the commit being replayed, then offer: resolve it together (then `git add <files> && git rebase --continue`), or abort (`git rebase --abort`, back to the state before).

## PR ouverte: rewriting

The guide advises against it (§5.3), except here to fold `fixup!` commits that would otherwise land on `master`. Same plans and confirmations as above (fold, then push), with the line `Préviens le reviewer : il doit relire depuis le début.` in the push plan.

## `help`

Print this, as is:

```
Fixup = corriger un commit précédent de la branche sans commit « fix ».
Avant la PR ouverte : fixup puis repli. Après : nouveau commit avec le pourquoi.
Ici, pas de squash à la fusion : un fixup! non replié arrive sur master.

/gear-fix-up          route chaque changement vers son commit et crée les fixups
/gear-fix-up status   ce qui reste à replier / à router
/gear-fix-up fold     replie les fixups (rebase autosquash sur master)

À la main :
git commit --fixup <sha>          corrige le contenu de <sha>
git commit --fixup=amend:<sha>    contenu + message de <sha>
git commit --fixup=reword:<sha>   message de <sha> seulement
GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash master   replie tout
git reset --hard ORIG_HEAD        annule le dernier repli
git rebase --abort                abandonne un repli en conflit
Alias (optionnel) : git config --global alias.fixups '!GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash'
CI (optionnel) : git log --format=%s master..HEAD | grep -E '^(fixup|squash|amend)!' && exit 1

Ne jamais : checkout d'un ancien commit + amend (les suivants ne s'appliquent plus).
```

## Never

- Rebase, reset or push without the conditions above. `git push --force` without `--force-with-lease`, ever.
- Install the global alias unless asked.
- Put a new module in a fixup: that's a new commit.
