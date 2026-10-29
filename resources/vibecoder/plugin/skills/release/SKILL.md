---
name: release
description: "Publish the official release following the project's own procedure, deleting pre-releases only after the user agrees."
argument-hint: "<lang> <out>"
disable-model-invocation: true
model: sonnet
effort: medium
---

# Official release — the project's procedure

`$ARGUMENTS` = `<lang> <out>`. `lang`: language of your answer. `out`: the agent's output folder: nothing to write there.

## Find the procedure — never invent one

As for a release candidate: `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/`, the CI workflows (which tags publish what), the user's own instructions in your context (CLAUDE.md, memory), and how the last versions were made (version commits and PRs in `git log --oneline`, `gh release list`). No procedure → say so and stop.

## Steps — as the procedure says; typically

1. Ready? The feature's PR is merged into the base, the base's CI is green, the release candidate was tested by the user. Otherwise say what is missing and stop.
2. The version bump as the project does it (manifest, changelog, a dedicated branch and PR such as `chore/version-<X.Y.Z>`): commit, push, open its PR. The user merges PRs unless they told you otherwise: wait for their go.
3. Once the bump is merged: `git switch <base> && git pull --ff-only`, `git tag v<X.Y.Z>`, `git push origin v<X.Y.Z>`. Never move an existing tag.
4. Wait for the CI; failure → find the cause, report, stop. Check the release (`gh release view v<X.Y.Z>`): its assets, not marked as a pre-release.
5. Install it for the user as for a release candidate, keeping the previous version. Never close, kill or restart the running app — you may be running inside it.
6. The pre-releases of this version (`gh release list`, `git tag -l 'v<X.Y.Z>-rc.*'`): list them and ask. Only after an explicit yes: `gh release delete <tag> --cleanup-tag --yes`, one per tag.

Never `git push --force`.

## Answer

In `lang`: the version, the release's link, what is installed, what you are waiting for (a merge, an agreement to delete).
