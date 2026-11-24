// Invariants de la lecture du dossier d'artefacts du projet par une course, I-57 (note 0.16.0,
// docs/tickets/fix/0.16.0-action-note-access-artefact.md, « Ce que ça ne doit pas faire ») :
//   - lire, par le dossier d'artefacts, un fichier hors de lui, du projet et des sorties (`../`, un lien
//     posé dans le dossier d'artefacts qui mène au dehors, ou le dossier d'artefacts lui-même devenu un
//     lien : alors aucun dossier d'artefacts pour la course) ;
//   - lire le dossier d'artefacts d'un autre projet (une autre clé) ;
//   - écrire dans le dossier d'artefacts du projet depuis une course ou un de ses sous-agents (tenu aussi par
//     run-rights.test.ts, inchangé, où ce dossier n'existe pas : ici, il existe et la course le lit) ;
//   - changer les dossiers de travail donnés au processus d'une course (le projet et les sorties seuls ; même
//     remarque).
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, runtime des agents, fenêtres, état, réglages et fichiers sur disque,
// vrais liens symboliques, git réel sur deux dépôts d'essai, les actions et skills livrés dans resources/),
// dans le décor commun (app/tests/harness) ; faux : Electron (le décor) et le SDK de Claude Code, ici celui
// du fichier : il relève, pour chaque processus, son premier message et les options de son lancement. Le
// contrôle des fichiers est appelé comme le SDK l'appelle avant un outil (les crochets PreToolUse des options).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, closeAll, fakeElectron, openPanel, profile, repo, repoResources, settle, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);
vi.mock('technicals/paths', () => repoResources());

// Un processus de Claude Code : son premier message, les options de son lancement.
type Proc = { text: string; options: Record<string, unknown> };
const procs: Proc[] = [];

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options: Record<string, unknown> }) => {
      const proc: Proc = { text: '', options };
      let stop = () => {};
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          if (!proc.text) { proc.text = String(m.message.content); procs.push(proc); }
          await new Promise<void>((ok) => { stop = ok; });
        }
      }()), {
        setPermissionMode: async () => {},
        setModel: async () => {},
        interrupt: async () => { stop(); },
        rewindFiles: async () => ({ canRewind: true, filesChanged: [] }),
      });
    },
  }),
}));

let root = '';     // le profil d'essai
let project = '';  // le dossier de l'agent, un dépôt git
let other = '';    // un autre dépôt, un autre projet
let arts = '';     // le dossier d'artefacts du projet (pas encore créé)
let foreign = '';  // celui de l'autre projet
let secret = '';   // un fichier hors du projet, des sorties et des artefacts

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  procs.length = 0;
  root = profile('whisper-run-artifacts-');
  project = path.join(root, 'projet');
  other = path.join(root, 'autre');
  repo(project, { branch: 'fix/0.16.0-essai', note: '# 0.16.0 — essai\n\n## Ce que ça fait\n\n- un essai\n' });
  repo(other);
  secret = path.join(root, 'dehors', 'secret.txt');
  write(secret, 'SECRET_DEHORS');
  const { projectArtifactsPath } = await import('app/controllers');
  arts = projectArtifactsPath(project);
  foreign = projectArtifactsPath(other);
});
afterEach(closeAll);

// L'agent a1 en Auto ; l'appli démarrée ; la Forme lancée au clic ; son processus.
async function startForme(): Promise<Proc> {
  writeConfig(root, [{ id: 'a1', dir: project, name: 'essai', model: 'opus', effort: 'high', mode: 'auto', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
  (await import('app/settings')).ensureVibeFiles(); // les skills livrés installés dans le profil, comme au démarrage
  await openPanel('a1');
  await click('forme');
  await settle();
  const forme = procs.find((p) => p.text.startsWith('/vibecoder:forme'));
  if (!forme) throw new Error('la Forme n’est pas partie');
  return forme;
}

// Ce que décide le contrôle des fichiers de la course pour l'appel `tool(input)`, appelé comme le SDK l'appelle
// avant l'outil : chaque crochet PreToolUse dont le filtre vise cet outil ; `who` : le sous-agent qui l'appelle
// (absent : l'agent de la course). Un refus : 'deny' ; sinon 'pass'.
type Hook = (input: Record<string, unknown>, toolUseId: string | undefined, o: { signal: AbortSignal }) => Promise<Record<string, unknown> | undefined>;
async function verdict(p: Proc, tool: string, input: Record<string, unknown>, who: Record<string, string> = {}): Promise<'deny' | 'pass'> {
  const groups = ((p.options.hooks as Record<string, unknown> | undefined)?.PreToolUse ?? []) as { matcher?: string; hooks: Hook[] }[];
  const answers: (Record<string, unknown> | undefined)[] = [];
  for (const group of groups) {
    if (group.matcher && group.matcher !== '*' && !new RegExp(`^(?:${group.matcher})$`).test(tool)) continue;
    for (const hook of group.hooks) {
      answers.push(await hook({ hook_event_name: 'PreToolUse', session_id: 's1', transcript_path: '', cwd: project, tool_name: tool, tool_input: input, tool_use_id: 't1', ...who },
        't1', { signal: new AbortController().signal }));
    }
  }
  const denies = (a: Record<string, unknown> | undefined) =>
    (a?.hookSpecificOutput as Record<string, unknown> | undefined)?.permissionDecision === 'deny' || a?.decision === 'block';
  return answers.some(denies) ? 'deny' : 'pass';
}
// Le sous-agent développeur, tel que le SDK le nomme au crochet.
const DEVELOPER = { agent_id: 'sub-1', agent_type: 'vibecoder:developpeur' };

describe('une course ne lit, par le dossier d’artefacts de son projet, rien hors de lui', () => {
  // Un chemin qui commence par le dossier d'artefacts, puis en sort.
  it('un chemin du dossier d’artefacts qui en sort par ../ : refusé', async () => {
    write(path.join(arts, 'plan.md'), '# plan');
    const forme = await startForme();
    const detour = `${arts}/${path.relative(arts, secret)}`;

    // témoin : un artefact du projet est lu (le dossier d'artefacts est bien donné à la course)
    expect(await verdict(forme, 'Read', { file_path: path.join(arts, 'plan.md') })).toBe('pass');
    // le fichier du dehors n'est pas lu par ce détour
    expect(await verdict(forme, 'Read', { file_path: detour })).toBe('deny');
  });

  // Un lien posé dans le dossier d'artefacts, qui mène au dehors.
  it('un lien du dossier d’artefacts vers un dossier du dehors : refusé', async () => {
    write(path.join(arts, 'plan.md'), '# plan');
    fs.symlinkSync(path.dirname(secret), path.join(arts, 'lien'));
    const forme = await startForme();

    // témoin : un artefact du projet est lu
    expect(await verdict(forme, 'Read', { file_path: path.join(arts, 'plan.md') })).toBe('pass');
    // le fichier du dehors n'est pas lu par le lien
    expect(await verdict(forme, 'Read', { file_path: path.join(arts, 'lien', 'secret.txt') })).toBe('deny');
    // le dossier du dehors n'est pas parcouru par le lien
    expect(await verdict(forme, 'Glob', { pattern: '**/*', path: path.join(arts, 'lien') })).toBe('deny');
  });

  // Le dossier d'artefacts lui-même est un lien vers le dehors : la course n'a aucun dossier d'artefacts.
  it('le dossier d’artefacts devenu un lien vers le dehors : rien n’est lu par lui', async () => {
    fs.mkdirSync(path.dirname(arts), { recursive: true });
    fs.symlinkSync(path.dirname(secret), arts);
    const forme = await startForme();

    // le fichier du dehors n'est pas lu par le lien
    expect(await verdict(forme, 'Read', { file_path: path.join(arts, 'secret.txt') })).toBe('deny');
    // ni par son chemin réel
    expect(await verdict(forme, 'Read', { file_path: secret })).toBe('deny');
    // le dossier du dehors n'est pas fouillé
    expect(await verdict(forme, 'Grep', { pattern: 'SECRET', path: arts })).toBe('deny');
  });
});

describe('une course n’écrit pas dans le dossier d’artefacts de son projet, qu’elle lit', () => {
  it('Write et Edit d’un artefact par la course : refusés', async () => {
    write(path.join(arts, 'plan.md'), '# plan');
    const forme = await startForme();

    // témoin : l'artefact est lu (le dossier d'artefacts est bien donné à la course)
    expect(await verdict(forme, 'Read', { file_path: path.join(arts, 'plan.md') })).toBe('pass');
    // aucun artefact n'est créé
    expect(await verdict(forme, 'Write', { file_path: path.join(arts, 'nouveau.md'), content: 'x' })).toBe('deny');
    // l'artefact existant n'est pas modifié
    expect(await verdict(forme, 'Edit', { file_path: path.join(arts, 'plan.md'), old_string: 'plan', new_string: 'x' })).toBe('deny');
  });

  it('Write d’un artefact par un sous-agent : refusé', async () => {
    write(path.join(arts, 'plan.md'), '# plan');
    const forme = await startForme();

    // témoin : le sous-agent lit l'artefact
    expect(await verdict(forme, 'Read', { file_path: path.join(arts, 'plan.md') }, DEVELOPER)).toBe('pass');
    // il n'en écrit aucun
    expect(await verdict(forme, 'Write', { file_path: path.join(arts, 'nouveau.md'), content: 'x' }, DEVELOPER)).toBe('deny');
  });
});

describe('les dossiers de travail d’une course ne changent pas', () => {
  it('le dossier d’artefacts existe : aucun dossier de travail hors du projet et des sorties', async () => {
    write(path.join(arts, 'plan.md'), '# plan');
    const forme = await startForme();
    const out = path.join(root, 'vibecoder-out', 'a1');
    const dirs = (forme.options.additionalDirectories ?? []) as string[];
    const inside = (d: string) => [project, out].some((base) => d === base || d.startsWith(`${base}${path.sep}`));

    // aucun dossier en plus hors des deux (le dossier d'artefacts reste lu par le contrôle, pas donné au processus)
    expect(dirs.filter((d) => !inside(d))).toEqual([]);
  });
});

describe('une course ne lit pas le dossier d’artefacts d’un autre projet', () => {
  it('un artefact d’un autre dépôt (une autre clé) : refusé', async () => {
    write(path.join(arts, 'plan.md'), '# plan');
    write(path.join(foreign, 'plan.md'), 'TEXTE_DE_L_AUTRE_PROJET');
    const forme = await startForme();

    // témoin : l'artefact du projet de la course est lu
    expect(await verdict(forme, 'Read', { file_path: path.join(arts, 'plan.md') })).toBe('pass');
    // celui de l'autre projet ne l'est pas
    expect(await verdict(forme, 'Read', { file_path: path.join(foreign, 'plan.md') })).toBe('deny');
    // le dossier de l'autre projet n'est pas fouillé
    expect(await verdict(forme, 'Grep', { pattern: 'TEXTE', path: foreign })).toBe('deny');
  });
});
