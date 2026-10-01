/* =========================================================================
   Whisper — liens cliquables dans un texte (bulle, conversation)

   linkify(texte, ouvrir) rend des nœuds DOM : le texte tel quel, ses adresses
   web (https://…) et ses liens Markdown ([titre](https://…)) devenus des
   liens. Un clic appelle `ouvrir(url)` — le principal l'ouvre dans le
   navigateur — et ne remonte pas (la bulle copierait son texte).
   ========================================================================= */

function linkify(text, open) {
  const out = document.createDocumentFragment();
  const re = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>"'`]+/g;
  const source = String(text || '');
  let last = 0;
  let m;
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
    out.append(source.slice(last, m.index));
    const a = document.createElement('a');
    a.href = url;
    a.textContent = m[2] ? m[1] : url;
    a.title = url;
    a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(url); });
    out.append(a);
    last = end;
  }
  out.append(source.slice(last));
  return out;
}
