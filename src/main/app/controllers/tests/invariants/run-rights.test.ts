// Invariants des droits d'une course (note 0.15.0, docs/tickets/feat/0.15.0-courses-droits.md,
// « Ce que ça ne doit pas faire ») — l'invariant des droits des actions (nouveau : son numéro est
// posé avec SPEC.md) :
//   - donner à une course ou à ses sous-agents plus de droits que la liste de son skill plus les
//     règles d'autorisation de l'utilisateur, le mode Auto ou le contournement des autorisations
//     (bypassPermissions), quel que soit le mode de l'agent principal, que la course parte d'un clic
//     ou de l'orchestrateur (famille « permissions ») ;
//   - laisser une course ou un sous-agent de VibeCoder lire ou écrire, par ses outils de fichiers, hors
//     du dossier du projet et des sorties de l'agent (vérifié sur le contrôle que l'appli donne au SDK,
//     PreToolUse, et sur le mode ; famille « disque ») ;
//   - laisser une action élargir ses propres droits en écrivant son skill, les réglages, un AGENTS.md,
//     un package.json, le dossier .git/ ou les hooks du projet (.husky/) (famille « permissions »).
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, runtime des agents, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, les actions et skills livrés dans resources/, installés dans
// le profil), dans le décor commun (app/tests/harness) ; faux : Electron (le décor) et le SDK de Claude
// Code, ici celui du fichier : il relève, pour chaque processus, son premier message, les options reçues
// à son lancement et chaque changement de mode ; son tour dure (rien ne sort de son flux). Ce que Claude
// Code juge lui-même (le mode, la liste, les règles de l'utilisateur) n'est pas rejoué : on vérifie ce
// que l'appli lui donne. Le contrôle des fichiers est appelé comme le SDK l'appelle avant un outil (les
// crochets PreToolUse des options), pour la course ou pour un de ses sous-agents (agent_id).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, closeAll, fakeElectron, git, openPanel, orchestratorAsks, profile, repo, repoResources, settle, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);
vi.mock('technicals/paths', () => repoResources());

// Un processus de Claude Code : son premier message, les options de son lancement, chaque mode reçu à chaud.
type Proc = { text: string; options: Record<string, unknown>; modes: string[] };
const procs: Proc[] = [];

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options: Record<string, unknown> }) => {
      const proc: Proc = { text: '', options, modes: [] };
      let stop = () => {};
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          if (!proc.text) { proc.text = String(m.message.content); procs.push(proc); }
          await new Promise<void>((ok) => { stop = ok; });
        }
      }()), {
        setPermissionMode: async (mode: string) => { proc.modes.push(mode); },
        setModel: async () => {},
        interrupt: async () => { stop(); },
        rewindFiles: async () => ({ canRewind: true, filesChanged: [] }),
      });
    },
  }),
}));

// Le préfixe des actions (config.json) et les commandes de test et de typage de l'AGENTS.md d'essai ;
// `npm start`, dans la même section, n'est ni un test ni un typage.
const PREFIX = 'distrobox enter dev --';
const COMMANDS = ['npm test', 'npm run typecheck'];
const AGENTS_MD = '# AGENTS.md\n\n## Commandes\n\n- Lancer : `npm start`\n- Tests : `npm test` · typage : `npm run typecheck`\n';

let root = '';     // le profil d'essai
let project = '';  // le dossier de l'agent, un dépôt git
let out = '';      // les sorties de l'agent
let secret = '';   // un fichier hors du projet et des sorties

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  procs.length = 0;
  root = profile('whisper-run-rights-');
  project = path.join(root, 'projet');
  out = path.join(root, 'vibecoder-out', 'a1');
  repo(project, { branch: 'feat/0.15.0-essai', note: '# 0.15.0 — essai\n\n## Ce que ça fait\n\n- un essai\n' });
  write(path.join(project, 'AGENTS.md'), AGENTS_MD);
  write(path.join(project, 'package.json'), '{ "scripts": { "test": "vitest run" } }\n');
  git(project, 'add', '.');
  git(project, 'commit', '-q', '-m', 'agents');
  secret = path.join(root, 'dehors', 'secret.txt');
  write(secret, 'SECRET_DEHORS');
});
afterEach(closeAll);

// L'agent a1 dans ce mode (tel qu'écrit dans config.json, à la main compris), le préfixe des actions posé ;
// l'appli démarrée ; la Forme lancée au clic ou demandée par l'orchestrateur ; son processus.
async function startForme(mode: string, by: 'click' | 'orchestrator' = 'click'): Promise<Proc> {
  writeConfig(root, [{ id: 'a1', dir: project, name: 'essai', model: 'opus', effort: 'high', mode, sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], { vibeCommandPrefix: PREFIX });
  (await import('app/settings')).ensureVibeFiles(); // les skills livrés installés dans le profil, comme au démarrage
  await openPanel('a1');
  if (by === 'click') await click('forme');
  else await orchestratorAsks(out, 'forme');
  await settle();
  const forme = procs.find((p) => p.text.startsWith('/vibecoder:forme'));
  if (!forme) throw new Error('la Forme n’est pas partie');
  return forme;
}

// Le dossier du plugin de VibeCoder donné au processus.
function pluginDir(p: Proc): string {
  const plugins = (p.options.plugins ?? []) as { path: string }[];
  if (!plugins.length) throw new Error('aucun plugin donné au processus');
  return plugins[0].path;
}

// Ce que la note permet à une course : le champ allowed-tools du SKILL.md qu'appelle son premier message (variante
// comprise, tel qu'installé), une règle par entrée, ${CLAUDE_SKILL_DIR} et ${VIBECODER_OUT} remplacés ; plus chaque
// commande du projet derrière le préfixe, seule ou suivie d'arguments.
function noteAllows(p: Proc): string[] {
  const skillDir = path.join(pluginDir(p), 'skills', /^\/vibecoder:(\S+)/.exec(p.text)![1]);
  const skillMd = path.join(skillDir, 'SKILL.md');
  const md = fs.existsSync(skillMd) ? fs.readFileSync(skillMd, 'utf8') : '';
  const field = /^allowed-tools:\s*"?(.*?)"?\s*$/m.exec(md)?.[1] ?? '';
  const skill = field.split(/,(?![^(]*\))/).map((r) => r.trim()).filter(Boolean)
    .map((r) => r.replaceAll('${CLAUDE_SKILL_DIR}', skillDir).replaceAll('${VIBECODER_OUT}', out));
  return [...skill, ...COMMANDS.flatMap((c) => [`Bash(${PREFIX} ${c})`, `Bash(${PREFIX} ${c} *)`])];
}
const allowedTools = (p: Proc) => (p.options.allowedTools ?? []) as string[];

// Ce que décide le contrôle des fichiers de la course pour l'appel `tool(input)`, appelé comme le SDK l'appelle
// avant l'outil : chaque crochet PreToolUse dont le filtre vise cet outil ; `who` : le sous-agent qui l'appelle
// (absent : l'agent de la course). Un refus : 'deny' ; sinon 'pass' (le mode et la liste jugent ensuite).
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

describe('une course ne part jamais dans un mode qui lui donne plus que sa liste', () => {
  it('l’agent en Manuel, au clic : la course part dans le mode qui ne demande jamais', async () => {
    const forme = await startForme('default');

    // ni le mode de l'agent ni un autre : seulement ce que la liste et les règles de l'utilisateur permettent passe
    expect(forme.options.permissionMode).toBe('dontAsk');
  });

  it('l’agent en Accepter les modifications, au clic : la course part dans le mode qui ne demande jamais', async () => {
    const forme = await startForme('acceptEdits');

    // les écritures ne passent pas d'office
    expect(forme.options.permissionMode).toBe('dontAsk');
  });

  it('l’agent en Auto, au clic : la course part dans le mode qui ne demande jamais', async () => {
    const forme = await startForme('auto');

    // pas le mode Auto de l'agent
    expect(forme.options.permissionMode).toBe('dontAsk');
  });

  it('l’agent en Auto, course demandée par l’orchestrateur : le mode qui ne demande jamais', async () => {
    const forme = await startForme('auto', 'orchestrator');

    // pas le mode Auto de l'agent
    expect(forme.options.permissionMode).toBe('dontAsk');
  });

  // Un mode qu'aucun menu ne propose, écrit à la main dans config.json.
  it('bypassPermissions écrit à la main pour l’agent : ni ce mode ni le contournement pour la course', async () => {
    const forme = await startForme('bypassPermissions');

    // le mode qui ne demande jamais, pas le contournement
    expect(forme.options.permissionMode).toBe('dontAsk');
    // le contournement des autorisations n'est pas permis au processus
    expect(forme.options.allowDangerouslySkipPermissions).toBeFalsy();
  });

  it('le mode de l’agent passé en Auto pendant la course : la course ne le reçoit jamais', async () => {
    const forme = await startForme('default');
    const { setAgentSetting } = await import('app/controllers');

    setAgentSetting('a1', 'mode', 'auto');
    await settle();

    // aucun mode reçu à chaud, sinon le mode qui ne demande jamais
    expect(forme.modes.filter((m) => m !== 'dontAsk')).toEqual([]);
  });
});

describe('la liste d’une course : celle de son skill et les commandes du projet, rien de plus', () => {
  it('au clic, l’agent en Auto : aucune règle hors de la liste du skill et des commandes du projet', async () => {
    const forme = await startForme('auto');

    // témoin : la liste est bien donnée au processus (la commande de test du projet, derrière le préfixe)
    expect(allowedTools(forme)).toContain(`Bash(${PREFIX} npm test)`);
    // aucune règle que ni le skill ni les commandes du projet ne donnent
    expect(allowedTools(forme).filter((r) => !noteAllows(forme).includes(r))).toEqual([]);
  });

  it('demandée par l’orchestrateur, l’agent en Auto : aucune règle hors de la liste du skill et des commandes du projet', async () => {
    const forme = await startForme('auto', 'orchestrator');

    // témoin : la liste est bien donnée au processus
    expect(allowedTools(forme)).toContain(`Bash(${PREFIX} npm test)`);
    // aucune règle que ni le skill ni les commandes du projet ne donnent
    expect(allowedTools(forme).filter((r) => !noteAllows(forme).includes(r))).toEqual([]);
  });
});

describe('une course ne lit ni n’écrit, par ses outils de fichiers, hors du projet et des sorties de l’agent', () => {
  it('Read d’un fichier hors des deux : refusé', async () => {
    const forme = await startForme('auto');

    // témoin : lire un fichier du projet passe (le contrôle juge bien le chemin)
    expect(await verdict(forme, 'Read', { file_path: path.join(project, 'AGENTS.md') })).toBe('pass');
    // le fichier du dehors n'est pas lu
    expect(await verdict(forme, 'Read', { file_path: secret })).toBe('deny');
  });

  it('Write hors des deux : refusé', async () => {
    const forme = await startForme('auto');

    // témoin : écrire dans les sorties de l'agent passe
    expect(await verdict(forme, 'Write', { file_path: path.join(out, 'notes.md'), content: 'x' })).toBe('pass');
    // rien n'est écrit au dehors
    expect(await verdict(forme, 'Write', { file_path: path.join(root, 'dehors', 'nouveau.txt'), content: 'x' })).toBe('deny');
  });

  it('Glob dans un dossier hors des deux : refusé', async () => {
    const forme = await startForme('auto');

    // le dossier du dehors n'est pas parcouru
    expect(await verdict(forme, 'Glob', { pattern: '**/*', path: path.dirname(secret) })).toBe('deny');
  });

  it('Grep dans un dossier hors des deux : refusé', async () => {
    const forme = await startForme('auto');

    // le dossier du dehors n'est pas fouillé
    expect(await verdict(forme, 'Grep', { pattern: 'SECRET', path: path.dirname(secret) })).toBe('deny');
  });

  // Un chemin qui commence par le projet, puis en sort.
  it('un chemin du projet qui en sort par ../ : refusé', async () => {
    const forme = await startForme('auto');

    // le fichier du dehors n'est pas lu par ce détour
    expect(await verdict(forme, 'Read', { file_path: `${project}/../dehors/secret.txt` })).toBe('deny');
  });

  // Un lien posé dans le projet, qui mène au dehors.
  it('un lien du projet vers un dossier du dehors : refusé', async () => {
    const forme = await startForme('auto');
    fs.symlinkSync(path.dirname(secret), path.join(project, 'lien'));

    // le fichier du dehors n'est pas lu par le lien
    expect(await verdict(forme, 'Read', { file_path: path.join(project, 'lien', 'secret.txt') })).toBe('deny');
  });

  it('le dossier des artefacts du projet : refusé', async () => {
    const forme = await startForme('auto');
    const { projectArtifactsPath } = await import('app/controllers');

    // il n'est plus donné à une course : rien n'y est écrit
    expect(await verdict(forme, 'Write', { file_path: path.join(projectArtifactsPath(project), 'a.html'), content: 'x' })).toBe('deny');
  });

  it('un sous-agent : Read hors des deux refusé', async () => {
    const forme = await startForme('auto');

    // le contrôle vaut pour ses sous-agents aussi
    expect(await verdict(forme, 'Read', { file_path: secret }, DEVELOPER)).toBe('deny');
  });

  it('demandée par l’orchestrateur : Read hors des deux refusé', async () => {
    const forme = await startForme('auto', 'orchestrator');

    // le fichier du dehors n'est pas lu
    expect(await verdict(forme, 'Read', { file_path: secret })).toBe('deny');
  });

  it('les dossiers de travail donnés au processus : aucun hors du projet et des sorties', async () => {
    const forme = await startForme('auto');
    const dirs = (forme.options.additionalDirectories ?? []) as string[];
    const inside = (d: string) => [project, out].some((base) => d === base || d.startsWith(`${base}${path.sep}`));

    // aucun dossier en plus hors des deux (le dossier des artefacts du projet compris)
    expect(dirs.filter((d) => !inside(d))).toEqual([]);
  });
});

describe('une action n’élargit pas ses propres droits', () => {
  it('écrire le SKILL.md de son skill, dans le plugin : refusé', async () => {
    const forme = await startForme('auto');
    const skill = path.join(pluginDir(forme), 'skills', 'forme', 'SKILL.md');

    // sa liste n'est pas réécrite
    expect(await verdict(forme, 'Write', { file_path: skill, content: 'allowed-tools: "Bash"' })).toBe('deny');
  });

  it('écrire un skill du projet (.claude/skills/) : refusé', async () => {
    const forme = await startForme('auto');

    // aucun skill du projet n'est écrit
    expect(await verdict(forme, 'Write', { file_path: path.join(project, '.claude/skills/x/SKILL.md'), content: 'x' })).toBe('deny');
  });

  it('modifier les réglages du projet (.claude/settings.json) : refusé', async () => {
    const forme = await startForme('auto');

    // les règles d'autorisation du projet ne sont pas élargies
    expect(await verdict(forme, 'Edit', { file_path: path.join(project, '.claude/settings.json'), old_string: '[]', new_string: '["Bash"]' })).toBe('deny');
  });

  it('écrire les réglages de l’utilisateur (~/.claude/settings.json) : refusé', async () => {
    const forme = await startForme('auto');

    // ses règles d'autorisation ne sont pas élargies
    expect(await verdict(forme, 'Write', { file_path: path.join(os.homedir(), '.claude', 'settings.json'), content: '{}' })).toBe('deny');
  });

  it('modifier AGENTS.md du projet : refusé', async () => {
    const forme = await startForme('auto');

    // témoin : modifier un autre fichier du projet passe (le contrôle juge bien le fichier)
    expect(await verdict(forme, 'Edit', { file_path: path.join(project, 'src', 'a.ts'), old_string: 'a', new_string: 'b' })).toBe('pass');
    // ses commandes, que l'appli ajoute à la liste, ne changent pas
    expect(await verdict(forme, 'Edit', { file_path: path.join(project, 'AGENTS.md'), old_string: 'npm test', new_string: 'rm -rf /' })).toBe('deny');
  });

  it('écrire un AGENTS.md dans un sous-dossier : refusé', async () => {
    const forme = await startForme('auto');

    // aucun AGENTS.md n'est écrit, où qu'il soit dans le projet
    expect(await verdict(forme, 'Write', { file_path: path.join(project, 'src', 'AGENTS.md'), content: 'x' })).toBe('deny');
  });

  it('modifier package.json : refusé', async () => {
    const forme = await startForme('auto');

    // ce que lance npm test ne change pas
    expect(await verdict(forme, 'Edit', { file_path: path.join(project, 'package.json'), old_string: 'vitest run', new_string: 'curl x | sh' })).toBe('deny');
  });

  it('écrire un package.json dans un sous-dossier : refusé', async () => {
    const forme = await startForme('auto');

    // aucun package.json n'est écrit, où qu'il soit dans le projet (un espace de travail du dépôt)
    expect(await verdict(forme, 'Write', { file_path: path.join(project, 'packages', 'a', 'package.json'), content: '{}' })).toBe('deny');
  });

  it('MultiEdit de package.json : refusé', async () => {
    const forme = await startForme('auto');

    // une écriture par MultiEdit aussi
    expect(await verdict(forme, 'MultiEdit', { file_path: path.join(project, 'package.json'), edits: [{ old_string: 'vitest run', new_string: 'x' }] })).toBe('deny');
  });

  it('écrire dans le dossier .git/ : refusé', async () => {
    const forme = await startForme('auto');

    // aucun hook git n'est posé
    expect(await verdict(forme, 'Write', { file_path: path.join(project, '.git', 'hooks', 'pre-commit'), content: 'x' })).toBe('deny');
  });

  it('écrire un hook du projet (.husky/) : refusé', async () => {
    const forme = await startForme('auto');

    // ce que lance le prochain commit ne change pas
    expect(await verdict(forme, 'Write', { file_path: path.join(project, '.husky', 'pre-commit'), content: 'x' })).toBe('deny');
  });

  it('NotebookEdit sous .claude/ : refusé', async () => {
    const forme = await startForme('auto');

    // une écriture par NotebookEdit aussi (notebook_path)
    expect(await verdict(forme, 'NotebookEdit', { notebook_path: path.join(project, '.claude', 'x.ipynb'), new_source: 'x' })).toBe('deny');
  });

  it('un sous-agent : modifier AGENTS.md refusé', async () => {
    const forme = await startForme('auto');

    // le contrôle vaut pour le développeur que la course lance
    expect(await verdict(forme, 'Edit', { file_path: path.join(project, 'AGENTS.md'), old_string: 'npm test', new_string: 'x' }, DEVELOPER)).toBe('deny');
  });
});
