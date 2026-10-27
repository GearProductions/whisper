// Invariant d'« Ouvrir un terminal ici ». Protégé : si un test échoue,
// corriger le code.
//   Note 0.12.0 docs/tickets/feat/0.12.0-worktrees.md, « Ce que ça ne doit pas
//   faire » : « Lancer le terminal par un shell (I-27) ». Le dossier de
//   l'agent n'est jamais découpé ni interprété : un argument entier à la place
//   de {dir}, ou le répertoire courant du terminal.
// Sur du réel : un faux terminal (script) qui écrit son répertoire courant et
// ses arguments, lancé pour de bon — réglé, ou trouvé dans le PATH quand le
// réglage est vide. Sous Windows, pas de script exécutable : sauté.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { findTerminal } from 'technicals/editor';

const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-')));
const PATH = process.env.PATH;
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
afterEach(() => { process.env.PATH = PATH; });

const fresh = (name: string) => { const dir = path.join(tmp, `${Math.random().toString(36).slice(2)}`, name); fs.mkdirSync(dir, { recursive: true }); return dir; };
// Un faux terminal `file` : écrit son répertoire courant puis ses arguments, séparés par NUL, dans `out`.
function fakeTerminal(file: string, out: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `#!/bin/sh\nprintf '%s\\0' "$PWD" "$@" > '${out}'\n`, { mode: 0o755 });
  return file;
}
// Ce qu'a reçu le faux terminal : son répertoire courant, ses arguments.
async function received(out: string) {
  for (let i = 0; i < 100 && !fs.existsSync(out); i++) await new Promise((r) => setTimeout(r, 20));
  await new Promise((r) => setTimeout(r, 50)); // printf a fini d'écrire
  const [cwd, ...args] = fs.readFileSync(out, 'utf8').split('\0').slice(0, -1);
  return { cwd, args };
}
// Les fichiers PIRATE créés où que ce soit sous tmp ou dans le dossier courant.
const pirated = () => [...fs.readdirSync(tmp, { recursive: true }), ...fs.readdirSync(process.cwd())].map(String).filter((n) => path.basename(n) === 'PIRATE');

describe.skipIf(process.platform === 'win32')('le terminal, lancé sans shell (I-27)', () => {
  it('réglé avec {dir} : un dossier avec espaces arrive en un seul argument, à la place de {dir}', async () => {
    const out = path.join(tmp, 'out-espaces');
    const dir = fresh('un dossier avec espaces');

    findTerminal(`"${fakeTerminal(path.join(tmp, 'bin-a', 'term'), out)}" --workdir {dir}`)!.open(dir);

    // les arguments réglés, le dossier tel quel à la place de {dir}
    expect((await received(out)).args).toEqual(['--workdir', dir]);
  });

  it('réglé avec {dir} : « ; touch PIRATE » dans le dossier n’est pas exécuté', async () => {
    const out = path.join(tmp, 'out-point-virgule');
    const dir = fresh('dossier; touch PIRATE');

    findTerminal(`"${fakeTerminal(path.join(tmp, 'bin-b', 'term'), out)}" --workdir {dir}`)!.open(dir);

    // le dossier arrive tel quel
    expect((await received(out)).args).toEqual(['--workdir', dir]);
    // rien n'a été exécuté
    expect(pirated()).toEqual([]);
  });

  it('réglé avec {dir} : « $(…) » et « `…` » dans le dossier ne sont pas exécutés', async () => {
    const out = path.join(tmp, 'out-substitution');
    const dir = fresh('dossier$(touch PIRATE) `touch PIRATE`');

    findTerminal(`"${fakeTerminal(path.join(tmp, 'bin-c', 'term'), out)}" --workdir {dir}`)!.open(dir);

    // le dossier arrive tel quel
    expect((await received(out)).args).toEqual(['--workdir', dir]);
    // rien n'a été exécuté
    expect(pirated()).toEqual([]);
  });

  it('réglé sans {dir} : lancé au dossier, ses arguments tels qu’écrits, le dossier dans aucun', async () => {
    const out = path.join(tmp, 'out-sans-dir');
    const dir = fresh('dossier && touch PIRATE');

    findTerminal(`"${fakeTerminal(path.join(tmp, 'bin-d', 'term'), out)}" -e distrobox enter dev`)!.open(dir);
    const got = await received(out);

    // son répertoire courant : le dossier
    expect(got.cwd).toBe(dir);
    // ses arguments : ceux du réglage, sans le dossier
    expect(got.args).toEqual(['-e', 'distrobox', 'enter', 'dev']);
    // rien n'a été exécuté
    expect(pirated()).toEqual([]);
  });

  it('réglage vide : le premier terminal trouvé, lancé au dossier, rien d’exécuté', async () => {
    const out = path.join(tmp, 'out-trouve');
    const bin = path.join(tmp, 'bin-e');
    fakeTerminal(path.join(bin, 'konsole'), out);
    process.env.PATH = `${bin}${path.delimiter}${PATH}`;
    const dir = fresh('dossier; touch PIRATE');

    findTerminal('', 'linux')!.open(dir);
    const got = await received(out);

    // son répertoire courant : le dossier
    expect(got.cwd).toBe(dir);
    // rien n'a été exécuté
    expect(pirated()).toEqual([]);
  });
});
