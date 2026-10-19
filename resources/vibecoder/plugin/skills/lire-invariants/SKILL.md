---
name: lire-invariants
description: "Read invariant test files and write, for each test case, a plain given / when / then pseudo-code the developer can validate in seconds whatever the test's language, into <out>/invariants/<blob>.md."
argument-hint: "<lang> <out> <ref> <path@blob>…"
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: "Read, Glob, Grep, Write, Bash(git show *), Bash(git rev-parse *), Bash(git diff *)"
---

# Read the invariants in pseudo-code

The developer validates each invariant from your reading, often without reading the test's language (Rust, Python…). When tests are hard to read, the review gets skipped: your reading is what makes it happen. Be faithful — an assertion you drop or soften is a property they will believe is checked.

## Arguments

`$ARGUMENTS` = `<lang> <out> <ref> <items…>`:
- `lang` (`fr` or `en`): the user's language — not used here: readings and your answer are always in English (code, even pseudo-code, stays in English);
- `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces);
- `ref`: `WORKTREE` → read each file from disk at `<repo root>/<path>`; otherwise a git ref → `git show <ref>:<path>`;
- items: `<path>@<blob>` separated by spaces — path relative to the repo root, blob = 40 or 64 hex characters; a path may contain spaces: an item ends at its `@<blob>`.

For each item, write `<out>/invariants/<blob>.md` — always named after the blob you received, never one you compute; if it already exists, read the test again and overwrite it (the developer asked for a new reading) — and nothing else, anywhere. Don't run the tests. To name the note lines, read the ticket note's « Ce que ça ne doit pas faire » once if it is easy to find (under `docs/tickets/`, named like the branch).

## Format — one file per test file

````markdown
# <path>

## <case title, copied EXACTLY>

```pseudo
test "<what it checks, in plain words>":
    given …
    and …
    when …
    then …   # <exact expected value or relation, when it helps>
    and …
```

Edge cases:
- …
Guarantees: <the property>
Warning: <only when warranted>
````

Everything in English — the `test "…"` line, the steps, comments, edge cases, guarantees, warning — whatever `lang` and the test's language; only the `##` case titles and quoted note lines stay as written. Those lines follow each other without blank lines, as shown. Nothing else in the file: no intro, no summary.

- **One `##` per test case**, in source order: TS/JS each `it(…)` / `test(…)` (also `.skip`, `.skipIf(…)`, `.each`); Rust each `#[test]`, `#[tokio::test]`, `#[rstest]` fn; Python each `def test_…`. The title exactly as in the source: the text between the quotes (not the `describe`), the fn name for Rust (not its `mod` path), the def name for Python, a parameterized title as its template (`%s`). The screen matches cases by this title: never translate, fix or shorten it. No case in the file → the `#` line and « No test case. »
- **Pseudo-code**, in English, read like plain Python-ish steps: a `test "…":` line, then indented lines that each start with `given`, `when`, `then` or `and` (an `and` continues the step above it). No `const`, no `() =>`, no braces, no semicolons, no `expect(…)` chains; as few calls as possible — say what happens (« when we spend 20 more »), not the function's signature. Abstract the plumbing — setup, harness, helpers, temp dirs, async/await, types, `unwrap()`, `?`, clones, imports — into `given`. Keep **every input that matters** (the values that make the case: the limit, the payload, the user) literally, with its value. One `test` per case: a loop or a table over inputs becomes one `test` per input.
  - **Each assertion is one `then` line** (the next ones: `and`), in plain words, in source order; never merge two assertions, never drop one. After `#`, the exact expected value or relation when the words alone could hide it (`# status is 413`, `# result is null`, `# count < 10`, `# error: QuotaExceeded`);
  - `assert_eq!(a, b)`, `assert a == b` → `then <a> is <b>`; `assert_ne!` → `then <a> is not <b>`; `assert!(cond)` → the relation it states (`contains`, `is less than`…), never « is true »;
  - an expected error (`Err(…)`, `#[should_panic]`, `pytest.raises`, `toThrow`) → `then it fails with <which>`.
- **Edge cases**: the edge cases this test exercises, each with its input (empty, exactly at the limit, one past it, special characters…). None → omit the block.
- **Guarantees**: the property the assertions observe, in one sentence — not what the title or the note promises beyond them (that gap is a `Warning`); quote the note line verbatim (« … → invariant ») only if you read it, never a made-up one, or the project's id (`I-…`, often in the file's header comment) when you recognise it.
- **Warning**: only if the test does not truly observe the property — the system under test is mocked; a loop inside a single test hides which input fails; an exact value where the property is a relation, an absence or a bound; an assertion too weak (one channel checked when the property covers all, `is_ok` checked but not the content); a case skipped on a platform the product runs on (a skip for another implementation or an old server, e.g. `if other_server() { return; }`, goes once in `given`, never in `Warning`); a « the test is not empty » guard that the setup or another request already satisfies (for each such guard, list the requests made before it, setup included, and check whether one already satisfies it); a helper broader than its comment (any DELETE, any request); a setup that makes the assertion pass whatever the code. Never for a test that fails or cannot compile because the code under test does not exist yet: invariants are written red, before the code (guide §3.5) — that is expected. One concrete sentence naming the faulty code that would pass; if you can't, or another case of the file catches it, omit the line. Check the helpers and the code instead of guessing. No reassurance, no style remarks, no description of the fake, never the same sentence on every case.

## Example (TypeScript, French titles)

Source:

```ts
it('un upload au-delà de la limite est refusé', async () => {
  const app = await startApp({ maxUpload: 1024 * 1024 });
  const res = await upload(app, Buffer.alloc(1024 * 1024 + 1));
  expect(res.status).toBe(413);
  expect(await storedFiles(app)).toHaveLength(0);
});
```

Reading:

````markdown
## un upload au-delà de la limite est refusé

```pseudo
test "a file larger than the limit is not stored":
    given the real app with an upload limit of 1 MB
    when we upload a file of 1 MB + 1 byte
    then the request is refused   # status is 413
    and no file is stored         # stored files: 0
```

Edge cases:
- 1 byte past the limit
Guarantees: a file is never kept beyond the configured limit (note: « Garder un upload au-delà de la limite → invariant »)
Warning: nothing observes that reading stops at the limit: a server that reads the whole file before refusing would pass.
````

## Answer

In English, 1 to 3 lines: files read, cases, how many with a `Warning`.
