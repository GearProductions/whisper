// Invariants de la note et des tests d'invariants modifiables (note 0.11.0,
// docs/tickets/feat/0.11.0-editer-invariants-et-note.md, « Ce que ça ne doit
// pas faire ») :
//   - Enregistrer n'écrit que le fichier affiché — la note de la branche, ou
//     un test d'invariant de la branche qui existe déjà —, désigné par son id
//     dans le dernier relevé, jamais par un chemin, dans le dossier de
//     l'agent, et seulement au geste de l'utilisateur (l'exception
//     Enregistrer d'I-39 et la lecture d'I-37 élargies à la note et aux tests
//     d'invariants) ;
//   - pas d'enregistrement pendant une course de l'agent ni pendant un tour de
//     la conversation (le principal recalcule le verrou avant d'écrire, sans
//     se fier à la page : un cas par sorte de course).
// Les cas de l'id d'un variant et du verrou d'un test (Ponytail review, un tour) :
// variants/note-and-tests-save.test.ts (0.15.0).
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le
// SDK de Claude Code factices, git réel sur un dépôt d'essai, un lien réel qui
// sort du dossier de l'agent). Ce que la page voit d'un fichier : les
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
let secret = '';

// Ce que la page reçoit : le relevé (conv:vibe) et le texte d'un fichier (conv:vibeCode).
type Survey = {
  note: { id: string; path: string } | null;
  invariants: { id: string; path: string }[];
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
// L'id que le dernier relevé donne à ce test d'invariant.
function testId(rel: string) {
  const f = survey().invariants.find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// Les skills (ou premiers mots) des tours en cours.
const inProgress = () => claude.turns.filter((t) => !t.done).map((t) => t.skill);
// Ce que git voit changé dans le dépôt de l'agent.
const changed = () => git(dir, 'status', '--porcelain');
// Le texte d'un fichier du dépôt.
const onDisk = (rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8');
// Un fichier remplacé par un lien qui mène hors du dossier de l'agent.
const linkOut = (rel: string) => { fs.rmSync(path.join(dir, rel)); fs.symlinkSync(secret, path.join(dir, rel)); };

const BRANCH = 'feat/0.11.0-essai';
const NOTE = `docs/tickets/${BRANCH}.md`;
const NOTE_TEXT = ['# 0.11.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const INV_TEXT = "import { it } from 'vitest';\nit('hello ne ment jamais', () => {});\n";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  const root = profile('whisper-note-tests-');
  // Hors du dossier de l'agent : un secret.
  secret = path.join(root, 'secret.md');
  write(secret, 'SECRET_DEHORS');
  // Le dépôt : un module sur main ; la branche ajoute sa note et un test d'invariant.
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: NOTE_TEXT });
  git(dir, 'checkout', '-q', 'main');
  write(path.join(dir, 'src/core/hello/index.ts'), 'HELLO_MAIN');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'main');
  git(dir, 'checkout', '-q', BRANCH);
  git(dir, 'rebase', '-q', 'main');
  write(path.join(dir, INV), INV_TEXT);
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

describe('la note et les tests d’invariants ne sont lus que par leur id dans le dernier relevé (I-37, élargi)', () => {
  it('témoin : l’id de la note, son texte est poussé à la page', async () => {
    await open();

    await follow(noteId());

    // la page reçoit la note telle qu'elle est sur le disque
    expect(texts()).toContain(onDisk(NOTE));
  });

  it('témoin : l’id d’un test d’invariant de la branche, son texte est poussé à la page', async () => {
    await open();

    await follow(testId(INV));

    // la page reçoit le test tel qu'il est sur le disque
    expect(texts()).toContain(onDisk(INV));
  });

  it('le chemin de la note à la place de son id : rien n’est lu', async () => {
    await open();

    await follow(NOTE);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('le chemin d’un test d’invariant à la place de son id : rien n’est lu', async () => {
    await open();

    await follow(INV);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  // Le relevé a donné l'id de la note ; elle devient ensuite un lien vers le dehors.
  it('la note remplacée, après le relevé, par un lien qui sort du dossier : le dehors n’est pas lu', async () => {
    await open();
    const id = noteId();
    linkOut(NOTE);

    await follow(id);

    // le secret du dehors n'est jamais poussé
    expect(JSON.stringify(codes())).not.toContain('SECRET_DEHORS');
  });
});

describe('Enregistrer n’écrit que la note ou le test affiché, par son id, dans le dossier de l’agent, au geste (I-39, élargi)', () => {
  it('témoin : la note affichée, par son id, reçoit le texte', async () => {
    await open();
    await follow(noteId());

    await save(noteId(), 'NOTE_ENREGISTREE');

    // la note sur le disque porte le texte enregistré
    expect(onDisk(NOTE)).toBe('NOTE_ENREGISTREE');
    // et rien d'autre n'a changé dans le dépôt
    expect(changed()).toBe(` M ${NOTE}\n`);
  });

  it('témoin : le test d’invariant affiché, par son id, reçoit le texte', async () => {
    await open();
    await follow(testId(INV));

    await save(testId(INV), 'TEST_ENREGISTRE');

    // le test sur le disque porte le texte enregistré
    expect(onDisk(INV)).toBe('TEST_ENREGISTRE');
    // et rien d'autre n'a changé dans le dépôt
    expect(changed()).toBe(` M ${INV}\n`);
  });

  it('le test affiché, l’id de la note : rien n’est écrit', async () => {
    await open();
    await follow(testId(INV));

    await save(noteId(), 'NOTE_ENREGISTREE');

    // témoin : le test est bien affiché
    expect(texts()).toContain(INV_TEXT);
    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('la note affichée, l’id du test : rien n’est écrit', async () => {
    await open();
    await follow(noteId());

    await save(testId(INV), 'TEST_ENREGISTRE');

    // témoin : la note est bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('rien d’affiché, l’id de la note : rien n’est écrit', async () => {
    await open();

    await save(noteId(), 'NOTE_ENREGISTREE');

    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('la note affichée, son chemin à la place de son id : rien n’est écrit', async () => {
    await open();
    await follow(noteId());

    await save(NOTE, 'NOTE_ENREGISTREE');

    // témoin : la note est bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('le test affiché, son chemin à la place de son id : rien n’est écrit', async () => {
    await open();
    await follow(testId(INV));

    await save(INV, 'TEST_ENREGISTRE');

    // témoin : le test est bien affiché
    expect(texts()).toContain(INV_TEXT);
    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('la note affichée, un chemin qui sort du dossier (../secret.md) à la place de l’id : rien n’est écrit', async () => {
    await open();
    await follow(noteId());

    await save('../secret.md', 'ECRIT_DEHORS');

    // témoin : la note est bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // le fichier du dehors est inchangé
    expect(fs.readFileSync(secret, 'utf8')).toBe('SECRET_DEHORS');
    // et rien n'est écrit dans le dépôt de l'agent
    expect(changed()).toBe('');
  });

  it('la note affichée, un chemin absolu hors du dossier à la place de l’id : rien n’est écrit', async () => {
    await open();
    await follow(noteId());

    await save(secret, 'ECRIT_DEHORS');

    // témoin : la note est bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // le fichier du dehors est inchangé
    expect(fs.readFileSync(secret, 'utf8')).toBe('SECRET_DEHORS');
  });

  // Affichée, puis remplacée par un lien vers le dehors avant Enregistrer.
  it('la note affichée remplacée par un lien qui sort du dossier : le dehors n’est pas écrit', async () => {
    await open();
    await follow(noteId());
    const id = noteId();
    linkOut(NOTE);

    await save(id, 'ECRIT_DEHORS');

    // témoin : la note était bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // le fichier du dehors est inchangé
    expect(fs.readFileSync(secret, 'utf8')).toBe('SECRET_DEHORS');
  });

  // Affiché, puis supprimé du disque avant Enregistrer : seul un test qui existe déjà s'enregistre.
  it('le test affiché supprimé du disque : Enregistrer ne le recrée pas', async () => {
    await open();
    await follow(testId(INV));
    const id = testId(INV);
    fs.rmSync(path.join(dir, INV));

    await save(id, 'TEST_RECREE');

    // témoin : le test était bien affiché
    expect(texts()).toContain(INV_TEXT);
    // le test n'existe toujours pas
    expect(fs.existsSync(path.join(dir, INV))).toBe(false);
  });

  it('sans geste : suivre la note, relever, la voir changer sur le disque n’écrit rien', async () => {
    const { refreshVibe } = await import('app/controllers');
    await open();
    await follow(noteId());

    await refreshVibe({ now: true });
    await settle();
    write(path.join(dir, NOTE), 'NOTE_CHANGEE');
    await settle();
    await refreshVibe({ now: true });
    await settle();

    // témoin : la page a suivi la note jusqu'à son changement
    expect(texts()).toContain('NOTE_CHANGEE');
    // seul le changement fait sur le disque apparaît
    expect(changed()).toBe(` M ${NOTE}\n`);
    // la note porte ce texte-là, rien n'est venu l'écraser
    expect(onDisk(NOTE)).toBe('NOTE_CHANGEE');
  });
});

describe('pas d’enregistrement de la note ni d’un test pendant une course de l’agent ou un tour : le principal recalcule le verrou, sans se fier à la page', () => {
  // Une course qui modifie la branche, sans module.
  it('la note, pendant Écrire la forme : rien n’est écrit, Enregistrer est refusé', async () => {
    await open();
    await follow(noteId());
    await click('forme');

    const result = await save(noteId(), 'NOTE_ENREGISTREE');

    // témoin : la note est bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // témoin : la forme travaille
    expect(inProgress()).toContain('/vibecoder:forme');
    // la note sur le disque est inchangée
    expect(onDisk(NOTE)).toBe(NOTE_TEXT);
    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  // Une course qui ne fait que lire retient aussi : n'importe quelle course de l'agent.
  it('la note, pendant Ponytail review (une lecture) : rien n’est écrit, Enregistrer est refusé', async () => {
    await open();
    await follow(noteId());
    await click('ponytail');

    const result = await save(noteId(), 'NOTE_ENREGISTREE');

    // témoin : la note est bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // témoin : la revue travaille
    expect(inProgress()).toContain('/vibecoder:ponytail');
    // la note sur le disque est inchangée
    expect(onDisk(NOTE)).toBe(NOTE_TEXT);
    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  // Arrêtée mais pas encore gardée ni annulée, la course retient encore (LOCKING).
  it('la note, la forme arrêtée pas encore tranchée : rien n’est écrit, Enregistrer est refusé', async () => {
    const { vibeRunOp } = await import('app/controllers');
    await open();
    await follow(noteId());
    await click('forme');
    vibeRunOp('forme', 'stop');
    await settle();

    const result = await save(noteId(), 'NOTE_ENREGISTREE');

    // témoin : la note est bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // témoin : la forme n'est plus en cours de travail, elle attend d'être tranchée
    expect(inProgress()).not.toContain('/vibecoder:forme');
    // la note sur le disque est inchangée
    expect(onDisk(NOTE)).toBe(NOTE_TEXT);
    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  it('la note, pendant un tour de la conversation : rien n’est écrit, Enregistrer est refusé', async () => {
    await open();
    await follow(noteId());
    await ask('corrige la note');

    const result = await save(noteId(), 'NOTE_ENREGISTREE');

    // témoin : la note est bien affichée
    expect(texts()).toContain(NOTE_TEXT);
    // témoin : le tour de la conversation travaille
    expect(inProgress()).toContain('corrige');
    // la note sur le disque est inchangée
    expect(onDisk(NOTE)).toBe(NOTE_TEXT);
    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });

  it('un test, pendant Écrire les invariants : rien n’est écrit, Enregistrer est refusé', async () => {
    await open();
    await follow(testId(INV));
    await click('invariants');

    const result = await save(testId(INV), 'TEST_ENREGISTRE');

    // témoin : le test est bien affiché
    expect(texts()).toContain(INV_TEXT);
    // témoin : l'écriture des invariants travaille
    expect(inProgress()).toContain('/vibecoder:invariants');
    // le test sur le disque est inchangé
    expect(onDisk(INV)).toBe(INV_TEXT);
    // la page apprend que rien n'a été enregistré
    expect(result.ok).toBe(false);
  });
});
