// Invariants d'« Ouvrir dans l'éditeur ». Protégés : si un test échoue,
// corriger le code.
//   I-27 : le dossier part en UN argument, le dernier, tel quel : jamais
//          découpé ni interprété par un shell.
// I-29 (un échec ne fait jamais tomber l'appli) : ../variants/editor.test.ts.
// Sur du réel : un faux éditeur (script) qui écrit ses arguments, lancé
// pour de bon. Sous Windows, pas de script exécutable : sauté.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findEditor } from 'technicals/editor';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'editeur-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Un faux éditeur : écrit ses arguments, séparés par NUL, dans `out`.
function fakeEditor(out: string) {
  const file = path.join(tmp, `editeur-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(file, `#!/bin/sh\nprintf '%s\\0' "$@" > '${out}'\n`, { mode: 0o755 });
  return file;
}

async function waitFor(file: string) {
  for (let i = 0; i < 100 && !fs.existsSync(file); i++) await new Promise((r) => setTimeout(r, 20));
  await new Promise((r) => setTimeout(r, 50)); // printf a fini d'écrire
  return fs.readFileSync(file, 'utf8');
}

describe.skipIf(process.platform === 'win32')('le dossier, un seul argument (I-27)', () => {
  it.each([
    'un dossier avec espaces',
    'dossier; touch PIRATE',
    'dossier$(touch PIRATE)',
    "l'agent \"cité\" `touch PIRATE`",
    'dossier && touch PIRATE | cat > x',
  ])('%s', async (name) => {
    const out = path.join(tmp, `args-${Math.random().toString(36).slice(2)}`);
    const dir = path.join(tmp, name);
    findEditor(`"${fakeEditor(out)}" --nouvelle-fenetre`)!.open(dir);
    expect((await waitFor(out)).split('\0').slice(0, -1)).toEqual(['--nouvelle-fenetre', dir]);
    expect(fs.readdirSync(tmp).concat(fs.readdirSync(process.cwd()))).not.toContain('PIRATE');
  });
});
