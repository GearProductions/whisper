/** outputs — ce que les skills écrivent pour l'écran, lu sans se fier au
 *  format : les vérifications (checks.json), la revue publiée
 *  (pr-<n>-review.json), un Markdown coupé en rubriques `##` (une par commit
 *  dans pr-<n>-commits.md), le titre d'une rubrique de commit et les
 *  rubriques rangées par commit du relevé ; la clé « <fichier>:L<ligne> »
 *  d'une remarque de la ponytail review et celles que la course apply a
 *  appliquées (ponytail-applied.json) ; une adresse n'est gardée qu'en
 *  http(s) (I-21). Illisible : null, l'écran le dit.
 *  Ne connaît pas : le DOM, React, les noms des fichiers.
 *  Utilisé par : app/panel/vibecoder (review-view, pr-picker, commits-view, draft-view, step-parts). */

import type { VibeCommit, VibeOutput } from 'technicals/bridge';

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

// pr-<n>-review.json : {"state","url"} → l'état (APPROVED, COMMENTED,
// CHANGES_REQUESTED… tel quel, en majuscules ; '' s'il manque) et le lien ;
// pas un objet : null.
export function parseReview(text: string): { state: string; url: string | null } | null {
  const v = json(text);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const { state, url } = v as Record<string, unknown>;
  return { state: typeof state === 'string' ? state.trim().toUpperCase() : '', url: webUrl(url) };
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

// Le titre d'une rubrique de pr-<n>-commits.md : « <hash court> <sujet> »
// (hash entre accents graves, suivi de « : » ou d'un tiret, accepté) ; un
// autre titre : null.
export function commitTitle(title: string): { hash: string; subject: string } | null {
  const m = /^`?([0-9a-f]{7,40})`?:?(?:[ \t]+(?:[-—:·][ \t]+)?(.*))?$/i.exec(title.trim());
  return m ? { hash: m[1].toLowerCase(), subject: (m[2] ?? '').trim() } : null;
}

// pr-<n>-commits.md rangé par commit du relevé : la relecture de chacun (par
// son hash complet ; un hash court du titre en est le début) ; les autres
// rubriques (l'ensemble, un commit que le relevé ne connaît pas) à part, dans
// leur ordre.
export function commitReviews(md: string, commits: VibeCommit[]): { byHash: Map<string, string>; others: Section[] } {
  const byHash = new Map<string, string>();
  const others: Section[] = [];
  for (const sec of sections(md)) {
    const h = commitTitle(sec.title)?.hash;
    const c = h ? commits.find((x) => x.hash.toLowerCase().startsWith(h)) : undefined;
    if (c && !byHash.has(c.hash)) byHash.set(c.hash, sec.body);
    else others.push(sec);
  }
  return { byHash, others };
}

// La clé d'une remarque de ponytail.md : « <fichier>:L<ligne> » en tête
// (entre accents graves ou non ; d'une plage L12-38, la première ligne) ;
// pas de clé : null.
export function remarkKey(text: string): string | null {
  const m = /^\s*`?([^\s`]+):L(\d+)\b/.exec(text);
  return m ? `${m[1]}:L${m[2]}` : null;
}

// ponytail-applied.json : {"applied":["<fichier>:L<ligne>",…]} → les clés des
// remarques appliquées ; absent, plus vieux que ponytail.md (une revue
// d'avant) ou illisible : aucune.
export function appliedRemarks(applied: VibeOutput | undefined, ponytailTime: number): Set<string> {
  if (!applied || applied.time < ponytailTime) return new Set();
  const list = (json(applied.text) as { applied?: unknown } | null | undefined)?.applied;
  return new Set(Array.isArray(list) ? list.flatMap((x) => (typeof x === 'string' && remarkKey(x)) || []) : []);
}
