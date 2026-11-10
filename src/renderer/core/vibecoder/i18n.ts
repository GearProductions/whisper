/** i18n — les libellés de l'écran VibeCoder, en français et en anglais
 *  (vibeLang) : en-tête (dont le bouton de la branche, le badge Relecteur et son
 *  infobulle : plus de mode Créer / Relire, l'appli décide du rôle), le fil
 *  d'Ariane des étapes (son aria-label journey, « N commits » à son bout),
 *  étapes (toutes s'ouvrent), l'interrupteur IDE / liste de Modules et Structure / Code de Forme, Relancer, Arrêter, onglets Conversation /
 *  Actions / Tâches / Processus, Arrêter Vibe (le fil d'Ariane), le champ d'une étape, la ponytail review lancée avec les
 *  vérifications,
 *  l'onglet Actions (états d'une course, Garder / Annuler, Autoriser /
 *  Toujours / Refuser), zone de commentaire, barre d'état
 *  (« N actions en cours »),
 *  titres des sorties ; le code d'un module (Enregistrer, fichier trop gros) ; le panneau
 *  Artefacts (son bouton, la liste vide, Copier dans le projet, l'arborescence :
 *  entrées du menu, Tout replier, motifs d'un nom refusé, confirmation de
 *  suppression ; fichier tronqué, dossier commun au projet) ; l'avancement d'une course
 *  (vague, modules faits, corrections, relance Opus) ; une durée,
 *  une taille de fichier en clair ; le sélecteur d'agent (titre, infobulles,
 *  Chercher, Réglages), la palette (placeholder, portées, groupes, états,
 *  actions, « tenue par », indications de fin de ligne, aide des touches),
 *  le groupe des robots des agents, « Étape … · état » (en échec, pas « en pause »), « surveille n tâches de fond »,
 *  + Nouvel agent, Poser une question à l'agent (le relecteur) ;
 *  le micro et Envoyer d'un champ, l'historique (🕘, Conversation en
 *  cours) et l'accueil sans agent (son bouton est paletteActions['new-agent']) ;
 *  la page des réglages (titre de l'engrenage, catégories, chaque réglage, information et commande) ;
 *  le badge d'une étiquette des fichiers de retour (tags : « pour toi », « pour l'agent »). Ceux des boutons viennent des
 *  actions (actions.<langue>.json).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder, app/panel (panel-app). */
import type {
  AgentActivity, AgentView, SettingKey, SettingsCategory, SettingsCommand, SettingsInfo, VibeLang, VibeRun, VibeRunProgress, VibeStepId,
} from 'technicals/bridge';
import type { MenuEntry } from './artifact-clipboard';
import type { NameProblem } from './artifact-tree';
import type { Tag } from './tags';

type Choices = [string, string][]; // [valeur, libellé]
// Un réglage de la page ; `model:<id>` et `effort:<id>` (une action) prennent le libellé de l'élément.
export type FixedSettingKey = Exclude<SettingKey, `model:${string}` | `effort:${string}`>;
export type PaletteAction = 'new-agent' | 'create-branch' | 'branches' | 'stash';

// L'avancement d'une course, partie par partie : une partie à 0 ou fausse est absente.
const progressParts = (p: VibeRunProgress, l: { wave: string; modules: string; fixes: (n: number) => string; opus: string }) => {
  const done = Math.min(p.done, p.total);
  return [
    p.wave > 0 && `${l.wave} ${p.wave}`,
    p.total > 0 && `${done}/${p.total} ${l.modules}`,
    p.fixes > 0 && l.fixes(p.fixes),
    p.opus && l.opus,
  ].filter(Boolean).join(' · ');
};

const fr = {
  locale: 'fr-FR',
  steps: {
    note: 'Note', forme: 'Forme', invariants: 'Invariants', modules: 'Modules', revue: 'Revue', pr: 'PR',
  } as Record<VibeStepId, string>,
  stepStatus: { done: 'faite', current: 'en cours', todo: 'à venir' },
  ideView: 'Vue IDE', listView: 'Vue liste', structure: 'Structure', code: 'Code',
  noChange: 'la branche ne change pas ce module',
  reviewer: 'Relecteur',
  reviewerTitle: 'Vous relisez la PR d\'un autre : rien ne s\'édite ici. S\'assigner la PR, dans l\'étape PR, pour la modifier.',
  screenTitle: 'Relire à l\'écran',
  refresh: 'Relever maintenant (dépôt, note, sorties)',
  reloadUi: 'Recharger l\'interface',
  reloadUiTitle: 'Les pages ont été reconstruites : recharger la fenêtre avec elles. Le principal et les agents continuent.',
  restartApp: 'Redémarrer',
  restartAppTitle: 'Le principal a été reconstruit : relancer l\'appli (les pages seules ne suffiraient pas). Si des agents travaillent, l\'appli le demande d\'abord.',
  close: 'Fermer',
  branch: (branch: string, base: string) => `Branche ${branch}, comparée à ${base}`,
  branchesOpen: 'Ouvrir la vue des branches : PR, branches locales, créer une branche',
  branchesClose: 'Fermer la vue des branches',
  journey: 'Parcours',
  commitsOf: (n: number) => (n > 1 ? `${n} commits` : n ? '1 commit' : 'aucun commit'),
  conversation: 'Conversation',
  shortcut: (n: number) => `Ctrl+${n}`,
  rerun: 'Relancer',
  errorHint: 'La conversation reste utilisable, à droite.',
  broken: 'Cette étape ne peut pas s\'afficher.',
  retry: 'Réessayer',
  openTitle: 'Ouvrir dans l\'éditeur',
  quote: 'Citer dans le champ',
  save: 'Enregistrer',
  saveTitle: 'Enregistrer sur le disque (Ctrl+S)',
  changedOnDisk: 'Le fichier a changé sur le disque',
  discard: 'Abandonner',
  discardTitle: 'Remettre le texte du disque',
  tooBig: 'Fichier trop gros pour être affiché (plus d\'1 Mo) ou illisible.',
  ago: (ms: number) => (ms < 60000 ? 'à l\'instant' : ms < 3600000 ? `il y a ${Math.floor(ms / 60000)} min`
    : ms < 86400000 ? `il y a ${Math.floor(ms / 3600000)} h` : `il y a ${Math.floor(ms / 86400000)} j`),
  outputs: {
    'questions.md': 'Questions ouvertes', 'align.md': 'Alignement note · forme · invariants', 'review.md': 'Relecture du diff',
    'commit.md': 'Commit proposé', 'checks.json': 'Vérifications', 'ponytail.md': 'Ponytail review', 'pr.json': 'PR ouverte',
    'ci.md': 'CI', 'pr-#.json': 'PR chargée', 'pr-#-note.md': 'Relecture de la note',
    'pr-#-commits.md': 'Relecture des commits', 'pr-#-review.json': 'Revue publiée',
  } as Record<string, string>,
  needText: 'Dictez ou écrivez d\'abord votre demande dans le champ, puis cliquez.',
  sendFailed: 'L\'action n\'est pas partie.',
  stop: '⏹ Arrêter',
  stopTitle: 'Arrêter le tour en cours de l\'agent (comme Interrompre de son menu)',
  convShow: 'Afficher la conversation',
  convHide: 'Masquer la conversation',
  convResize: 'Largeur de la conversation (glisser, ou flèches gauche et droite)',
  diffTitle: 'Ouvrir le diff de ce commit dans l\'éditeur',
  githubTitle: 'Ouvrir la page de ce commit sur GitHub',
  files: (n: number) => (n > 1 ? `${n} fichiers` : n ? '1 fichier' : 'aucun fichier'),
  commentAdd: 'Ajouter au brouillon',
  commentSave: 'Enregistrer',
  commentCancel: 'Annuler',
  commentHint: 'Échap annule · Ctrl+Entrée valide',
  commentPlaceholder: 'Votre remarque…',
  model: 'Modèle',
  effort: 'Effort',
  mode: 'Mode',
  modelTitle: 'Le modèle de l\'agent, comme dans son menu',
  effortTitle: 'L\'effort de l\'agent, comme dans son menu',
  runProgress: (p: VibeRunProgress) => progressParts(p, {
    wave: 'vague', modules: 'modules', fixes: (n) => `${n} correction${n > 1 ? 's' : ''}`, opus: 'relance Opus',
  }),
  modeTitle: 'Le mode de l\'agent, comme dans son menu',
  models: [['', 'défaut'], ['fable', 'Fable (plus cher)'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']] as Choices,
  efforts: [['', 'défaut'], ['low', 'faible'], ['medium', 'moyen'], ['high', 'élevé'], ['xhigh', 'très élevé'], ['max', 'maximal']] as Choices,
  modes: [['default', 'manuel'], ['acceptEdits', 'accepter les modifications'], ['auto', 'auto'], ['plan', 'plan']] as Choices,
  context: 'Contexte',
  contextTitle: 'Contexte de la conversation : cliquer pour le détail',
  tasksOf: (running: number) => (running ? `Tâches (${running})` : 'Tâches'),
  tasksTitle: 'Les tâches de fond de l\'agent',
  procsOf: (running: number) => (running ? `Processus (${running})` : 'Processus'),
  procsTitle: 'Les commandes qui lancent le projet (serveur, front, services) : lancées par l\'appli, arrêtées à sa sortie',
  runsOf: (live: number) => (live ? `Actions (${live})` : 'Actions'),
  runsTitle: 'Les actions lancées, chacune dans sa propre conversation, à côté de celle-ci',
  runsRunning: (n: number) => (n > 1 ? `${n} actions en cours` : `${n} action en cours`),
  noRuns: 'Aucune action lancée.',
  runState: {
    running: 'en cours', asking: 'attend une autorisation', stopped: 'arrêtée — à garder ou annuler', done: 'finie',
    failed: 'en échec', kept: 'gardée', undone: 'annulée',
  } as Record<VibeRun['state'], string>,
  runFor: (d: string) => `depuis ${d}`,
  runStopTitle: 'Arrêter cette action (on choisit ensuite de garder ou d\'annuler ce qu\'elle a écrit)',
  runReply: 'Sa réponse',
  runAsks: 'Demande',
  allow: 'Autoriser', allowTitle: 'Autoriser cette fois',
  always: 'Toujours', alwaysTitle: 'Autoriser, et ne plus demander pour cet outil',
  deny: 'Refuser', denyTitle: 'Refuser : l\'action continue sans',
  keep: 'Garder', keepTitle: 'Garder ce que l\'action a déjà écrit',
  undo: 'Annuler', undoTitle: 'Remettre les fichiers qu\'elle a écrits dans leur état d\'avant (et eux seuls)',
  fieldHint: 'Dictez ou écrivez ici la demande, puis cliquez sur l\'action : elle part avec.',
  ponytailWithChecks: 'Lancée avec les vérifications.',
  vibeStop: 'Arrêter Vibe',
  vibeStopTitle: 'La course en cours finit, la suivante ne part pas',
  changed: (n: number) => (n > 1 ? `${n} fichiers modifiés` : `${n} fichier modifié`),
  at: (time: string) => `relevé à ${time}`,
  artifacts: 'Artefacts',
  artifactsTitle: 'Les documents hors du projet, communs à tous ses agents : wireframes, PDF, présentations…',
  artifactsNone: 'Aucun artefact dans ce projet : demandez à l\'agent un document (wireframe, PDF, présentation…), il le crée ici.',
  artifactCopy: 'Copier dans le projet',
  artifactCopyTitle: 'Copier la sélection dans un dossier choisi',
  artifactMenu: {
    rename: 'Renommer', trash: 'Supprimer', copy: 'Copier', cut: 'Couper', paste: 'Coller', duplicate: 'Dupliquer',
    newFile: 'Nouveau fichier', newFolder: 'Nouveau dossier',
  } as Record<MenuEntry, string>,
  artifactCollapseAll: 'Tout replier',
  nameProblem: {
    empty: 'Le nom est vide.', dots: 'Ce nom n\'est pas permis (. ou ..).', separator: 'Pas de / ni de \\ dans un nom.',
    hidden: 'Un dossier ne commence pas par un point : il serait caché.', long: 'Nom trop long (255 octets au plus).',
    windows: 'Nom refusé : pas de : * ? " < > |, pas d\'espace ni de point à la fin, pas de nom réservé de Windows (CON, NUL…).',
    taken: 'Ce nom est déjà pris.',
  } as Record<NameProblem, string>,
  artifactConfirm: (n: number, name: string) => (n > 1 ? `Supprimer ces ${n} éléments ?` : `Supprimer « ${name} » ?`),
  artifactConfirmHint: 'Ils vont dans la corbeille du système : on peut les y récupérer.',
  artifactConfirmNo: 'Annuler',
  artifactTruncated: 'Fichier tronqué : Ouvrir dans l\'éditeur montre la suite.',
  artifactUnreadable: 'Fichier illisible.',
  // Le sélecteur d'agent, la palette (Ctrl+K), l'historique, l'accueil sans agent.
  agentTitle: (title: AgentView['title'], pr?: number) => (title === 'pr' ? `PR #${pr}` : title === 'worktree' ? 'worktree' : 'dossier principal'),
  pickerClick: 'Chercher un agent',
  pickerMenu: 'Clic droit : le menu de l\'agent',
  search: 'Chercher',
  searchKeys: 'Ctrl K',
  attach: 'Joindre…',
  attachTitle: 'Joindre des images, des fichiers ou le texte sélectionné (aussi : glisser-déposer, Ctrl+V)',
  removePiece: 'Retirer',
  zoom: 'Agrandir',
  settingsTitle: 'Réglages',
  settingsCategories: 'Catégories',
  settingsCategory: {
    dictation: 'Dictée', speech: 'Lecture à voix haute', interface: 'Interface', actions: 'Actions', agents: 'Agents', general: 'Général',
  } as Record<SettingsCategory, string>,
  settingLabel: {
    lang: 'Langue de dictée', vocabulary: 'Vocabulaire', sound: 'Bip de début / fin',
    muteOthers: 'Couper le son des autres applications pendant la dictée',
    discordMute: 'Autoriser la coupure du micro Discord',
    speakLang: 'Langue du texte', 'speakVoice:fr': 'Voix française', 'speakVoice:en': 'Voix anglaise', speakVolume: 'Volume',
    vibeLang: 'Langue de l\'interface', agentLang: 'Langue de ce qu\'écrivent les agents',
    artifactTextMax: 'Taille au-delà de laquelle un artefact est tronqué (octets)',
    agentCommand: 'Commande de lancement', editorCommand: 'Éditeur', terminalCommand: 'Terminal',
    vibeCommandPrefix: 'Préfixe des commandes du projet et de gh',
    outsideAgents: 'Autoriser les agents extérieurs (un Claude Code lancé dans un terminal pilote le robot de son dossier)',
  } as Record<FixedSettingKey, string>,
  settingMic: 'Micro',
  settingMicDefault: 'Micro par défaut du système',
  settingMicUnnamed: 'Micro sans nom',
  settingInfo: { whisperModel: 'Modèle whisper', agentFound: 'Claude Code', editor: 'Éditeur', version: 'Version' } as Record<SettingsInfo, string>,
  settingInfoValue: {
    agentMissing: 'Claude Code introuvable', editorMissing: 'Aucun éditeur trouvé', whisperMissing: 'whisper non installé',
    downloading: (percent: number) => `téléchargement ${percent} %`,
  },
  settingRun: {
    installTts: 'Installer Pocket TTS (~400 Mo)', restoreSound: 'Rétablir le son et le micro Discord (dépannage)',
    whisperDir: 'Ouvrir le dossier whisper', configFile: 'Modifier la configuration (vocabulaire…)',
    instructions: 'Modifier la consigne des agents (résumé audio)…', journal: 'Ouvrir le journal des agents (tours, autorisations)',
    vibeDir: 'Dossier de VibeCoder', releases: 'À propos : page de la version', quit: 'Quitter',
  } as Record<SettingsCommand, string>,
  tags: { toi: 'pour toi', agent: 'pour l\'agent' } as Record<Tag, string>,
  levels: { important: 'important', secondary: 'secondaire' },
  paletteHint: 'Un agent, une branche, une PR, une action…',
  paletteScopes: { all: 'Tout', agents: 'Agents', branches: 'Branches', prs: 'PR' },
  paletteGroups: { branches: 'Branches', prs: 'Pull requests', actions: 'Actions' },
  activity: {
    working: 'travaille', asking: 'attend ta réponse', done: 'vient de finir', failed: 'en échec', idle: 'au repos',
  } as Record<AgentActivity, string>,
  paletteActions: {
    'new-agent': { label: 'Nouvel agent…', keys: 'Ctrl+N' },
    'create-branch': { label: 'Créer une branche…', keys: '' },
    branches: { label: 'Gérer les branches et les PR…', keys: 'Ctrl+Maj+B' },
    stash: { label: 'Mettre de côté les changements', keys: '' },
  } as Record<PaletteAction, { label: string; keys: string }>,
  heldBy: (agent: string) => `tenue par ${agent}`,
  // Les indications au bout d'une ligne de la palette (vue C).
  paletteHere: 'actuel',
  branchHere: 'branche actuelle',
  branchHeld: 'ouverte dans un worktree → aller à l\'agent',
  branchFree: 'Entrée : basculer ici · ⇧ Entrée : vue des branches',
  prHeld: 'ouverte dans un agent → aller',
  // L'aide des touches au pied de la palette : [touche, ce qu'elle fait] ; la dernière, à droite.
  paletteKeys: [['Entrée', 'aller / basculer ici'], ['⇧ Entrée', 'branche libre : vue des branches'], ['Tab', 'portée suivante'], ['Échap', 'fermer']] as [string, string][],
  noResult: 'Aucun résultat',
  // Les robots des agents dans l'en-tête (agent-notices), + Nouvel agent.
  agentsLabel: 'Agents',
  addAgent: 'Nouvel agent (Ctrl+N)',
  // Le micro et Envoyer d'un champ (prompt-tools) : maintenu, on dicte dans ce champ.
  micHold: 'Dicter (maintenir appuyé)',
  micRecording: 'Enregistre…',
  micTranscribing: 'Transcrit…',
  sendField: 'Envoyer',
  // « Étape … · état » d'un agent (palette).
  agentStatus: (step: string | null, activity: string) => (step ? `Étape ${step} · ${activity}` : activity),
  // Les tâches de fond d'un agent au repos (infobulle du robot, palette), et le bouton qui cite un élément à l'agent (relecteur, T-22).
  tasksWatch: (n: number) => `surveille ${n} tâche${n > 1 ? 's' : ''} de fond`,
  askAgent: 'Poser une question à l\'agent',
  history: 'Historique des conversations',
  historyBack: '← Conversation en cours',
  welcomeTitle: 'Aucun agent',
  welcomeText: 'Crée un agent pour commencer à travailler sur un dépôt.',
};

export type Strings = typeof fr;

const en: Strings = {
  locale: 'en-GB',
  steps: {
    note: 'Note', forme: 'Shape', invariants: 'Invariants', modules: 'Modules', revue: 'Review', pr: 'PR',
  },
  stepStatus: { done: 'done', current: 'in progress', todo: 'to do' },
  ideView: 'IDE view', listView: 'List view', structure: 'Structure', code: 'Code',
  noChange: 'the branch does not change this module',
  reviewer: 'Reviewer',
  reviewerTitle: 'You are reviewing someone else\'s PR: nothing is editable here. Assign the PR to yourself, in the PR step, to change it.',
  screenTitle: 'Review on screen',
  refresh: 'Refresh now (repository, note, outputs)',
  reloadUi: 'Reload the interface',
  reloadUiTitle: 'The pages were rebuilt: reload the window with them. The main process and the agents keep going.',
  restartApp: 'Restart',
  restartAppTitle: 'The main process was rebuilt: relaunch the app (the pages alone would not do). If agents are working, the app asks first.',
  close: 'Close',
  branch: (branch, base) => `Branch ${branch}, compared with ${base}`,
  branchesOpen: 'Open the branch view: PRs, local branches, create a branch',
  branchesClose: 'Close the branch view',
  journey: 'Journey',
  commitsOf: (n) => (n > 1 ? `${n} commits` : n ? '1 commit' : 'no commit'),
  conversation: 'Conversation',
  shortcut: (n) => `Ctrl+${n}`,
  rerun: 'Run again',
  errorHint: 'The conversation is still usable, on the right.',
  broken: 'This step cannot be displayed.',
  retry: 'Retry',
  openTitle: 'Open in the editor',
  quote: 'Quote in the field',
  save: 'Save',
  saveTitle: 'Save to disk (Ctrl+S)',
  changedOnDisk: 'The file changed on disk',
  discard: 'Discard',
  discardTitle: 'Restore the text on disk',
  tooBig: 'File too big to display (over 1 MB) or unreadable.',
  ago: (ms) => (ms < 60000 ? 'just now' : ms < 3600000 ? `${Math.floor(ms / 60000)} min ago`
    : ms < 86400000 ? `${Math.floor(ms / 3600000)} h ago` : `${Math.floor(ms / 86400000)} d ago`),
  outputs: {
    'questions.md': 'Open questions', 'align.md': 'Alignment note · shape · invariants', 'review.md': 'Diff review',
    'commit.md': 'Proposed commit', 'checks.json': 'Checks', 'ponytail.md': 'Ponytail review', 'pr.json': 'Opened PR',
    'ci.md': 'CI', 'pr-#.json': 'Loaded PR', 'pr-#-note.md': 'Note review',
    'pr-#-commits.md': 'Commits review', 'pr-#-review.json': 'Published review',
  },
  needText: 'First dictate or write your request in the field, then click.',
  sendFailed: 'The action was not sent.',
  stop: '⏹ Stop',
  stopTitle: 'Stop the agent\'s current turn (as Interrupt in its menu)',
  convShow: 'Show the conversation',
  convHide: 'Hide the conversation',
  convResize: 'Width of the conversation (drag, or left and right arrows)',
  diffTitle: 'Open this commit\'s diff in the editor',
  githubTitle: 'Open this commit\'s page on GitHub',
  files: (n) => (n > 1 ? `${n} files` : n ? '1 file' : 'no file'),
  commentAdd: 'Add to the draft',
  commentSave: 'Save',
  commentCancel: 'Cancel',
  commentHint: 'Esc cancels · Ctrl+Enter saves',
  commentPlaceholder: 'Your remark…',
  model: 'Model',
  effort: 'Effort',
  mode: 'Mode',
  modelTitle: 'The agent\'s model, as in its menu',
  effortTitle: 'The agent\'s effort, as in its menu',
  runProgress: (p) => progressParts(p, {
    wave: 'wave', modules: 'modules', fixes: (n) => `${n} fix${n > 1 ? 'es' : ''}`, opus: 'Opus retry',
  }),
  modeTitle: 'The agent\'s mode, as in its menu',
  models: [['', 'default'], ['fable', 'Fable (pricier)'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']],
  efforts: [['', 'default'], ['low', 'low'], ['medium', 'medium'], ['high', 'high'], ['xhigh', 'extra high'], ['max', 'max']],
  modes: [['default', 'manual'], ['acceptEdits', 'accept edits'], ['auto', 'auto'], ['plan', 'plan']],
  context: 'Context',
  contextTitle: 'Conversation context: click for the detail',
  tasksOf: (running) => (running ? `Tasks (${running})` : 'Tasks'),
  tasksTitle: 'The agent\'s background tasks',
  procsOf: (running) => (running ? `Processes (${running})` : 'Processes'),
  procsTitle: 'The commands that start the project (server, front, services): started by the app, stopped when it quits',
  runsOf: (live) => (live ? `Actions (${live})` : 'Actions'),
  runsTitle: 'The started actions, each in its own conversation, beside this one',
  runsRunning: (n) => `${n} action${n === 1 ? '' : 's'} running`,
  noRuns: 'No action started.',
  runState: {
    running: 'running', asking: 'awaiting a permission', stopped: 'stopped — keep or undo', done: 'done',
    failed: 'failed', kept: 'kept', undone: 'undone',
  },
  runFor: (d) => `for ${d}`,
  runStopTitle: 'Stop this action (then choose to keep or undo what it wrote)',
  runReply: 'Its reply',
  runAsks: 'Asks',
  allow: 'Allow', allowTitle: 'Allow this time',
  always: 'Always', alwaysTitle: 'Allow, and stop asking for this tool',
  deny: 'Deny', denyTitle: 'Deny: the action goes on without',
  keep: 'Keep', keepTitle: 'Keep what the action already wrote',
  undo: 'Undo', undoTitle: 'Put the files it wrote back as they were (and only those)',
  fieldHint: 'Dictate or type the request here, then click the action: it goes with it.',
  ponytailWithChecks: 'Started with the checks.',
  vibeStop: 'Stop Vibe',
  vibeStopTitle: 'The running action finishes, the next one does not start',
  changed: (n) => `${n} file${n === 1 ? '' : 's'} changed`,
  at: (time) => `read at ${time}`,
  artifacts: 'Artifacts',
  artifactsTitle: 'The documents outside the project, shared by all its agents: wireframes, PDFs, slides…',
  artifactsNone: 'No artifact in this project: ask the agent for a document (wireframe, PDF, slides…), it makes it here.',
  artifactCopy: 'Copy to project',
  artifactCopyTitle: 'Copy the selection to a chosen folder',
  artifactMenu: {
    rename: 'Rename', trash: 'Delete', copy: 'Copy', cut: 'Cut', paste: 'Paste', duplicate: 'Duplicate',
    newFile: 'New file', newFolder: 'New folder',
  },
  artifactCollapseAll: 'Collapse all',
  nameProblem: {
    empty: 'The name is empty.', dots: 'This name is not allowed (. or ..).', separator: 'No / or \\ in a name.',
    hidden: 'A folder does not start with a dot: it would be hidden.', long: 'Name too long (255 bytes at most).',
    windows: 'Name refused: no : * ? " < > |, no trailing space or dot, no Windows reserved name (CON, NUL…).',
    taken: 'This name is already taken.',
  },
  artifactConfirm: (n, name) => (n > 1 ? `Delete these ${n} items?` : `Delete "${name}"?`),
  artifactConfirmHint: 'They go to the system trash: they can be recovered there.',
  artifactConfirmNo: 'Cancel',
  artifactTruncated: 'File truncated: Open in the editor shows the rest.',
  artifactUnreadable: 'Unreadable file.',
  agentTitle: (title, pr) => (title === 'pr' ? `PR #${pr}` : title === 'worktree' ? 'worktree' : 'main folder'),
  pickerClick: 'Find an agent',
  pickerMenu: 'Right-click: the agent menu',
  search: 'Search',
  searchKeys: 'Ctrl K',
  attach: 'Attach…',
  attachTitle: 'Attach images, files or the selected text (also: drag and drop, Ctrl+V)',
  removePiece: 'Remove',
  zoom: 'Enlarge',
  settingsTitle: 'Settings',
  settingsCategories: 'Categories',
  settingsCategory: {
    dictation: 'Dictation', speech: 'Read aloud', interface: 'Interface', actions: 'Actions', agents: 'Agents', general: 'General',
  },
  settingLabel: {
    lang: 'Dictation language', vocabulary: 'Vocabulary', sound: 'Start / end beep',
    muteOthers: 'Mute other applications while dictating',
    discordMute: 'Allow muting the Discord microphone',
    speakLang: 'Text language', 'speakVoice:fr': 'French voice', 'speakVoice:en': 'English voice', speakVolume: 'Volume',
    vibeLang: 'Interface language', agentLang: 'Language of what the agents write',
    artifactTextMax: 'Size beyond which an artifact is truncated (bytes)',
    agentCommand: 'Launch command', editorCommand: 'Editor', terminalCommand: 'Terminal',
    vibeCommandPrefix: 'Prefix of the project commands and gh',
    outsideAgents: 'Allow outside agents (a Claude Code started in a terminal drives its folder\'s robot)',
  },
  settingMic: 'Microphone',
  settingMicDefault: 'System default microphone',
  settingMicUnnamed: 'Unnamed microphone',
  settingInfo: { whisperModel: 'Whisper model', agentFound: 'Claude Code', editor: 'Editor', version: 'Version' },
  settingInfoValue: {
    agentMissing: 'Claude Code not found', editorMissing: 'No editor found', whisperMissing: 'whisper not installed',
    downloading: (percent) => `downloading ${percent} %`,
  },
  settingRun: {
    installTts: 'Install Pocket TTS (~400 MB)', restoreSound: 'Restore the sound and the Discord microphone (troubleshooting)',
    whisperDir: 'Open the whisper folder', configFile: 'Edit the configuration (vocabulary…)',
    instructions: 'Edit the agents\' instructions (audio summary)…', journal: 'Open the agents\' journal (turns, permissions)',
    vibeDir: 'VibeCoder folder', releases: 'About: the version page', quit: 'Quit',
  },
  tags: { toi: 'for you', agent: 'for the agent' },
  levels: { important: 'important', secondary: 'secondary' },
  paletteHint: 'An agent, a branch, a PR, an action…',
  paletteScopes: { all: 'All', agents: 'Agents', branches: 'Branches', prs: 'PRs' },
  paletteGroups: { branches: 'Branches', prs: 'Pull requests', actions: 'Actions' },
  activity: {
    working: 'working', asking: 'waiting for your answer', done: 'just finished', failed: 'failed', idle: 'idle',
  },
  paletteActions: {
    'new-agent': { label: 'New agent…', keys: 'Ctrl+N' },
    'create-branch': { label: 'Create a branch…', keys: '' },
    branches: { label: 'Manage branches and PRs…', keys: 'Ctrl+Shift+B' },
    stash: { label: 'Stash the changes', keys: '' },
  },
  heldBy: (agent) => `held by ${agent}`,
  paletteHere: 'current',
  branchHere: 'current branch',
  branchHeld: 'open in a worktree → go to the agent',
  branchFree: 'Enter: switch here · ⇧ Enter: branches view',
  prHeld: 'open in an agent → go',
  paletteKeys: [['Enter', 'go / switch here'], ['⇧ Enter', 'free branch: branches view'], ['Tab', 'next scope'], ['Esc', 'close']],
  noResult: 'No result',
  agentsLabel: 'Agents',
  addAgent: 'New agent (Ctrl+N)',
  micHold: 'Dictate (hold)',
  micRecording: 'Recording…',
  micTranscribing: 'Transcribing…',
  sendField: 'Send',
  agentStatus: (step, activity) => (step ? `Step ${step} · ${activity}` : activity),
  tasksWatch: (n) => `watching ${n} background task${n > 1 ? 's' : ''}`,
  askAgent: 'Ask the agent',
  history: 'Conversation history',
  historyBack: '← Current conversation',
  welcomeTitle: 'No agent',
  welcomeText: 'Create an agent to start working on a repository.',
};

const STRINGS: Record<VibeLang, Strings> = { fr, en };

export function t(lang: VibeLang): Strings { return STRINGS[lang] || fr; }

// Une taille de fichier en clair, dans la langue de l'écran : 512 o, 1,5 Ko, 10 Mo (512 B, 1.5 KB, 10 MB).
const UNITS: Record<VibeLang, string[]> = { fr: ['o', 'Ko', 'Mo', 'Go'], en: ['B', 'KB', 'MB', 'GB'] };
export function fileSize(bytes: number, lang: VibeLang): string {
  let n = Math.max(0, bytes), i = 0;
  while (n >= 1024 && i < 3) { n /= 1024; i++; }
  return `${n.toLocaleString(t(lang).locale, { maximumFractionDigits: i ? 1 : 0 })} ${(UNITS[lang] || UNITS.fr)[i]}`;
}

// Une durée en clair, la même dans les deux langues : 12 s, 3 min, 2 h 05.
export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
}
