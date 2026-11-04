/* Scénarios du banc de comparaison (cf. main.cjs) : la page de l'appli (la
   fenêtre de VibeCoder), une taille de fenêtre, des étapes. Chacun commence par
   `open` : les agents (agents:state), le relevé de l'agent affiché (conv:vibe)
   et son fil (conv:thread) — sans relevé, l'écran attend. Étapes : emit
   (message du principal), click, menu (clic droit), type (saisie dans un
   champ), key, pointer (appui, relâché), mouse (vraie souris), wait, eval
   (valeur relevée), shot (capture). Les réponses aux appels `invoke` viennent
   de `answers`, sinon de DEFAULT_ANSWERS. */

const T0 = Date.parse('2026-09-30T09:30:00');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const TOOLS = ['Lire le fichier : a.md', 'Exécuter la commande : npm test', 'Modifier le fichier : src/x.ts', 'Lire le fichier : b.md',
  'Chercher sur le web : vite', 'Écrire le fichier : c.md', 'Lire le fichier : d.md', 'Exécuter la commande : git status'];

const user = (text, extra = {}) => ({ role: 'user', kind: null, text, context: '', files: [], images: [], time: T0, tools: [], audio: false, ...extra });
const reply = (text, extra = {}) => ({ role: 'assistant', kind: null, text, context: '', files: [], images: [], time: T0 + 60000, tools: [], audio: true, ...extra });

const thread = (over = {}) => ({
  key: 'a1', live: true, name: 'alpha', color: '#22c55e', dir: '/home/u/projet', title: 'Refonte du panneau',
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
const PERMISSION = { key: 3, title: 'alpha demande l\'autorisation (1 autre en attente)', text: 'Exécuter la commande :\nnpm test -- --run\n/home/u/projet/script.sh', always: ['Bash(npm test:*)'] };
const CONTEXT = {
  total: 170000, max: 200000, percentage: 85, model: 'claude-opus-5-5',
  categories: [{ name: 'Prompt système', tokens: 3000, kind: 'system' }, { name: 'Outils', tokens: 12000, kind: 'tools' },
    { name: 'Messages', tokens: 155000, kind: 'messages' }, { name: 'Libre', tokens: 30000, kind: 'free' }, { name: 'Vide', tokens: 0, kind: 'x' }],
  memoryFiles: [{ path: 'CLAUDE.md', tokens: 1200 }],
};
const COMMANDS = [{ name: 'compact', description: 'Résumer la conversation', argumentHint: '[consigne]' },
  { name: 'context', description: 'Contexte utilisé' }, { name: 'recompile', description: 'x' }];
// Les agents de l'en-tête (AgentView) : alpha affiché, beta qui a fini, gamma qui attend.
const agent = (id, name, color, activity, over = {}) => ({
  id, name, color, repo: 'projet', title: 'main', branch: 'feat/essai', step: 'note', activity, detail: null, parent: null, ...over,
});
const AGENTS = { shown: 'a1', agents: [
  agent('a1', 'alpha', '#22c55e', 'working'),
  agent('a2', 'beta', '#3b82f6', 'done'),
  agent('a3', 'gamma', '#ec4899', 'asking', { detail: 'Quelle base ?' }),
] };
// Le relevé le plus court qui montre l'écran (pas de dépôt : le bandeau le dit).
const vibe = (agentId = 'a1') => ({
  agentId, lang: 'fr', flow: 'create', agent: { model: '', effort: '', mode: 'default' }, repo: null, error: 'Pas un dépôt git.',
  steps: [], note: null, questions: [], modules: [], invariants: [], variants: [], commits: [], outputs: {}, checklist: [],
  actions: [], skills: [], pr: null, prs: null, draft: [], runs: [], processes: [], artifacts: [], artifactDirs: [], files: [], time: T0,
});
// Ouvrir l'écran sur un agent : la liste des agents, son relevé, son fil.
const open = (t = thread(), agentId = 'a1') => [
  ['emit', 'agents:state', { ...AGENTS, shown: agentId }], ['emit', 'conv:vibe', vibe(agentId)], ['emit', 'conv:thread', t],
];
const value = (sel) => `document.querySelector(${JSON.stringify(sel)}).value`;

const SIZE = [1280, 820]; // la fenêtre par défaut (vibeSize)

module.exports = [
  { name: 'fil', steps: [
    ...open(), ['shot', 'fil'],
    ['click', '.message.assistant .listen'], ['click', '.file'], ['click', '.message.user .body a'], ['click', '.message.assistant .body a'],
    ['click', '.attachments img'], ['shot', 'image'], ['key', 'body', 'Escape'], ['shot', 'sans-image'],
  ] },
  { name: 'historique',
    answers: { 'conv:history': [{ sessionId: 's1', title: 'Session une', lastModified: T0, current: true }, { sessionId: 's2', title: '', lastModified: T0 - 86400000, current: false }] },
    steps: [
      ...open(thread({ messages: [...thread().messages, { role: 'system', kind: 'output', text: 'sortie\nde commande', time: T0 + 70000 }, { role: 'system', kind: 'compact', text: 'Résumé long', time: T0 + 80000 }] })),
      ['shot', 'fil'], ['click', '.tools details summary'], ['shot', 'actions'],
      ['click', '.vc-history'], ['wait', 100], ['shot', 'historique'], ['click', '.session:not(.current)'],
    ] },
  { name: 'ancienne-conversation', steps: [
    ...open(thread({ key: 'a1:s2', live: false, title: '' })), ['shot', 'archive'],
    ['click', '#current'], ['click', '#resume'],
    ['emit', 'conv:thread', thread({ key: 'a1:s2', live: false, status: 'working' })], ['shot', 'archive-occupe'],
  ] },
  { name: 'autorisation', steps: [
    ...open(thread({ status: 'asking', permission: PERMISSION })),
    ['click', '.permission [data-act="allow"]'], ['shot', 'demande'], ['wait', 700],
    ['click', '.permission [data-act="always"]'], ['shot', 'repondu'],
    ['emit', 'conv:thread', thread({ status: 'asking', permission: { ...PERMISSION, key: 4, always: [] } })], ['shot', 'suivante'],
    ['click', '.permission [data-act="deny"]'], ['wait', 700], ['click', '.permission [data-act="deny"]'],
  ] },
  { name: 'au-travail', steps: [
    ...open(thread({ status: 'working' })), ['shot', 'travaille'],
    ['type', '#message', 'en attendant'], ['key', '#message', 'Enter'], ['eval', value('#message')], ['shot', 'champ'],
  ] },
  { name: 'envoi', answers: { 'conv:send': (d) => (d.text === 'refus' ? { ok: false, error: 'alpha travaille encore : message non envoyé.' } : { ok: true }) },
    steps: [
      ...open(), ['type', '#message', 'bonjour'], ['key', '#message', 'Enter'], ['wait', 50], ['eval', value('#message')],
      ['type', '#message', 'refus'], ['click', '#send'], ['wait', 50], ['eval', value('#message')], ['shot', 'erreur'],
      ['type', '#message', 'refus\nsur\nplusieurs\nlignes\npour\nvoir\nle\nchamp\ngrandir'], ['shot', 'grand-champ'],
    ] },
  // Le micro du champ, maintenu : enregistrer, transcrire ; le texte de whisper arrive dans le champ.
  { name: 'dictee', steps: [
    ...open(), ['type', '#message', 'un'],
    ['pointer', '#mic', 'pointerdown'], ['wait', 1500], ['shot', 'enregistre'], ['pointer', '#mic', 'pointerup'], ['wait', 600],
    ['eval', value('#message')], ['shot', 'dicte'],
  ] },
  { name: 'brouillons', steps: [
    ...open(), ['type', '#message', 'un'],
    ...open(thread({ key: 'a2', name: 'beta', color: '#3b82f6', messages: [] }), 'a2'), ['wait', 50], ['eval', value('#message')], ['shot', 'beta'],
    ...open(), ['wait', 50], ['eval', value('#message')],
  ] },
  { name: 'agents', steps: [
    ...open(), ['shot', 'robots'],
    ['click', '.vc-agents .vc-agent:nth-of-type(2)'], ['menu', '.vc-agents .vc-agent:nth-of-type(3)'], ['click', '.vc-search'], ['wait', 100], ['shot', 'palette'],
    ['key', 'body', 'Escape'],
  ] },
  { name: 'commandes', answers: { 'conv:probe': { commands: COMMANDS } }, steps: [
    ...open(), ['type', '#message', '/co'], ['wait', 100], ['shot', 'liste'],
    ['key', '#message', 'ArrowDown'], ['shot', 'fleche'], ['key', '#message', 'Enter'], ['wait', 50], ['eval', value('#message')],
    ['type', '#message', '/zz'], ['wait', 50], ['shot', 'aucune'], ['key', '#message', 'Escape'], ['shot', 'fermee'],
  ] },
  { name: 'contexte', answers: { 'conv:probe': { context: CONTEXT, commands: COMMANDS } }, steps: [
    ...open(thread({ context: { used: 170000, max: 200000 } })), ['shot', 'jauge'],
    ['click', '#context-button'], ['wait', 100], ['shot', 'detail'], ['click', '.ctx-compact'], ['wait', 50], ['shot', 'compacte'],
    ['emit', 'conv:thread', thread({ context: { used: 190000, max: 200000 } })], ['shot', 'rouge'],
  ] },
  { name: 'message-appli', steps: [
    ...open(), ['emit', 'conv:notice', { kind: 'notice', text: 'Micro Discord coupé' }], ['shot', 'notice'],
    ['click', '#notice-close'], ['shot', 'fermee'], ['emit', 'conv:notice', { kind: 'status', text: 'Téléchargement du modèle…' }], ['shot', 'status'],
    ['emit', 'conv:notice', null], ['shot', 'effacee'],
  ] },
  { name: 'pieces-jointes', steps: [
    ...open(), ['click', '#attach'],
    ['emit', 'conv:attached', { files: ['/home/u/b.txt', '/home/u/img.png'], selection: { text: 'abc def', cut: true } }],
    ['emit', 'conv:attached', { files: ['/home/u/b.txt'] }], ['shot', 'pieces'],
    ['click', '.piece .remove'], ['shot', 'retiree'], ['key', '#message', 'Enter'], ['wait', 50], ['shot', 'envoye'],
  ] },
  { name: 'focus-champ', steps: [
    ...open(), ['emit', 'conv:focusInput'], ['eval', 'document.activeElement && document.activeElement.id'],
  ] },
  { name: 'sans-agent', steps: [
    ['emit', 'agents:state', { shown: null, agents: [] }], ['shot', 'accueil'], ['click', '.vc-noagent button'],
  ] },
].map((sc) => ({ size: SIZE, ...sc }));
