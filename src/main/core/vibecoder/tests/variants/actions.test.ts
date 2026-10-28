import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { buildMessage, DIRECT_ACTIONS, DIRECT_ONLY, forkedModel, parseActions, SKILL_MODELS, whoOf, type ActionDef, type MessageContext } from 'core/vibecoder';

const C1 = '9fceb02d0ae598e95dc970b74767f19372d61af8';
const BLOB = '3b18e512dba79e4c8300dd08aeb37f8e728b8dad';
// Un relevé de Créer : une note, deux modules (le premier déjà touché), un test pas encore lu, un commit.
const view: VibeView = {
  agentId: 'a1', lang: 'fr', flow: 'create', autonomy: 'guide',
  agent: { model: 'opus', effort: 'high', mode: 'default' },
  repo: { branch: 'feat/G2-1-x', base: 'origin/main', changed: 3 }, error: null, steps: [],
  note: { id: 'n', path: 'docs/tickets/feat/G2-1-x.md', text: '# x', before: null, filled: true, mustNot: [], mark: null, formeMark: null },
  questions: [],
  modules: [
    { path: 'src/core/a.ts', contract: 'a()', file: null, touched: true, commits: [C1] },
    { path: 'src/core/b.ts', contract: 'b() · ne connaît pas : a', file: null, touched: false, commits: [] },
  ],
  invariants: [
    { id: 't0', path: 'src/core/tests/invariants/a.test.ts', blob: BLOB, cases: ['x'], lines: [1], source: '', reading: null, marks: {} },
    { id: 't1', path: 'src/core/tests/invariants/b.test.ts', blob: 'b'.repeat(40), cases: ['y'], lines: [1], source: '', reading: [], marks: {} },
  ],
  variants: [], commits: [{ hash: C1, subject: 'Note, forme, invariants', fixup: false, files: [] }],
  outputs: {}, checklist: [], actions: [], skills: [], pr: null, prs: null,
  draft: [{ id: 1, target: 'note', text: 'Trop vague' }, { id: 2, target: 'commit 9fceb02', text: 'Hors périmètre' }], time: 0,
};
const ctx: MessageContext = { view, out: '/u/vibecoder-out/a1', lang: 'fr', prefix: '' };
const review: MessageContext = { ...ctx, view: { ...view, flow: 'review', pr: { number: 12, title: 't', url: '', author: '', base: 'main', head: 'x', body: '', state: 'OPEN' } } };
const action = (text: string, needs: ActionDef['needs'] = 'none'): ActionDef => (
  { id: 'essai', flow: 'both', step: null, kind: 'send', needs, label: 'Essai', hint: '', text });
const build = (text: string, args = {}, c = ctx, needs: ActionDef['needs'] = 'none') => buildMessage(action(text, needs), args, c);

describe('buildMessage : chaque variable', () => {
  it('{{text}} : le champ, sans ses blancs autour', () => {
    expect(build('{{text}}', { text: '  une demande \n' })).toEqual({ text: 'une demande' });
  });

  it('{{out}} et {{lang}} : le dossier de sorties et la langue', () => {
    expect(build('{{out}} {{lang}}')).toEqual({ text: '/u/vibecoder-out/a1 fr' });
  });

  it('{{branch}} et {{base}} : du relevé', () => {
    expect(build('{{branch}}...{{base}}')).toEqual({ text: 'feat/G2-1-x...origin/main' });
  });

  it('{{note}} : le chemin de la note', () => {
    expect(build('{{note}}')).toEqual({ text: 'docs/tickets/feat/G2-1-x.md' });
  });

  it('{{ref}} en Créer : WORKTREE', () => {
    expect(build('{{ref}}')).toEqual({ text: 'WORKTREE' });
  });

  it('{{ref}} en Relire : HEAD, la PR chargée dans le dossier', () => {
    expect(build('{{ref}}', {}, review)).toEqual({ text: 'HEAD' });
  });

  it('{{files}} : les tests d\'invariants pas encore lus, chemin@blob', () => {
    expect(build('{{files}}')).toEqual({ text: `src/core/tests/invariants/a.test.ts@${BLOB}` });
  });

  it('{{module}} sans rang : le premier module non touché, avec son contrat', () => {
    expect(build('{{module}}')).toEqual({ text: 'src/core/b.ts — b() · ne connaît pas : a' });
  });

  it('{{module}} avec un rang : ce module du relevé', () => {
    expect(build('{{module}}', { module: 0 })).toEqual({ text: 'src/core/a.ts — a()' });
  });

  it('{{commit}} sans commit : WORKTREE', () => {
    expect(build('{{commit}}')).toEqual({ text: 'WORKTREE' });
  });

  it('{{commit}} : un commit du relevé', () => {
    expect(build('{{commit}}', { commit: C1 })).toEqual({ text: C1 });
  });

  it('{{pr}} : le numéro donné', () => {
    expect(build('{{pr}}', { pr: 7 })).toEqual({ text: '7' });
  });

  it('{{pr}} sans numéro : la PR du relevé', () => {
    expect(build('{{pr}}', {}, review)).toEqual({ text: '12' });
  });

  it('{{answers}} : une réponse par ligne, numérotée ; une vide dit qu\'il n\'y en a pas', () => {
    expect(build('{{answers}}', { answers: ['Une', ' '] })).toEqual({ text: '1. Une\n2. (pas de réponse)' });
  });

  it('{{answers}} en anglais', () => {
    expect(build('{{answers}}', { answers: [''] }, { ...ctx, lang: 'en' })).toEqual({ text: '1. (no answer)' });
  });

  it('{{verdict}} : approve, comment ou request-changes', () => {
    expect(build('{{verdict}}', { verdict: 'request-changes' })).toEqual({ text: 'request-changes' });
  });

  it('{{draft}} : une ligne « - [cible] texte » par remarque', () => {
    expect(build('{{draft}}')).toEqual({ text: '- [note] Trop vague\n- [commit 9fceb02] Hors périmètre' });
  });

  it('{{prefix}} : le préfixe donné, en fin de message ; vide permis', () => {
    const verifier = '/vibecoder:verifier {{lang}} {{out}} {{prefix}}';
    expect(build(verifier, {}, { ...ctx, prefix: 'distrobox enter dev --' })).toEqual({ text: `/vibecoder:verifier fr ${ctx.out} distrobox enter dev --` });
    expect(build(verifier)).toEqual({ text: `/vibecoder:verifier fr ${ctx.out} ` });
  });

  it('{{prefix}} sans préfixe dans le contexte : vide', () => {
    const { prefix: _, ...sans } = ctx;
    expect(build('[{{prefix}}]', {}, sans)).toEqual({ text: '[]' });
  });

  it('{{prefix}} avec un caractère de contrôle : variable', () => {
    expect(build('{{prefix}}', {}, { ...ctx, prefix: 'distrobox\nrm -rf ~' })).toEqual({ error: 'variable' });
  });

  it('{{ lang }} avec des blancs : la même variable', () => {
    expect(build('{{ lang }}')).toEqual({ text: 'fr' });
  });
});

describe('buildMessage : ce qui manque refuse l\'action', () => {
  it('needs text et champ vide : text', () => {
    expect(build('{{text}}', { text: '   ' }, ctx, 'text')).toEqual({ error: 'text' });
  });

  it('un champ de plus de 20 000 caractères : text', () => {
    expect(build('{{text}}', { text: 'x'.repeat(20001) })).toEqual({ error: 'text' });
  });

  it('{{branch}} sans dépôt : repo', () => {
    expect(build('{{branch}}', {}, { ...ctx, view: { ...view, repo: null } })).toEqual({ error: 'repo' });
  });

  it('{{note}} sans note : note', () => {
    expect(build('{{note}}', {}, { ...ctx, view: { ...view, note: null } })).toEqual({ error: 'note' });
  });

  it('{{files}} quand tout est lu : files', () => {
    expect(build('{{files}}', {}, { ...ctx, view: { ...view, invariants: view.invariants.slice(1) } })).toEqual({ error: 'files' });
  });

  it('{{module}} quand tous sont touchés : module', () => {
    expect(build('{{module}}', {}, { ...ctx, view: { ...view, modules: view.modules.slice(0, 1) } })).toEqual({ error: 'module' });
  });

  it('{{ref}} en Relire sans PR : pr', () => {
    expect(build('{{ref}}', {}, { ...review, view: { ...review.view, pr: null } })).toEqual({ error: 'pr' });
  });

  it('{{pr}} ni donné ni dans le relevé : pr', () => {
    expect(build('{{pr}}')).toEqual({ error: 'pr' });
  });

  it('{{answers}} absent : answers', () => {
    expect(build('{{answers}}')).toEqual({ error: 'answers' });
  });

  it('{{answers}} : plus de 50 réponses, ou une de plus de 2 000 caractères : answers', () => {
    expect([build('{{answers}}', { answers: Array(51).fill('a') }), build('{{answers}}', { answers: ['x'.repeat(2001)] })])
      .toEqual([{ error: 'answers' }, { error: 'answers' }]);
  });

  it('{{verdict}} inconnu : verdict', () => {
    expect(build('{{verdict}}', { verdict: 'merge' as never })).toEqual({ error: 'verdict' });
  });

  it('{{draft}} vide : draft', () => {
    expect(build('{{draft}}', {}, { ...ctx, view: { ...view, draft: [] } })).toEqual({ error: 'draft' });
  });

  it('{{quote}} dans un message envoyé : variable', () => {
    expect(build('À propos de « {{quote}} »')).toEqual({ error: 'variable' });
  });
});

// Une entrée d'actions.<langue>.json valide, à retoucher.
const entry = (over: Record<string, unknown> = {}) => (
  { id: 'note', flow: 'create', step: 'note', kind: 'send', needs: 'text', label: 'Rédiger la note', hint: 'h', text: '/vibecoder:note {{text}}', reads: false, ...over });

describe('parseActions : seulement les entrées valides', () => {
  it('une entrée valide est gardée telle quelle', () => {
    expect(parseActions([entry()])).toEqual([entry()]);
  });

  it('pas un tableau : aucune action', () => {
    expect(parseActions({ actions: [entry()] })).toEqual([]);
  });

  it('une étape inconnue : écartée', () => {
    expect(parseActions([entry({ step: 'deploy' })])).toEqual([]);
  });

  it('un flow inconnu : écarté', () => {
    expect(parseActions([entry({ flow: 'all' })])).toEqual([]);
  });

  it('un kind inconnu : écarté', () => {
    expect(parseActions([entry({ kind: 'run' })])).toEqual([]);
  });

  it('un needs inconnu : écarté', () => {
    expect(parseActions([entry({ needs: 'pr' })])).toEqual([]);
  });

  it('sans libellé : écartée', () => {
    expect(parseActions([entry({ label: '' })])).toEqual([]);
  });

  it('sans gabarit : écartée', () => {
    expect(parseActions([entry({ text: 42 })])).toEqual([]);
  });

  it('pas un objet : écartée', () => {
    expect(parseActions(['note', null])).toEqual([]);
  });

  it('un id déjà vu : la seconde est écartée', () => {
    expect(parseActions([entry(), entry({ label: 'Autre' })]).map((a) => a.label)).toEqual(['Rédiger la note']);
  });

  it('un « prefill » avec une autre variable que {{quote}} : écarté', () => {
    expect(parseActions([entry({ kind: 'prefill', text: 'Voir {{quote}} sur {{branch}}' })])).toEqual([]);
  });

  it('un « prefill » avec {{quote}} : gardé', () => {
    expect(parseActions([entry({ kind: 'prefill', needs: 'none', text: 'À propos de « {{quote}} » : ' })])).toHaveLength(1);
  });

  it('hint, needs et step absents : leurs valeurs par défaut', () => {
    const { hint: _h, needs: _n, step: _s, ...rest } = entry();
    expect(parseActions([rest])[0]).toEqual({ ...rest, hint: '', needs: 'none', step: null });
  });

  it('un champ en trop n\'est pas repris', () => {
    expect(parseActions([entry({ model: 'fable' })])[0]).not.toHaveProperty('model');
  });

  it('"reads": true : elle lit seulement ; absent ou autre chose que true : elle modifie la branche', () => {
    const { reads: _r, ...bare } = entry();
    expect([entry({ reads: true }), bare, entry({ id: 'x', reads: 'yes' })].flatMap((e) => parseActions([e])).map((a) => a.reads))
      .toEqual([true, false, false]);
  });

  it('les entrées valides gardent leur ordre', () => {
    expect(parseActions([entry({ id: 'b' }), entry({ id: 'x', step: '?' }), entry({ id: 'a' })]).map((a) => a.id)).toEqual(['b', 'a']);
  });
});

describe('parseActions sur les actions livrées', () => {
  const ROOT = path.resolve(__dirname, '../../../../../../resources/vibecoder');
  const shipped = (lang: string) => JSON.parse(fs.readFileSync(path.join(ROOT, `actions.${lang}.json`), 'utf8'));

  it('actions.fr.json : toutes valides', () => {
    expect(parseActions(shipped('fr'))).toHaveLength(shipped('fr').length);
  });

  it('actions.en.json : toutes valides', () => {
    expect(parseActions(shipped('en'))).toHaveLength(shipped('en').length);
  });

  it('les lectures lisent, les autres modifient la branche', () => {
    const reads = (lang: string) => Object.fromEntries(parseActions(shipped(lang)).map((a) => [a.id, a.reads]));
    for (const lang of ['fr', 'en']) {
      expect([reads(lang).ponytail, reads(lang)['read-invariants'], reads(lang).forme, reads(lang).invariants])
        .toEqual([true, true, false, false]);
    }
  });

  it('Appliquer la revue : une remarque citée (Appliquer) ou aucune (Tout appliquer)', () => {
    const apply = parseActions(shipped('fr')).find((a) => a.id === 'apply')!;
    const one = buildMessage(apply, { text: 'src/a.ts:L3 — dead: x() — personne ne l\'appelle' }, ctx);
    expect('text' in one && one.text.endsWith(' : src/a.ts:L3 — dead: x() — personne ne l\'appelle')).toBe(true);
    const all = buildMessage(apply, {}, ctx);
    expect('text' in all && all.text.endsWith('(vide : toutes) : ')).toBe(true);
  });
});

const skill = (head: string) => `---\nname: x\ndescription: "y"\n${head}\n---\n\n# x\n`;

describe('whoOf : qui travaille, d\'après l\'en-tête du skill', () => {
  it('haiku, effort faible : le modèle seul', () => {
    expect(whoOf(skill('context: fork\nmodel: haiku\neffort: low'), 'fr')).toBe('haiku');
  });

  it('sonnet, effort moyen', () => {
    expect(whoOf(skill('model: sonnet\neffort: medium'), 'fr')).toBe('sonnet · moyen');
  });

  it('opus, effort élevé', () => {
    expect(whoOf(skill('model: opus\neffort: high'), 'fr')).toBe('opus · élevé');
  });

  it('opus, effort élevé, en anglais', () => {
    expect(whoOf(skill('model: opus\neffort: high'), 'en')).toBe('opus · high');
  });

  it('effort max', () => {
    expect(whoOf(skill('model: opus\neffort: max'), 'fr')).toBe('opus · max');
  });

  it('un modèle entre guillemets', () => {
    expect(whoOf(skill('model: "sonnet"'), 'fr')).toBe('sonnet');
  });

  it('sans modèle : l\'agent', () => {
    expect(whoOf(skill('disable-model-invocation: true'), 'fr')).toBe('agent');
  });

  it('sans skill : l\'agent', () => {
    expect(whoOf(null, 'en')).toBe('agent');
  });

  it('un model: hors de l\'en-tête ne compte pas', () => {
    expect(whoOf('# x\n\nmodel: opus\n', 'fr')).toBe('agent');
  });
});

describe('forkedModel : un skill en sous-contexte, dont on peut changer le modèle', () => {
  it('sous-contexte sur opus : opus', () => {
    expect(forkedModel(skill('context: fork\nmodel: opus\neffort: high'))).toBe('opus');
  });

  it('dans la conversation (sans context: fork) : null', () => {
    expect(forkedModel(skill('model: opus'))).toBeNull();
  });

  it('sous-contexte sans modèle, ou sur un autre (fable, inherit) : null', () => {
    expect([skill('context: fork'), skill('context: fork\nmodel: fable'), skill('context: fork\nmodel: inherit')].map(forkedModel))
      .toEqual([null, null, null]);
  });
});

describe('buildMessage : un autre modèle que le conseillé', () => {
  const shown = (models: string[], model: string | null) => ({
    id: 'essai', step: null, label: 'Essai', hint: '', who: 'opus', models, model, kind: 'send' as const, needs: 'none' as const,
    usesText: false, primary: false, disabled: null, hidden: false, running: false,
  });
  const withAction = (models = SKILL_MODELS, model: string | null = 'opus') => ({ ...ctx, view: { ...view, actions: [shown(models, model)] } });
  const RELIRE = '/vibecoder:relire {{lang}} {{out}} {{commit}}';

  it('un autre modèle proposé : la variante du skill', () => {
    expect(build(RELIRE, { model: 'haiku' }, withAction())).toEqual({ text: '/vibecoder:relire--haiku fr /u/vibecoder-out/a1 WORKTREE' });
  });

  it('le modèle conseillé : le skill tel quel', () => {
    expect(build(RELIRE, { model: 'opus' }, withAction())).toEqual({ text: '/vibecoder:relire fr /u/vibecoder-out/a1 WORKTREE' });
  });

  it('un modèle hors de ceux proposés (fable) : ignoré, le skill tel quel', () => {
    expect(build(RELIRE, { model: 'fable' }, withAction())).toEqual({ text: '/vibecoder:relire fr /u/vibecoder-out/a1 WORKTREE', ignored: ['model'] });
  });

  it('une action sans choix de modèle (dans la conversation) : ignoré', () => {
    expect(build(RELIRE, { model: 'haiku' }, withAction([], null))).toEqual({ text: '/vibecoder:relire fr /u/vibecoder-out/a1 WORKTREE', ignored: ['model'] });
  });

  it('un modèle qui n\'est pas un texte : ignoré', () => {
    expect(build(RELIRE, { model: ['haiku'] as never }, withAction())).toEqual({ text: '/vibecoder:relire fr /u/vibecoder-out/a1 WORKTREE', ignored: ['model'] });
  });

  it('un autre modèle proposé, gabarit sans skill : ignoré', () => {
    expect(build('{{lang}}', { model: 'haiku' }, withAction())).toEqual({ text: 'fr', ignored: ['model'] });
  });
});

describe('buildMessage : un argument qu\'aucune variable ne lit est ignoré, l\'action part', () => {
  it('modules restants demandés avec model et module : les deux ignorés (F-115)', () => {
    expect(build('/vibecoder:modules {{lang}} {{out}}', { module: 0, model: 'opus' }))
      .toEqual({ text: '/vibecoder:modules fr /u/vibecoder-out/a1', ignored: ['module', 'model'] });
  });

  it('commit, file, check, pr, answers, verdict sans leur variable : ignorés, même d\'un autre type', () => {
    const args = { commit: 'x', file: 't9', check: -1, pr: 0, answers: [], verdict: 'merge' as never };
    expect(build('{{lang}}', args)).toEqual({ text: 'fr', ignored: ['commit', 'file', 'check', 'pr', 'answers', 'verdict'] });
  });

  it('text, direct, un argument absent : jamais signalés', () => {
    expect(build('{{lang}}', { text: 'champ', direct: true, module: undefined })).toEqual({ text: 'fr' });
  });

  it('une variable qui le lit refuse encore une valeur fausse', () => {
    expect(build('{{commit}}', { commit: 'x', pr: 3 })).toEqual({ error: 'commit' });
  });
});

describe('buildMessage : {{check}}', () => {
  const checks = (items: unknown) => ({ ...ctx, view: { ...view, outputs: { 'checks.json': { text: JSON.stringify({ items }), time: 1 } } } });
  const two = checks([{ name: 'invariants', ok: false }, { name: 'tests', ok: true }]);

  it('absent : toutes', () => {
    expect(build('{{check}}', {}, two)).toEqual({ text: '*' });
  });

  it('le rang d\'un élément de checks.json', () => {
    expect(build('{{check}}', { check: 1 }, two)).toEqual({ text: '1' });
  });

  it('hors de la liste, négatif, pas entier, pas un nombre : check', () => {
    expect([2, -1, 0.5, '0' as never].map((check) => build('{{check}}', { check }, two))).toEqual(Array(4).fill({ error: 'check' }));
  });

  it('sans checks.json, ou illisible : check', () => {
    const bad = { ...ctx, view: { ...view, outputs: { 'checks.json': { text: '{', time: 1 } } } };
    expect([build('{{check}}', { check: 0 }), build('{{check}}', { check: 0 }, bad), build('{{check}}', { check: 0 }, checks('x'))])
      .toEqual(Array(3).fill({ error: 'check' }));
  });
});

describe('les actions directes', () => {
  it('stash, unload-pr, new-here, new-worktree : directes, et seulement par l\'appli', () => {
    const ids = ['stash', 'unload-pr', 'new-here', 'new-worktree'];
    expect(ids.every((id) => DIRECT_ACTIONS.includes(id) && DIRECT_ONLY.includes(id))).toBe(true);
  });

  it('switch-branch, pull, rebase, push, fetch, request-review : directes, et seulement par l\'appli', () => {
    const ids = ['switch-branch', 'pull', 'rebase', 'push', 'fetch', 'request-review'];
    expect(ids.every((id) => DIRECT_ACTIONS.includes(id) && DIRECT_ONLY.includes(id))).toBe(true);
  });

  it('chaque action seulement directe est une action directe', () => {
    expect(DIRECT_ONLY.every((id) => DIRECT_ACTIONS.includes(id))).toBe(true);
  });
});
