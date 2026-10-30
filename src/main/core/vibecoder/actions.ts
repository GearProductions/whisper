/** actions — les boutons de VibeCoder, des données (actions.<langue>.json) :
 *  leurs entrées valides, le message qu'une action envoie à l'agent — son
 *  gabarit, chaque variable remplacée par une valeur vérifiée, rien d'autre —
 *  et qui travaille quand elle part (le modèle du skill qu'elle appelle, ou
 *  un autre choisi parmi SKILL_MODELS pour un skill qui fixe son modèle).
 *  Seuls {{text}}, {{answers}} et {{draft}} (écrits par l'utilisateur : le
 *  champ, I-2, ses réponses, ses remarques) sont libres ; un commit, un
 *  module (targetModule, que reprend runs), une PR ne sont pris que dans le dernier relevé, le préfixe des
 *  commandes ({{prefix}}) est donné par l'appelant (absent : vide), et aucune autre
 *  valeur n'a de caractère de contrôle ; une variable inconnue fait refuser
 *  l'action (l'agent lance des commandes avec ces valeurs, I-38). Et les
 *  actions que l'appli fait aussi elle-même (DIRECT_ACTIONS, F-114), dont
 *  celles qu'elle seule fait (DIRECT_ONLY : changer de branche, pull, rebase,
 *  pousser, fetch, les lieux, copier un artefact dans le projet, en ajouter un). {{ref}} : WORKTREE en Créer,
 *  HEAD en Relire (la PR se charge dans le dossier de l'agent). Si une
 *  action lit seulement (reads) ou modifie la branche : la règle des courses
 *  (runs, blockedBy). Un argument qu'aucune variable du gabarit ne lit (hors text), ou un
 *  modèle hors des choix de l'action, ne fait pas refuser l'action : il est
 *  ignoré, et rendu (ignored) pour que l'appelant prévienne l'agent (F-115) ; le texte du champ qu'un
 *  gabarit sans {{text}} laisse tomber, lui, se demande à ignoredText (buildMessage ne le rend pas). L'effort se choisit
 *  comme le modèle, parmi EFFORT_LEVELS : le skill devient <skill>--<modèle>--<effort> (note
 *  0.13.0-fix-and-improvements).
 *  Ne connaît pas : Electron, le disque, l'agent (le message est rendu, pas envoyé),
 *  le calcul du préfixe (core/runner, fait par l'appelant).
 *  Utilisé par : core/vibecoder (journey, runs, defaults), app/controllers (vibecoder, runs), app/settings. */
import { EFFORTS } from 'core/agents';
import type { VibeAction, VibeArgs, VibeLang, VibeModule, VibeStepId, VibeView } from 'shared/bridge';
import { json } from './outputs';

export type ActionDef = {
  id: string;
  flow: 'create' | 'review' | 'both';
  step: VibeStepId | null;
  kind: 'send' | 'prefill';
  needs: VibeAction['needs'];
  label: string;
  hint: string;
  text: string;                // le gabarit
  // Elle lit seulement ("reads": true) ; sinon elle modifie la branche (runs : blockedBy). Toujours posé
  // par parseActions ; facultatif pour les actions écrites à la main (tests) : absent, elle modifie.
  reads?: boolean;
};

// prefix : le préfixe des commandes du projet vu de l'agent (vide s'il tourne déjà dans la box) ;
// facultatif : absent, vide (les appelants qui n'envoient pas {{prefix}} n'ont pas à le donner).
export type MessageContext = { view: VibeView; out: string; lang: VibeLang; prefix?: string };
// La variable qui manque ou ne va pas ; 'variable' : une variable inconnue.
export type MessageError = 'text' | 'module' | 'commit' | 'pr' | 'answers' | 'verdict' | 'draft' | 'files' | 'note' | 'repo' | 'variable' | 'check';

const STEPS = ['note', 'forme', 'invariants', 'modules', 'revue', 'pr', 'commits', 'ecran'];
const VERDICTS = ['approve', 'comment', 'request-changes'];
const VAR = /\{\{([^{}]*)\}\}/g;
const FREE = ['text', 'answers', 'draft'];   // écrits par l'utilisateur : libres
const TEXT_MAX = 20000;
const ANSWERS_MAX = 50;
const ANSWER_MAX = 2000;
// La variable qui lit chaque argument ; model et direct n'en ont pas (le modèle se vérifie à part,
// direct est lu par l'appelant) : jamais ignorés pour ça. text non plus : le texte du champ, qu'un
// gabarit sans {{text}} laisse tomber sans le signaler (invariant actions.test.ts).
const READ_BY: Partial<Record<keyof VibeArgs, string>> = {
  module: 'module', commit: 'commit', file: 'files', check: 'check', pr: 'pr', answers: 'answers', verdict: 'verdict',
};

// Les actions que l'appli fait aussi elle-même, sans agent, au clic de leur bouton « direct » (F-114) ;
// leur gabarit reste la voie « via » l'agent. Ici, Dans un worktree, Retirer le worktree : la recette du
// projet ou git, lancés par l'appli (note 0.12.0-worktrees) ; Mettre de côté, Décharger, Créer ici ou dans
// un worktree (note 0.12.0-creer-relire-meme-dossier) ; Aller sur la branche, Pull, Rebase, Pousser,
// Actualiser, Me demander en relecture (note 0.12.0-gestion-des-branches) ; Copier dans le projet (note
// 0.13.0-panneau-artifacts) ; Ajouter un artefact (note 0.13.0-ameliorer-artefacts : un fichier choisi par
// l'utilisateur dans une boîte système, jamais un chemin venu de la page, I-37).
export const DIRECT_ACTIONS = ['commit', 'publish', 'load-pr', 'base', 'pr-here', 'pr-worktree', 'remove-worktree',
  'stash', 'unload-pr', 'new-here', 'new-worktree', 'switch-branch', 'pull', 'rebase', 'push', 'fetch', 'request-review',
  'copy-artifact', 'add-artifact'];
// Celles que seule l'appli fait : pas de « via » (leur gabarit n'est jamais envoyé). Retirer le worktree :
// l'agent ne retirerait pas son robot ; mettre de côté, changer de branche, ouvrir un worktree pour une
// demande, pull, rebase, pousser, fetch, se demander en relecture, copier un artefact dans le projet,
// ajouter un artefact : l'appli seule, au clic.
export const DIRECT_ONLY = ['remove-worktree', 'stash', 'unload-pr', 'new-here', 'new-worktree',
  'switch-branch', 'pull', 'rebase', 'push', 'fetch', 'request-review', 'copy-artifact', 'add-artifact'];

// Le brouillon de revue en texte : une ligne « - [cible] texte » par remarque.
export const draftText = (draft: VibeView['draft']) => draft.map((c) => `- [${c.target}] ${c.text}`).join('\n');

// Un numéro de PR : un entier positif, sinon null.
export const prNumber = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? v as number : null);

// Les variables d'un gabarit ({{ x }} : x).
export const templateVars = (text: string) => [...text.matchAll(VAR)].map((m) => m[1].trim());

// Le texte du champ est-il perdu ? Un text non vide, et un gabarit sans {{text}} : buildMessage ne le signale pas
// (READ_BY, invariant « un gabarit sans {{text}} »), l'appelant le met dans l'avis « arguments ignorés » (F-115).
export const ignoredText = (def: Pick<ActionDef, 'text'>, args: VibeArgs): boolean =>
  typeof args.text === 'string' && args.text.trim() !== '' && !templateVars(def.text).includes('text');

// Les entrées valides, dans leur ordre ; les autres sont ignorées : un champ
// manquant ou d'un autre type, une étape inconnue, un id déjà vu, un gabarit
// 'prefill' qui a une autre variable que {{quote}}. hint, needs et step
// peuvent manquer ('', 'none', null) ; reads n'est vrai que pour `"reads": true`
// (absent ou autre : elle modifie la branche, le cas sûr pour une action ajoutée).
export function parseActions(json: unknown): ActionDef[] {
  if (!Array.isArray(json)) return [];
  const ids = new Set<string>();
  return json.flatMap((raw): ActionDef[] => {
    if (!raw || typeof raw !== 'object') return [];
    const { id, flow, step = null, kind, needs = 'none', label, hint = '', text, reads } = raw as Record<string, unknown>;
    const valid = typeof id === 'string' && id !== '' && !ids.has(id)
      && (flow === 'create' || flow === 'review' || flow === 'both')
      && (step === null || STEPS.includes(step as string))
      && (kind === 'send' || kind === 'prefill')
      && (needs === 'none' || needs === 'text')
      && typeof label === 'string' && label !== '' && typeof hint === 'string' && typeof text === 'string' && text !== ''
      && (kind === 'send' || templateVars(text).every((v) => v === 'quote'));
    if (!valid) return [];
    ids.add(id);
    return [{ id, flow, step: step as VibeStepId | null, kind, needs: needs as ActionDef['needs'], label, hint, text, reads: reads === true }];
  });
}

const NO_ANSWER: Record<VibeLang, string> = { fr: '(pas de réponse)', en: '(no answer)' };

// Les variables, liste fermée (une autre → 'variable') :
//   {{text}}           args.text trimé ; requis si needs = 'text' ; ≤ 20 000 caractères → sinon 'text'
//   {{out}} {{lang}}   le dossier de sorties de l'agent ; fr ou en
//   {{prefix}}         le préfixe des commandes du projet vu de l'agent, vide permis ; absent : vide (F-112)
//   {{branch}} {{base}}  du relevé → 'repo' sans dépôt
//   {{note}}           le chemin de la note → 'note' sans note
//   {{ref}}            WORKTREE (Créer) ou HEAD (Relire : la PR est chargée dans le dossier) → 'pr' sans PR
//   {{files}}          les tests d'invariants pas encore lus, « chemin@blob » séparés par des espaces ; args.file :
//                      celui de cet id dans view.invariants, lu ou non (relire), '*' : tous → 'files' si aucun
//   {{module}}         args.module (rang dans view.modules), sinon le premier non touché : « chemin — contrat » → 'module'
//   {{commit}}         args.commit, un hash de view.commits ; absent : WORKTREE → sinon 'commit'
//   {{pr}}             args.pr (entier > 0), sinon view.pr.number → sinon 'pr'
//   {{answers}}        args.answers en « 1. …\n2. … » (une vide : « (pas de réponse) ») ; 50 de 2 000 caractères
//                      au plus → 'answers' sinon, ou s'il manque
//   {{verdict}}        approve, comment ou request-changes → sinon 'verdict'
//   {{draft}}          view.draft, une ligne « - [cible] texte » par remarque → 'draft' s'il est vide
//   {{check}}          args.check, le rang d'un élément du checks.json du relevé ; absent : '*' (toutes) → sinon 'check'
//   {{quote}}          ('prefill') ce que la page cite, rempli par elle : jamais ici
// args.model : un autre modèle que le conseillé, parmi ceux que le relevé
// propose pour cette action (VibeAction.models) → /vibecoder:<nom>--<modèle>,
// sa variante (skillVariants) ; sinon il est ignoré.
// Le module que vise une action ({{module}}) : modules[args.module] ; sans rang, le premier pas touché.
export const targetModule = (args: VibeArgs, modules: VibeModule[]): VibeModule | undefined =>
  args.module === undefined ? modules.find((x) => !x.touched) : Number.isInteger(args.module) ? modules[args.module] : undefined;

// Les arguments viennent d'une page : le type de chacun est vérifié ici.
// Le gabarit est lu une fois : une valeur insérée n'est jamais relue comme un gabarit.
// Hors {{text}}, {{answers}} et {{draft}}, une valeur qui contient un caractère de
// contrôle (saut de ligne…) fait refuser l'action → 'variable'.
// ignored : les arguments donnés qu'aucune variable du gabarit ne lit (READ_BY), et model hors des choix de
// l'action ; absent s'il n'y en a pas.
export function buildMessage(def: ActionDef, args: VibeArgs, ctx: MessageContext):
  { text: string; ignored?: (keyof VibeArgs)[] } | { error: MessageError } {
  const { view } = ctx;
  const fail = (error: MessageError) => ({ error });
  const values: Record<string, () => string | { error: MessageError }> = {
    text: () => {
      if (args.text !== undefined && typeof args.text !== 'string') return fail('text');
      const text = (args.text ?? '').trim();
      return text.length > TEXT_MAX || (def.needs === 'text' && !text) ? fail('text') : text;
    },
    out: () => ctx.out,
    lang: () => ctx.lang,
    prefix: () => ctx.prefix ?? '',
    branch: () => view.repo?.branch ?? fail('repo'),
    base: () => view.repo?.base ?? fail('repo'),
    note: () => view.note?.path ?? fail('note'),
    ref: () => (view.flow !== 'review' ? 'WORKTREE' : prNumber(view.pr?.number) ? 'HEAD' : fail('pr')),
    files: () => {
      const files = args.file === undefined ? view.invariants.filter((f) => f.reading === null)
        : args.file === '*' ? view.invariants : view.invariants.filter((f) => f.id === args.file);
      return files.length ? files.map((f) => `${f.path}@${f.blob}`).join(' ') : fail('files');
    },
    module: () => {
      const m = targetModule(args, view.modules);
      return !m ? fail('module') : m.contract ? `${m.path} — ${m.contract}` : m.path;
    },
    commit: () => {
      if (args.commit === undefined) return 'WORKTREE';
      return view.commits.find((c) => c.hash === args.commit)?.hash ?? fail('commit');
    },
    pr: () => {
      const n = args.pr === undefined ? prNumber(view.pr?.number) : prNumber(args.pr);
      return n ? String(n) : fail('pr');
    },
    answers: () => {
      const a = args.answers;
      if (!Array.isArray(a) || !a.length || a.length > ANSWERS_MAX
        || a.some((x) => typeof x !== 'string' || x.length > ANSWER_MAX)) return fail('answers');
      return a.map((x, i) => `${i + 1}. ${x.trim() || NO_ANSWER[ctx.lang]}`).join('\n');
    },
    verdict: () => (VERDICTS.includes(args.verdict as string) ? args.verdict as string : fail('verdict')),
    draft: () => (view.draft.length ? draftText(view.draft) : fail('draft')),
    check: () => {
      if (args.check === undefined) return '*';
      const items = json(view.outputs['checks.json']?.text)?.items;
      return Number.isInteger(args.check) && Array.isArray(items) && args.check >= 0 && args.check < items.length
        ? String(args.check) : fail('check');
    },
  };
  let template = def.text;
  const vars = templateVars(template);
  const ignored = (Object.keys(READ_BY) as (keyof VibeArgs)[])
    .filter((k) => Object.hasOwn(args, k) && args[k] !== undefined && !vars.includes(READ_BY[k]!));
  const shown = view.actions.find((a) => a.id === def.id);
  const skill = /^\/vibecoder:([\w-]+)/.exec(template);
  let model = shown?.model ?? null;
  if (args.model !== undefined) {
    if (!shown || !shown.models.includes(args.model as string) || (args.model !== shown.model && !skill)) ignored.push('model');
    else model = args.model as string;
  }
  let effort: string | null = null;
  if (args.effort !== undefined) {
    if (!skill || !model || !shown?.efforts?.includes(args.effort as string)) ignored.push('effort');
    else effort = args.effort as string;
  }
  if (skill && effort) template = `/vibecoder:${skill[1]}--${model}--${effort}${template.slice(skill[0].length)}`;
  else if (skill && model && model !== shown?.model) template = `/vibecoder:${skill[1]}--${model}${template.slice(skill[0].length)}`;
  let error: MessageError | null = null;
  const text = template.replace(VAR, (_, name: string) => {
    const key = name.trim();
    const value = Object.hasOwn(values, key) ? values[key]() : fail('variable');
    if (typeof value === 'string' && (FREE.includes(key) || !/[\0-\x1f\x7f]/.test(value))) return value;
    if (typeof value === 'string') { error ??= 'variable'; return ''; }
    error ??= value.error;
    return '';
  });
  return error ? { error } : ignored.length ? { text, ignored } : { text };
}

const EFFORT: Record<VibeLang, Record<string, string>> = {
  fr: { medium: 'moyen', high: 'élevé', xhigh: 'très élevé', max: 'max' },
  en: { medium: 'medium', high: 'high', xhigh: 'extra high', max: 'max' },
};

// Les modèles qu'on peut choisir pour un skill qui fixe le sien (jamais Fable, I-36).
export const SKILL_MODELS = ['haiku', 'sonnet', 'opus'];

// Les efforts qu'on peut choisir pour un skill qui fixe son modèle : ceux du menu de l'agent, sans « par défaut ».
export const EFFORT_LEVELS = EFFORTS.map(([value]) => value).filter(Boolean);

// Un champ de l'en-tête (frontmatter) d'un skill, sans ses guillemets ; '' s'il manque.
export function headField(skillMd: string | null, key: string): string {
  const head = (skillMd && /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd)?.[1]) || '';
  return new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(head)?.[1].replace(/^(['"])(.*)\1$/, '$2') || '';
}

// Le modèle que fixe un skill (l'en-tête, context: fork ou non) s'il est l'un
// de SKILL_MODELS : on peut lui en choisir un autre ; sinon null (l'agent).
export function skillModel(skillMd: string | null): string | null {
  const model = headField(skillMd, 'model');
  return SKILL_MODELS.includes(model) ? model : null;
}

// Qui travaille pour un skill, d'après son en-tête (frontmatter) : son modèle,
// et son effort s'il dépasse « low » (« opus · élevé », « haiku ») ; sans
// modèle (ou sans skill) : « agent », le modèle de l'agent.
export function whoOf(skillMd: string | null, lang: VibeLang): string {
  const model = headField(skillMd, 'model');
  if (!model || model === 'inherit') return 'agent';
  const effort = EFFORT[lang][headField(skillMd, 'effort')];
  return effort ? `${model} · ${effort}` : model;
}
