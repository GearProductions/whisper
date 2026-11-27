/** github — lire GitHub par `gh`, sans jamais rien modifier, sans agent ni
 *  modèle : `gh` lancé sans shell (execFile, I-27), derrière le préfixe donné
 *  (la box où gh est installé : core/runner, commandPrefix), au dossier du
 *  dépôt, 15 s au plus, null s'il manque ou échoue (I-29). Une liste fermée de
 *  sous-commandes en lecture (GH_READ : `pr view`, `pr list`), plus une
 *  commande exacte (GH_LOGIN : `api user --jq .login`) ; les autres
 *  arguments sont fixes, sauf une branche lue par git (okRef, après `--`) et
 *  un numéro de PR (un entier positif). La PR d'une branche (prForBranch) et
 *  l'état des checks de son commit de tête (ci : un champ de plus à son
 *  `gh pr view`, statusCheckRollup, lu par ciOf ; note 0.16.0-ligne-apres-pr) et la revue qu'elle a reçue (reviews : trois
 *  champs de plus au même `gh pr view`, reviewDecision, reviews, comments, lus par reviewsOf),
 *  les PR ouvertes du dépôt en trois listes (openPrs : les miennes, à relire,
 *  toutes), l'état d'une PR suivie (prState, inchangé : `--json state` seul),
 *  l'identifiant de l'utilisateur (login), l'auteur et les assignés d'une PR
 *  (prPeople).
 *  ciOf(rollup: unknown): VibeCi — statusCheckRollup → 'ko' si un check est en
 *  échec (ses noms dans failed), sinon 'pending' si un est en cours ou s'il n'y
 *  en a aucun (juste après un push, un dépôt sans CI), sinon 'ok' ; illisible :
 *  'pending' (jamais vert).
 *  Ne connaît pas : VibeCoder, Electron, la configuration, ci.md.
 *  Utilisé par : app/controllers/vibecoder. */
import { execFile } from 'node:child_process';
import type { VibeCi, VibeReview, VibeReviews } from 'shared/bridge';
import { okRef } from 'technicals/git';

// Les seules sous-commandes lancées : en lecture.
export const GH_READ = [['pr', 'view'], ['pr', 'list']] as const;
// La seule commande gh api : exacte (lire son identifiant, login).
export const GH_LOGIN = ['api', 'user', '--jq', '.login'] as const;

// Lance gh (args[0..1] : la sous-commande) → sa sortie, ou null.
export type GhRun = (args: string[]) => Promise<string | null>;

// La fiche d'une PR, comme pr.json et pr-<n>.json ; ci : les checks de sa tête, posés par prForBranch seul (jamais
// écrits dans une fiche : prCardText ne les garde pas).
export type GhPr = { number: number; title: string; url: string; state: string; base: string; head: string; ci?: VibeCi; reviews?: VibeReviews };

// statusCheckRollup (gh pr view) → l'état des checks : 'ko' un en échec, 'pending' un en cours ou aucun, sinon 'ok'.
// CheckRun : status COMPLETED + conclusion (vide tant qu'il tourne) ; StatusContext : state. Seules ces valeurs
// sont des passés ; CI_FAILED sont des échecs (ACTION_REQUIRED compris, comme gh pr checks) ; tout le reste (en cours,
// entrée illisible) compte comme en cours, jamais vert. Un check relancé garde son ancien CheckRun à côté du nouveau :
// seul le plus récent (startedAt) par workflowName + name compte.
const CI_PASSED = ['SUCCESS', 'NEUTRAL', 'SKIPPED'];
const CI_FAILED = ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE', 'ERROR', 'ACTION_REQUIRED'];
export function ciOf(rollup: unknown): VibeCi {
  const failed: string[] = [];
  let pending = !Array.isArray(rollup) || rollup.length === 0;
  const latest = new Map<string, Record<string, unknown>>();
  (Array.isArray(rollup) ? rollup : []).forEach((c, i) => {
    const e = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const name = e.name ?? e.context;
    const key = typeof name === 'string' && name ? `${e.workflowName ?? ''}\u0000${name}` : `#${i}`;   // sans nom : jamais écarté
    const old = latest.get(key);
    if (!old || String(e.startedAt ?? '') >= String(old.startedAt ?? '')) latest.set(key, e);
  });
  for (const e of latest.values()) {
    const verdict = e.__typename === 'CheckRun' ? (e.status === 'COMPLETED' ? e.conclusion : 'PENDING')
      : e.__typename === 'StatusContext' ? e.state : 'PENDING';
    if (CI_FAILED.includes(verdict as string)) failed.push(String(e.name ?? e.context ?? ''));
    else if (!CI_PASSED.includes(verdict as string)) pending = true;
  }
  return { state: failed.length ? 'ko' : pending ? 'pending' : 'ok', failed };
}

// reviewDecision, reviews et comments (gh pr view) → la revue reçue : la décision connue ou null ; les revues (sauf PENDING,
// un brouillon) et les commentaires, du plus ancien au plus récent, les 50 plus récents, chaque texte borné à 4 000
// caractères ; un login hors d'okLogin : '' ; une entrée sans forme : écartée. Rien n'est lancé.
const DECISIONS = ['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED'] as const;
const REVIEWED = ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED'] as const;
export function reviewsOf(p: unknown): VibeReviews {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const list = (l: unknown) => (Array.isArray(l) ? l : []).map((x) => (x && typeof x === 'object' ? x : null) as Record<string, unknown> | null).filter((x) => !!x);
  const login = (a: unknown) => { const l = (a as { login?: unknown } | null)?.login; return okLogin(l) ? l : ''; };
  const entry = (e: Record<string, unknown>, state: VibeReview['state'], at: unknown): VibeReview =>
    ({ author: login(e.author), state, body: String(e.body ?? '').slice(0, 4000), at: String(at ?? '') });
  const items = [
    ...list(o.reviews).filter((r) => (REVIEWED as readonly unknown[]).includes(r.state)).map((r) => entry(r, r.state as VibeReview['state'], r.submittedAt)),
    ...list(o.comments).map((c) => entry(c, 'COMMENT', c.createdAt)),
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(-50);
  const decision = (DECISIONS as readonly unknown[]).includes(o.reviewDecision) ? o.reviewDecision as VibeReviews['decision'] : null;
  return { decision, items };
}

// <prefix…> gh <args>, au dossier `dir` : sans shell, 15 s, null en cas
// d'échec ; une sous-commande hors de GH_READ, ou une autre commande que
// GH_LOGIN exactement, n'est pas lancée.
export function ghRun(dir: string, prefix: string[]): GhRun {
  return (args) => new Promise((resolve) => {
    const login = args.length === GH_LOGIN.length && GH_LOGIN.every((a, i) => args[i] === a);
    if (!login && !GH_READ.some(([a, b]) => args[0] === a && args[1] === b)) return resolve(null);
    const argv = [...prefix, 'gh', ...args];
    try {
      execFile(argv[0], argv.slice(1), { cwd: dir, timeout: 15_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
        (err, stdout) => resolve(err ? null : stdout));
    } catch {
      resolve(null);   // un argument que execFile refuse d'emblée, un dossier qui manque
    }
  });
}

const parse = (text: string | null): unknown => { try { return text === null ? null : JSON.parse(text); } catch { return null; } };
const okNumber = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;
// Un identifiant GitHub : lettres, chiffres, tirets, 39 au plus, sans tiret en tête.
export const okLogin = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(s);

// Tout passe par `run`. Une branche hors d'okRef, un numéro qui n'est pas un
// entier positif : null sans lancer gh.
export function githubReader(run: GhRun) {
  return {
    // La PR de cette branche (ouverte, sinon la dernière) et les checks de sa tête (ciOf), ou null.
    async prForBranch(branch: string): Promise<GhPr | null> {
      if (!okRef(branch)) return null;
      const p = parse(await run(['pr', 'view', '--json', 'number,title,url,state,baseRefName,headRefName,statusCheckRollup,reviewDecision,reviews,comments', '--', branch])) as Record<string, unknown> | null;
      return p && okNumber(p.number) ? {
        number: p.number, title: String(p.title ?? ''), url: String(p.url ?? ''), state: String(p.state ?? ''),
        base: String(p.baseRefName ?? ''), head: String(p.headRefName ?? ''), ci: ciOf(p.statusCheckRollup), reviews: reviewsOf(p),
      } : null;
    },
    // Les PR ouvertes du dépôt, en trois listes (gh pr list --author @me ; à relire ; sans filtre, --limit 100) ; une
    // qui échoue → null. À relire : celles de --search review-requested:@me (l'index de recherche de GitHub, en retard
    // de quelques minutes, mais qui voit les demandes faites à une équipe) plus celles de la liste entière dont les
    // demandes de relecture (reviewRequests, lues directement, à jour) nomment mon identifiant (login, lu par l'appelant
    // avec login() : openPrs ne lance que gh pr list) ; sans login, la recherche seule.
    async openPrs(login: string | null = null): Promise<{ mine: unknown[]; review: unknown[]; all: unknown[] } | null> {
      const list = async (filter: string[], fields = 'number,title,author,url') => {
        const l = parse(await run(['pr', 'list', ...filter, '--json', fields]));
        return Array.isArray(l) ? l : null;
      };
      const [mine, searched, full] = await Promise.all([
        list(['--author', '@me']), list(['--search', 'review-requested:@me']),
        list(['--limit', '100'], 'number,title,author,url,reviewRequests'),
      ]);
      if (!mine || !searched || !full) return null;
      const asked = (p: unknown) => !!login && okLogin(login) && Array.isArray((p as { reviewRequests?: unknown })?.reviewRequests)
        && ((p as { reviewRequests: unknown[] }).reviewRequests).some((r) => (r as { login?: unknown } | null)?.login === login);
      const all = full.map((p) => { const { reviewRequests: _, ...rest } = (p ?? {}) as Record<string, unknown>; return rest; });
      const seen = new Set(searched.map((p) => (p as { number?: unknown } | null)?.number));
      const review = [...searched, ...all.filter((p, i) => asked(full[i]) && !seen.has(p.number))];
      return { mine, review, all };
    },
    // L'identifiant GitHub de l'utilisateur (gh api user), ou null.
    async login(): Promise<string | null> {
      const login = (await run([...GH_LOGIN]))?.trim() ?? '';
      return okLogin(login) ? login : null;
    },
    // L'auteur et les assignés d'une PR, ou null ; un
    // login hors d'okLogin est écarté, comme une équipe (sans login).
    async prPeople(n: unknown): Promise<{ author: string; assignees: string[] } | null> {
      if (!okNumber(n)) return null;
      const p = parse(await run(['pr', 'view', '--json', 'author,assignees', '--', String(n)])) as Record<string, unknown> | null;
      if (!p || typeof p !== 'object') return null;
      const logins = (l: unknown): string[] => (Array.isArray(l) ? l : []).map((x) => (x as { login?: unknown } | null)?.login).filter(okLogin);
      return { author: logins([p.author])[0] ?? '', assignees: logins(p.assignees) };
    },
    // OPEN, CLOSED ou MERGED, ou null.
    async prState(n: unknown): Promise<string | null> {
      if (!okNumber(n)) return null;
      const state = (parse(await run(['pr', 'view', '--json', 'state', '--', String(n)])) as { state?: unknown } | null)?.state;
      return state === 'OPEN' || state === 'CLOSED' || state === 'MERGED' ? state : null;
    },
  };
}
