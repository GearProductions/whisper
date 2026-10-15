---
name: lire-invariants
description: "Read invariant test files and write, for each test case, a Vitest-like pseudo-code the developer can validate in seconds whatever the test's language, into <out>/invariants/<blob>.md."
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
- `lang` (`fr` or `en`): language of the readings and of your answer;
- `out`: absolute path of the agent's output folder (ends with `vibecoder-out/<agent id>`, may contain spaces);
- `ref`: `WORKTREE` → read each file from disk at `<repo root>/<path>`; otherwise a git ref → `git show <ref>:<path>`;
- items: `<path>@<blob>` separated by spaces — path relative to the repo root, blob = 40 or 64 hex characters; a path may contain spaces: an item ends at its `@<blob>`.

For each item, write `<out>/invariants/<blob>.md` — always named after the blob you received, never one you compute — and nothing else, anywhere. Don't run the tests. To name the note lines, read the ticket note's « Ce que ça ne doit pas faire » once if it is easy to find (under `docs/tickets/`, named like the branch).

## Format — one file per test file

````markdown
# <path>

## <case title, copied EXACTLY>

```pseudo
it("<what it checks, in plain words>", () => {
  // étant donné : …
  // quand : …
  const x = …
  // alors : …
  expect(…).toBe(…)
})
```

Cas limites :
- …
Garantit : <the property>
Attention : <only when warranted>
````

In English: `// given: …`, `// when: …`, `// then: …`, then `Edge cases:`, `Guarantees:`, `Warning:`. Those lines follow each other without blank lines, as shown. Nothing else in the file: no intro, no summary.

- **One `##` per test case**, in source order: TS/JS each `it(…)` / `test(…)` (also `.skip`, `.skipIf(…)`, `.each`); Rust each `#[test]`, `#[tokio::test]`, `#[rstest]` fn; Python each `def test_…`. The title exactly as in the source: the text between the quotes (not the `describe`), the fn name for Rust (not its `mod` path), the def name for Python, a parameterized title as its template (`%s`). The screen matches cases by this title: never translate, fix or shorten it. No case in the file → the `#` line and « Aucun cas de test. » / « No test case. »
- **Pseudo-code**, in `lang`: abstract the plumbing — setup, harness, helpers, temp dirs, async/await, types, `unwrap()`, `?`, clones, imports — into the `étant donné` line. Keep **every assertion** and **every input that matters** (the values that make the case: the limit, the payload, the user), literally. One `it` per case: a loop or a table over inputs becomes one `it` per input. A one-line comment before each assertion.
  - `assert_eq!(a, b)`, `assert a == b` → `expect(a).toEqual(b)`; `assert_ne!` → `expect(a).not.toEqual(b)`;
  - `assert!(cond)` → the matcher that says it: `toContain`, `not.toContain`, `toBeLessThan`…; `toBe(true)` only as a last resort;
  - an expected error (`Err(…)`, `#[should_panic]`, `pytest.raises`, `toThrow`) → `expect(() => …).toThrow(<which>)`.
- **Cas limites**: the edge cases this test exercises, each with its input (empty, exactly at the limit, one past it, special characters…). None → omit the block.
- **Garantit**: the property the assertions observe, in one sentence — not what the title or the note promises beyond them (that gap is an `Attention`); quote the note line verbatim (« … → invariant ») only if you read it, never a made-up one, or the project's id (`I-…`, often in the file's header comment) when you recognise it.
- **Attention**: only if the test does not truly observe the property — the system under test is mocked; a loop inside a single test hides which input fails; an exact value where the property is a relation, an absence or a bound; an assertion too weak (one channel checked when the property covers all, `is_ok` checked but not the content); a case skipped on a platform the product runs on (a skip for another implementation or an old server, e.g. `if other_server() { return; }`, goes once in `étant donné`, never in `Attention`); a « the test is not empty » guard that the setup or another request already satisfies (for each such guard, list the requests made before it, setup included, and check whether one already satisfies it); a helper broader than its comment (any DELETE, any request); a setup that makes the assertion pass whatever the code. Never for a test that fails or cannot compile because the code under test does not exist yet: invariants are written red, before the code (guide §3.5) — that is expected. One concrete sentence naming the faulty code that would pass; if you can't, or another case of the file catches it, omit the line. Check the helpers and the code instead of guessing. No reassurance, no style remarks, no description of the fake, never the same sentence on every case.

## Example (TypeScript, `lang` = `fr`)

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
it("un fichier plus gros que la limite n'est pas stocké", () => {
  // étant donné : l'appli réelle, limite d'upload configurée à 1 Mo
  // quand : on envoie 1 Mo + 1 octet
  const res = upload(1 Mo + 1 octet)
  // alors : la requête est refusée
  expect(res.status).toBe(413)
  // alors : aucun fichier n'est stocké
  expect(fichiersStockés()).toHaveLength(0)
})
```

Cas limites :
- 1 octet au-delà de la limite
Garantit : un fichier n'est jamais gardé au-delà de la limite configurée (note : « Garder un upload au-delà de la limite → invariant »)
Attention : rien n'observe que la lecture s'arrête à la limite : un serveur qui lit tout le fichier avant de refuser passerait.
````

## Answer

In `lang`, 1 to 3 lines: files read, cases, how many with an `Attention`.
