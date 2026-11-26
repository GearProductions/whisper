# Whisper — spécification de comportement

Comportement de l'appli (état de la **0.4.0**, inchangé en **0.5.0**, où les
pages et le principal passent en TypeScript, les pages en React ; corrections
de la **0.5.1** ; nouveautés de la **0.6.0** ; processus des agents refait et
volet des tâches de fond en **0.7.0** ; VibeCoder, le flow du guide en un
écran, en **0.8.0** ; une fenêtre classique qui ne contient que VibeCoder,
au design de la vue C, en **0.14.0** : plus d'icône flottante, de bulle ni de
dictée collée au curseur) : ce qu'elle fait, ce qu'elle ne doit
jamais faire, et comment le vérifier. C'est la référence de la refonte : une
migration est réussie quand chaque règle ci-dessous tient encore.

- **F-…** : une fonctionnalité, telle qu'elle se comporte aujourd'hui.
- **I-…** : un invariant — ce que l'appli ne doit **jamais** faire. Une
  migration qui en casse un est une régression, même si « tout marche ».
- **S-…** : un scénario de non-régression, à rejouer avant de fusionner.

Le README reste le mode d'emploi (pour l'utilisateur) ; ce document est le
contrat (pour qui modifie le code). Un changement de comportement met à jour
les deux.

---

## 1. Architecture actuelle

### Processus et fenêtres

Une seule fenêtre, depuis la **0.14.0** (`docs/tickets/feat/0.14.0-refonte-vibecoder.md`) :

| Fenêtre | Page (`src/renderer/`) | Pont | Focus | Rôle |
|---|---|---|---|---|
| **Panneau** (la fenêtre de l'appli) | `app/panel/` (`panel-app.tsx`) | `src/preload/panel.ts` | oui ; jamais pris quand elle se montre d'elle-même (F-64) | l'écran VibeCoder de l'agent affiché (§ 7 bis), sa conversation en colonne ; le micro de chaque zone de prompt, *Écouter* ; l'accueil sans agent |

Ce document l'appelle encore **le panneau**, comme le code (`app/panel`,
`state.panel`) : c'est la fenêtre de l'appli. Plus d'icône flottante ni de
bulle (retirées en 0.14.0).

Les pages sont en React + TypeScript, construites par Vite dans
`out/renderer/` et chargées en `file://`, rangées en `app/` (la fenêtre),
`core/` (métier), `helpers/`, `technicals/` (ponts, micro, DOM). Le contrat
du pont (types et canaux) est dans `src/shared/bridge` ; seul `panel-app.tsx`
connaît le pont. Découpage et règles : `AGENTS.md`,
`docs/tickets/refactor/0.5.0-front-react.md` et `0.5.0-main-typescript.md`.

VibeCoder dans le panneau (`docs/tickets/feat/0.8.0-vibecoder.md`) :

| Module (`src/renderer/`) | Rôle |
|---|---|
| `core/vibecoder` | pur : Markdown en blocs (jamais de HTML, liens `http(s)` seuls, I-40), lignes changées (`lineDiff`) et lignes retirées avec leur place (`removedGroups`, `placeRemoved`), coloration du pseudo-code des lectures (`highlight`), ce que cite le *Commenter* de chaque bloc (`blockQuotes`, F-104), les lignes entières d'une sélection (`codeBlock`, F-98), libellés FR et EN |
| `app/panel/vibecoder/` | l'écran (en-tête de la vue C : les robots des agents, `agent-notices`, la palette Ctrl+K, `palette`, F-92 ; l'accueil sans agent, `no-agent` ; fil d'Ariane des étapes, vues des étapes et leurs actions, conversation, actions lancées, tâches et processus en onglets, barre des skills, barre d'état ; `settings-view` : la page des réglages, § 8 ; `prompt-field` : le seul composant de saisie d'un champ où l'on écrit à un agent — trombone, pièces, zone de texte, micro et *Envoyer*, F-68, F-69 ; `prompt-tools` : le micro et *Envoyer* de chaque zone de prompt, F-68 ; `code-view` : le code d'un fichier, numéroté, coloré, éditable, F-113 ; `module-code` : *Voir le code* d'un module, F-100 ; `note-editor` : la note éditable, F-104 ; `file-draft` : la modification gardée d'un fichier suivi, *Enregistrer*, *Abandonner*, partagée par les trois) ; ne connaît pas le pont : `panel-app.tsx` lui passe ses rappels et la colonne de la conversation |
| `technicals/codemirror` | les réglages de CodeMirror 6, sans métier : le langage d'un fichier et la coloration (`languageFor`, `codeHighlight`, F-113), le Markdown mis en forme au fil de la frappe, liseré, pastilles et boutons en gouttière (`live-markdown`, F-104) |
| `core/switcher` | pur : la palette Ctrl+K (`paletteItems`, portées, `pick` : ce que fait Entrée ou Maj+Entrée), les raccourcis (`shortcut` : Ctrl+K, Ctrl+Tab, Ctrl+N, Ctrl+Maj+B ; `recent`, `lastShown`), les robots de l'en-tête (`agentWhere`, `treeMark`, `signalKeys` : ce qui vient d'apparaître et bipe, F-55) |
| `core/ui` | le thème de la vue C (`theme.css` : les couleurs en variables, les ombres, les polices Inter et JetBrains Mono embarquées dans `fonts/`, F-92) |

Sans cadre du système (l'en-tête de VibeCoder sert de barre de titre, les
boutons de la fenêtre sont ceux d'Electron, F-63), dans la barre des tâches,
`contextIsolation`, `sandbox`, préchargement minimal (`contextBridge`). Le
principal (`src/main/`) est le seul à lire la config, lancer des processus.

### Modules du principal (`src/main/`, construit dans `out/main/`)

| Module | Rôle |
|---|---|
| `app/lifecycle` | démarrage (une instance, le socket, la fenêtre, l'agent affiché la dernière fois, permissions), sortie (dont les processus du projet, F-111, et le socket : `live.json` supprimé, F-116) |
| `app/windows` | la fenêtre (`panel-window`) : la créer, la montrer sur un agent, son message en tête |
| `app/controllers` | dictée (coupures, transcription rendue à la page, modèle), lecture d'une réponse, agents (les robots de l'en-tête, les notifications du système), familles (`worktrees.ts` : le rattachement par git, *Ouvrir un agent ici*, le robot d'une PR, l'enfant d'une nouvelle demande, le retrait d'un worktree et de son robot, F-51, F-110 ; `artifacts.ts` : le dossier d'artefacts du projet, son relevé, ce qu'on y ajoute ou en copie, F-95 ; `artifact-migration.ts` : les anciens artefacts déplacés vers ce dossier au démarrage, F-95), contenu du panneau, VibeCoder (`vibecoder.ts` : relevé, actions, réglages, validations, brouillon de revue, fichier à ouvrir ; `processes.ts` : les commandes du projet, F-111 ; `recipe.ts` : la recette du projet — préparer, créer et retirer un worktree —, lancée par l'appli, F-111 ; `runs.ts` : les courses — lancées, suivies, arrêtées, gardées ou annulées, chacune avec le module qu'elle génère —, leur avis de fin à la conversation, la file d'attente des demandes des agents, la fin d'une course attendue (`run.wait`), F-115 ; `module-code.ts` : le fichier suivi — celui de *Voir le code*, la note ou un test d'invariant —, lu, surveillé, poussé, enregistré au geste, F-100 ; `commands.ts` : `runCommand`, le mince branchement de l'exécuteur pour un robot, et `commandFromSocket`, qui appelle (l'écran, un robot, un agent extérieur), sur quel robot et par quelle porte, la file d'attente, F-116 ; `socket.ts` : les portes — `openSocket` (écoute avec la table des jetons, écrit `live.json`), `closeSocket`, `robotToken`, `robotAccess`, `forgetRobot` (le jeton d'un robot, en mémoire), `writeLive` (`live.json`, le jeton extérieur), `screenSend` (une commande du contrat par le client TCP ; le jeton de l'écran ne sort pas d'ici), F-116, I-49 à I-56 ; `settings.ts` : la page des réglages — les faits qu'elle montre lus, une écriture contrôlée par `core/settings`, une de ses commandes lancée —, § 8) |
| `app/menus` | menus des robots, du « + », du trombone |
| `app/ipc` | la table de gestionnaires du panneau, écoutée par `technicals/ipc` |
| `core/config` | réglages, l'agent affiché (`agentSelected`), dossiers favoris et couleurs, confiance, la langue des agents (`agentLang`), le modèle et l'effort choisis par action (`actionPicks`, jamais Fable, I-36) |
| `core/settings` | la page des réglages, sans Electron ni disque (les faits lui sont passés) : ses réglages par catégorie (`SETTINGS`), la page (`settingsView`), ce qu'elle peut écrire (`settingsPatch`, I-48) et ses commandes (§ 8) |
| `core/dictation` | l'enregistrement reçu vérifié (`checkAudio` : trop court, silence, F-4), la transcription d'une ligne (`cleanTranscript`), ses messages |
| `core/sound` | couper et rétablir ce qu'on a coupé |
| `core/switcher` | les agents de l'en-tête et de la palette, sans Electron ni disque : par dépôt, chacun son titre, sa branche, son étape, son état (`switcherAgents`, `activityOf`) ; les questions et échecs d'un autre agent que l'affiché, pour une notification du système (`agentEvents`) |
| `core/family` | les familles d'agents sans Electron, git ni disque (passés) : le `parent` enregistré (`agentParent`, l'ancien `temp` compris), l'enfant créé (`childAgent`), la tête et les groupes affichés (`familyHead`, `familyGroups`), les rattachements d'après git (`familyLinks`, `childOf`, I-41), les worktrees (`parseWorktrees`, `branchOf`), le fichier du projet — celui du parent présent ; un enfant dont le parent est parti n'en a pas — et où tourne une commande, par le `parent` enregistré (`familyOwner`, `heldBy`, F-111) |
| `core/agents` | processus (un par entrée : l'agent, et chaque course `<agent>~<clé>`, F-115), tours, retour en arrière des fichiers d'une entrée (`rewind`, I-45), tâches de fond, file d'autorisations, interruption, sonde, transcriptions, sessions |
| `core/conversation` | actions et demandes d'autorisation écrites, pièces jointes, tâches de fond vues par le volet |
| `core/guards` | permissions des pages, liens, fichiers montrés |
| `core/repo` | page GitHub d'un dossier, d'après son remote `origin` |
| `core/vibecoder` | VibeCoder sans Electron ni disque (passés) : la note lue par ses titres, les tests et leurs cas, un fichier ou un commit désigné par son id (`safePath`, `itemPath`, `itemCommit`, `codeFile` : un fichier d'un module touché, ou de la branche), les actions et leurs messages (`parseActions`, `buildMessage`, `whoOf`, `skillModel`), le parcours (`vibeView`), le rôle (`role` : `vibeRole`, `canAssign`, `unassignable`, F-101), les choix de lieu d'après l'état du dossier (`place` : `placeShown`, `placeReason`, `onBase`, F-110), *Pull*, *Rebase*, *Pousser* (`sync` : `syncReason`, F-114), les sorties des skills, les fichiers par défaut (`syncDefaults`) et les variantes des skills (`skillVariants`), les validations et brouillons de revue, les courses (`runs` : `ownRun`, `runKey`, la règle `blockedBy`, le module qu'une course génère et le verrou de son code (`runModule`, `codeLock`), l'avis de fin, F-115), les ✓ des étapes passées en Vibe (`vibeMarks`) |
| `core/commands` | la table des commandes de VibeCoder (F-116), pure, sans Electron ni disque (le texte est donné) : `schema` (`JsonSchema`, `SCHEMA_KEYS`, `schemaError` : le sous-ensemble de JSON Schema de la table, sans bibliothèque), `table` (`parseCommands`, `AGENT_CLOSED` : la table lue et vérifiée), `reads` (`statusOf`, `nextOf`, `actionsOf`, `runsOf`, `procsOf`, `logsOf`, `artifactsOf`, `draftOf` : les lectures, d'après le relevé), `caller` (`robotAt`, `callerRobot`, `robotEnv` : qui appelle et sur quel robot, et l'environnement d'un robot ; les jetons, le serveur les a reconnus), `skill-text` (`skillArgs` : les lignes de la commande `vibecoder` des skills `actions` et `processus`), `execute` (`execute`, `ERROR_CODES` : l'exécuteur, une seule entrée, qui rend `{ ok, result }` ou `{ ok: false, error }` ; les écritures par des opérations injectées) ; utilisé par `app/controllers` (`commands`) |
| `core/runner` | les commandes du projet (F-111) : le fichier du projet, `<dossier du parent>/.vibecoder/project.json` (`projectPath`, la ligne de `.git/info/exclude` : `withExclude`), lu (`parseProject`), une proposition fusionnée dans le fichier existant (`mergeProject`), une commande par son rang (`commandAt` : shell du fichier, préfixe `commandPrefix` — celui du fichier, du réglage, ou la box de l'agent, le même pour `gh`), la fin d'un journal, la recette en étapes (`setupSteps`, `createSteps`, `removeSteps` ; la branche et la base par l'environnement, `recipeEnv` ; le dossier d'un worktree, `worktreeDir`) (I-42) |
| `technicals/process` | les processus lancés pour l'utilisateur : détachés, marqués dans leur environnement, arrêtés avec ce qu'ils ont lancé (SIGTERM, SIGKILL après 5 s), leur journal ; `writeNew` (I-43) ; une étape de la recette attendue jusqu'à sa fin (`runOnce` : l'entrée fermée, un délai, la dernière ligne utile) |
| `technicals/git` | git en lecture seule (`gitRun`, `gitReader`, `GIT_READ`, plus `worktree list`) : les faits d'une branche ou d'une PR chargée, un fichier à un ref, un commit et son diff, le commit où la branche part de sa base (`forkPoint`), les branches locales (`branches`), le retard sur `@{u}` et sur `origin/<base>` (`sync`) (I-39) |
| `technicals/github` | gh en lecture seule, derrière le préfixe (`ghRun`, `githubReader`, `GH_READ`, `GH_LOGIN`) : la PR d'une branche, les PR ouvertes du dépôt en trois listes (`openPrs`), l'état d'une PR, ses personnes (`prPeople` : auteur, assignés), l'identifiant de l'utilisateur (`login`, `okLogin`) (F-112, I-39) |
| `technicals/direct` | les actions directes (F-114, I-39) : `directRunner` → `commit`, `publish`, `sameRepo`, `loadPr`, `toBase`, `fetchBranch`, `pullBranch`, `switchTo`, `stash`, `pull`, `rebase`, `push`, `fetchAll`, `requestReview`, `assign`, `unassign`, le texte de `pr-<n>.json` (`prCardText`), une liste fermée de commandes (`DIRECT_GIT`, `DIRECT_GH`), 60 s, `direct.log` |
| `technicals/file-tree` | les artefacts copiés, écrits ou déplacés (F-95, I-37, I-39) : `copyInto`, `writeInto` (un contenu reçu), `moveContents`, `hasFiles` ; `fs.promises` seulement, un fichier à la fois, jamais écraser (`COPYFILE_EXCL`), un lien jamais suivi, sans limite de nombre ni de taille |
| `technicals/socket` | le socket TCP des portes : l'écran, les robots, un agent extérieur (F-116, I-49, I-50), qui ne connaît que `node:net`, `node:crypto` et son protocole : `protocol` (une enveloppe `{ cmd, args, token, target }` par ligne : `readLine` : le jeton cherché dans une table, rendu avec le nom de l'appelant, `writeLine`, `LINE_MAX`, `BAD_TOKEN`), `server` (`listen` : `127.0.0.1` seulement, un port libre, le jeton de l'écran tiré à chaque appel, les autres relus à chaque ligne — `drawToken` ; une réponse qui tarde, `run.wait`, garde la connexion ouverte), `client` (`send` : une connexion, une ligne, la réponse) ; ni la table ni l'exécuteur |
| `technicals/*` | `ipc` (expéditeur contrôlé), `whisper-cli`, `windows-helper`, `pipewire`, `pocket-tts`, `claude`, `editor` (un dossier, ou un fichier de VibeCoder, à une ligne ; le terminal d'un dossier, `findTerminal`), `journal`, `images`, `paths`, `config-file` |
| `helpers` | découper une commande, français ou anglais, une ligne, `async-queue` (l'entrée d'un processus d'agent), `numbered-name` (`rapport-2.md`) |

Scripts lancés par l'appli : `resources/scripts/` (`windows-helper.ps1`,
`pocket-helper.py`), livrés hors de l'archive comme les binaires. De même
`resources/vibecoder/` (`extraResources` → `vibecoder/`) : `README.md`,
`actions.fr.json`, `actions.en.json`, `plugin/` (`.claude-plugin/plugin.json`,
`skills/<nom>/SKILL.md`, `agents/developpeur.md`),
recopiés dans `userData/vibecoder/` (F-107).

### Canaux IPC

Un seul pont, celui du panneau (`PANEL_CHANNELS`, `src/shared/bridge/channels.ts`).
Vers le principal :

- le micro : `config:get`←, `config:setDevice`, `dictation:recording`,
  `dictation:transcribe`← (le PCM enregistré par la page ; réponse : le texte
  que whisper vient de rendre, que la page insère dans le champ, F-68) ;
- *Écouter* : `conv:speak`← (une réponse par son rang dans le fil ; le texte
  lu est le résumé retenu par le principal, I-3), `tts:cancel` ;
- les agents : `agent:show` (un agent par son id, jamais un chemin),
  `agent:menu` (son menu, F-56), `agent:add` (« + », F-52), `settings`←
  (la page des réglages : la lire, écrire un réglage, lancer une de ses
  commandes ; elle est rendue relue, § 8) ;
- la conversation : `conv:ready`, `conv:send`←, `conv:attach`,
  `conv:answer`, `conv:probe`←, `conv:history`←, `conv:open`,
  `conv:current`, `conv:resume`, `conv:openLink`, `conv:showFile` ;
- VibeCoder : `conv:vibeSet`
  (arrêter ou reprendre le moteur, le rythme *Express* (0.16.0, en mémoire), PR suivie, vue Modules, *Vu*, modèle, effort, mode,
  arrêter l'agent, le robot d'une PR dans son worktree), `conv:vibeMark` (✓, ✗
  ou oublier une cible), `conv:vibeDraft` (brouillon de revue : ajouter,
  modifier, retirer), `conv:vibeOpen` (un fichier ou un commit du relevé, par
  son id, et une ligne), `conv:vibeRefresh`, `conv:vibeProcess` (une
  commande du projet par son rang : lancer, arrêter, relancer, son journal ;
  ou le fichier du projet dans l'éditeur, F-111),
  `conv:vibeRun` (une action par son id et ses arguments — `direct` : par
  l'appli elle-même, F-114 —, avec réponse `{ ok, error }`),
  `conv:vibeDrop` (des fichiers déposés sur l'arborescence du panneau des artefacts,
  F-95 : leurs chemins, lus des `File` par le pont, et le dossier où ils tombent —
  l'id `d<i>` d'un dossier du dernier relevé, une chaîne ou rien : la racine, jamais
  un chemin ; réponse `{ ok, error }`, I-37),
  `conv:vibeRunOp` (une course par l'id de son action dans le dernier
  relevé : l'arrêter, la garder ou l'annuler, répondre à sa demande
  d'autorisation ; F-115), `conv:vibeFollow` (le fichier suivi — d'un module, par
  *Voir le code* ; la note ou un test d'invariant, en créateur ; un artefact
  en texte, F-95 —, par son id, ou `null` : plus aucun ; F-100),
  `conv:vibeSave` (l'enregistrer : son id et son texte, avec réponse `{ ok,
  error }` ; F-100, I-39).

Depuis la 0.15.0, les gestionnaires de `conv:vibeRun`, `conv:vibeRunOp`, `conv:vibeProcess`, `conv:vibeDrop` et
`conv:vibeDraft` sont les adaptateurs de l'écran : ils envoient la commande du
contrat par le socket (F-116) ; le pont, ses canaux et ce que la page reçoit ne
changent pas, et la page ne détient jamais un jeton (I-50, I-53).

(← : avec réponse.) Vers la page : `tts:chunk`, `tts:end` (l'audio d'*Écouter*),
`agents:state` (les agents de l'en-tête et de la palette, et l'agent
affiché), `conv:thread`, `conv:notice`, `conv:focusInput`, `conv:attached`,
`conv:vibe` (le relevé de l'agent affiché, ou `null`), `conv:vibeCode` (le fichier suivi :
son id, son texte — `null` : plus d'1 Mo ou illisible ; un artefact, coupé
à `artifactTextMax`, `truncated` —, l'heure ; à chaque
changement sur le disque ; ou `null`).

Le panneau n'est écouté que sur ses propres canaux, et un message d'un autre
expéditeur est ignoré (`technicals/ipc`, cf. I-20). Aucun canal ne colle, ne
copie ni ne lit un texte fourni par la page (I-2, I-3). Aucun canal de
VibeCoder ne transporte un chemin ni un message tout fait : une action, un
fichier se désignent par leur id dans le dernier relevé (I-37, I-38), sauf
`conv:vibeDrop`, dont le pont lit les chemins du `File` déposé, que la page
ne choisit pas (I-37) ; les seuls textes de la page qui touchent au disque
sont celui de `conv:vibeSave`, écrit tel quel dans le fichier suivi (I-39), et
le nom tapé d'un artefact (renommer, nouveau fichier ou dossier), un nom seul
que `conv:vibeRun` porte en argument d'une action directe (F-95, I-37) : aucun
canal de plus.

### Fichiers de données (`userData`)

| Fichier | Contenu |
|---|---|
| `config.json` | réglages (§ 9), relu à chaque usage |
| `whisper/` | modèle téléchargé (et whisper-cli posé à la main) |
| `pocket-tts/` | Python, Pocket TTS, PyTorch installés par uv |
| `consigne-agents.md` | consigne ajoutée au prompt système des agents |
| `agents.log` (`.old`) | journal des agents, 1 Mo puis rotation |
| `vibecoder/` | ce que VibeCoder fait dire, à retoucher (F-107) : `actions.fr.json`, `actions.en.json`, `commands.json` (la table, que lit la commande `vibecoder`), `plugin/` (le plugin `vibecoder` : skills, agents, `bin/vibecoder.mjs` — la commande, F-116 — ; `skills/<nom>--<modèle>/` et `--<modèle>--<effort>/`, les variantes générées, F-106), `README.md` ; `.defaults.json`, le manifeste de ce que l'appli y a écrit ; `projets/<dossier>.json`, l'ancien fichier du projet d'un dossier, d'avant la 0.12.0 (repris dans `.vibecoder/` du dossier, gardé ; F-111) |
| `vibecoder-out/<agent>/` | les sorties des skills pour l'écran (F-95) ; `branches/<branche>/`, celles d'une branche quittée, et `.branche`, la dernière branche vue ; `files/`, ce que l'appli écrit pour l'ouvrir dans l'éditeur, en lecture seule (`<hash>.diff`, F-101) ; `run/<nom>.log` (`.old`), les journaux des commandes du projet ; `artifacts/`, les anciens artefacts de l'agent, d'avant le dossier du projet : déplacés vers lui à chaque démarrage, le dossier vidé part (F-95) ; `recipe.log`, celui de la recette (F-111) ; `direct.log`, une ligne par commande d'une action directe, et `pr-<n>-review-body.md`, le brouillon publié (F-114) ; ni `actions.json` ni demandes `.start`, `.stop`, `.restart` depuis la 0.15.0 : la commande `vibecoder` les remplace (F-115) ; dossier de travail en plus de Claude Code (F-58) |
| `vibecoder-artifacts/<clé>/` | les artefacts d'un projet, partagés par le dépôt, ses worktrees et leurs robots (F-95) : la clé est le début (16 hexa) du sha1 du dossier git commun résolu, ou du dossier résolu hors git ; Claude Code le reçoit en dossier de travail en plus (F-58) ; retirer un agent, un robot ou un worktree n'y touche pas |
| `vibecoder-state.json` | validations (par agent) et brouillons de revue (par agent et par PR) |
| `live.json` | le fichier de découverte du socket (F-116) : `{ "port": …, "pid": … }`, plus `"token"` — le jeton extérieur — tant que le réglage *Autoriser les agents extérieurs* est activé (I-52) ; jamais le jeton de l'écran (I-50) ni celui d'un robot (I-51) ; droits 0600 ; écrit au lancement et à chaque changement du réglage, supprimé à la sortie (F-116) ; la version de dev et l'AppImage, qui ne tournent pas ensemble, s'y retrouvent |

En développement : `--user-data-dir=.data` (cf. LINUX_SETUP.md).

---

## 2. Dictée

Depuis la **0.14.0**, on dicte dans la fenêtre : chaque zone de prompt a son
micro (F-68). Plus d'icône flottante, plus de texte collé au curseur.

**F-1 Geste** *(retiré en 0.14.0 : le maintien et le glisser de l'icône)*.
On dicte en **maintenant** le bouton micro *Dicter* d'une zone de prompt
(F-68) : appuyé, l'enregistrement commence ; relâché, il finit. Le micro ne
prend pas le clavier : il le donne à son champ, où arrive la dictée.

**F-2 Position** *(retiré en 0.14.0 : la position et la taille de l'icône)*.

**F-3 Enregistrement.** Au maintien : `dictation:recording(true)`
(coupures, § 5), puis ouverture du micro (`deviceId`, retrouvé par son nom
s'il a changé, sinon le micro par défaut), 16 kHz mono, par la page. **Bip
aigu** (880 Hz) une fois le micro réellement ouvert, **bip grave** (520 Hz)
au relâché (réglage `sound`). Relâcher pendant l'ouverture du micro annule
proprement. Plafond : 5 min moins 5 s, coupé automatiquement. Le micro dit
sa phase (enregistre, transcrit) en infobulle.

**F-4 Silence.** Moins de 0,4 s ou énergie maximale < 0,008 RMS : rien n'est
envoyé à whisper (« Aucune parole détectée. ») — whisper invente du texte sur
du silence. Vérifié par la page, puis de nouveau par le principal sur le PCM
reçu (`checkAudio`), avant whisper : jamais de whisper sur du silence (S-3).

**F-5 Transcription.** `whisper-cli` local (langue `lang`, vocabulaire
`vocabulary` ≤ 300 car. en prompt, threads = cœurs, ≤ 8), délai 120 s. Le
texte sort sur **une seule ligne**, sans marqueurs `[BLANK_AUDIO]`, `[Musique]`.
Erreurs : `notInstalled`, `badAudio`, `timeout`, `failed`, chacune avec son
message dans la ligne d'état du champ de la conversation.

**F-6 Où va le texte.** `dictation:transcribe` rend le texte à la page, qui
l'insère dans la zone de texte qui a le clavier (un commentaire, la réponse
libre d'une question : § 7 bis, *La dictée*), sinon
dans le **champ de la conversation**, à la suite du brouillon (F-68). Rien
n'est collé ni envoyé : on relit, puis on envoie.

**F-7 Infobulle de l'icône** *(retiré en 0.14.0, avec l'icône)*.

**F-8 Modèle au premier lancement.** Si aucun modèle n'est trouvé (dossier de
l'appli, puis `resources/bin` du paquet, puis l'installation de Cockpit), le
modèle `ggml-large-v3-turbo-q5_0.bin` (548 Mo) est téléchargé dans
`whisper/` (fichier `.part` renommé à la fin, supprimé en cas d'échec).
Avancement en tête du panneau (F-74) et dans ⚙ Réglages (§ 8) ; dicter
pendant le téléchargement dit le pourcentage.

## 3. Collage et presse-papiers

*(Retiré en 0.14.0 : F-10 à F-13, le collage automatique au curseur, le
presse-papiers photographié et rendu, les outils de collage — wtype,
ydotool, xdotool, le Ctrl+V de l'assistant PowerShell (qui reste pour les
coupures du son, F-32). La dictée va dans les champs de la
fenêtre, F-6.)*

## 4. Bulle

*(Retiré en 0.14.0 : F-20 à F-23. Les messages de l'appli — « Micro Discord
coupé », téléchargement, installation de Pocket TTS, dépannage du son — vont
en tête du panneau, F-74 ; le volume de la lecture se règle dans ⚙ Réglages,
§ 8.)*

## 5. Coupure du son pendant la dictée

**F-30 Micro Discord** (`discordMute`, Linux et Windows) : le **flux de
capture** de Discord (reconnu à son binaire ou à son identifiant Flatpak),
pas le micro du système ni le bouton muet de Discord. « Micro Discord coupé »
s'affiche en tête du panneau (F-74) une fois la coupure **confirmée**
(relue), si l'on enregistre encore ; effacé à la fin de l'enregistrement.

**F-31 Autres applications** (`muteOthers`) : leurs **flux de lecture**, sauf
ceux des processus de l'appli (les bips restent audibles).

**F-32** Opérations en file (un relâché rapide attend la coupure). Linux :
PipeWire par `wpctl` ; Windows : sessions Core Audio par l'assistant.

**F-33 Flux disparu** (Linux) : WirePlumber retient la coupure d'une
application. Un flux coupé qui disparaît avant la fin de la dictée (vidéo
finie, onglet fermé) laisserait donc ses flux suivants muets : son
application reste « à rétablir » (`userData/sons-a-retablir.json`, gardé
d'un lancement à l'autre) et son prochain flux est rétabli dans les 5 s,
jamais pendant une dictée.

**F-34 Dépannage** (⚙ Réglages → *Rétablir le son et le micro Discord*, § 8,
Linux et Windows, grisé pendant une dictée) : rétablit ce que l'appli a
coupé, les applications « à rétablir », et tout flux encore coupé parmi la
lecture des autres applications et la capture de Discord. Le message en tête du
panneau dit combien de flux ont été remis en marche. Sous Windows : ce que l'assistant a coupé.

## 6. Lecture à voix haute

**F-40 Bouton ▶** *(retiré en 0.14.0 : le bouton accolé à l'icône, qui lisait
la sélection ou le presse-papiers ; on écoute les réponses des agents, F-46)*.

**F-41 Sources** *(retiré en 0.14.0, avec F-40 : seul le résumé retenu d'une
réponse est lu, F-46)*.

**F-42 Pocket TTS.** Absent : installé au premier *Écouter* (ou par ⚙ Réglages,
§ 8) dans `userData/pocket-tts` par `uv` (Python 3.12 géré, PyTorch
processeur, `pocket-tts==3.3.0`), cache supprimé après ; message en tête du
panneau (F-74). Une installation de l'utilisateur (`uv tool install`) sert
aussi.

**F-43 Processus Python permanent** : démarré à la **première lecture**
(chargement du modèle de la langue du texte, ~3 s), arrêté après 10 min sans
lecture. L'audio arrive par morceaux (PCM 16 bits, au volume réglé :
`speakVolume`, appliqué à la lecture suivante) et se joue bout à bout ; une
lecture annulée ignore ses morceaux tardifs.

**F-44 Langue** : `speakLang` `auto` (français ou anglais, compté sur le
texte entier ; indécis → français), `fr`, `en`. Voix par langue
(`speakVoices`) : Estelle, Mary, Marius / Jane, Anna, Alba.

**F-45** Commencer une dictée **arrête** la lecture (sinon le micro la capte).

**F-46 Réponse d'un agent** : ▶ *Écouter* d'une réponse du fil lit son
résumé audio (F-60). La page ne donne que le **rang** de la réponse
(`conv:speak`) : le principal lit le résumé qu'il a retenu, jamais un texte
de la page (I-3), et renvoie l'audio par `tts:chunk`, `tts:end`. Un nouvel
*Écouter* remplace la lecture en cours ; une erreur se dit dans la ligne
d'état du champ.

## 7. Agents Claude Code

### Robots, agent affiché, dossiers

**F-50 Activation** *(retiré en 0.14.0 : `agentsEnabled`)*. Les agents sont
toujours là : tous en robots tout à gauche de l'en-tête de VibeCoder, puis
« + » (F-92).

**F-51 Un agent = un dossier** (un seul agent par dossier) : `{ id, dir, name,
model, effort, mode, sessionId, contextWindow }`, `parent` (ci-dessous), et
pour VibeCoder `vibe` (§ 9). Nom = nom du dossier, modifiable dans
`config.json`.

**Familles** : les agents d'un même dépôt git. Le **parent** est l'agent à la
racine de la copie principale ; un **enfant**, un agent à la racine d'un
autre worktree du même dépôt (même `git rev-parse --git-common-dir`, résolu ;
un sous-dossier n'est jamais enfant, I-41). Git le reconnaît au lancement,
après « + » et à *Ouvrir un agent ici* (F-56) — pas le robot d'une PR, lié
à sa fiche, ni l'enfant d'une nouvelle demande, né de sa recette (F-110) ; il est retenu dans
`agents[].parent` (§ 9), qui survit au redémarrage : l'affichage, le menu et
les commandes du projet (F-111) ne lisent que lui. Un enfant est un agent
ordinaire (conversation, éditeur, VibeCoder) ; son robot s'affiche
**juste après** celui de son parent, plus petit ; affiché, son badge porte
« worktree » ou « PR #n » (F-110), et la palette le range sous son parent
(F-92). Il s'affiche de la couleur du parent ; né d'*Ouvrir un agent ici* ou d'une
PR, son dossier la prend aussi. Un
enfant sans PR ne part qu'à *Retirer*, ou avec son worktree (*Retirer le
worktree*, F-110) ; retirer le parent garde ses enfants
(des robots ordinaires, `parent` gardé), sauf le robot d'une PR, qui part
avec lui (F-110). Retirer un agent, un robot ou un worktree ne touche pas
aux artefacts : ils sont ceux du projet, dans un dossier commun au dépôt, à ses
worktrees et à leurs robots (F-95).

**F-52 « + »** : *Nouvel agent dans un dossier favori* (dossiers déjà choisis
sans agent), *Choisir un autre dossier…*, *Oublier un dossier favori* ;
entrées grisées si Claude Code est introuvable. Un dossier **jamais choisi**
passe par la confirmation de confiance (I-23). Le nouvel agent est
affiché. Aussi *Nouvel agent…* de la palette et Ctrl+N (F-92). Un agent né sur un
dossier retrouve les artefacts de son projet (F-95).

**F-53 Couleur par dossier** : tirée au hasard parmi 8 (de préférence une
couleur libre), enregistrée, gardée si l'agent est retiré puis recréé ;
modifiable au clic droit. Son robot la porte, éclaircie (F-92).

**F-54 Clic sur un robot** (en-tête, F-92) : l'agent **s'affiche** aussitôt
— son écran VibeCoder et sa conversation —, sans aperçu ; il devient l'agent
sélectionné (`agentSelected`, retrouvé au lancement, F-80). Clic sur le
badge de l'agent affiché : la palette, portée *Agents*. Ctrl+Tab : l'agent
affiché juste avant. L'agent affiché retiré : le premier qui reste prend sa
place, sinon l'accueil (*Nouvel agent…*).

**F-55 État d'un robot** : clignote au travail ; « ? » : il me faut ta réponse
(une demande d'autorisation de la conversation, ou le questionnaire de l'agent,
`<sorties>/questions.md`, qui a une question sans réponse envoyée ; jusqu'à la
réponse, le questionnaire vide l'éteint) ; il prime sur « ! » et sur la
pastille verte : une course finie qui a écrit des questions montre le « ? » ;
pastille verte quand il a fini (réponse non lue) ; « ! » en échec (erreur). Chacun,
quand il apparaît, avec le **bip** de la réponse (660 Hz, réglage *Bip*),
joué par la fenêtre, seulement pour ce qui vient d'apparaître chez un autre
agent : quitter un agent ne fait jamais sonner ce qu'on avait sous les yeux
(`beepFor` retient les signaux de tous les agents, l'affiché compris).
Jamais pour l'agent affiché, dont la réponse est **lue d'office** (ni pastille
ni bip) : l'afficher, ou lire sa conversation, marque aussi ses courses
*finies* comme vues (la pastille verte s'efface) ; une course *en échec* garde
son « ! » jusqu'à l'ouverture de l'onglet *Actions*. Ses **courses** (F-115) aussi, par-dessus
une conversation au repos (l'état de la conversation d'abord), dans cet
ordre (ce qui attend l'utilisateur prime sur ce qui travaille seul) :
*en cours* → le clignotement d'un tour,
sans bip, *en échec* → « ! », *finie* → pastille verte ; une course
*arrêtée* ne se signale pas. Infobulle : « dépôt · branche », le titre d'un
enfant, l'état (*travaille*, *attend ta réponse*, *vient de finir*, *en
échec*, *au repos*), la question. Au repos, un agent qui a
des **tâches de fond** — celles de sa conversation et celles de ses courses
vivantes (F-77, F-115) — pulse lentement (2 s) ; l'infobulle dit « surveille n
tâche(s) de fond », la palette aussi à la place de « au repos ». Un sous-agent ou une commande lancés en fond ne font pas *travailler* l'agent : son tour fini, il reste joignable, seul un message de l'agent lui-même (une notification qui le réveille) ouvre un nouveau tour, pas ceux d'un sous-agent (note 0.15.0-stabilisation). L'onglet *Actions (n)* de
l'agent efface *finie* et *en échec* (F-92) ; le « ? » reste jusqu'à la
réponse. Pas de bandeau ni d'étiquette de notification dans l'en-tête ;
fenêtre sans le focus : une **notification du système** pour la question ou
l'échec d'un autre agent que l'affiché (un clic l'affiche).

**F-56 Clic droit sur un robot** (en-tête, F-92 ; *◧ Ouvrir VibeCoder*, *💬 Ouvrir la conversation*, *Dernier échange* et *⤢ Conversation complète* retirés en 0.14.0) : nom, dossier ; *Ouvrir sur GitHub —
propriétaire/dépôt* (remote `origin` du `.git` du dossier, lu à chaque clic
droit ; grisé sans origine GitHub) ; *Ouvrir dans l'éditeur (zed)*
(`editorCommand`, sinon le premier trouvé parmi zed, code, cursor, codium,
dans une nouvelle fenêtre ; grisé sans éditeur) ; *Ouvrir un terminal ici
(konsole)* : le terminal du système dans le dossier de l'agent
(`terminalCommand`, § 9, découpé comme `agentCommand`, F-58, guillemets
respectés, `{dir}` remplacé par le dossier comme un argument entier — ex.
`konsole --workdir {dir}`, `konsole --workdir {dir} -e distrobox enter dev`,
`wt.exe -d {dir}` ; vide : le premier trouvé, Linux konsole, gnome-terminal,
kitty, alacritty, wezterm, xterm, Windows `wt` (`-d <dossier>`), sinon
`cmd`), lancé dans le dossier, détaché, jamais par un shell (I-27) ; grisé
sans terminal ; *✎ Écrire un message…*
(l'agent affiché, le clavier au champ de la conversation) ; couleur du dossier (pas pour un enfant : celle
de son parent) ; modèle (défaut, fable, opus,
sonnet, haiku) ; effort (défaut, low → max) ; mode (manuel, accepter les
modifications, auto, plan) ;
*Interrompre* (au travail) ; *Nouvelle session* (oublie la session) ; *Retirer*
(ses commandes lancées s'arrêtent ; le dossier reste favori). Pour un
agent sans parent à la racine d'un dépôt,
le sous-menu *Worktrees* : les worktrees du dépôt sans agent (`git worktree
list`, relu à chaque clic droit ; git sans réponse en 1 s : pas de
sous-menu), « <branche> — <dossier court> » (détaché :
le nom du dossier), chacun avec *Ouvrir un agent ici* — un enfant (F-51) nommé
par sa branche, après la question de confiance pour un dossier jamais choisi
(I-23, I-41) ; aucun : « Aucun worktree sans agent », grisé.

**F-57 Mode et modèle changés en cours de tour ou entre deux tours**
s'appliquent aussitôt, sans relancer le processus (F-59) ;
passer en *Accepter les modifications* accorde les demandes de modification de
fichier en attente.

### Tours

**F-58 Lancement** : le Claude Code **de l'utilisateur** (`agentCommand`, vide
→ `claude` trouvé dans PATH ou `~/.local/bin`). Commande personnalisée
(« distrobox enter dev -- mise exec -- claude ») : découpée (guillemets
gérés), les arguments du SDK passent derrière, stdin/stdout tels quels.
Options : `cwd` = dossier, réglages `user`, `project`, `local`, préréglage
`claude_code` + la consigne de `consigne-agents.md`, suivie de la ligne
VibeCoder du questionnaire (une réponse aux questions de la note donnée
dans la conversation → la note, puis `<sorties>/questions.md` réécrit :
les skills de VibeCoder ne s'y chargent jamais d'eux-mêmes), de celle du rôle
(créateur ou relecteur) et, pour un créateur, de celle du parcours : développer
par VibeCoder d'office — une modification du code part d'une note (l'action
`note`) et passe par les actions de l'écran, lancées par la CLI `vibecoder` ou
le moteur ; l'agent écrit lui-même le code seulement quand l'utilisateur le demande
(correctif rapide, PR express, doc ou texte d'un skill seuls, correction après son
essai) ; dans le doute, il demande ; le plugin `vibecoder`
(`userData/vibecoder/plugin`, s'il existe : F-105) et le dossier de sorties de
l'agent (`userData/vibecoder-out/<agent>`) et le dossier d'artefacts de son
projet (`userData/vibecoder-artifacts/<clé>`, F-95) en dossiers de travail en
plus (`additionalDirectories`). Pour tous les agents de l'appli, à chaque tour comme à la sonde ; jamais aux sessions Claude Code
habituelles.

**F-59 Un processus Claude Code par agent** (un `query()`), lancé au premier
message et **gardé entre les tours** : les messages suivants passent par son
entrée. Le premier tour crée la session (retenue dans `sessionId`). Relancé,
session reprise, s'il est mort ou si le dossier, l'effort, la consigne,
`agentCommand`, les plugins ou les dossiers en plus ont changé (`launchKey`). Fermé à *Nouvelle session*, *Retirer*, *Reprendre*
une autre session et à la sortie (I-33), par la fin de son entrée (Claude Code sort de lui-même), tué
seulement après 5 s. *Interrompre* demande à Claude Code d'arrêter son tour ; le processus n'est tué
qu'en dernier recours, après 5 s (lancé par une commande enveloppe, seule
l'enveloppe mourrait) ; quitter attend de même (F-81, S-26). Une course de VibeCoder
(F-115) a son propre processus, sous l'entrée `<agent>~<clé>` : ce n'est
pas la conversation de l'agent. Une tâche lancée en
arrière-plan (commande, surveillance) survit au tour ; à sa fin, Claude Code
prévient l'agent, qui peut ouvrir un tour de lui-même : sa réponse arrive
comme une autre (pastille verte, bip). Images avant le texte ; sans image,
le texte seul (forme sous laquelle Claude Code reconnaît une commande
« / »). Une commande sans réponse écrite → « /x : fait. ».

**F-60 Réponse et audio** : la réponse se termine par `<audio>…</audio>`
(consigne). Le panneau montre la réponse **sans** ce bloc ; ▶ ne lit que lui.
Sans bloc : la réponse dépouillée de son formatage. Consigne : fichier relu à
chaque message ; absent → recréé par défaut ; vide → aucune consigne. Elle
n'est passée qu'aux sessions créées par l'appli (F-58), jamais aux sessions
Claude Code habituelles.

**F-61 Fin de tour** : demandes restées en attente refusées (« Tour
terminé ») ; erreurs traduites (« Interrompu. », trop d'étapes, erreur
d'exécution…) ; demandes d'autorisation en échec comptées et signalées par
⚠ dans la réponse et **ÉCHEC** dans le journal.

**F-62 Journal** (`agents.log`) : début et fin de chaque tour (durée), chaque
demande d'autorisation, sa réponse et son délai, annulations, interruptions
(forcées ou non), « processus lancé », « processus terminé ».

### La fenêtre, la conversation

**F-63 Une fenêtre classique** (depuis la 0.14.0 ; plus d'attache à l'icône,
de réduit ni d'agrandi) : dans la barre des tâches, redimensionnable, ni au
premier plan ni sur tous les bureaux ; taille retenue (`vibeSize`, défaut
1280×820, au moins 960×600). **Sans cadre du système** : l'en-tête de
VibeCoder (48 px) sert de barre de titre — on le glisse pour déplacer la
fenêtre, sauf ses contrôles ; l'accueil sans agent aussi, sauf son bouton —,
et les boutons réduire / agrandir / fermer sont ceux d'Electron, tout à
droite de l'en-tête, à ses couleurs (Window Controls Overlay : aucun canal).
Fond `--vc-bg` dès le chargement (pas d'éclair blanc). Un contenu : l'écran
VibeCoder de l'agent affiché (§ 7 bis), sa conversation dans la colonne de
droite ; aucun agent : l'accueil (*Nouvel agent…*, Ctrl+N).

**F-64 Fermer** quitte l'appli (F-81). Une ouverture que l'utilisateur n'a
pas demandée (demande d'autorisation, F-73) ne lui prend pas le clavier :
fenêtre masquée, elle est montrée sans activation, jamais `restore()` dans ce
cas (S-24).

**F-65 En-tête de la conversation** : l'onglet *Conversation* et l'intitulé
de la conversation (celui de Claude Code ; « Nouvelle conversation »
sinon) ; à droite de la rangée des onglets, 🕘 (l'historique, F-67). La
jauge du contexte et *⚙ Tâches (n)* sont dans la barre d'état (F-92).

**F-66 Fil** : messages avec leur heure (date complète au survol) ; ceux de
l'agent rendus en Markdown (titres, gras, italique, listes, code, liens
`http(s)` : le Markdown de VibeCoder, F-104, sans *Commenter* ; jamais de
HTML, I-40) ; les autres (les vôtres, sorties de commandes, résumé d'une compaction) en texte tel quel,
liens cliquables, blocs ``` en blocs de code ; pièces jointes de vos
messages (aperçus d'images ≤ 800 px, clic : en grand ; fichiers, clic : montrés
dans le gestionnaire de fichiers ; sélection jointe, à déplier) ; actions de
l'agent sur une ligne, chemins raccourcis (`/home/…` et `/var/home/…`) ;
au-delà de 6 actions, les dernières, le reste à déplier ; longues lignes
repliées. Commandes affichées telles quelles ; leur sortie et le résumé d'une
compaction en messages « système » ; les messages que Claude Code s'envoie
(notifications de tâches de fond) ne sont pas affichés (F-77). Au travail : trois points animés et temps
écoulé au bas du fil. Le fil reste en bas quand un message arrive, sauf si
l'on lit plus haut. Mis à jour au plus toutes les 800 ms pendant un tour.

**F-67 Historique** (🕘, à droite de l'onglet Conversation, F-92 ; dans
VibeCoder depuis la 0.14.0) : il prend la place du fil dans la colonne, l'écran
VibeCoder reste ; sessions Claude Code du dossier (de l'appli et
d'un terminal ; pas des worktrees), par date ; une ancienne conversation
s'ouvre **en lecture seule** (pas de champ) ; *← Conversation en cours* ;
*Reprendre cette conversation* (impossible pendant un tour) en fait la session
de l'agent. Sessions retrouvées sous `/home/…` comme sous `/var/home/…`.

**F-68 Champ de saisie** (conversation en cours seulement) :
Entrée envoie (le message s'affiche aussitôt dans le fil, avant que
Claude Code ne l'écrive dans sa transcription), Maj+Entrée va à la ligne ;
il grandit jusqu'à 160 px.
**Brouillon par conversation**, pièces jointes comprises, gardé quand on
change d'agent. Agent au travail : on écrit, on n'envoie pas (bouton grisé).
Dans le cadre du champ, des petites icônes : la pièce jointe (un trombone,
F-69) au début ; en bas à droite, le micro *Dicter* puis *Envoyer* (une
flèche), leur libellé en infobulle ; *Envoyer* à la couleur neutre des
autres boutons (F-92). **Chaque zone de prompt** a le même cadre (un seul composant de saisie : trombone, pièces jointes, zone de texte, F-69) et la même paire micro +
envoi : la zone d'un commentaire « à revoir » ou 💬 (*Envoyer* l'ajoute), la
réponse libre d'une question ouverte (*Envoyer* envoie les réponses) ; aucune
étape n'a plus de champ (F-93, F-98). Le micro, maintenu, dicte
(F-1, F-3) : le texte de whisper va à la zone de texte qui a le clavier,
sinon à ce champ, à la suite du brouillon (espace de séparation), et y met
le focus (F-98, *La dictée*). Seul le micro qu'on tient montre l'état de
l'enregistrement (rose, « enregistre », « transcrit ») ; les autres micros de
l'écran restent au repos.

**F-69 Pièces jointes** : glisser-déposer et Ctrl+V (images PNG, JPEG, GIF,
WebP envoyées en image ; autres fichiers par leur **chemin**, l'agent les lit
lui-même ; un fichier sans chemin est refusé) ; le trombone du champ ouvre directement le choix
d'images ou de fichiers (une image choisie part en image). Images réduites au maximum que lisent les modèles (2576 px sur le grand côté, 3,75 Mpx : une capture 2560×1440 passe entière), ≤ 3,75 Mo (PNG, sinon JPEG 85) ;
≤ 20 images (et, depuis l'écran, 64 Mio décodés au total : au-delà, le refus « Pièces jointes trop lourdes », avant le socket), ≤ 50 fichiers, sélection ≤ 100 000 caractères (la pièce
`selection`, qu'une commande du socket peut encore donner : le trombone ne la
lit plus). Le message
envoyé : le texte, puis la sélection balisée `<selection>`, puis la liste des
fichiers — le panneau les retrouve dans la transcription pour les afficher.
Les pièces jointes se joignent **partout où l'on écrit à un agent** : le champ de
la conversation, celui de chaque étape, les réponses du questionnaire de la note
(une seule liste pour toutes ses questions, montrée dans chacune), avec le même
composant de saisie ; pas les zones de commentaire du relecteur, qui vont toutes au
brouillon de revue, sans pièces jointes. Elles partent avec l'action de **leur champ**, seules :
le questionnaire, avec *Envoyer les réponses* ; le principal les prépare comme
celles de la conversation (mêmes bornes, texte puis sélection balisée puis liste des
fichiers, les images à part), la page les libère après l'envoi. Un gabarit sans
`{{text}}` ni `{{answers}}` les ignore et le dit (`pieces` dans les arguments
ignorés, F-115) ; une pièce refusée (une borne dépassée, un fichier illisible) :
l'erreur s'affiche, rien n'est envoyé (I-2).

**F-70 Commandes « / »** : un champ qui commence par « / » (sans espace)
propose les commandes de l'agent (Claude Code, skills, projet), d'abord celles
qui commencent par la saisie ; flèches, Entrée ou Tab choisissent, Échap
ferme. Liste demandée une fois par dossier (sonde).

Le champ de la conversation et celui de chaque étape (pour citer un
artefact en rédigeant une note) ouvrent aussi, sur un `@` en début de mot (en
début de champ ou après un espace : pas dans une adresse e-mail), la liste
des **artefacts du projet** (F-95), filtrée à la frappe, d'abord ceux dont le
nom commence par la saisie : mêmes gestes que les commandes « / » (flèches,
Entrée ou Tab choisissent, Échap ferme). Choisir remplace le `@…` tapé par le
chemin du fichier, que l'agent lit s'il en a besoin (aucun jeton dépensé avant
la lecture). Rien ne correspond : la liste se ferme et Entrée et Tab restent
au champ (`@types/node` se tape et part). La liste vient du relevé
(`VibeView.artifacts`, le dossier dans `VibeView.artifactsDir`), sans canal de
plus ni chemin donné par la page (I-37).

**F-71 Jauge du contexte** : part de la fenêtre occupée lors de la dernière
réponse (sinon la dernière sonde) ; orange ≥ 80 %, rouge ≥ 90 %. Clic : le
détail par catégorie et fichiers de mémoire, *Compacter (/compact)* (agent
inactif, conversation en cours). Après /compact, la jauge attend une nouvelle
mesure.

**F-72 Sonde** : agent au travail → posée à son tour en cours ; sinon Claude
Code est lancé sans message (30 s au plus) le temps de répondre, sans toucher
à la conversation.

**F-73 Autorisations (mode manuel)** : en file, la plus ancienne affichée au
bas du fil : ce qui va s'exécuter **en entier**, *Autoriser*, *Toujours
autoriser* (seulement s'il y a une règle, qu'il nomme), *Refuser*, « N autres
en attente ». La fenêtre masquée → elle se montre sur l'agent, **sans
prendre le clavier** (F-64) ; un autre agent affiché → le « ? » de son robot
attend (F-55).

**F-74 Message en tête du panneau** : notices (« Micro Discord coupé »,
F-30) et messages de l'appli (téléchargement du modèle, F-8 ; installation de
Pocket TTS, F-42 ; dépannage du son, F-34 — ceux-ci effacés après 10 s),
croix pour fermer.

**F-76 Contexte « Dictée »** *(retiré en 0.14.0 : le dernier texte dicté pour
ailleurs et *Copier* ; la dictée va dans les champs, F-6)*.

**F-77 Volet des tâches** (l'onglet Tâches de la colonne de droite, et
*⚙ Tâches* de la barre d'état, F-92) : les tâches de fond de l'agent comme Claude Code les montre
(`/tasks`) — commande en arrière-plan, surveillance, sous-agent, flux
d'agents —, les plus récentes en tête. Chacune : type, état (en cours,
terminée, en échec, arrêtée), temps écoulé ; la description de l'agent,
liens cliquables (I-21), la commande repliée dessous (chemins raccourcis) ;
ligne d'avancement, résumé de fin. Une commande : les dernières lignes de
sa sortie, lues dans le fichier où Claude Code l'écrit, rafraîchies au
rythme du fil (F-66) tant qu'elle tourne (panneau visible) ; *Montrer le fichier* le
montre dans le gestionnaire de fichiers (I-34). Source : le flux du
processus de l'agent, pas la transcription. Finies, les tâches restent
jusqu'à la sortie de l'appli ; *Nouvelle session* et *Retirer* vident le
volet. Il n'agit sur rien (ni arrêt, ni relance : on le demande à l'agent).

**F-75 Fenêtre** : ni au premier plan ni hors de la barre des tâches depuis la
0.14.0 (F-63 ; `onTop` retiré) ; liens vers le navigateur seulement, jamais
de navigation (I-21).

## 7 bis. VibeCoder

Notes des tickets : `docs/tickets/feat/0.8.0-vibecoder.md`,
`0.9.0-actions-independantes.md` (les courses), `0.9.0-parcours-guide.md`
(le parcours guidé), `0.12.0-mode-vibe.md` (le mode *Vibe*),
`0.12.0-gestion-des-branches.md` (la vue des branches, *Pull*, *Rebase*),
`0.13.0-fusionner-creer-relire.md` (un seul parcours, le relecteur),
`0.14.0-refonte-vibecoder.md` (la fenêtre classique, VibeCoder seul, le
design de la vue C) ; le guide :
`docs/dev_guide/guide-travail-dev-ia.html`.

### L'agent affiché, l'écran

**F-90 VibeCoder** : un mode IDE par agent, qui rend graphique le flow du
guide « Développer avec l'IA » : un seul parcours (note, forme, invariants, un
commit par module, revue, PR, release candidate) pour créer une feature sur la
branche du dossier de l'agent et pour relire une PR du dépôt ; l'appli décide
du rôle, créateur ou relecteur (F-101). Une action envoie à l'agent le message
du guide, avec le skill et le modèle qu'il faut (F-96, F-106). **L'écran de
l'essentiel** (0.16.0, créateur) : il ne montre que ce que l'utilisateur doit
regarder ou décider ; le système enchaîne (F-103), une ligne dit où l'on en est
(F-92), le badge de l'étape porte le ✓ (F-102), et une action à la demande se
demande à l'agent, qui a la CLI (F-116). **Plus de bouton d'action dans les
étapes** : rien n'est retiré du registre des commandes, chaque action reste
lançable par la CLI avec le même contrat ; restent à l'écran la note (*Vérifier*,
*Valider la note*, le questionnaire), le fil des étapes, l'interrupteur *Express*
et le bouton du moteur. **La revue essentielle** (0.16.0, relecteur) : quatre arrêts (la note, les règles, l'essai, publier), une ligne qui dit où l'on en est et un seul bouton, *Préparer la revue* (F-101) ; le créateur ne change pas.

**F-91 Changer d'agent** (le choix entre VibeCoder et la conversation seule —
*◧ Ouvrir VibeCoder*, *💬 Ouvrir la conversation*, *Revenir à la
conversation*, `agents[].view` — est retiré en 0.14.0 : VibeCoder est la
seule vue, pour chaque agent). On change d'agent par son robot (F-54), la
palette (Ctrl+K) ou Ctrl+Tab (F-92). En changeant d'agent, l'écran garde
l'affichage d'avant jusqu'à ce que la conversation **et** le relevé du nouvel
agent soient là : jamais de page vide, l'en-tête et les robots ne bougent
pas. Ce qu'on a commencé sur l'écran d'un agent (réponses aux questions,
modèle choisi, verdict de la revue, étape choisie) et
ce que chaque étape retient (par agent **et** par étape : le fichier choisi,
les dossiers pliés et le défilement des vues IDE, le mode *Brut* de la note, le
défilement de l'étape ; plus d'onglet ni de vue retenus, 0.16.0) l'attend quand on revient sur lui, le temps que l'appli tourne
(en mémoire : un redémarrage l'oublie). La colonne
de droite montre la conversation **en cours** de l'agent, ou une ancienne
par l'🕘 Historique (F-67).

**F-92 L'écran** (toute la fenêtre, F-63 ; le design de la **vue C**, cf.
*L'apparence* ci-dessous) :
- **en-tête** (48 px, la barre de titre de la fenêtre, F-63), de gauche à
  droite : **tous les agents** en petits robots, à leur couleur éclaircie,
  dans un **ordre fixe** (celui de la configuration, chaque worktree ou PR
  plus petit juste après son parent : afficher un agent ne déplace
  personne), leur état sur le robot (F-55) ; l'agent affiché, à sa place, en
  **badge éclairé** — son robot, son dépôt, le titre d'un worktree ou d'une
  PR —, sans état ; clic : la palette sur *Agents* ; clic sur un autre robot :
  il s'affiche aussitôt (F-54) ; clic droit sur un robot : son menu (F-56) ;
  avant le premier relevé des agents, le nom de l'agent seul. Puis **+**
  (*Nouvel agent…*, Ctrl+N : le menu de F-52). Puis le segment de la
  **branche** (une icône, `<branche>`, un chevron ; sa base au survol), une
  seule fois, un bouton (enfoncé tant que la vue est ouverte), à l'allure de
  celui d'*Artefacts* — une simple bordure — : un clic
  ouvre la **vue des branches** (F-110), qui prend le centre à la place de l'étape ; un nouveau
  clic la ferme (retour à l'étape) ; à côté, *Pull*, *Rebase* (masqué
  sur la branche principale) et,
  après un rebase réussi, *Pousser* (boutons à icône, F-114 ; *Pull* grisé
  sans branche distante suivie ou à jour avec elle ; une pastille sur
  *Rebase* quand `origin/<base>` a des commits absents de la branche ; le
  dernier échec en infobulle) ; le badge d'un worktree, sans action ;
  le badge **Relecteur** (*Reviewer*), sans action, quand l'appli décide qu'on
  relit la PR d'un autre (F-101) : rien ne s'y édite, l'infobulle le dit ; plus
  de *Créer* / *Relire* à choisir : un seul parcours. Au milieu, le nom
  **VibeCoder**. À droite : **Artefacts** (*Artifacts* en anglais), un
  bouton à part (enfoncé tant que le panneau est ouvert) : un autre contexte
  que le parcours ; un clic
  ouvre le **panneau des artefacts** (F-95), qui prend le centre à la place
  du fil d'Ariane et de l'étape (ou de la vue des branches), la colonne de
  droite gardée ; un nouveau clic, ou le choix d'une étape, le
  referme ; puis **Chercher** (`Ctrl K` en touche), la palette (ci-dessous) ;
  en icônes, la colonne de droite affichée ou masquée et **⚙ Réglages**
  (l'engrenage : la page des réglages, § 8) ; tout à
  droite, les boutons de la fenêtre (F-63). Plus de *Revenir à la
  conversation* ni de *Fermer* (retirés en 0.14.0) ;
- la **palette** (Chercher, Ctrl+K ; le badge de l'agent affiché l'ouvre sur
  *Agents*), par-dessus l'écran : un champ de recherche (chaque mot, sans
  casse), des **portées** (*Tout*, *Agents*, *Branches*, *PR* ; Tab : la
  suivante) et des groupes : les **agents** par dépôt, avec leurs worktrees
  et leurs PR plus petits sous leur parent, chacun sa pastille, « Étape … ·
  état » (*travaille*, *attend ta réponse*, *vient de finir*, *en échec*, *au
  repos* — ou « surveille n tâches de fond », F-55) ; les **branches** du dépôt de l'agent affiché, chacune son icône et
  la pastille de l'agent qui la tient ; les **PR** ; les **actions** (*Nouvel
  agent…* Ctrl+N, *Créer une branche…*, *Gérer les branches et les PR…*
  Ctrl+Maj+B, *Mettre de côté les changements*). Au bout de chaque ligne, ce
  que fait Entrée ; au pied, l'aide des touches : « Entrée : aller /
  basculer ici », « ⇧ Entrée : branche libre → vue des branches », « Tab :
  portée suivante », « Échap : fermer ». Entrée : aller à l'agent (ou à
  celui qui tient la branche, la PR), ou basculer ici sur une branche que
  personne ne tient (en direct, comme la vue des branches, F-110) ; une PR
  que personne ne tient, *Créer une branche…*, *Gérer les branches…* : la
  vue des branches ; *Mettre de côté* : en direct (F-114) ; flèches pour
  choisir.
  Raccourcis de la fenêtre : Ctrl+K la palette, Ctrl+Tab l'agent affiché
  juste avant, Ctrl+N *Nouvel agent…*, Ctrl+Maj+B la vue des branches ;
- au centre, en tête, le **fil d'Ariane** : les étapes en une ligne,
  reliées par un trait (point plein : faite ; anneau à la couleur de
  l'agent, qui pulse : en cours, la première non faite ; gris : à venir ;
  en créateur, les étapes qui se valident — Note, Forme, Invariants, Modules —
  prennent la couleur de leur validation, pas du seul parcours : verte, validée
  et rien de changé depuis ; jaune (attention), du contenu déjà validé puis
  modifié depuis, ou à revoir en cascade ; grise, jamais validée, même faite ;
  l'infobulle le dit, et « En attente : valider d'abord l'étape … » quand celle
  d'avant ne l'est pas), chacune son libellé, **tous** ses faits en infobulle (« 2 fichiers · 5 cas · 3
  lus » : l'étape n'y est pas affichée, c'est son seul résumé, alors que son
  en-tête n'en répète aucun qu'elle montre déjà, F-93) ; trop étroit, il défile à l'horizontale. Au bout, en créateur,
  l'interrupteur *Express* (F-103) ; plus de compte « N commits » ni de liste des commits, pour personne (0.16.0). Le **fil du relecteur** (0.16.0) a quatre arrêts sous leur nom, « Note », « Règles », « Essai » et « Publier » : ni Forme (rien à y juger) ni Modules (l'histoire des commits ne se relit plus), F-101. Le fil d'Ariane mène : un clic (ou Ctrl+1…6, Ctrl+1…4 pour le relecteur, le raccourci en infobulle ; Ctrl+5 : rien) ouvre n'importe quelle étape, faite, en cours ou à venir, dans les deux rôles : l'état reste au fil (point, anneau, gris), l'étape en cours reste la première non faite (sans note : la Note, mais on va librement aux autres) ; un arrêt retenu qui n'est plus dans son fil laisse l'arrêt en cours. Ouvrir une étape à venir ne lance rien et n'écrit rien ;
- sous le fil (0.16.0), **la ligne d'état** : toujours là, une seule,
  une phrase dans la langue de l'écran qui dit ce que le système est en train de
  faire, ou ce qu'il attend de l'utilisateur, avec à côté, en créateur, le bouton du moteur quand il sert (F-93). Par exemple : « Demandez la note à l'agent, dans la
  conversation » (pas de note), « 2 questions : répondez dans le questionnaire »
  (les questions d'abord, même pendant que le moteur enchaîne), « Vérifiez, puis
  validez la note », « Le système écrit les modules », « Regardez vos règles,
  puis reprenez » (la pause après les invariants), « Essayez l'appli, puis
  reprenez » (la pause après les modules), « La PR est ouverte, la CI tourne »,
  la CI en échec dite, « La PR est verte : à vous de la fusionner ». Une pause
  d'un ✓ retiré à la main nomme l'étape (F-102) ; la note qui a perdu son ✓
  attend sa validation ; le moteur arrêté hors d'une pause dit qu'il l'est et
  de reprendre. Le parcours fini — la PR verte et chaque étape faite, la PR
  fusionnée, ou fermée — : la ligne seule, sans *Reprendre* (il n'y a rien à
  reprendre ; une étape pas faite, la CI en cours ou en échec : le bouton
  reste). **Le relecteur a la sienne** : ce que le système est en train de lire, ou ce qu'il attend de lui, d'après ce que le relevé sait déjà (la PR chargée ou non, les lectures en cours, la note jugée, les tests jugés, les cases du plan cochées, la revue publiée) — « choisissez la PR à relire », « passez sur la branche de la PR », « préparez la revue », « lisez la note, puis jugez-la », « n tests à juger », « essayez l'appli » (n cases du plan pas cochées), « publiez la revue », la revue publiée dite, aucune ligne sur un relevé en erreur —, avec à côté son seul bouton, *Préparer la revue* (F-101), à tous les arrêts, grisé avec sa raison en infobulle quand il n'y a rien à lancer, absent sans PR chargée ; ni *Express*, ni *Arrêter*, ni *Reprendre* ;
- dessous, sur toute la largeur à gauche de la conversation, l'étape
  choisie — sinon celle en cours, que l'écran suit —, son en-tête (F-93), sans action (0.16.0, les deux rôles) ; ni onglets des étapes ni carte « prochaine
  étape » : le fil d'Ariane et la ligne d'état disent où l'on en est ;
- à droite, des onglets : **Conversation** (son intitulé ; le message en tête,
  F-74, le fil et ses demandes d'autorisation, le détail du contexte, la
  barre des skills, F-93, le champ, F-68 à F-70 : dictée, brouillon, pièces
  jointes, commandes « / », le micro et *Envoyer*), à droite de la rangée 🕘
  (l'historique, F-67) : on lui parle toujours, même pendant qu'une
  action tourne ; **Actions (n)** (n en cours ou arrêtées à
  trancher) : les courses (F-115) ; l'ouvrir
  efface sur le robot les courses *finies* ou *en échec* (F-55), et tant
  qu'il est ouvert sur l'agent affiché, celles-là ne s'y signalent pas (une
  course qui travaille, si) ; **Tâches (n)**
  (n en cours) : le volet des tâches (F-77) ; **Processus (n)** (F-111) ;
  par-dessus la conversation, qui garde sa place. Préparer un message dans
  le champ de la conversation, ou un message sans étape qui l'exige, revient
  à l'onglet Conversation. *Envoyer* y a la couleur neutre des autres
  boutons : la pastille de l'agent suffit ;
- en bas, la **barre d'état** : modèle, effort, mode de l'agent (des listes,
  comme son menu, F-56, F-57), jauge du contexte (clic : le détail, F-71),
  *⚙ Tâches (n)* (l'onglet Tâches, et retour ; la colonne masquée
  s'affiche), l'action en cours (un point vert qui clignote et son nom)
  ou, plusieurs, « N actions en cours » — un clic : l'onglet Actions (la
  colonne masquée s'affiche) ; aucune : rien ; l'agent au travail n'y
  compte pas —, *⏹ Arrêter* quand la conversation travaille (son tour
  seulement, pas les courses), fichiers modifiés, heure
  du dernier relevé et, à côté, ↻ *Relever maintenant* (il tourne une fois par
  clic). Le modèle et l'effort de l'agent ne se règlent qu'ici (et dans son
  menu, F-56) : plus de pastille sur les étapes (F-109).

**L'apparence** : celle de la **vue C** de la maquette « Vibecoder — switch
d'agents » (artefacts du projet : `maquettes/vibecoder-switch-agents.html`,
le balisage lisible dans `maquettes/vue-c/`), disposition, couleurs et
apparence, sur tous les écrans, y compris ceux que la maquette ne montre pas
(un cas d'invariant validé garde sa carte, seule sa bordure verte le
distingue). Les couleurs de la maquette, fonds et traits **éclaircis d'un
demi-cran** : fond `#1c1f25`, en-tête `#21252c`, cartes `#23272f`, bordures
`#343a47` ; texte `#d7dae0`, gris `#a3a9b5` et `#8b919d`, accent bleu
`#7aa2f7`, vert `#4fbf7a`, ambre `#e8b36a` ; la couleur de l'agent sur son
robot. Toutes en variables (`src/renderer/core/ui/theme.css` : `--vc-bg`,
`--vc-side`, `--vc-card`, `--vc-line`, `--vc-text`, `--vc-accent`…), aucune
couleur en dur ailleurs, sauf la coloration du code. Polices **Inter** et
**JetBrains Mono**, embarquées dans l'appli (`core/ui/fonts/`, licence OFL) :
même rendu partout, rien chargé du réseau — la page n'autorise que
`font-src 'self'` (I-7). Sobre et dense : boutons de 22 px de haut, coins peu
arrondis, bordures fines, ni dégradés ni halos ; le texte garde sa taille
(12 à 13,5 px). Une action dont l'icône est claire (fermer, ouvrir dans
l'éditeur, GitHub, diff, commenter, valider, à revoir, arrêter, lancer,
relever, modifier, *Pull*, *Rebase*, *Pousser*) est un bouton-icône : un
SVG monochrome écrit dans le projet (ni emoji ni caractère Unicode, rendus
différemment selon le système), son libellé en infobulle et en
`aria-label` ; les autres gardent leur texte. Les actions secondaires
restent visibles, en petites icônes grises ; seuls *Commenter* d'un bloc de
la note et les outils d'une ligne de la Forme n'apparaissent qu'au survol.
Ci-dessous, un bouton-icône est nommé par son libellé (*Commenter*,
*Valider*, *À revoir*, *Arrêter*…).

Un seul écran, que le système enchaîne ou non (F-103) : le fil
d'Ariane, la ligne d'état et l'étape restent, sans bannière ; seul le bouton du
moteur, à côté de la ligne, passe d'*Arrêter* à *Reprendre* (F-93). git introuvable, dossier sans
dépôt : un bandeau le dit au-dessus de l'étape, la conversation reste
utilisable. Une étape sans sortie dit ce qui manque ; ni le créateur ni le relecteur n'y trouvent de bouton : une phrase renvoie à l'agent (créateur) ou à *Préparer la revue* (relecteur). Une vue d'étape qui échoue sur un texte
inattendu : « Cette étape ne peut pas s'afficher. » et *Réessayer* ; le reste
de l'écran et le brouillon tiennent (S-72).

**F-93 Les actions d'une étape, Relancer, barre des skills.**
- Une action d'étape **court à part** de la conversation, dans sa propre
  conversation (une course, F-115) : pendant qu'elle tourne, on parle à
  l'agent comme d'habitude. **Aucune étape n'a de champ** (0.15.0) : une action
  qui exige une demande, cliquée à l'écran, prend celui de la conversation
  (F-98).
- L'**en-tête** d'une étape, son titre et ses faits propres, ne répète rien de
  ce qu'elle montre juste en dessous (le questionnaire, une carte, le résumé,
  la validation à côté du chemin de la note) : « rédigée » ou « à rédiger » à la
  Note ; rien à la Forme ; à la Revue, les
  fixups (« pas vérifiée » avant toute vérification, avec eux) ; « pas de
  note », « pas de PR » tant que la carte n'est pas là ; rien aux Invariants, aux
  Modules ni à la PR ouverte. Une étape décochée (F-102, *Les validations
  d'étape*) le dit en plus, à côté du titre, à la place des faits de l'en-tête :
  « modifiée depuis la validation » (à l'étape Modules, un bouton : le diff passe
  sur ce qui a changé depuis le ✓, un second clic revient à la base, F-102 ; ailleurs
  seulement dit) ou « à revoir : la note a changé ». Le relecteur : la Note de même, « pas de plan » à l'Essai sans plan ; rien ailleurs, aucune validation d'étape. L'infobulle du fil d'Ariane (F-92) les garde tous.
  **Le badge d'état** de l'en-tête (`vc-badge`) porte le ✓ du créateur
  (0.16.0) : « faite ✓ » quand l'étape est validée, « faite · ✓ retiré » tant que
  son ✓ retiré à la main tient ; il se clique, à la Forme, aux Invariants et aux
  Modules, pour retirer ou rendre le ✓ (la même validation d'étape, F-102 :
  aucun canal de plus), et ne fait rien d'autre. Une étape faite que le système n'a
  pas validée (une preuve qui ne passe pas, un contenu changé depuis, à revoir) :
  le badge sans ✓ et sans clic ; la Note, la Revue et la PR : sans ✓ ni clic, validées
  ou non. Relecteur : jamais de ✓ ni de clic.
- **Plus de rangée d'actions pour le créateur** (0.16.0) : sous le titre de
  l'étape, ni bouton ni action mise en avant, à aucune étape ; ce qu'il y avait
  (*Rédiger la note*, *Nouvelle demande*, *Poser la forme*, *Valider la forme*,
  *Écrire les invariants (rouges)*, *Tout valider*, *Lire en pseudo-code*,
  *Prouver les invariants*, *Générer*, *Relire le diff*, *Lancer les
  vérifications* et la ponytail review, *Appliquer*, *Tout appliquer*, *Plan de
  test à l'écran*, *Valider la feature*, *Diagnostiquer la CI*, *Relancer*, *Me
  retirer de la PR*…) ne se lance plus d'un clic : le moteur enchaîne, ou l'agent
  lance l'action par la CLI (F-116, le même contrat : rien n'est retiré du
  registre des commandes ni du relevé). Restent à l'écran la note (*Vérifier*,
  *Valider la note*, le questionnaire, F-100), le fil, *Express* et le bouton du
  moteur. Le **relecteur** n'a pas de rangée non plus (0.16.0) : ses lectures (*Relire la note*, *Lire en pseudo-code*, *Vérifier l'alignement*, *Relire le code*, *Plan de test à l'écran*) se lancent ensemble par *Préparer la revue* (F-101), ou une à une par l'agent (CLI) ; une course qui tourne se voit dans l'onglet *Actions* (arrêtée, à trancher là). Conversation au travail : seuls les messages sans étape
  (*Où j'en suis ?*, *Proposer les commandes*)
  sont grisés, le bouton du moteur masqué (F-99) ; *⏹ Arrêter* (barre
  d'état) arrête son tour, comme *Interrompre* de son menu (F-56), sans
  toucher aux courses.
- **Un seul bouton pour le moteur** (créateur, F-103), dans la ligne d'état sous
  le fil d'Ariane, à côté de la phrase, à toutes les étapes (grisé avec sa raison, masqué quand il
  n'a pas de sens : F-99, rien tant que la note n'est pas validée) ; plus de bouton
  *Vibe*, ni libellé ni infobulle qui dise « Vibe » ; plus dans les rangées
  d'actions des étapes. *Arrêter* pendant que le système enchaîne (« La course en
  cours finit, la suivante ne part pas » en infobulle), *Reprendre* quand il est
  arrêté (une pause, un arrêt à la main, un redémarrage de l'appli : le moteur ne
  repart jamais tout seul) ; plus de bannière. Un ✓ d'étape retiré à la main, ou la
  note sans son ✓ : la ligne le dit, sans bouton. Rien pour le relecteur.
- **Ce que l'IA fait seule n'a pas de bouton** ; les actions qui vont
  ensemble partent ensemble, par le moteur ou par l'agent (CLI), sans que l'appli
  enchaîne rien : *Écrire les invariants (rouges)* suit l'alignement dans sa
  course (skill `aligner`, une fois) : il ne vérifie que les invariants (chaque
  ligne « → invariant » observée par un test, chaque test rattaché à une
  ligne), corrige seul les tests et revérifie, 3 tours au plus ;
  `align.md` ne garde que ce qui reste (F-100) ; *Lire en pseudo-code* part
  ensuite, lancé par le moteur après chaque écriture des tests d'invariants
  (F-100) ; *Lancer les
  vérifications et la ponytail review* lance aussi la ponytail review, par
  l'appli et non par le skill `verifier` (startAction, F-115) : deux lectures,
  qui courent ensemble ; déjà en cours, elle ne part pas en double ; relancer
  une seule vérification ne la lance pas. Plus de bouton *Vérifier l'alignement* ni *Ponytail
  review* chez le créateur ; leurs résultats se lisent aux étapes Invariants et Revue. Un document demandé hors du projet (PDF,
  présentation, wireframe, document externe, fichier de conception) :
  l'agent le crée en artefact (F-95) par le skill `artefact`, qu'il prend
  seul — ni bouton ni lien ; il se trouve aussi par « / » dans le champ.
- **Relancer** : le créateur n'a plus de *Relancer* à l'écran (0.16.0) ; l'agent
  refait une action par la CLI, mêmes arguments par défaut, et peut relancer une
  seule vérification (`{{check}}`, F-97 : les autres gardées, sans ponytail
  review ; pas pendant une course `checks`). Le relecteur non plus (0.16.0) : ni *Relancer* sur une carte, ni *Relire*, ni *Tout relire* ; *Préparer la revue* ne lance que ce qui manque ou a été lu sur une autre tête de la PR (F-101), et l'agent refait une lecture par la CLI. La ponytail
  review n'a pas de *Relancer* : on relance *Lancer les vérifications*.
- La **barre des skills**, au-dessus du champ : la nouvelle demande retenue
  seule (F-110) ; plus de lien *Demander sans modifier* ni *Retour → fixup*
  (retirés en 0.14.0, avec leurs actions `ask` et `fix`) ; les skills se
  trouvent par « / » dans le champ.

### Le relevé, les actions

**F-94 Le relevé** (sans modèle) : ce que l'écran montre, calculé par le
principal pour l'agent affiché :
- le **dépôt**, par git en lecture seule (I-39), dans le dossier de l'agent :
  la branche, sa base (`origin/HEAD`, sinon `main`, sinon `master`), les
  fichiers changés (depuis la base, et la copie de travail, non suivis
  compris), les commits de la branche et leurs fichiers. Relecteur : la copie
  de travail, le dossier sur la branche de la PR (F-110), comparée à
  `origin/<base>` de sa fiche (`pr-<n>.json`) ;
- le **rôle**, créateur ou relecteur, recalculé à chaque relevé d'après la PR
  du dossier et ses personnes (F-101, F-112) ;
- la **note du ticket** : sa clé d'après la branche — un ticket (`G2-6675`),
  sinon une version (`0.8.0`) : la branche doit porter l'un ou l'autre — ; le
  `.md` de `docs/tickets/` que change la branche (relecteur : la PR) nommé
  comme elle (`feat/0.8.0-vibecoder` → `0.8.0-vibecoder.md`), sinon le
  premier dont le nom contient la clé en mot entier (une branche qui change
  aussi la note d'un autre ticket de la même version garde la sienne) ; sinon, ou
  en plus, celle que git **ignore** sous `docs/tickets/` (`status --ignored`,
  sur le disque : la note hors du projet, 0.16.0, voir F-100). Lue par ses
  titres (`## Ce que ça fait`, `## Ce que ça ne doit pas faire`, `## Forme`,
  ou `What it does`, `What it must not do`, `Shape`) : rédigée ou non, les
  lignes « ne doit pas » et leur marque (le premier mot connu après la
  dernière flèche : *invariant*, *variant*, *review*, *structure*), les
  modules de la Forme et leur contrat (un chemin en tête de ligne, ou
  plusieurs — « a.ts + b.ts  contrat », une espace de chaque côté du « + », le
  contrat après deux espaces ou plus : des fichiers qui ne compilent
  qu'ensemble, un module et un commit ; ou un titre `###` ; hors bloc de code, pas la suite d'un paragraphe qui
  commence par un chemin ; une Forme sans titre `###` dont un bloc de code
  ouvre un module : seules les lignes de ses blocs sont lues, la prose qui
  commence par un nom de fichier n'est pas un module ; sans bloc de code,
  les anciennes notes, la lecture ne change pas) ; et pourquoi elle ne s'édite pas (`locked`, F-100) ;
- les **tests** de la branche : ses fichiers changés qui sont des tests
  (Vitest, Jest, pytest, Go, Rust sous `tests/`), leurs cas (titres `it` /
  `test`, fonctions `#[test]`, `def test_…`) et leur empreinte git ; ceux
  rangés sous `tests/invariants/` sont les invariants (et pourquoi ils ne
  s'éditent pas, `locked`). Un fichier sans cas n'est pas montré ;
- les **modules** de la Forme (un module à plusieurs chemins : ses fichiers sont
  ceux sous l'un d'eux, il est touché si l'un l'est) : touchés par la branche
  (le squelette compris) ou non, commencés (`started`) ou non — un fichier a changé
  depuis le squelette : un commit sans la note, ou, la note commitée, un
  changement pas commité ; absent, comme touché —, les commits qui les
  touchent hors celui de la note (le plus ancien de la branche qui la porte ; la note ignorée par git : le plus ancien de la branche), leur fichier s'il existe (tel quel ou sous `src/`) ; un module
  touché, ses fichiers (`files`, ids `m<rang>/<i>`, triés : son dossier et ses
  sous-dossiers, sans lien ni fichier ou dossier caché ni dossier
  `node_modules`, `target`, `dist`, `build`, chacun dans le dossier de
  l'agent ; au plus 1 000, les premiers trouvés ; un fichier : lui-même),
  leurs chemins sans leur texte ;
  un module pas touché n'en a aucun ; et pourquoi son code ne s'édite pas
  (`locked`, F-100 ; `null` : éditable) ;
- les **fichiers de la branche** (`files`, ids `b<i>`, triés) : ceux qu'elle
  change, la copie de travail comprise, avec « supprimé » (absent du disque)
  et leur `locked`, comme un module : de quoi suivre une branche sans Forme
  (F-100) ; le réglage de la vue Modules (`modulesView`, `ide` ou `list`), « d'avant » :
  la page ne le lit plus ni ne l'envoie plus (0.16.0) ;
- les sorties des skills (F-95), les validations (chaque étape dit si son ✓
  a été retiré à la main et tient, `VibeStepCheck.withdrawn`, 0.16.0 : c'est ce
  que lit le badge de l'étape, F-93) et le brouillon de revue
  (`vibecoder-state.json`), les actions (F-96), les skills du projet et de
  l'utilisateur ;
- les **artefacts** du projet de l'agent (F-95), toujours : les fichiers du
  dossier d'artefacts du projet (`VibeView.artifactsDir`), sous-dossiers compris, sans lien ni dossier
  caché (les fichiers cachés, eux, y sont), au plus 1 000 ; triés par nom, ids `a<i>` dans cet ordre ;
  par artefact son nom (son chemin sous ce dossier), sa sorte (`markdown`,
  `text`, `page` : HTML, SVG ; `media` : image, PDF, son, vidéo ; d'après
  l'extension, tout autre fichier, binaire compris : `text`), sa taille, son
  heure, son adresse (`page`, `media` : `vibe-artifact://<agent>/a<i>`) et
  s'il est tronqué (du texte au-delà d'`artifactTextMax`, § 9) ; sans leur
  texte.

Les deux rôles lisent le disque (un fichier de 1 Mo au plus). **Rythme** : à chaque
conversation envoyée au panneau visible (ouverture, changement d'état d'un
agent, au fil d'un tour), toutes les 4 s tant que le panneau est visible, aussitôt
après une action, une validation, un réglage ou ↻ ; un relevé à la fois, au
plus un par seconde. Plus d'agent affiché (aucun agent) : `null`, une
fois, et le relevé régulier s'arrête. git manquant, pas de dépôt, fichier
illisible : le relevé part quand même, sans bloquer le fil ni l'agent
(S-72).

**F-95 Les sorties des skills** : ce qu'un skill produit pour l'écran, écrit
dans le dossier de sorties de l'agent (`{{out}}` :
`userData/vibecoder-out/<agent>/`, le même pour toutes ses branches ; Claude
Code le reçoit en dossier de travail, F-58). Elles suivent la
branche, dans les deux rôles — celles d'une feature passée ne font pas croire qu'une étape est
faite : la dernière branche vue est retenue (`.branche`) ; quand elle change,
les sorties de la branche (`questions.md` à `ecran.md` ci-dessous, ni les lectures
`invariants/`, ni celles d'une PR) de la branche quittée vont dans
`branches/<branche>/` (caractères hors de `[A-Za-z0-9._-]` → `-` ; remplacé),
sauf si c'est la base — une feature lancée depuis la base (*Rédiger la note*)
crée sa branche et garde ce que ses skills ont écrit — ; puis
celles de la branche retrouvée, si elle en a de côté, reviennent ; de même
quand le dossier change de branche pour relire une PR ou pour une nouvelle
demande (F-110) : l'état de la branche revient avec elle. Une erreur
ne bloque pas le relevé (S-72). Seuls ces noms sont lus (I-37) : `questions.md` (questions ouvertes), `align.md`
(alignement), `preuve.md` (0.16.0, la preuve des invariants par mutation :
une rubrique `## [prouvé]` ou `## [toi]` par ligne « → invariant », F-100 ; une
sortie de branche, rangée avec celles de sa branche), `review.md` (relecture d'un diff), `commit.md` (message
proposé), `checks.json` (vérifications : par élément `name`, `ok`,
`level` — `ok`, `warning` (des avertissements seulement : `ok` vrai, la
vérification passe) ou `error` ; sans `level`, d'après `ok` —, `detail`), `ponytail.md`, `pr.json` (la PR
ouverte, si gh ne l'a pas dite, F-112), `ci.md`, `ecran.md` (le plan de test à
l'écran, les deux rôles : une sortie de branche) ; par PR `pr-<n>.json` (sa
fiche), `pr-<n>-note.md`, `pr-<n>-commits.md`, `pr-<n>-review.json` (revue publiée), `pr-<n>-worktree.json` (son
worktree, écrit par l'appli, F-110) ; `new-request.json` (`{ branch }` : la
branche d'une nouvelle demande, skill `nouvelle-demande`, F-110) ; les lectures
`invariants/<empreinte>.md` (toutes : celle d'un test qui a changé depuis
reste, périmée cas par cas, F-100) et, à côté de chacune, `<empreinte>.json`
(`{ <clé>: <empreinte du bloc> }`, écrit une fois quand la lecture
est à jour : voir l'étape Invariants) ; `ponytail-applied.json` (`{ applied:
["<fichier>:L<ligne>", …] }` : les remarques de `ponytail.md` que *Appliquer
la revue* a appliquées ; plus vieux que `ponytail.md`, ou illisible : aucune ;
suit la branche comme lui). Chaque étape montre les siennes (titre, fichier,
depuis quand ; un JSON mis en forme, un Markdown rendu, F-104).
**Les étiquettes `[toi]` / `[agent]`** (0.15.0) : chaque ligne des sorties du
créateur — `align.md` (en tête de chaque titre `##`), `ponytail.md` (après
l'adresse `<fichier>:L<ligne>`, qui reste en tête : la page la cherche là),
`review.md` et `ci.md` (en tête de chaque point), `checks.json` (en tête du
`detail`) — dit à qui elle s'adresse : `[toi]`, une décision de l'utilisateur
(un changement de contrat : ce que la note fait ou ne doit pas faire, une
étiquette d'invariant, une note qui rend un test impossible à écrire, un code
qui sort du contrat de la note) ; `[agent]`, le reste, que l'agent règle seul
(presque toutes les remarques ponytail). Pas celles du relecteur d'une PR, qui
lit tout (`pr-<n>-note.md`, `pr-<n>-commits.md`, et `align.md` : une liste sans
étiquette). La page remplace l'étiquette par un badge, *pour toi* (accent) ou *pour
l'agent* (grisé), et grise le texte de ce qu'une `[agent]` couvre (la rubrique sous
son titre dans `align.md`, un point et ses sous-points ailleurs), lisible tout de
même ; une `[toi]` imbriquée garde un texte normal et son badge, une ligne sans
étiquette reste comme avant, une vérification en échec garde sa marque colorée.
`preuve.md` (0.16.0) a ses propres étiquettes, une par rubrique `##` : `[prouvé]`
(`[proved]`), la ligne « → invariant » prouvée et son mutant en détail, ou `[toi]`,
pas prouvée et sa raison ; une rubrique sans étiquette connue compte pour pas
prouvée. Sa preuve passe quand chaque ligne de la note a sa rubrique `[prouvé]` ; sans
ligne « → invariant » : « Rien à prouver. », avec ou sans fichier. Le nombre de
rubriques `[toi]` d'un fichier de retour (`align.md`, `preuve.md`) dit s'il attend
l'utilisateur.

**Les artefacts** : les documents que l'agent produit hors du projet (PDF,
présentations, wireframes, documents externes, fichiers de conception :
preuve de concept ou autre ; skill `artefact`, F-93), un fichier chacun,
dans le **dossier d'artefacts du projet** : un seul par projet, hors des
sorties de l'agent (`userData/vibecoder-artifacts/<clé>/`, la clé étant le
dossier git commun du dépôt, résolu ; un dossier hors git est son propre
projet). Le dépôt, ses worktrees et leurs robots partagent le même dossier et
y ont tous accès : tout robot du projet voit, lit et écrit les mêmes artefacts,
les mêmes pour toutes les branches (jamais mis de côté avec une branche). Claude
Code le reçoit en dossier de travail en plus (F-58). Le panneau *Artefacts*
(son arborescence, son menu, le dépôt), *Copier dans le projet* et le skill
`artefact` travaillent dans ce dossier. Deux robots qui écrivent le même nom écrivent le même fichier : risque
accepté, c'est le prix d'un dossier commun (le skill dit de relire le fichier
avant de l'écrire). Retirer un agent, un robot ou un worktree ne touche pas à ce
dossier (F-110) ; un dossier caché écrit là y reste, et le panneau ne le liste
toujours pas. Le **panneau des artefacts** (bouton *Artefacts*,
F-92) : à gauche l'arborescence des artefacts (voir plus bas ; vide → ce que
fait le skill, en une ligne) ; au centre le fichier qu'on y choisit (le
premier par défaut ; disparu → le premier ; plusieurs éléments choisis, ou un
dossier : le centre reste vide) :
- ce que Chromium rend — `page` (HTML, SVG) et `media` (image, PDF, son,
  vidéo) — dans un cadre, servi en flux par le principal sous
  `vibe-artifact://<agent>/a<i>`, jamais coupé, rechargé quand il change ;
  son type d'après l'extension, `nosniff` (un `.png` qui contient du HTML
  ne devient jamais une page). Une `page`, dans un cadre `sandbox` et avec
  l'en-tête `Content-Security-Policy: sandbox; default-src 'none';
  style-src 'unsafe-inline'; img-src data:; font-src data:` : ni script,
  ni réseau (un wireframe tient en un fichier, CSS en ligne, images en
  `data:`) ; la page du panneau n'accepte de cadre que de `vibe-artifact:` ;
- le reste en texte, en lecture seule : `markdown` rendu (F-104), tout autre
  fichier, un binaire compris, dans la vue du code (F-113), décodé en UTF-8
  comme le ferait un éditeur : illisible, mais montré. Lu jusqu'à
  `artifactTextMax` (§ 9), jamais au-delà : « fichier tronqué », *Ouvrir
  dans l'éditeur* montre la suite. Suivi comme le fichier de *Voir le code*
  (F-100) : relu à chaque écriture de l'agent.

En tête de l'artefact : *Ouvrir dans l'éditeur*, *Montrer dans le dossier*
(une icône de dossier : le gestionnaire de fichiers s'ouvre sur le fichier,
jamais lancé — pour le récupérer ou l'envoyer ; l'écran ne passe que l'id de
l'artefact, `dir:<id>`, le principal retrouve son fichier) et *Copier dans le projet*
(`copy-artifact`, F-114). La conversation reste à droite : on demande à
l'agent de retoucher l'artefact affiché.

**Gérer les artefacts** : l'utilisateur range lui-même les artefacts du projet,
comme dans l'explorateur de VS Code. La liste à gauche est une **arborescence**
de fichiers et de dossiers (les dossiers d'abord, puis les fichiers, par nom ;
un dossier vide s'y voit ; un dossier caché, un lien non) : les dossiers se
plient et se déplient (pliés au départ), *Tout replier* les referme tous. Le
choix, le pliage et le presse-papiers tiennent par le nom de l'élément (son
chemin sous le dossier d'artefacts) : ils survivent à un nouveau relevé.
- **Menu contextuel** (clic droit) : sur un élément (fichier ou dossier),
  *Renommer* (un seul), *Supprimer*, *Copier*, *Couper*, *Coller* (s'il y a
  quelque chose à coller), *Dupliquer* (un seul) ; sur un dossier ou sur le
  vide de la liste, en plus *Nouveau fichier* et *Nouveau dossier* (dans un
  dossier, un sous-dossier). Clic droit sur un élément hors de la sélection : il
  devient la sélection.
- **Clavier** : ↑ ↓ Début Fin parcourent l'arborescence (Maj étend la
  sélection) ; ← plie le dossier ou remonte au parent, → le déplie ou descend au
  premier enfant ; F2 renomme ; Suppr supprime ; Échap annule un renommage.
  Ctrl et Maj au clic choisissent plusieurs éléments (une plage, ou un à un) ; une
  sélection se supprime, se déplace, se copie, se coupe, se duplique et se copie
  dans le projet (*Copier dans le projet*, sous la liste).
- **Nom tapé** : *Renommer*, *Nouveau fichier* et *Nouveau dossier* ouvrent un
  petit champ de texte à la place du nom (ou sous le dossier), où le nom sans son
  extension est sélectionné ; Entrée valide, Échap ou la perte du focus annulent.
  Un nom refusé (vide, `.` ou `..`, avec `/` ou `\`, de plus de 255 octets, déjà pris
  parmi ses voisins, ou un dossier qui commence par un point : il serait caché)
  met l'encart en rouge, avec un court message qui dit pourquoi, et Entrée ne
  valide pas. Le principal revérifie le nom (`plainName`) et décide ; la page ne
  fait que prévenir. Renommer ne numérote jamais : un nom pris est refusé.
- **Supprimer** demande toujours confirmation, dans une petite boîte dessinée
  dans le panneau (une pour toute la sélection, le focus sur *Annuler*, Échap
  annule) ; confirmé, l'élément part dans la **corbeille du système**
  (`shell.trashItem`, aucun programme lancé), récupérable : jamais effacé
  définitivement. La page envoie, avec les ids, les noms confirmés ; le principal
  compare chacun au nom de son id dans son dernier relevé et, au premier écart (un
  robot a écrit entre le relevé et le clic, les ids ont glissé), refuse tout : rien
  ne part à la corbeille.
- **Déplacer, copier, dupliquer** : un élément se déplace dans un dossier par
  glisser-déposer (ou *Couper* puis *Coller*) ; *Copier* puis *Coller* et
  *Dupliquer* le copient, le second dans son propre dossier. Lâcher sur un dossier
  : ce dossier ; sur un fichier : son dossier ; sur le vide : la racine. Un dossier
  se renomme, se déplace, se copie et se supprime avec tout son contenu, comme un
  fichier ; il ne se déplace jamais dans lui-même ni dans un de ses sous-dossiers
  (refusé). Là où le nom est déjà pris, le nouveau prend le premier numéro libre
  avant son extension (`rapport-2.md`), comme au dépôt, sans rien écraser ; un
  dossier n'est jamais mêlé à un dossier du même nom. Déplacer ou renommer :
  copie exclusive (`COPYFILE_EXCL`) puis effacement de la source une fois
  arrivée, jamais `rename` (qui écrase un fichier sur Linux) ; un dossier qui garde
  un lien ou un fichier caché reste en place, et le résultat le dit (en échec, même
  si le reste est arrivé). Déplacer vers le dossier où l'élément est déjà : rien.
  La sélection, et donc le fichier du centre, suit le nom attendu après
  *Renommer*, *Déplacer* ou *Nouveau* ; refusé ou en échec, elle ne l'attend plus.
- **Le résultat** : sous l'arborescence, la dernière ligne des actions du panneau,
  dépôt compris (« … » en cours, ✓ ou ✗ et sa ligne, le détail au survol) : ce que
  le principal a refusé (un nom pris entre le relevé et Entrée…) ou fait à moitié.
- Chaque élément désigné passe par un chemin **sous le dossier d'artefacts, sans
  lien** (la racine, chaque segment, le dernier : fichier ou dossier ; un lien
  n'est jamais suivi). La page n'envoie que des ids `a<i>` (fichier) ou `d<i>`
  (dossier, dans l'ordre des noms) du dernier relevé, jamais un chemin, que le
  principal relit dans le relevé de l'agent affiché ; un id inconnu ou en forme de
  chemin ne désigne rien (I-37). Ces actions (`rename-artifact`,
  `new-artifact-file`, `new-artifact-folder`, `trash-artifacts`, `move-artifacts`,
  `copy-artifacts`, `duplicate-artifacts`) sont directes et ne se lancent que par
  l'appli ; elles ne touchent pas au dépôt (I-39).
- Glisser une ligne dans l'arborescence ne porte que notre type de glisser, jamais
  un `File` : rien n'est joint à la conversation, rien n'est copié par
  `conv:vibeDrop`.

**Ajouter des artefacts** : l'arborescence est elle-même la zone de dépôt, comme
dans VS Code (il n'y a ni zone séparée ni bouton *Ajouter* : le dépôt et *Nouveau
fichier* suffisent ; `add-artifact`, F-114). Un fichier ou un dossier glissé depuis le gestionnaire
de fichiers est **copié** dans le dossier où on le lâche (un dossier : celui
visé ; un fichier : son dossier ; hors de toute ligne : la racine), l'original
intact, et paraît dans l'arborescence. Ce dossier d'arrivée passe par
`conv:vibeDrop` comme l'id `d<i>` du dernier relevé, jamais comme un chemin ; un id
absent : la racine ; un id inconnu, en forme de chemin ou qui n'est pas un dossier :
refusé (`unknown-artifact`), rien n'est écrit, pas même à la racine ; le chemin du
dossier, sans lien (sinon refusé) :
- un fichier, sans limite de taille (copié sans être chargé en mémoire ; son
  affichage en texte reste coupé à `artifactTextMax`) ;
- un dossier, avec ses sous-dossiers ; un dossier du même nom ne se mêle pas : le
  nouveau prend le premier numéro libre (`a-2/`), comme un fichier ; un dossier qui
  contient le dossier d'artefacts du projet, ou l'est, est refusé ;
- un nom déjà pris : le nouveau prend le premier numéro libre avant son
  extension, à partir de 2 (`rapport-2.md`), sans rien demander, sans jamais
  écraser ;
- un lien est refusé, avec un message (l'accepter serait copier sa cible) ; un
  lien dans un dossier déposé est passé, et le message le dit ; un dossier
  caché (`.git`, `.cache`…), seul ou dans un dossier, n'est pas copié, et un
  message le dit ; un fichier caché est copié et montré ;
- un fichier sans chemin sur le disque (collé, ou tiré d'une autre appli) ne
  s'ajoute pas : un message le dit (*Déposez-le depuis le gestionnaire de
  fichiers*).
L'arborescence garde son dépôt : rien de ce qu'on y lâche (un fichier venu du
gestionnaire de fichiers, ou un élément glissé dans l'arborescence) n'est joint à
la conversation. La copie ne
bloque pas le principal (un fichier à la fois, hors du fil principal) ; le
disque plein est un échec, dit par le message. La liste, elle, s'arrête à
1 000 fichiers : un dossier plus gros est copié en entier, la liste ne montre
que les premiers.

**Les anciens artefacts** (`vibecoder-out/<agent>/artifacts/`, d'avant le dossier
du projet, ceux d'un agent retiré compris) rejoignent le dossier de leur projet
à chaque démarrage, sans bloquer le démarrage (`moveContents` : rien n'est
écrasé, un nom déjà pris reçoit le premier numéro libre, un échec laisse le
fichier en place, avec un message, et il repart au démarrage suivant) ; le
dossier vidé part. Le projet d'un agent est celui de son dossier dans la
configuration ; pour un agent retiré, celui que gardait l'ancien
`artifacts-left.json` (`{ <id de l'agent> : <son dossier résolu> }`), que l'appli
n'écrit plus : lu pour la migration, supprimé quand plus aucune de ses entrées
n'a de fichier ; un id sans dossier connu garde ses artefacts, au journal.

**F-96 Les actions** sont des données (`actions.<langue>.json`, F-107) : par
bouton `id`, `flow` (`create`, `review`, `both`), `step` (son étape ; `null` :
la barre des skills), `kind` (`send` : envoyé ; `prefill` : préparé dans le
champ), `needs` (`text` : il exige un texte ; sinon `none`), `reads`
(`true` : elle ne fait que lire ; absent : elle modifie la branche, le cas
sûr pour une action ajoutée ; F-115), `label`,
`hint`, `text` (le gabarit). Les `id` livrés sont un contrat : le parcours
(l'action mise en avant) et les vues (les boutons propres à une étape) s'y
réfèrent ; on personnalise `label`, `hint` et `text`, retirer une entrée
retire son bouton. Une entrée invalide est ignorée (champ manquant ou d'un
autre type, étape inconnue, id déjà vu, `prefill` avec une autre variable que
`{{quote}}`) ; un fichier illisible (ou pas un tableau JSON) : celui livré ;
un tableau vide : aucun bouton. Montrées : celles du flow, et `both` ;
*Où j'en suis ?* seulement si le skill `gear-guide` existe (projet ou
utilisateur).
**Un message, dans sa conversation** : une action `send` est un message
écrit comme s'il avait été tapé — son gabarit, ses variables remplies (un
skill `/vibecoder:<nom>` et ses arguments, ou du texte). Celle d'une étape
(`step` renseigné) part dans **sa propre conversation**, une course (F-115),
suivie dans l'onglet *Actions*. Les autres (`vibe`, `guide`,
`propose-run`, `new-request`) vont à l'agent affiché, sur sa conversation en cours, par le
chemin du champ (`sendToAgent` : refusé à un agent au travail, I-25 ; jamais
à un autre agent, I-33, ni à une ancienne conversation, I-22) : revenu en
conversation, elles sont dans le fil. Les actions directes, elles,
l'appli les fait sans agent ni modèle (F-114). La page ne donne qu'un id d'action de son
dernier relevé et ses arguments (texte, rang de module, hash de commit,
id de test, numéro de PR, rang d'une vérification, réponses, verdict,
modèle), chacun vérifié (type, taille, valeur) par
la variable qui le prend ; une action inconnue, grisée ou `prefill` est
refusée.

**F-97 Gabarit et variables** (liste fermée, I-38) : `{{text}}` (le champ
de la conversation, F-98, sans ses blancs autour, 20 000 caractères au plus) ; `{{out}}` (F-95) ;
`{{lang}}` (`fr`, `en`) ; `{{branch}}`, `{{base}}` ; `{{note}}` (le chemin de
la note) ; `{{ref}}` (`WORKTREE` en créateur, `HEAD` en relecteur : la PR est la
branche du dossier, F-101) ; `{{files}}` (les tests d'invariants pas encore lus,
`chemin@empreinte` ; un test désigné par son id dans le relevé, `t<rang>`,
lu ou non : *Relire* ; `*` : tous, *Tout relire* ; un id absent refuse
l'action) ; `{{module}}` (le module choisi par son rang, sinon le
premier pas commencé : `chemin — contrat`) ; `{{commit}}` (un
commit de la branche, sinon `WORKTREE` : les changements en cours) ; `{{pr}}`
(le numéro donné, sinon la PR du relevé) ; `{{answers}}` (« 1. … » par ligne,
une vide : « (pas de réponse) » ; 50 réponses de 2 000 caractères au plus) ; `{{verdict}}` (`approve`, `comment`,
`request-changes`) ; `{{draft}}` (« - [cible] texte » par remarque) ;
`{{check}}` (le rang d'un élément de `checks.json` du relevé, sinon `*` :
toutes ; un rang absent refuse l'action) ;
`{{quote}}` (`prefill` seulement, rempli par la page) ; `{{prefix}}` (le
préfixe des commandes vu de l'agent, F-112 ; vide permis). Les skills de
VibeCoder reçoivent d'abord `{{lang}} {{out}}`, puis, juste après, leurs
**arguments nommés** : `note={{note}}` (le chemin de la note ; *Vérifier la
conception*, *Poser la forme*, *Écrire les invariants*, *Reprendre*, *Générer les
modules*) et `base={{base}}` (la branche de base ; *Générer les modules*,
*Générer ce module*, *Commiter les modules*, *Vérifier l'alignement*, *Préparer
le commit*, *Relire le diff*, *Ponytail review*, *Replier les fixups*, *Plan de
test à l'écran*, *Valider la feature*). `{{note}}` ne va qu'aux actions qui n'ont pas
de sens sans note : un gabarit qui le porte est refusé sans note (la règle
ci-dessous), donc *Rédiger la note* et toute action lancée aujourd'hui sans note
(*Générer ce module*, *Commiter les modules*, *Préparer le commit*, *Relire la
note*…) ne le reçoivent pas. Un skill qui reçoit `note=` ou `base=` ne cherche
pas ; lancé à la main, ou par un `actions.<langue>.json` modifié (jamais
remplacé, ses gabarits ne les passent pas), il cherche comme avant. Une valeur qui manque refuse
l'action, avec sa raison (« Dictez ou écrivez d'abord dans le champ », « Pas
encore de note pour cette branche », « Ce commit n'est pas dans la
branche »…) ; une variable inconnue aussi, ou une valeur autre que
`{{text}}`, `{{answers}}` et `{{draft}}` qui contient un caractère de
contrôle (« Action mal écrite (variable inconnue), ou valeur refusée
(caractère de contrôle) : voir le dossier de VibeCoder. »). Un **modèle**
choisi dans les réglages (F-99), autre que le conseillé : le `/vibecoder:<nom>` de tête devient
`/vibecoder:<nom>--<modèle>`, sa variante (F-106). Un **effort**
choisi (F-99) : `/vibecoder:<nom>--<modèle>--<effort>`, avec le modèle
choisi, sinon le conseillé. Un argument
qu'aucune variable du gabarit ne lit (`module`, `commit`, `file`, `pr`,
`check`, `answers`, `verdict`, et `text` quand le gabarit n'a pas `{{text}}` :
`modules`, `commit-modules`, `commit-prepare`, `checks`…, sauf un `text` vide),
ou un modèle ou un effort que l'action ne propose pas, ne refuse pas l'action :
il est ignoré, et l'orchestrateur en est prévenu (F-115) ; le texte, lui, reste
absent du message. Ce que lit un gabarit se calcule (`readArgs`, d'après les
variables du gabarit) : `buildMessage` en tire les arguments ignorés, et la
table des commandes (F-116) les cite pour chaque action.

**F-98 Les champs** : une action dont le gabarit prend `{{text}}` emporte le
texte du **champ de la conversation** (le seul : plus aucune étape n'a le
sien, 0.15.0), ou l'exige (`needs: text` ; vide → « Dictez ou écrivez d'abord
votre demande dans le champ, puis cliquez. », le champ prend le clavier) : on
dicte, puis on clique.
- *Rédiger la note*, et la nouvelle demande de la base (F-110), lancées d'un
  clic (plus de bouton chez le créateur depuis la 0.16.0, F-93 : on les demande
  à l'agent, dans la conversation ; la CLI garde le même contrat) : le texte du champ, exigé, **et ses pièces jointes** (F-69) ;
  *Poser la forme* et *Écrire les invariants (rouges)* partent toujours sans
  texte, jamais avec celui du champ : on n'envoie pas par surprise un brouillon
  de la conversation. Par la CLI `vibecoder`, rien ne change ;
- un message sans étape (*Où j'en suis ?*, *Proposer les commandes*) : le
  texte du champ, s'il y en a, et lui seul.

Sauf quand la vue donne elle-même le texte
(*Appliquer* une remarque de la ponytail review : la remarque ; *Tout
appliquer* : rien) : le champ ne part pas, il reste tel quel. Partie, le
champ se vide (ses pièces jointes aussi pour *Rédiger la note* qui les a
emportées ; pour un message sans étape elles restent, une action n'envoie pas
d'image) et le fil descend ; refusée, sa raison
s'affiche sous le champ de la conversation. Une action `prefill`
ajoute son texte au champ de la conversation (à la ligne s'il n'est pas vide), `{{quote}}`
remplacé par ce qu'on cite (une ligne, 300 caractères au plus ; des lignes de
des lignes de code, F-101 : entières, gardées, sans limite, à la suite du texte
si le gabarit n'a pas `{{quote}}`) : en créateur, la **bulle de remarque** (*Commenter*)
sur une ligne de la note ou sur une règle de l'étape Invariants (« À propos de « … » : ») ;
elle n'est plus sur le code, ni sur un module, ni sur un cas de test (0.16.0) ; possible
pendant que l'agent travaille. On complète, puis on envoie. En relecteur (0.16.0), *Commenter* va au brouillon de revue (F-101), pas au champ : la **bulle** d'une règle, d'un test ou d'un constat de la relecture du code ouvre une zone de remarque, vide pour une règle ou un test, déjà remplie avec le constat (son titre, puis son détail, coupé à la borne du brouillon) pour un constat ; le 💬 du point d'attention d'un test y verse ce point d'attention, à la suite de ce qui y est déjà écrit, rien d'effacé — le relecteur précise, et seul *Ajouter* le verse au brouillon (*Annuler* : rien). Rien ne cite dans le champ de la conversation, et *À revoir* ne fait que marquer (F-101). Sur la note, *Poser une question à l'agent* (icône « ask », à côté de *Commenter*) cite l'élément dans le champ, comme le *Commenter* du créateur, et n'envoie rien. Créateur : plus de carte par cas à l'écran depuis la 0.16.0 (le point d'attention d'une lecture se lit sous sa règle, F-100).

**La dictée** (le micro de chaque zone de prompt, maintenu, F-68 : il donne
le clavier à son champ) va à la zone de texte qui a le clavier : la zone de
commentaire du relecteur (*Commenter*, le bouton de remarque d'un
*À revoir*, une remarque du brouillon), la réponse libre d'une question ouverte ; à la place de la
sélection, précédée d'une espace si le texte avant le curseur ne finit pas
par un blanc, coupée à la longueur de la zone (un commentaire : 5 000
caractères ; plus de place : rien n'est inséré). Les éditeurs de code (la
note, *Voir le code*, un test) et les champs d'une ligne (recherche de
branche, nom de branche, skill) ne la reçoivent pas ; aucune zone n'a le
clavier : le champ de la conversation (F-68). Pas de canal de plus : la
même dictée, insérée par la page.

**F-99 Qui travaille, grisée ou masquée.** Chaque action envoyée dit qui
travaille, d'après l'en-tête du skill qu'elle appelle, dans le plugin de
l'utilisateur (`model`, et `effort` au-delà de `low`) : *haiku*, *sonnet ·
moyen*, *opus · élevé* ; sans modèle, ou sans skill (un message en clair,
`/gear-guide`) : *agent*, le modèle de l'agent. Le bouton ne l'affiche pas
(0.15.0) : le modèle se règle dans les paramètres ; il est dans l'infobulle du
bouton, sous son explication (« — sonnet »), et dans celle de « via ». Seule
la marque « direct » reste sur le bouton : elle dit ce qui va se passer, pas un
réglage. Une action grisée dit
pourquoi (sous le bouton, au survol ; le principal la refuse de même) :
une action d'étape, par la règle des courses (F-115 : « Cette action est
déjà en cours », « Une autre action est en cours », « Une action modifie la
branche ») ; un message sans étape, quand la conversation travaille
(« L'agent travaille » : elle ne grise plus que ceux-là, et pas ceux qui
travaillent ailleurs, `new-worktree` et `pr-worktree`, F-115) ; une action directe en cours (toutes, F-114) ; une recette du projet en
cours dans la famille (les choix de lieu de F-110 et *Retirer le worktree* :
« Une recette du projet est en cours », F-111) ; *Changer de branche*,
*Revenir sur la branche principale*, *Aller sur la branche* et *Créer ici*
sur un dossier qui a des modifications (« Des modifications en
cours », F-110) ; *Pull* sans branche distante suivie ou à jour avec elle
(F-92) ; pas de dépôt git ; en relecteur, ses étapes, le dossier
pas sur la branche de la PR ni sur son robot (« Passer d'abord sur la
branche de la PR ») ; brouillon de revue vide ; **pas encore de note** (la
Forme, les invariants, un gabarit qui lit la note, *Reprendre* : « Pas encore de
note ») : une action qui a besoin d'une étape précédente faite est grisée,
jamais masquée, pour que chaque étape s'ouvre, même sans note.
Une action qui **n'a pas encore de sens** n'est pas affichée (`hidden`), au
lieu d'être grisée ; elle garde sa raison (`disabled`) : le principal la
refuse de même. Ce sont : aucun test d'invariant ; *✓
Commiter* sans commit préparé ; *Envoyer les réponses* sans question
ouverte ; *Vérifier la conception* sans note rédigée (F-100) ; *Prouver les invariants* sans ligne « → invariant » de la note (rien à
prouver, F-100) ; *Replier les fixups* sans commit `fixup!` ; les choix de F-110
(ceux d'une PR avant qu'elle soit chargée, et sur sa branche ou sur son
robot ; ceux d'une nouvelle demande sans demande en attente ; *Dans un
nouveau worktree* sur un enfant, ou la PR déjà dans un
worktree ; *Mettre de côté* sans modifications ; *Revenir sur la branche
principale* sur le robot d'une PR, ou sur la base sans PR chargée ;
*Retirer le worktree* hors d'un enfant ; *Pousser* sans rebase réussi
depuis le dernier push ; la nouvelle demande hors de la base) ; *Reprendre*
(le moteur) tant que la note a des
questions ouvertes (« Répondre d'abord aux questions de la note ») ou n'est
pas validée (« Valider d'abord la note ») ; masquée aussi pendant que le système
enchaîne (le bouton dit alors *Arrêter*), un tour de la conversation ou une course en cours (« Déjà en cours ») ;
*S'assigner la PR* (relecteur) tant qu'on est l'auteur ou déjà assigné, *Me
retirer de la PR* (créateur) tant qu'on n'est pas assigné ou qu'on est
l'auteur ; en relecteur, *Rebase*, *Pousser* et *Copier dans le projet*, et
toute action qui édite, génère ou commite (elles ne sont pas au relevé du
relecteur, F-101). En créateur, l'étape PR suit l'état de la PR, qui ne
fait que masquer (une demande juste après *Valider la feature* ne tombe pas
sur un relevé en retard) : sans PR, *Valider la feature (ouvrir la PR)*
seule ; ouverte (ou son état pas encore connu), *Diagnostiquer la CI* ;
fusionnée, *PR mergée → revenir sur la base* (sur un
enfant, *Retirer le worktree* à sa place) ; fermée, aucune. De même, *Écrire les invariants*
d'une note sans ligne « → invariant » est masquée sans être grisée, et
revient quand la note en gagne une.
Une action dont le skill fixe son modèle (*haiku*, *sonnet* ou *opus*) et
qui court à part (F-115) ou tourne en sous-contexte (`context: fork`)
propose aussi les deux autres (`models`, le conseillé : `model`) : on peut
prendre plus léger (ou plus fort). L'**effort** se choisit de même, pour
toute action dont le skill fixe son modèle (`efforts` : ceux du menu de
l'agent, de faible à maximal). Le **modèle** et l'**effort** de chaque
action se règlent dans la page des réglages (§ 8, catégorie *Actions* : une
rubrique par action), plus sur l'écran : les boutons d'action restent seuls.
Le choix est écrit dans `config.json` (`actionModels`, `actionEfforts`, § 9) :
il vaut pour tous les agents et tient après un redémarrage. Le principal le
prend dans la configuration ; ce qu'une page ou une demande de l'orchestrateur
en dit est ignoré (et dit, F-115). Sans choix, rien ne change : le modèle
conseillé, et l'effort de l'en-tête du skill, ou celui de la variante du
modèle choisi (haiku faible, sonnet moyen, opus élevé) ; un choix n'est
envoyé que s'il diffère. Le *qui travaille* (`who`), dans l'infobulle du
bouton, suit le choix. Un skill sans sous-contexte envoyé à la conversation (`vibe`…) garde
le modèle de l'agent. Jamais Fable (I-36) : le choix qui le nommerait, même
écrit à la main dans `config.json`, est écarté.

**F-115 Les courses** (une action d'étape qui court à part de la
conversation ; note `0.9.0-actions-independantes.md`).
- **Sa propre conversation** : une action `send` d'une étape (F-96) lance un
  processus Claude Code neuf, l'entrée `<agent>~<clé>` du runtime des agents
  (la clé : l'id de l'action ; *Envoyer les réponses* reprend celle de la
  note, `note`, et sa session : l'agent qui a rédigé la note garde son
  contexte). Mêmes dossier, consigne et plugin que l'agent (F-58), ses
  sorties pour seul dossier en plus (le dossier des artefacts du projet reste
  un dossier de travail de la conversation seule ; la course le lit par le
  contrôle, ci-dessous), ses propres droits (ci-dessous), interruption comme lui
  (F-59) ; le modèle
  et l'effort de l'en-tête de son skill, en sous-contexte ou non (ou le
  modèle choisi, F-99), sinon ceux de l'agent ; le suivi des fichiers écrits de Claude Code
  (`enableFileCheckpointing`). Pas de limite au nombre de courses ; la
  conversation de l'agent n'est jamais occupée par l'une d'elles.
  **Finie** : son tour fini et plus aucune tâche de fond que le runtime lui
  voit (sous-agents, commandes en fond, F-77) ; jusque-là *en cours*, sans
  limite de temps (une CI qui dure : *Arrêter* à la main). Ses tâches de fond
  tombées à 0, hors tour ou pendant un tour (le rapport du dernier
  sous-agent arrive pendant un tour et attend dans sa file) : encore
  *en cours* 10 s (`GRACE_MS`), comptés dès la fin de ce tour dans le
  second cas, le temps du tour que leur fin réveille ; un tour qui commence
  entre-temps la garde en cours jusqu'à sa fin, elle finit alors avec la
  réponse de ce tour ; sinon elle finit au bout des 10 s. Revenue au repos à
  la fin de son tour, sans tâche de fond et sans qu'aucune soit tombée
  pendant ce tour, elle finit aussitôt. Limite : un agent qui repart plus de
  10 s après la fin de sa tâche trouve sa course déjà finie. Un sous-agent
  que `SendMessage` relance (même tâche, qui repart) tient la course *en cours*
  comme au premier lancement (T-32, I-44) ; un sous-agent fini après le dernier
  tour sans qu'aucun tour relise sa réponse : la course finit *en échec*, une
  ligne en tête de sa réponse le dit (comme une commande de fond coupée).
  Finie, la course est fermée (son processus aussi), puis l'avis de
  fin.
  **Sans arrière-plan en sous-contexte** : une course dont le skill a
  `context: fork` part avec `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` (le
  sous-contexte attend ses commandes au premier plan, il ne les lance pas en
  fond, où sa réponse les couperait). Si une commande d'arrière-plan a quand
  même été coupée à sa fin (une tâche `local_bash` arrêtée), la course finit
  *en échec* et sa réponse commence par la ligne qui le dit (« n commande(s)
  en arrière-plan coupée(s) à la fin de l'action : le travail est
  peut-être incomplet »).
- **Ses droits** (0.15.0, I-57 ; `core/vibecoder/rights`, `runRights` de
  `controllers/runs`) : une course part en mode `dontAsk`, quel que soit le mode
  de l'agent principal (que l'action parte d'un clic ou de l'orchestrateur) :
  ce que ses outils permettent passe, ce que sa liste de refus touche est refusé
  sans question ; la conversation de l'agent, elle, garde son mode. Donnés au
  SDK au départ, les mêmes pour ses sous-agents :
  - *ses outils* (`allowedTools`) : le `allowed-tools` de son skill (`note` pour
    `answers` ; `${CLAUDE_SKILL_DIR}` et `${VIBECODER_OUT}` remplacés), hors ses
    règles `Bash(…)`, plus `Bash` **entier** : une commande du projet passe,
    enchaînée ou non (`cargo build && cargo test`, `cd frontend && npm test`,
    `npx vitest`, `git -C …`). Plus aucune commande n'est lue dans `AGENTS.md` ;
  - *sa liste de refus* (`disallowedTools` ; `DENIED` de `core/vibecoder/rights`,
    une vingtaine de lignes en groupes) moins ce que son skill en ouvre : ce qui
    part à l'extérieur (`git push`, `curl`, `wget`, `gh` par ses seules
    sous-commandes qui écrivent — `pr create`, `edit`, `review`, `comment`,
    `close`, `reopen`, `ready`, `checkout`, `api`, `issue`, `workflow`, `run
    rerun`, `run cancel`, `label`, `secret` ; ses lectures passent), les
    dépendances (`npm install`, `i`, `add`, `yarn add`, `pnpm add`, `cargo add`,
    `cargo install`, `pip install`), ce qui détruit (`git reset --hard`, `git
    clean`, `git restore`, `rm -rf` et ses graphies `-fr`, `-Rf`, `-r -f`, `sudo`), git qui écrit (`add`, `commit`,
    `rebase`, `checkout`, `switch`, `stash`, `merge`, `tag`, `branch -D`, `config`,
    `pull`), le système (`kill`, `pkill`, `systemctl`, `podman`, et `distrobox`
    par `create`, `rm`, `stop`, `assemble`, `upgrade` seulement : le préfixe des
    actions, `distrobox enter <box> --`, passe) et la CLI de VibeCoder
    (`node *vibecoder.mjs*`). Chaque commande est refusée seule ou suivie
    d'arguments (`Bash(git push *)`), et aussi derrière le préfixe des actions
    (Claude Code n'ôte pas un préfixe comme `distrobox enter dev --`) et, pour
    git, derrière `-C` et `-c` (`Bash(git -C * push *)`). Claude
    Code juge lui-même chaque morceau d'un enchaînement (`&&`, `||`, `;`, `|`,
    sous-shell, `$(…)`), le refus l'emporte, et ôte `timeout`, `time`, `nice`,
    `nohup`, les assignations de tête : `timeout 60 git push` est refusé ;
  - *ce que son skill en ouvre* : une règle `Bash(<commande>)` de son
    `allowed-tools` dont la commande (assignations `VAR=…` de tête ôtées)
    commence mot pour mot par celle d'un refus la retire des refus (*Valider la
    feature* : `git push`, `gh pr create` ; *Commiter* : `git add`, `git commit` ;
    *Appliquer la revue* : `git add`, `git commit --fixup` et `git commit -m`
    (le commit ordinaire de l'historique simple) ;
    *Replier les fixups* : `git rebase` ; *PR mergée → revenir sur la base* :
    `git switch`, `git pull` ; le détail par action, dans le README ; *Lancer les
    vérifications* n'ouvre pas la CLI : l'appli lance elle-même la ponytail
    review ; *Publier la revue* n'ouvre pas `gh api`, qui pourrait fusionner par
    un PUT). `git branch *` n'ouvre pas `git branch -D`. `gh pr merge`, `gh release` et `gh repo` (`NEVER`) ne sont
    rouverts par aucun skill : fusionner une PR ou publier une release reste à
    l'utilisateur.

  Compromis accepté : une forme tordue que Claude Code ne découpe pas (`bash
  -c "…"`, `env`, `npx`) peut passer ; les agents et les skills sont les nôtres,
  et le vrai rempart reste les bornes de fichiers ci-dessous. Les
  `permissions.allow` des réglages de l'utilisateur s'ajoutent, `ask` vaut un
  refus, `deny` l'emporte ; ses `additionalDirectories` ne sont pas repris. Un
  crochet `PreToolUse`
  (`core/vibecoder/bounds`), que l'appli donne au SDK pour la course et ses
  sous-agents, borne les outils de fichiers, avant les règles de l'utilisateur :
  lecture dans le projet, les sorties de l'agent, le plugin de VibeCoder et le
  dossier d'artefacts du projet (s'il existe et n'est pas un lien : un artefact
  rangé depuis le dépôt principal se lit aussi depuis un worktree ; il reste
  hors des dossiers de travail du processus, que la conversation garde) ;
  écriture dans le projet et les sorties (une action `reads` : les sorties
  seules), jamais dans le dossier d'artefacts ; jamais `.claude/`, `.git/`, `.husky/`, un `AGENTS.md` ni un
  `package.json` ; un motif de `Glob` ou un `glob` de `Grep` absolu ou qui monte
  par `..` est refusé. Ce que lance une commande permise n'est pas borné.
  *Les refus* sont lus dans le flux, de l'agent et de ses sous-agents, pendant
  un tour ou hors tour : un refus ne fait plus échouer la course (l'appel reste
  refusé, seul l'état change) : elle finit comme son travail, *terminée* s'il
  l'est ; une ligne en tête de sa réponse cite chaque appel refusé (outil et
  cible), lectures comprises, en une seule liste (« Appels refusés : Bash
  « git push », Read « … ». »). C'est l'orchestrateur ou l'utilisateur qui juge,
  en la lisant, si le travail est complet (le skill `vibe` s'arrête si l'agent
  y dit son travail incomplet). Une course ne demande donc plus
  rien : l'onglet *Actions* ne montre aucune demande d'autorisation (les
  commandes `run.allow`, `run.always` et `run.deny` restent dans la table).
  *La consigne d'outils* : l'appli ajoute au prompt système de chaque course
  (`TOOL_RULE`, `systemAppend` de `core/agents/options`, après la consigne de
  l'appli ; la conversation de l'agent, qui n'a pas de droits, ne la reçoit
  pas), la même pour toutes et en anglais, trois lignes : rester dans son
  travail ; lire avec `Read`, `Glob` et `Grep` plutôt que par `Bash` ; une
  commande refusée se contourne autrement ou se signale dans la réponse, sans la
  répéter. Plus d'« un appel par commande » ni de liste à recopier. Elle ne
  change pas les droits, elle évite les refus.
  *Vibe* tourne dans la conversation : sa liste (la CLI de VibeCoder,
  `Read`, `Glob`, `Grep`) ne vaut que pour son premier tour (mesuré), le reste
  suit le mode de l'agent — sauf la CLI : tant que le mode *Vibe* de l'agent
  est en cours (`vibeOn`), la file d'autorisations de sa conversation (I-17,
  `autoAllow` de `core/agents`) accepte d'elle-même les seuls appels `Bash`
  `node <dossier du plugin>/bin/vibecoder.mjs …` (`vibeCliCall` : le script
  résolu, `..` compris, est celui du plugin ; aucune composition ni
  redirection hors guillemets — `;` `&` `|` `<` `>` `$`, accent grave,
  parenthèses, saut de ligne). *Vibe* arrêté, ou jamais lancé : le mode de
  l'agent s'applique, la demande est posée ; toute autre commande pendant
  *Vibe* : posée aussi. Les skills `modules` et `module` (et leur sous-agent `developpeur`) lancent
  les commandes du projet derrière le préfixe de l'agent (`{{prefix}}`, comme
  `verifier` et `commiter-modules`). *Commit* ne supprime plus `commit.md` : à
  la fin de la course, si `HEAD` a bougé depuis son départ, l'appli l'efface.
- **Son dossier temporaire** (0.15.0, I-58 ; `controllers/run-tmp`,
  `runEnv` et `tmpLine` de `core/vibecoder/run-tmp`) : chaque course a le sien,
  `<sorties de l'agent>/tmp/<clé de la course>`, que Claude Code reçoit par
  `CLAUDE_CODE_TMPDIR` (l'environnement du robot, ou celui du processus,
  recopié). Il est vidé au lancement (celui qu'une course de même clé a laissé,
  l'appli tuée en route), et mesuré toutes les 5 s tant qu'elle court. Au-delà de
  `runTmpMax` (`config.json`, § 9 : 1 Go par défaut, absent de la fenêtre des
  réglages), la course est arrêtée comme à la main (*Arrêter* : processus et
  verrou gardés, *Garder* / *Annuler*) et sa réponse commence par une ligne qui
  dit que le dossier a dépassé la borne. Il est effacé à **chaque fin** : finie,
  en échec, échec au lancement, arrêtée à la main ou par la borne, fermée. S'il ne
  peut pas être créé, la course part sans (la variable reste ce qu'elle était).
- **Un ancien résultat ne compte pas** : un `checks.json` dont le `time`
  précède le départ de la dernière course `checks` est ignoré (I-46).
- **La règle** (`blockedBy`, sans modèle) : une action qui **modifie la
  branche** attend toute course en cours ; une **lecture** (`reads`, F-96)
  n'attend qu'une modification, les lectures tournent ensemble ; la même
  action (même clé) ne court pas deux fois. En cours : *en cours*, *attend
  une autorisation*, ou *arrêtée* pas encore tranchée (I-44). Au clic, une
  action retenue est grisée avec la raison (F-99) ; le principal la refuse
  de même. Sauf *Créer une branche dans un nouveau worktree* (`new-worktree`)
  et *Dans un nouveau worktree* d'une PR (`pr-worktree`) (F-110,
  `ELSEWHERE`) : ils travaillent dans un autre dossier, sans toucher à la
  branche de celui-ci ni à la PR qu'il suit ; aucune course ne les retient,
  et ils ne retiennent aucune course. Ni la conversation qui travaille : ils
  restent cliquables (par l'appli, `direct`), seul leur *via* est grisé
  (I-25).
- **L'onglet Actions (n)** : une ligne par course, la plus récente d'abord —
  son libellé, qui travaille, son état (*en cours*,
  *arrêtée — à garder ou annuler*, *finie*, *en échec*,
  *gardée*, *annulée*), depuis quand ; pour *Générer les modules* (`modules`),
  son avancement en plus : la vague en cours, les modules faits sur le
  total, les corrections renvoyées, une relance Opus s'il y en a eu ; *Arrêter* tant qu'elle travaille ; sa
  réponse, repliée (pas de demande d'autorisation : une course ne demande
  rien, 0.15.0). Une course se désigne par l'id de son
  action (`conv:vibeRunOp`), jamais par un texte ni un chemin.
  L'avancement se lit dans le flux du SDK que l'appli lit déjà
  (`core/agents/tasks`), sans fichier ni demande au modèle : une vague, les
  appels `Agent` d'un même message (son identifiant) ; les modules faits, les
  tâches finies, sur les modules restants de la Forme au départ de la
  course ; les corrections, les appels `SendMessage` ; Opus, un appel
  `Agent` avec `model: "opus"`. Gardé après la fin de la course. Un champ
  absent du flux : l'onglet en montre moins ; l'avancement ne décide jamais
  de l'état d'une course et ne la bloque pas.
- **Le signal** : une course qui finit ou échoue se
  signale sur le robot de son agent, avec le bip (F-55) ; finie ou en échec,
  jusqu'à ce qu'on ouvre son onglet *Actions (n)* (F-92 ; chaque course
  retient l'état où elle a été vue) — *finie*, aussi quand son agent est
  affiché ou que sa conversation est lue, *en échec* non : son « ! » reste
  jusqu'à l'onglet. Ses
  tâches de fond (celles des courses vivantes) comptent pour le robot (F-55). Une course en cours fait clignoter le robot dès son départ,
  sans bip, quand rien d'autre ne se signale. Pas de signal pour une course
  arrêtée.
- **Arrêter, puis Garder ou Annuler** : *Arrêter* (onglet *Actions*, ou à côté du
  bouton) interrompt son tour (F-59) ; son processus reste, et elle retient
  les autres, jusqu'au choix de l'utilisateur : *Garder* ce qu'elle a déjà
  écrit, ou *Annuler* — les fichiers que **ses** outils d'édition ont écrits
  reviennent à leur état d'avant son premier message (`rewindFiles` du SDK,
  sur son processus, I-45) ; puis elle est fermée. Un retour impossible :
  *en échec*, et la raison.
- **L'orchestrateur** (la conversation de l'agent, skill `actions`) : il agit
  par la commande `vibecoder` (F-116), jamais par des fichiers. Il lit l'état
  par `vibecoder status` et `vibecoder run list` (les courses : leur état, leur
  réponse ; puis les demandes en attente, état `queued`, avec `by`), quand on le
  lui demande. Il demande un lancement par `vibecoder run start <id>
  [clé=valeur…]` (`text`, `module`, `commit`, `file`, `pr`, `check`, `model`,
  `effort`, `answers`, `verdict`, `pieces` — `REQUEST_ARGS`, les arguments de
  `run.start` dans la table, F-116 ; jamais `direct`) ou un arrêt par `run stop
  <id>` ; `run wait <id>`, lancé en tâche de fond, garde la connexion ouverte
  jusqu'à la fin de la course et le réveille (l'appli ne possède pas l'avis de
  fin d'un agent extérieur). Un lancement suit la même règle et les mêmes
  vérifications qu'un clic (`buildMessage`, I-38). **Les refus arrivent tout de
  suite**, par le code de sortie 1, le code d'erreur, le message et ce qu'il
  faut faire : une action inconnue, pas proposée à l'écran, qui ne court pas à
  part, déjà en cours, un argument invalide, ou le moteur arrêté ; une demande
  dont des arguments sont ignorés (F-97) part, et la réponse les nomme. **Seul
  « occupé » devient « en attente »** : à la porte des agents, un lancement
  refusé parce qu'une autre action retient le dossier (`busy`, `changing` ; F-116)
  est mis en file, la CLI répond aussitôt `{ queued: true, by }` (`by` : l'action
  qui retient ; code de sortie 0) ; la file, **en mémoire**, est montrée par `run
  list` et **part de elle-même**, dans l'ordre, au premier passage où plus rien
  ne la retient (une course qui finit ou qu'on garde ou annule, un tour qui
  finit), d'après un **relevé neuf du robot**, fait sur place : panneau caché ou
  écran verrouillé, elle part quand même (T-31). Une même action n'est en file
  qu'une fois ; refusée pour une autre raison qu'« occupé » (grisée entre-temps),
  elle quitte la file et son `run wait` revient. Une demande de
  l'écran, elle, est refusée comme avant. Hors *Vibe*, il ne lance ou n'arrête
  une action qu'à la demande de l'utilisateur ; pendant *Vibe*, il les enchaîne
  (F-103). Le moteur arrêté (*Arrêter*) : la file est jetée (un `run wait` sur
  une demande en attente rend `no-run`), et chaque lancement est refusé
  (`halted` : « … le mode Vibe a été arrêté par l'utilisateur : ne lance plus
  rien », et, depuis la 0.16.0, la réponse dit aussi la pause tenue)
  jusqu'à ce que tout soit au repos ; l'arrêt d'une course reste permis. Une
  pause tenue (F-103) arrête le moteur de même.
  *Retiré en 0.15.0* : la boîte aux lettres, c'est-à-dire `<sorties>/actions.json`,
  `<sorties>/actions/<id>.start` et `.stop`, `<sorties>/run/<nom>.stop` et
  `.restart`, et les avis « demande refusée » et « arguments ignorés » : un
  fichier posé n'est plus lu, `actions.json` n'est plus écrit.
- ***Générer ce module*, une seule course** (0.15.0) : `module` (*opus · élevé*,
  dans la conversation de sa course, sans sous-contexte) suit la boucle de `modules`
  pour un seul module : un agent `developpeur` l'écrit, son diff est relu (les
  mêmes vérifications que *Générer les modules*), les défauts corrigés dans la même
  course, le typage et ses tests relancés jusqu'au vert ; seules les remarques
  `[toi]` (un code qui sort du contrat de la note) remontent. Plus de demande de
  *Relire le diff* dans une seconde course ; le bouton *Relire le diff* seul reste,
  une relecture à la demande, en lecture seule.
- **L'avis de fin** : une course finie (*finie*, *en échec*) envoie une
  ligne à la conversation de l'agent (« VibeCoder : « <libellé> » finie —
  <sa réponse, 300 caractères au plus>.» ; l'état se lit par
  `vibecoder run list`) ;
  gardée tant que la conversation travaille (I-25), envoyée dès qu'elle est
  libre, plusieurs en un message. Pas d'avis pour une course arrêtée :
  l'utilisateur (ou l'orchestrateur) le sait, et son état est dans
  `vibecoder run list`.
- Les courses, les avis, les demandes retenues et le mode *Vibe* sont **en mémoire** ;
  *Nouvelle session*, *Retirer* l'agent ou retirer le robot d'un worktree
  (F-110) ferment et oublient ses courses.

**F-116 La table des commandes** (notes `0.15.0-registre-commandes.md`,
`0.15.0-executeur.md`, `0.15.0-socket-interface.md`, `0.15.0-cli.md` ; étapes 1 à 3b
du pilotage par des agents). Le principe : tout ce que fait le moteur, un agent peut le
faire, avec les mêmes règles, par n'importe quelle porte, à une courte liste
d'exceptions près. La table est le contrat public de ce moteur, pas la liste de
tout ce que fait l'interface : une fonction y entre si le moteur possède ce
qu'un client ne fait pas aussi bien lui-même (un état, une règle de
coordination, une garde). C'est une donnée, indépendante d'Electron et de
TypeScript.
- **Le fichier** : `resources/vibecoder/commands.json`, `schemaVersion` 1,
  chargé et vérifié par `core/commands` (`parseCommands` : JSON illisible,
  version inconnue, nom en double, description vide, argument sans schéma ou
  mot-clé hors `SCHEMA_KEYS`, lecture sans réponse, commande de la liste
  d'exceptions ouverte, commande fermée hors d'elle ou sans raison, argument ou réponse qui nomme un robot : il lève, et
  nomme chaque faute). Chaque commande : son `name` (`run.start`, `proc.restart`,
  `status`…) ; sa `description`, en anglais, pour un modèle (ce qu'elle fait, ce
  qu'elle répond, ce qui la fait échouer ; les libellés pour l'humain restent
  dans `actions.<langue>.json`) ; `kind`, `read` ou `write` ; `agent`, ouverte
  aux agents (par défaut) ou non ; ses `args`, un schéma JSON ; sa `response`, un
  schéma, pour les lectures.
- **La cible** : un dossier, le dépôt, son chemin réel ; jamais l'id d'un robot
  de l'appli. Elle n'est dans les arguments d'aucune commande : elle est dite une
  fois (`target`, en tête de la table) et portée par l'enveloppe des portes
  (le socket, ci-dessous).
- **Ce qu'elle reprend** : `run.start` (l'action, parmi celles qui courent à part ;
  ses autres arguments sont ceux d'une demande de lancement, F-115 : `REQUEST_ARGS`,
  `verdict` compris : `approve`, `comment` ou `request-changes`, lu par `publish`), `run.stop`, `run.keep`, `run.undo`, `proc.start`,
  `proc.stop`, `proc.restart` ; une commande par action directe (F-114, dont
  `add-artifact` et la gestion des artefacts, F-95) et par action ni à part
  ni directe, nommée de son id, avec le schéma complet de ses arguments. Les
  pièces jointes du champ (`pieces` : `{ images, files, selection }`, les bornes
  de `prepareMessage`) sont un argument de `run.start`, `guide`, `new-request` et
  `propose-run`, les commandes dont le gabarit les lit : ouvertes aux agents
  (I-2). `add-artifact` reçoit, pour chaque fichier, soit son chemin (un client de
  la machine), soit son nom et son contenu en base64 (un client sans disque) ;
  un nom sûr, 10 Mio au plus par fichier et 25 Mio par demande décodés ; le
  dossier d'arrivée reste dans les artefacts, rien n'est jamais écrasé (I-37).
  Les commandes d'artefacts (`add-artifact` et la gestion des artefacts) tournent
  en fond mais ne répondent qu'à la fin de leur travail : un refus ou un échec est
  la réponse, avec son code (un id inconnu, élément ou dossier d'arrivée :
  `unknown-artifact` ; un nom refusé : `invalid-args`, `arg: name` ; le disque en
  échec : `failed` ; tout autre refus, un nom pris par exemple, y compris une
  partie refusée d'une liste : `refused`, le motif dans les détails) ; elles ne
  répondent « ok » que si le travail est fait. `copy-artifact` refuse un id
  inconnu avant d'ouvrir sa fenêtre de choix.
- **Les lectures**, d'après le relevé : `status` (la branche, l'étape, la note, la
  PR, ce qui court), `next` (les actions proposées, et pourquoi les autres sont
  grisées), `actions` (pour chacune, les arguments qu'elle lit vraiment),
  `runs` (les courses, puis les demandes en attente, état `queued`), `run.wait` (ouverte aux agents : la connexion reste ouverte jusqu'à la fin de la course d'une action, en cours ou en attente, puis `{ action, state, reply }` ; `no-run` si aucune), `procs`, `logs` (le nom d'un processus ; la fin de son journal, 32 Ko),
  `artifacts` (le dossier des artefacts du projet, son chemin réel — seul le moteur
  connaît la clé du projet —, ses fichiers et dossiers par id), `artifact` (le
  contenu d'un artefact par son id `a<i>`, pour un client sans disque : `text` pour
  un markdown, un texte ou une page, `base64` pour un media, `truncated` au-delà de
  1 Mio ; `null` pour un lien), `draft` (le brouillon de revue : la PR suivie et ses
  remarques) et `invariants` (les tests d'invariants de la branche, cas par cas :
  le fichier, le titre, la ligne et le verdict que l'utilisateur leur a donné à
  l'écran, `ok`, `ko` ou `null` — aucun, ou tombé parce que le test a changé
  depuis ; ni le code ni l'id du relevé : c'est par elle qu'un agent sait
  quels tests l'utilisateur a notés *À revoir*).
- **Le brouillon de revue** : un état que le moteur garde pour chaque PR jusqu'à
  *Publier la revue*. `draft.add` (sa cible, 300 caractères au plus sur une
  ligne, et son texte, 5 000 au plus), `draft.edit` et `draft.remove` (par l'id
  d'une remarque) sont ouvertes aux agents ; aucun numéro de PR en argument :
  c'est la PR suivie au relevé, un agent n'écrit jamais dans le brouillon d'une
  autre ; sans PR suivie, ou en créateur, `no-pr`. `draft.edit` et `draft.remove`
  d'une remarque que le brouillon ne contient pas : `invalid-args` (`arg: id`),
  rien n'est changé.
- **La validation d'une étape** (0.15.0) : `step.validate`, écriture ouverte aux
  agents, créateur seulement. `step` : `forme`, `invariants` ou `modules` — jamais
  `note`, dont la conception est à l'utilisateur : `invalid-args` ; `verdict` :
  `ok` pour valider, absent ou `null` pour retirer la validation, autre chose :
  `invalid-args`. Le même geste que le ✓ de l'écran (F-102), sur le dernier
  relevé, relu avant de l'écrire : l'empreinte de ce que l'étape valide
  aujourd'hui, et ses fichiers retenus ; la validation est marquée posée par le
  système. Refusée (`not-offered`) quand il n'y a rien
  à valider, que l'étape d'avant n'est pas cochée ou, pour `modules` (0.16.0), que
  la preuve des invariants du dernier relevé ne passe pas (F-100, I-66) ; ce refus dit
  pourquoi dans ses détails (`reason` : la preuve qui manque, l'étape d'avant pas
  validée — laquelle, et à qui elle revient —, rien à valider, ou le retrait à la main
  qui tient), et la CLI écrit les détails d'un refus, un par ligne, entre son message
  et sa consigne ; pour un relecteur, `refused`.
  Elle ne recoche jamais une étape qui suit, ne touche pas à l'index du dépôt ni à
  aucun fichier du projet (I-60 à I-62). Après une correction qu'il a faite
  lui-même, l'agent principal revalide ainsi, dans l'ordre, les étapes dont ce
  qu'elles valident a changé (skill `vibe`).
- **Hors de la table**, appels directs comme avant : les gestes de la page
  (*Commenter*, *À revoir* : ils remplissent le champ ; `comment` et `case-ko`
  n'existent plus dans la table), modifier le code ou la note dans le panneau,
  ouvrir dans l'éditeur, un lien ou un fichier, la dictée et la lecture à voix
  haute, les réglages de l'interface, le journal d'un processus, la liste des
  commandes du projet, préparer un worktree, et la forme directe de *Commit*,
  *Publier* et *Base* (la table ne leur donne que `run.start`).
- **Les exceptions, fermées aux agents** (`agent: false`, avec sa `reason`) : un
  agent ne s'accorde pas de droits et ne quitte pas l'appli. Aujourd'hui :
  `run.allow`, `run.always`, `run.deny` (répondre à la demande d'autorisation
  d'une course, I-13 à I-17). À venir, fermées de même : quitter ou
  redémarrer l'appli. Ce qui accorde des droits — les réglages (dont le modèle,
  l'effort et « Autoriser les agents extérieurs »), la confiance au dossier
  `.claude` d'un projet — n'est pas dans la table et n'y entre pas (décidé en
  0.15.0) : l'utilisateur seul, par l'écran. Une
  commande de la liste ouverte, ou une autre fermée, fait refuser la table
  (`AGENT_CLOSED`).
- **L'exécuteur** (note `0.15.0-executeur.md`) : `execute` (`core/commands`) est
  l'entrée unique, `runCommand` (`app/controllers/commands.ts`) son branchement
  pour un robot, qui charge la table livrée (`vibeCommands`), le catalogue et le
  relevé. Il reçoit la commande, ses arguments et la porte (`screen` ou `agent`)
  et répond tout de suite, `{ ok: true, result }` ou `{ ok: false, error }`. Les
  arguments sont convertis sans ambiguïté (`"2"` → `2`, `"true"` → `true`) puis
  vérifiés par `schemaError`. Il ne refait aucune garde : il appelle
  `startAction`, `runDirect`, `runOp`, l'opération des processus, `readArtifact`
  et `editDraft`, et traduit leur refus en code ; une action absente du relevé
  est `not-offered` (pour une action directe ou une autre : aussi masquée, sauf à
  la porte `screen`, comme l'écran d'avant ; pour `run.start`, absente seulement :
  la règle de l'orchestrateur, F-115), une action grisée, `disabled` (le motif du
  relevé, tel quel). Avant une commande qui écrit, `runCommand` relit l'état du
  dépôt (`refreshVibe({ fresh: true })`) : il ne juge pas sur un relevé qui date.
  À la porte `agent`, tout ce que la table ouvre s'exécute ; les commandes
  fermées sont refusées (`closed`). `runCommand` et l'exécuteur refusent toujours
  `busy` et `changing` (I-44) : c'est `commandFromSocket` qui, à la porte `agent`,
  met la demande en file (ci-dessous). Une commande pour un dossier où aucun robot
  n'est : `no-survey`.
- **Le socket** (note `0.15.0-socket-interface.md`, étape 3a) : le principal ouvre
  au lancement un socket TCP (`technicals/socket`, `app/controllers/socket.ts`),
  sur `127.0.0.1` seulement et sur un port libre ; un objet JSON par ligne.
  L'enveloppe est celle de Gear Render : `{ cmd, args, token, target }` en
  entrée (`target` : le chemin réel du dossier visé), la réponse de l'exécuteur
  en sortie, en une ligne. Les jetons, 32 octets aléatoires chacun, sont
  comparés à temps constant dans une table relue à chaque ligne (un jeton retiré
  n'ouvre plus rien) ; celui de l'écran est tiré à chaque lancement, gardé **en
  mémoire** dans le contrôleur du socket. Une commande sans un jeton de la table
  est refusée (`bad-token`, une réponse
  puis la connexion fermée) ; une ligne qui n'est pas une commande — pas du JSON,
  pas un objet, `cmd` ou `target` absent, une clé de trop, au-delà de `LINE_MAX`
  (128 Mio de caractères) — ferme la connexion sans réponse : cela bloque les
  requêtes d'un navigateur vers `localhost` (I-49). Les lignes d'une connexion
  sont traitées dans l'ordre ; une réponse qui tarde (`run.wait`) garde la
  connexion ouverte, sans délai, et un client parti avant elle n'est pas une
  erreur. `commandFromSocket` retrouve qui appelle, le robot et la porte (ci-dessous)
  et appelle `runCommand`. `live.json` (`userData`, droits 0600) porte `{ port,
  pid }`, plus le jeton extérieur tant que le réglage est activé — jamais le
  jeton de l'écran (I-50) ni celui d'un robot (I-51) ; il est écrit au lancement
  et à chaque changement du réglage et, à la sortie, le socket est fermé et
  `live.json`, qui désignerait un port que plus rien n'écoute, **supprimé**
  (F-81), le jeton extérieur avec lui.
- **L'écran passe par lui** : les commandes de ses boutons qui sont dans le
  contrat partent du principal, client de son propre socket (`screenSend`, une
  connexion par commande), vers l'exécuteur : lancer, arrêter, garder, annuler une
  action, répondre à une autorisation (`run.allow`, `run.always`, `run.deny`, fermées
  aux agents : c'est ce qui éprouve la règle), les actions directes, *Copier dans le
  projet*, les gestes de l'explorateur des artefacts, le brouillon de revue,
  *Déposer* des fichiers, *Lancer*, *Arrêter* et *Relancer* un processus. Les
  gestionnaires des canaux (`runVibeAction`, `vibeRunOp`, `vibeProcess`,
  `dropOnArtifacts`, `draftVibe`) en sont les adaptateurs : ce qui est propre à
  l'écran y reste avant l'envoi (la boîte de dialogue d'un processus qui tourne
  ailleurs, le choix « direct », les chemins déposés lus par le pont), puis la
  réponse est traduite en ce que l'écran montre, d'après son code d'erreur, dans la
  langue de l'appli. Le pont ne change pas. L'affichage non plus : le relevé
  poussé toutes les 4 s, les fils, les autorisations. Le socket ne démarre pas, ou
  ne répond pas : le bouton refuse (« Socket indisponible »), l'appli reste
  ouverte, jamais d'appel direct en repli ; les canaux qui ne rendent rien à la page
  (`conv:vibeRunOp`, `conv:vibeProcess`, `conv:vibeDraft`) l'annoncent par une
  boîte de message. Les agents passent par le même socket (ci-dessous) ; une
  action directe leur reste refusée (`run.start` ne la lance pas).
- **Les agents : la commande `vibecoder`** (note `0.15.0-cli.md`, étape 3b ;
  `plugin/bin/`, copiée avec le plugin dans `userData/vibecoder/plugin/bin/`, rendue
  exécutable par `ensureVibeFiles` hors Windows). Un script node sans construction
  (`vibecoder.mjs`, le pur dans `cli.mjs` : aucun import de `src/`, aucun shell,
  I-27), client du socket : une enveloppe avec, pour `target`, le chemin réel du
  dossier courant, et la première ligne rendue. Une forme générale pour toute
  commande de la table : `vibecoder <commande> [clé=valeur…]` (une valeur qui
  commence par `{` ou `[` est lue en JSON, l'exécuteur convertit le reste) ; des
  raccourcis : `status`, `next` ; `run start <action> [clé=valeur…]`, `run stop`,
  `run wait`, `run list` ; `proc list`, `proc restart` et `proc stop <nom>`, `proc
  logs <nom>` ; `commands` et `schema <commande>` se lisent dans la table copiée
  avec le plugin, sans l'appli. `--json` : la réponse sur une ligne. Code de
  sortie : 0 si tout va bien (une demande mise en attente aussi, et le texte le
  dit), 1 un refus (son code, son message, ce qu'il faut faire) ou l'appli
  injoignable, 2 un usage faux. Jamais de question interactive. Où se connecter :
  un **robot** a `VIBECODER_PORT` et `VIBECODER_TOKEN` dans son environnement et
  ne lit **jamais** `live.json` (I-54) ; un **agent extérieur** lit `live.json`
  (`~/.config/whisper-dictation/`, ou sous `XDG_CONFIG_HOME` ; `%APPDATA%` sous
  Windows), son port et son jeton extérieur ; sans jeton, la commande dit
  d'activer le réglage.
- **Les jetons des agents** : une table relue à chaque ligne, trois sortes de
  noms. `screen` : le jeton de l'écran, inchangé (I-49, I-50). **Un jeton par
  robot**, tiré à sa première demande, **en mémoire seulement** (`robotToken`), donné
  par l'environnement à ce que l'appli lance pour lui — l'agent principal et ses
  courses (`launchOptions`) — et jamais écrit (I-51) : il dit quel robot appelle ;
  un robot retiré (`forgetRobot`) ou qui n'est plus dans la config n'ouvre plus
  rien. `outside` : le jeton **extérieur**, écrit dans `live.json` seulement tant
  que le réglage *Autoriser les agents extérieurs* est activé (I-52 ; tiré à
  l'activation, oublié à la désactivation, un nouveau la fois suivante) ; il ne
  désigne aucun robot, il dit seulement « un agent extérieur, permis ». Aucun jeton
  d'agent ne va à la page (I-53).
- **Les portes des agents** : `callerRobot` (pur, `core/commands/caller`) tire du
  nom de l'appelant le robot et la porte. `screen` : le robot de la cible (le robot
  affiché s'il est sur ce dossier ou en dessous, sinon le premier, chemins réels
  comparés : `/home` et `/var/home`), porte `screen`. Un robot : **le sien seul**,
  la cible ignorée, porte `agent` (I-56). Un agent extérieur (un Claude Code lancé
  dans un terminal, hors de l'appli) : le robot de son dossier courant, par la même
  règle ; réglage désactivé : refusé (`bad-token`, I-55) ; aucun robot dans son
  dossier : `no-survey` (il change de projet en changeant de dossier). Un robot et
  un agent extérieur passent tous deux par la porte `agent` de l'exécuteur : ce que
  la table ferme leur reste fermé. Un agent extérieur a ainsi les capacités de
  l'écran sur le projet de son dossier, sauf ce qui est une décision de
  l'utilisateur. Le relevé du robot d'un agent est refait à chaque commande
  (`surveyAgent`), affiché ou non : on travaille sans toucher au panneau. **En
  attente** : à la porte `agent` seulement, un `run.start` (ou `vibe`, `guide`,
  `new-request`, `propose-run`) refusé `busy` ou `changing` est mis en file
  (`waits` de `controllers/runs`, F-115) et la réponse est `{ ok: true, result: {
  queued: true, by } }` ; les autres refus arrivent tout de suite.
- **Le réglage *Autoriser les agents extérieurs*** (`outsideAgents`, § 8 et § 9,
  **désactivé par défaut**) : activé, `live.json` porte le jeton extérieur ;
  désactivé, il ne porte plus rien de tel et l'ancien est refusé. Il se change par
  la page des réglages seulement (canal `settings`) : ce n'est pas une commande de
  la table. Le lien de la commande dans `~/.local/bin` : README.
- **Une erreur est une donnée, sans langue** : `{ code, details, message, todo }`.
  Le code est l'un de `ERROR_CODES`, la liste que porte la table (`errors`,
  chacun avec son message et ce qu'il faut faire, en anglais, pour un modèle) ;
  les `details` nomment l'argument fautif, l'action qui retient, le motif. C'est
  l'appelant qui l'interprète : l'écran la traduit d'après son code, un agent la
  lit et la dit à l'utilisateur. `no-pr` : pas de PR suivie, donc pas de brouillon ;
  `unknown-artifact` : un id absent du dernier relevé, ou un lien (`artifact`, et
  toute commande d'artefact, dossier d'arrivée compris) ; `refused` : le refus
  d'une opération (le motif dans `details.reason`), celui d'une commande
  d'artefact compris ; `failed` : une opération qui lève, ou le disque en échec ;
  `invalid-args` : aussi un nom d'artefact refusé (`arg: name`) ou une remarque
  inconnue du brouillon (`arg: id`) ; `bad-token` :
  rendu par le protocole du socket, jamais par l'exécuteur. Une table sans `errors`
  se lit comme une liste vide.
- **Les skills** : la section des arguments de `actions` et de `processus`
  (F-105) est produite d'après la table (`skillArgs` : les lignes de la commande `vibecoder`) ; un test la régénère et la
  compare au `SKILL.md` du dépôt. Rien n'est réécrit au démarrage : un skill
  retouché n'est jamais remplacé (I-35).

### Le parcours, le relecteur

**F-100 Le parcours** (la branche du dossier de l'agent ; les étapes du guide,
§ 4.1 ; le même écran pour créer une feature et pour relire une PR, F-101).
L'étape en cours est la première qui n'est pas faite (ci-dessous, pour le
créateur ; le relecteur, F-101) :
1. **Note** — faite : « Ce que ça fait » rédigée, aucune question ouverte
   (`questions.md` vide), la note validée (F-102). Le questionnaire suit
   `questions.md` seul, quel que soit le chemin des réponses (*Envoyer les
   réponses*, ou la conversation : skill `vibe`, ou la ligne de la consigne
   hors d'un skill). Montre la note rendue
   (F-104), à jour pendant que l'agent l'écrit : ce qui a changé depuis la
   dernière relecture (« Changée depuis votre dernière relecture ») porte un
   liseré ; ce qui a été **retiré** depuis s'affiche aussi, à sa place, en
   rouge barré : l'ancienne version d'une ligne changée juste au-dessus de la
   nouvelle, les lignes retirées d'un même endroit ensemble, juste avant le
   bloc ou l'élément de liste qui les suit (à la fin de la note s'il n'y en a
   pas ; au milieu d'un paragraphe, d'un tableau ou d'un bloc de code : avant
   lui entier), mises en forme comme la note (une puce reste une puce, jamais
   de HTML, I-40), en lecture seule : ni 💬, ni pastille, ni remarque, et les
   numéros de ligne restent ceux de la note actuelle. Rendue seulement (ni
   *Modifier* ni *Brut*) ; *Voir les modifications* reste le seul à montrer le
   diff brut (retraits compris, replié autour des changements), *Vu* en repart
   (le liseré et les retraits disparaissent, de même que par la validation de
   la note). La référence est posée une
   seule fois, au premier relevé où l'agent ou une course qui modifie la branche
   travaille, puis ne change que par *Vu* ou par la validation de la note
   (*Valider la note*, *Revalider* : la note à l'écran au clic) ;
   un tour ou une course qui commence ne la change pas, les modifications
   s'accumulent ; une autre note (autre fichier) la remet à zéro. Les lignes « ne doit
   pas » portent leur marque en pastille (*invariant*, *variant* d'un bleu plus
   clair, *review*, *structure*, sinon *à classer*) ;
   *Ouvrir* (dans l'éditeur). Rendue d'emblée, sans attendre le texte
   suivi ; *Modifier* la rend modifiable sur place (*Fermer* y revient, la
   modification gardée), à la manière d'Obsidian (CodeMirror 6) : ce qu'on tape se met en forme au fil de la
   frappe (un titre en titre, les marques `#`, `**`, `` ` ``, `[](…)`
   masquées hors des lignes du curseur ; Ctrl+clic ouvre un lien) ; le *Commenter*
   de chaque bloc et les pastilles dans une gouttière à droite des lignes,
   le liseré (vert) des changements. *Brut* montre le
   Markdown tel qu'il est dans le fichier, modifiable lui aussi (F-113).
   La note reste modifiable à l'écran, seul texte du créateur à l'être (0.16.0) :
   enregistrée au geste, la modification gardée, *Enregistrer* grisé si le
   fichier a changé sur le disque, *Abandonner* ; grisée (le motif en titre,
   la vue suit le disque) pendant un tour de la conversation et pendant
   toute course de l'agent qui retient (« Une action de l'agent est en
   cours »). Au-dessus, les questions ouvertes, une carte
   numérotée par question, avec le badge de son niveau si son titre en porte un
   (`## <n>. [important] …` en accent, `[secondaire]` grisé ; le badge remplace le
   niveau dans le titre affiché, `questions.md` et les réponses envoyées le
   gardent ; sans niveau : pas de badge ; écrit par les skills `note`,
   `conception` et `vibe`) : ses réponses proposées (une choisie, lisible
   comme les autres boutons actifs ; un second
   clic la retire ; une réponse de la vérification de conception, écrite
   `- **Accepter** — *<rubrique>, <puce>* : « <texte> »` (ou **Refuser**), montre
   le choix en gras, l'endroit grisé, le texte cité en vert, jamais en HTML ; une
   autre réponse, comme avant), *Conseille-moi*, *Je te laisse trancher*, une précision
   libre (micro et pièces jointes, sans *Envoyer* propre : seul *Envoyer les
   réponses* envoie ; une liste de pièces jointes pour tout le questionnaire,
   F-69) ; *Envoyer les réponses* les envoie en une fois, une par question
   (grisé tant qu'aucune n'a de réponse). Prochaine action : *Rédiger la
   note* (la demande du champ de la conversation), puis *Envoyer les réponses*, puis
   *Vérifier*, puis *Valider la note*. À l'écran, le créateur n'a plus que le
   questionnaire (*Envoyer les réponses*), *Vérifier*, *Valider la note* et la
   modification de la note (0.16.0) : sans note, une phrase le renvoie à l'agent,
   dans la conversation, sans *Rédiger la note* ni *Nouvelle demande* (la CLI les
   lance comme avant). **Vérifier, puis valider : deux gestes**
   (0.16.0). En créateur, *Vérifier* (l'ancien *Revérifier* : un bouton ordinaire,
   pas vert), proposé dès que la note est rédigée, lance la **vérification de
   conception** (l'action `design-check`, le skill `conception`, *opus · élevé*,
   une seule passe, lecture seule : elle ne modifie jamais la note) ; il se relance
   autant de fois que l'utilisateur veut et **ne valide jamais rien**. *Valider la
   note* (*Revalider* quand la note a perdu son ✓ ou est « modifiée depuis »), le
   bouton vert, n'est montré que lorsque la dernière vérification n'a rien trouvé
   (« rien de bloquant ») : l'utilisateur relit alors toute sa note, la nettoie, et
   valide lui-même, à la fin ; ce geste, et lui seul, lance le moteur (F-103) :
   la **première** validation de la note. Une note validée de nouveau en cours de
   parcours (elle a changé : une décision écrite, une correction) retrouve son ✓
   et les choses reviennent comme avant son changement : le moteur ne repart seul
   que s'il enchaînait quand la note a changé (la pause de la note l'a arrêté) ;
   arrêté avant (une pause, *Arrêter*, l'appli relancée), il le reste, en express
   aussi, et seul *Reprendre* le relance. Reparti avec une note changée depuis
   son commit, un module commencé, il revérifie d'abord l'alignement des tests
   avec la note (`align`).
   Valider ne lance aucune vérification et la vérification ne valide pas : sinon le
   moteur partirait sans que l'utilisateur ait relu. Elle cherche les cas
   oubliés, les contradictions entre lignes, les cas limites des règles chiffrées
   (une seule option, un groupe vide, un dépassement), un comportement visible
   inatteignable (le front compris, d'après le code existant), une ligne qui
   serait plutôt un invariant ou un variant ; ses trouvailles sont des
   suggestions, ajoutées à `questions.md` (« Accepter : … » / « Refuser »), que
   l'utilisateur accepte ou refuse, et qui entrent dans la note par *Envoyer les
   réponses*, comme toute réponse. L'empreinte de la note au départ de sa course
   est gardée en mémoire, quel que soit le geste qui la lance (le clic, l'orchestrateur,
   la file) ; à la fin de la course, sans question dans `questions.md` (« rien de
   bloquant »), la note est marquée **vérifiée** pour cette empreinte (la marque
   `design` de sa note, dans `vibecoder-state.json` ; le relevé le dit à la page,
   `VibeNote.verified`), sans être validée ; avec des questions, la marque d'une
   vérification d'avant est retirée : ses suggestions s'affichent, la note attend,
   et l'utilisateur y répond puis relance *Vérifier* (le message n'est que le
   gabarit de l'action : ni le texte du champ ni ses pièces jointes, I-2). Une
   course en échec ou arrêtée ne change rien : le « rien trouvé » d'avant reste.
   **La note modifiée après une vérification qui n'a rien trouvé** : *Valider la
   note* reste affiché (c'est l'utilisateur qui a relu, il valide), *Vérifier* à
   côté pour un second passage, et l'écran dit que la note a changé depuis la
   vérification (`verified` dit « modifiée depuis »). La règle « *Valider la note*
   seulement après une vérification sans rien de bloquant » est tenue par l'écran
   seul : le principal ne refuse pas une validation qui arriverait sans vérification
   (le clic vient de l'utilisateur, seule autorité sur la note ; aucun agent ne peut
   la valider, I-67). Sa course s'affiche à côté de *Vérifier* : « en cours »
   avec ⏹ tant qu'elle tourne, « en attente » mise en file. Retenue par une
   course qui modifie la branche, la vérification attend en file (F-115) ; elle
   n'est pas dans la rangée d'actions : le bouton est celui de la vue de la note
   (F-99).
   Relecteur : *Valider* ou *À revoir* comme avant, aucune vérification. **La
   note est la seule validation que l'utilisateur est seul à donner**, quel que
   soit le rythme (F-103 ; I-67) : aucun relevé, aucune commande de
   l'orchestrateur, aucune fin de vérification ne la valide : seul le clic de
   l'utilisateur sur *Valider la note* est son chemin. Une fois la
   note validée, aucune étape de l'IA ne change « Ce que ça fait », « Ce que ça ne doit
   pas faire », « Où ça casse » ni une étiquette (`→ invariant`…), sauf pour écrire
   une décision de l'utilisateur ; sinon la validation tombe (« modifiée depuis »).
   **Son ✓ gardé ou tombé** : une note validée puis changée garde son ✓ seulement si
   l'appli constate elle-même que le changement n'ajoute à la conception validée
   (retenue dans les sorties, `validated/<empreinte>`, comme les fichiers d'une
   étape) que le texte exact d'une réponse « Accepter » choisie par l'utilisateur
   (les textes acceptés sont gardés en mémoire à l'envoi des réponses) ; une
   réponse libre, un « Accepter » suivi d'une précision, ou tout autre changement
   fait tomber le ✓ et attend sa revalidation, en express aussi ; l'appli relancée
   entre-temps, le ✓ tombe aussi.
   Sur la base seulement, *Rédiger la note* part comme
   une nouvelle demande (F-110) : l'agent propose un nom de branche (skill
   `nouvelle-demande`, rien de plus), qui attend dans un champ prérempli et
   modifiable, avec « Voulez-vous créer la branche … ? » et ses choix ; rien
   n'est créé sans ce clic (l'agent ne crée plus la branche) ; validée, la
   branche est créée, puis la note s'écrit. Sur une autre branche, la note
   ne propose jamais de nouvelle branche.
2. **Forme** — faite : au moins un module dans la rubrique « Forme » (aucune
   validation à la main : le système la valide, F-102), et la note sans changement pas commité depuis qu'un commit de la branche la
   porte. Commitée puis modifiée (la note ou sa Forme, à la main ou par
   l'agent) : l'étape n'est plus faite (son en-tête ne dit plus « note modifiée
   depuis son commit » : « modifiée depuis la validation » ou « à revoir : la note
   a changé » quand la validation ne tient plus, F-102) ; la note revalidée (la forme l'est par le système), sa prochaine action est
   *Préparer le commit* (le skill `commit-preparer` : avant la PR, un fixup
   du commit qui porte la note, le premier, message `fixup! <son sujet>`
   seul ; la PR ouverte, un nouveau commit qui dit pourquoi ; en historique
   simple, toujours un commit ordinaire, jamais un fixup), puis *✓
   Commiter* (le créateur ne voit plus la carte du commit proposé, `commit.md`,
   ni *✓ Commiter* : le moteur ou l'agent commite). Une note jamais commitée qui change :
   rien (elle part avec le premier commit). Une fois un module commencé, le
   parcours ne recule plus : une retouche de la note ou d'un test d'invariant
   de la branche (une passe, un harnais) laisse la Forme et les Invariants
   faits (leur en-tête dit « à revoir… » ou « modifiée depuis la validation » si
   leur validation ne tient plus, F-102), et
   c'est l'étape Modules qui l'attend : elle n'est faite qu'une fois la
   retouche commitée (*Commiter les modules*, ou *Préparer le commit* quand
   tous les modules le sont déjà ; note 0.15.0-stabilisation). De même, une validation faite puis dépassée par une retouche (« modifiée depuis la validation » : la note, sa Forme, un cas d'invariant) compte encore une fois un module commencé : l'écran la dit changée, *Revalider* reste possible, rien ne recule. L'étape Invariants, une fois un module commencé, ne compte que les tests écrits pour elle (portés par le commit de la note) : un test d'invariant retouché par un module n'est pas à revalider.
   Montre, **en créateur** (0.16.0), **la liste des modules** : une ligne par
   module, son chemin et ce qu'il fait en une phrase (le début de son contrat,
   avant toute rubrique) ; ni arbre, ni diff, ni badge « touché », ni « 1 commit »,
   ni icône, ni bouton, ni commit proposé, et aucun fichier n'est suivi : le code
   n'est montré qu'à l'étape Modules, un seul endroit pour l'arbre et le diff.
   Sans Forme (ou sans note) : une phrase, sans bouton. **Le relecteur n'a plus cette étape** (0.16.0) : sa Forme est faite avec la Note, il n'y a rien à y juger, donc ni arbre des modules, ni *Structure* · *Code*, ni remarque par module (F-101). *Poser
   la forme* écrit dans le même passage les
   **squelettes** dans le code — les chemins, les en-têtes (le contrat), les
   signatures typées, des corps qui échouent, le typage du projet qui passe —,
   puis recopie la forme dans la note, **en prose** : pour chaque module son
   chemin, ce qu'il expose en une ou deux lignes (sans signature typée : elles
   vivent dans les squelettes et les en-têtes, qui disent la même chose), ce
   qu'il ne connaît pas, qui l'utilise, sa ligne « variants : » et ses cas ; la
   mise en page que lit l'écran ne change pas (le chemin en début de ligne, les
   suites indentées, une ligne vide entre deux entrées) ; une retouche, à n'importe quelle étape,
   modifie la note et les squelettes ensemble, sans les régénérer ; un écart
   d'alignement de la forme se corrige sans être remonté. Puis la Forme est
   validée par le système (squelettes posés), le badge de l'étape porte son ✓
   (F-93, F-102) ; plus de bouton *Valider la forme* à l'écran : le geste à la
   main reste à la CLI (`step.validate`), le badge retire ou rend le ✓. Un squelette n'est pas
   un module commencé (étape Modules).
3. **Invariants** — faite, seulement si la Note et la Forme le sont : aucune ligne
   « → invariant » dans la note (ni
   test ni commit attendus : la note et la forme se commitent à l'étape
   Modules ; *Écrire les invariants* masquée, elle revient quand la note
   gagne une ligne « → invariant »), ou des tests d'invariants alignés avec la
   note (`align.md` sans rubrique `[toi]`) ou dont chaque cas est validé à la
   main, lu ou pas, et le premier commit fait (note et tests commités ; aucune
   validation à la main n'est attendue). Des lignes
   « → invariant » mais aucun test d'invariant de la branche (des tests
   existants les observent déjà) : faite quand la dernière course *Écrire
   les invariants* ou *Vérifier l'alignement* est *finie* (pas *en échec*,
   pas *arrêtée*), ou *Rien à écrire* validé (à côté de l'invitation à
   écrire ; l'empreinte du texte de la note : il tombe à n'importe quel
   changement de la note, comme *Valider la note*). Pendant que le système enchaîne aussi, rien
   d'automatique : la course finie ou la validation. *Lire en pseudo-code* (0.16.0)
   est la prochaine action de l'étape tant qu'un test d'invariant de la branche
   n'est pas lu, ou que sa lecture est périmée, avant le premier commit : le
   **moteur la lance lui-même après chaque écriture des tests d'invariants**
   (après *Écrire les invariants*, avant la pause, qui précède le premier commit, et après
   une correction des tests par l'alignement de la preuve), un regard
   indépendant de celui qui a écrit les tests ; la pause après les invariants
   attend cette lecture (F-103) et se tient dès que les tests sont écrits et lus, sans attendre l'alignement (un écart [toi] est déjà en tête des règles : le moteur ne commite pas avant la reprise) ; sans ligne « → invariant », rien à lire. L'étape est validée par le système (alignement avec la note, F-102) ;
   plus de bouton *Valider les invariants* ni de ✓ par cas à l'écran chez le
   créateur : le badge de l'étape porte le ✓ (F-93), et la CLI garde
   `step.validate` et le ✓ d'un cas.
   Montre, **en créateur** (0.16.0), **les règles** : l'étape rangée par ligne
   « → invariant » de la note. En titre, le texte de la ligne tel que
   l'utilisateur l'a écrit, et son état d'après la preuve : *écrite* (ses tests
   sont rouges, pas de preuve au relevé, ou ligne ajoutée depuis la preuve),
   *prouvée* (le mutant en détail, replié : le badge « prouvée » est un bouton qui
   l'ouvre et le replie), *non prouvée* (la raison que la preuve remonte, toujours
   visible) ; ce détail est mis en forme (Markdown, jamais de HTML) : un état par ligne, c'est la ligne que
   l'utilisateur juge. Dessous, les tests qui la gardent, en pseudo-code (un test
   pas encore lu : son titre et « lecture en cours » ; un point d'attention d'une
   lecture : visible), chacun avec sa 💬, qui cite son titre dans le champ, et
   **Validé / À revoir** (le verdict du cas, comme chez le relecteur) : les notes
   de l'utilisateur sur ce qu'il a lu. *Validé* n'est jamais exigé (le système
   valide l'étape, F-102) ; un test *À revoir* retient le parcours (la pause
   `withdrawn:invariants`, F-100) tant que sa marque vaut : le test corrigé (elle
   tombe) ou revalidé, la pause est levée. En tête des règles, où l'utilisateur
   en est : « 10 tests · 6 validés · 1 à revoir · 3 à lire ». Un agent lit ces
   verdicts par la commande `invariants` (le registre des commandes). **Quel test garde quelle
   ligne vient de l'alignement** : le skill `aligner`, qui vérifie déjà test par
   test à quelle ligne chacun est lié, l'écrit dans la sortie `liens.md` (sous
   chaque ligne de la note, `- <chemin> :: <titre>`) ; une ligne recopiée par son
   seul début est retrouvée, un début porté par deux lignes ne range rien. Un
   test que `liens.md` ne nomme pas, ou sans `liens.md` : la ligne que sa lecture
   cite mot pour mot (un repli : cette citation manque souvent sur une ligne
   longue). Un test d'avant la branche qui garde déjà la ligne, que
   l'alignement nomme : son chemin et son titre sous la ligne, sans pseudo-code.
   Un test rattaché à deux lignes est sous chacune. Une ligne
   sans test s'affiche quand même, « aucun test » ; les tests qui ne gardent
   aucune ligne vont dans un dernier groupe,
   « Autres tests » : rien n'est caché, un trou dans la garde se voit. Une
   lecture périmée garde son test à sa ligne ; une note sans ligne « → invariant » :
   une phrase, et tous les tests dans « Autres tests ». **Le résultat de la
   preuve ne s'affiche qu'ici**, sous chaque ligne, pas à l'étape Modules. L'alignement
   suit la règle de la Revue (F-95) : ses écarts `[toi]` en avant, les `[agent]`
   repliés sous leur nombre, sans *Relancer*, rien quand tout est aligné. La bulle de remarque
   (*Commenter*) est sur une règle (elle la cite dans le champ de la conversation) ;
   *Ouvrir dans l'éditeur*, une icône par test. Plus de carte par cas, de verdict
   *Validé* / *À revoir*, de *Tout valider*, de *Lire en pseudo-code* ni de *Voir le fichier*
   à l'écran, plus de chiffres en tête (fichiers, cas, validés, à lire) ni de barre
   « 0 / 3 validé », ni « non rattaché » ni « Pas de lecture pour ce cas », ni
   *Invariants seuls* ni menu de diff ; aucun test ne s'édite, aucun fichier n'est suivi.
   **Le relecteur a la même vue** (0.16.0, F-101) : l'alignement en tête (`align.md`, F-93 : chaque écart porte son étiquette, F-95), puis une règle par ligne « → invariant » de la note, ses tests en pseudo-code dessous, *Validé* / *À revoir* sur chaque test (un second clic l'annule), « aucun test » pour une ligne sans test, « Autres tests » pour les tests sans ligne ; la bulle d'une règle ou d'un test ouvre une remarque pour le brouillon de revue (F-98). Sur une PR, l'alignement écrit aussi `liens.md` (quel test garde quelle ligne, tests d'avant la branche compris), dans le dossier de sorties seulement, rien dans la branche : la vue range les tests comme chez le créateur. Pas de preuve chez le relecteur (ni « écrite », « prouvée », « non prouvée », ni détail au clic : la preuve est faite sur la machine du créateur et n'est pas dans la PR). Un test d'invariant d'avant la branche que la PR modifie est dit sur ce test (son texte à la base diffère : le relevé le sait déjà, sans agent ni token, avant toute préparation). Plus de carte par cas, de résumé ni de barre, d'arbre des tests, de *Tout valider*, de *Voir le fichier* ni de menu de diff. Sans lecture d'un test, ses cas restent actifs.
   **La validation d'un cas porte sur son bloc, pas sur le fichier** (0.15.0). Le bloc
   d'un cas, pour sa validation, va de la ligne du cas à celle qui le ferme,
   trouvée par l'indentation, sans analyser le code : après la ligne qui porte son
   titre (son `it(`, son `fn`, son `def`), la première ligne non vide indentée comme
   la ligne du cas ou moins, en sautant celle qui commence par `)` et finit par `{`
   ou `:` (la fin d'une signature sur plusieurs lignes) ; elle est comprise si elle est
   indentée comme elle et commence par `}` ou `)`, exclue sinon ; sans une telle
   ligne, le bloc va jusqu'à la fin du fichier. Ce qui reste dans la découpe de l'écran
   (la fermeture d'un `describe`, l'en-tête du suivant, un `beforeEach`), avec les imports
   et les helpers, est le **code commun** du fichier. Les lignes vides ne comptent ni dans un
   bloc ni dans le code commun. La validation d'un cas garde l'empreinte de son bloc
   et celle du code commun : bloc changé, le cas seul affiche « Modifié depuis la
   validation » et perd son verdict ; code commun changé (un import, un helper, un
   `beforeEach`), tous les cas du fichier perdent leur verdict et affichent « Le code
   commun du fichier a changé » ; ni l'un ni l'autre : le cas garde son *Validé* ou
   son *À revoir*. Un cas ajouté n'a pas de validation, un cas retiré disparaît avec la sienne. La
   clé d'un cas est son titre ; un titre en double est rangé sous son titre et son
   numéro d'ordre dans le fichier (le premier sous le titre seul, puis
   « <titre> n° 2 », « <titre> n° 3 »…), la lecture d'un cas aussi : valider un cas ne
   valide jamais un autre cas ; un cas de même titre inséré avant les autres décale leurs numéros,
   qui perdent leur validation. Un cas qui perd sa validation décoche l'étape
   Invariants (et la cascade, F-102). Une validation posée avant cette version
   porte sur le fichier entier : **convertie sans bruit** au relevé, sur le bloc du cas,
   si le fichier n'a pas changé depuis, sans rien demander ni rien afficher ; sinon elle
   reste « Modifié depuis la validation ». Le code d'un test ne se modifie plus à
   l'écran (0.16.0) : le canal d'écriture du bloc d'un cas reste dans le principal,
   avec ses garde-fous (il remplace ce bloc dans le fichier du disque, et seulement lui :
   aucune autre ligne n'est modifiée, I-59, les fins de ligne gardées ; refusé si le
   fichier a changé sur le disque depuis l'ouverture du bloc), la page du créateur
   ne l'appelle plus ; une correction se demande à l'agent. *Ouvrir dans l'éditeur*, une
   icône discrète par test, est la sortie de secours : le fichier entier dans
   l'éditeur de code de l'utilisateur. Le relevé porte le texte
   du test, vide au-delà de 200 000 caractères (rien de tout cela n'est
   alors montré), et son texte au commit d'où part la branche (par git ;
   aucun : ajouté par la branche, ou au-delà de 200 000 caractères). Prochaine action : *Écrire les invariants
   (rouges)* (le texte d'aide de l'étape sans test la cite sous ce nom ; d'après la note, à partir
   des squelettes de la forme) tant qu'il
   n'y a pas de test, puis *Lire en pseudo-code* tant qu'un test n'est pas lu ou que sa
   lecture est périmée (avant le premier commit), puis *✓ Commiter* (un
   commit préparé), *Préparer le commit* (des fichiers à commiter ; un fichier déjà porté par
   un commit de la branche : un fixup de ce commit tant qu'aucune PR n'est
   ouverte, un nouveau commit qui dit pourquoi le fichier change une fois
   la PR ouverte, jamais un fixup ni un amend : son historique n'est pas
   réécrit ; en historique simple, toujours un commit ordinaire). *Lire en
   pseudo-code* (les fichiers pas encore lus, ou dont la lecture est périmée : une lecture est nommée par
   l'empreinte du fichier, sa première ligne `# <chemin du test>` ; relire
   la remplace) est lancée par le moteur (ci-dessus) ; chez le relecteur, *Préparer la revue* la lance (F-101).
   **L'alignement** (skill `aligner`, *opus · élevé*, dans la course de *Écrire les
   invariants (rouges)*, F-93) ne regarde que les invariants : chaque test
   d'invariant observe vraiment sa ligne « → invariant », chaque test est
   rattaché à une ligne ou à un invariant existant — ni la forme, ni le
   classement, ni le code. Un passage exhaustif, piloté par une liste (chaque
   ligne et son test, chaque test et sa ligne), puis, chez le créateur, il
   **corrige seul les tests** et revérifie, 3 tours au plus, à la main ou par le moteur ; il
   ignore ce qui attend un module pas encore généré. Ne remonte (`[toi]`) qu'un
   changement de contrat ou une note qui rend un test impossible à écrire ; un
   écart de test que les 3 tours n'ont pas fermé reste `[agent]`. Chez le relecteur, une lecture : il liste, sans étiquette ni correction, la branche de la PR intacte (T-19), et écrit `liens.md` dans le dossier de sorties seulement. **Il ne corrige que les fichiers de tests d'invariants que la
   branche crée** (0.16.0, I-64) : l'appli refuse à la course *Vérifier
   l'alignement* d'écrire dans un fichier de tests d'invariants qui existait au
   départ de la branche (git en dresse la liste avant son message), même pour un
   cas que la branche y a ajouté ; la raison dit que le fichier est protégé et que
   son cas remonte en `[toi]`. Ce contrôle ne voit pas les commandes du terminal
   que l'alignement garde : à la fin de la course, quelle qu'elle soit, l'appli
   compare donc ces fichiers à leur état du départ ; si l'un d'eux a changé (ou
   disparu), la course échoue, sa réponse le nomme et `align.md` est effacé :
   l'étape Invariants ne paraît pas faite. Elle lit aussi `preuve.md` quand il
   existe, pour dire, dans les mots de la note, la règle qu'un mutant a cassée
   sans qu'un test échoue.
4. **Modules** — faite : chaque module de la Forme commencé par un commit de la
   branche (un commit sans la note : celui de la note porte les squelettes, un
   squelette commité n'est pas un module fait), et, s'il y a des lignes
   « → invariant » dans la note, la preuve qui passe (`preuve.md`, ci-dessous),
   quel que soit le rythme. Montre, **en créateur** (0.16.0), en tête **une seule
   ligne d'état** (« 16 modules écrits · commités » : combien de modules, combien
   d'écrits, combien de commités ; plus de « n commité · n en cours · n à faire »,
   ni de légende), puis **un seul arbre et son diff**, en lecture seule, sans
   bouton (voir *Le code, à un seul endroit*, ci-dessous). Plus de commit proposé
   (`commit.md`), de relecture du diff (`review.md`), de carte de la preuve ni de
   boutons : les actions de l'étape (*Générer les modules*, *Générer* un module,
   *Prouver les invariants* (masquée sans ligne « → invariant »), *Commiter les
   modules*, *Relire le diff*, *Préparer le commit* pour les fixups de la note)
   sont lancées par le moteur, ou par l'agent (CLI) ; l'étape n'en met aucune en
   avant, mais la prochaine action du relevé reste celle qui suit. Un module dont
   tous les fichiers sont encore le squelette laissé par *Poser la forme* est
   « à faire » (pas écrit), et dans l'arbre ses fichiers sont en retrait, marqués à
   générer, l'infobulle « À générer : encore le squelette de la Forme » ; l'appli
   retient l'empreinte de chaque fichier de module à la fin d'une course `forme`
   réussie (marque `skel:<chemin>`, dans `vibecoder-state.json`, jamais dans le
   dépôt), sauf pour un fichier déjà généré à son départ ; un fichier qui en diffère
   est généré ; son numéro, son rang dans la Forme, l'ordre où les générer,
   « Ordre de génération : n sur N » au survol. **Le relecteur n'a plus cette étape** (0.16.0) : ni modules en lecture seule, ni vue IDE, ni cartes de commits ; la relecture du code se lit à l'arrêt « Publier » (F-101), et pour lire le code soi-même, *Ouvrir dans l'éditeur*. Les
   modules sont validés par le système quand la preuve passe (l'orchestrateur, par
   `step.validate`, F-116, refusé sans preuve qui passe) ; le badge de l'étape
   porte leur ✓ (F-93), plus de bouton *Valider les modules* à l'écran. Générer ne commite
   pas : *Commiter* et *Commiter les modules* (skill `commiter-modules`, un
   commit par module selon la convention du projet — par défaut : voir **Deux
   historiques**, plus bas —, un fixup pour un module
   déjà commité — jamais du premier commit de la branche, qui ne porte que la
   note, la forme, les invariants rouges et leurs squelettes —, un nouveau
   commit une fois la PR ouverte) sont des gestes à
   part. *Commiter les modules* est grisée (« modules pas validés ») tant que les
   modules ne le sont pas, quand le système enchaîne aussi (le système les valide, F-102). Elle suit l'ordre de la Forme et vérifie, avant
   chaque commit, qu'il compile : le typage du projet sur ce que le commit
   contiendra (l'arbre d'un index temporaire, extrait par `git archive` dans un
   dossier temporaire, `node_modules` lié), jamais sur le dossier de travail
   (que l'appli peut faire tourner) ni sur l'index réel, qui contiennent les
   modules pas encore commités. Un module de plusieurs chemins (« a + b ») ne
   fait qu'un commit ; si l'erreur de typage nomme les fichiers d'un module
   suivant de la Forme qui a des changements, ce module rejoint le même commit
   au lieu que tout s'arrête. Un projet sans typage connu
   (ni `AGENTS.md`, ni manifeste qui en donne un) : le commit reste et la
   réponse dit qu'il n'a pas été vérifié. Une erreur que ce rattrapage n'explique pas :
   elle s'arrête et le dit, ce commit et les suivants ne sont pas faits ; ni amend, ni
   rebase, ni `--no-verify` pour le rattraper.
   **Deux historiques**, au choix du projet. Le défaut, sans réglage, est celui
   qui précède : un commit par module, les corrections en fixups du commit qui
   possède le code, repliés avant la PR (un projet où l'on relit commit par
   commit). Un projet dont la convention de commit (`AGENTS.md` ou `CLAUDE.md`)
   porte les mots « Historique simple » (« Simple history » dans un projet en
   anglais) est en **historique simple** : ni case dans l'appli, ni clé de
   `.vibecoder/project.json`, le mot est dans le dépôt, partagé par l'équipe, et
   les skills de commit le lisent. Le premier commit ne change pas (la note, la
   forme, les invariants rouges, leurs squelettes) ; puis *Commiter les modules*
   fait **un seul commit** pour le code de tous les modules, avec tous les
   fichiers modifiés, nouveaux ou supprimés du dossier, les deux côtés d'un
   renommage compris (sauf une note que git ignore, jamais indexée), le typage vérifié comme ci-dessus, et sa réponse nomme les fichiers
   qu'aucun module de la Forme ne possède : rien n'échappe, et on voit ce qui est
   parti. Une correction faite après (*Appliquer la revue*, une vérification
   rouge, un retour d'essai) est un **commit ordinaire**, « revue : … », jamais
   un fixup ni un amend, la PR ouverte ou non : rien à replier, aucune
   réécriture d'historique (une PR ouverte, dans les deux modes, n'est jamais
   réécrite) ; la fusion en squash efface ces commits. Le parcours de l'écran
   convient aux deux et ne lit pas le mode : l'étape Modules est faite quand
   chaque module a un commit hors du premier et que rien n'est à commiter (ce que
   le commit unique remplit), *Replier les fixups* est masquée sans commit
   `fixup!`, l'étape Revue se fait sans fixup. Les skills de commit
   (`commiter-modules`, `commit-preparer`, `appliquer-revue`, `fixups`, `pr`) et
   `vibe` suivent le mode : sans ces mots, tout comme avant. **Le code, à un seul endroit** (0.16.0, créateur). Le code et les tests se
   lisent, ils ne se modifient plus à l'écran : ni éditeur, ni *Enregistrer* ni
   *Abandonner*, ni *Commenter* sur le code ; une correction se demande à l'agent.
   À gauche, l'arbre : les fichiers des modules rangés par dossier (un module de
   plusieurs fichiers n'y fait pas un nœud), puis les variants que change la branche
   (`VibeView.variants`) qu'aucun module ne liste, à leur place dans les dossiers
   (on voit où ils sont écrits, pendant et après la génération), chacun avec le numéro
   de son module (aucun pour un fichier de la branche : sans Forme, ou un variant)
   et son nom coloré comme dans VS Code : vert, nouveau ; jaune, modifié ; rouge barré,
   supprimé (pas commités, d'après `git status`) ; la couleur ordinaire une
   fois commité ; atténué en italique, un module pas encore généré. Sans module
   (sans Forme), l'arbre montre les fichiers de la branche. À droite, le fichier
   choisi : son **diff depuis la base de la branche**, en ligne, en lecture seule,
   numéroté et coloré, en texte (I-40) ; un fichier créé est tout en ajouts, un fichier
   supprimé tout en retraits. Pas de menu de diff, ni *En ligne* · *Côte à côte*, ni
   *IDE* · *liste* (le réglage `vibeModulesView` reste au relevé, « d'avant » : la page
   ne le lit ni ne l'envoie). **Une seule exception, et seulement quand elle sert** :
   après une correction, l'en-tête de l'étape dit « modifiée depuis la validation »
   (F-93) ; un clic dessus bascule le diff sur ce qui a changé depuis le ✓
   (F-102), un second revient à la base ; une étape sans validation : pas de
   bascule. *Ouvrir dans l'éditeur*, une icône discrète sur le fichier affiché, est la
   sortie de secours vers l'éditeur du développeur. Seul le fichier affiché est lu,
   à l'ouverture puis à chaque changement sur le disque (surveillé et poussé par
   le principal, pas au rythme du relevé : pendant la génération, le code s'écrit) ;
   plus d'1 Mo ou illisible : « fichier trop gros ». Le canal d'écriture et ses
   garde-fous restent dans le principal (le seul fichier suivi, existant, dans le
   dossier de l'agent, I-37, I-39 ; refusé si le fichier a changé sur le disque depuis
   son ouverture, ou pendant un tour de la conversation ou une course qui génère ce
   module, recalculé par le principal avant d'écrire) : la page du créateur ne
   l'appelle plus. La carte prend toute la hauteur libre de l'étape (au moins
   420 px) ; l'arborescence défile seule, et à droite seul le code ; une poignée entre
   les deux colonnes (glisser, ou ← / →) règle la largeur de l'arborescence (160 px →
   60 % de la vue), gardée tant que la page vit, pas enregistrée. Prochaine action : *✓ Commiter*
   (un commit préparé), sinon *Générer les modules* tant qu'un module n'est
   pas commencé (un module n'est commencé que si un fichier a changé depuis son
   squelette : un commit sans la note le touche, ou, la note commitée, un de ses
   fichiers n'est pas commité ; ceux qui restent, dans l'ordre de la Forme :
   **au plus 4 modules de code** (sans compter ceux de « variants : aucun », la
   doc et les textes de skills), un seul agent `developpeur` les écrit tous, à la
   suite, dans un seul contexte, les variants rouges d'abord pour chacun, les
   modules sans variants après les modules de code ; au-delà, des agents Sonnet
   en parallèle, par vagues. Le seuil se compte dans la Forme, sans estimation de
   lignes, et n'est pas réglable. Chaque diff est relu par l'orchestrateur, sans
   commit ; masqué quand tous le sont), puis *Prouver les invariants* tant que
   la preuve n'a pas passé, puis *Commiter les modules* (un commit par
   module, ou un fixup, rangés par l'agent ; en historique simple, un seul commit
   pour tout le code : le dev génère, relit, ajuste, et laisse les commits à la
   fin). *Générer* d'un module en génère un seul
   (avec `ponytail`, la même boucle que *Générer les modules* pour un seul : son
   diff relu, les défauts corrigés, le typage et ses tests relancés jusqu'au vert,
   dans sa course ; sans commit), au choix de l'agent qui le demande par la CLI. Plus de
   *Valider → commit → suivant* ni de *Commiter* par module (0.13.0 :
   commiter module par module ne se faisait pas en pratique). *Relire le
   diff* (les quatre questions du § 5.1) ne part plus après *Générer* (sa course
   relit son diff elle-même, F-115) : à la demande, par l'agent, en lecture seule.
   Relecteur : voir F-101.
   **La preuve des invariants** (0.16.0 ; *Prouver les invariants*, action `prove`,
   skill `prouver`, créateur, en lecture, *opus · élevé*, entre *Générer les
   modules* et *Commiter les modules*). Pour chaque ligne « → invariant » de la
   note, elle casse volontairement la règle dans une copie du code, faite par
   copie de fichiers dans le dossier temporaire de sa course (sous les sorties,
   `node_modules` liés, effacée à sa fin, I-58), hors du dossier de travail comme
   l'arbre temporaire de *Commiter les modules*, et relance le test : il doit
   échouer ; un test qui reste vert ne protège rien. Un mutant ne compte que si
   le test passe d'abord sur la copie intacte, si la copie mutée passe le typage
   du projet, et si le test échoue alors sur une de ses assertions, pas au
   chargement ni au démarrage ; sinon il est écarté et un autre est essayé. Sa
   sortie, `preuve.md` : une rubrique par ligne « → invariant », `## [prouvé]`
   (`## [proved]`) et son mutant, ou `## [toi]` et sa raison ; « Rien à
   prouver. » sans ligne. La preuve a lieu à l'étape Modules, mais
   son résultat ne s'affiche qu'à l'étape Invariants, sous chaque ligne « → invariant »
   (*prouvée*, *non prouvée*), jamais à l'étape Modules (0.16.0). L'étape Modules n'est pas faite
   sans preuve qui passe : une preuve absente, en échec, ou avec une rubrique
   `[toi]` la laisse pas faite, en express aussi (I-66) ; une preuve passée le
   reste quand le code change ensuite (une correction après l'essai à
   l'écran), seule une nouvelle course la remplace.
   - *Droits* : une action en lecture, le contrôle des fichiers de l'appli lui
     refuse toute écriture dans le projet (sa mutation ne vit que dans ses sorties),
     aucune commande git qui écrit ne lui est ouverte (I-65 ; I-57 et I-58 ne
     changent pas). Mais elle garde le terminal entier, qu'une liste de commandes
     interdites ne ferme pas : à sa fin, quelle qu'elle soit (finie, en échec,
     arrêtée), l'appli compare l'état du dossier de travail et de l'index à celui
     de son départ ; la moindre différence (une copie de fichier comprise) fait
     échouer la course, sa réponse nomme les fichiers touchés et `preuve.md` est
     effacée. Les fichiers que git ignore ne sont pas regardés. Un fichier
     modifié par l'utilisateur pendant la preuve la fait échouer à tort : elle
     nomme ce fichier et se relance.
   - *Un test resté vert* repart à l'alignement existant (*Vérifier l'alignement* :
     depuis la note, sans le code, 3 tours au plus), avec la règle que le mutant a
     cassée dite dans les mots de la note, puis la preuve est relancée une fois ;
     encore vert : `[toi]`. Seuls les fichiers de tests d'invariants nouveaux se
     corrigent (I-64) : un test d'avant le ticket ne se corrige pas, ni un cas que la
     branche ajoute dans un fichier existant ; il remonte en `[toi]`. Une ligne
     « → invariant » déjà observée par un test d'avant le ticket est prouvée aussi,
     avec le même sort.
   - Ne remontent en `[toi]` que les invariants que le système n'arrive pas à
     prouver, et ce qui demande de changer la note. Aucun invariant non prouvé
     n'est accepté en silence (I-66) : l'orchestrateur ne valide les modules, par
     `step.validate`, qu'une fois la preuve passée.
5. **Revue** — faite : vérifications toutes passées (`checks.json` ; des
   avertissements seulement passent ; un ancien ne compte pas, I-46),
   ponytail review faite (`ponytail.md`),
   aucun commit `fixup!`, et, s'il y a un plan à l'écran, chacune de ses cases
   cochée. Montre, **en créateur** (0.16.0), **une seule carte** : avant la
   revue, une ligne qui dit quand elle part (« la revue part après votre essai » au
   rythme par défaut, « la revue part après les modules » en express) ; après, une
   ligne par vérification en échec (son nom ; rien quand tout passe ; un
   avertissement n'est pas un échec ; un `checks.json` illisible : la carte le
   dit), puis les remarques `[toi]` de la ponytail review en avant, sans bouton (on
   y répond dans le questionnaire ou à l'agent, comme le moteur le fait déjà), les
   `[agent]` repliées sous leur nombre (F-95). Aucun bouton (ni *Lancer*, ni
   *Relancer*, ni *Appliquer*, ni case), plus de liste « Avant la PR » (§ A.3), de
   compte par état ni de carte vide (« Pas encore de vérification », « Pas encore
   de ponytail review », « Pas encore de plan de test »). Le plan de test à l'écran
   (`ecran.md`, skill `ecran`, *Plan de test à l'écran* : comment lancer la
   branche, `{{ref}}`, puis quoi essayer — utile aussi en créant), s'il existe :
   ses cases à cocher, sans *Relancer* ; sans plan, rien. **Le relevé garde** la
   liste du § A.3 (créateur ; le relecteur n'a pas la liste), cochée d'après le
   dépôt quand c'est possible (la note dans
   un commit de la branche, ou, ignorée par git, un commit au moins ; tous les contrôles dont le nom contient
   « invariant » passés, quelle que soit la partie : `invariants (backend)`… ;
   aucun `fixup!` et chaque module de la Forme dans au moins un commit : la case
   « Chaque module commité, aucun fixup à replier » (« Every module committed, no
   fixup to fold »), dont la règle ne dépend pas de l'historique du projet : un
   seul commit pour le code de tous les modules la coche) ; « Chaque diff a été
   relu » est cochée par le relevé (0.16.0 : les modules validés par le système,
   donc leur contrôle de conformité et la preuve passés, et la ponytail review
   faite ; décochée sinon, plus à la main ; son aide dit par quoi) ;
   « AGENTS.md à jour » reste la seule à cocher à la main, facultative (« à
   vérifier » tant qu'elle ne l'est pas ; F-102, cible `a3:<rang>`, pour le commit
   de tête de la branche : un commit de plus la décoche ; grisée sans commit),
   cochée elle compte comme faite : l'écran ne la montre plus, la CLI et le relevé
   la gardent ; les faits de l'étape (l'infobulle du fil d'Ariane) ajoutent
   « n avertissements ». La ponytail review rendue s'applique par l'action `apply`
   (skill `appliquer-revue`, sur Sonnet : chaque remarque en fixup du
   commit qui possède le code, ou, en historique simple, toutes ensemble dans
   un commit ordinaire « revue : … » sans chercher de propriétaire, avec le droit
   `git commit -m` en plus, rien d'autre (I-57 ne change pas) ; `{{text}}` lui donne
   la remarque, ou les remarques cochées, une par ligne de liste, rien : toutes ;
   elle ne prend pas le champ ; pas proposée pendant une course `apply` — en cours,
   en attente, arrêtée pas tranchée). Une remarque appliquée
   (`ponytail-applied.json`, F-95, d'après le `<fichier>:L<ligne>` en tête)
   est marquée au relevé. Le relecteur ne change pas : pour les deux rôles, une catégorie
   **Relire à l'écran**, après elles : le plan de test (`ecran.md`), une case par
   chose à essayer, cochée dans le fichier, ou cochée à l'écran (validée pour ce
   plan-là, F-102, `check:<rang>` ; décocher la refuse, même cochée dans le
   fichier) ; chez le relecteur, *Tout cocher* coche d'un clic celles qui ne le sont pas, pour aller vite ; sans plan, une phrase qui renvoie à *Préparer la revue*, sans bouton ni *Relancer*. Toutes les cases cochées comptent
   pour que la Revue soit faite, pour l'un comme pour l'autre. Prochaine action : *Lancer les vérifications et la
   ponytail review* (tant que `checks.json` ou `ponytail.md` manque, ou
   qu'une vérification échoue), puis *Replier les fixups* (masquée sans commit
   `fixup!` : en historique simple, les skills n'en font aucun ; s'il en reste
   un, fait à la main ou d'avant le passage au mode, le skill le replie comme
   d'habitude, et sans aucun il dit « Rien à replier : historique simple »).
6. **PR** — faite : une PR pour la branche, lue par gh (F-112 ; sinon
   `pr.json`). Montre la PR (numéro, titre, base ← branche,
   *Ouvrir* dans le navigateur) et l'état de la CI (`ci.md`) ; en créateur
   (0.16.0), la carte de la PR et l'état de la CI, une ligne par vérification en
   échec, rien quand tout passe, la CI en cours dite, un `ci.md` illisible tel quel,
   sans PR une phrase : aucun bouton. Ses actions
   suivent l'état de la PR (F-99) ; le créateur les lance par le moteur ou par
   l'agent (CLI), plus d'un clic : sans PR, *Valider la feature (ouvrir la
   PR)* ; ouverte, *Diagnostiquer la CI* ; fusionnée,
   *PR mergée → revenir sur la base* (F-114 ; sur un enfant, *Retirer le
   worktree* à sa place, dans la vue des branches, F-110). Retirées en 0.15.0 :
   *Release candidate* et *Release officielle* (leurs skills `rc` et `release`
   aussi). Créateur assigné à une PR qui n'est pas la sienne : *Me retirer
   de la PR* (F-101, par la CLI chez le créateur). Relecteur : F-101, inchangé.

**Le contrôle en trois points** (0.16.0, note `0.16.0-controle-en-trois-points` ;
créateur). L'utilisateur intervient à peu d'endroits : la note qu'il valide
(ses lignes « → invariant » comprises, F-102), deux pauses où il regarde puis
reprend, et une question `[toi]` (F-95) ; le reste est fait et contrôlé par le
système (F-103). Le parcours dit où il se tient (`pause`, au relevé) :
- **`note`** : un commit porte la note (ou, ignorée par git, la branche a un
  commit) et elle n'a plus son ✓ ;
- **`withdrawn:forme`**, **`withdrawn:invariants`**, **`withdrawn:modules`** : le ✓
  de cette étape retiré à la main tient (le retrait retenu est celui du contenu
  d'aujourd'hui de l'étape, F-102) ; la première dans l'ordre s'il y en a
  plusieurs ; l'action du moteur est masquée tant qu'elle dure (« étape
  refusée ») et revient une fois la pause levée ; l'étape reste faite et ses
  actions restent au registre : c'est par elles, ou par une demande à l'agent,
  que son contenu change ; le badge de l'étape dit « faite · ✓ retiré » et se
  clique pour rendre le ✓ (F-93), la ligne d'état nomme l'étape ;
  **`withdrawn:invariants`** se tient aussi tant qu'un test d'invariant de la
  branche est noté *À revoir* par l'utilisateur (sa marque vaut pour le contenu
  d'aujourd'hui du test) : la ligne d'état dit alors « 1 test à revoir : dites à
  l'agent quoi corriger » ;
- **`invariants`** : **avant le premier commit**. La note et la Forme faites,
  les tests d'invariants prêts (alignés, ou chaque cas validé) et lus en
  pseudo-code, rien de commité ni de commit préparé, aucun module commencé :
  l'utilisateur regarde ses règles avant que quoi que ce soit soit commité, et
  le premier commit part une fois le moteur repris (c'est alors la prochaine
  action de l'étape Invariants, encore en cours). Sans ligne « → invariant »,
  elle se tient de même, la Forme posée (c'est elle qui est à voir). Le premier
  commit fait, ou un commit préparé : plus cette pause ;
- **`modules`** : l'étape Modules faite, la Revue pas commencée (ni
  vérifications ni ponytail review) ;
- sinon aucune, dans cet ordre (la première qui s'applique). Le relecteur n'en
  a jamais, un retrait dans ses marques compris.
Si cette pause est tenue dépend du rythme (F-103), pas du parcours. Les
relectures faites pour un humain ne sont plus sur le chemin du créateur :
*Relire le diff* d'un module reste proposée, à la demande (par l'agent), jamais
comme prochaine action ; *Lire en pseudo-code*, elle, est lancée par le moteur
après chaque écriture des tests d'invariants (F-100) et la pause après les
invariants l'attend ; *Relire la note* et *Relire le code* (`review-commits`, l'étape PR) ne sont lancées que par *Préparer la revue* ou l'agent, en relecteur. La revue ponytail
reste sur le chemin. Le parcours du relecteur : F-101.

**La note hors du projet** (0.16.0, note `0.16.0-notes-hors-projet`). Un projet
peut exclure ses notes de git, à la main (`docs/tickets/` dans
`.git/info/exclude`) : une note que git ignore (`git check-ignore -q`) est
**hors du projet**. Ni réglage ni case : git dit si elle l'est. Le relevé la
retrouve sur le disque (`status --ignored`, jamais dans les fichiers changés),
par la clé de la branche — son ticket, sinon sa version, sinon son nom sans son
type, en nom exact (`feat/teams-admins` → `teams-admins.md`, jamais une note qui
contient seulement le mot) : une branche sans ticket ni version trouve aussi sa
note. Parmi les notes ignorées, seule compte celle nommée exactement comme la
branche : git ne retire jamais un fichier ignoré, celles des branches passées
restent sur le disque. Un agent sur la PR qu'il suit — sa branche, ou son
worktree sur une branche locale `pr-<n>` — cherche la note d'après la branche de
la PR (la tête de sa fiche), pas d'après ce nom local ; passé sur une autre
branche, la PR gardée en mémoire ne compte plus.
Alors : aucun skill ne la commite ni ne la pousse, même de force, et la PR ne
la cite pas (ni lien ni chemin) ; le premier commit de la branche ne garde que
les squelettes de la Forme et les tests d'invariants rouges, et il tient lieu de
« commit de la note » (le plus ancien de la branche : le parcours n'attend
aucun commit d'elle, la Forme reste faite quand elle change, rien à
recommiter) ; la case « note commitée » de l'étape Revue se coche dès que la
branche a un commit. Le prix : la note vit dans la copie de travail, retirer le
worktree de la branche l'efface. Relecteur sans note (elle est restée chez
l'auteur) : si son dépôt ignore `docs/tickets/`, l'écran dit « pas de note » et
*Relire la note* est sautée, sans reproche ; sinon, comme avant. Un projet qui
n'ignore pas `docs/tickets/` ne change en rien.

Une nouvelle demande commence sur la base par *Rédiger la note* (ci-dessus,
F-110) : sur une branche neuve du dossier, ou dans un worktree. Une branche
sans demande : *Créer une branche*, dans la vue des branches (F-110). Sur la
base, la nouvelle demande va à la conversation de l'agent : demandée pendant
qu'elle travaille (l'agent lui-même, par sa CLI), elle est refusée avec ce
qu'il faut faire — créer d'abord la branche du ticket, puis relancer la note —
et non « L'agent travaille » (0.16.0).

**F-101 Le relecteur** (la PR de la branche active ; la review du guide, § 5.4).
Même écran que le créateur (F-100), avec un fil à lui de quatre arrêts (0.16.0) : le rôle ne se choisit pas, l'appli le décide, et il n'y a plus de *Créer* / *Relire* (F-92). Il est
recalculé à chaque relevé d'après la PR du dossier — la PR suivie si le dossier
est sur sa tête (ou sur son robot), sinon la PR ouverte de la branche — et ses
personnes, auteur, assignés, et mon identifiant, lus par
gh (F-112) :
- **créateur** : sur une branche sans PR ouverte (la base comprise : sans PR,
  rien à relire ; une PR fusionnée ou fermée aussi, sans bandeau ni raison
  grisée), sur sa propre PR, ou sur une PR qu'on s'est assignée ;
- **relecteur**, par défaut : sur une PR ouverte dont on n'est pas l'auteur,
  qu'on nous ait demandé de la relire ou non, tant qu'on ne se l'est pas
  assignée.

Tant que les personnes ou l'identifiant manquent (gh en fond, pas encore de
réponse, en échec), le rôle d'avant reste. Charger ou décharger une PR ne se
fait pas ici mais dans la vue des branches (F-110), d'un clic dans l'une de ses
listes (*Mes PR*, *À relire* — celles où l'on est demandé en relecture —,
*Toutes les PR*, F-112) : la suivre (`agents[].vibe.pr`), puis la charger ; son
nom apparaît aussitôt dans le bouton de la branche (F-92). Le parcours et le
dossier de l'agent sont les mêmes : *Charger la PR* la récupère dans ce dossier,
sa fiche `pr-<n>.json` (titre, auteur, base, branche, description, état) puis sa
branche et celle de sa base (`git fetch origin <tête>`, puis `<base>`, par
l'appli, F-114 ; *via* : le skill, dans la conversation) ; une PR venue d'un
fork (sa branche n'est pas sur `origin`) est refusée au chargement. Rien n'est
récupéré à part (ni `refs/vibecoder/pr/<n>`, ni fichiers écrits pour l'éditeur).
Le dossier ne change pas encore de branche : l'appli demande toujours d'abord
(F-110). Le parcours se lit alors dans la copie de travail, sur la branche de la
PR ; ce qui la lit attend qu'elle soit chargée, puis que le dossier soit sur sa
branche (ou sur son robot). Sur une branche qui a sa PR ouverte, devenu
relecteur (le dernier relevé), la PR est suivie d'emblée, sa fiche écrite d'après
ce relevé, sans rien charger.

**En relecteur, tout est en lecture seule** : rien ne s'édite (ni la note, ni un test), rien ne se génère ni ne se commite. Le principal refuse ce qui modifie, quoi que dise la page, ainsi qu'*Enregistrer*, d'après le rôle de son dernier relevé (I-37, I-39) ; en relecteur toute course lit : *Vérifier l'alignement*, qui corrige les tests chez le créateur, n'écrit ici que dans le dossier de sorties, et les lectures courent ensemble. Le badge *Relecteur* de l'en-tête le dit (F-92).

**La revue essentielle** (0.16.0) : le développeur se tient sur la note, les règles et l'essai à l'écran ; le reste est un contrôle secondaire, automatique. Rien ne change pour le créateur.
- **Quatre arrêts**, au fil (F-92) : *Note*, *Règles*, *Essai*, *Publier*. Plus de Forme (rien à y juger), plus de Modules : on ne relit plus l'histoire des commits (tous les projets fusionnent en squash, ces remarques ne seraient corrigées par personne), ni « N commits » au fil, ni liste des commits ; la PR s'ouvre sur GitHub depuis sa carte.
- **Une ligne et un bouton** (F-92) : sous le fil, une phrase dit ce que le système lit ou ce qu'il attend du relecteur ; à côté, *Préparer la revue*, à tous les arrêts.
- **Préparer la revue** : un seul geste, qui lance d'un coup les cinq lectures — la relecture de la note par l'agent (`review-note`), le pseudo-code des tests (`read-invariants`), l'alignement (`align`), la relecture du code (`review-commits`) et le plan de test à l'écran (`screen`) — pour que le relecteur trouve tout prêt. Le relevé dit celles qui restent à lancer (`prepare`) ; la page demande chacune, une demande par lecture, dans cet ordre, par le canal des actions : rien dans le principal ne lance une lecture. **Jamais automatique** : charger une PR, l'ouvrir, changer d'arrêt ou un relevé ne lancent rien et ne dépensent aucun token. Une revue déjà préparée : le bouton ne lance que ce qui manque (la sortie n'est pas là) ou a été lu sur une autre tête de la PR ; les lectures des tests suivent leur empreinte ; une lecture en cours ou en file n'est pas relancée ; sans note, pas la relecture de la note ; sans test d'invariant, pas le pseudo-code ; sans note ni test d'invariant, pas l'alignement ; hors de la tête de la PR, rien. Rien n'est payé deux fois. Grisé, sa raison en infobulle (tout est lu, des lectures courent, ou le dossier n'est pas sur la branche de la PR), quand il n'y a rien à lancer ; absent sans PR chargée. Les boutons de chaque lecture (*Relire la note*, *Lire en pseudo-code*, *Relire*, *Tout relire*, *Vérifier l'alignement*, *Relire le code*, *Plan de test à l'écran*, *Relancer*) ne sont plus à l'écran ; chaque lecture reste lançable seule par l'agent et sa CLI.
- **La marque de chaque lecture** (`read:<pr>:<action>`, une par PR, sauf `read-invariants`, qui suit l'empreinte des tests, parmi les marques de l'agent, `vibecoder-state.json`, jamais dans le dépôt) : à la fin d'une lecture réussie, qu'elle vienne de *Préparer la revue*, de la CLI ou de la file, le principal pose la marque, pour la PR et le commit de tête du relevé d'où elle est partie ; échouée ou arrêtée, rien (elle sera relancée) ; la PR ou la tête pas retenue au départ (l'appli relancée entre-temps) : rien ; relue sur une autre tête de la même PR, la marque d'avant est remplacée ; une autre PR a la sienne : relire A, passer à B, revenir à A ne relance rien de ce qui est lu ; la fin est rangée une seule fois, au relevé suivant. La page ne peut pas l'envoyer (refusé). La revue suit la PR, sans comparer d'heures. Les anciennes marques `commit:<hash>` restent au relevé, sans compter.
- **Les verdicts proposent**, à la publication, d'après la note et les tests seuls (plus de verdict par commit) : un *À revoir* sur la note ou un test propose *Demander des changements* ; la note et chaque test validés : *Approuver* ; rien de jugé : aucun verdict ; sinon *Commenter*. Le choix de l'utilisateur l'emporte, et rien ne part avant son clic sur *Publier la revue*. *À revoir* n'ouvre pas de zone de remarque de lui-même : il montre « Ajouter une remarque au brouillon », qui l'ouvre ; sans ce clic, rien n'est ajouté.
- **Les remarques restent sur place** : celles du brouillon sont sous l'élément commenté (un passage ou un bloc de la note, une règle, un test, un constat), grisées et empilées quand il y en a plusieurs, avec un crayon (la zone de remarque sur place, même cible, mêmes limites) et une croix (la retirer), comme dans le brouillon de l'étape Publier.

Les arrêts, faits quand :
1. **Note** — absente de la PR, ou jugée : *Valider*, ou *À revoir* (rien au brouillon de lui-même). Montre la relecture de la note par l'agent (`pr-<n>-note.md`) au-dessus de la note de la PR, sans bouton à elle, puis la note (comme pour le créateur) : ses remarques sur ses lignes, la bulle de chaque bloc au brouillon.
2. **Règles** — chaque test jugé (*Validé* ou *À revoir*), lu ou pas : la même vue que le créateur (F-100), une règle par ligne « → invariant » et ses tests en pseudo-code, *Validé* / *À revoir* sur chaque test, l'alignement en tête, sans preuve ; la bulle d'un test, d'une règle ou du point d'attention ouvre une remarque pour le brouillon ; un test d'avant la branche que la PR modifie le dit.
3. **Essai** — le plan à l'écran écrit et toutes ses cases cochées (*Relire à l'écran*, F-100) : ses cases, cocher valide, *Tout cocher* ; sans plan, une phrase qui renvoie à *Préparer la revue*, sans bouton.
4. **Publier** (la PR) — la revue publiée (`pr-<n>-review.json` : son état, son lien, le
   verdict donné, le texte publié et sa date ; une revue d'avant n'a que les
   deux premiers). Montre la carte de la PR, *S'assigner la PR*, puis **les constats de l'agent sur le code** — la relecture du code, `pr-<n>-commits.md` (le fichier garde son nom) : un constat par titre `##` (hors bloc de code ; ce qui précède le premier est une introduction ; un fichier sans titre : aucun constat, son texte gardé), son détail et sa bulle (F-98) ; pas encore de relecture : une phrase, sans bouton ; la relecture lit tout le diff de la PR en une passe (skill `relire-commits`) : les quatre questions du guide (§ 5.1), la duplication avec du code existant, le code suit-il la note et sa Forme, les bugs, les en-têtes de fichiers ; rien sur l'histoire des commits —, puis le **brouillon de revue**, le verdict (*Approuver*, *Commenter* par défaut — ou celui que
   proposent les verdicts, ci-dessus —, *Demander des changements*) et *Publier la revue*, qui l'envoie sur GitHub, tel quel, avec
   ce verdict (F-114). Une fois publiée, la revue affichée est marquée envoyée :
   grisée, avec son résumé sur sa ligne d'état (le verdict, le nombre de
   remarques, la date, le lien), et *Publier la revue* est grisé (« déjà
   publiée ») tant que ni le brouillon ni le verdict n'ont changé — une remarque
   de plus, ou un autre verdict seul, en fait une nouvelle revue ; une revue
   d'avant (sans verdict ni texte) laisse *Publier la revue* possible. Le brouillon, le verdict et *Publier la revue* sont
   réservés au relecteur : le créateur corrige lui-même (*Commenter* cite dans
   la conversation) et GitHub refuse d'approuver sa propre PR.

**S'assigner la PR** (`assign-pr`, direct, F-114), dans l'étape PR : un
relecteur peut s'assigner une PR dont il n'est pas l'auteur, pour la modifier ;
au relevé suivant il y travaille en créateur. **Me retirer de la PR**
(`unassign-pr`), dans l'étape PR d'un créateur assigné qui n'est pas l'auteur,
le refait relecteur. Aucun des deux ne part autrement qu'au clic (jamais par
l'agent, ni à la suite d'une autre action).

Le brouillon, gardé par PR : une remarque = sa cible (une ligne, 300
caractères au plus) et son texte (5 000 au plus) — le texte du champ s'il y
en a (le champ se vide ; trop long, il reste et l'écran le dit), sinon ce
qu'on cite. La bulle sur la note, sa relecture, l'alignement, une règle, un test ou un constat, ou le bouton « Ajouter une remarque au brouillon » d'un *À revoir* (la note, un test), ouvrent la zone de remarque : la remarque s'ajoute à *Ajouter* ; elle se modifie
sur place (même cible, mêmes limites) ou se retire (×), sous l'élément comme ici.

**Ouvrir**, ce que désigne un id du dernier
relevé (I-37), dans l'éditeur (`editorCommand`, sinon le premier trouvé,
F-56) :
- un fichier (la note, un test, un variant, un module), à une ligne si
  l'écran la donne (un cas de test : zed `fichier:ligne`, code, cursor, codium `-g fichier:ligne`, un
  autre éditeur : le fichier seul), celui de la copie de travail, en relecteur
  aussi (le dossier sur la branche de la PR ; un dossier ne s'ouvre pas) ;
- `c<rang>` : le diff d'un commit (`git show`, sans programme externe, I-39),
  écrit dans `<sorties>/files/<hash>.diff`, en lecture seule ;
- `gh:c<rang>` : la page du commit sur GitHub, dans le navigateur, d'après
  l'origine du dépôt comme *Ouvrir sur GitHub* (I-32) ; sans origine
  GitHub, rien.

Un fichier écrit pour être ouvert remplace le précédent ; son dossier reste
dans le dossier de sorties (un lien qui en sort : rien n'est écrit).

**F-110 La vue des branches : changer de branche, un nouveau worktree,
mettre de côté.** Où relire une PR, sur quelle branche aller, où créer une
branche, et la fin d'un worktree, dans le dossier de l'agent. Tout ce qui change de branche est dans la **vue des
branches**, qu'ouvre le bouton de la branche (F-92), quel que soit le rôle ; seuls les choix d'une nouvelle demande s'affichent aussi au-dessus
du champ de la conversation (ci-dessous). La vue montre :
- quatre onglets : *Mes PR*, *À relire*, *Toutes les PR* (les PR ouvertes
  du dépôt, demandées à gh à l'ouverture, F-112) — un clic sur une PR la
  suit et la charge (F-101, F-114), puis ses choix (ci-dessous) — et
  *Branches locales* (la branche active marquée) — un clic : *Aller sur la
  branche* (`switch-branch`) ; un champ de recherche filtre l'onglet ouvert
  (chaque mot, sans casse, dans le numéro, le titre ou l'auteur d'une PR, le
  nom d'une branche), dans les listes déjà lues, sans appel à gh ; dans
  *Toutes les PR*, *Me demander en relecture* (`request-review`, direct) sur
  une PR ni des miennes ni déjà à relire : au clic, l'identifiant lu (`gh api
  user --jq .login`), puis `gh pr edit <n> --add-reviewer <identifiant>`, et
  les trois listes relues (la PR passe dans *À relire*) ; son dernier échec
  sous les onglets ;
- la PR chargée et ses choix ; *Revenir sur la branche principale* ;
  *Créer une branche* ; *Retirer le worktree* (sur un enfant) ;
  *Actualiser* (`fetch`, F-114 : l'état distant, pour *Pull* et la pastille
  de *Rebase*, F-92 ; les listes de PR relues aussi). *À relire* : la recherche
  `review-requested:@me` de GitHub (qui voit les demandes faites à une équipe,
  mais avec quelques minutes de retard) plus les PR dont les demandes de
  relecture, lues directement, nomment mon identifiant : une demande qu'on vient
  de faire paraît tout de suite, après *Me demander en relecture* ou *Actualiser*.

Un **worktree** (l'enfant d'une demande, le robot d'une PR) reste sur sa
branche : sa vue des branches ne montre qu'*Actualiser* et *Retirer le
worktree* ; *Pull*, *Rebase* (sur la branche principale ou une autre) et
*Pousser* restent à côté de la branche. Le principal refuse, sur un worktree,
tout ce qui change la branche du dossier ou la PR qu'il suit (`BRANCH_CHANGES` :
les choix de lieu sauf *Mettre de côté*, charger une PR, revenir sur la base
d'une PR fusionnée), au clic, via l'agent ou à la demande de l'orchestrateur.

Chaque choix est une
action directe (F-114), au clic seulement ; créer et retirer un worktree,
c'est la recette du projet (F-111), lancée par l'appli, sans IA. L'appli
demande **toujours** (aucun réglage ne choisit à sa place, F-111), selon
l'état du dossier (`git status` du relevé). Masqué n'est pas refusé ; au
clic, avant tout `git switch`, un `git status` frais (pas celui du relevé) :
une ligne, ou pas de réponse → refusé, rien ne bouge.
- **Charger une PR.** La PR chargée (F-101), le dossier hors de sa branche,
  la vue des branches propose, même sur un dossier propre sur la base :
  - *Changer de branche* (`pr-here` ; *via* : l'agent, dans la
    conversation) : `git fetch origin <tête>`, `git switch <tête>` (la
    tête de `pr-<n>.json`), puis `git pull --ff-only origin <tête>` (une
    branche locale d'avant mise à jour ; pas en avance rapide : l'échec) ; grisé avec des modifications (« Des
    modifications en cours »). Les sorties de la branche restent rangées par branche
    (F-95) et reviennent avec elle. Masqué sur la branche de la PR et sur le
    robot d'une PR ;
  - *Dans un nouveau worktree*, le dossier propre ou pas
    (`pr-worktree` ; *via* : l'agent) : `git fetch origin <tête>`
    (`origin/<tête>` existe pour le script du projet), puis la recette crée
    le worktree avec `VIBECODER_BRANCH` = `pr-<n>` (une branche locale
    neuve, même si celle de la PR existe déjà sur la machine) et
    `VIBECODER_BASE` = la tête de la PR ; le départ du repli git :
    `origin/<tête>`. Pendant ce temps : « Création du worktree en cours… ».
    Le worktree créé, l'appli écrit elle-même la fiche `pr-<n>-worktree.json`
    (`{ dir, branch }`) dans les sorties de l'agent du dépôt et ajoute un
    **robot temporaire** « PR #n » sur ce dossier, un enfant de l'agent du
    dépôt (F-51) avec sa PR (`agents[].parent` `{ id, pr }`, § 9 : le
    modèle, l'effort et le mode de l'agent du dépôt, relecteur,
    la PR suivie, sa fiche et son brouillon de revue repris) — seulement
    après la question de confiance, **toujours posée** pour le worktree
    d'une PR (ses réglages `.claude` sont ceux de la PR et se chargeront ;
    I-23, I-41). *Annuler* : pas de robot ; *Ajouter le robot PR #n* la
    repose. Le robot là : *Aller au robot PR #n*. Masqué la PR déjà dans un
    worktree, et sur un enfant. Il ne change ni la branche du dossier ni la
    PR suivie : cliquable pendant une action et quand la conversation
    travaille (F-115), par l'appli ; par l'agent (*via*), grisé quand elle
    travaille (I-25) ;
  - avec des modifications, en plus, *Mettre de côté* (ci-dessous).
- **Revenir sur la branche principale** (`unload-pr`, l'ancien *Décharger* ;
  une PR chargée, ou le dossier hors de la base ; pas sur le robot d'une
  PR) : `git switch <base>` (la base du dépôt), puis la PR n'est plus suivie ;
  grisé avec des modifications. Avec des modifications : *Mettre de côté*,
  ou *Rester sur la branche* (ne plus suivre la PR, sans git). Publier la
  revue ne change pas de branche.
- **Aller sur la branche** (`switch-branch`, un clic dans *Branches
  locales*) : `git switch <branche>` (une branche du dernier relevé) ; grisé
  avec des modifications (*Mettre de côté* à côté), comme tout `git switch`.
- **Une nouvelle demande.** Sur la base, *Rédiger la note*
  (F-100 ; la demande du champ de la conversation, exigée) part comme une nouvelle
  demande (`new-request`) : le message part à l'agent (skill
  `nouvelle-demande`, sous-contexte, haiku · faible), qui propose un nom de
  branche d'après la demande, selon la convention du projet (sinon
  `<type>/<ticket>-<intitulé>`, sans ticket `<type>/<version>-<intitulé>`),
  et l'écrit dans `<sorties>/new-request.json` (`{ branch }`, un ref sûr) ;
  il ne crée ni ne lance rien. Hors de la base, `new-request` est masquée :
  une branche active ne propose jamais de nouvelle branche. La demande, elle,
  reste dans le principal (en
  mémoire), pas dans ce fichier ; une nouvelle remplace celle en attente. Au
  relevé, la fiche et une demande en attente : la fiche supprimée, la
  branche retenue avec la demande (rien n'est créé au relevé) ; au-dessus
  du champ de la conversation, « Voulez-vous créer la branche … ? », le nom
  prérempli et modifiable (un ref sûr, pas déjà une branche locale), et ses
  choix :
  - *Créer ici* (`new-here`) : `git fetch origin <base>`, puis
    `git switch -c <branche> origin/<base>` (la base du dépôt) ; grisé avec
    des modifications ;
  - *Dans un nouveau worktree*, le dossier propre ou pas
    (`new-worktree`, pas sur un enfant) : `git fetch origin <base>`, puis la
    recette crée le worktree sur
    cette branche (`VIBECODER_BASE` = la base du dépôt, départ
    `origin/<base>`), puis un enfant s'y ouvre (la question de confiance
    pour un dossier jamais choisi, I-23 ; refusée : la demande reste
    retenue, l'échec le dit), affiché ; le robot du parent reste
    sur sa branche, avec ses modifications s'il en a ; cliquable de même
    quand la conversation travaille (F-115) ;
  - avec des modifications, en plus, *Mettre de côté*.

  Ensuite le dossier (ou l'enfant) est affiché, créateur ; à son premier
  relevé, *Rédiger la note* part avec la demande. Un échec (pas de base, la
  recette, l'enfant pas ouvert) : ✗ et sa ligne à côté du choix. Une fiche
  sans demande (l'appli relancée entre-temps) : supprimée, rien d'autre.
- **Créer une branche**, dans la vue des branches, sans demande : son nom
  saisi (un ref sûr, pas déjà une branche locale), son départ au choix
  (`origin/<base>` par défaut, la base à jour, ou une branche locale), puis
  *Créer ici* (`new-here` : `git switch -c <branche> <départ>`, grisé avec
  des modifications) ou *Dans un nouveau worktree* (`new-worktree`, pas sur
  un enfant : la recette, depuis ce départ, puis l'enfant). Les mêmes
  actions que pour une demande, un seul chemin ; sans demande retenue, rien
  ne suit (ni rôle imposé, ni note).
- **Mettre de côté** (`stash`) : une seule action, montrée avec des
  modifications partout où un changement de branche est proposé (PR
  chargée, *Revenir sur la branche principale*, *Aller sur la branche*,
  *Créer une branche*, demande en attente) : `git stash push -u` (fichiers
  non suivis compris ; `git stash pop` les reprend), puis `git status
  --porcelain` relu : propre → ✓, sinon l'échec. Seulement à son clic,
  jamais à la suite d'un chargement ou d'un changement de branche ; il ne
  change jamais de branche : le dossier propre, *Changer de branche*,
  *Revenir sur la branche principale*, *Aller sur la branche* et *Créer ici*
  ne sont plus grisés, **un deuxième clic** change de branche. (*Pull* et
  *Rebase* mettent de côté autrement : `--autostash`, le temps de leur
  commande, à leur seul clic, F-114.)
- **Retirer le worktree** (`remove-worktree`, action directe seulement,
  F-114), dans la vue des branches (plus dans le badge de l'en-tête ni à
  l'étape PR) : sur un enfant seulement, aux mêmes conditions — l'enfant
  d'une nouvelle demande, sa PR fusionnée ; le robot d'une PR (le badge
  « PR #n · worktree »). La recette retire le worktree (refusé s'il
  reste des modifications, F-111) ; retiré, son robot part avec lui : son
  dossier quitte les favoris, le panneau passe au parent ; le robot d'une PR
  perd sa fiche et part dès qu'il ne travaille pas, son brouillon de revue
  revenu à l'agent du dépôt, et sa branche `pr-<n>` est supprimée (la
  recette la garde ; la PR peut revenir *Dans un nouveau worktree*). De même, au relevé, l'agent du dépôt retiré emporte le robot de sa
  PR. *Retirer* le robot (clic droit) oublie aussi son dossier, sans
  toucher au worktree. Les artefacts ne sont pas touchés : ils sont ceux du projet, dans un
  dossier commun au dépôt, à ses worktrees et à leurs robots (F-95) ; *Retirer*,
  *Retirer le worktree* et le relevé qui retire le robot d'une PR dont la
  fiche a disparu ne les transfèrent ni ne les effacent, et un agent rouvert
  sur ce dossier les retrouve. Le reste des sorties garde son sort.

**F-102 Validations** : valider, refuser (*À revoir*) ou oublier, sur la note, sa Forme, un cas de
test, une case du plan de test à l'écran (`check:<rang>`, les deux rôles), une case du § A.3 que le dépôt ne
peut pas cocher (créateur, `a3:<rang>` : cocher la valide, décocher l'oublie). La note et la forme : *Valider*
(relecteur : la note *Valider* ou *À revoir* ; la forme, rien à juger), puis « validée » et *Annuler* ; un cas : *Validé* ou
*À revoir* (deux badges écrits, *Validé* et *À revoir*, gris ; celui donné allumé de sa couleur,
« Validé » ou « Refusé — Cliquer de nouveau pour annuler » en infobulle), un second clic l'annule. Chacune vaut pour l'empreinte du contenu validé (le
texte de la note, la rubrique « Forme », le bloc du cas et le code commun de son fichier
de test (étape Invariants), le plan, le
commit de tête de la branche pour une case du § A.3) : le
contenu change → « modifiée depuis » (*Revalider*), et l'étape attend une
nouvelle validation. Une cible absente du dernier relevé est ignorée. Relecteur (0.16.0) : pas de verdict par commit, le verdict proposé vient de la note et des tests (F-101) ; les anciennes marques `commit:<hash>` restent au relevé sans compter ; chaque lecture finie pose sa marque `read:<pr>:<action>` pour la tête de la PR d'où elle est partie (sauf `read-invariants`, qui suit l'empreinte des tests), par le principal seul, jamais par la page (F-101).
*Valider la note* du créateur (0.16.0) est une validation d'étape comme les
autres, aussitôt, sans course ni vérification : c'est un geste à part de
*Vérifier* (F-100), dont la course, à sa fin, ne valide jamais rien : elle retient
seulement, parmi les marques de la note, si elle n'a rien trouvé et pour quelle
empreinte (`VibeNote.verified` : rien trouvé, ou rien trouvé et la note modifiée
depuis). La page ne montre *Valider la note* qu'après une vérification qui n'a
rien trouvé ; le principal ne refuse pas un *Valider* sans vérification (le clic
vient de l'utilisateur, F-100).
**La note n'est validée que par l'utilisateur**, quel que soit le rythme (I-67) :
ni les validations du système, ni la fin d'une vérification, ni l'orchestrateur
(`step.validate` refuse `note`), le moteur en marche et express compris, ne la
valident ; une note jamais validée, ou
refusée (*À revoir*), ne reçoit pas de ✓ par un autre chemin. Une note validée puis
changée ne garde son ✓ que si le changement n'ajoute à la conception validée que le
texte exact d'une réponse « Accepter » choisie (F-100) ; l'appli le constate
elle-même à chaque relevé, la marque suit alors la nouvelle conception ; tout autre
changement : la marque ne bouge pas, « modifiée depuis ».
**Les validations du système** (0.16.0) : à chaque relevé du créateur, le moteur en
marche ou non, chaque étape faite — la forme, les invariants (sans
test : ✓ *Rien à écrire*), jamais la note — reçoit un ✓ pour son contenu
d'aujourd'hui, comme un clic mais marqué posé **par le système** (`by: 'system'`) ;
un ✓ ou ✗ déjà donné pour ce contenu reste, sans « système » s'il l'a été à la
main. **Aucun verdict de test** n'est posé ni retiré par le système : *Validé* /
*À revoir* sont les notes de l'utilisateur ; l'étape Invariants se valide sans
qu'aucun test soit *Validé*, et pas tant qu'un test est *À revoir*. **Des tests
changés après leur validation** (une correction écrit ou réécrit un test,
l'alignement en corrige un après la preuve) : au rythme par défaut le système ne
les revalide pas, le parcours revient à la pause après les invariants (tests lus ;
« Des tests ont changé : regardez vos règles, puis reprenez »), à tout moment du
parcours, et les modules ne se valident pas d'ici là ; *Reprendre* vaut
« d'accord » et les valide. En express : revalidés par le système, sans pause.
**À la pause après les invariants**, tenue, le moteur en route ou non : la
porte agent refuse (`halted`) de lancer une action des étapes Modules, Revue ou
PR (le premier commit, les modules, la preuve, la revue, la PR) — un agent qui
corrige dans la conversation ne passe pas devant l'utilisateur ; la Forme, les
invariants, leur alignement et leur lecture restent lançables. Une étape dont l'étape d'avant n'est pas validée : rien. Les modules, eux,
ne le sont que par la CLI (`step.validate`, F-116), et seulement une fois la preuve
passée (F-100, I-66). L'écran dit par qui une étape est validée : « validée par
le système » et son contrôle (squelettes posés, alignement avec la note,
conformité à la forme et preuve par mutation), ou « validée » à la main. Depuis
la 0.16.0, le créateur n'a plus ces gestes à l'écran (*Valider la forme*, *Valider
les invariants*, *Valider les modules*, *Rien à écrire*, le ✓ d'un cas) : le
badge de l'étape porte le ✓ et se clique pour le retirer ou le rendre (ci-dessous,
F-93) ; la CLI garde les gestes (`step.validate`, la marque d'un cas), le même contrat.
Gardées par agent (`vibecoder-state.json`), l'appli relancée aussi ; aucune
n'envoie de message.
**Un ✓ d'étape retiré à la main tient** (0.16.0) : le ✓ que l'utilisateur retire
à la main sur la forme, les invariants ou les modules est son « pas d'accord » ;
sans cela, le système le remettrait au relevé suivant. Tant que le contenu de
l'étape ne change pas, le système ne le remet pas, ni celui des étapes qui
suivent, et la validation des modules par la CLI (`step.validate`) est refusée de
même. Le retrait est enregistré, avec le contenu de l'étape à ce moment, parmi les
marques de l'agent (`vibecoder-state.json`, sous une cible à lui, sans fichier ni
mémoire de plus) : il survit à un redémarrage de l'appli et suit l'agent comme ses
validations. Le contenu de l'étape changé, ou l'étape revalidée à la main : le
retrait est oublié. Tant qu'il tient, le parcours se tient à une pause sur cette
étape (`withdrawn:<étape>`, F-100), tenue dans les deux rythmes comme celle de la
note sans son ✓, relancée ou pas : le moteur est arrêté et ne construit rien sur
une étape refusée (F-103).

**Les validations d'étape** (0.15.0, créateur). Une validation par étape, le même
geste partout, le ✓ de `conv:vibeMark` (cibles `note`, `forme`, `invariants`,
`modules`, sans nouveau canal) : *Valider la note*, *Valider la forme*, *Valider
les invariants* (quand tous les cas ont leur ✓, ou ✓ *Rien à écrire*,
ou sans ligne « → invariant » ni test (contenu vide) ; les
cas gardent leurs verdicts) et *Valider les modules* ; puis « validée » et
*Annuler*, qui retire la validation de l'étape. *Valider* n'est accepté
que si l'étape d'avant est cochée (la note : jamais d'étape
d'avant) et s'il y a quelque chose à valider (aucun module : rien). **À l'écran
(0.16.0)**, seule la note garde son bouton (*Valider la note*, avec *Vérifier*) ;
pour la Forme, les invariants et les modules, c'est **le badge d'état de l'étape**,
dans son en-tête, qui porte le ✓ : « faite ✓ » quand l'étape est validée (par le
système ou à la main), « faite · ✓ retiré » tant que le retrait à la main tient ; un
clic sur le badge, à ces trois étapes seulement, retire le ✓ (« retirer ») ou le
rend (« rendre »), par la même validation d'étape, sans canal de plus, et ne
fait rien d'autre (ni action lancée, ni note validée). Une étape faite que le
système n'a pas validée (une preuve qui ne passe pas, un contenu changé depuis, à
revoir) : le badge sans ✓ et sans clic, il ne valide jamais à la place du système ;
une étape jamais validée : de même ; la note, la Revue et la PR : ni ✓ ni clic,
validées ou non. Le relecteur : ni ✓ ni clic, à toute étape.
- **Ce que chacune retient** : la note, sa conception (« Ce que ça fait », « Ce que
  ça ne doit pas faire » et les rubriques de conception qui suivent, hors la
  rubrique Forme) ; la Forme, la rubrique Forme de la note ; les invariants, les
  fichiers de test de l'étape ; les modules, tout ce que la branche change
  d'après git (`git diff` depuis la base et `git status`), hors la note et les tests
  d'invariants, supprimés exceptés : une feuille de style, un libellé, la doc
  hors des chemins de la Forme compris (on suit git, sans autre règle). La marque de l'étape (dans
  `vibecoder-state.json`, par agent, avec celles des cas) porte l'empreinte de
  cela, celle de la marque de l'étape d'avant (`after`) et celle de la liste de
  ses fichiers (`files`).
- **Ce qui est gardé** : pour le diff *Depuis la validation*, la liste des fichiers
  de l'étape (une empreinte et un chemin par ligne) et le texte de chacun (la
  note : aucun), dans le dossier de sorties de l'agent, `validated/<empreinte>`,
  adressés par leur contenu ; jamais dans le dépôt ni sous `.git/` (I-61). Le
  texte d'un fichier n'est retenu que s'il est celui que le relevé a vu au
  clic. L'index du dépôt, ce que `git commit` prend, n'est jamais touché (I-60),
  ni aucun fichier du projet (I-62). Un `git add` ou un commit ne valide rien :
  seul un geste de validation compte, celui de l'utilisateur à l'écran ou celui
  de l'agent principal par la CLI (`step.validate`, F-116).
- **La cascade** : une étape est cochée quand ce qu'elle a validé n'a pas changé,
  que l'étape d'avant l'est et qu'elle a été validée d'après la validation
  d'aujourd'hui de celle-ci. Une étape décochée décoche donc celles qui suivent
  (note → Forme → Invariants → Modules), par qui que ce soit que le changement
  vienne (l'utilisateur, un agent, un outil). Son en-tête, à côté du titre, dit
  pourquoi : « modifiée depuis la validation » quand ce qu'elle a validé a changé
  (à l'étape Modules, un clic dessus bascule le diff sur *Depuis la validation*,
  ci-dessous ; à la Note : « rédigée · modifiée depuis la validation ») ; « à
  revoir : la note a changé » (« la Forme a changé », « les invariants ont
  changé », « les modules ont changé ») quand une étape d'avant l'a été, la
  première décochée. *Revalider* une étape ne recoche pas les suivantes : sa
  nouvelle validation change celle sur laquelle elles s'appuyaient, chacune se
  revalide à son tour, puisqu'elle ne tient peut-être plus. Un commit ne change aucune validation (ce que
  valide une étape se lit sur le disque, pas au dernier commit). Une modification
  de la seule rubrique Forme de la note ne décoche pas la note : elle décoche la
  Forme, et par elle les étapes qui suivent.
- **Ce que ça ne change pas** : l'étape faite, sa prochaine action, le ✓ d'un cas.
  Seule exception : *Commiter les modules* est grisée (« modules pas validés »)
  tant que les modules ne sont pas validés (cochés), quand le système enchaîne aussi :
  l'orchestrateur les valide par la CLI (`step.validate`, refusé sans preuve qui
  passe, I-66) avant de les commiter (F-103).
- Les étapes faites (la Forme, les invariants) reçoivent leur validation d'étape
  du système à chaque relevé, dans l'ordre, le moteur en marche ou non (voir
  ci-dessus), sauf un ✓ retiré à la main qui tient ; la note jamais ; les modules, non : par la CLI une fois la preuve passée.

**Le diff du code, et le menu de diff de la vue IDE** (0.15.0 ; 0.16.0 pour le
créateur). **Le créateur n'a plus de menu** (0.16.0) : l'étape Modules montre un
seul diff, depuis la base de la branche, en ligne (F-100). Une seule exception,
quand elle sert : une étape décochée dit « modifiée depuis la validation » dans son
en-tête, un clic dessus bascule le diff sur ce qui a changé depuis le ✓
(*Depuis la validation*, ci-dessous), un second revient à la base ; une étape sans
validation : pas de bascule, et si la validation disparaît la bascule retombe sur
la base. Plus de *Depuis le dernier commit*, de *Fichier*, de *Côte à côte* ni de
case *Invariants seuls* pour lui ; ni à la Forme, ni aux Invariants. **Le relecteur n'a plus ce menu à l'écran** (0.16.0, F-101 : la page ne l'appelle plus ; ce qui suit décrit celui qui reste dans le dépôt) : à l'étape Invariants, un seul menu en tête de la vue IDE,
au-dessus de l'arborescence et du fichier choisi : *Fichier* · *Depuis la base de
la branche* (par défaut) · *Depuis le dernier commit*, avec, pour un diff,
*En ligne* · *Côte à côte*. La référence choisie
vaut pour toute la vue, plus pour le seul fichier affiché, et filtre
l'arborescence :
- *Depuis la base de la branche* : tous les fichiers de l'étape, plus tout ce que
  git dit changé depuis la base (`git diff` et `git status`, suppressions comprises) ;
- *Depuis le dernier commit* : tout ce qui diffère du dernier commit (le `git status`),
  de l'étape ou non ; grisé (« pas encore de commit ») tant que la branche n'a aucun
  commit à elle, le dernier commit étant alors la base, et (« rien de modifié »)
  quand rien ne diffère du dernier commit ;
Les listes suivent git, sans autre règle : un fichier supprimé, ou hors des chemins
de la Forme, y paraît comme dans `git status` ; s'il n'est nommé nulle part dans la
rubrique Forme de la note (en tête d'un module, dans ses variants, un « supprime … »,
avec ou sans son `src/`), il est en retrait (grisé), son infobulle « Modifié, mais non
déclaré dans la Forme » : un oubli possible de la Forme ; nommé, il reste en clair.
À l'étape Invariants, une case *Invariants seuls*, à côté du menu, cochée par défaut
(gardée par agent) : l'arborescence ne liste que les tests d'invariants (sous
`tests/invariants/`, un supprimé compris) ; décochée, le reste de la référence aussi
(la Forme, les fichiers de la branche), en retrait.
- *Depuis la validation* : ceux qui diffèrent de leur version validée par l'étape
  (le dernier texte retenu, `validated/<empreinte>`) ;
- *Fichier* : le texte du fichier choisi, l'arborescence gardant le filtre de la
  dernière référence.
Le fichier choisi montre son diff depuis cette référence, en ligne ou côte à côte
(ajouts en vert, retraits barrés en rouge, lecture seule). Un fichier créé depuis
la référence est tout en ajouts, un fichier supprimé tout en retraits (son texte
vient de la référence, par git ou par `validated/` ; il n'est pas modifiable ; son
id est `r<i>`, I-37). Aucun fichier ne diffère : « Rien de modifié depuis … » à la
place de l'arborescence. Un fichier identique à sa
référence n'est jamais listé, un fichier qui en diffère l'est toujours.

**F-103 Le mode Vibe, un seul moteur et deux rythmes** (créateur seulement ; par
agent, **en mémoire** : l'appli relancée repart sans lui, au rythme par
défaut, et il ne repart jamais tout seul : on le reprend), sur la même mécanique, les courses
(F-115). Depuis la 0.16.0 il n'y a plus de parcours entièrement manuel : le
système enchaîne toujours, l'utilisateur valide la note (F-102) et le reste est
fait et contrôlé par le système (les validations d'étape, F-102 ; la preuve des
invariants, F-100). Un seul moteur, l'action `vibe` et son skill (leurs noms, et
celui du mode, ne changent pas) : l'appli la lance seule quand l'utilisateur valide
la note, par ce geste et lui seul (la fin d'une vérification ne lance rien, F-100),
et au passage en express à une pause ; elle ne repart jamais d'elle-même, ni après
une pause, ni après un arrêt, ni après un redémarrage de l'appli : l'utilisateur la
reprend. À l'écran, plus de bouton *Vibe* : **un seul bouton**, à côté de la ligne
d'état sous le fil d'Ariane (F-92), *Arrêter* pendant que le système enchaîne, *Reprendre* quand il est
arrêté (une pause, un arrêt à la main, un redémarrage de l'appli). Arrêté à la main
par *Arrêter*, l'orchestrateur ne lance ni n'arrête rien qu'on ne lui demande, et
l'on peut lancer chaque action d'un clic. Deux **rythmes**, qui ne diffèrent
que par leurs pauses :
- **Le rythme par défaut, deux pauses** : après les invariants, avant le
  premier commit (l'utilisateur vérifie ce qui a été posé, la forme et les
  invariants, rien n'étant encore commité, puis reprend : le premier commit
  part alors) et après les modules (il essaie à l'écran, avant que les tokens de la
  revue soient dépensés ; si c'est bon, il reprend, et la revue, la PR et la CI
  suivent). Une pause est l'arrêt du moteur comme par *Arrêter* : l'appli le
  tient dès que le relevé dit que le parcours s'y trouve (F-100), la demande
  suivante de l'orchestrateur est refusée (`halted`, dont la réponse dit aussi la
  pause), il dit où il en est et quoi regarder, puis rend la main. À côté de
  la ligne d'état, le bouton du moteur dit *Reprendre* et la ligne dit quoi regarder
  (« Regardez vos règles, puis reprenez », « Essayez l'appli, puis reprenez ») ;
  repris, la pause d'où l'on part n'est plus tenue, la suivante l'est de nouveau.
  La pause après les invariants revient chaque fois que leurs tests changent
  après ce premier regard (voir « Les validations du système »).
- **Le mode express, à tout moment** : l'interrupteur *Express* du fil d'Ariane
  (créateur ; éteint par défaut ; présent note pas validée comme pendant que le système enchaîne),
  réglé par l'écran (`VibePatch.express`, sans canal de plus), **en mémoire**,
  jamais écrit dans les réglages de l'agent ; l'appli relancée, il revient au
  rythme par défaut (au pire une pause est tenue en trop, jamais une sautée).
  Aucune pause : le système valide lui-même ce qui attendait, sauf la note, que
  seul l'utilisateur valide (choisi avant, l'express part de sa validation : rien
  ne part avant), et enchaîne jusqu'à la PR ouverte et sa CI. Passé en express à
  une pause, le moteur repart sans autre clic ; l'express quitté en route, la
  pause suivante est tenue.
- **Dans les deux rythmes** : la note qui perd son ✓ (une pause `note`) est
  toujours tenue, en express aussi (I-67) ; de même la pause d'un ✓ d'étape
  retiré à la main (`withdrawn:<étape>`, F-102), relancée ou pas : l'appli arrête
  le moteur comme à toute pause tenue, l'action du moteur est masquée (pas de
  *Reprendre*, une ligne nomme l'étape : « modifiez-la ou revalidez-la pour
  reprendre ») et rien ne le relance seul, ni le passage en express ni un
  *Valider la note* (la demande est oubliée, pas retentée) ; le retrait oublié
  (le contenu changé, l'étape revalidée à la main), la pause est levée et
  *Reprendre* revient : le moteur ne repart qu'à ce clic ; une question `[toi]` arrête la chaîne ;
  une preuve qui ne passe pas laisse l'étape Modules pas faite (I-66). Les rôles
  restent séparés : les invariants s'écrivent depuis la note, ni depuis le code ni
  par l'agent qui écrira les modules.

Un seul écran (F-92) :
1. **La note et ses questions**, sans orchestrateur : *Rédiger la note*
   (l'action `note`, sa course) ; ses questions vont **toutes** à
   l'utilisateur (*Envoyer les réponses*) : personne ne les tranche à sa
   place ; puis *Vérifier* (la vérification de conception, à volonté, qui ne valide
   rien) et *Valider la note* (F-100) : l'utilisateur a relu la note avant de donner
   la main, et son geste lance le moteur.
2. **Le moteur** (l'action `vibe`, son bouton à côté de la ligne d'état,
   à toutes les étapes, *Reprendre* quand il est arrêté, F-93 ; masquée avant la note
   validée, F-99) : sans texte, au skill
   `vibe`, dans la conversation, à n'importe quelle étape après la note ;
   l'agent, l'**orchestrateur**, tient le rôle du développeur du guide,
   reprend à la première étape pas faite et **enchaîne les actions de
   l'écran** par leurs demandes (F-115) — forme, invariants rouges
   (les squelettes compris, F-100 ; l'alignement compris, qui corrige seul),
   *Lire en pseudo-code* de ces tests (0.16.0 : après chaque écriture des tests
   d'invariants, une correction par l'alignement de la preuve comprise, F-100),
   premier commit,
   modules (confiés à un agent, ou au-delà de 4 modules de code à des agents Sonnet
   en parallèle, avec `ponytail`), *Prouver les invariants*, puis *Commiter les
   modules*, vérifications (la ponytail review comprise ; un échec corrigé :
   cette vérification seule relancée, en commit ordinaire en historique simple),
   fixups (sautés en historique simple : rien à replier), PR, CI suivie jusqu'au vert (un échec : un commit de correction
   poussé, *Diagnostiquer la CI* relancé), puis il s'arrête —, une
   demande puis la fin de son tour, réveillé par l'avis de fin ; chaque
   action reste visible et arrêtable dans l'onglet *Actions*, et ce qui
   doit attendre part de soi-même. Le moteur ne valide pas la note ; rien
   n'est développé avant sa validation, par l'utilisateur. Il ne valide ni la
   Forme ni les invariants (l'appli le fait, F-102) ; il valide les modules par
   `step.validate` une fois la preuve passée (refusé sinon : I-66). Hors des
   pauses de son rythme, l'orchestrateur **ne s'arrête que sur une ligne
   `[toi]`** d'un fichier de retour (F-95) ou une question de la note : une ligne
   `[agent]` n'est jamais une raison de s'arrêter (*Appliquer la revue* applique
   les remarques `[agent]`, jamais une `[toi]` non cochée). Sa boucle sur un test
   resté vert dans un fichier de tests d'invariants nouveau : *Vérifier
   l'alignement*, puis *Prouver les invariants* une fois de plus ; encore vert :
   `[toi]`. Une preuve en échec pour des fichiers touchés : il les nomme et rend
   la main. Une correction du code après une preuve passée : il ne la relance
   pas. Il ne change pas non
   plus « Ce que ça fait », « Ce que ça ne doit pas faire », « Où ça casse » ni
   une étiquette de la note validée.
3. ***Arrêter*** (F-93), le bouton de la ligne d'état tant que le système enchaîne
   (« La course en cours finit, la suivante ne part pas ») — il devient
   *Reprendre* aussitôt (plus de bannière), la course en cours n'est pas interrompue, les
   demandes retenues sont jetées, et chaque
   lancement que demande l'orchestrateur est refusé (F-115) jusqu'à ce que
   tout soit au repos (conversation libre, aucune course vivante ni
   retenue). Le moteur s'arrête aussi seul : la conversation libre, sans course
   vivante, demande retenue ni question ouverte (l'orchestrateur a fini, ou
   son tour a été arrêté).

Une question qui bloque (`questions.md`) arrête l'orchestrateur, pas
le moteur (*Arrêter* reste) : les réponses envoyées, l'avis de fin d'*Envoyer les réponses* le
réveille, et il reprend seul. Il ne tranche aucune question de la note, ne
lance ni `note` ni `answers`, ne tranche jamais *Garder* / *Annuler* (c'est
à l'utilisateur). Jamais : `git push --force`, fusionner la PR, publier une
version officielle, supprimer une version, un tag ou une branche.

**F-104 Markdown** (la note, les sorties, les messages de l'agent, F-66) : titres, paragraphes, listes et
cases à cocher, citations, code, tableaux, filets ; en ligne : code, gras,
italique, liens. Jamais de HTML : une balise reste du texte ; un lien n'est
un lien qu'en `http(s)`, ouvert dans le navigateur (I-40, I-21). Un *Commenter* au
survol de chaque bloc et de chaque élément de liste le cite (F-98 ; relecteur :
au brouillon, F-101). En créateur, après *Modifier*, la note se modifie
rendue ou en *Brut* (F-100) ; une balise tapée ou écrite dans le fichier reste du texte. Un
JSON écrit par un skill est lu sans s'y fier :
illisible, l'écran le dit ou le montre tel quel.

### Lancer le projet

**F-111 Processus** : un onglet *Processus (n)* à côté de *Conversation* et
*Tâches* (n : les commandes en cours). Les commandes qui lancent le projet de
l'agent (serveur, front, services) sont dans le **fichier du projet**,
`<dossier du parent>/.vibecoder/project.json` (la tête de famille présente,
F-51 ; comme `.zed` ou `.claude`), propre à la machine — par exemple `gear`
pour gt-plugins, une fonction du `.bashrc` :
`{ "commands": [{ "name", "run", "cwd"? }], "shell"?, "prefix"?, "setup"?,
"worktree"?: { "create"?, "remove"?, "dir"? } }` (`prWorktree` et
`featureWorktree`, d'avant : ignorés ; l'appli demande toujours, F-110).
Ignoré par git : à sa première lecture dans la
session, l'appli ajoute `.vibecoder/` à `.git/info/exclude` du dossier si
`.git` y est un dossier (la copie principale) et que la ligne
(`.vibecoder`, `.vibecoder/` ou `/.vibecoder/`) n'y est pas ; rien à
commiter. L'ancien fichier, `userData/vibecoder/projets/<dossier>.json` (le
chemin du dossier, ses séparateurs en `-`), est copié dans `.vibecoder/` à
cette même lecture s'il n'y a rien encore (l'ancien reste : on peut revenir
en arrière). Un `name` sûr et
unique (40 caractères au plus : lettres, chiffres, `.`, `_`, `-`, et des
espaces au milieu ; il nomme le journal), `run` tel
que tapé dans un terminal, `cwd` relatif au dossier de l'agent ; une entrée
mal formée est ignorée. Le fichier est relu à chaque relevé : une commande
ajoutée et enregistrée apparaît sans relancer l'appli. Chaque commande a son nom (entier, coupé s'il est vraiment long ; l'infobulle
donne nom et commande), sa commande en petit dessous, *Lancer*, *Arrêter*,
*Relancer* (icônes), son état (en cours, arrêtée, en échec et son code), depuis
quand, et la fin de son journal (200 lignes au plus, sans couleurs, qui suit
la fin ; dépliable ; *Journal complet* l'ouvre dans l'éditeur).
- *Proposer les commandes*, fichier ou pas (action `propose-run`, skill
  `lancement`, sous-contexte, haiku · faible ; le champ peut le guider) :
  l'agent cherche comment lancer le projet (AGENTS.md, CLAUDE.md, README,
  `package.json`, `process-compose`, Makefile, compose, alias et fonctions du
  `.bashrc`) et écrit `lancement.json` dans ses sorties ; au relevé, l'appli
  en fait le fichier du projet s'il n'existe pas ; s'il existe, elle n'y
  ajoute, à la fin de `commands`, que les commandes de la proposition dont
  le nom n'y est pas, et son `setup`, son `worktree` si le fichier n'a pas
  encore la clé (même mal formée : jamais par-dessus, I-42) — le reste du
  fichier tel quel (champs inconnus, commandes mal formées compris ; jamais
  le `shell` ni le `prefix` de la proposition) ; rien de nouveau, ou un fichier illisible : pas réécrit.
  Puis elle retire la proposition. *Modifier les commandes* ouvre le
  fichier dans l'éditeur (créé d'un exemple s'il manque). Le skill propose
  `setup` et `worktree` **une seule fois** par projet (le fichier en a
  déjà : il ne les propose plus), d'après les scripts de worktree du projet,
  AGENTS.md, CLAUDE.md, le README, `package.json` ; il ne les lance pas :
  l'appli le fait (ci-dessous), les jetons ne se paient qu'à la découverte.
- **C'est l'appli qui lance** : par le shell du fichier (`bash -ic` par
  défaut : les alias et fonctions de l'utilisateur ; exception à I-27,
  limitée à ces commandes), après le **préfixe** : `"prefix"` du fichier
  (`""` : aucun ; jamais pris d'une proposition), sinon le réglage
  `vibeCommandPrefix` s'il n'est pas vide, sinon `distrobox enter <box> --`
  si la commande de lancement (`agentCommand`) commence ainsi ; au dossier
  de l'agent (ou `cwd`). Le même préfixe précède gh (F-112). Le processus est détaché (son groupe) et
  marqué dans son environnement (`VIBECODER_RUN=<jeton>`, hérité par ses
  descendants, même passés dans la box ou sortis du groupe) ; stdout et
  stderr vont dans `<sorties>/run/<nom>.log`, le précédent en `.log.old` (au
  lancement suivant, et au-delà de 5 Mo). Une commande qui tourne n'est pas
  lancée deux fois.
- **Arrêter** : SIGTERM au groupe et à chaque processus de ce jeton, SIGKILL
  après 5 s (I-43). Une commande finie d'elle-même : ce qu'elle laisse est
  arrêté aussi. Une commande retirée du fichier est arrêtée au relevé. Un rang
  qui ne désigne plus la même commande que le dernier relevé (fichier changé
  entre-temps) : rien.
- **L'agent** lit les mêmes journaux (skill `processus`, dans la conversation,
  qu'il appelle de lui-même) et demande l'arrêt ou la relance par la commande
  `vibecoder proc stop <nom>` ou `proc restart <nom>` (F-116, tout de suite, la
  réponse dit le refus), et lit un journal par `proc logs <nom>` — pour un nom
  du fichier seulement (I-42).
- **La recette** (sans IA) : `setup` (une liste ordonnée de commandes qui
  préparent le projet, ex. `yarn install` ; mal formée, ignorée en entier),
  `worktree` `{ create, remove, dir }` (pour gt-plugins : `yarn
  setup-worktree "$VIBECODER_BRANCH" "$VIBECODER_BASE"`, `yarn
  cleanup-worktree "$VIBECODER_BRANCH"`, `../gt-plugins-worktrees/{branch}` ;
  `dir` par défaut `../<nom du dossier>-worktrees/{branch}`, relatif au
  dossier du parent). L'appli les lance comme les autres commandes du
  fichier (le préfixe, le shell du fichier), une étape après l'autre,
  l'**entrée fermée** (un y/N lit une fin de fichier : l'étape échoue, son
  échec est affiché, rien ne bloque), 15 min au plus chacune, `GIT_TERMINAL_PROMPT=0`,
  arrêt au premier échec ; leur sortie dans `<sorties>/recipe.log`, la
  dernière ligne utile affichée en cas d'échec ; **une recette à la fois par
  famille**. La branche et la base ne passent que par l'environnement
  (`VIBECODER_BRANCH`, `VIBECODER_BASE`, des refs sûrs, I-39), jamais dans le
  texte d'une commande.
  - *Créer un worktree* : `worktree.create`, au dossier du parent ; sans lui,
    `git -C <parent> worktree add -b <branche> <dossier> <départ>` (sans
    shell, chaque mot un argument) puis `setup` dans le worktree (avec
    `worktree.create`, le script du projet prépare lui-même son worktree). Le dossier : `worktree.dir`, là où `create` le met. Réussi
    seulement si le dossier est ensuite la racine d'un worktree du dépôt ;
    un dossier déjà là : refusé.
  - *Retirer un worktree* : d'abord `git status --porcelain` dans le
    worktree — une ligne, ou pas de réponse : refusé, quelle que soit la
    commande ; puis `worktree.remove` (`VIBECODER_BRANCH` : sa branche) ;
    sans lui, `git -C <parent> worktree remove <dossier>`, jamais `--force`.
    Réussi si le dossier n'existe plus.
  - *Préparer le projet* (onglet *Processus*, le fichier a un `setup`) :
    `setup` au dossier de l'agent, pour un projet neuf ; grisé pendant une
    recette de la famille, la dernière ligne de son échec dessous.
- **Famille** (F-51) : un enfant reprend le fichier du projet de son parent
  présent (lu, proposition adoptée, *Modifier les commandes*, la recette) et
  lance ses commandes dans **son** dossier (`cwd` relatif à lui) ; jamais le
  fichier d'un worktree (une PR pourrait y apporter ses propres commandes) :
  le parent retiré, ses enfants n'ont plus de fichier du projet (ni
  commandes, ni recette ; ce qui tournait s'arrête au relevé). Une commande ne tourne **jamais à deux
  endroits** de la famille (ports et base partagés) : *Lancer* ou
  *Relancer* là où elle tourne ailleurs demande « <nom> tourne dans
  <branche> : l'arrêter et le lancer ici ? » (*Arrêter et lancer ici* :
  arrêtée là-bas, puis lancée ici ; *Non* : rien) ; un `proc restart` de l'agent
  pour une commande qui tourne ailleurs : pas lancée. Des agents qui font déjà
  tourner la même commande et qu'un rattachement réunit ensuite (un agent
  ajouté sur la copie principale) la gardent chacun : rien n'est arrêté
  d'office.
- **Quitter l'appli** arrête tout ce qu'elle a lancé (F-81, I-43).

**F-112 GitHub sans IA** : l'appli lit elle-même des faits de GitHub par
`gh`, sans agent ni modèle, en lecture seule (I-39) : `gh` lancé sans shell
derrière le préfixe de F-111 (l'appli tourne sur l'hôte, gh souvent dans la
box), au dossier de l'agent, 15 s au plus ; un échec n'est qu'une réponse
absente (S-72).
- Étape **PR** (créateur) : la PR de la branche (`gh pr view <branche>`, sauf
  sur la base) — numéro, titre, lien, état, base, branche ; une PR existe :
  l'étape est faite. Sans réponse, `pr.json` (le skill `pr`) est encore lu.
- La vue des branches (F-110) : les PR **ouvertes**
  du dépôt, en trois listes — *Mes PR* (`gh pr list --author @me`), *À
  relire* (`--search review-requested:@me`), *Toutes les PR* (sans filtre,
  `--limit 100`) —, `--json number,title,author,url`, à l'ouverture de la
  vue ; une liste qui échoue : pas de réponse pour les trois ;
  l'état de la PR chargée (`gh pr view <n> --json state`), qui l'emporte sur
  sa fiche.
- Le **rôle** (F-101) : les personnes de la PR du dossier (`gh pr view
  --json author,assignees -- <n>` : auteur, assignés ; un identifiant hors des caractères d'un identifiant GitHub
  écarté, un numéro qui n'est pas un entier positif : rien de lancé) et mon
  identifiant (`gh api user --jq .login`), en lecture seule comme le reste.
- Une réponse vaut 60 s (par branche, par PR) ; elle est demandée en fond,
  le relevé ne l'attend pas et repart quand elle change ; ↻ les redemande.
- Les skills `verifier`, `commiter-modules`, `modules` et `module` reçoivent ce préfixe **vu de l'agent** (`{{prefix}}`,
  F-97) : sans la box où l'agent tourne déjà (vide si `agentCommand` y
  entre) ; il y lance les commandes du projet, sans en ajouter — toutes, ou
  celle à relancer seule (`{{check}}`).

**F-113 Coloration du code** (F-100, étape Modules, créateur :
le diff du fichier choisi, en lecture seule (depuis la 0.16.0 la page du créateur
n'édite plus le code ni ne cite ses lignes ; le relecteur n'a plus de vue du code) ; ses diffs, eux,
en texte sans coloration, ajouts en vert, retraits barrés ; étape Note :
*Brut*, éditable après *Modifier*) : CodeMirror 6, en lecture quand l'édition est grisée ;
d'après l'extension — `ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `mts`, `cts`,
`rs`, `py`, `go` ; un autre : en texte. La palette sombre de GitHub :
mots-clés, chaînes, commentaires, nombres et constantes, fonctions, types,
attributs. Du texte, jamais du HTML (I-40), qui redonne le code tel quel.
Le pseudo-code des lectures garde sa coloration écrite à la main
(`highlight`) : ses étapes `given` / `when` / `then` ne sont pas un
langage de CodeMirror.

**F-114 Actions directes** (sans IA, au clic) : vingt et une actions ne sont que
des commandes connues d'avance ; l'appli les lance elle-même, sans agent, ni
modèle, ni jeton, au clic de leur bouton (« direct » sur le bouton).
À côté, un petit *via*, seul, sans modèle (son infobulle le donne, F-99), garde le chemin
d'avant, le skill ou le message dans la conversation, en cas de souci ;
sauf celles que l'appli fait seule : *Retirer le worktree* (l'agent
n'emporterait pas le robot), *Mettre de côté*, *Revenir sur la branche
principale*, les choix d'une nouvelle demande (et *Créer une branche*),
*Aller sur la branche*, *Pull*, *Rebase*, *Pousser*, *Actualiser*, *Me
demander en relecture*, *S'assigner la PR*, *Me retirer de la PR*, *Copier dans le projet* et la gestion des artefacts (le
dépôt, le menu). Les
`id` (`commit`, `publish`, `load-pr`, `base`, `pr-here`, `pr-worktree`,
`remove-worktree`, `stash`, `unload-pr`, `new-here`, `new-worktree`,
`switch-branch`, `pull`, `rebase`, `push`, `fetch`, `request-review`,
`assign-pr`, `unassign-pr`, `copy-artifact`, `add-artifact`, `rename-artifact`, `new-artifact-file`,
`new-artifact-folder`, `trash-artifacts`, `move-artifacts`, `copy-artifacts`,
`duplicate-artifacts`) restent ceux d'`actions.<langue>.json` : leur gabarit est
le *via* ; une entrée retirée retire les deux boutons.
- *✓ Commiter* : `git commit -F <sorties>/commit.md` (rien d'ajouté à
  l'index : ce que *Préparer le commit* y a mis), puis `commit.md`
  supprimé ; en échec (un hook, rien d'indexé), il reste.
- *Publier la revue* : le brouillon (« - [cible] texte » par remarque) écrit
  par l'appli dans `<sorties>/pr-<n>-review-body.md`, puis `gh pr review <n>
  --approve|--comment|--request-changes --body-file <ce fichier>` ; publiée,
  `pr-<n>-review.json` (`state` d'après le verdict, `url` : la PR, `verdict`,
  `body` : le texte publié, `at` : la date ISO ; le skill `publier-revue` écrit
  les mêmes champs).
- *Charger la PR* (un clic sur une PR de la vue des branches, F-110) : `gh pr
  view <n> --json number,title,url,author,baseRefName,headRefName,body,state`
  → `pr-<n>.json` (avant : `gh pr view <n> --json isCrossRepository`, une
  PR d'un fork refusée), puis `git fetch origin <tête>` et `git fetch
  origin <base>` (la base et la tête, refs sûrs, sinon refusé) ; rien d'autre ne suit (F-110 : l'appli
  demande).
- *PR mergée → revenir sur la base* : seulement si `gh pr view <branche>
  --json state` dit `MERGED` et qu'un `git status` frais, au clic, n'affiche
  rien (des modifications : refusé, rien ne bouge) : `git switch <base>`,
  `git pull --ff-only`, `git branch -d <branche>` (la branche et la base de
  sa PR, du relevé) ; sinon rien (« The PR of … is OPEN, not merged: nothing
  done. »). Une branche fusionnée par squash n'est pas supprimée (`-d`
  refuse) : *via* l'agent.
- *Changer de branche*, d'une PR (F-110) : un `git status` frais, propre,
  sinon refusé ; `git fetch origin <tête>`, `git switch <tête>` (la tête de
  `pr-<n>.json`), `git pull --ff-only origin <tête>`.
- *Dans un nouveau worktree*, d'une PR (F-110) : `git fetch origin <tête>`,
  puis la recette du projet (F-111) crée le worktree de `pr-<n>` depuis
  `origin/<tête>`, et l'appli écrit `pr-<n>-worktree.json`.
- *Revenir sur la branche principale* (`unload-pr`, F-110) : un `git
  status` frais, propre, sinon refusé ; `git switch <base>` (la base du
  dépôt), puis la PR n'est plus suivie.
- *Aller sur la branche* (`switch-branch`, F-110) : la branche, une des
  branches locales du dernier relevé (sinon refusé) ; un `git status` frais,
  propre, sinon refusé ; `git switch <branche>`.
- *Créer ici* (`new-here`), d'une nouvelle demande ou de *Créer une
  branche* (F-110) : un `git status` frais, propre, sinon refusé ; `git
  fetch origin <base>`, `git switch -c <branche> <départ>` (le départ :
  `origin/<base>` par défaut, ou une branche locale du relevé ; le nom
  saisi : un ref sûr, pas déjà une branche locale, sinon refusé).
- *Dans un nouveau worktree* (`new-worktree`), d'une nouvelle demande ou de
  *Créer une branche* (F-110) : `git fetch origin <base>`, puis la recette
  crée le worktree de la branche depuis le départ (`origin/<base>` par
  défaut), puis l'enfant s'ouvre (pas d'enfant : la demande reste
  retenue). Sans demande retenue, rien ne suit.
- *Pull* (`pull`) : `git pull --ff-only --autostash`, aucun argument donné
  (la branche distante suivie) ; pas d'avance rapide : l'échec. Sur toute
  branche, la PR d'un autre comprise.
- *Rebase* (`rebase`) : sur `origin/<base>` par défaut, ou une branche
  locale du relevé au choix (▾ ; sinon refusé) : `git fetch origin <base>`,
  puis `git rebase --autostash <sur>` ; un échec (un conflit) → `git rebase
  --abort` aussitôt, puis l'échec : rien ne bouge, pas de rebase laissé en
  cours, les modifications reprises. Jamais suivi d'un push.
- *Pousser* (`push`), montré après un rebase réussi, jusqu'au prochain
  push réussi : `git push --force-with-lease`, arguments fixes (jamais
  `--force` seul), à son seul clic.
- *Actualiser* (`fetch`) : `git fetch origin` (tout le distant), arguments
  fixes, puis un relevé : *Pull* et la pastille de *Rebase* (F-92) suivent
  ce fetch. Jamais de fetch au relevé ni à intervalles.
- *Me demander en relecture* (`request-review`, `{ pr }`) : une PR de
  *Toutes les PR*, ni des miennes ni déjà à relire (le dernier relevé), sinon
  refusé ; l'identifiant lu (`gh api user --jq .login`, en échec : rien de
  lancé), puis `gh pr edit <n> --add-reviewer <identifiant>`, et les trois
  listes relues.
- *S'assigner la PR* (`assign-pr`) et *Me retirer de la PR* (`unassign-pr`),
  sans argument, dans l'étape PR (F-101) : la PR du dernier relevé, jamais un
  numéro de la page ; l'identifiant lu (`gh api user --jq .login`, en échec :
  rien de lancé), puis `gh pr edit <n> --add-assignee <identifiant>` ou
  `--remove-assignee <identifiant>`, arguments fixes, et les personnes de la PR
  redemandées (le rôle relu). Au clic seulement : jamais par l'agent (sans
  *via*), ni à la suite d'une autre action. Montrée au relecteur si la PR a un
  autre auteur et qu'il n'y est pas assigné ; *Me retirer de la PR* au
  créateur assigné qui n'est pas l'auteur.
- *Copier dans le projet* (`copy-artifact`, `{ artifacts }`, F-95) :
  les éléments choisis, des ids (`a<i>` ou `d<i>`) du dernier relevé (sinon
  refusé) ; sans git ni gh : une boîte de dialogue choisit le dossier (ouverte
  sur celui de l'agent ; ailleurs permis) ; annulée → rien ; un fichier du
  même nom → *Remplacer* / *Annuler* (*Annuler* par défaut), fichier par
  fichier ; copié sous son nom de base, dans ce dossier seulement, puis un
  relevé. Un dossier est copié avec son contenu, sous le premier numéro libre
  s'il existe déjà : jamais mêlé ni remplacé.
- Gérer les artefacts (F-95), seulement par l'appli, au geste de l'utilisateur,
  sans git ni gh (I-39) : *Renommer* (`rename-artifact`, `{ artifacts: [id],
  name }`), *Nouveau fichier* et *Nouveau dossier* (`new-artifact-file`,
  `new-artifact-folder`, `{ folder, name }` : `folder` un id `d<i>`, absent : la
  racine), *Supprimer* (`trash-artifacts`, `{ artifacts, names }`), *Couper* /
  *Coller* ou glisser (`move-artifacts`, `{ artifacts, folder }`), *Copier* /
  *Coller* (`copy-artifacts`, `{ artifacts, folder }`), *Dupliquer*
  (`duplicate-artifacts`, `{ artifacts }`). Tout vient de l'agent affiché, de
  son dernier relevé et de son dossier d'artefacts ; `names`, `name` et `folder`
  sont les seules valeurs lues en plus, `name` un nom seul (jamais un chemin) que
  le principal revérifie (`plainName`). *Renommer* : le nom pris est refusé (pas
  de numéro) ; *Nouveau* : un fichier vide ou un dossier, créé au besoin à la
  racine, le nom pris refusé ; *Supprimer* : tout part à la corbeille ou rien
  (voir *Gérer les artefacts*) ; *Déplacer*, *Copier*, *Dupliquer* : numérotés.
  Chaque élément est traité à son tour ; un échec n'arrête pas les suivants, la
  ligne dit combien sont faits, refusés ou en échec.
- *Ajouter* (`add-artifact`, F-95) n'est plus un bouton : seul le dépôt sur
  l'arborescence du panneau le lance (`conv:vibeDrop`, avec le dossier d'arrivée), et
  `conv:vibeRun` le refuse (il ne porte jamais de chemin, I-37). Mêmes
  vérifications que le clic d'une action (l'agent affiché, son relevé, l'action
  proposée, aucune autre action directe en cours) : même « en cours » et même
  dernier résultat, au relevé. Copiés dans le dossier d'artefacts du projet de
  l'agent affiché, sans git ni gh (I-39) ; la ligne dit combien sont ajoutés, les
  liens, dossiers cachés et fichiers sans chemin passés, les échecs.

*Pull* et *Rebase* sont permis avec des modifications en cours :
`--autostash` les met de côté le temps de la commande et les reprend après,
à leur seul clic. Leur état (F-92) se lit en lecture seule (I-39) : `git
log HEAD..@{u}` (en retard : *Pull* actif ; à jour, ou pas de branche
suivie : grisé, avec sa raison) et `git
log HEAD..origin/<base>` (des commits : la pastille de *Rebase*, toujours
permis). Ces lectures, et la liste des branches locales, se font en fond :
le relevé ne les attend pas ; leur réponse vaut tant que `HEAD` et la base
ne bougent pas, 60 s au plus, et jusqu'à la fin d'une action directe ou ↻.
- *Mettre de côté* (F-110) : `git stash push -u`, arguments fixes (aucune
  autre forme de `git stash`), puis un `git status` frais : propre → ✓.
  Rien d'autre ne suit, jamais de changement de branche.
- *Retirer le worktree* (F-110) : la recette du projet le retire (refusé
  s'il a des modifications) ; celui d'une PR retiré, `git branch -D pr-<n>`
  au dossier du parent (jamais la branche d'une nouvelle demande).

git (au dossier de l'agent) et gh derrière le préfixe (F-111 : la box, où
les hooks de git — Husky — trouvent Node), sans shell (I-27), 60 s au plus par commande ; une commande en
échec arrête l'action. Chacune s'inscrit dans `<sorties>/direct.log` (heure,
commande, code de sortie, sortie courte). En fond, une à la fois par agent :
pendant ce temps « … » sous le bouton et les actions directes grisées (« Une commande
directe est en cours ») ; puis le dernier résultat, ✓ ou ✗ et une ligne (en
anglais, comme les skills techniques, F-108), le détail (chaque commande et
sa sortie) à déplier ; sa place est réservée sous le bouton (rien ne se
décale quand il apparaît). Gardé en mémoire, par agent, jusqu'à la sortie de
l'appli (I-39, S-72). Une action **faite et dont rien n'a changé depuis** ne se
relance pas d'un clic par erreur : seul *PR mergée → revenir sur la base*,
une fois fait et le dossier sur la base, est grisé (« Déjà sur la base ») ;
*Mettre de côté*, *Actualiser*, *Pull* et *Rebase* restent relançables, et les
autres sont déjà grisées ou masquées d'après le relevé (*✓ Commiter*, *Pousser*,
*S'assigner la PR*…). La recette (*Dans un nouveau worktree*, *Retirer le
worktree*) suit ses propres règles (F-111 : 15 min par étape,
`recipe.log`).

### Skills, configuration

**F-105 Le plugin `vibecoder`** (`userData/vibecoder/plugin/`), donné par le
SDK au Claude Code de chaque agent (F-58) : ses skills s'appellent
`/vibecoder:<nom>` ; `disable-model-invocation` : seul un bouton, ou
l'utilisateur qui tape la commande, les lance (sauf `processus`, F-111, que
l'agent appelle quand il a besoin d'un journal ou d'une relance, et
`actions`, F-115, quand on lui demande où en sont les actions, ou d'en lancer
ou d'en arrêter une — hors du moteur, seulement à la demande de l'utilisateur ; le moteur arrêté ou à une pause, rien ; il se reprend par l'action `vibe`, *Reprendre* à l'écran)
— ils ne coûtent rien tant
qu'on ne les appelle pas —, et rien n'est écrit dans les projets pour eux.
Ils s'appuient sur les skills du projet et de l'utilisateur quand ils
existent (`gear-prompt-specs-to-feature-note`, `gear-commit-message`,
`gear-fix-up`, `ponytail`, `ponytail-review`) : ils en suivent les
instructions, sinon le guide du dépôt (`docs/dev_guide/`), sinon les leurs.
`vibe` est la consigne d'enchaînement de l'orchestrateur (F-103) : il ne
fait plus la feature dans un seul tour, il lance les actions par le
protocole d'`actions`, à partir de la forme ; il ne s'arrête que sur une ligne
`[toi]`, une question de la note ou une pause de son rythme (F-103) : un refus
`halted`, il dit où il en est et quoi regarder, puis rend la main. `conception` (*opus · élevé*, une passe,
la lecture et `Write` pour `questions.md` seul) est la vérification de conception
de la note (`design-check`, *Vérifier* à l'écran, à volonté, F-100) : elle n'écrit que
des suggestions, jamais la note, et ne la valide jamais : sans rien de bloquant,
l'utilisateur relit, nettoie, puis valide lui-même, et son geste lance le moteur.
`prouver` (0.16.0, *opus · élevé*, en lecture) est la preuve des invariants (`prove`,
F-100) : une copie du code dans le dossier temporaire de sa course, sans commande
git qui écrit, `preuve.md` en sortie, et l'appli compare le dossier de travail et
l'index à sa fin ; un test resté vert dans un fichier d'avant la branche : `[toi]`,
jamais corrigé. `aligner` lit `preuve.md` s'il existe et ne corrige que les fichiers
de tests d'invariants que la branche crée ; `invariants` dit la même règle (un
fichier nouveau de préférence à un cas ajouté dans un fichier existant).
`invariants` suit `aligner` une fois dans sa course (lui corrige les tests et
boucle, F-100) ; l'appli lance `ponytail` quand `verifier` part pour toutes les
vérifications (F-93) ; `module` suit la boucle de `modules` pour un seul module
(F-115), sans demander `relire`. `modules` et `module` ne commitent pas :
`commiter-modules` commite tous les modules qui ont des changements, un
commit chacun (un seul, avec son argument `module`, que l'écran ne propose
plus) ; en historique simple (voir l'étape Modules), un seul commit pour tout le code,
puis des commits ordinaires. **Le mode** se lit dans la convention de commit du
projet : les mots « Historique simple » (« Simple history ») dans `AGENTS.md` ou
`CLAUDE.md`, que lisent `commiter-modules`, `commit-preparer`, `appliquer-revue`,
`fixups`, `pr` et `vibe` ; sans eux, tout comme avant.
**La note et la base** : les skills reçoivent, quand le gabarit les passe (F-97),
`note=<chemin>` et `base=<réf>` après `{{out}}` et ne cherchent pas ; sinon
ils cherchent comme avant (la note sous `docs/tickets/`, la base par
`git symbolic-ref`). `modules` et `module` donnent le chemin de la note à
`developpeur`, qui ne la cherche plus.
`forme` pose les squelettes dans le code puis recopie la forme dans la note (F-100),
en prose : ce qu'un module expose en une ou deux lignes, les signatures typées
restant dans les squelettes et leurs en-têtes ;
il nomme, sous le contrat de chaque module, ses variants : une ligne
`variants :` (le fichier de tests ordinaires, existant ou « à créer », ou
`aucun` et pourquoi), puis les cas à couvrir, chacun commençant par un mot
(jamais par un chemin : sous un dossier, il serait lu comme un module) ;
l'écran les lit comme le reste du contrat. Des modules qui ne compilent
qu'ensemble (l'un importe une constante de l'autre) : une seule entrée, leurs chemins
en tête séparés par « + ». `module` et `developpeur` les
écrivent d'abord, les lancent et les voient échouer pour la bonne raison,
puis écrivent le code jusqu'à ce qu'ils passent (TDD, guide § 3.4), et le
disent dans leur réponse (rouges, puis verts) ; `modules` vérifie à la
relecture qu'ils sont dans le fichier nommé, couvrent ses cas et ont été vus
rouges (note 0.15.0-variants-tdd). Cette relecture de chaque diff est un
**contrôle de conformité** (guide § 5.1) : les quatre questions, l'en-tête fidèle au
contrat, les variants vus rouges puis verts, les invariants verts et intacts ; les
doublons, cas limites, failles, code mort et les lignes « ne doit pas » d'un
module sont ceux de la revue `ponytail`, qui relit toute la branche juste après.
**Les questions** (`note` et `vibe`, dans `<sorties>/questions.md` ; `forme`, dans
sa réponse) se comprennent sans connaître le code : une clarté vaut mieux qu'une
brièveté. Chacune commence par une ou deux phrases de contexte, en langage simple,
sous le titre et avant les options (le questionnaire les lit comme le texte de la
question) ; elle reprend les mots de l'utilisateur et dit ce qu'il voit ou fait
(un bouton, une étape, un message) ; un numéro (`I-xx`, `T-xx`), un nom de
fonction ou de fichier n'est jamais seul, il vient avec ce qu'il désigne ; les
options se comprennent sans relire le code, la recommandée marquée
« (recommandé) » avec sa raison en quelques mots.
Un agent du plugin, Sonnet à effort élevé : `developpeur` (un module de la
Forme, ou, pour au plus 4 modules de code, tous à la suite dans l'ordre de la Forme, chacun
avec ses variants rouges avant son code ; il part du squelette — il le remplit, ne le recrée pas —, `ponytail` préchargé, ses
variants d'abord, puis aussi ses fonctions complexes et son code technique — cas
limites, bornes, erreurs, concurrence —, le typecheck et les tests de son module
seulement, rien de commité), lancé par `modules` (Opus · élevé), qui relit
chaque diff : un petit défaut corrigé lui-même, sinon la correction renvoyée
au même sous-agent, au second échec le module relancé sur Opus ; la suite
complète une seule fois, à la fin de *Générer les modules*, par Opus (le
typage et les tests des fichiers modifiés après chaque vague, avec l'outil du
projet, la suite complète si le projet ne sait pas les choisir ; rien avant
la première vague). Aucun skill livré ne fait
`git push --force` ni ne fusionne une PR.

**F-106 Modèles** : chaque skill fixe son modèle et son effort (son
en-tête). Ce qui se suffit à soi-même tourne dans un sous-contexte
(`context: fork`), sans relire la conversation : son coût ne dépend pas de la
longueur de celle-ci.
- *haiku* (effort faible) : `prs` (gardé, plus appelé par l'écran : F-112), `charger-pr`, `verifier`, `commit` (le
  message préparé, tel quel), `base`, `publier-revue` (`charger-pr`, `commit`, `base`, `publier-revue` : le
  *via* des actions directes, F-114), `nouvelle-demande` (F-110), `lancement` ;
- *sonnet* : `commit-preparer` (faible) ; `pr`, `fixups`, `ci`, `ecran`,
  `lire-invariants`, `commiter-modules` (moyen) ;
  `appliquer-revue` (élevé) ;
- *opus · élevé* : `invariants`, `modules`, `module`, `conception`, `relire`,
  `aligner`, `ponytail`, `relire-note`, `relire-commits`.

`lire-invariants` : Sonnet à effort moyen, retenu par un banc (tests Rust de
workflows-tester, tests TypeScript de whisper) : 79/90, contre 84/90 pour
Opus à effort moyen, 1,8 fois plus cher ; Haiku écarté. Sans sous-contexte,
chacun dans sa course (F-115) : `modules`, `module`,
`appliquer-revue` sur leur modèle ; `note`, `forme` et *Envoyer les
réponses* (un message sans skill, qui reprend la session de la note) sur
celui de l'agent (F-109) ; dans la conversation (en changer de
modèle en cours de conversation en perdrait le cache) : `vibe`, `processus`,
`actions`, et *Où j'en suis ?*.

**Un autre modèle pour une action** (F-99, réglé dans la page des réglages, § 8) : au démarrage (et à chaque
ouverture du dossier, F-107), pour chaque skill `<nom>` du plugin de
l'utilisateur qui fixe son modèle (*haiku*, *sonnet* ou *opus*), en
sous-contexte ou non, l'appli écrit une variante par autre modèle,
`skills/<nom>--<modèle>/SKILL.md`, et une par modèle et par effort, les
15 couples (3 modèles × 5 efforts, `low` à `max`),
`skills/<nom>--<modèle>--<effort>/SKILL.md` — le choix de l'effort (F-99) en
nomme une : le même en-tête (`description`,
`argument-hint`, `disable-model-invocation`, `allowed-tools` ; `context:
fork` seulement si le skill l'a : `modules--sonnet` lance encore ses
sous-agents), ce modèle et son effort (par défaut : haiku
`low`, sonnet `medium`, opus `high`), un corps qui suit `<nom>/SKILL.md` avec
les mêmes arguments. Ce sont des fichiers générés, pas des défauts : hors du
manifeste, réécrits à chaque fois (les noms en `--haiku`, `--sonnet`,
`--opus`, suivis ou non d'un `--<effort>`, leur sont réservés). Jamais Fable (I-36).

**F-107 Le dossier de VibeCoder** (`userData/vibecoder/` ; ⚙ Réglages,
*Agents Claude Code → Dossier de VibeCoder*, § 8) : `actions.fr.json`,
`actions.en.json` (les boutons : en modifier, en retirer, en ajouter),
`plugin/` (`.claude-plugin/plugin.json`, `skills/<nom>/SKILL.md` avec son
modèle et son effort, `agents/`), `README.md` (quoi modifier, comment revenir
à l'origine). Écrits d'après `resources/vibecoder/` au démarrage et à chaque
ouverture du dossier par le menu : un fichier absent est écrit — un fichier
supprimé revient donc par défaut — ; un fichier jamais modifié suit les mises
à jour de l'appli ; un fichier modifié par l'utilisateur, ou que l'appli n'a
pas écrit, n'est jamais remplacé (I-35). Un défaut que l'appli ne livre plus
(un fichier du manifeste absent de `resources/vibecoder/` : un agent, un
skill retirés) est supprimé au même moment, avec les variantes de son skill,
s'il n'a pas été retouché ; retouché, il reste, et l'appli ne le suit plus.
Le manifeste `.defaults.json` retient
l'empreinte de ce que l'appli a écrit ; illisible, plus rien n'est remplacé
ni supprimé.
Un échec ne bloque rien (S-72). Les actions et l'en-tête des skills (qui
travaille) sont relus à chaque relevé. S'y ajoutent les variantes générées des
skills (F-106), réécrites à chaque fois.

**F-108 FR / EN** : deux réglages de la page (§ 8, *Interface*), qui ne se
confondent plus. La **langue de l'interface** (`vibeLang`) : l'écran (libellés,
faits des étapes, raisons et erreurs) et les actions (`actions.<langue>.json` :
libellés, aides, messages envoyés). La **langue des agents** (`agentLang`,
absente : `vibeLang`) : ce que les skills écrivent pour l'utilisateur
(`{{lang}}`, passé par les actions) : la note, les questions
ouvertes, le plan de test à l'écran, la relecture de la note, la ponytail
review (relue de près, ses subtilités comprises : son adresse
`<fichier>:L<ligne>` et ses étiquettes, `delete`, `edge`…, restent telles
quelles), les releases.
**Tout ce qui touche au code reste en anglais**, quelle que soit la langue :
le pseudo-code des invariants (`test "…":`, `given / when / then`) et ses rubriques `Edge cases:`, `Guarantees:`, `Warning:` (le relevé
lit encore `Cas limites :`, `Garantit :`, `Attention :` des lectures
d'avant), les relectures de diff et de commits, la CI,
l'alignement, les vérifications, les réponses des skills techniques ; les
messages de commit et de PR suivent la convention du projet. Les composants
de la conversation (fil, champ, volet des tâches, détail du contexte)
restent en français.

**F-109 Fable** : VibeCoder ne fait jamais travailler Fable de lui-même
(I-36) : aucune action ni aucun skill livré ne le nomme ni ne change de
modèle, et le choix du modèle d'une étape (F-99) ne le propose pas ; seul un clic de l'utilisateur y passe l'agent (menu du robot, barre
d'état : « Fable (plus cher) »). Le choix d'une action (F-99) ne le peut pas non
plus, même écrit à la main dans `config.json`.

## 8. ⚙ Réglages

Le bouton **⚙** de l'en-tête de VibeCoder (F-92 ; une icône, *Réglages* en
infobulle) ouvre la **page des réglages** : par-dessus l'écran, au centre,
comme la palette Ctrl+K ; Échap ou un clic dehors la ferme. À gauche, les
**catégories** (la première à l'ouverture) ; à droite, les réglages de la
catégorie choisie, modifiables sur place, dans la langue de l'interface
(`vibeLang`). Elle remplace le menu natif de l'appli (`menu:settings`, retiré
en 0.14.0) : tout ce que le menu proposait s'y trouve, et s'y ajoutent les
réglages qui ne se changeaient qu'à la main dans `config.json` (§ 9). Une
liste ou une case s'écrit aussitôt ; un champ de texte, une commande ou un
nombre, en le quittant ou par Entrée. Un seul canal du pont, `settings`
(invoke) : lire la page, écrire un réglage (`{ set, value }`), lancer une
commande (`{ run }`) ; il rend toujours la page relue, qui remplace
l'affichée. Le micro garde `config:setDevice` (la page énumère les micros,
seule à y avoir accès). **Seul ce que la page montre s'écrit, avec des valeurs
que la lecture (§ 9) garde telles quelles** (`settingsPatch`, I-48) ; sinon rien
n'est écrit. Un réglage écrit refait le relevé de VibeCoder (l'écran et
*qui travaille* suivent).

- **Dictée** : l'état du modèle whisper (F-8 ; « téléchargement n % » tant qu'il
  se télécharge) ; *Langue de dictée* (`lang`) ; *Vocabulaire* (`vocabulary`,
  300 caractères) ; *Micro* (défaut du système + micros énumérés) ; *Bip de
  début / fin* (`sound`) ; *Couper le son des autres applications pendant la
  dictée* (`muteOthers`) et *Autoriser la coupure du micro Discord*
  (`discordMute`) (Linux, Windows) ; *Rétablir le son et le micro Discord*
  (dépannage, F-34 ; Linux, Windows ; grisé pendant une dictée).
- **Lecture à voix haute** : *Installer Pocket TTS* (F-42 ; seulement s'il est
  installable) ; *Langue du texte* (`speakLang` : détection automatique,
  français, anglais) ; *Voix française*, *Voix anglaise* (`speakVoices`) ;
  *Volume* (`speakVolume`, de 0 à 1).
- **Interface** : *Langue de l'interface* (`vibeLang`, fr / en : l'écran, F-108) ;
  *Langue de ce qu'écrivent les agents* (`agentLang`, fr / en : le `{{lang}}` des
  actions, F-108) ; *Taille au-delà de laquelle un artefact est tronqué*
  (`artifactTextMax`, en octets, F-95).
- **Actions** : pour chaque action dont le skill fixe le modèle, son *modèle*
  (jamais Fable ; le conseillé retire le choix) et son *effort* (« effort du
  skill » retire le choix) : F-99, F-106.
- **Agents** : Claude Code (la commande trouvée, ou « introuvable ») et
  *Commande de lancement* (`agentCommand`) ; l'éditeur trouvé et *Éditeur*
  (`editorCommand`) ; *Terminal* (`terminalCommand`, F-56) ; *Préfixe des
  commandes du projet et de gh* (`vibeCommandPrefix`, F-111, F-112) ; *Autoriser
  les agents extérieurs* (`outsideAgents`, F-116 : une case, désactivée par défaut ;
  un Claude Code lancé dans un terminal pilote alors le robot de son dossier, I-52,
  I-55) ; *Modifier
  la consigne des agents* (résumé audio) ; *Ouvrir le journal des agents*
  (tours, autorisations) ; *Dossier de VibeCoder* (ses fichiers par défaut
  écrits, puis le dossier ouvert, F-107).
- **Général** : *Ouvrir le dossier whisper* ; *Modifier la configuration*
  (`config.json`) ; la version et *À propos* (la page de la version) ;
  *Quitter*.

Une commande (`agentCommand`, `editorCommand`, `terminalCommand`) est un
programme que l'appli lance (I-27) : la page n'écrit ni caractère de contrôle ni
texte sans un mot (le champ vide est permis : il remet le défaut). Une commande que la page ne montre pas, ou grisée, ne fait
rien. Retirés en 0.14.0 avec l'icône, le collage et le bouton ▶ : *Coller
automatiquement*, *Toujours au premier plan*, *Afficher le texte transcrit*,
la source de la lecture et *désactivée*, *Afficher les agents*, *Relire
avant d'envoyer*. Le choix FR / EN de l'en-tête et les listes de modèle et
d'effort des boutons d'action sont passés dans cette page.

## 9. Réglages (`config.json`)

| Clé | Défaut | |
|---|---|---|
| `lang` | `fr` | fr, en, auto, es, de, it, pt, nl |
| `vocabulary` | `''` | prompt whisper, 300 car. (page des réglages, § 8) |
| `sound` | `true` | bips |
| `discordMute`, `muteOthers` | `false` | coupures |
| `speakVolume` | `1` | borné à 0–1 |
| `speakLang` | `auto` | auto, fr, en |
| `speakVoices` | `{ fr: estelle, en: jane }` | |
| `deviceId`, `deviceLabel` | `''` | micro |
| `agentCommand` | `''` | → `claude` |
| `editorCommand` | `''` | → le premier éditeur trouvé |
| `terminalCommand` | `''` | *Ouvrir un terminal ici* (F-56) : la commande du terminal, découpée comme `agentCommand`, `{dir}` remplacé par le dossier de l'agent (un argument entier) ; ex. `konsole --workdir {dir}`, `konsole --workdir {dir} -e distrobox enter dev`, `wt.exe -d {dir}` ; `''` → le premier terminal trouvé |
| `agents`, `agentFolders` | `[]` | |
| `agentSelected` | `null` | l'agent affiché, retrouvé au lancement (F-80) |
| `vibeLang` | `fr` | VibeCoder : la langue de l'interface seulement, fr, en (F-108) ; autre valeur → fr |
| `agentLang` | — | la langue de ce qu'écrivent les agents, le `{{lang}}` des actions : fr, en (F-108) ; absente ou autre valeur → `vibeLang` |
| `actionModels`, `actionEfforts` | `{}` | par id d'action, le modèle et l'effort choisis dans la page (F-99, F-106), pour tous les agents ; une valeur qui n'est pas une chaîne est ignorée, et **Fable jamais**, même écrit à la main (I-36) ; le modèle conseillé ou l'effort `''` retire le choix |
| `vibeModulesView` | `list` | VibeCoder : la vue de l'étape Modules, `ide` ou `list`, « d'avant » : depuis la 0.16.0 la page ne la lit plus ni ne l'envoie, la valeur reste au relevé et dans le réglage (F-100) ; autre valeur → `list` |
| `vibeSize` | — | taille de la fenêtre (défaut 1280×820, F-63) |
| `vibeCommandPrefix` | `''` | VibeCoder : ce qui précède les commandes du projet et gh (F-111, F-112) ; `''` → `distrobox enter <box> --` d'après `agentCommand`, sinon rien |
| `outsideAgents` | `false` | VibeCoder : « Autoriser les agents extérieurs » (F-116) ; seul `true` l'active, toute autre valeur est lue comme désactivé ; activé, `live.json` porte le jeton extérieur (I-52) |
| `artifactTextMax` | `10485760` (10 Mo) | VibeCoder : octets d'un artefact affiché en texte, au-delà « fichier tronqué » (F-95) ; un entier positif, sinon le défaut |
| `runTmpMax` | `1073741824` (1 Go) | VibeCoder : octets du dossier temporaire d'une course (F-115, I-58), au-delà la course est arrêtée ; un entier positif, sinon le défaut ; pas dans la fenêtre des réglages |

Ces réglages, dont `vocabulary`, `agentCommand`, `editorCommand`,
`terminalCommand`, `vibeCommandPrefix`, `outsideAgents` et `artifactTextMax`, se changent dans
la page des réglages (§ 8), sans ouvrir le fichier.

Dans `agents`, pour VibeCoder : `vibe` `{ flow, pr }` — `flow` `create` (défaut)
ou `review`, `pr` la PR suivie (un
entier positif, sinon `null`) ; une valeur inconnue prend le défaut ; un
`autonomy` d'avant la 0.12.0 est ignoré (le mode *Vibe* n'est qu'en mémoire,
F-103). Un
enfant (F-51) porte `parent` `{ id, pr? }` : l'agent du dépôt, et pour le
robot d'une PR ouverte dans un worktree, la PR (F-110) ; mal formé, c'est un
agent ordinaire. L'ancien `temp` `{ parent, pr }` se lit comme `parent`, et
devient `parent` au lancement.

Relue à chaque usage (une retouche à la main prend effet sans relancer).
Clés inconnues ignorées (ex. l'ancien `speakEngine` ; celles retirées en
0.14.0 : `size`, `pos`, `onTop`, `agentsEnabled`, `autoPaste`, `showText`,
`speak`, `speakMode`, `agentReview`, `convSize`, `startupPatch`, et `view` d'un
agent, encore écrit sur l'agent d'une PR, plus lu). Anciens formats
tolérés : `agentFolders` en chemins seuls, couleur portée par l'agent,
`temp` (ci-dessus).

## 10. Cycle de vie

**F-80** Une seule instance. Au lancement : le socket ouvert, sans être attendu
(F-116 : `live.json` écrit ; un échec est journalisé, l'appli reste ouverte),
la fenêtre créée (F-63),
couleurs des dossiers complétées, l'agent affiché la dernière fois
(`agentSelected`) l'est de nouveau, sinon le premier ; aucun : l'accueil
(I-8 retiré en 0.14.0). L'assistant Windows (coupures du son, F-32) démarre
à sa première commande (plus au lancement : le collage est retiré) ;
modèle whisper vérifié après le chargement de la fenêtre (F-8).

**F-81 Quitter** pendant une dictée ou un tour d'agent : on rend d'abord le son
et le micro Discord, on interrompt les agents et on attend la fin de leurs
tours (≤ 6 s), puis on quitte. À la sortie : le socket fermé et `live.json` supprimé (F-116),
assistant Windows, Pocket TTS et agents arrêtés. Les processus lancés par l'onglet *Processus* (F-111) : arrêtés
(SIGTERM, SIGKILL après 5 s), la sortie les attend.

## 11. Paquets et CI

- PR et `master` (Linux, Windows) : typage, tests (invariants et variants) et
  construction des pages et du principal ; essai de l'assistant PowerShell
  (réponses attendues `0, ok, \d+, ok, err`).
- Tag `vX.Y.Z` : paquets (AppImage sur Ubuntu 22.04, exe portable), avec
  `whisper-cli` v1.9.4 (Vulkan + repli processeur, essayé sur `jfk.wav`) et
  `uv` 0.12.20 ; Release GitHub. `vX.Y.Z-rc.N` : pré-version. Déclenchement
  manuel : artefacts sans publication.
- L'exécutable embarqué du SDK Claude (230 Mo par plateforme) est **exclu** du
  paquet ; `resources/scripts/` (`*.ps1`, `*.py`) et `resources/vibecoder/`
  livrés hors de l'asar.

---

## 12. Invariants — ce que l'appli ne doit jamais faire

Testés automatiquement (`npm run test:invariants`, dossiers
`tests/invariants/` protégés) : un invariant ne garde que ce qu'une refonte ne
doit jamais changer (le disque, les permissions, les fuites, les bornes, les
processus, la vie privée, le travail en cours dans le dépôt, l'isolement, la
frontière de la page, l'argent, l'irréversible) ; le reste est un variant
(`tests/variants/`), une règle de structure ou un contrôle de revue. Quel test
garde quelle règle : I-2 et I-3 (réduits en 0.14.0 :
`src/main/app/controllers/tests/invariants/page-text.test.ts`, sur le vrai
principal, qui garde aussi I-2 élargi en 0.14.0 : le texte et les pièces jointes
du champ de l'action, plus son gabarit ; et, 0.15.0, la vérification de conception,
à chaque *Vérifier* (le seul geste qui la lance ; 0.16.0 : ce cas, comme les deux autres, part de *Vérifier* et non plus de *Valider la note*) : le message n'est que le gabarit de l'action,
sans le texte du champ, `src/main/app/controllers/tests/invariants/design-check-text.test.ts`, repris avec l'accord de l'utilisateur : la règle est la même, seul le geste qui lance la vérification a changé), I-9, I-11 (page et principal), I-12,
I-13 à I-17, I-20 (et les ponts : `tests/invariants/bridges.test.ts`, dont le canal `settings` ; la page des réglages
écoutée par `listenFrom`, l'expéditeur vérifié :
`src/main/app/controllers/tests/invariants/settings-sender.test.ts`),
I-21 (et la frontière de la page, 0.15.0 :
`src/main/app/windows/tests/invariants/panel-window.test.ts`, sur la vraie
création de la fenêtre : `contextIsolation` et `sandbox`, la navigation bloquée,
aucune fenêtre ouverte), I-23, I-27 (et le terminal :
`src/main/technicals/editor/tests/invariants/terminal.test.ts`), I-32 à I-34 ;
VibeCoder, I-35 à I-40 : `src/main/core/vibecoder/tests/invariants/`
(`defaults.test.ts` I-35, `fable.test.ts` I-36, `files.test.ts` I-37,
`actions.test.ts` I-38), `src/main/technicals/git/tests/invariants/read-only.test.ts`,
`src/main/technicals/github/tests/invariants/read-only.test.ts`, `src/main/technicals/direct/tests/invariants/direct.test.ts` et `rebase.test.ts` (I-39 ; *Rebase* sur du vrai git), `src/main/app/controllers/tests/invariants/module-code.test.ts` et `note-and-tests-save.test.ts` (I-37, I-39 : *Voir le code*, la note, les tests, sur le vrai principal), `src/renderer/core/vibecoder/tests/invariants/markdown.test.ts`, `src/renderer/app/panel/vibecoder/tests/invariants/code-view.test.ts` et `note-editor.test.ts` (I-40) ; `src/main/app/controllers/tests/invariants/artifacts.test.ts`, `artifact-moves.test.ts`, `artifact-ops.test.ts`, `project-artifacts.test.ts` et `src/renderer/app/panel/vibecoder/tests/invariants/artifacts-view.test.ts` (I-37, I-39 : les artefacts, F-95, F-110 ; la copie sans écraser, `src/main/technicals/file-tree/tests/invariants/`) ;
I-42, I-43 : `src/main/core/runner/tests/invariants/runner.test.ts`,
`src/main/technicals/process/tests/invariants/process.test.ts` ; I-42 (la
recette), I-39 (retirer un worktree) : `src/main/core/runner/tests/invariants/recipe.test.ts`,
`src/main/app/controllers/tests/invariants/recipe.test.ts` (sur le vrai
principal, git réel, de vrais processus) ; I-39 (*Changer de branche*,
*PR mergée → revenir sur la base*), I-41 (*Dans un nouveau worktree*) :
`src/main/app/controllers/tests/invariants/pr-place.test.ts` (sur le vrai
principal, git réel) ; I-39 (*Revenir sur la branche principale*, *Aller
sur la branche* et *Créer ici* refusés avec des modifications ; rien de mis
de côté sans un clic sur *Mettre de côté*, *Pull* ou *Rebase*) : `place-switch.test.ts`, `stash.test.ts` (même
dossier, sur le vrai principal, git réel) ; I-44 :
`src/main/app/controllers/tests/invariants/runs.test.ts` (sur le vrai
principal, git réel, SDK factice), et, à la porte des commandes,
`commands-guards.test.ts` (même dossier) ; I-45 :
`src/main/core/agents/tests/invariants/rewind.test.ts` (ce que l'appli
demande à Claude Code) et le dernier cas de `runs.test.ts` ; I-44 relancé (T-32) :
`run-relaunched.test.ts` ; I-57 : `run-rights.test.ts` (même dossier, sur le
vrai principal, SDK factice : le mode, la liste de refus et le contrôle des fichiers que
l'appli lui donne) ; I-58 : `run-tmp.test.ts` (même dossier, sur le vrai
principal, SDK factice : le dossier effacé à chaque fin, la course arrêtée au-delà
de la borne) ; I-59 :
`src/renderer/core/vibecoder/tests/invariants/case-block.test.ts` (le bloc
replacé dans le texte) et `src/renderer/app/panel/vibecoder/tests/invariants/case-draft.test.ts`
(l'éditeur d'un cas) ; I-60 à I-62 : `file-validations.test.ts` (même dossier que
`run-tmp.test.ts`, sur le vrai principal, git réel : l'index, le dépôt et les
fichiers du projet intacts, le dossier de sorties qui garde la version) ; I-63 :
`case-validations.test.ts` (même dossier, sur le vrai principal : les fichiers du
projet intacts après une validation, une retouche, une conversion, une lecture) ;
I-64, I-65 : `src/main/app/controllers/tests/invariants/prove-rights.test.ts` (sur le vrai
principal, SDK factice, git réel : la course de preuve n'écrit aucun test du projet ni rien hors
de ses sorties, l'alignement refusé aux tests d'invariants d'avant la branche et comparé à
leur état de départ, la preuve comparée au dossier de travail et à l'index) ; I-66 :
`src/main/core/vibecoder/tests/invariants/proof.test.ts` (le parcours : une ligne non prouvée
laisse l'étape Modules pas faite, express compris) et
`src/main/app/controllers/tests/invariants/proof-gate.test.ts` (la CLI : `step.validate`
refuse les modules sans preuve qui passe, en express aussi) ; I-67 :
`src/main/core/vibecoder/tests/invariants/note-by-user.test.ts` (les fonctions pures) et
`src/main/app/controllers/tests/invariants/note-by-user.test.ts` (le vrai principal, express
compris) ; I-46 :
`src/main/core/vibecoder/tests/invariants/checks.test.ts` ; I-41 :
`src/main/app/controllers/tests/invariants/worktree.test.ts` (sur le vrai
principal, git réel) ; la page des réglages et
le coût des actions, 0.14.0 : I-48 et I-36 (jamais Fable pour une action) :
`src/main/core/settings/tests/invariants/settings-patch.test.ts` (la fonction pure
`settingsPatch` : une clé que la page ne montre pas, une valeur que la lecture
refuserait, une commande à caractère de contrôle, Fable ; rien n'est écrit),
I-49 : `src/main/technicals/socket/tests/invariants/server.test.ts` (le vrai serveur
et ses sockets : `127.0.0.1`, le jeton, la connexion fermée) ; I-50 :
`src/main/app/controllers/tests/invariants/socket-token.test.ts` (sur le vrai principal,
git réel, le vrai socket : ni la page ni un fichier ne portent le jeton) ;
I-51 à I-53 : `src/main/app/controllers/tests/invariants/agent-tokens.test.ts` ;
I-54 : `tests/invariants/cli-robot-env.test.ts` (la fonction pure de `cli.mjs`
et le vrai script `vibecoder.mjs`, deux serveurs d'essai) ; I-55, I-56 :
`src/main/app/controllers/tests/invariants/agent-doors.test.ts` (sur le vrai
principal, git réel sur deux dépôts, le vrai socket) ; la clause de I-43 sur
`live.json`, le jeton extérieur compris :
`src/main/app/tests/invariants/live-file.test.ts` (le même comportement,
réglage désactivé : variant `src/main/app/tests/variants/live-file.test.ts`) ;
I-36 : `src/main/app/controllers/tests/invariants/action-fable.test.ts` (sur le vrai
principal, SDK factice : un « fable » glissé à la main dans `actionModels` ne
part pas chez l'agent).
Les règles de structure (`tests/structure/`, des tests qui lisent le code
source, hors des dossiers protégés ; AGENTS.md) : I-27 (`no-shell.test.ts` : pas
de shell pour lancer un programme), I-20 (`bridges.test.ts` : seul
`technicals/ipc` écoute les pages, une seule écoute, sur les canaux du panneau),
I-34 (`tasks-view.test.ts` : aucun canal de la page dont le nom dit `file`,
`tail` ou `output`), I-39 (`direct.test.ts` : qui importe le lanceur des
actions directes, quelle fonction l'appelle), I-40 (`no-html.test.ts` : aucune
fonction de la page n'insère du HTML).
Devenus en 0.15.0 des fonctionnalités ou des scénarios, avec leurs variants
(`tests/variants/`) : I-10 (F-4, S-3 :
`src/renderer/core/dictation/tests/variants/whisper-text.test.ts` et
`src/main/app/controllers/tests/variants/page-text.test.ts`), I-18 (F-64, S-24),
I-19 (F-59, S-26) et I-24 (F-60) : `src/main/core/agents/tests/variants/agents.test.ts`,
I-29 (S-72 : `src/main/technicals/editor/tests/variants/editor.test.ts`,
`src/main/core/sound/tests/variants/muter.test.ts`,
`src/main/technicals/journal/tests/variants/journal.test.ts`), I-47 (F-111 :
`src/main/app/controllers/tests/variants/family-commands.test.ts`).
Devenus des règles de structure, écrites dans AGENTS.md et sans test : I-26 (rien
d'installé dans le système) et I-28 (pas de code propre à un bureau). Le reste
(focus, fenêtre, I-22) : scénarios du § 13 et
bancs de comparaison. Retirés en 0.14.0, avec le comportement qu'ils
gardaient et leurs tests : I-1, I-4 à I-6, I-8, I-30 (leur numéro reste
réservé : on ne renumérote pas).

### Les ponts et le texte des pages

*(« Focus et collage » jusqu'à la 0.13.0 : l'icône, la bulle et le collage
sont retirés en 0.14.0.)*

- **I-1** *(retiré en 0.14.0 : l'icône et la bulle ne prenaient jamais le
  focus ; elles n'existent plus.)*
- **I-2** Ce qui est envoyé à un agent est **toujours** le texte du champ
  (écrit, ou dicté puis relu par l'utilisateur) ou ce que whisper vient de
  rendre, jamais un autre texte fourni par une page ; une action de VibeCoder
  n'y ajoute que son gabarit et des valeurs du dernier relevé (I-38) — **élargi
  en 0.14.0** : ce qui part pour une action est le texte et les pièces jointes
  de son champ (F-69), plus son gabarit ; une pièce refusée, rien ne part. **En
  0.15.0**, les pièces jointes (`pieces` : images, fichiers, texte sélectionné)
  sont un argument des commandes dont le gabarit les lit (`run.start`, `guide`,
  `new-request`, `propose-run`, F-116), ouvertes aussi à un agent : mêmes
  bornes et mêmes refus que pour le champ. La transcription est rendue à la page
  qui l'a demandée, jamais envoyée d'elle-même à un agent.
- **I-3** Aucun canal « lis ce texte » ou « copie ce texte » : *Écouter* lit
  le résumé retenu par le principal (F-46), la page ne désigne qu'une réponse
  par son rang.
- **I-4** *(retiré en 0.14.0 : une transcription sans retour à la ligne, pour
  un collage dans un terminal ; rien n'est plus collé. Le texte sort toujours
  sur une ligne, F-5.)*
- **I-5** *(retiré en 0.14.0 : le presse-papiers rendu après un collage.)*
- **I-6** *(retiré en 0.14.0 : aucune touche simulée, collage désactivé.)*
- **I-30** *(retiré en 0.14.0 : la dictée remise au panneau après le fil de
  son agent ; la dictée rend son texte à la page qui l'a demandée, F-6.)*

### Vie privée

- **I-7** Rien ne quitte la machine, sauf ce qui est envoyé à un agent (et le
  téléchargement des modèles). Transcription et synthèse vocale : locales.
- **I-8** *(retiré en 0.14.0 : aucun agent sélectionné au lancement ; l'agent
  sélectionné est l'agent affiché, retrouvé au lancement, F-80, et une dictée
  ne part jamais d'elle-même chez un agent, I-2.)*
- **I-9** Le micro n'est autorisé qu'à nos propres pages (`file://`), en audio
  seul ; aucune autre permission.
- **I-10** *(devenu en 0.15.0 la fonctionnalité F-4 : jamais de whisper sur du silence ; scénario S-3.)*

### Son

- **I-11** La fin de l'enregistrement **rétablit toujours** ce qui a été
  coupé, même si le réglage a été décoché entre-temps, et à la fermeture ;
  un flux disparu entre-temps, à la réapparition de son application (F-33).
- **I-12** On ne rétablit que ce que **nous** avons coupé : un flux déjà muet
  le reste. Jamais le micro du système, jamais le bouton muet de Discord,
  jamais les flux de l'appli (bips). Seule exception : le dépannage (F-34),
  demandé par l'utilisateur.

### Agents : autorisations

- **I-13** Une demande d'autorisation montre ce qui va s'exécuter **en entier
  et tel quel** (ni chemin raccourci, ni coupure silencieuse ; au-delà de
  20 000 caractères, la coupure est dite : « dans le doute, refusez »). Outil
  inconnu : ses paramètres bruts.
- **I-14** *Toujours autoriser* n'accorde que des **règles d'autorisation**,
  pour **la session en cours** : jamais d'écriture dans les réglages du
  projet ou de l'utilisateur, jamais de changement de mode, jamais d'ouverture
  d'autres dossiers.
- **I-15** Une réponse ne vaut que pour la demande **affichée** (`key`) : si
  elle a changé entre-temps, rien n'est répondu.
- **I-16** Un clic dans les 600 ms qui suivent l'arrivée d'une **nouvelle**
  demande est ignoré.
- **I-17** Aucune demande ne se perd : en file, l'une après l'autre ; une
  demande annulée par Claude Code quitte la file et la suivante s'affiche ;
  en fin de tour ou à l'interruption, celles qui restent sont refusées.
  (Une demande sans réponse bloque Claude Code indéfiniment.)
- **I-18** *(devenu en 0.15.0 la fonctionnalité F-64 : une fenêtre qui se montre sans que l'utilisateur l'ait demandé ne prend pas le clavier ; scénario S-24.)*

### Agents : processus et confiance

- **I-19** *(devenu en 0.15.0 la fonctionnalité F-59 : interrompre demande à Claude Code d'arrêter son tour, le tuer en dernier recours, après 5 s ; scénario S-26.)*
- **I-20** Un message IPC n'est accepté que de la fenêtre qui a le droit de
  l'envoyer : le panneau, sur ses propres canaux (`PANEL_CHANNELS` : `conv:*`,
  `agent:*`, `dictation:*`, `config:*`, `tts:cancel`, `settings`) ; un
  autre expéditeur est ignoré.
- **I-21** Le panneau n'a pas accès à Node (`contextIsolation`, `sandbox`), ne
  navigue jamais et n'ouvre aucune fenêtre ; un lien ne s'ouvre que s'il est en
  `http(s)`, dans le navigateur ; un fichier joint est **montré** dans le
  gestionnaire de fichiers, jamais **ouvert** (un script se lancerait), et
  seulement un chemin absolu existant.
- **I-22** Une ancienne conversation se lit, elle ne reçoit pas de message ;
  seules les sessions **de ce dossier** s'ouvrent ou se reprennent.
- **I-23** Un nouveau dossier passe par la question « Faire confiance à ce
  dossier ? » (Claude Code lancé par le SDK ne la pose pas, alors que hooks et
  serveurs MCP du projet se chargent) ; le worktree d'une PR, à chaque fois
  (I-41).
- **I-24** *(devenu en 0.15.0 la fonctionnalité F-60 : la consigne `<audio>` ne s'applique qu'aux sessions créées par l'appli.)*
- **I-25** Un message n'est jamais envoyé à un agent au travail (le texte est
  gardé dans le brouillon). Une course de VibeCoder n'est pas
  un message à l'agent : elle part dans sa propre conversation (F-115) ; son
  avis de fin attend que la conversation de l'agent soit libre.
- **I-33** Le processus d'un agent survit à la fin d'un tour, et ce qu'il a
  lancé en arrière-plan aussi ; il n'est fermé qu'à *Nouvelle session*,
  *Retirer*, *Reprendre*, à la sortie ou pour être relancé (F-59), par la fin
  de son entrée d'abord (F-59). Un message part toujours au processus **de
  son agent** (une course, à celui de son entrée `<agent>~<clé>`, F-115).
- **I-34** Le principal ne lit que les fichiers de sortie que Claude Code a
  nommés dans le flux de la session (notification de tâche, résultat d'une
  commande en arrière-plan) : jamais un chemin venu d'une page, jamais un
  autre fichier. Une sortie est affichée, jamais collée ni envoyée (I-2,
  I-3) ; son fichier est montré, jamais ouvert (I-21).
- **I-32** *Ouvrir sur GitHub* n'ouvre que `https://github.com/<propriétaire>/<dépôt>`,
  reconstruit d'après le remote `origin` du `.git` **du dossier de l'agent** :
  jamais un autre hôte, schéma ou remote, un chemin en plus, ni les
  identifiants de l'origine (un jeton finirait dans l'historique du
  navigateur). Sans origine reconnue, l'entrée est grisée.

### VibeCoder

- **I-35** Un fichier de `userData/vibecoder/` que l'utilisateur a modifié, ou
  que l'appli n'a pas écrit, n'est **jamais remplacé ni supprimé**, à aucune version :
  seul un fichier absent, ou encore tel que l'appli l'a écrit (empreinte du
  manifeste `.defaults.json`), prend le défaut — ou part, quand l'appli ne le
  livre plus (F-107). Manifeste illisible : rien n'est remplacé ni supprimé ;
  un fichier absent du manifeste n'est jamais supprimé. Les variantes des skills (`skills/<nom>--<modèle>/` et
  `--<modèle>--<effort>/`, F-106) ne sont pas des fichiers de l'utilisateur : générées, hors manifeste,
  réécrites à chaque démarrage.
- **I-36** VibeCoder ne fait **jamais travailler Fable** de lui-même : un
  skill livré fixe haiku, sonnet ou opus, ou garde le modèle de l'agent ;
  rien dans le plugin livré (skills, agents) ne nomme Fable ; aucune action
  livrée ne le nomme ni ne change de modèle (`/model`) ; une variante
  générée (F-106) fixe haiku, sonnet ou opus, et une action n'accepte que
  ces modèles ; le choix d'une action (`actionModels`, F-99) ne le peut pas non
  plus, écrit par la page ou à la main dans `config.json`. Seul un clic de
  l'utilisateur y passe l'agent (coût).
- **I-37** Une page désigne un fichier par son **id dans le dernier relevé**
  (`m<rang>/<i>`, `b<i>`, `n`, `t<i>`, `c<rang>/<i>`, `a<i>`, `d<i>`, `r<i>` : un fichier supprimé du menu de diff de la vue IDE…), **jamais
  par un chemin** : un id en forme de chemin, ou égal au chemin d'un fichier du
  relevé, ne désigne rien (I-34), et le rôle décide de ce qu'on peut désigner
  (F-100, F-101). **Rien n'est lu hors du dossier prévu** — le dossier de
  l'agent (`..` et liens résolus ; ni chemin absolu, ni NUL), ses sorties sous
  leurs noms connus (F-95), le dossier d'artefacts de **son** projet (jamais
  celui d'un autre) — et **aucun lien n'est suivi** ; les versions validées (F-102), `validated/<empreinte>`,
  ne se lisent que dans ce dossier de sorties ; les autres versions d'un
  fichier ne se lisent que par git (`show`), au chemin du relevé. Deux
  exceptions, au geste de l'utilisateur, revérifiées par le principal : le dépôt
  sur l'arborescence des artefacts (`conv:vibeDrop`, des chemins que le pont lit
  du `File` déposé, jamais donnés par la page, seulement **copiés**, I-39) et le
  nom tapé (*Renommer*, *Nouveau fichier*…, F-95), un nom seul, jamais un chemin
  (`plainName`). Ce que le principal écrit pour ouvrir (une version de la PR, un
  diff) va sous `files/` du dossier de sorties de l'agent et n'est jamais relu.
  Le `@` du champ (F-70) ne met dans le texte que le chemin d'un artefact du
  relevé : aucun canal de plus. Le détail (les sortes d'ids, les formes de noms
  refusées) vit dans le code et dans F-95, F-100.
- **I-38** Dans le message d'une action, seuls `{{text}}`, les réponses aux
  questions et les remarques du brouillon, écrits par l'utilisateur (le champ,
  I-2), sont libres : insérés une fois, tels quels, jamais relus comme un
  gabarit. Un commit, un module ne sont pris que dans le **dernier relevé**
  (un hash de la branche, un rang de la Forme), un numéro de PR est un entier
  positif ; aucune autre valeur n'a de caractère de contrôle (un chemin de
  test à saut de ligne) ; une variable inconnue **fait refuser l'action**
  (l'agent lance des commandes avec ces valeurs). Le message est le gabarit,
  ses variables remplies, rien d'autre.
- **I-39** Le principal ne **modifie le dépôt, ni rien sur GitHub, que par une
  liste fermée de commandes** : les actions directes (F-114 : `DIRECT_GIT`,
  `DIRECT_GH`), la recette du projet (F-111, I-42), *Enregistrer* et la
  gestion des artefacts (ci-dessous) — au **clic** de leur bouton, jamais au
  relevé ni d'elles-mêmes, ou par la commande du registre qui leur correspond
  (F-116 : la même porte pour l'écran et pour les agents, par la CLI), sans shell (I-27),
  60 s au plus. La liste exacte vit dans le code (`DIRECT_GIT`, `DIRECT_GH` ;
  pour lire, `GIT_READ`, `GH_READ`, `GH_LOGIN`), que les tests lisent ; hors de
  là, git et gh ne sont lancés qu'en lecture, sans verrou ni programme externe.
  Ce qui ne change jamais :
  - **aucun texte d'une page n'est un argument** : un ref ou un chemin venu
    d'ailleurs ne devient jamais une option — refusé sans lancer git s'il
    commence par « - » ou contient un NUL, et, pour un ref, « .. » ou un
    caractère hors de `[A-Za-z0-9._/-]` (un **ref sûr**) ; une PR est un entier
    positif ;
  - **jamais de changement de branche, ni de retrait de worktree, dans un
    dossier qui a des modifications** : `git status` relu au clic (pas le
    relevé) ; une ligne, ou pas de réponse → refusé, rien ne bouge. **Rien
    n'est mis de côté sans le clic** de *Mettre de côté* (`--autostash` : *Pull*
    et *Rebase* seulement, à leur clic) ; un rebase en échec est **annulé
    aussitôt** ;
  - **jamais `--force` seul** (*Pousser* : `--force-with-lease`, à son seul clic) ;
    aucune commande de la liste ne fusionne une PR ni ne supprime une branche
    distante, un tag ou une release ;
  - **le relecteur n'écrit rien** : le principal recalcule le rôle d'après le
    dernier relevé, sans se fier à la page ;
  - **les écritures au geste** : *Enregistrer* (Ctrl+S ou le bouton) n'écrit que
    le fichier suivi, désigné par son id (I-37), un fichier existant du dossier de
    l'agent, 1 Mio au plus, jamais pendant un tour de la conversation ni une
    course qui génère ce module ; *Copier dans le projet* n'écrit que dans le
    dossier choisi, sans remplacer un fichier sans *Remplacer* ;
  - **les artefacts** (F-95) : gérés (ajouter, renommer, déplacer, copier,
    dupliquer, supprimer) au geste de l'utilisateur ou par leur commande, **dans
    le seul dossier d'artefacts du projet de l'agent affiché**, sur des
    éléments désignés par leur id (I-37), un lien jamais suivi ; **jamais
    écrasés** (copie exclusive, `COPYFILE_EXCL`, puis effacement de la source ;
    un nom pris est numéroté, ou refusé en renommant) et **jamais effacés
    définitivement** (supprimer passe par la corbeille du système, après
    confirmation) ; retirer un agent, un robot ou un worktree n'y touche pas.
  Un push autre que *Pousser*, un rebase autre que *Rebase*, un checkout,
  l'ouverture d'une PR passent par l'agent, dans la conversation, avec ses
  autorisations.
- **I-40** Aucun HTML rendu depuis un texte (note, rendue ou en édition,
  sortie d'un skill, message de l'agent dans le fil de la conversation,
  F-66, code d'un fichier, F-113, éditable ou non, son diff en
  ligne ou côte à côte : une balise
  tapée ou écrite dans le fichier reste du texte) : le
  Markdown de VibeCoder ne produit que du texte, du code et des liens
  `http(s)` — une balise reste du texte, un lien `javascript:`, `data:`,
  `file:`, `vbscript:` ou `//hôte` n'est pas un lien —, ouverts dans le
  navigateur (I-21).
- **I-41** Un enfant (F-51) ne naît que sur la **racine d'un worktree du
  même dépôt** (même `git rev-parse --git-common-dir`, résolu ; jamais un
  sous-dossier, un fichier, un chemin relatif ni un autre dépôt) autre que la
  copie de son parent, **sans agent**, un dossier existant ; et seulement
  après la question de confiance **acceptée** (I-23). Quatre naissances : le
  robot d'une PR (F-110), sur le worktree que la recette du projet vient de
  créer pour cette PR (*Dans un nouveau worktree*, ou une demande de
  l'écran), de la seule fiche `pr-<n>-worktree.json` que **l'appli** a
  écrite **dans les sorties de l'agent du dépôt** (un fichier, pas un lien,
  `dir` absolu), la question posée **à chaque fois** (ses réglages `.claude`
  sont ceux de la PR) ; l'enfant d'une nouvelle demande (F-110), sur le
  worktree que la recette vient de créer à la branche de `new-request.json`
  (*Dans un nouveau worktree*), seulement avec une demande en attente, la question pour un dossier jamais
  choisi ; *Ouvrir un agent ici* (F-56), parmi les worktrees que
  git liste, la question pour un dossier jamais choisi, le tout revérifié
  après elle (worktree retiré, agent arrivé : rien) ; le rattachement par git
  d'un agent existant (au lancement, après « + »). Aucune page ne donne de
  dossier : l'écran ne peut que demander d'afficher ou de proposer le robot
  de la PR suivie, ou lancer *Dans un nouveau worktree*, d'une PR ou d'une
  demande (le dossier vient du fichier du projet, `worktree.dir`).
- **I-42** VibeCoder ne lance **que les commandes du fichier du projet**
  (F-111) — `commands`, `setup`, `worktree.create`, `worktree.remove` —,
  derrière le préfixe, dans le shell du fichier, ou, sans `worktree.create`
  ou `worktree.remove`, le git de repli de la recette (`git -C <parent>
  worktree add -b <branche> <dossier> <départ>` puis `setup`, `git -C
  <parent> worktree remove <dossier>` sans `--force`), sans shell, chaque mot
  un argument. Ce fichier n'est lu **que** dans `.vibecoder/` du dossier du
  parent présent (F-51), **jamais celui d'un worktree** (une PR pourrait y
  apporter ses propres commandes) : un enfant dont le parent est parti n'en a
  aucun. Une branche ou une base n'est **jamais dans le texte d'une
  commande** : elle passe par `VIBECODER_BRANCH` et `VIBECODER_BASE`, ou,
  pour le git de repli, en argument à part ; un ref pas sûr (I-39) ne lance
  rien. Une page désigne une commande par son **rang** (un entier du
  fichier), jamais par un texte ; un rang hors du fichier, en texte, négatif
  ou non entier ne lance rien. L'appli **crée** ce fichier s'il n'existe pas
  (la proposition du skill, l'exemple de *Modifier*, l'ancien fichier du
  dossier de l'appli) ; existant, elle ne le réécrit que pour y **ajouter**
  les commandes de nom nouveau d'une proposition, et son `setup`, son
  `worktree` si le fichier n'a pas la clé — **jamais par-dessus** —, sans
  modifier ni retirer ce qui y est. Les demandes de l'agent
  (`proc.stop`, `proc.restart`) ne valent que pour un nom du fichier.
  Exception à I-27, limitée à ces commandes, écrites par l'utilisateur : le
  shell du fichier (`bash -ic`).
- **I-43** Rien de ce que l'appli a lancé ne **survit à sa sortie**, et elle
  n'arrête **que ce qu'elle a lancé** : arrêter vise le groupe du processus
  et les processus marqués de **son** jeton (dans leur environnement), rien
  d'autre ; une clé inconnue n'arrête rien ; quitter arrête tout, même un
  descendant sorti du groupe. SIGTERM, puis SIGKILL après 5 s (comme F-59).
  `live.json` ne survit pas non plus à la sortie, ni le jeton extérieur qu'il
  porte (F-116).
- **I-44** Jamais **deux courses qui modifient la branche** en cours en même
  temps, ni **une lecture pendant une modification** (F-115), qu'elles
  viennent d'un clic ou de l'orchestrateur (`vibecoder run start`), de deux
  clics sans relevé entre eux ou de deux demandes lues au même passage. Une
  course arrêtée dont l'utilisateur n'a pas encore choisi *Garder* ou
  *Annuler* compte comme en cours (retour en arrière compris). Une course
  dont un sous-agent travaille encore reste en cours, **relancé compris**
  (`SendMessage` : T-32) : son verrou ne tombe pas pendant qu'il écrit.
- **I-45** *Annuler* une course ne ramène **que ce que ses propres outils
  d'édition ont écrit** : `rewindFiles` du SDK sur **son** processus (son
  entrée `<agent>~<clé>`, lancé neuf pour elle, avec le suivi des fichiers),
  à **son** premier message — jamais sur la conversation de l'agent ni sur
  une autre course, en cours ou gardée ; une course qui reprend la session
  d'une autre (*Envoyer les réponses*) ne ramène qu'elle-même. Le travail du
  développeur et celui des autres courses restent.
- **I-46** Un `checks.json` dont le `time` **précède le départ de la
  dernière course `checks`** (ou sans `time`) ne compte pas : ignoré partout
  (sorties à l'écran, prochaine action, étape Revue, liste de contrôle),
  comme absent. Sans course `checks` connue (appli relancée), il compte.
- **I-47** *(devenu en 0.15.0 la fonctionnalité F-111, *Famille* : une même commande du fichier du projet ne tourne jamais à deux endroits d'une famille.)*
- **I-48** La page des réglages n'écrit dans `config.json` que **ce qu'elle
  montre** (une clé de § 8, un modèle ou un effort d'une action qu'elle liste),
  avec **une valeur que la lecture garde telle quelle** (§ 9) : une valeur hors
  des choix de sa liste, un nombre hors de ses bornes (volume de 0 à 1, taille
  d'un artefact : entier positif), un texte plus long que son maximum, une
  commande à caractère de contrôle ou sans un mot (ce sont des programmes que
  l'appli lance, I-27), un modèle qui n'est pas des siens, Fable jamais
  (I-36) : rien n'est écrit. Les
  arguments de la page sont vérifiés par le principal, pas par la page ; le canal
  `settings` n'est écouté que de la fenêtre du panneau (I-20).
- **I-49** Le socket (F-116) n'écoute **que sur `127.0.0.1`** (jamais
  `::1` ni une autre interface) et n'exécute **aucune commande sans un jeton de
  sa table** (celui de l'écran, tiré à son lancement ; ceux des agents, I-51 et
  I-52) : un jeton faux, absent, vide, tronqué, ou celui d'un autre
  lancement est refusé (`bad-token`), le gestionnaire jamais appelé ; une ligne qui
  **n'est pas une commande** (une requête HTTP, pas du JSON, un tableau, `cmd`
  ou `target` absent, une clé de trop, plus longue que `LINE_MAX`) **ferme la
  connexion**, rien de ce qui suit n'est traité : une page de navigateur ne peut
  pas lui parler.
- **I-50** Le jeton de l'écran n'est **jamais donné à la page** (ni par un canal, ni
  dans le relevé, ni dans un message ou une réponse) et **jamais écrit sur le
  disque**, `live.json` compris, qui ne porte que le port, le pid et, réglage
  activé, le jeton extérieur (I-52) : il ouvre la porte
  « écran », qui répond aux autorisations (`run.allow`, `run.always`, `run.deny`,
  I-13 à I-17) ; un agent qui le lirait pourrait répondre lui-même à ses demandes.
  Il naît dans le serveur et reste en mémoire dans `controllers/socket`.
- **I-51** Le jeton d'un **robot** (F-116) n'est **jamais écrit sur le disque**,
  `live.json` compris : il naît dans `controllers/socket`, reste en mémoire, et ne
  sort que par l'environnement de ce que l'appli lance pour ce robot
  (`VIBECODER_TOKEN`). Il dit quel robot appelle : lisible par tout programme de la
  machine, il laisserait un agent extérieur se faire passer pour n'importe quel
  robot, même désactivé. Il est distinct du jeton extérieur (I-52).
- **I-52** Le jeton **extérieur** n'est écrit **que dans `live.json`**, et
  **seulement tant que « Autoriser les agents extérieurs » est activé** : réglage
  désactivé, ou absent de la config (le défaut), `live.json` n'en porte pas ;
  désactivé après coup, il est retiré du fichier et refusé ensuite ; à la sortie de
  l'appli, `live.json` est supprimé (I-43). Aucun autre fichier ne le porte.
- **I-53** Aucun jeton d'**agent** — d'un robot ou extérieur — n'est donné à la
  **page** (ni par un canal, ni dans un relevé, un message ou une réponse), comme
  celui de l'écran (I-50).
- **I-54** Un **robot ne trouve jamais l'appli par `live.json`** : son port et son
  jeton viennent de son environnement (`VIBECODER_PORT`, `VIBECODER_TOKEN`). La
  commande ne lit pas `live.json` quand elle les a, et n'associe jamais le jeton
  d'un robot au port de `live.json` : un programme qui y réécrirait le port, que
  tout programme de la machine peut lire et écrire, recevrait sinon le jeton du
  robot.
- **I-55** Un agent **extérieur n'est pas accepté quand le réglage est désactivé**
  (le défaut) : son jeton, même celui d'un lancement ou d'une activation
  précédents, est refusé (`bad-token`) et rien ne part.
- **I-56** Un agent n'agit que **sur son propre robot** : un robot, celui de son
  jeton, d'où qu'il appelle ; un agent extérieur, celui de son dossier courant (le
  robot affiché s'il est sur ce dossier, sinon le premier ; un sous-dossier compte,
  `/p2` n'est pas sous `/p`). Un robot retiré de la config, ou un dossier sans
  robot : refusé, rien ne part. Et il passe par la porte `agent` : ce qu'elle
  ferme (répondre aux demandes d'autorisation, I-13 à I-17) lui reste fermé.
- **I-57** Une course (F-115) et ses sous-agents n'ont **jamais plus de droits
  que ceux de leur skill plus les règles d'autorisation de l'utilisateur** :
  toujours le mode `dontAsk` (jamais le mode de l'agent, *Auto* ni le
  contournement des autorisations), que l'action parte d'un clic ou de
  l'orchestrateur ; la liste de refus donnée au SDK (`disallowedTools`) tient
  quel que soit le mode : une commande qu'elle nomme, que le skill n'ouvre pas,
  ne passe pas, et `gh pr merge`, `gh release` et `gh repo` ne passent jamais ;
  leurs outils de fichiers ne lisent ni n'écrivent hors du
  projet et des sorties de l'agent (le plugin et le dossier d'artefacts du
  projet en lecture : rien dessous n'est écrit, rien n'en sort par `../` ni par
  un lien, aucun autre projet), et jamais `.claude/`,
  `.git/`, `.husky/`, un `AGENTS.md` ni un `package.json` : une action
  n'élargit pas ses propres droits.
- **I-58** Le dossier temporaire d'une course (F-115) n'est **jamais laissé après
  sa fin** — finie, en échec, échec au lancement, arrêtée à la main ou par la
  borne, fermée : effacé à chacune — et **ne dépasse jamais sa borne
  (`runTmpMax`) sans que la course soit arrêtée** : au-delà, elle s'arrête comme
  à la main, sa réponse le dit en tête.
- **I-59** Enregistrer le bloc d'un cas (étape Invariants, F-93) ne **modifie
  aucune ligne du fichier de test hors de ce bloc** : le fichier du disque,
  seul ce bloc remplacé, fins de ligne gardées ; une plage hors du fichier :
  rien n'est enregistré.
- **I-60** Valider une étape, retirer sa validation ou lire les validations
  (F-102) ne **touche jamais l'index du dépôt**, ce que `git commit` prend : les
  commits par module, le repli des fixups et les `git add` des agents restent ce
  qu'ils sont ; l'écran comme la CLI (`step.validate`).
- **I-61** Valider une étape ou retenir une version (F-102) n'**écrit rien dans
  le dépôt ni sous `.git/`** : la liste des fichiers d'une étape et le texte de
  chacun vont dans le dossier de sorties de l'agent, `validated/<empreinte>`.
- **I-62** Valider une étape, retirer sa validation ou la décocher (F-102) ne
  **modifie aucun fichier du projet** (note, Forme, tests, modules).
- **I-63** Calculer, garder, convertir ou retirer la validation d'un cas
  d'invariant (étape Invariants) ne **modifie aucun fichier du projet** : les
  empreintes des blocs, la conversion des validations d'avant et la lecture cas par
  cas vont dans `vibecoder-state.json` et le dossier de sorties de l'agent.
- **I-64** (0.16.0) Un test protégé existant n'est **jamais modifié pour faire
  passer une preuve** : seuls les fichiers de tests d'invariants que le ticket
  crée se corrigent. La course *Prouver les invariants* n'écrit aucun test du
  projet (la correction d'un test resté vert passe par l'alignement) ; la course
  *Vérifier l'alignement* se voit refuser toute écriture dans un fichier de tests
  d'invariants qui existait au départ de la branche (un cas que la branche y
  ajoute compris), et échoue, sa réponse nommant le fichier et `align.md` effacé,
  si l'un d'eux a changé à sa fin (une commande du terminal que le contrôle des
  fichiers ne voit pas) ; un fichier nouveau reste corrigeable.
- **I-65** (0.16.0) La course *Prouver les invariants* ne laisse **aucune mutation
  dans le dossier de travail, l'index ou un commit** : elle n'écrit, par ses outils
  de fichiers, que dans les sorties de l'agent (sa copie du code y vit, dans son
  dossier temporaire), aucune commande git qui écrit ne lui est ouverte, et, à sa
  fin quelle qu'elle soit, une différence du dossier de travail ou de l'index avec
  leur état de son départ la fait échouer, nomme les fichiers touchés et efface
  `preuve.md`.
- **I-66** (0.16.0) Un invariant **non prouvé n'est jamais accepté en silence** : une
  ligne « → invariant » n'est prouvée que par une rubrique `[prouvé]` à son nom dans
  `preuve.md` ; une rubrique `[toi]`, une étiquette inconnue, une rubrique absente
  ou pas de `preuve.md` laissent l'étape Modules pas faite, et `step.validate` refuse
  les modules, en express et pendant *Vibe* aussi : l'invariant remonte à
  l'utilisateur.
- **I-67** (0.16.0) La note n'est **validée que par l'utilisateur**, et sa conception
  n'est jamais changée par le système, quel que soit le rythme : ni le relevé, ni
  les validations du système, ni la fin d'une vérification, ni l'orchestrateur ne la
  valident, le moteur en marche et express compris ; une note validée puis changée ne garde son ✓ que si le
  changement n'ajoute que le texte exact d'une réponse « Accepter » choisie,
  tout autre changement le fait tomber ; rien de l'appli n'écrit la note sur le
  disque.

### Système et code

- **I-26** *(devenu en 0.15.0 une règle de structure, écrite dans AGENTS.md : rien n'est installé dans le système ; Pocket TTS et son Python vont dans les données de l'appli, aucun paquet système requis.)*
- **I-27** Jamais de shell pour lancer un programme (`execFile` / `spawn` avec
  arguments) : chemins et texte ne sont jamais interprétés ; le terminal
  d'*Ouvrir un terminal ici* (F-56) aussi, le dossier un argument entier.
  Seule exception : les commandes du fichier du projet (F-111, I-42), recette
  comprise, écrites par l'utilisateur, passent par le shell de ce fichier
  (`bash -ic`) pour trouver ses alias et fonctions.
- **I-28** *(devenu en 0.15.0 une règle de structure, écrite dans AGENTS.md : pas de code propre à un bureau (KDE, KWin…) dans le produit ; une limite d'un gestionnaire de fenêtres se contourne à la main et se documente, ex. Alt+F3 → *Sur tous les bureaux*.)*
- **I-29** *(devenu en 0.15.0 le scénario S-72 : un échec d'un service annexe ne bloque jamais la dictée ni un agent.)*

---

## 13. Scénarios de non-régression

À rejouer avant chaque fusion (et après chaque étape de la migration).
« Banc » : appli lancée avec `--user-data-dir` sur un dossier temporaire,
transcription simulée en remplaçant `whisper.transcribe` (cf. les essais de la
revue de la 0.4.0). La page seule se compare automatiquement à une
version : `npm run test:front-diff -- <tag ou branche>` (`tests/front-diff/`,
la fenêtre de VibeCoder seule : mêmes scénarios, mêmes messages vers le
principal, mêmes captures ; une référence d'avant la 0.14.0 n'a pas cette
fenêtre). Le principal, sur l'appli réelle : `npm run test:main-diff --
<tag ou branche>` (`tests/main-diff/` : démarrage, les robots, dictée rendue
au champ, un enregistrement trop court, *Écouter*, liens et agents refusés,
erreurs ; mêmes relevés). Le contrat de la CLI : `npm run test:contract`
(`tests/contract/`, à la main, hors de `npm test`) lance l'appli réelle, profil
temporaire, faux `claude` et faux `gh`, `origin` local, et l'interroge par la
commande `vibecoder` ; une famille de cas par fichier (`cases/`), et un résumé
qui dit combien de commandes de la table sont couvertes, nomme celles sans cas
(le banc échoue alors) et les codes d'erreur jamais rendus (`halted` compris).

**Dictée**
- **S-1** Maintenir le micro du champ de la conversation, parler, relâcher :
  bip aigu puis grave, le texte dans le champ, à la suite du brouillon, le
  clavier au champ ; rien n'est envoyé ni collé.
- **S-2** *(retiré en 0.14.0 : clic bref et glisser de l'icône.)*
- **S-3** Relâcher aussitôt (< 0,4 s) ou dicter du silence : « Aucune parole
  détectée », whisper non appelé.
- **S-4** *(retiré en 0.14.0 : collage automatique décoché.)*
- **S-5** *(retiré en 0.14.0 : dicter dans un terminal.)* Une dictée longue :
  une seule ligne dans le champ.
- **S-6** Une zone de commentaire a le clavier, maintenir le micro de la
  conversation → le texte va à cette zone ; le micro d'un commentaire, de la
  réponse libre d'une question → le texte dans ce champ ; *Envoyer* de chacun
  fait ce que fait son bouton (ajouter le commentaire, envoyer les réponses).
  Aucune étape n'a de champ : ni à la Note, ni à la Forme, ni aux Invariants. Seul le micro tenu
  s'allume (rose, « enregistre », « transcrit ») : les autres restent au repos.
- **S-7** Discord en appel, coupure autorisée : « Micro Discord coupé » en
  tête de la fenêtre, rétabli au relâché ; micro déjà coupé avant → toujours
  coupé après.
- **S-8** Son des autres applications : une vidéo se tait pendant la dictée,
  les bips restent. Vidéo arrêtée pendant la dictée, puis relancée : le son
  revient dans les 5 s. ⚙ Réglages → *Rétablir le son et le micro Discord* :
  un flux resté coupé reprend.

**Lecture**
- **S-10** ▶ *Écouter* sur une réponse : son résumé lu (la première fois,
  Pocket TTS s'installe, le message en tête de la fenêtre) ; dicter pendant
  une lecture l'arrête.
- **S-11** Volume changé dans ⚙ Réglages : appliqué à la lecture suivante.

**Agents**
- **S-20** Un agent affiché, dicter dans le champ de la conversation, Entrée
  → la réponse arrive dans le fil, ▶ *Écouter* lit le résumé. Aussi à la
  première dictée après le lancement (longue session).
- **S-21** *(retiré en 0.14.0 : *Relire avant d'envoyer* décoché, envoi
  direct.)*
- **S-22** **Brouillons par agent** : alpha affiché, dicter « un » dans son
  champ, clic sur le robot beta, dicter « deux » → le champ de **beta**
  contient « deux » ; retour sur alpha : « un », intact.
- **S-23** Mode manuel, deux lectures de fichiers en parallèle : les deux
  demandes passent l'une après l'autre, l'agent ne reste pas bloqué.
- **S-24** Demande d'autorisation, fenêtre masquée : elle se montre sur
  l'agent, **sans focus**, la demande visible dans le fil ; le texte
  affiché est complet. Un autre agent affiché : « ? » sur le robot, le bip ;
  fenêtre sans le focus : une notification du système, un clic affiche
  l'agent.
- **S-25** *Toujours autoriser* : seule la règle annoncée, pour la session.
- **S-26** *Interrompre* pendant une longue commande (lancement par
  `distrobox enter`) : arrêt en moins d'une seconde, plus rien ne tourne
  dans la box.
- **S-27** Historique : ouvrir une ancienne conversation (lecture seule, pas de
  champ), *Reprendre*, *← Conversation en cours*.
- **S-28** Pièces jointes : capture collée, image et fichier déposés, image
  choisie par le trombone du champ ; l'agent les reçoit ; le fil les montre. Les mêmes
  dans le champ de la conversation pour *Rédiger la note* et dans les réponses du questionnaire
  (*Envoyer les réponses*) : elles partent avec cette action seule, la course les reçoit ;
  une action dont le gabarit n'a ni `{{text}}` ni `{{answers}}` les ignore et le dit.
- **S-29** « /comp » → /compact proposé, Entrée le choisit, le message part ;
  la jauge attend une nouvelle mesure. Deux agents de même nom dans deux
  dossiers : chacun ses commandes.
- **S-30** *(retiré en 0.14.0 : le contexte « Dictée » et *Copier*.)* Les
  robots : afficher beta ne déplace aucun robot ; clic sur le badge de
  l'agent affiché → la palette sur *Agents* ; Ctrl+Tab → l'agent d'avant ;
  en changeant d'agent, jamais de page vide.
- **S-31** alpha affiché, beta qui répond : pastille verte et bip sur le
  robot de beta ; alpha qui répond : ni pastille ni bip (lue d'office).
- **S-32** Nouveau dossier : question de confiance ; *Annuler* → rien
  d'ajouté.
- **S-33** Quitter pendant un tour : l'appli attend l'arrêt de l'agent. Agent
  au repos : elle quitte aussitôt (son processus sort de lui-même).
- **S-34** Relancer l'appli : l'agent affiché la dernière fois l'est de
  nouveau (I-8 retiré) ; aucun agent : l'accueil, *Nouvel agent…*.
- **S-35** alpha affiché, « + » (ou Ctrl+N) → nouvel agent beta (dossier
  favori, puis dossier choisi) : beta affiché, son robot juste après les
  autres ; dicter → le champ de beta.
- **S-36** Agent dans un dossier cloné de GitHub : clic droit → *Ouvrir sur
  GitHub — o/d*, la page s'ouvre dans le navigateur. Dossier sans `.git`, ou
  origine hors GitHub : entrée grisée. `git remote set-url origin …` puis clic
  droit : le nouveau nom s'affiche.
- **S-37** Clic droit → *Ouvrir dans l'éditeur (zed)* : le dossier s'ouvre
  dans une **nouvelle** fenêtre de Zed (celle déjà ouverte garde son projet).
  `editorCommand` réglé sur un programme absent : entrée grisée,
  *Aucun éditeur trouvé* dans ⚙ Réglages. Quitter l'appli : l'éditeur
  reste ouvert.
- **S-38** « Lance `sleep 30 && echo fini` en arrière-plan et préviens-moi » :
  le tour finit ; ~30 s plus tard, l'agent répond de lui-même (pastille verte,
  bip), ou au plus tard avec le message suivant. *Nouvelle session* puis
  quitter : plus aucun processus `claude` (`pgrep claude`).
- **S-39** « Lance `for i in 1 2 3 4 5 6; do echo étape $i; sleep 2; done`
  en arrière-plan » : le tour fini, *⚙ Tâches (1)* dans la barre d'état ; le volet montre la commande, sa sortie grandit au fil
  de l'eau, puis ✓ et le résumé. Un lien dans la description (« surveille
  https://github.com/… ») s'ouvre dans le navigateur. *Nouvelle session* :
  volet vide.

**Fenêtre**
- **S-40** *(retiré en 0.14.0 : *Toujours au premier plan*.)* La fenêtre
  passe sous une autre comme toute fenêtre ; l'en-tête la déplace (pas ses
  boutons) ; réduire, agrandir, fermer par les boutons de droite ; fermer
  quitte l'appli.
- **S-41** Fenêtre redimensionnée : taille retenue au lancement suivant.
- **S-42** Longue conversation : le fil s'ouvre sur le dernier échange, pas
  en haut ; on remonte, un message arrive : la lecture reste.

**VibeCoder** (un agent dans un dépôt d'essai qui a `docs/tickets/` ; pour
relire, une PR d'essai sur GitHub)
- **S-50** Premier lancement : la fenêtre (1280×820), l'en-tête de la vue C
  (les robots, `⎇` branche, VibeCoder au milieu, Artefacts, Chercher Ctrl K,
  ⚙ en icône, les boutons de la fenêtre), au centre le fil d'Ariane
  au-dessus de l'étape en cours, conversation à droite ; les couleurs et les
  polices du thème, rien chargé du réseau. Barre
  d'état : changer modèle, effort, mode → le menu du robot les montre ; ↻ à côté
  de « relevé à … » relève (et tourne). Pas de pastille *Fable* sur les étapes Note
  et Forme. Un
  dossier sans `.git` : le bandeau le dit, un message part quand même.
- **S-51** Ctrl+K : la palette ; Tab → *Agents*, *Branches*, *PR*, *Tout* ;
  « beta » → beta, Entrée → beta affiché ; une branche que personne ne
  tient, Entrée → le dossier y passe ; ⇧ Entrée → la vue des branches ;
  Échap ferme. ⚙ : la page des réglages, au centre comme la palette (Échap ou un
  clic dehors la ferme) ; ses catégories *Dictée* (modèle, langue, vocabulaire,
  micro, bip, coupures, dépannage), *Lecture à voix haute*, *Interface*, *Actions*,
  *Agents* (commande, éditeur, terminal, préfixe, consigne, journal, dossier de
  VibeCoder), *Général* (dossier whisper, configuration, version, quitter) ; un
  champ s'écrit en le quittant ou par Entrée, une valeur refusée (volume 7,
  commande à saut de ligne) n'écrit rien.
- **S-52** Sur la base, champ de la conversation vide, *Rédiger la note* : « Dictez ou écrivez
  d'abord… », rien n'est envoyé. Dicter une demande → dans le champ ;
  *Rédiger la note* : l'agent propose un nom de branche ; « Voulez-vous
  créer la branche … ? », le nom prérempli, modifiable ; rien n'est créé
  avant le clic. *Créer ici* : la branche dans l'en-tête, puis la note
  s'écrit, rendue à l'étape Note. Sur la branche, une précision dans le champ,
  *Rédiger la note* : ses questions ouvertes s'affichent ; *Envoyer les
  réponses* : « 1. … 2. … » dans le fil, puis la note à jour.
- **S-53** Une branche avec deux tests d'invariants (TypeScript, Rust) :
  *Lire en pseudo-code* (sonnet · moyen) → une carte par cas (pseudo-code,
  cas limites, garantie, attention) ; *Valider* sur un cas, *À revoir* sur un autre (cité
  dans le champ). Modifier l'un des tests : ses cas passent « modifié
  depuis », *Lire en pseudo-code* ne relit que lui. *Relire* sur un fichier
  lu : sa lecture est refaite (et remplacée) ; *Tout relire* : tous.
- **S-54** Sur la base, pas de badge *Relecteur*. Le bouton de la branche → la vue
  des branches, *À relire* → la liste ; un clic sur la PR d'essai (d'un autre
  auteur) : branche courante, copie de travail et `git status` inchangés,
  `origin/<tête>` récupérée, son nom dans le bouton ; *Changer de branche* → le
  dossier sur la branche de la PR, le badge *Relecteur* dans l'en-tête, rien
  qui édite, génère ou commite (ni *Modifier*, ni *Enregistrer*, ni *Générer*) ;
  le parcours commence à Note et se lit dans la copie de travail (note, règles, essai, publier). *Préparer la revue* lance *Relire la note*, *Lire en pseudo-code*, *Vérifier l'alignement*, *Relire le code* et *Plan de test à l'écran* : leurs sorties dans les arrêts. Un *À revoir* → rien au brouillon, mais « Ajouter une remarque au
  brouillon » et un verdict proposé (*Demander des changements*) ; un *Commenter*
  complété par le champ → une remarque, visible sous l'élément ; en retirer une ;
  *Poser une question à l'agent* → l'élément cité dans le champ, rien d'envoyé ; le 💬 du bloc
  *Attention* d'un cas → son texte dans la zone de commentaire de la carte,
  ouverte, ce qu'on y avait écrit gardé, rien au brouillon avant *Ajouter*.
  Étape PR : brouillon vide, *Publier la revue* grisé. *Publier la revue*
  (commenter) : la revue paraît sur la PR d'essai, telle quelle ; l'étape PR
  est faite ; la revue est marquée envoyée et *Publier la revue* grisé jusqu'à
  une remarque de plus ou un autre verdict. *S'assigner la PR* → le badge disparaît au relevé suivant, les
  actions de création reviennent ; *Me retirer de la PR* → relecteur de nouveau.
- **S-55** ⚙ → *Interface* → *Langue de l'interface* : *English* : l'écran, les
  boutons, les faits des étapes en anglais ; une action part en anglais
  (`/vibecoder:… en …`), l'agent répond en anglais tant que la langue des
  agents n'est pas réglée ; le fil et le champ restent en français ; un autre
  agent en VibeCoder aussi en anglais. *Langue de ce qu'écrivent les agents* :
  *Français* : l'écran reste en anglais, les actions partent avec `fr`. *Français*
  partout : retour.
- **S-72** ⚙ → *Actions* : le modèle de *Relire le diff* (opus · élevé) réglé sur
  *sonnet*, son effort sur *moyen* : le bouton dit « sonnet · moyen » ; l'action
  part avec `/vibecoder:relire--sonnet--medium` ;
  relancer l'appli, ouvrir un autre agent : le choix tient (`config.json`). Le
  conseillé et « effort du skill » : le choix disparaît. Aucune liste de Fable ;
  `"fable"` écrit à la main dans `actionModels` : l'action part sans lui.
- **S-56** Après quelques actions : 🕘 → l'historique à la place du fil,
  une ancienne session en lecture seule, *← Conversation en cours* → le fil,
  l'écran VibeCoder resté sur son étape.
- **S-57** ⚙ → *Agents* → *Dossier de VibeCoder* : le
  dossier s'ouvre. Changer un libellé de `actions.fr.json` : le bouton
  change au relevé suivant ; `model: haiku` dans un skill : son bouton dit
  « haiku ». Relancer l'appli (ou une nouvelle version) : les retouches
  restent. Supprimer le fichier, relancer : il revient tel que livré.
  `actions.fr.json` cassé : les boutons d'origine.
- **S-58** Mode manuel : *Lancer les vérifications*, puis un autre agent
  affiché ; à la demande d'autorisation, le « ? » sur son robot ; retour sur
  lui : la demande dans la colonne de la conversation, le
  bouton principal disant « L'agent attend votre autorisation… ».
- **S-59** Une PR déjà fusionnée : *Charger la PR* → sa fiche, son état ; pas
  de badge *Relecteur* ni de bandeau (sans PR ouverte, on est créateur).
- **S-60** Relecteur : la bulle d'un constat de la relecture du code, à l'arrêt Publier → une zone de remarque déjà remplie avec le constat : y dicter, la dictée s'y insère (pas dans le champ de la conversation) ; *Ajouter* → la remarque au brouillon, sur ce constat ; *Annuler* → rien. Un champ d'une ligne (recherche de branche) a le clavier : la dictée va au champ de la conversation. *Ouvrir dans l'éditeur* sur un test d'invariant : le fichier, à la ligne du cas (zed, code).
- **S-61** *Lire en pseudo-code* (*Relire le code*) sur un skill
  `sonnet · moyen` (`opus · élevé`) : choisir *haiku* → le message part en
  `/vibecoder:lire-invariants--haiku …` (le fil le montre). Les lectures sont en anglais, en *FR* comme en *EN*.
- **S-62** L'agent travaille sur un skill : *⏹ Arrêter* → le tour s'arrête
  comme par *Interrompre* (« Interrompu. »), les boutons se rallument.
- **S-63** Pas de carte « Prochaine étape » : ni le créateur ni le relecteur n'ont de bouton d'étape depuis la 0.16.0 (S-79, S-80) ; aucun champ dessous (la demande se dicte dans celui de la conversation). La vue des branches, *Revenir sur la
  branche principale* → le dossier sur la base, plus de badge *Relecteur*. Une commande en
  arrière-plan : *⚙ Tâches* → l'onglet *Tâches (1)* à droite ;
  *Conversation* → le fil, à sa place.
- **S-64** Relecteur sur gt-plugins (`.vibecoder/project.json` avec son
  `worktree`), une PR chargée : *Changer de branche* et *Dans un nouveau
  worktree* ; un fichier modifié dans le dossier → *Changer de branche*
  grisé « Des modifications en cours », *Mettre de côté* en plus ; *Mettre
  de côté* → le dossier propre, toujours sur sa branche, *Changer de
  branche* → le dossier sur la branche de la PR, sans agent ni jeton.
  *Dans un nouveau worktree* → « Création du worktree en cours… », le worktree dans
  `gt-plugins-worktrees/pr-<n>`, `yarn install` fait (`recipe.log`) ; la
  question de confiance (« PR #n dans un worktree », ses réglages
  `.claude`) ; *Annuler* → pas de robot, *Ajouter le robot PR #n* ; accepter
  → le robot « PR #n », *Aller au robot PR #n* → son VibeCoder en relecteur,
  la PR chargée, le badge « PR #n · worktree ». Un fichier modifié dans le
  worktree : *Retirer le worktree* → refusé, la raison sous le bouton, le
  robot reste ; sans modification → le worktree retiré, le robot parti, le
  panneau sur l'agent du dépôt, le brouillon de revue là. *Nouvelle
  demande*, une demande dans le champ, un fichier modifié → la branche
  nommée (haiku) et ses choix ; *Dans un nouveau worktree* → le worktree
  créé, la question de confiance, l'enfant en créateur qui rédige la note ;
  le parent reste sur sa branche. Clic droit → *Ouvrir un terminal
  ici* → konsole dans le dossier de l'agent.
- **S-65** gt-plugins en VibeCoder, appli sur l'hôte, `agentCommand`
  `distrobox enter dev -- …` : onglet *Processus* → « Aucune commande »,
  *Proposer les commandes* (haiku) → la commande `gear` (la fonction du
  `.bashrc`), `setup` et `worktree` dans `.vibecoder/project.json`,
  `.vibecoder/` dans `.git/info/exclude` (`git status` n'en dit rien). ▶ → point vert, « depuis 5 s »,
  le journal de process-compose défile ; *Processus (1)* dans l'onglet.
  L'agent, prié de relancer le serveur, lance `vibecoder proc restart gear` → le journal
  repart. *Arrêter* → arrêtée, plus aucun processus de process-compose dans la box
  (`pgrep -f process-compose`). *Lancer* puis quitter l'appli → rien ne reste, ni
  sur l'hôte ni dans la box. Un `sleep 1000` lancé à la main dans la box
  survit à *Arrêter* et à la sortie. *Modifier les commandes* → le fichier dans
  l'éditeur ; une commande renommée → l'ancienne, si elle tournait, arrêtée.
- **S-66** Même appli sur l'hôte (sans gh), gh dans la box : Créateur sur une
  branche qui a sa PR, sans `pr.json` → l'étape **PR** faite en quelques
  secondes, la carte de la PR (numéro, titre, base ← branche) ; une PR
  ouverte entre-temps sur GitHub → visible dans la minute, ou aussitôt par ↻.
  La vue des branches : ses trois listes de PR, sans message à l'agent ; la PR
  chargée fusionnée sur GitHub → son état fusionné dans la minute, créateur. `vibeCommandPrefix` faux (`nexiste-pas`) → rien ne s'affiche de
  GitHub, rien ne bloque. *Code* sur un test Rust et un test TypeScript →
  colorés (attributs, macros, chaînes brutes ; mots-clés, chaînes…).
- **S-67** Actions directes (F-114), appli sur l'hôte, gh dans la box :
  *Préparer le commit*, puis *✓ Commiter* « direct » → « … », puis ✓ et
  « [branche abc1234] sujet » sous le bouton, le commit dans `git log`,
  `commit.md` parti, aucun message à l'agent ; rien d'indexé → ✗ et la raison,
  `commit.md` reste ; *via* → le skill dans le fil. Relecteur : un numéro,
  *Charger* → `pr-<n>.json` et `origin/<tête>`, copie de travail
  inchangée ; *Publier la revue* → la revue sur la PR d'essai. *PR mergée →
  revenir sur la base* sur une PR ouverte → ✗ « … OPEN, not merged: nothing
  done. », rien ne bouge ; fusionnée → sur la base, à jour, branche locale
  supprimée. `direct.log` : une ligne par commande.
- **S-68** Courses (F-115), une branche de ticket : à l'étape
  **Forme**, un brouillon dans le champ de la conversation, *Poser la forme* →
  elle part sans lui, le brouillon reste ; « en cours » et *Arrêter* à côté du
  bouton, *Actions (1)* ; pendant ce temps, une question dans le champ de la
  conversation → l'agent répond. *Écrire
  les invariants (rouges)* grisé « Une autre action est en cours » ; à
  l'étape Revue, *Lancer les vérifications et la ponytail review* grisé
  « Une action modifie la branche ».
  *Arrêter* → *arrêtée — à garder ou annuler*, les autres toujours grisées ;
  *Annuler* → la note revient telle qu'avant la course (`git diff` vide sur
  ce qu'elle avait touché), un autre fichier modifié à la main pendant ce
  temps reste modifié, *annulée*, les boutons se libèrent. Relancée puis *Garder*
  → ses changements restent. *Lancer les vérifications et la ponytail
  review* → deux lignes *en cours* (la ponytail review demandée par la
  course des vérifications). Une course finie → une ligne
  « VibeCoder : « … » finie — … » dans le fil (après le tour en cours de la
  conversation, s'il y en a un) ; une course arrêtée → aucune. Mode
  *manuel* : la course ne demande rien (mode `dontAsk`, I-57) ; ce que sa
  liste de refus touche est refusé, la ligne en tête de sa réponse le cite, la
  course finit *terminée* si son travail l'est. *Nouvelle session* → l'onglet se
  vide.
- **S-69** L'orchestrateur (F-115, F-103) : « Lance la relecture du diff »
  → `vibecoder run start review-diff`, la course part (onglet *Actions*), l'avis
  de fin arrive ; « où en sont les actions ? » → il lit `vibecoder run list` et répond.
  Pendant *Poser la forme* (clic), « lance les vérifications » → la CLI répond
  *en attente* (`queued`, l'action qui retient ; `run list` : état `queued`), puis
  la demande part d'elle-même à la fin de la forme, sans qu'on redemande ; un refus
  (action inconnue) arrive tout de suite, code de sortie 1. « Arrête-la » →
  `run stop`, *arrêtée*, pas d'avis de fin. Hors du moteur, sans rien demander :
  il ne lance rien. Une petite demande, *Rédiger la note* → la note et ses
  questions, sans orchestrateur, pas de bouton du moteur tant qu'une question est
  ouverte ni avant *Valider la note* ; validée, le moteur part seul (fil d'Ariane)
  → *Arrêter* à sa place, le même écran, les actions s'enchaînent une à une
  dans l'onglet *Actions* (forme, invariants, …), la conversation libre
  entre deux, aucune question de la note tranchée par l'agent ; *Arrêter* sur l'une
  d'elles → elle attend *Garder* / *Annuler*, l'orchestrateur ne tranche
  pas. Une question qui bloque → *Arrêter* reste ; les réponses envoyées,
  il reprend seul. *Arrêter* → le bouton dit *Reprendre*, la course en cours finit, la suivante
  ne part pas (« VibeCoder : demande … refusée — le mode Vibe a été
  arrêté… ») ; les étapes passées gardent leur ✓. *Reprendre* → le moteur repart. Relancer l'appli
  pendant qu'il enchaîne → elle repart sans lui : *Reprendre*, il ne repart pas seul.
- **S-70** Le parcours guidé, une branche sans note : en-tête sans
  bascule de mode, le bouton du moteur (*Reprendre*) grisé dans le fil d'Ariane, « Pas encore de note » au
  survol (absent en relecteur) ; pas
  d'onglets d'étapes ; le fil d'Ariane ouvre n'importe quelle étape (F-92), la
  Note comme les autres, sans rien lancer ni écrire, Ctrl+3 ouvre la troisième ;
  les boutons qui ont besoin d'une étape précédente faite restent grisés, avec
  leur raison. Plus loin : ni *Vérifier
  l'alignement* ni *Ponytail review* ; *✓ Commiter* seulement un commit
  préparé ; l'étape PR sans PR : *Valider la feature* seule ; la PR ouverte :
  *Diagnostiquer la CI* ; fusionnée : *PR mergée →
  revenir sur la base*.
- **S-71** La vue des branches : *Branches locales*, un clic sur une autre
  branche → le dossier y passe (une modification en cours : grisé, *Mettre
  de côté* à côté). *Créer une branche* `feat/essai`, départ par défaut,
  *Créer ici* → `⎇ feat/essai`, rien d'autre ne part. Une PR dont
  `origin/<tête>` a avancé (poussée d'ailleurs), *Actualiser* → *Pull*
  actif ; *Pull* (une modification en cours) → à jour, la modification
  toujours là, *Pull* grisé. `origin/<base>` avancé → la pastille sur
  *Rebase* ; *Rebase* → réussi, *Pousser* apparaît ; *Pousser* → poussé
  (`--force-with-lease`). Un rebase en conflit → ✗, `git status` : pas de
  rebase en cours, la branche et ses modifications intactes, pas de
  *Pousser*.
- **S-72** Un service annexe en panne ne bloque rien : le journal inaccessible,
  `wpctl` ou l'éditeur introuvables ou en échec, Pocket TTS absent, git, `gh`
  ou un fichier de VibeCoder illisibles → l'erreur est dite ou journalisée, la
  dictée et les agents continuent, le relevé part quand même.
- **S-73** La part du développeur et celle de l'IA (0.15.0) : une note écrite,
  sans question → *Vérifier* → la vérification de conception tourne, le
  bouton reste, rien n'est validé ; sans suggestion → *Valider la note* apparaît,
  la note n'est pas validée et le moteur ne part pas ; avec des
  suggestions → elles sont dans le questionnaire, pas de *Valider la note* ; les
  réponses envoyées → *Vérifier* de nouveau (0.16.0 : un geste à part de *Valider
  la note*, qui ne lance jamais de vérification) ; un
  second clic pendant la vérification n'efface pas le premier. La note modifiée
  après une vérification sans rien de bloquant → *Valider la note* reste, *Vérifier*
  à côté, et l'écran dit « modifiée depuis la vérification » ; *Valider la note* →
  validée, le moteur part. Après la validation,
  aucune action ne change « Ce que ça fait », « Ce que ça ne doit pas faire »
  ni une étiquette. *Poser la forme* → les squelettes compilent, *Générer les
  modules* reste proposé (un squelette n'est pas un module commencé) ;
  l'alignement des invariants corrige seul, 3 tours au plus, sans être relancé
  à la main. *Générer ce module* → relu et corrigé dans la même course, plus de
  *Relire le diff* en seconde course. `ponytail.md`, `align.md` : chaque ligne
  porte `[toi]` ou `[agent]`, et l'adresse d'une remarque s'ouvre toujours.

- **S-74** L'écran de la part humain / IA (0.15.0 ; le créateur n'a plus ce décor depuis la 0.16.0, S-79 ; le relecteur le garde) : l'étape Invariants montre
  l'arborescence de la Forme, ses fichiers grisés, et les tests en avant (vert
  ajouté, jaune modifié, d'après la base de la branche, commités ou non) ; un
  fichier de la Forme pas encore écrit montre son contrat, en lecture seule ;
  un cas lu montre la ligne « → invariant » qu'il garde, un clic va à l'étape
  Note sur cette ligne, mise en évidence (rendu, éditeur, Brut). `ponytail.md`,
  `align.md`, `ci.md` : badges *pour toi* / *pour l'agent*, les lignes `[agent]`
  grisées, un échec gardant sa marque. Le questionnaire : badges *important* /
  *secondaire*, réponses en trois parties (le texte cité en couleur), pas
  d'*Envoyer* dans le champ d'une question, le micro gardé. L'étape Note : le
  badge `variant` plus clair que `invariant` ; *Vérifier* (neutre), *en cours* /
  *en attente* à côté, et *Valider la note* (ou *Revalider*) après une vérification
  sans rien de bloquant (0.16.0) ; plusieurs messages à l'agent
  sans *Vu* → le surlignage s'accumule, *Vu* ou la validation de la note le remettent à zéro ;
  une ligne retirée s'affiche à sa place, barrée en rouge, sans 💬 ni remarque, et
  disparaît de même ; *Voir les modifications* reste le diff brut. Les en-têtes
  des étapes sans doublon (« 3 fichiers · 21 cas · 0 validé · 18 à lire » sous la
  barre des Invariants, plus rien à côté du titre), l'infobulle du fil d'Ariane
  entière.
- **S-75** Les courses fiables et cantonnées (0.15.0) : l'agent principal en
  *Manuel* ; *Poser la forme*, *Générer les modules*, *Lancer les vérifications*
  → aucune demande d'autorisation, l'onglet *Actions* n'en montre plus ;
  *Vibe* lancé → ses appels de `vibecoder` passent sans demande, Vibe arrêté →
  ils sont demandés. Une course qui tente d'écrire `AGENTS.md`, `package.json`,
  `.git/` ou `.husky/`, ou hors du projet et des sorties → l'appel est refusé,
  la ligne en tête de la réponse le cite (un `Read` aussi), la course finit
  *terminée* si son travail l'est. Pendant
  *Générer les modules*, un développeur relancé par l'orchestrateur → la course
  reste *en cours* jusqu'à sa réponse relue. Une commande du projet, enchaînée
  (`cd frontend && npm test`) ou non, passe derrière le préfixe ; `git push` est
  refusé, seul ou derrière lui, sauf pour *Valider la feature*. *Release candidate*
  et *Release officielle* n'apparaissent plus à l'étape PR. *Vérifier* une note
  sans changement → « rien de bloquant ».
- **S-76** Des droits d'actions souples (0.15.0) : sur un projet dont l'`AGENTS.md`
  écrit `cd frontend && npm test` ou `cargo build && cargo test` → *Générer les
  modules* lance ces commandes sans refus ; une course qui tente `git push`,
  `gh pr merge`, `npm install`, `rm -rf` ou `timeout 60 git push` → refusé, cité
  en tête de sa réponse, la course finit *terminée* ; *Créer la PR* pousse et
  ouvre la PR, mais ne fusionne jamais ; *Publier la revue* n'appelle plus
  `gh api`. *Lancer les vérifications* → la ponytail review part avec elles,
  lancée par l'appli. Une course qui écrit sans fin dans son dossier temporaire
  → arrêtée au-delà de 1 Go, la ligne en tête le dit ; à la fin de toute course,
  son dossier temporaire (sous les sorties de l'agent) n'existe plus.
- **S-77** L'écran épuré (0.15.0) : les étapes Note, Forme et Invariants n'ont
  plus de zone de prompt ; *Rédiger la note* prend sa demande dans le champ de la
  conversation, ses pièces jointes comprises (champ vide → le message, le champ
  prend le clavier) ; l'en-tête d'une étape ne répète plus ce qu'elle montre en
  dessous (Invariants : la ligne sous la barre donne aussi le nombre de
  fichiers). La note changée depuis la référence, sans *Vu* : ses passages
  supprimés s'affichent, barrés en rouge, juste avant le bloc qui les suit
  (deux lignes retirées séparées, un élément de liste retiré comme un élément),
  sans 💬 ni pastille ; les ajouts en vert, comme avant ; *Vu* efface les deux.
- **S-78** Le contrôle en trois points (0.16.0) : une note vérifiée sans rien de
  bloquant, puis validée (*Vérifier*, puis *Valider la note*, deux gestes) → le moteur
  part seul, le bouton à côté de la ligne d'état dit *Arrêter* (plus de bouton *Vibe*) ; au
  rythme par défaut, il s'arrête après les invariants (*Reprendre*, la ligne dit
  quoi regarder), puis après les modules, avant la revue ; *Express* allumé à une
  pause → il repart sans autre clic et ne s'arrête plus jusqu'à la PR ; l'appli
  relancée → le rythme par défaut, rien d'écrit dans les réglages, le moteur arrêté
  (*Reprendre*, il ne repart pas seul). Le ✓ de la Forme retiré à la main (un clic sur le badge de l'étape) → le
  système ne le remet pas, ni ceux des étapes qui suivent ; l'appli relancée, il tient toujours ; le contenu de l'étape changé,
  ou l'étape revalidée à la main → le retrait est oublié ; tant qu'il tient, le
  moteur s'arrête, en express aussi, la ligne d'état nomme la Forme et pas de
  *Reprendre* ; le retrait oublié → *Reprendre* revient. *Prouver les invariants* → `preuve.md`,
  une rubrique par ligne « → invariant » ; une rubrique `[toi]` → l'étape Modules
  pas faite, les modules refusés à `step.validate`, en express aussi ; un fichier
  copié dans le projet pendant la preuve → échec, fichier nommé, `preuve.md`
  effacée. La note validée puis un « Accepter » écrit tel quel → son ✓ reste ; une
  réponse libre ou une autre retouche → son ✓ tombe, en express aussi. *Vérifier
  l'alignement* ne peut pas écrire dans un test d'invariant d'avant la branche.
  *Relire le diff* reste lançable, jamais en tête ; *Lire en pseudo-code* part seul,
  lancé par le moteur après l'écriture des tests d'invariants.
- **S-79** L'écran de l'essentiel (0.16.0, créateur) : sous le fil d'Ariane, une seule
  ligne dit où l'on en est (« Demandez la note à l'agent, dans la conversation »,
  « Vérifiez, puis validez la note », « Regardez vos règles, puis reprenez », « Essayez
  l'appli, puis reprenez », « La PR est verte : à vous de la fusionner »), le bouton du
  moteur à côté ; plus de « N commits » au fil ; aucun bouton d'action dans les
  étapes (la note garde *Vérifier*, *Valider la note*, le questionnaire), et chaque
  action reste lançable par l'agent (CLI). La Forme : une ligne par module, son
  chemin et une phrase, ni arbre ni diff. Les Invariants : une règle par ligne
  « → invariant » de la note, son état (*écrite*, *prouvée*, *non prouvée*), ses
  tests en pseudo-code dessous (lu par le moteur), « aucun test » pour une ligne
  sans test, « Autres tests » pour les tests sans ligne, les écarts `[toi]` de
  l'alignement en avant. Les Modules : une ligne d'état (« 16 modules écrits ·
  commités »), un arbre, le diff depuis la base en ligne, rien à modifier ni à
  enregistrer, *Ouvrir dans l'éditeur* en icône ; après une correction,
  « modifiée depuis la validation » bascule sur le diff depuis le ✓, et revient. La
  Revue : une carte (une ligne par vérification en échec, les `[toi]` en avant, les
  `[agent]` repliées sous leur nombre). La PR : sa carte et l'état de la CI. Le badge
  d'une étape validée dit « faite ✓ » et se clique, à la Forme, aux Invariants et
  aux Modules, pour retirer le ✓ (« faite · ✓ retiré », la ligne le nomme) puis le
  rendre ; une étape faite que le système n'a pas validée : badge sans ✓ ni clic. Le relecteur d'une PR : S-80.
- **S-80** La revue essentielle (0.16.0, relecteur) : sous un fil de quatre arrêts (« Note », « Règles », « Essai », « Publier »), une ligne dit où l'on en est (« Choisissez la PR à relire », « Préparez la revue », « Lisez la note, puis jugez-la », « 3 tests à juger », « Publiez la revue ») et, à côté, *Préparer la revue*. Charger ou ouvrir une PR ne lance rien. *Préparer la revue* → cinq demandes, dans l'ordre (note, pseudo-code, alignement, relecture du code, plan de test) ; une fois finies, un second clic : grisé, rien à lancer ; un commit de plus sur la PR → il ne relance que les lectures marquées à l'ancienne tête. Aux Règles : une règle par ligne « → invariant », ses tests en pseudo-code, *Validé* / *À revoir*, ni preuve ni bouton de lecture ; un test d'avant la branche que la PR modifie le dit. À l'Essai : le plan et ses cases. À Publier : les constats de la relecture du code, chacun avec sa bulle, puis le brouillon, le verdict et *Publier la revue*. Ni Forme, ni Modules, ni « N commits », ni carte de commit.
---

## 14. Limites connues

- Windows : agents et VibeCoder non essayés.
- Windows : `code` est un `code.cmd`, qu'on ne lance pas sans shell ; régler
  `editorCommand` sur le chemin de `Code.exe`.
- Un processus Claude Code par agent utilisé depuis le lancement (quelques
  centaines de Mo chacun), jusqu'à *Nouvelle session*, *Retirer* ou la sortie ;
  et un par course de VibeCoder en cours ou arrêtée (F-115).
- Les tâches de fond d'un lancement précédent de l'appli ne sont pas
  montrées (le volet lit le flux du processus, pas la transcription).
- Le renommage d'un agent passe par `config.json`.
- VibeCoder suppose le dossier de l'agent à la racine de son dépôt : dans un
  sous-dossier, git donne les chemins depuis la racine, lus depuis le
  dossier de l'agent — note et tests introuvables.
- VibeCoder : les sorties suivent la branche au relevé (F-95) : ce
  qu'un skill écrit juste après avoir quitté une feature pour une autre, avant
  que le relevé le voie, est mis de côté avec la feature quittée. La note
  n'est trouvée que si la branche porte le ticket ou la version et change la
  note. Les sorties des branches finies restent dans
  `vibecoder-out/<agent>/branches/` ; les modifications mises de côté, dans
  `git stash list`. Une PR venue d'un fork ne se charge pas (sa branche
  n'est pas sur `origin`).
- VibeCoder : chaque lecture ou relecture par un skill se paie. En
  sous-contexte, ≈ 0,02 $ sur Haiku (≈ 25 000 jetons : le prompt de Claude
  Code et le skill ; SDK 0.3.285, Claude Code 2.1.285), quelle que soit la
  longueur de la conversation, bien davantage sur Opus à effort élevé ;
  *Générer les modules*, le moteur, les releases : longs et
  coûteux. Une lecture d'invariants n'est refaite que si le fichier change.
  Choisir un modèle plus léger pour une étape coûte moins, au prix de la
  qualité (`lire-invariants` sur Haiku a été écarté par le banc, F-106).
- VibeCoder : les fichiers écrits pour être ouverts
  (`vibecoder-out/<agent>/files/`) restent jusqu'au suivant du même nom ; un
  fichier d'un commit s'ouvre, en relecteur, dans sa version à la tête de la
  PR (supprimé depuis : rien ne s'ouvre).
- VibeCoder : le relevé lance quelques git en lecture toutes les 4 s
  (panneau visible) et jusqu'à une fois par seconde pendant un tour
  (`git status` : 63 ms sur GT-2020, 1 761 fichiers suivis).
- VibeCoder, agents extérieurs (F-116) : `live.json` est lisible par tout
  programme de la machine, et le jeton extérieur y est tant que le réglage est
  activé : activer, c'est permettre à tout programme de l'utilisateur de piloter
  le robot du dossier d'où il appelle (pas les réglages ni les autorisations). Un
  dossier sans robot est refusé (« aucun robot ici ») : la CLI n'ouvre pas de
  robot.
- VibeCoder : la note se lit par ses titres (guide, A.1) ; une note qui ne
  les suit pas laisse ses étapes vides.
- VibeCoder : seuls ses libellés passent en anglais ; la conversation (fil,
  champ, volet des tâches, détail du contexte), les menus et les messages de
  l'appli restent en français.
- VibeCoder : les images d'un Markdown (un message de l'agent aussi, F-66) ne sont pas montrées (leur texte
  reste, en lien s'il est en `http(s)`) ; une revue de PR est un commentaire d'ensemble, pas de
  commentaire sur une ligne du diff.
- Familles (F-51) : une copie principale dont le `.git` est un lien, ou
  créée avec `--separate-git-dir`, n'est pas reconnue comme telle : son
  agent n'a ni famille ni sous-menu *Worktrees*.
- VibeCoder, *Changer de branche ou un nouveau worktree* (F-110) : le robot d'une PR dont la
  fiche disparaît d'ailleurs (supprimée à la main) part au relevé, donc
  VibeCoder affiché ; l'attente du robot est en mémoire — après un
  redémarrage, *Ajouter le robot PR #n*. Les validations faites sur le robot
  partent avec lui (son brouillon de revue, lui, revient). La demande d'une
  nouvelle demande est en mémoire : l'appli relancée avant un choix, la
  branche nommée est jetée, rien n'est créé (la redemander). *Mettre de
  côté* ne reprend rien : `git stash pop` à la main. *Retirer* le robot (clic droit) laisse
  le worktree sur le disque (`git worktree remove` à la main).
- VibeCoder, la recette (F-111) : une commande qui pose une question au
  clavier (le y/N de `cleanup-worktree`) lit une fin de fichier et échoue
  (sa dernière ligne affichée) ; la répondre d'avance dans le fichier du
  projet (`yes | …`, une option du script). 15 min au plus par étape : une
  installation plus longue échoue. `.vibecoder/` n'est exclu de git que dans la copie principale dont
  `.git` est un dossier ; ailleurs, `git status` le montre (l'ajouter à
  `.gitignore` ou à l'exclusion à la main). L'ancien
  `userData/vibecoder/projets/<dossier>.json` reste, sans effet une fois
  copié.
- *Ouvrir un terminal ici* (F-56) : le terminal tourne là où tourne l'appli
  (l'hôte, pour l'AppImage) ; pour arriver dans une box, la mettre dans
  `terminalCommand` (`konsole --workdir {dir} -e distrobox enter dev`).
  Windows : `wt`, sinon `cmd`, non essayés ; un terminal hors de la liste
  (Flatpak…) : par `terminalCommand`.
- VibeCoder, *Processus* (F-111) : l'adoption d'une proposition se fait
  au relevé, donc VibeCoder affiché (les demandes de l'agent, `vibecoder proc`, sont
  immédiates) ; l'appli tuée net (crash, `kill -9`) laisse tourner ce qu'elle a
  lancé ; `bash -i` ignore SIGTERM : une boucle (`while :; do …; done`)
  n'est arrêtée que par le SIGKILL, après 5 s. Ailleurs que sous Linux, pas
  de jeton (pas de `/proc`) : seul le groupe est arrêté ; Windows :
  `taskkill /T /F`, sans box, non essayé.
- VibeCoder, actions directes (F-114) : git et gh y passent tous deux par le
  préfixe (la box) ; sans préfixe (ni réglage, ni box dans `agentCommand`),
  ils tournent là où tourne l'appli. Le
  dernier résultat ne survit pas à la sortie de l'appli (`direct.log`, si) ;
  `pr-<n>-review.json` porte le lien de la PR, pas celui de la revue.
- VibeCoder, courses (F-115) : *Annuler* ne ramène que ce que les outils
  d'édition de Claude Code ont écrit (Write, Edit…) ; ce qu'une course a
  changé par une commande (`git`, `sed`, un script, `npm install`) reste. Le
  suivi des fichiers passe par une variable d'environnement que le SDK pose
  pour Claude Code : lancé par une commande enveloppe (`distrobox enter …
  --`), il faut qu'elle traverse jusqu'à lui, sinon *Annuler* échoue (la
  course passe *en échec*, avec la raison). *Annuler* a besoin du processus
  de la course : si Claude Code n'a pas obéi à l'arrêt en 5 s, il est tué
  (F-59) et *Annuler* échoue de même. Les courses, et la
  session de la note que reprend *Envoyer les réponses*, sont en mémoire :
  après un redémarrage de l'appli, l'onglet *Actions* est vide et les
  réponses partent dans une nouvelle conversation. Les demandes de
  l'orchestrateur ne sont lues qu'une fois VibeCoder affiché (au moins un
  relevé).
- VibeCoder, GitHub sans IA (F-112), coloration (F-113) : un échec de gh (pas connecté, pas
  d'origine GitHub, box absente) ne se dit pas ; les listes de PR de la vue
  des branches restent vides. Un extrait (*Code*, en relecteur) commencé dans un commentaire ou une
  chaîne se colore mal — le texte, lui, reste exact.

## 15. Décisions en attente

- **Autorisation qui affiche l'agent** : la fenêtre masquée, une demande
  d'autorisation la montre sur son agent, qui devient l'agent affiché (et
  sélectionné, F-54). Laissé tel quel : l'agent sélectionné est l'agent
  affiché depuis la 0.14.0.
- ***Répondre sans basculer*** (vue C) : répondre à un autre agent, ou à sa
  demande d'autorisation, depuis son robot, sans l'afficher ; demanderait
  deux canaux nouveaux (`conv:sendTo`, `conv:answer` par id d'agent). Reporté
  (note de la 0.14.0).
