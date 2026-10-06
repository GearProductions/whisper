/* Scénarios du banc de comparaison (cf. main.cjs) : une page, une taille de
   fenêtre, des étapes. Étapes : emit (message du principal), click, menu (clic
   droit), type (saisie dans un champ), range, key, mouse (vraie souris),
   wait, eval (valeur relevée), shot (capture). Les réponses aux appels
   `invoke` viennent de `answers`, sinon de DEFAULT_ANSWERS. */

const T0 = Date.parse('2026-09-30T09:30:00');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const TOOLS = ['Lire le fichier : a.md', 'Exécuter la commande : npm test', 'Modifier le fichier : src/x.ts', 'Lire le fichier : b.md',
  'Chercher sur le web : vite', 'Écrire le fichier : c.md', 'Lire le fichier : d.md', 'Exécuter la commande : git status'];

const user = (text, extra = {}) => ({ role: 'user', kind: null, text, context: '', files: [], images: [], time: T0, tools: [], audio: false, ...extra });
const reply = (text, extra = {}) => ({ role: 'assistant', kind: null, text, context: '', files: [], images: [], time: T0 + 60000, tools: [], audio: true, ...extra });

const thread = (over = {}) => ({
  mode: 'compact', key: 'a1', live: true, name: 'alpha', color: '#22c55e', dir: '/home/u/projet', title: 'Refonte du panneau',
  status: 'idle', since: null, context: { used: 120000, max: 200000 }, permission: null,
  messages: [
    user('Ancienne question', { time: T0 - 3600000 }),
    reply('Ancienne réponse', { time: T0 - 3500000 }),
    user('Peux-tu lire https://example.com/doc. et résumer ?', {
      context: 'texte sélectionné\nligne 2', files: ['/home/u/projet/a.md', '/home/u/projet/dossier', '/home/u/x.zip'], images: [PNG],
    }),
    reply('Voici le résumé :\n```js\nconst a = 1;\n```\nEt [la PR](https://github.com/x/y/pull/1), (https://fr.wikipedia.org/wiki/A_(b)).', { tools: TOOLS }),
  ],
  ...over,
});
const dictation = (messages = []) => ({
  dictation: true, mode: 'compact', key: 'dictation', live: false, name: 'Dictée', title: 'Dictée', color: '#3b6fe0', status: 'idle', messages,
});
const PERMISSION = { key: 3, title: 'alpha demande l\'autorisation (1 autre en attente)', text: 'Exécuter la commande :\nnpm test -- --run\n/home/u/projet/script.sh', always: ['Bash(npm test:*)'] };
const CONTEXT = {
  total: 170000, max: 200000, percentage: 85, model: 'claude-opus-5-5',
  categories: [{ name: 'Prompt système', tokens: 3000, kind: 'system' }, { name: 'Outils', tokens: 12000, kind: 'tools' },
    { name: 'Messages', tokens: 155000, kind: 'messages' }, { name: 'Libre', tokens: 30000, kind: 'free' }, { name: 'Vide', tokens: 0, kind: 'x' }],
  memoryFiles: [{ path: 'CLAUDE.md', tokens: 1200 }],
};
const COMMANDS = [{ name: 'compact', description: 'Résumer la conversation', argumentHint: '[consigne]' },
  { name: 'context', description: 'Contexte utilisé' }, { name: 'recompile', description: 'x' }];
const AGENTS = { enabled: true, agents: [
  { id: 'a1', name: 'alpha', color: '#22c55e', selected: true, status: 'working', unread: false },
  { id: 'a2', name: 'beta', color: '#3b82f6', selected: false, status: 'idle', unread: true },
  { id: 'a3', name: 'gamma', color: '#ec4899', selected: false, status: 'asking', unread: false },
] };
const TTS = { mode: 'selection', volume: 1, ready: true, hasText: true };
const value = (sel) => `document.querySelector(${JSON.stringify(sel)}).value`;

const COMPACT = [560, 420];
const FULL = [720, 700];
const ICON = { page: 'icon', size: [244, 64], query: { size: '64' } };

module.exports = [
  /* ---- Panneau --------------------------------------------------------------- */
  { name: 'panneau-dictee-vide', page: 'panel', size: COMPACT, steps: [['emit', 'conv:thread', dictation()], ['shot', 'vide']] },
  { name: 'panneau-dictee-copier', page: 'panel', size: COMPACT, steps: [
    ['emit', 'conv:thread', dictation([user('Bonjour, voici le texte dicté.')])], ['shot', 'texte'],
    ['click', '.copy'], ['shot', 'copie'],
    ['emit', 'conv:thread', dictation([user('Une autre dictée.', { time: T0 + 5000 })])], ['shot', 'nouvelle'],
  ] },
  { name: 'panneau-reduit', page: 'panel', size: COMPACT, steps: [
    ['emit', 'conv:thread', thread()], ['shot', 'reduit'],
    ['click', '.message.assistant .listen'], ['click', '.file'], ['click', '.message.user .body a'], ['click', '.message.assistant .body a'],
    ['click', '.attachments img'], ['shot', 'image'], ['key', 'body', 'Escape'], ['shot', 'sans-image'],
    ['click', '#mode'], ['click', '#hide'],
  ] },
  { name: 'panneau-agrandi-historique', page: 'panel', size: FULL,
    answers: { 'conv:history': [{ sessionId: 's1', title: 'Session une', lastModified: T0, current: true }, { sessionId: 's2', title: '', lastModified: T0 - 86400000, current: false }] },
    steps: [
      ['emit', 'conv:thread', thread({ mode: 'full', messages: [...thread().messages, { role: 'system', kind: 'output', text: 'sortie\nde commande', time: T0 + 70000 }, { role: 'system', kind: 'compact', text: 'Résumé long', time: T0 + 80000 }] })],
      ['shot', 'agrandi'], ['click', '.tools details summary'], ['shot', 'actions'],
      ['click', '#history-button'], ['wait', 100], ['shot', 'historique'], ['click', '.session:not(.current)'],
      ['click', '#history-button'], ['wait', 100], ['key', 'body', 'Escape'], ['shot', 'echap'],
    ] },
  { name: 'panneau-ancienne-conversation', page: 'panel', size: FULL, steps: [
    ['emit', 'conv:thread', thread({ mode: 'full', key: 'a1:s2', live: false, title: '' })], ['shot', 'archive'],
    ['click', '#current'], ['click', '#resume'],
    ['emit', 'conv:thread', thread({ mode: 'full', key: 'a1:s2', live: false, status: 'working' })], ['shot', 'archive-occupe'],
  ] },
  { name: 'panneau-autorisation', page: 'panel', size: COMPACT, steps: [
    ['emit', 'conv:thread', thread({ status: 'asking', permission: PERMISSION })],
    ['click', '.permission [data-act="allow"]'], ['shot', 'demande'], ['wait', 700],
    ['click', '.permission [data-act="always"]'], ['shot', 'repondu'],
    ['emit', 'conv:thread', thread({ status: 'asking', permission: { ...PERMISSION, key: 4, always: [] } })], ['shot', 'suivante'],
    ['click', '.permission [data-act="deny"]'], ['wait', 700], ['click', '.permission [data-act="deny"]'],
  ] },
  { name: 'panneau-au-travail', page: 'panel', size: COMPACT, steps: [
    ['emit', 'conv:thread', thread({ status: 'working' })], ['shot', 'travaille'],
    ['type', '#message', 'en attendant'], ['key', '#message', 'Enter'], ['eval', value('#message')], ['shot', 'champ'],
  ] },
  // Écart voulu : en réduit, le panneau grandit pour montrer l'erreur d'envoi
  // (en 0.4.0, la ligne d'erreur restait hors du panneau).
  { name: 'panneau-envoi', page: 'panel', size: COMPACT, newOnly: [['conv:height', 637]], answers: { 'conv:send': (d) => (d.text === 'refus' ? { ok: false, error: 'alpha travaille encore : message non envoyé.' } : { ok: true }) },
    steps: [
      ['emit', 'conv:thread', thread()], ['type', '#message', 'bonjour'], ['key', '#message', 'Enter'], ['wait', 50], ['eval', value('#message')],
      ['type', '#message', 'refus'], ['click', '#send'], ['wait', 50], ['eval', value('#message')], ['shot', 'erreur'],
      ['type', '#message', 'refus\nsur\nplusieurs\nlignes\npour\nvoir\nle\nchamp\ngrandir'], ['shot', 'grand-champ'],
    ] },
  { name: 'panneau-brouillons', page: 'panel', size: COMPACT, steps: [
    ['emit', 'conv:thread', thread()], ['type', '#message', 'un'],
    ['emit', 'conv:thread', thread({ key: 'b2', name: 'beta', color: '#3b82f6', messages: [] })], ['eval', value('#message')],
    ['emit', 'conv:dictation', 'deux'], ['wait', 50], ['eval', value('#message')], ['shot', 'beta'],
    ['emit', 'conv:thread', thread()], ['eval', value('#message')],
    ['emit', 'conv:dictation', 'trois'], ['wait', 50], ['eval', value('#message')],
  ] },
  { name: 'panneau-commandes', page: 'panel', size: COMPACT, answers: { 'conv:probe': { commands: COMMANDS } }, steps: [
    ['emit', 'conv:thread', thread()], ['type', '#message', '/co'], ['wait', 100], ['shot', 'liste'],
    ['key', '#message', 'ArrowDown'], ['shot', 'fleche'], ['key', '#message', 'Enter'], ['wait', 50], ['eval', value('#message')],
    ['type', '#message', '/zz'], ['wait', 50], ['shot', 'aucune'], ['key', '#message', 'Escape'], ['shot', 'fermee'],
  ] },
  { name: 'panneau-contexte', page: 'panel', size: FULL, answers: { 'conv:probe': { context: CONTEXT, commands: COMMANDS } }, steps: [
    ['emit', 'conv:thread', thread({ mode: 'full', context: { used: 170000, max: 200000 } })], ['shot', 'jauge'],
    ['click', '#context-button'], ['wait', 100], ['shot', 'detail'], ['click', '.ctx-compact'], ['wait', 50], ['shot', 'compacte'],
    ['emit', 'conv:thread', thread({ mode: 'full', context: { used: 190000, max: 200000 } })], ['shot', 'rouge'],
  ] },
  { name: 'panneau-message-appli', page: 'panel', size: COMPACT, steps: [
    ['emit', 'conv:thread', thread()], ['emit', 'conv:notice', { kind: 'notice', text: 'Micro Discord coupé' }], ['shot', 'notice'],
    ['click', '#notice-close'], ['shot', 'fermee'], ['emit', 'conv:notice', { kind: 'status', text: 'Téléchargement du modèle…' }], ['shot', 'status'],
    ['emit', 'conv:notice', null], ['shot', 'effacee'],
  ] },
  { name: 'panneau-pieces-jointes', page: 'panel', size: COMPACT, steps: [
    ['emit', 'conv:thread', thread()], ['click', '#attach'],
    ['emit', 'conv:attached', { files: ['/home/u/b.txt', '/home/u/img.png'], selection: { text: 'abc def', cut: true } }],
    ['emit', 'conv:attached', { files: ['/home/u/b.txt'] }], ['shot', 'pieces'],
    ['click', '.piece .remove'], ['shot', 'retiree'], ['key', '#message', 'Enter'], ['wait', 50], ['shot', 'envoye'],
  ] },
  { name: 'panneau-focus-champ', page: 'panel', size: COMPACT, steps: [
    ['emit', 'conv:thread', thread()], ['emit', 'conv:focusInput'], ['eval', 'document.activeElement && document.activeElement.id'],
  ] },

  /* ---- Bulle ----------------------------------------------------------------- */
  { name: 'bulle-message', page: 'bubble', size: [340, 240], steps: [
    ['emit', 'bubble:show', 'Téléchargement du modèle de dictée (548 Mo)… Une seule fois.', 'status', { width: 340, maxHeight: 240 }], ['shot', 'status'],
    ['emit', 'bubble:show', 'Micro Discord coupé', 'notice', { width: 340, maxHeight: 240 }], ['shot', 'notice'],
    ['emit', 'bubble:show', 'Un très long message '.repeat(40), 'status', { width: 340, maxHeight: 240 }], ['shot', 'long'],
    ['mouse', 'mouseMove', 100, 30], ['mouse', 'mouseLeave', 400, 300], ['click', '#close'],
  ] },
  { name: 'bulle-volume', page: 'bubble', size: [340, 240], steps: [
    ['emit', 'bubble:show', 0.6, 'volume', { width: 340, maxHeight: 240 }], ['shot', 'volume'],
    ['range', '#volume-range', '80'], ['shot', 'change'],
    ['emit', 'bubble:show', 'Lecture à voix haute installée.', 'status', { width: 340, maxHeight: 240 }], ['shot', 'apres'],
  ] },

  /* ---- Icône ----------------------------------------------------------------- */
  { name: 'icone-repos', ...ICON, steps: [['shot', 'vide'], ['eval', 'document.querySelector("#icon").title']] },
  { name: 'icone-robots-lecture', ...ICON, steps: [
    ['emit', 'tts:state', TTS], ['emit', 'agents:state', AGENTS], ['shot', 'robots'],
    ['eval', '[...document.querySelectorAll(".agent")].map((b) => b.title).join(" | ")'],
    ['eval', 'document.querySelector("#icon").title'], ['eval', 'document.querySelector("#play").title'],
    ['click', '.agent[data-id="a2"]'], ['menu', '.agent[data-id="a3"]'], ['menu', '#icon'], ['wait', 100], ['click', '#add'],
    ['emit', 'tts:state', { ...TTS, hasText: false }], ['emit', 'agents:state', { enabled: false, agents: [] }], ['shot', 'gris'],
    ['emit', 'tts:state', { mode: 'off' }], ['shot', 'sans-lecture'],
  ] },
  { name: 'icone-lecture', ...ICON, steps: [
    ['emit', 'tts:state', TTS], ['click', '#play'], ['wait', 50], ['eval', 'document.querySelector("#play").dataset.phase'],
    ['emit', 'tts:chunk', 1, new Uint8Array(4800), 24000], ['eval', 'document.querySelector("#play").dataset.phase'], ['shot', 'lecture'],
    ['click', '#play'], ['eval', 'document.querySelector("#play").dataset.phase'],
    ['emit', 'tts:speakReply'], ['wait', 50], ['emit', 'tts:end', 1, 'La synthèse vocale a échoué.'], ['wait', 50],
    ['eval', 'document.querySelector("#play").dataset.phase + " " + document.querySelector("#play").title'],
  ] },
  { name: 'icone-glisser', ...ICON, steps: [
    ['mouse', 'mouseDown', 32, 32], ['mouse', 'mouseMove', 34, 33], ['mouse', 'mouseMove', 60, 40], ['mouse', 'mouseMove', 80, 50],
    ['mouse', 'mouseUp', 80, 50], ['wait', 400],
  ] },
  { name: 'icone-clic-bref', ...ICON, steps: [['mouse', 'mouseDown', 32, 32], ['wait', 100], ['mouse', 'mouseUp', 32, 32], ['wait', 400]] },
  { name: 'icone-dictee', ...ICON, tolerance: 0, steps: [
    ['emit', 'agents:state', AGENTS],
    ['mouse', 'mouseDown', 32, 32], ['wait', 1500], ['shot', 'enregistre'], ['mouse', 'mouseUp', 32, 32], ['wait', 400],
    ['eval', 'document.querySelector("#icon").dataset.phase + " " + document.querySelector("#icon").title'],
  ] },
];
