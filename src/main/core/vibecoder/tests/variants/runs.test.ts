import { describe, expect, it } from 'vitest';
import { blockedBy, codeLock, lockCode, REQUEST_ARGS, cutCommands, cutLine, denialLine, failingDenials, unreadLine, endNotice, ownRun, remainingModules, runKey, runModule, runPhase, runTasks, runViews, type ActionDef, type Run } from 'core/vibecoder';

const A = (id: string, step: ActionDef['step'], reads = false, kind: ActionDef['kind'] = 'send'): ActionDef =>
  ({ id, flow: 'create', step, kind, needs: 'none', label: `L-${id}`, hint: '', text: `/vibecoder:${id}`, reads });
const FORME = A('forme', 'forme');
const PONYTAIL = A('ponytail', 'revue', true);
const CHECKS = A('checks', 'revue', true);
const DEFS = [FORME, PONYTAIL, CHECKS, A('vibe', null), A('comment', 'note', false, 'prefill')];
const run = (id: string, over: Partial<Run> = {}): Run =>
  ({ id, key: runKey(id), since: 1, end: null, state: 'running', reply: '', sessionId: null, module: null, ...over });

describe('ownRun et runKey', () => {
  it('court à part : une action envoyée d\'une étape ; pas sans étape, pas un prefill', () => {
    expect(DEFS.map(ownRun)).toEqual([true, true, true, false, false]);
  });

  it('answers reprend la course de la note', () => {
    expect([runKey('answers'), runKey('forme')]).toEqual(['note', 'forme']);
  });
});

describe('blockedBy : la règle', () => {
  it('rien en cours : tout part', () => {
    expect([blockedBy(FORME, [], 'fr'), blockedBy(PONYTAIL, [], 'fr')]).toEqual([null, null]);
  });

  it('une modification attend toute course, lecture comprise', () => {
    expect(blockedBy(FORME, [{ id: 'ponytail', reads: true }], 'fr')).toBe('Une autre action est en cours');
  });

  it('une lecture n\'attend qu\'une modification', () => {
    expect([blockedBy(CHECKS, [{ id: 'ponytail', reads: true }], 'fr'), blockedBy(CHECKS, [{ id: 'forme', reads: false }], 'fr')])
      .toEqual([null, 'Une action modifie la branche']);
  });

  it('la même action (ou la même clé) déjà en cours', () => {
    expect([blockedBy(PONYTAIL, [{ id: 'ponytail', reads: true }], 'en'), blockedBy(A('answers', 'note'), [{ id: 'note', reads: false }], 'fr')])
      .toEqual(['This action is already running', 'Cette action est déjà en cours']);
  });
});

describe('lockCode : la règle, sans langue', () => {
  it('same : la même action, ou la même clé (answers retenu par la note) ; by : celle qui retient', () => {
    expect([lockCode(PONYTAIL, [{ id: 'ponytail', reads: true }]), lockCode(A('answers', 'note'), [{ id: 'note', reads: false }])])
      .toEqual([{ code: 'same', by: 'ponytail' }, { code: 'same', by: 'note' }]);
  });

  it('busy : une écriture, quoi que ce soit en cours ; by : la première qui retient', () => {
    expect([lockCode(FORME, [{ id: 'ponytail', reads: true }]), lockCode(FORME, [{ id: 'checks', reads: true }, { id: 'note', reads: false }])])
      .toEqual([{ code: 'busy', by: 'ponytail' }, { code: 'busy', by: 'checks' }]);
  });

  it('changing : une lecture, une écriture en cours ; by : l\'écriture', () => {
    expect(lockCode(CHECKS, [{ id: 'ponytail', reads: true }, { id: 'forme', reads: false }])).toEqual({ code: 'changing', by: 'forme' });
  });

  it('null : rien en cours, ou une lecture parmi des lectures', () => {
    expect([lockCode(FORME, []), lockCode(CHECKS, []), lockCode(CHECKS, [{ id: 'ponytail', reads: true }])]).toEqual([null, null, null]);
  });
});

describe('blockedBy : le texte de lockCode, fr et en', () => {
  it('même texte qu\'avant pour chaque code', () => {
    const cases: [ActionDef, { id: string; reads: boolean }[]][] = [
      [PONYTAIL, [{ id: 'ponytail', reads: true }]], [FORME, [{ id: 'checks', reads: true }]], [CHECKS, [{ id: 'forme', reads: false }]],
    ];
    expect(cases.map(([d, r]) => blockedBy(d, r, 'fr'))).toEqual(['Cette action est déjà en cours', 'Une autre action est en cours', 'Une action modifie la branche']);
    expect(cases.map(([d, r]) => blockedBy(d, r, 'en'))).toEqual(['This action is already running', 'Another action is running', 'An action is changing the branch']);
  });
});

describe('REQUEST_ARGS : le schéma de run.start', () => {
  it('les clés qu\'un run.start garde, verdict compris ; jamais direct', () => {
    expect(REQUEST_ARGS).toContain('verdict');
    expect(REQUEST_ARGS).not.toContain('direct');
  });
});

describe('runViews', () => {
  it('la plus récente d\'abord, libellé et qui d\'après l\'action, aucune demande d\'autorisation', () => {
    const v = runViews([run('forme', { since: 1, state: 'done', end: 5 }), run('ponytail', { since: 3, state: 'running' })],
      [{ ...FORME, who: 'opus · élevé' }, PONYTAIL]);
    expect(v).toEqual([
      { id: 'ponytail', label: 'L-ponytail', who: 'agent', state: 'running', since: 3, end: null, reply: '', permission: null },
      { id: 'forme', label: 'L-forme', who: 'opus · élevé', state: 'done', since: 1, end: 5, reply: '', permission: null },
    ]);
  });
});

describe('runViews : progress', () => {
  it('recopie progress quand la course en a un, sinon rien', () => {
    const progress = { wave: 2, done: 3, total: 5, fixes: 1, opus: false };
    const v = runViews([run('forme', { progress, since: 2 }), run('ponytail', { since: 1 })], DEFS);
    expect([v[0].progress, 'progress' in v[1]]).toEqual([progress, false]);
  });
});

describe('endNotice : l\'avis de fin', () => {
  it('terminée, sa réponse sur une ligne (sans point doublé), rien d\'un fichier à lire', () => {
    expect(endNotice(run('forme', { state: 'done', reply: 'Forme posée.\n\nTrois modules.' }), FORME, 'fr'))
      .toBe('VibeCoder : « L-forme » terminée — Forme posée. Trois modules.');
  });

  it('en échec ; en anglais ; sans réponse', () => {
    expect([endNotice(run('forme', { state: 'failed' }), FORME, 'fr'), endNotice(run('forme', { state: 'done' }), FORME, 'en')])
      .toEqual(['VibeCoder : « L-forme » en échec.', 'VibeCoder: “L-forme” finished.']);
  });

  it('une longue réponse : 300 caractères au plus', () => {
    const notice = endNotice(run('forme', { state: 'done', reply: 'x'.repeat(1000) }), FORME, 'fr');
    expect(notice).toBe(`VibeCoder : « L-forme » terminée — ${'x'.repeat(299)}…`);
  });
});

describe('runPhase', () => {
  it('asking d\'abord ; en cours au travail ou tant que des tâches de fond tournent ; au repos sinon', () => {
    expect([
      runPhase('asking', 0), runPhase('asking', 2), runPhase('working', 0), runPhase('idle', 1), runPhase('idle', 0),
    ]).toEqual(['asking', 'asking', 'running', 'running', 'idle']);
  });

  it('tâches de fond tombées à 0 hors tour : grace ; au travail, ou une autorisation qui attend : pas de grace', () => {
    expect([
      runPhase('idle', 0, 1), runPhase('idle', 0, 0), runPhase('working', 0, 1), runPhase('asking', 0, 1), runPhase('idle', 1, 2),
    ]).toEqual(['grace', 'idle', 'running', 'asking', 'running']);
  });
});

describe('runTasks', () => {
  it('hors repos, le plus haut de tasks et before ; au repos, tasks', () => {
    expect([runTasks('working', 0, 2), runTasks('asking', 3, 1), runTasks('working', 2, 0), runTasks('idle', 0, 2), runTasks('idle', 1, 3)])
      .toEqual([2, 3, 2, 0, 1]);
  });
});

describe('cutCommands et cutLine', () => {
  it('compte les local_bash arrêtés, pas les autres', () => {
    const t = (type: string, status: string) => ({ type, status });
    expect(cutCommands([t('local_bash', 'stopped'), t('local_bash', 'running'), t('local_bash', 'completed'), t('local_agent', 'stopped'), t('local_bash', 'stopped')])).toBe(2);
    expect(cutCommands([])).toBe(0);
  });

  it('la ligne dit combien, dans la langue', () => {
    expect(cutLine(1, 'fr')).toContain('1 commande en arrière-plan coupée ');
    expect(cutLine(2, 'fr')).toContain('2 commandes en arrière-plan coupées ');
    expect(cutLine(1, 'en')).toContain('1 background command cut ');
    expect(cutLine(3, 'en')).toContain('3 background commands cut ');
  });
});

describe('remainingModules', () => {
  const m = (touched: boolean, started?: boolean, uncommitted?: boolean) => ({ path: 'p', paths: ['p'], contract: '', file: null, touched, started, commits: [], uncommitted });
  it('ni commit ni modification (started absent : comme touched)', () => {
    expect(remainingModules([m(false), m(true), m(false, undefined, false), m(true, undefined, true)])).toBe(2);
  });

  it('un module au squelette seul compte encore, commité ou non', () => {
    expect(remainingModules([m(true, false), m(false, false, true), m(true, true), m(false, true, true)])).toBe(2);
  });
});

describe('runModule : le module que génère une course', () => {
  const mod = (path: string, touched: boolean) => ({ path, paths: [path], contract: '', file: null, touched, commits: [] });
  const MODS = [mod('a', true), mod('b', false), mod('c', false)];

  it('module : le rang donné, sinon le premier pas touché ; un rang inconnu → null', () => {
    expect([runModule('module', { module: 2 }, MODS), runModule('module', {}, MODS), runModule('module', { module: 9 }, MODS)])
      .toEqual(['c', 'b', null]);
  });

  it('modules → * ; une autre action → null ; tout touché → null', () => {
    expect([runModule('modules', {}, MODS), runModule('forme', { module: 1 }, MODS), runModule('module', {}, [mod('a', true)])])
      .toEqual(['*', null, null]);
  });
});

describe('codeLock : pourquoi le code ne s\'édite pas', () => {
  it('un tour de la conversation passe avant ; une course qui retient ce module ou * ; sinon éditable', () => {
    expect([
      codeLock('a', true, [], 'fr'),
      codeLock('a', false, [{ module: 'a' }], 'en'),
      codeLock('a', false, [{ module: '*' }], 'fr'),
      codeLock('a', false, [{ module: 'b' }, { module: null }], 'fr'),
    ]).toEqual(['La conversation travaille', 'This module is being generated', 'Ce module est en cours de génération', null]);
  });
  it('sans module (la note, un test) : un tour, ou n\'importe quelle course qui retient', () => {
    expect([codeLock(null, true, [{ module: 'a' }], 'fr'), codeLock(null, false, [{ module: 'b' }], 'en'), codeLock(null, false, [], 'fr')])
      .toEqual(['La conversation travaille', 'An action of the agent is running', null]);
  });
});

const D = (tool: string, target: string, read = false) => ({ toolUseId: `t-${tool}-${target}`, tool, target, read });

describe('failingDenials', () => {
  it('Bash et Write gardés, Read et Grep retirés ; liste vide : vide', () => {
    const [bash, write, read, grep] = [D('Bash', 'git push'), D('Write', 'a.ts'), D('Read', 'b.ts', true), D('Grep', 'x', true)];
    expect(failingDenials([bash, read, write, grep])).toEqual([bash, write]);
    expect(failingDenials([])).toEqual([]);
  });
});

describe('denialLine', () => {
  it('fr : un Bash refusé, sa commande citée', () => {
    expect(denialLine([D('Bash', 'git push')], 'fr')).toBe('Appels refusés, le travail est incomplet : Bash « git push ».');
  });

  it('en : un Bash refusé, sa commande citée', () => {
    expect(denialLine([D('Bash', 'git push')], 'en')).toBe('Calls denied, the work is incomplete: Bash “git push”.');
  });

  it('deux refus et une lecture : les trois, la lecture à part', () => {
    const line = denialLine([D('Bash', 'rm -rf x'), D('Read', '/etc/passwd', true), D('Write', 'a.ts')], 'fr');
    expect(line).toBe('Appels refusés, le travail est incomplet : Bash « rm -rf x », Write « a.ts ». Lectures refusées : Read « /etc/passwd ».');
    expect(denialLine([D('Bash', 'ls'), D('Grep', 'foo', true)], 'en'))
      .toBe('Calls denied, the work is incomplete: Bash “ls”. Reads denied: Grep “foo”.');
  });

  it('lectures seules : citées, sans échec', () => {
    const fr = denialLine([D('Read', 'a'), D('Glob', 'b', true)].map((d) => ({ ...d, read: true })), 'fr');
    expect(fr).toBe('Lectures refusées : Read « a », Glob « b ».');
    expect(fr).not.toMatch(/échec|incomplet/);
    expect(denialLine([D('Read', 'a', true)], 'en')).toBe('Reads denied: Read “a”.');
  });

  it('une seule ligne : la commande multiligne est aplatie', () => {
    expect(denialLine([D('Bash', 'git commit -m "a\n\nb"\n  && ls')], 'fr')).not.toContain('\n');
  });

  it('beaucoup de refus : tous cités', () => {
    const many = Array.from({ length: 30 }, (_, i) => D('Write', `f${i}.ts`));
    const line = denialLine(many, 'en');
    expect(many.every((d) => line.includes(`“${d.target}”`))).toBe(true);
  });
});

describe('unreadLine', () => {
  it('1 et 2 : singulier, pluriel', () => {
    expect(unreadLine(1, 'fr')).toContain('1 sous-agent a fini');
    expect(unreadLine(2, 'fr')).toContain('2 sous-agents ont fini');
    expect(unreadLine(1, 'en')).toContain('1 subagent finished');
    expect(unreadLine(2, 'en')).toContain('2 subagents finished');
    expect(unreadLine(2, 'fr')).not.toContain('\n');
  });
});
