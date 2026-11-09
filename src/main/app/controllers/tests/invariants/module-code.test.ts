// Invariants de Voir le code (note 0.11.0,
// docs/tickets/feat/0.11.0-code-des-modules.md, « Ce que ça ne doit pas
// faire ») :
//   - la page ne désigne un fichier du module que par son id dans le dernier
//     relevé, jamais par un chemin ; le principal ne lit que le fichier
//     ouvert, d'un module touché par la branche, rien hors du dossier de
//     l'agent (I-37, élargi aux fichiers des modules) ;
//   - Enregistrer n'écrit que le fichier affiché, désigné par son id, dans le
//     dossier de l'agent, et seulement au geste de l'utilisateur (exception à
//     I-39) ;
//   - pas d'enregistrement pendant une course qui génère le module ni pendant
//     un tour de la conversation (le principal recalcule codeLock avant
//     d'écrire, sans se fier à la page : un cas par sorte de course).
// Les cas de forme (le relevé, la note en Créer et en Relire, un autre fichier
// ou l'accordéon replié, le refus d'Enregistrer en retour) : variants/module-code.test.ts
// (0.15.0). Le reste de Voir le code : note-and-tests-save.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal, par le décor commun (app/tests/harness : Electron et le
// SDK de Claude Code factices, git réel sur un dépôt d'essai, un lien réel qui
// sort du dossier de l'agent). Ce que la page voit d'un fichier : les
// conv:vibeCode poussés au panneau.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from 'core/agents';
import {
  click as press, closeAll, fakeClaude, fakeElectron, git, openPanel, profile, repo, repoResources, settle, write, writeConfig,
} from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

let root = '';
let dir = '';
let secret = '';

// Ce que la page reçoit : le relevé (conv:vibe) et le texte d'un fichier (conv:vibeCode).
type Survey = { modules: { path: string; files: { id: string; path: string }[] }[] };
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as Survey;
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as { id: string; text: string | null } | null);
// Les textes de fichier poussés à la page (null : trop gros ou illisible, pas un texte).
const texts = () => codes().flatMap((c) => (c && c.text !== null ? [c.text] : []));
// L'id que le dernier relevé donne à ce fichier d'un module ; sans id, le cas ne peut pas commencer.
function idOf(rel: string) {
  const f = survey().modules.flatMap((m) => m.files ?? []).find((x) => x.path === rel);
  if (!f) throw new Error(`le relevé ne donne aucun id à ${rel}`);
  return f.id;
}
// Les skills (ou premiers mots) des tours en cours.
const inProgress = () => claude.turns.filter((t) => !t.done).map((t) => t.skill);
// Le rang d'un module dans le dernier relevé (VibeArgs.module).
const rankOf = (modulePath: string) => survey().modules.findIndex((m) => m.path === modulePath);
// Ce que git voit changé dans le dépôt de l'agent.
const changed = () => git(dir, 'status', '--porcelain');
// Un fichier remplacé par un lien qui mène hors du dossier de l'agent.
const linkOut = (rel: string) => { fs.rmSync(path.join(dir, rel)); fs.symlinkSync(secret, path.join(dir, rel)); };

const HELLO = 'src/core/hello/index.ts';
const GREET = 'src/core/hello/greet.ts';
const BRANCH = 'feat/0.11.0-essai';
const NOTE_TEXT = ['# 0.11.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', 'src/core/autre    autre() · ne connaît pas : le DOM', '```', ''].join('\n');

const agent = (vibe: AgentConfig['vibe']) => ({ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder' as const, vibe });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  root = profile('whisper-module-code-');
  // Hors du dossier de l'agent : un secret.
  secret = path.join(root, 'secret.ts');
  write(secret, 'SECRET_DEHORS');
  // Le dépôt : deux modules sur main ; la branche, sa note (sa Forme les nomme), touche le premier seulement.
  dir = path.join(root, 'projet');
  repo(dir, { branch: BRANCH, note: NOTE_TEXT });
  git(dir, 'checkout', '-q', 'main');
  write(path.join(dir, HELLO), 'HELLO_MAIN');
  write(path.join(dir, GREET), 'GREET_MAIN');
  write(path.join(dir, 'src/core/autre/index.ts'), 'AUTRE_TEXTE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'main');
  git(dir, 'checkout', '-q', BRANCH);
  git(dir, 'rebase', '-q', 'main');
  write(path.join(dir, HELLO), 'HELLO_TEXTE');
  write(path.join(dir, GREET), 'GREET_TEXTE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'hello');
  writeConfig(root, [agent({ flow: 'create', autonomy: 'guide', pr: null })]);
});
afterEach(closeAll);

// Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
const open = () => openPanel('a1');

// La page suit un fichier (l'accordéon déplié sur lui ; null : replié).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

// Un clic sur une action de l'écran (Générer ce module, Générer les modules restants…).
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

// Enregistrer (Ctrl+S ou le bouton), tel que la page l'envoie.
async function save(id: unknown, text: unknown) {
  const { saveCode } = await import('app/controllers');
  await saveCode(id, text);
  await settle();
}

describe('Voir le code : le principal ne lit que le fichier ouvert, d’un module touché (ou en Créer la note), dans le dossier de l’agent (I-37)', () => {
  it('témoin : l’id d’un fichier d’un module touché, son texte est poussé à la page', async () => {
    await open();

    await follow(idOf(HELLO));

    // la page reçoit le texte du fichier tel qu'il est sur le disque
    expect(texts()).toContain(fs.readFileSync(path.join(dir, HELLO), 'utf8'));
  });

  it('un chemin du dépôt à la place d’un id : rien n’est lu', async () => {
    await open();

    await follow(HELLO);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un chemin relatif qui sort du dossier (../secret.ts) : rien n’est lu', async () => {
    await open();

    await follow('../secret.ts');

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un chemin absolu hors du dossier : rien n’est lu', async () => {
    await open();

    await follow(secret);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  // Le relevé a listé le fichier ; il devient ensuite un lien vers le dehors.
  it('un fichier du module remplacé, après le relevé, par un lien qui sort du dossier : le dehors n’est pas lu', async () => {
    await open();
    const id = idOf(GREET);
    linkOut(GREET);

    await follow(id);

    // le secret du dehors n'est jamais poussé
    expect(JSON.stringify(codes())).not.toContain('SECRET_DEHORS');
  });

});

describe('Enregistrer n’écrit que le fichier affiché, par son id, dans le dossier de l’agent, au geste (exception à I-39)', () => {
  it('témoin : le fichier affiché, par son id, reçoit le texte', async () => {
    await open();
    await follow(idOf(HELLO));

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // le fichier sur le disque porte le texte enregistré
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_ENREGISTRE');
    // et rien d'autre n'a changé dans le dépôt
    expect(changed()).toBe(` M ${HELLO}\n`);
  });

  it('l’id d’un autre fichier du module que celui affiché : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));

    await save(idOf(GREET), 'GREET_ENREGISTRE');

    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('aucun fichier affiché : rien n’est écrit', async () => {
    await open();

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('un chemin du dépôt à la place de l’id : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));

    await save(HELLO, 'HELLO_ENREGISTRE');

    // le dépôt est inchangé
    expect(changed()).toBe('');
  });

  it('un chemin qui sort du dossier (../secret.ts) à la place de l’id : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));

    await save('../secret.ts', 'ECRIT_DEHORS');

    // le fichier du dehors est inchangé
    expect(fs.readFileSync(secret, 'utf8')).toBe('SECRET_DEHORS');
  });

  it('un chemin absolu hors du dossier à la place de l’id : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));

    await save(secret, 'ECRIT_DEHORS');

    // le fichier du dehors est inchangé
    expect(fs.readFileSync(secret, 'utf8')).toBe('SECRET_DEHORS');
  });

  // Affiché, puis remplacé par un lien vers le dehors avant Enregistrer.
  it('le fichier affiché remplacé par un lien qui sort du dossier : le dehors n’est pas écrit', async () => {
    await open();
    await follow(idOf(GREET));
    const id = idOf(GREET);
    linkOut(GREET);

    await save(id, 'ECRIT_DEHORS');

    // le fichier du dehors est inchangé
    expect(fs.readFileSync(secret, 'utf8')).toBe('SECRET_DEHORS');
  });

  it('sans geste : suivre un fichier, relever, le voir changer sur le disque n’écrit rien', async () => {
    const { refreshVibe } = await import('app/controllers');
    await open();
    await follow(idOf(HELLO));

    await refreshVibe({ now: true });
    await settle();
    write(path.join(dir, HELLO), 'HELLO_CHANGE');
    await settle();
    await refreshVibe({ now: true });
    await settle();

    // seul le changement fait sur le disque apparaît, avec son texte
    expect(changed()).toBe(` M ${HELLO}\n`);
    // le fichier porte ce texte-là, rien n'est venu l'écraser
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_CHANGE');
  });
});

describe('pas d’enregistrement pendant une course qui génère le module ni pendant un tour : le principal recalcule codeLock, sans se fier à la page', () => {
  it('une course qui génère ce module (Générer ce module) : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));
    await click('module', { module: rankOf('src/core/hello') });

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // témoin : la génération de ce module travaille
    expect(inProgress()).toContain('/vibecoder:module');
    // le fichier sur le disque est inchangé
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_TEXTE');
  });

  // '*' : la course retient tous les modules.
  it('une course qui génère les modules restants (Générer les modules restants) : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));
    await click('modules');

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // témoin : la génération des modules restants travaille
    expect(inProgress()).toContain('/vibecoder:modules');
    // le fichier sur le disque est inchangé
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_TEXTE');
  });

  it('un tour de la conversation en cours : rien n’est écrit', async () => {
    await open();
    await follow(idOf(HELLO));
    await ask('corrige hello');

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // témoin : le tour de la conversation travaille
    expect(inProgress()).toContain('corrige');
    // le fichier sur le disque est inchangé
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_TEXTE');
  });

  // Témoin de la règle : seule la course de ce module (ou de tous) retient l'enregistrement.
  it('une course qui génère un autre module : le fichier affiché est enregistré', async () => {
    await open();
    await follow(idOf(HELLO));
    await click('module', { module: rankOf('src/core/autre') });

    await save(idOf(HELLO), 'HELLO_ENREGISTRE');

    // témoin : la génération de l'autre module travaille
    expect(inProgress()).toContain('/vibecoder:module');
    // le fichier sur le disque porte le texte enregistré
    expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_ENREGISTRE');
  });
});
