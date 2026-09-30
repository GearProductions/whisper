/* =========================================================================
   Whisper — la conversation d'un agent, en entier

   Une fenêtre classique (redimensionnable, déplaçable) : tous les échanges
   avec l'agent, du premier au dernier. Le principal envoie le fil
   (`conv:thread`) à l'ouverture puis à chaque changement ; ▶ Écouter lit le
   résumé audio d'une réponse par le lecteur de l'icône.
   ========================================================================= */

const thread = document.getElementById('thread');
const template = document.getElementById('message-template');
const status = document.getElementById('status');

// Le texte tel quel ; seuls les blocs ``` deviennent des blocs de code.
function renderBody(el, text) {
  el.replaceChildren();
  String(text || '').split('```').forEach((part, i) => {
    if (i % 2 === 0) { if (part) el.append(part.replace(/^\n+|\n+$/g, i ? '\n' : '')); return; }
    const pre = document.createElement('pre');
    pre.textContent = part.replace(/^[\w+-]*\n/, '').replace(/\n$/, ''); // sans le nom du langage
    el.append(pre);
  });
}

// `data` : { name, dir, color, status, messages: [{ role, text, tools, audio }] }.
window.conv.onThread((data) => {
  document.documentElement.style.setProperty('--accent', data.color);
  document.title = `${data.name} — conversation`;
  document.getElementById('name').textContent = data.name;
  document.getElementById('dir').textContent = data.dir;
  const atEnd = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 40;
  const grew = data.messages.length !== thread.childElementCount;
  thread.replaceChildren(...data.messages.map((m, index) => {
    const el = template.content.firstElementChild.cloneNode(true);
    el.classList.add(m.role);
    el.querySelector('.who').textContent = m.role === 'user' ? 'Vous' : data.name;
    renderBody(el.querySelector('.body'), m.text);
    el.querySelector('.tools').replaceChildren(...(m.tools || []).map((t) => Object.assign(document.createElement('div'), { textContent: t })));
    const listen = el.querySelector('.listen');
    listen.hidden = m.role !== 'assistant' || !m.audio;
    listen.addEventListener('click', () => window.conv.speak(index));
    return el;
  }));
  const texts = { working: `${data.name} travaille…`, asking: `${data.name} attend une autorisation (voir la bulle près de l'icône).` };
  status.hidden = !texts[data.status];
  status.textContent = texts[data.status] || '';
  // Reste en bas quand un message arrive, sans arracher la lecture d'un message plus ancien.
  if (grew && atEnd) thread.scrollTop = thread.scrollHeight;
});

window.conv.ready();
