// Variants du diff d'un fichier de module (note 0.11.0,
// docs/tickets/feat/0.11.0-stabiliser-vibecoder.md) : le diff ne lit que les fichiers des
// modules touchés par la branche, désignés par leur id, jamais par un chemin venu de la
// page. Le principal pousse, avec le texte du fichier suivi, son texte à la base de la
// branche et au dernier commit (VibeCode.at) — pour ce seul fichier, d'un module touché
// (m<rang>/<i>), jamais la note ni un test. Déplacés tels quels de
// invariants/module-diff.test.ts (0.15.0) : les chemins restent gardés par Voir le code
// (invariants/module-code.test.ts, note-and-tests-save.test.ts).
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le SDK de
// Claude Code factices, git réel sur un dépôt d'essai). Ce que la page voit d'un fichier et
// de ses versions : les conv:vibeCode poussés au panneau, tous leurs champs.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

let dir = '';

// Ce que la page reçoit : le relevé (conv:vibe) et un fichier suivi, avec ses versions (conv:vibeCode).
type Survey = {
  note: { id: string } | null;
  invariants: { id: string; path: string }[];
  modules: { path: string; file: { id: string } | null; files: { id: string; path: string }[] }[];
};
type Code = { id: string; text: string | null; at?: { base: string | null; head: string | null } };
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as Survey;
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as Code | null);
// Tout ce que la page a reçu des fichiers suivis : textes et versions.
const pushed = () => JSON.stringify(codes());
// Le dernier fichier poussé à la page sous cet id.
const lastCode = (id: string) => codes().filter((c) => c?.id === id).at(-1);
// L'id que le dernier relevé donne à ce fichier d'un module ; sans id, le cas ne peut pas commencer.
function idOf(rel: string) {
  const f = survey().modules.flatMap((m) => m.files ?? []).find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// L'id que le dernier relevé donne à ce test d'invariant ; sans id, le cas ne peut pas commencer.
function testId(rel: string) {
  const f = survey().invariants.find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// Le texte d'un fichier du dépôt à un commit, d'après git.
const gitText = (ref: string, rel: string) => git(dir, 'show', `${ref}:${rel}`);
// Le commit où la branche part de main.
const forkPoint = () => git(dir, 'merge-base', 'main', 'HEAD').trim();

const HELLO = 'src/core/hello/index.ts';
const GREET = 'src/core/hello/greet.ts';
const BRANCH = 'feat/0.11.0-essai';
const NOTE = `docs/tickets/${BRANCH}.md`;
const INV = 'src/core/hello/tests/invariants/hello.test.ts';
const note = (mark: string) => ['# 0.11.0 — essai', '', '## Ce que ça fait', '', `- un essai ${mark}`, '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', 'src/core/autre    autre() · ne connaît pas : le DOM', '```', ''].join('\n');

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  const root = profile('whisper-module-diff-');
  // Le dépôt : deux modules sur main ; la branche, sa note (sa Forme les nomme) et un test d'invariant, touche le premier seulement.
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: note('NOTE_COMMIT') });
  git(dir, 'checkout', '-q', 'main');
  write(path.join(dir, HELLO), 'HELLO_MAIN');
  write(path.join(dir, GREET), 'GREET_MAIN');
  write(path.join(dir, 'src/core/autre/index.ts'), 'AUTRE_TEXTE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'main');
  git(dir, 'checkout', '-q', BRANCH);
  git(dir, 'rebase', '-q', 'main');
  write(path.join(dir, HELLO), 'HELLO_COMMIT');
  write(path.join(dir, GREET), 'GREET_COMMIT');
  write(path.join(dir, INV), "it('INV_COMMIT', () => {});\n");
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'hello');
  // Sur le disque, pas commité : chaque fichier suivi diffère de son dernier commit.
  write(path.join(dir, NOTE), note('NOTE_DISQUE'));
  write(path.join(dir, HELLO), 'HELLO_DISQUE');
  write(path.join(dir, INV), "it('INV_DISQUE', () => {});\n");
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
});
afterEach(closeAll);

// Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
const open = () => openPanel('a1');

// La page suit un fichier (l'accordéon déplié sur lui, la note ou un test affichés ; null : replié).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

describe('le diff ne lit que le fichier suivi d’un module touché, désigné par son id (I-37)', () => {
  it('témoin : l’id d’un fichier d’un module touché, ses textes à la base de la branche et au dernier commit sont poussés', async () => {
    await open();

    await follow(idOf(HELLO));

    // la page reçoit son texte au point de départ de la branche
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // et son texte au dernier commit
    expect(lastCode(idOf(HELLO))?.at?.head).toBe(gitText('HEAD', HELLO));
  });

  it('les versions d’un autre fichier du même module ne sont pas lues : seul le suivi l’est', async () => {
    await open();

    await follow(idOf(HELLO));

    // témoin : le diff du fichier suivi est bien poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // le texte de l'autre fichier à la base de la branche n'est jamais poussé
    expect(pushed()).not.toContain('GREET_MAIN');
    // ni son texte au dernier commit
    expect(pushed()).not.toContain('GREET_COMMIT');
  });

  it('un chemin du dépôt à la place d’un id : aucune de ses versions n’est lue', async () => {
    await open();
    await follow(idOf(HELLO));

    await follow(GREET);

    // témoin : le diff du fichier suivi par son id a bien été poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // le texte du chemin à la base de la branche n'est jamais poussé
    expect(pushed()).not.toContain('GREET_MAIN');
    // ni son texte au dernier commit
    expect(pushed()).not.toContain('GREET_COMMIT');
  });

  it('l’id du dossier d’un module que la branche ne touche pas : aucune de ses versions n’est lue', async () => {
    await open();
    await follow(idOf(HELLO));

    await follow(survey().modules.find((m) => m.path === 'src/core/autre')!.file!.id);

    // témoin : le diff du fichier touché a bien été poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // le texte commité du module pas touché n'est jamais poussé
    expect(pushed()).not.toContain('AUTRE_TEXTE');
  });

  // La note se suit par son id (Créer) : son texte oui, ses versions non.
  it('la note suivie : sa version au dernier commit n’est pas lue', async () => {
    await open();
    await follow(idOf(HELLO));

    await follow(survey().note!.id);

    // témoin : le diff du fichier de module a bien été poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // témoin : la note telle qu'elle est sur le disque est poussée
    expect(lastCode(survey().note!.id)?.text).toBe(fs.readFileSync(path.join(dir, NOTE), 'utf8'));
    // sa version commitée n'est jamais poussée
    expect(pushed()).not.toContain('NOTE_COMMIT');
  });

  // Un test d'invariant se suit par son id (Créer) : son texte oui, ses versions non.
  it('un test d’invariant suivi : sa version au dernier commit n’est pas lue', async () => {
    await open();
    await follow(idOf(HELLO));

    await follow(testId(INV));

    // témoin : le diff du fichier de module a bien été poussé
    expect(lastCode(idOf(HELLO))?.at?.base).toBe(gitText(forkPoint(), HELLO));
    // témoin : le test tel qu'il est sur le disque est poussé
    expect(lastCode(testId(INV))?.text).toBe(fs.readFileSync(path.join(dir, INV), 'utf8'));
    // sa version commitée n'est jamais poussée
    expect(pushed()).not.toContain('INV_COMMIT');
  });
});
