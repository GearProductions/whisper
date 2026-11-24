// Invariants de la preuve des invariants par mutation (note 0.16.0, docs/tickets/feat/0.16.0-controle-en-trois-points.md,
// « Ce que ça ne doit pas faire ») :
//   - I-64 « Modifier un test protégé existant pour faire passer une preuve : seuls les tests d'invariants que le ticket
//     ajoute se corrigent » : la course Prouver les invariants n'écrit aucun test du projet, un test d'invariant
//     existant compris (la correction d'un test resté vert passe par l'alignement, hors de cette course) ;
//   - I-65 « Laisser une mutation dans le dossier de travail, dans l'index ou dans un commit » : la course n'écrit, par
//     ses outils de fichiers, que dans les sorties de l'agent (sa copie du code y vit, dans son dossier temporaire), et
//     aucune commande git qui écrit l'index, le dossier de travail ou un commit ne lui est ouverte.
// Décisions de la note ajoutées depuis (« Ce que ça fait » 3, « Forme ») :
//   - I-64 : l'appli refuse à la course Vérifier l'alignement d'écrire dans un fichier de tests d'invariants qui existait
//     au départ de la branche (un cas que la branche y ajoute compris) ; un fichier de tests d'invariants nouveau reste
//     écrit (le témoin de chaque refus) ;
//   - I-64 : à la fin de la course Vérifier l'alignement, l'appli compare les fichiers de tests d'invariants qui
//     existaient au départ de la branche à leur état d'avant la course ; l'un d'eux changé (par une commande du
//     terminal, que le contrôle des fichiers ne voit pas) : la course échoue et sa réponse le nomme ; un fichier de tests
//     d'invariants nouveau corrigé, ou rien de touché : la course finit normalement ;
//   - I-65 : à la fin de la course Prouver les invariants, quelle qu'elle soit (finie, en échec, arrêtée), une différence
//     du dossier de travail ou de l'index avec leur état de son départ fait échouer la course, sa réponse nomme les
//     fichiers touchés, et preuve.md est effacée ; sans différence, la course est faite et preuve.md reste.
// Le dossier temporaire effacé à la fin de chaque course : I-58 (run-tmp.test.ts, même dossier), inchangé.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, runtime des agents, état, réglages et fichiers sur disque, git réel sur un dépôt
// d'essai, les actions et skills livrés dans resources/, installés dans le profil), dans le décor commun
// (app/tests/harness) ; faux : Electron (le décor) et le SDK de Claude Code, ici celui du fichier : il relève, pour chaque
// processus, son premier message et les options reçues à son lancement ; son tour dure jusqu'à ce que le cas le finisse
// (end : succès ou échec) ou que l'appli l'interrompe. Ce que fait la course dans le projet est joué par le cas, qui écrit
// sur le disque et lance git comme le ferait une commande de son terminal. Ce que Claude Code juge lui-même
// n'est pas rejoué : on vérifie ce que l'appli lui donne. Une commande est jugée sur les règles de refus données au
// processus ; le contrôle des fichiers est appelé comme le SDK l'appelle avant un outil (les crochets PreToolUse des
// options), pour la course ou pour un de ses sous-agents (agent_id).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeElectron, git, openPanel, profile, repo, repoResources, settle, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);
vi.mock('technicals/paths', () => repoResources());

// Un processus de Claude Code : son premier message, les options de son lancement ; end(true) finit son tour sur un
// succès, end(false) sur un échec.
type Proc = { text: string; options: Record<string, unknown>; end: (ok: boolean) => void };
const procs: Proc[] = [];

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options: Record<string, unknown> }) => {
      const proc: Proc = { text: '', options, end: () => {} };
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          if (!proc.text) { proc.text = String(m.message.content); procs.push(proc); }
          const ok = await new Promise<boolean>((done) => { proc.end = done; });
          yield ok
            ? { type: 'result', subtype: 'success', is_error: false, result: 'ok' }
            : { type: 'result', subtype: 'error_during_execution', is_error: true };
        }
      }()), {
        setPermissionMode: async () => {},
        setModel: async () => {},
        interrupt: async () => { proc.end(false); },
        rewindFiles: async () => ({ canRewind: true, filesChanged: [] }),
      });
    },
  }),
}));

// Le préfixe des actions (config.json).
const PREFIX = 'distrobox enter dev --';
const BRANCH = 'feat/0.16.0-essai';
const NOTE_TEXT = ['# 0.16.0 — essai', '', '## Ce que ça fait', '', '- un essai', '',
  '## Ce que ça ne doit pas faire', '', '- Lire un autre fichier. → invariant', '',
  '## Forme', '', '```', 'src/core/hello    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
// Un module du projet, commité ; un test d'invariant d'avant le ticket, protégé, commité sur main.
const MOD = 'src/core/hello/index.ts';
const OLD_INV = 'src/core/hello/tests/invariants/ancien.test.ts';
// Un test d'invariant que la branche crée (son premier commit) ; un autre qu'elle n'a pas encore commité.
const NEW_INV = 'src/core/hello/tests/invariants/nouveau.test.ts';
const UNCOMMITTED_INV = 'src/core/hello/tests/invariants/pas-commite.test.ts';

let root = '';     // le profil d'essai
let project = '';  // le dossier de l'agent, un dépôt git
let out = '';      // les sorties de l'agent

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  procs.length = 0;
  root = profile('whisper-prove-rights-');
  project = path.join(root, 'projet');
  out = path.join(root, 'vibecoder-out', 'a1');
  repo(project, { branch: BRANCH, note: NOTE_TEXT });
  // Le test d'invariant d'avant le ticket : sur main, puis la branche rebasée dessus.
  git(project, 'checkout', '-q', 'main');
  write(path.join(project, OLD_INV), "import { it } from 'vitest';\nit('un ancien cas', () => {});\n");
  git(project, 'add', '.');
  git(project, 'commit', '-q', '-m', 'ancien invariant');
  git(project, 'checkout', '-q', BRANCH);
  git(project, 'rebase', '-q', 'main');
  write(path.join(project, NEW_INV), "import { it } from 'vitest';\nit('un nouveau cas', () => {});\n");
  git(project, 'add', '.');
  git(project, 'commit', '-q', '-m', 'invariants');
  write(path.join(project, MOD), 'export const hello = 1;\n');
  git(project, 'add', '.');
  git(project, 'commit', '-q', '-m', 'module');
});
afterEach(closeAll);

// L'agent a1 en Auto, le préfixe posé ; l'appli démarrée ; l'action `id` lancée comme le fait un bouton (startRun),
// quel que soit l'état de la branche, son skill `skill` appelé ; son processus.
async function startAction(id: string, skill: string): Promise<Proc> {
  writeConfig(root, [{ id: 'a1', dir: project, name: 'essai', model: 'opus', effort: 'high', mode: 'auto', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], { vibeCommandPrefix: PREFIX });
  (await import('app/settings')).ensureVibeFiles();
  await openPanel('a1');
  const { startRun } = await import('app/controllers');
  const { loadConfig, vibeActions } = await import('app/settings');
  const { agentList, vibeLang } = await import('core/config');
  const cfg = loadConfig();
  const def = vibeActions(vibeLang(cfg)).find((d) => d.id === id);
  if (!def) throw new Error(`aucune action ${id}`);
  startRun(agentList(cfg)[0], def, { text: `/vibecoder:${skill}`, images: [] }, cfg);
  await settle();
  const proc = procs.find((p) => p.text.startsWith(`/vibecoder:${skill}`));
  if (!proc) throw new Error(`l’action ${id} n’est pas partie`);
  return proc;
}
// Prouver les invariants (prove) ; Vérifier l'alignement (align).
const startProve = () => startAction('prove', 'prouver');
const startAlign = () => startAction('align', 'aligner');

// La commande `command` est-elle refusée au processus ? Jugée sur ses règles de refus (disallowedTools) comme Claude
// Code les lit : `Bash` seul refuse tout ; `Bash(<motif>)`, `*` vaut n'importe quoi, un ` *` (ou `:*`) final couvre
// aussi la commande seule, à la frontière d'un mot.
function refused(p: Proc, command: string): boolean {
  const rules = (p.options.disallowedTools ?? []) as string[];
  return rules.some((rule) => {
    if (rule === 'Bash') return true;
    const pattern = /^Bash\((.*)\)$/s.exec(rule)?.[1];
    if (pattern === undefined) return false;
    const spaced = pattern.replace(/:\*$/, ' *');
    const tail = spaced.endsWith(' *');
    const body = (tail ? spaced.slice(0, -2) : spaced).split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${body}${tail ? '(?: .*)?' : ''}$`, 's').test(command);
  });
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
// Un sous-agent de la course, tel que le SDK le nomme au crochet.
const SUBAGENT = { agent_id: 'sub-1', agent_type: 'general-purpose' };
// La copie mutée du module, dans le dossier temporaire de la course, sous les sorties de l'agent.
const copyOf = (rel: string) => path.join(out, 'tmp', 'prove', 'copie', rel);

describe('I-65 : la course Prouver les invariants n’écrit ses mutations que dans ses sorties', () => {
  it('Write d’un module du projet : refusé', async () => {
    const prove = await startProve();

    // témoin : la même mutation, écrite dans sa copie sous les sorties, passe
    expect(await verdict(prove, 'Write', { file_path: copyOf(MOD), content: 'export const hello = 2;\n' })).toBe('pass');
    // dans le dossier de travail, elle est refusée
    expect(await verdict(prove, 'Write', { file_path: path.join(project, MOD), content: 'export const hello = 2;\n' })).toBe('deny');
  });

  it('Edit d’un module du projet : refusé', async () => {
    const prove = await startProve();

    // témoin : la même retouche, dans sa copie sous les sorties, passe
    expect(await verdict(prove, 'Edit', { file_path: copyOf(MOD), old_string: '1', new_string: '2' })).toBe('pass');
    // dans le dossier de travail, elle est refusée
    expect(await verdict(prove, 'Edit', { file_path: path.join(project, MOD), old_string: '1', new_string: '2' })).toBe('deny');
  });

  it('MultiEdit d’un module du projet : refusé', async () => {
    const prove = await startProve();

    // dans le dossier de travail, la retouche est refusée
    expect(await verdict(prove, 'MultiEdit', { file_path: path.join(project, MOD), edits: [{ old_string: '1', new_string: '2' }] })).toBe('deny');
  });

  // La course confie la mutation à un sous-agent.
  it('un sous-agent : Write d’un module du projet refusé', async () => {
    const prove = await startProve();

    // témoin : dans sa copie sous les sorties, le sous-agent écrit
    expect(await verdict(prove, 'Write', { file_path: copyOf(MOD), content: 'export const hello = 2;\n' }, SUBAGENT)).toBe('pass');
    // dans le dossier de travail, il est refusé
    expect(await verdict(prove, 'Write', { file_path: path.join(project, MOD), content: 'export const hello = 2;\n' }, SUBAGENT)).toBe('deny');
  });

  // Un fichier que la mutation créerait à côté du module.
  it('Write d’un nouveau fichier dans le projet : refusé', async () => {
    const prove = await startProve();

    // aucun fichier n'apparaît dans le dossier de travail
    expect(await verdict(prove, 'Write', { file_path: path.join(project, 'src/core/hello/mutant.ts'), content: 'x' })).toBe('deny');
  });

  it('git add : refusé', async () => {
    const prove = await startProve();

    // rien n'entre dans l'index
    expect(refused(prove, `git add ${MOD}`)).toBe(true);
  });

  it('git add derrière le préfixe des actions : refusé', async () => {
    const prove = await startProve();

    // le préfixe ne rouvre pas l'index
    expect(refused(prove, `${PREFIX} git add -A`)).toBe(true);
  });

  it('git commit : refusé', async () => {
    const prove = await startProve();

    // aucun commit ne porte une mutation
    expect(refused(prove, 'git commit -am mutant')).toBe(true);
  });

  it('git commit derrière le préfixe des actions : refusé', async () => {
    const prove = await startProve();

    // le préfixe ne rouvre pas le commit
    expect(refused(prove, `${PREFIX} git commit -am mutant`)).toBe(true);
  });

  it('git stash : refusé', async () => {
    const prove = await startProve();

    // le dossier de travail n'est ni mis de côté ni rendu
    expect(refused(prove, 'git stash')).toBe(true);
  });

  it('git checkout : refusé', async () => {
    const prove = await startProve();

    // aucun fichier du dossier de travail n'est réécrit depuis git
    expect(refused(prove, `git checkout -- ${MOD}`)).toBe(true);
  });

  it('git restore : refusé', async () => {
    const prove = await startProve();

    // aucun fichier du dossier de travail ni de l'index n'est réécrit depuis git
    expect(refused(prove, `git restore --staged ${MOD}`)).toBe(true);
  });
});

describe('I-64 : la course Prouver les invariants ne modifie aucun test d’invariant existant', () => {
  it('Edit d’un test d’invariant d’avant le ticket : refusé', async () => {
    const prove = await startProve();

    // témoin : la même retouche, dans sa copie sous les sorties, passe
    expect(await verdict(prove, 'Edit', { file_path: copyOf(OLD_INV), old_string: 'un ancien cas', new_string: 'vert' })).toBe('pass');
    // le test protégé du projet n'est pas retouché
    expect(await verdict(prove, 'Edit', { file_path: path.join(project, OLD_INV), old_string: 'un ancien cas', new_string: 'vert' })).toBe('deny');
  });

  it('Write d’un test d’invariant d’avant le ticket : refusé', async () => {
    const prove = await startProve();

    // le test protégé du projet n'est pas réécrit
    expect(await verdict(prove, 'Write', { file_path: path.join(project, OLD_INV), content: "it('vert', () => {});\n" })).toBe('deny');
  });

  it('un sous-agent : Edit d’un test d’invariant d’avant le ticket refusé', async () => {
    const prove = await startProve();

    // le test protégé du projet n'est pas retouché par un sous-agent non plus
    expect(await verdict(prove, 'Edit', { file_path: path.join(project, OLD_INV), old_string: 'un ancien cas', new_string: 'vert' }, SUBAGENT)).toBe('deny');
  });
});

describe('I-64 : la course Vérifier l’alignement n’écrit dans aucun test d’invariant du départ de la branche', () => {
  it('Write d’un test d’invariant du départ de la branche : refusé', async () => {
    const align = await startAlign();

    // témoin : un test d'invariant nouveau, pas encore commité, est écrit
    expect(await verdict(align, 'Write', { file_path: path.join(project, UNCOMMITTED_INV), content: "it('vert', () => {});\n" })).toBe('pass');
    // le test d'invariant d'avant la branche n'est pas réécrit
    expect(await verdict(align, 'Write', { file_path: path.join(project, OLD_INV), content: "it('vert', () => {});\n" })).toBe('deny');
  });

  it('Edit d’un test d’invariant du départ de la branche : refusé', async () => {
    const align = await startAlign();

    // témoin : le test d'invariant que la branche crée est retouché
    expect(await verdict(align, 'Edit', { file_path: path.join(project, NEW_INV), old_string: 'un nouveau cas', new_string: 'corrigé' })).toBe('pass');
    // le test d'invariant d'avant la branche n'est pas retouché
    expect(await verdict(align, 'Edit', { file_path: path.join(project, OLD_INV), old_string: 'un ancien cas', new_string: 'vert' })).toBe('deny');
  });

  it('MultiEdit d’un test d’invariant du départ de la branche : refusé', async () => {
    const align = await startAlign();

    // témoin : le test d'invariant que la branche crée est retouché
    expect(await verdict(align, 'MultiEdit', { file_path: path.join(project, NEW_INV), edits: [{ old_string: 'un nouveau cas', new_string: 'corrigé' }] })).toBe('pass');
    // le test d'invariant d'avant la branche n'est pas retouché
    expect(await verdict(align, 'MultiEdit', { file_path: path.join(project, OLD_INV), edits: [{ old_string: 'un ancien cas', new_string: 'vert' }] })).toBe('deny');
  });

  // La course confie la correction à un sous-agent.
  it('un sous-agent : Edit d’un test d’invariant du départ de la branche refusé', async () => {
    const align = await startAlign();

    // témoin : le sous-agent retouche le test d'invariant que la branche crée
    expect(await verdict(align, 'Edit', { file_path: path.join(project, NEW_INV), old_string: 'un nouveau cas', new_string: 'corrigé' }, SUBAGENT)).toBe('pass');
    // le test d'invariant d'avant la branche n'est pas retouché par un sous-agent non plus
    expect(await verdict(align, 'Edit', { file_path: path.join(project, OLD_INV), old_string: 'un ancien cas', new_string: 'vert' }, SUBAGENT)).toBe('deny');
  });

  // La branche a ajouté un cas dans le fichier existant, et commité : le fichier existait quand même au départ.
  it('un cas que la branche ajoute à un test d’invariant d’avant elle : le fichier reste refusé', async () => {
    write(path.join(project, OLD_INV), "import { it } from 'vitest';\nit('un ancien cas', () => {});\nit('un cas de la branche', () => {});\n");
    git(project, 'add', '.');
    git(project, 'commit', '-q', '-m', 'un cas de plus');
    const align = await startAlign();

    // témoin : le test d'invariant que la branche crée est retouché
    expect(await verdict(align, 'Edit', { file_path: path.join(project, NEW_INV), old_string: 'un nouveau cas', new_string: 'corrigé' })).toBe('pass');
    // le cas ajouté par la branche n'est pas retouché : son fichier existait au départ de la branche
    expect(await verdict(align, 'Edit', { file_path: path.join(project, OLD_INV), old_string: 'un cas de la branche', new_string: 'vert' })).toBe('deny');
  });

  // Un lien du projet qui mène au test d'invariant d'avant la branche.
  it('Write par un lien vers un test d’invariant du départ de la branche : refusé', async () => {
    fs.symlinkSync(path.join(project, OLD_INV), path.join(project, 'src/core/hello/lien.ts'));
    fs.symlinkSync(path.join(project, NEW_INV), path.join(project, 'src/core/hello/lien-nouveau.ts'));
    const align = await startAlign();

    // témoin : par un lien vers le test d'invariant que la branche crée, l'écriture passe
    expect(await verdict(align, 'Write', { file_path: path.join(project, 'src/core/hello/lien-nouveau.ts'), content: "it('vert', () => {});\n" })).toBe('pass');
    // par un lien vers le test d'invariant d'avant la branche, elle est refusée
    expect(await verdict(align, 'Write', { file_path: path.join(project, 'src/core/hello/lien.ts'), content: "it('vert', () => {});\n" })).toBe('deny');
  });
});

// preuve.md, dans les sorties de l'agent ; la course prove vue par l'appli (son état, sa réponse).
const proofFile = () => path.join(out, 'preuve.md');
const PROOF = '## [prouvé] Lire un autre fichier. → invariant\n\nMutant : hello() lit un autre fichier.\n';
async function proveRun() {
  return (await import('app/controllers')).runsOf({ id: 'a1' }).find((r) => r.id === 'prove');
}
// La fin de la course, et le temps que l'appli relise l'état du dépôt.
const afterEnd = () => settle(1000);
// La course align vue par l'appli (son état, sa réponse).
async function alignRun() {
  return (await import('app/controllers')).runsOf({ id: 'a1' }).find((r) => r.id === 'align');
}

describe('I-64 : à la fin de Vérifier l’alignement, un test d’invariant du départ de la branche changé fait échouer la course', () => {
  // Le témoin des cas qui suivent : la même course, sans rien toucher, finit normalement.
  it('la course finie sans rien toucher : faite', async () => {
    const align = await startAlign();

    align.end(true);
    await afterEnd();

    // la course est faite
    expect((await alignRun())?.state).toBe('done');
  });

  it('un test d’invariant du départ de la branche modifié pendant la course : la course en échec, le fichier nommé', async () => {
    const align = await startAlign();
    // une commande du terminal de la course réécrit le test d'avant la branche, hors du contrôle des fichiers
    write(path.join(project, OLD_INV), "import { it } from 'vitest';\nit('vert', () => {});\n");

    align.end(true);
    await afterEnd();

    // la course est en échec
    expect((await alignRun())?.state).toBe('failed');
    // sa réponse nomme le test d'avant la branche
    expect((await alignRun())?.reply).toContain(OLD_INV);
  });

  // Le fichier que la branche crée n'existait pas à son départ : l'alignement le corrige librement.
  it('un test d’invariant que la branche crée modifié pendant la course : la course faite', async () => {
    const align = await startAlign();
    // une commande du terminal de la course corrige le test nouveau
    write(path.join(project, NEW_INV), "import { it } from 'vitest';\nit('un nouveau cas corrigé', () => {});\n");

    align.end(true);
    await afterEnd();

    // la course est faite, pas en échec
    expect((await alignRun())?.state).toBe('done');
  });
});

describe('I-65 : à la fin de Prouver les invariants, une trace dans le dossier de travail ou l’index fait échouer la preuve', () => {
  // Le témoin des cas qui suivent : la même course, sans rien toucher, est faite et garde sa preuve.
  it('la course finie sans rien toucher : faite, preuve.md reste', async () => {
    const prove = await startProve();
    write(proofFile(), PROOF);

    prove.end(true);
    await afterEnd();

    // la course est faite
    expect((await proveRun())?.state).toBe('done');
    // sa preuve reste
    expect(fs.existsSync(proofFile())).toBe(true);
  });

  it('un module du projet modifié pendant la preuve : la course en échec, le fichier nommé, preuve.md effacée', async () => {
    const prove = await startProve();
    write(proofFile(), PROOF);
    // une commande de la course mute le module dans le dossier de travail
    write(path.join(project, MOD), 'export const hello = 2;\n');

    prove.end(true);
    await afterEnd();

    // la course est en échec
    expect((await proveRun())?.state).toBe('failed');
    // sa réponse nomme le module touché
    expect((await proveRun())?.reply).toContain(MOD);
    // sa preuve est effacée
    expect(fs.existsSync(proofFile())).toBe(false);
  });

  // Le fichier était déjà modifié par l'utilisateur avant la preuve : la mutation s'y ajoute.
  it('un module déjà modifié avant la preuve, modifié encore : la course en échec, le fichier nommé, preuve.md effacée', async () => {
    write(path.join(project, MOD), 'export const hello = 3;\n');
    const prove = await startProve();
    write(proofFile(), PROOF);
    // une commande de la course mute le module déjà modifié
    write(path.join(project, MOD), 'export const hello = 4;\n');

    prove.end(true);
    await afterEnd();

    // la course est en échec
    expect((await proveRun())?.state).toBe('failed');
    // sa réponse nomme le module touché
    expect((await proveRun())?.reply).toContain(MOD);
    // sa preuve est effacée
    expect(fs.existsSync(proofFile())).toBe(false);
  });

  it('un fichier copié dans le projet pendant la preuve : la course en échec, le fichier nommé, preuve.md effacée', async () => {
    const COPY = 'src/core/hello/copie.ts';
    const prove = await startProve();
    write(proofFile(), PROOF);
    // une commande de la course copie un fichier dans le dossier de travail
    fs.copyFileSync(path.join(project, MOD), path.join(project, COPY));

    prove.end(true);
    await afterEnd();

    // la course est en échec
    expect((await proveRun())?.state).toBe('failed');
    // sa réponse nomme la copie
    expect((await proveRun())?.reply).toContain(COPY);
    // sa preuve est effacée
    expect(fs.existsSync(proofFile())).toBe(false);
  });

  // Le fichier était là avant, pas suivi ; seul l'index change.
  it('un fichier ajouté à l’index pendant la preuve : la course en échec, le fichier nommé, preuve.md effacée', async () => {
    const DRAFT = 'src/core/hello/brouillon.ts';
    write(path.join(project, DRAFT), 'export const brouillon = 1;\n');
    const prove = await startProve();
    write(proofFile(), PROOF);
    // une commande de la course ajoute le fichier à l'index
    git(project, 'add', DRAFT);

    prove.end(true);
    await afterEnd();

    // la course est en échec
    expect((await proveRun())?.state).toBe('failed');
    // sa réponse nomme le fichier ajouté à l'index
    expect((await proveRun())?.reply).toContain(DRAFT);
    // sa preuve est effacée
    expect(fs.existsSync(proofFile())).toBe(false);
  });

  it('un commit fait pendant la preuve : la course en échec, preuve.md effacée', async () => {
    const prove = await startProve();
    write(proofFile(), PROOF);
    // une commande de la course commite une mutation
    write(path.join(project, MOD), 'export const hello = 2;\n');
    git(project, 'commit', '-q', '-am', 'mutant');

    prove.end(true);
    await afterEnd();

    // la course est en échec
    expect((await proveRun())?.state).toBe('failed');
    // sa réponse dit le commit de plus (HEAD)
    expect((await proveRun())?.reply).toContain('HEAD');
    // sa preuve est effacée
    expect(fs.existsSync(proofFile())).toBe(false);
  });

  // La course finit d'elle-même sur un échec, après avoir touché un fichier.
  it('la course finie en échec après avoir modifié un module : le fichier nommé, preuve.md effacée', async () => {
    const prove = await startProve();
    write(proofFile(), PROOF);
    // une commande de la course mute le module dans le dossier de travail
    write(path.join(project, MOD), 'export const hello = 2;\n');

    prove.end(false);
    await afterEnd();

    // sa réponse nomme le module touché
    expect((await proveRun())?.reply).toContain(MOD);
    // sa preuve est effacée
    expect(fs.existsSync(proofFile())).toBe(false);
  });

  it('la course arrêtée à la main après avoir modifié un module : le fichier nommé, preuve.md effacée', async () => {
    await startProve();
    write(proofFile(), PROOF);
    // une commande de la course mute le module dans le dossier de travail
    write(path.join(project, MOD), 'export const hello = 2;\n');
    const { vibeRunOp } = await import('app/controllers');

    await vibeRunOp('prove', 'stop');
    await afterEnd();

    // sa réponse nomme le module touché
    expect((await proveRun())?.reply).toContain(MOD);
    // sa preuve est effacée
    expect(fs.existsSync(proofFile())).toBe(false);
  });
});
