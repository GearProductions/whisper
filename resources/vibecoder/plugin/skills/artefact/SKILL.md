---
name: artefact
description: "Create or retouch an artifact: a document outside the project — a PDF, a presentation, a wireframe, an external document, a design file, a proof of concept — written in the project's artifacts folder, shown in VibeCoder's Artifacts panel, never in the project. Use when the user asks for such a document, or to change one already made."
argument-hint: "[what to make or change]"
---

# Artifacts (VibeCoder's Artifacts panel)

`$ARGUMENTS`: what to make or change; invoked without arguments, the user's request in the conversation. The artifacts folder is the additional working directory ending with `vibecoder-artifacts/<key>` (may contain spaces; call it `<dir>`), shared by every robot of the project: others write there too. Write in the user's language.

An artifact is a document that is not (yet) part of the project. The user sees it in the *Artifacts* panel, asks you here to retouch it, and copies it into the project with the panel's *Copy to project* button — not you.

## Where and how

- Only under `<dir>` (subfolders allowed). **Never touch the project**: no file written, moved or deleted in the repository, no git command that changes it, even to « prepare » the copy.
- One file per artifact, under a meaningful name in kebab-case with its true extension (`login-wireframe.html`, `pitch-deck.pdf`, `api-proposal.md`). No hidden file (starting with `.`), no link: the panel ignores them.
- **Retouch rather than add**: a request about an artifact that exists (the one shown, or named) changes that file in place; a new file only for a new document. List `<dir>` first, and read a file again right before writing it: another robot writing the same name writes the same file, so never overwrite what you have not just read.

## The formats the panel shows

- **A wireframe or a page**: one self-contained `.html` file, CSS inline (`<style>` or `style=`), images as `data:` URIs. No script, no remote resource (font, stylesheet, image, iframe, link to a CDN): the panel shows it without script nor network, so they would not load. Same for `.svg`.
- **A text document**: Markdown (`.md`), shown formatted.
- **A PDF, a presentation, an image**: produce the real file (`.pdf`, `.png`…) with the tools at hand, or, if none can, say so and propose a Markdown or HTML version (a presentation: one HTML page, one section per slide). Never install a dependency in the project for it.
- Any other file is shown as text.

## Answer

One or two lines: the file written or changed (its name under `<dir>`), and what is in it.
