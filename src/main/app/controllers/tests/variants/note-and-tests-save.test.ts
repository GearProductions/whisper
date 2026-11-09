// Variants de la note et des tests d'invariants modifiables (note 0.11.0,
// docs/tickets/feat/0.11.0-editer-invariants-et-note.md) : l'id d'un variant ne se lit pas
// et n'est pas enregistrable (ni la note ni un test d'invariant) ; le test affiché n'est pas
// enregistré pendant Ponytail review ni un tour de la conversation.
// Déplacés tels quels de invariants/note-and-tests-save.test.ts (0.15.0), qui garde le verrou
// de la note (Écrire la forme, Ponytail review, forme arrêtée, un tour) et celui d'un test
// pendant Écrire les invariants.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le SDK de Claude
// Code factices, git réel sur un dépôt d'essai). Ce que la page voit d'un fichier : les
// conv:vibeCode poussés au panneau.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  click as press, closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, write, writeConfig,
} from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

let dir = '';

// Ce que la page reçoit : le relevé (conv:vibe) et le texte d'un fichier (conv:vibeCode).
type Survey = {
  note: { id: string; path: string } | null;
  invariants: { id: string; path: string }[];
  variants: { id: string; path: string }[];
};
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as Survey;
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as { id: string; text: string | null } | null);
// Les textes de fichier poussés à la page (null : trop gros ou illisible, pas un texte).
const texts = () => codes().flatMap((c) => (c && c.text !== null ? [c.text] : []));
// L'id que le dernier relevé donne à la note ; sans id, le cas ne peut pas commencer.
function noteId() {
  const n = survey().note;
  if (!n) throw new Error('le relevé ne donne aucune note');
  return n.id;
}
// L'id que le dernier relevé donne à ce test d'invariant, ou à ce variant.
function testId(rel: string) {
  const f = [...survey().invariants, ...survey().variants].find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// Les skills (ou premiers mots) des tours en cours.
const inProgress = () => claude.turns.filter((t) => !t.done).map((t) => t.skill);
// Le texte d'un fichier du dépôt.
const onDisk = (rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8');

const BRANCH = 'feat/0.11.0-essai';
const NOTE = `docs/tickets/${BRANCH}.md`;
const NOTE_TEXT = ['# 0.11.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const INV_TEXT = "import { it } from 'vitest';\nit('hello ne ment jamais', () => {});\n";
const VAR = 'src/core/hello/tests/variants/hello.test.ts';
const VAR_TEXT = "import { it } from 'vitest';\nit('hello dit bonjour', () => {});\n";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  const root = profile('whisper-note-tests-v-');
  // Le dépôt : un module sur main ; la branche ajoute sa note, un test d'invariant et un variant.
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: NOTE_TEXT });
  git(dir, 'checkout', '-q', 'main');
  write(path.join(dir, 'src/core/hello/index.ts'), 'HELLO_MAIN');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'main');
  git(dir, 'checkout', '-q', BRANCH);
  git(dir, 'rebase', '-q', 'main');
  write(path.join(dir, INV), INV_TEXT);
  write(path.join(dir, VAR), VAR_TEXT);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'invariants');
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
});
afterEach(closeAll);

// Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
const open = () => openPanel('a1');

// La page suit un fichier (affiché, modifiable ; null : plus rien d'affiché).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

// Un clic sur une action de l'écran (Écrire les invariants, Ponytail review…).
async function click(id: string, args: object = {}) {
  await press(id, args);
  await settle();
}

// Un message envoyé à la conversation par le champ : un tour commence.
async function ask(text: string) {
  const { sendDraft } = await import('app/controllers');
  sendDraft({ text });
  await settle();
}

// Enregistrer (Ctrl+S ou le bouton), tel que la page l'envoie ; ce que la page apprend.
async function save(id: unknown, text: unknown) {
  const { saveCode } = await import('app/controllers');
  const result = await saveCode(id, text);
  await settle();
  return result;
}

describe('un variant n’est ni lu ni enregistré par son id : ce n’est ni la note ni un test d’invariant (I-37, I-39, élargis)', () => {
  // Un variant est un test de la branche, mais ni la note ni un test d'invariant.
  it('l’id d’un variant de la branche : rien n’est lu', async () => {
    await open();

    await follow(testId(VAR));

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  // La note est affichée (un fichier qui se suit) : seul l'id du variant est refusé.
  it('la note affichée, l’id d’un variant : Enregistrer n’écrit rien', async () => {
    await open();
    await follow(noteId());

    await save(testId(VAR), 'VARIANT_ENREGISTRE');

    // témoin : la note est bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // le variant sur le disque est inchangé
    expect(onDisk(VAR)).toBe(VAR_TEXT);
    // la note sur le disque est inchangée
    expect(onDisk(NOTE)).toBe(NOTE_TEXT);
  });
});

describe('pas d’enregistrement d’un test pendant une course de l’agent ou un tour : le principal recalcule le verrou, sans se fier à la page', () => {
  it('un test, pendant Ponytail review (une lecture) : rien n’est écrit, Enregistrer est refusé', async () => {
    await open();
    await follow(testId(INV));
    await click('ponytail');

    const result = await save(testId(INV), 'TEST_ENREGISTRE');

    // témoin : le test est bien affiché
    expect(texts()).toContain(INV_TEXT);
    // témoin : la revue travaille
    expect(inProgress()).toContain('/vibecoder:ponytail');
    // le test sur le disque est inchangé
    expect(onDisk(INV)).toBe(INV_TEXT);
    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  it('un test, pendant un tour de la conversation : rien n’est écrit, Enregistrer est refusé', async () => {
    await open();
    await follow(testId(INV));
    await ask('corrige le test');

    const result = await save(testId(INV), 'TEST_ENREGISTRE');

    // témoin : le test est bien affiché
    expect(texts()).toContain(INV_TEXT);
    // témoin : le tour de la conversation travaille
    expect(inProgress()).toContain('corrige');
    // le test sur le disque est inchangé
    expect(onDisk(INV)).toBe(INV_TEXT);
    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });
});
