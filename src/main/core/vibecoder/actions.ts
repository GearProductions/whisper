/** actions — les boutons de VibeCoder, des données (actions.<langue>.json) :
 *  leurs entrées valides, le message qu'une action envoie à l'agent — son
 *  gabarit, chaque variable remplacée par une valeur vérifiée, rien d'autre —
 *  et qui travaille quand elle part (le modèle du skill qu'elle appelle, ou
 *  un autre choisi parmi SKILL_MODELS pour un skill en sous-contexte).
 *  Seuls {{text}}, {{answers}} et {{draft}} (écrits par l'utilisateur : le
 *  champ, I-2, ses réponses, ses remarques) sont libres ; un commit, un
 *  module (targetModule, que reprend runs), une PR ne sont pris que dans le dernier relevé, le préfixe des
 *  commandes ({{prefix}}) est donné par l'appelant (absent : vide), et aucune autre
 *  valeur n'a de caractère de contrôle ; une variable inconnue fait refuser
 *  l'action (l'agent lance des commandes avec ces valeurs, I-38). Et les
 *  actions que l'appli fait aussi elle-même (DIRECT_ACTIONS, F-114). Si une
 *  action lit seulement (reads) ou modifie la branche : la règle des courses
 *  (runs, blockedBy).
 *  Ne connaît pas : Electron, le disque, l'agent (le message est rendu, pas envoyé),
 *  le calcul du préfixe (core/runner, fait par l'appelant).
 *  Utilisé par : core/vibecoder (journey, runs, defaults), app/controllers/vibecoder, app/settings. */
import type { VibeAction, VibeArgs, VibeLang, VibeModule, VibeStepId, VibeView } from 'shared/bridge';

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
export type MessageError = 'text' | 'module' | 'commit' | 'pr' | 'answers' | 'verdict' | 'draft' | 'files' | 'note' | 'repo' | 'variable' | 'model';

const STEPS = ['note', 'forme', 'invariants', 'modules', 'revue', 'pr', 'commits', 'ecran'];
const VERDICTS = ['approve', 'comment', 'request-changes'];
const VAR = /\{\{([^{}]*)\}\}/g;
const FREE = ['text', 'answers', 'draft'];   // écrits par l'utilisateur : libres
const TEXT_MAX = 20000;
const ANSWERS_MAX = 50;
const ANSWER_MAX = 2000;

// Les actions que l'appli fait aussi elle-même, sans agent, au clic de leur bouton « direct » (F-114) ;
// leur gabarit reste la voie « via » l'agent.
export const DIRECT_ACTIONS = ['commit', 'publish', 'load-pr', 'base'];

// Le brouillon de revue en texte : une ligne « - [cible] texte » par remarque.
export const draftText = (draft: VibeView['draft']) => draft.map((c) => `- [${c.target}] ${c.text}`).join('\n');

// Un numéro de PR : un entier positif, sinon null.
export const prNumber = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? v as number : null);

// Les variables d'un gabarit ({{ x }} : x).
export const templateVars = (text: string) => [...text.matchAll(VAR)].map((m) => m[1].trim());

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
//   {{ref}}            WORKTREE (Créer) ou refs/vibecoder/pr/<n> (Relire) → 'pr' sans PR
//   {{files}}          les tests d'invariants pas encore lus, « chemin@blob » séparés par des espaces ; args.file :
//                      celui de cet id dans view.invariants, lu ou non (relire), '*' : tous → 'files' si aucun
//   {{module}}         args.module (rang dans view.modules), sinon le premier non touché : « chemin — contrat » → 'module'
//   {{commit}}         args.commit, un hash de view.commits ; absent : WORKTREE → sinon 'commit'
//   {{pr}}             args.pr (entier > 0), sinon view.pr.number → sinon 'pr'
//   {{answers}}        args.answers en « 1. …\n2. … » (une vide : « (pas de réponse) ») ; 50 de 2 000 caractères
//                      au plus → 'answers' sinon, ou s'il manque
//   {{verdict}}        approve, comment ou request-changes → sinon 'verdict'
//   {{draft}}          view.draft, une ligne « - [cible] texte » par remarque → 'draft' s'il est vide
//   {{quote}}          ('prefill') ce que la page cite, rempli par elle : jamais ici
// args.model : un autre modèle que le conseillé, parmi ceux que le relevé
// propose pour cette action (VibeAction.models) → /vibecoder:<nom>--<modèle>,
// sa variante (skillVariants) ; sinon 'model'.
// Le module que vise une action ({{module}}) : modules[args.module] ; sans rang, le premier pas touché.
export const targetModule = (args: VibeArgs, modules: VibeModule[]): VibeModule | undefined =>
  args.module === undefined ? modules.find((x) => !x.touched) : Number.isInteger(args.module) ? modules[args.module] : undefined;

// Les arguments viennent d'une page : le type de chacun est vérifié ici.
// Le gabarit est lu une fois : une valeur insérée n'est jamais relue comme un gabarit.
// Hors {{text}}, {{answers}} et {{draft}}, une valeur qui contient un caractère de
// contrôle (saut de ligne…) fait refuser l'action → 'variable'.
export function buildMessage(def: ActionDef, args: VibeArgs, ctx: MessageContext): { text: string } | { error: MessageError } {
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
    ref: () => {
      if (view.flow !== 'review') return 'WORKTREE';
      const n = prNumber(view.pr?.number);
      return n ? `refs/vibecoder/pr/${n}` : fail('pr');
    },
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
  };
  let template = def.text;
  if (args.model !== undefined) {
    const shown = view.actions.find((a) => a.id === def.id);
    if (!shown || !shown.models.includes(args.model as string)) return fail('model');
    if (args.model !== shown.model) {
      const skill = /^\/vibecoder:([\w-]+)/.exec(template);
      if (!skill) return fail('model');
      template = `/vibecoder:${skill[1]}--${args.model}${template.slice(skill[0].length)}`;
    }
  }
  let error: MessageError | null = null;
  const text = template.replace(VAR, (_, name: string) => {
    const key = name.trim();
    const value = Object.hasOwn(values, key) ? values[key]() : fail('variable');
    if (typeof value === 'string' && (FREE.includes(key) || !/[\0-\x1f\x7f]/.test(value))) return value;
    if (typeof value === 'string') { error ??= 'variable'; return ''; }
    error ??= value.error;
    return '';
  });
  return error ? { error } : { text };
}

const EFFORT: Record<VibeLang, Record<string, string>> = {
  fr: { medium: 'moyen', high: 'élevé', xhigh: 'très élevé', max: 'max' },
  en: { medium: 'medium', high: 'high', xhigh: 'extra high', max: 'max' },
};

// Les modèles qu'on peut choisir pour un skill en sous-contexte (jamais Fable, I-36).
export const SKILL_MODELS = ['haiku', 'sonnet', 'opus'];

// Un champ de l'en-tête (frontmatter) d'un skill, sans ses guillemets ; '' s'il manque.
export function headField(skillMd: string | null, key: string): string {
  const head = (skillMd && /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd)?.[1]) || '';
  return new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(head)?.[1].replace(/^(['"])(.*)\1$/, '$2') || '';
}

// Le modèle d'un skill en sous-contexte (context: fork) s'il est l'un de
// SKILL_MODELS : on peut lui en choisir un autre ; sinon null.
export function forkedModel(skillMd: string | null): string | null {
  const model = headField(skillMd, 'model');
  return headField(skillMd, 'context') === 'fork' && SKILL_MODELS.includes(model) ? model : null;
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
