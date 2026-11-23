---
name: appliquer-revue
description: "Apply the [agent] remarks of <out>/ponytail.md judged right (all of them, or the given ones; a [toi] one only if given), each as a fixup of the commit that owns the code (in a project that declares a simple history: all together in one ordinary commit « revue : … »), say which ones are discarded and why, and record the applied ones in <out>/ponytail-applied.json."
argument-hint: "<lang> <out> [remark…]"
disable-model-invocation: true
model: sonnet
effort: high
allowed-tools: "Read, Glob, Grep, Write, Edit, Bash(git add *), Bash(git commit --fixup *), Bash(git commit -m *)"
---

# Apply the review

`$ARGUMENTS` = `<lang> <out> [remark…]`. `lang`: the user's language, of your answer. `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces: quote it). `remark…`: everything after `out`, optional — only this remark, or these (the ones the user kept ticked, one per list line `- …`); empty: all the `[agent]` remarks of `<out>/ponytail.md`. A remark reads `` - `<file>:L<line>` [agent] — <tag>: … ``: the address first, then the label `[toi]` or `[agent]`. A `[toi]` remark (it needs the user's decision) is applied only if it is given.

1. History mode: read the project's commit convention (`AGENTS.md`, `CLAUDE.md`): the words « Historique simple » (« Simple history » in an English project) mean **simple history**; without them, the default below.
   Apply the remarks of `<out>/ponytail.md` that you judge right (see above for `[toi]`), adding nothing else. Default: each as a fixup of the commit that owns the code: edit the file, find its owner (`git log -1 --format=%h -- <file>`), `git add -- <file>`, `git commit --fixup <hash>`. Simple history: edit the files, don't look for an owner, `git add -- <the files>`, then **one ordinary commit** for all the applied remarks, `git commit -m "revue : <what the remarks changed>"` (never a fixup). Read and edit files with Read, Glob, Grep and Edit.
2. Write `<out>/ponytail-applied.json`: `{"applied":["<file>:L<line>", …]}`, the address heading each applied remark (read before the label, the label is not part of it), plus those it already holds if it is newer than `ponytail.md`. Valid JSON.

Change nothing else. Answer in `lang`: which remarks you discard and why.
