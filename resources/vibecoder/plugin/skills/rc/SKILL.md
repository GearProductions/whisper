---
name: rc
description: "Publish a release candidate following the project's own procedure, wait for its CI and install it for the user beside the current version, asking before deleting anything."
argument-hint: "<lang> <out>"
disable-model-invocation: true
---

# Release candidate — the project's procedure, installed for the user

`$ARGUMENTS` = `<lang> <out>`. `lang`: language of your answer. `out`: the agent's output folder: nothing to write there.

## Find the procedure — never invent one

What the project says about pre-releases and release candidates: `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/`, the CI workflows (`.github/workflows/`: which tags build and publish what) — and the user's own instructions in your context (CLAUDE.md, memory: where and how they install a test version). No procedure → say so, say what the project's CI would allow, and stop.

## Steps — as the procedure says; typically

1. Ready? The branch's PR is open, its CI green, no `fixup!` commit left, everything pushed. Otherwise say what is missing and stop.
2. The tag: the version that will ship (the note's name, the project's manifest, the last tags) with the next `-rc.<N>` (`git tag -l 'v<version>-rc.*'`): `git tag v<version>-rc.<N>` on the branch's HEAD, then `git push origin v<version>-rc.<N>`. Never move or delete an existing tag.
3. Wait for the CI it starts (`gh run watch <id> --exit-status`, or `gh run list`). Failure → find the cause (as the `ci` skill does), report, stop.
4. Install it for the user as their instructions say: download the artifact (`gh release download <tag> --pattern …`), put it beside the current version, keep the previous one as a backup, then switch what points to the current one (a symlink, a shortcut). Never close, kill or restart the running app — you may be running inside it: the user restarts it themselves.
5. Ask before deleting anything: older release candidates, tags, files.

Never `git push --force`.

## Answer

In `lang`: the tag, the CI result, where it is installed, how to go back to the previous version, what to try first.
