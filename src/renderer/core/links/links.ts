/** links — découpe un texte en segments : le texte tel quel, et ses adresses
 *  web (https://…) ou liens Markdown ([titre](https://…)) devenus des liens.
 *  Seule une adresse http(s) devient un lien (SPEC I-21).
 *  Ne connaît pas : le DOM, React. Utilisé par : core/ui (linkified). */

export type Segment = { text: string; url?: string };

const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>"'`]+/g;

export function splitLinks(text: string): Segment[] {
  const source = String(text || '');
  const out: Segment[] = [];
  const re = new RegExp(LINK);
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let url = m[2] || m[0];
    let end = re.lastIndex;
    if (!m[2]) {
      // Ponctuation de fin de phrase, et parenthèse fermante sans ouvrante : hors du lien.
      url = url.replace(/[.,;:!?»'"]+$/, '');
      while (url.endsWith(')') && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) url = url.slice(0, -1);
      end = m.index + url.length;
      re.lastIndex = end;
    }
    if (m.index > last) out.push({ text: source.slice(last, m.index) });
    out.push({ text: m[2] ? m[1] : url, url });
    last = end;
  }
  if (last < source.length) out.push({ text: source.slice(last) });
  return out;
}
