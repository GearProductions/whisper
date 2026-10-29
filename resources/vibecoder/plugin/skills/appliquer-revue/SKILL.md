---
name: appliquer-revue
description: "Apply the remarks of <out>/ponytail.md judged right (all of them, or the given ones), each as a fixup of the commit that owns the code, say which ones are discarded and why, and record the applied ones in <out>/ponytail-applied.json."
argument-hint: "<lang> <out> [remark…]"
disable-model-invocation: true
model: sonnet
effort: high
---

# Apply the review

`$ARGUMENTS` = `<lang> <out> [remark…]`. `lang`: the user's language, of your answer. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it). `remark…`: everything after `out`, optional — only this remark (or these); empty: all of `<out>/ponytail.md`.

1. Apply the remarks of `<out>/ponytail.md` that you judge right, each as a fixup of the commit that owns the code (`/gear-fix-up` if it exists), adding nothing else.
2. Write `<out>/ponytail-applied.json`: `{"applied":["<file>:L<line>", …]}`, the address heading each applied remark, plus those it already holds if it is newer than `ponytail.md`. Valid JSON.

Change nothing else. Answer in `lang`: which remarks you discard and why.
