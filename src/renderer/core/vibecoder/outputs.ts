/** outputs — ce que les skills écrivent pour l'écran, lu sans se fier au
 *  format : les vérifications (checks.json), la revue publiée
 *  (pr-<n>-review.json : état, lien, verdict, texte, date), un Markdown coupé en rubriques `##` (une par commit
 *  dans pr-<n>-commits.md) ; une adresse n'est gardée qu'en
 *  http(s) (I-21). Illisible : null, l'écran le dit.
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : les vérifications en échec. L'état de la CI n'est plus lu
 *  dans ci.md (parseCi et Ci retirés : la ligne d'état et la carte de la PR lisent view.pr.ci, gh ; note
 *  0.16.0-ligne-apres-pr).
 *  failedChecks(checks: Check[]): Check[] — celles de checks.json en échec (level 'error'), dans l'ordre ; un
 *  avertissement passe.
 *  withoutApplied(ponytail: Out, applied?: Out): string — le texte de ponytail.md sans les remarques [agent] que la course
 *  apply a appliquées (leur adresse dans ponytail-applied.json, avec leurs lignes de suite) ; le fichier plus vieux que
 *  ponytail.md (une revue d'avant), absent ou illisible : le texte tel quel. Une remarque [toi] n'est jamais retirée.
 *  La revue essentielle (note 0.16.0-revue-essentielle) : la relecture du code d'une PR en une passe (pr-<n>-commits.md)
 *  n'est plus rangée par commit (commitTitle et commitReviews sont partis avec la vue des commits).
 *  findings(md: string): Findings — ses constats : chaque titre `##` (hors bloc de code) en ouvre un, son titre et son
 *  détail (sections), dans l'ordre ; intro, ce qui précède le premier titre ('' : rien) ; un fichier sans titre (« rien
 *  à signaler », une relecture d'avant ce format) : aucun constat, tout son texte dans intro — rien n'est caché.
 *  Ne connaît pas : le DOM, React, les noms des fichiers.
 *  Utilisé par : app/panel/vibecoder (review-view, branches-view, findings-view, draft-view, step-parts, pr-view) ;
 *  core/vibecoder (review-flow : Section). */

import { VERDICTS, type Verdict } from 'shared/review';

export type Check = { name: string; ok: boolean; level: 'ok' | 'warning' | 'error'; detail: string };

const json = (text: string): unknown => {
  try { return JSON.parse(text); } catch { return undefined; }
};

// Une adresse web, sinon null : le seul lien qu'on montre.
export const webUrl = (v: unknown): string | null => (typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim() : null);

// checks.json : {"items":[{"name","ok","level","detail"}],"time"} → les
// vérifications ; pas d'items : null. Un item sans nom est écarté. level
// (ok, warning, error) l'emporte ; absent ou inconnu (ancien format) : ok si
// ok est true, sinon error. ok : tout sauf error — des avertissements passent
// (comme le parcours).
export function parseChecks(text: string): Check[] | null {
  const items = (json(text) as { items?: unknown } | null | undefined)?.items;
  if (!Array.isArray(items)) return null;
  return items.flatMap((x) => {
    const { name, ok, level, detail } = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const lvl = level === 'ok' || level === 'warning' || level === 'error' ? level : ok === true ? 'ok' : 'error';
    return typeof name === 'string' && name.trim()
      ? [{ name: name.trim(), ok: lvl !== 'error', level: lvl, detail: typeof detail === 'string' ? detail.trim() : '' }] : [];
  });
}

// pr-<n>-review.json : {"state","url","verdict","body","at"} → l'état
// (APPROVED, COMMENTED, CHANGES_REQUESTED… tel quel, en majuscules ; '' s'il
// manque), le lien, le verdict, le texte publié et sa date (ISO → ms) ; ces
// trois-là null quand le fichier ne les a pas (une revue d'avant) ou qu'ils
// sont inconnus ; pas un objet : null.
export function parseReview(text: string): { state: string; url: string | null; verdict: Verdict | null; body: string | null; at: number | null } | null {
  const v = json(text);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const { state, url, verdict, body, at } = v as Record<string, unknown>;
  const ms = typeof at === 'string' ? Date.parse(at) : NaN;
  return {
    state: typeof state === 'string' ? state.trim().toUpperCase() : '',
    url: webUrl(url),
    verdict: VERDICTS.find((v) => v === verdict) ?? null,
    body: typeof body === 'string' ? body : null,
    at: Number.isNaN(ms) ? null : ms,
  };
}

export type Section = { title: string; body: string };

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const H2 = /^ {0,3}##[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;

// Les rubriques d'un Markdown : chaque titre `##` (hors bloc de code) ouvre la
// sienne ; ce qui précède le premier : une rubrique sans titre, si elle n'est
// pas vide.
export function sections(md: string): Section[] {
  const out: Section[] = [];
  let title = '';
  let lines: string[] = [];
  let fence: string | null = null;
  const flush = () => {
    const body = lines.join('\n').trim();
    if (title || body) out.push({ title, body });
  };
  for (const line of md.split(/\r?\n/)) {
    const f = FENCE.exec(line);
    if (f && (!fence || (f[1][0] === fence[0] && f[1].length >= fence.length && !line.trim().slice(f[1].length).trim()))) {
      fence = fence ? null : f[1];
    } else if (!fence) {
      const h = H2.exec(line);
      if (h) { flush(); title = h[1].trim(); lines = []; continue; }
    }
    lines.push(line);
  }
  flush();
  return out;
}

// Les constats de la relecture du code (voir l'en-tête) : un par titre `##`, et ce qui précède le premier.
export type Findings = { list: Section[]; intro: string };

export function findings(md: string): Findings {
  const all = sections(md);
  const hasIntro = all[0] !== undefined && !all[0].title;
  return { list: hasIntro ? all.slice(1) : all, intro: hasIntro ? all[0].body : '' };
}

// L'adresse « <fichier>:L<ligne> » qui ouvre une ligne de ponytail.md (entre accents graves ou non ; plage L12-38 permise) :
// lue par untag (tags).
export const ADDRESS = /^\s*`?([^\s`]+):L(\d+)(?:-\d+)?\b/;

// ponytail.md sans les remarques [agent] déjà appliquées (voir l'en-tête).
export function withoutApplied(ponytail: { text: string; time: number }, applied?: { text: string; time: number }): string {
  const list = applied && applied.time >= ponytail.time ? (json(applied.text) as { applied?: unknown } | null | undefined)?.applied : null;
  if (!Array.isArray(list)) return ponytail.text;
  let dropping = false;
  return ponytail.text.split('\n').filter((line) => {
    const m = /^[-*]\s+`?([^\s`]+:L\d+(?:-\d+)?)`?\s+\[agent\]/.exec(line);
    if (m) dropping = list.includes(m[1]);
    else if (!/^\s+\S/.test(line)) dropping = false;
    return !dropping;
  }).join('\n');
}

// Les vérifications de checks.json en échec, dans l'ordre (un avertissement passe).
export const failedChecks = (checks: Check[]): Check[] => checks.filter((c) => c.level === 'error');
