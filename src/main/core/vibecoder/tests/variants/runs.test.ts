import { describe, expect, it } from 'vitest';
import { blockedBy, codeLock, endNotice, ownRun, parseRequest, runKey, runModule, runPhase, runsFile, runViews, type ActionDef, type Run } from 'core/vibecoder';

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

describe('runViews', () => {
  it('la plus récente d\'abord, libellé et qui d\'après l\'action, sa demande d\'autorisation', () => {
    const v = runViews([run('forme', { since: 1, state: 'done', end: 5 }), run('ponytail', { since: 3, state: 'asking' })],
      [{ ...FORME, who: 'opus · élevé' }, PONYTAIL], (id) => (id === 'ponytail' ? { tool: 'Bash', target: 'ls' } : null));
    expect(v).toEqual([
      { id: 'ponytail', label: 'L-ponytail', who: 'agent', state: 'asking', since: 3, end: null, reply: '', permission: { tool: 'Bash', target: 'ls' } },
      { id: 'forme', label: 'L-forme', who: 'opus · élevé', state: 'done', since: 1, end: 5, reply: '', permission: null },
    ]);
  });
});

describe('runsFile : actions.json', () => {
  it('les actions qui courent à part, les courses, les demandes retenues', () => {
    const file = JSON.parse(runsFile([run('forme', { reply: 'fait' })], DEFS, [{ id: 'ponytail', reason: 'Une action modifie la branche' }]));
    expect(file).toEqual({
      actions: [{ id: 'forme', label: 'L-forme', reads: false }, { id: 'ponytail', label: 'L-ponytail', reads: true },
        { id: 'checks', label: 'L-checks', reads: true }],
      runs: [{ id: 'forme', label: 'L-forme', state: 'running', reads: false, since: 1, end: null, reply: 'fait' }],
      waiting: [{ id: 'ponytail', reason: 'Une action modifie la branche' }],
    });
  });
});

describe('endNotice : l\'avis de fin', () => {
  it('terminée, sa réponse sur une ligne (sans point doublé), où lire l\'état', () => {
    expect(endNotice(run('forme', { state: 'done', reply: 'Forme posée.\n\nTrois modules.' }), FORME, 'fr', '/o'))
      .toBe('VibeCoder : « L-forme » terminée — Forme posée. Trois modules. État : /o/actions.json');
  });

  it('en échec ; en anglais ; sans réponse', () => {
    expect([endNotice(run('forme', { state: 'failed' }), FORME, 'fr', '/o'), endNotice(run('forme', { state: 'done' }), FORME, 'en', '/o')])
      .toEqual(['VibeCoder : « L-forme » en échec. État : /o/actions.json', 'VibeCoder: “L-forme” finished. State: /o/actions.json']);
  });

  it('une longue réponse : 300 caractères au plus', () => {
    const notice = endNotice(run('forme', { state: 'done', reply: 'x'.repeat(1000) }), FORME, 'fr', '/o');
    expect(notice).toContain(` — ${'x'.repeat(299)}… État`);
  });
});

describe('parseRequest : une demande de l\'orchestrateur', () => {
  it('<id>.start et <id>.stop ; texte vide : aucun argument', () => {
    expect([parseRequest('forme.start', ''), parseRequest('forme.stop', 'n\'importe quoi')])
      .toEqual([{ id: 'forme', op: 'start', args: {} }, { id: 'forme', op: 'stop', args: {} }]);
  });

  it('un autre nom : null', () => {
    expect(['forme', 'forme.restart', '../x.start', 'Forme.start', 'a/b.stop'].map((n) => parseRequest(n, ''))).toEqual([null, null, null, null, null]);
  });

  it('JSON illisible ou pas un objet : null', () => {
    expect(['{', '[]', 'null', '"x"'].map((t) => parseRequest('forme.start', t))).toEqual([null, null, null, null]);
  });

  it('seulement les arguments connus, de leur type ; jamais direct', () => {
    const args = { text: 't', module: 2, commit: 'abc', file: '*', pr: 7, model: 'sonnet', answers: ['a', ''], direct: true, verdict: 'approve' };
    expect(parseRequest('module.start', JSON.stringify(args))?.args)
      .toEqual({ text: 't', module: 2, commit: 'abc', file: '*', pr: 7, model: 'sonnet', answers: ['a', ''] });
    expect(parseRequest('module.start', JSON.stringify({ module: 1.5, pr: '7', answers: [1], text: 3 }))?.args).toEqual({});
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

describe('runModule : le module que génère une course', () => {
  const mod = (path: string, touched: boolean) => ({ path, contract: '', file: null, touched, commits: [] });
  const MODS = [mod('a', true), mod('b', false), mod('c', false)];

  it('module, next : le rang donné, sinon le premier pas touché ; un rang inconnu → null', () => {
    expect([runModule('module', { module: 2 }, MODS), runModule('next', {}, MODS), runModule('module', { module: 9 }, MODS)])
      .toEqual(['c', 'b', null]);
  });

  it('modules → * ; une autre action → null ; tout touché → null', () => {
    expect([runModule('modules', {}, MODS), runModule('forme', { module: 1 }, MODS), runModule('next', {}, [mod('a', true)])])
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
