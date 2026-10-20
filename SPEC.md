# Whisper — spécification de comportement

Comportement de l'appli (état de la **0.4.0**, inchangé en **0.5.0**, où les
pages et le principal passent en TypeScript, les pages en React ; corrections
de la **0.5.1** ; nouveautés de la **0.6.0** ; processus des agents refait et
volet des tâches de fond en **0.7.0** ; VibeCoder, le flow du guide en un
écran, en **0.8.0**) : ce qu'elle fait, ce qu'elle ne doit
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

| Fenêtre | Page (`src/renderer/`) | Pont | Focus | Rôle |
|---|---|---|---|---|
| **Icône** | `app/icon/` (`icon-app.tsx`) | `src/preload/icon.ts` | **jamais** (`focusable: false`) | geste, micro, lecteur audio, robots |
| **Bulle** | `app/bubble/` (`bubble-app.tsx`) | `src/preload/bubble.ts` | **jamais** | messages de l'appli, curseur du volume |
| **Panneau** | `app/panel/` (`panel-app.tsx`) | `src/preload/panel.ts` | oui (on y écrit) ; jamais pris quand il s'ouvre de lui-même | conversation de l'agent sélectionné (champ de saisie), ou son écran VibeCoder (§ 7 bis), ou contexte « Dictée » |

Les pages sont en React + TypeScript, construites par Vite dans
`out/renderer/` et chargées en `file://`, rangées en `app/` (fenêtres),
`core/` (métier), `helpers/`, `technicals/` (ponts, micro, DOM). Le contrat
des ponts (types et canaux de chaque fenêtre) est dans `src/shared/bridge` ;
dans chaque page, seul le fichier `*-app.tsx` connaît son pont. Découpage et
règles : `AGENTS.md`, `docs/tickets/refactor/0.5.0-front-react.md` et
`0.5.0-main-typescript.md`.

VibeCoder dans le panneau (`docs/tickets/feat/0.8.0-vibecoder.md`) :

| Module (`src/renderer/`) | Rôle |
|---|---|
| `core/vibecoder` | pur : Markdown en blocs (jamais de HTML, liens `http(s)` seuls, I-40), lignes changées (`lineDiff`), coloration du pseudo-code et du code d'un test (`codeLines`, F-113), libellés FR et EN |
| `app/panel/vibecoder/` | l'écran (en-tête, parcours, vues des étapes, leur champ et leurs actions, écran *Vibe* et son fil d'Ariane, conversation, actions lancées, tâches et processus en onglets, barre des skills, barre d'état) ; ne connaît pas le pont : `panel-app.tsx` lui passe ses rappels et la colonne de la conversation |

Toutes : sans cadre, hors de la barre des tâches, `contextIsolation`,
`sandbox`, préchargement minimal (`contextBridge`). Le principal
(`src/main/`) est le seul à lire la config, toucher au presse-papiers, lancer
des processus.

### Modules du principal (`src/main/`, construit dans `out/main/`)

| Module | Rôle |
|---|---|
| `app/lifecycle` | démarrage (une instance, aucun agent sélectionné, permissions), sortie (dont les processus du projet, F-111) |
| `app/windows` | les trois fenêtres : créer, placer, montrer (icône, bulle, panneau) |
| `app/controllers` | dictée (coupures, transcription, destination, modèle), lecture, agents, contenu du panneau, VibeCoder (`vibecoder.ts` : relevé, actions, réglages, validations, brouillon de revue, fichier à ouvrir ; `processes.ts` : les commandes du projet, F-111 ; `runs.ts` : les courses — lancées, suivies, arrêtées, gardées ou annulées —, leur avis de fin à la conversation, les demandes de l'orchestrateur, `actions.json`, F-115) |
| `app/menus` | menus de l'icône, des robots, du « + », du trombone |
| `app/ipc` | une table de gestionnaires par fenêtre, écoutée par `technicals/ipc` |
| `core/config` | réglages, démarrage, dossiers favoris et couleurs, confiance |
| `core/dictation` | transcription d'une ligne, destination, collage et presse-papiers |
| `core/sound` | couper et rétablir ce qu'on a coupé |
| `core/agents` | processus (un par entrée : l'agent, et chaque course `<agent>~<clé>`, F-115), tours, retour en arrière des fichiers d'une entrée (`rewind`, I-45), tâches de fond, file d'autorisations, interruption, sonde, transcriptions, sessions |
| `core/conversation` | actions et demandes d'autorisation écrites, pièces jointes, tâches de fond vues par le volet |
| `core/guards` | permissions des pages, liens, fichiers montrés |
| `core/repo` | page GitHub d'un dossier, d'après son remote `origin` |
| `core/vibecoder` | VibeCoder sans Electron ni disque (passés) : la note lue par ses titres, les tests et leurs cas, un fichier ou un commit désigné par son id (`safePath`, `itemPath`, `itemCommit`), les actions et leurs messages (`parseActions`, `buildMessage`, `whoOf`, `forkedModel`), le parcours (`vibeView`), les sorties des skills, les fichiers par défaut (`syncDefaults`) et les variantes des skills (`skillVariants`), les validations et brouillons de revue, les courses (`runs` : `ownRun`, `runKey`, la règle `blockedBy`, `actions.json`, l'avis de fin, `parseRequest`, F-115) |
| `core/runner` | les commandes du projet (F-111) : le fichier du projet lu (`parseProject`), une commande par son rang (`commandAt` : shell du fichier, préfixe `commandPrefix` — celui du fichier, du réglage, ou la box de l'agent, le même pour `gh`), les demandes de l'agent (`requestsOf`), la fin d'un journal (I-42) |
| `technicals/process` | les processus lancés pour l'utilisateur : détachés, marqués dans leur environnement, arrêtés avec ce qu'ils ont lancé (SIGTERM, SIGKILL après 5 s), leur journal ; `writeNew` (I-43) |
| `technicals/git` | git en lecture seule (`gitRun`, `gitReader`, `GIT_READ`) : les faits d'une branche ou d'une PR chargée, un fichier à un ref, un commit et son diff (I-39) |
| `technicals/github` | gh en lecture seule, derrière le préfixe (`ghRun`, `githubReader`, `GH_READ`) : la PR d'une branche, les PR à relire, l'état d'une PR (F-112, I-39) |
| `technicals/direct` | les actions directes (F-114, I-39) : `directRunner` → `commit`, `publish`, `loadPr`, `toBase`, une liste fermée de commandes (`DIRECT_GIT`, `DIRECT_GH`), 60 s, `direct.log` |
| `technicals/*` | `ipc` (expéditeur contrôlé), `whisper-cli`, `paste`, `windows-helper`, `pipewire`, `clipboard`, `selection`, `pocket-tts`, `claude`, `editor` (un dossier, ou un fichier de VibeCoder, à une ligne), `journal`, `images`, `paths`, `config-file` |
| `helpers` | découper une commande, français ou anglais, une ligne, `async-queue` (l'entrée d'un processus d'agent) |

Scripts lancés par l'appli : `resources/scripts/` (`windows-helper.ps1`,
`pocket-helper.py`), livrés hors de l'archive comme les binaires. De même
`resources/vibecoder/` (`extraResources` → `vibecoder/`) : `README.md`,
`actions.fr.json`, `actions.en.json`, `plugin/` (`.claude-plugin/plugin.json`,
`skills/<nom>/SKILL.md`, `agents/developpeur.md`),
recopiés dans `userData/vibecoder/` (F-107).

### Canaux IPC

Vers le principal :

- icône : `win:getBounds`, `win:setPosition`, `win:savePosition`, `config:get`,
  `config:setDevice`, `dictation:warmUp`, `dictation:recording`,
  `dictation:transcribe`, `tts:speak`, `tts:cancel`, `tts:warmUp`,
  `menu:open`, `agent:click`, `agent:menu`, `agent:add` ;
- bulle : `bubble:ready`, `bubble:hover`, `bubble:close`, `bubble:volume` ;
- panneau : `conv:ready`, `conv:thread`←, `conv:mode`, `conv:height`,
  `conv:hide`, `conv:send`, `conv:attach`, `conv:answer`, `conv:speak`,
  `conv:probe`, `conv:history`, `conv:open`, `conv:current`, `conv:resume`,
  `conv:copy`, `conv:openLink`, `conv:showFile` ; VibeCoder : `conv:vibeSet`
  (Créer / Relire, Guide / Vibe, PR suivie, langue, *Vu*, retour à la
  conversation, modèle, effort, mode, arrêter l'agent, le robot d'une PR dans
  son worktree), `conv:vibeMark` (✓, ✗
  ou oublier une cible), `conv:vibeDraft` (brouillon de revue : ajouter,
  modifier, retirer), `conv:vibeOpen` (un fichier ou un commit du relevé, par
  son id, et une ligne), `conv:vibeRefresh`, `conv:vibeProcess` (une
  commande du projet par son rang : lancer, arrêter, relancer, son journal ;
  ou le fichier du projet dans l'éditeur, F-111),
  `conv:vibeRun` (une action par son id et ses arguments — `direct` : par
  l'appli elle-même, F-114 —, avec réponse `{ ok, error }`),
  `conv:vibeRunOp` (une course par l'id de son action dans le dernier
  relevé : l'arrêter, la garder ou l'annuler, répondre à sa demande
  d'autorisation ; F-115).

Vers les pages : `tts:state`, `tts:chunk`, `tts:end`, `tts:speakReply`,
`agents:state` (icône) ; `bubble:show` (bulle) ; `conv:thread`, `conv:notice`,
`conv:dictation`, `conv:focusInput`, `conv:attached`, `conv:vibe` (le relevé de
l'agent affiché en VibeCoder, ou `null`) (panneau).

Chaque fenêtre n'est écoutée que sur ses propres canaux, et un message d'une
autre fenêtre est ignoré (`technicals/ipc`, cf. I-20). Aucun canal de
VibeCoder ne transporte un chemin ni un message tout fait : une action, un
fichier se désignent par leur id dans le dernier relevé (I-37, I-38).

### Fichiers de données (`userData`)

| Fichier | Contenu |
|---|---|
| `config.json` | réglages (§ 9), relu à chaque usage |
| `whisper/` | modèle téléchargé (et whisper-cli posé à la main) |
| `pocket-tts/` | Python, Pocket TTS, PyTorch installés par uv |
| `consigne-agents.md` | consigne ajoutée au prompt système des agents |
| `agents.log` (`.old`) | journal des agents, 1 Mo puis rotation |
| `vibecoder/` | ce que VibeCoder fait dire, à retoucher (F-107) : `actions.fr.json`, `actions.en.json`, `plugin/` (le plugin `vibecoder` : skills, agents ; `skills/<nom>--<modèle>/`, les variantes générées, F-106), `README.md` ; `.defaults.json`, le manifeste de ce que l'appli y a écrit ; `projets/<dossier>.json`, les commandes du projet d'un dossier (F-111), à l'utilisateur |
| `vibecoder-out/<agent>/` | les sorties des skills pour l'écran (F-95) ; `branches/<branche>/`, celles de *Créer* d'une branche quittée, et `.branche`, la dernière branche vue ; `files/`, ce que l'appli écrit pour l'ouvrir dans l'éditeur, en lecture seule (`pr-<n>/<chemin>`, `<hash>.diff`, F-101) ; `run/<nom>.log` (`.old`), les journaux des commandes du projet, et `run/<nom>.stop`, `.restart`, les demandes de l'agent (F-111) ; `direct.log`, une ligne par commande d'une action directe, et `pr-<n>-review-body.md`, le brouillon publié (F-114) ; `actions.json`, les courses pour l'orchestrateur, et `actions/<id>.start`, `.stop`, ses demandes (F-115) ; dossier de travail en plus de Claude Code (F-58) |
| `vibecoder-state.json` | validations (par agent) et brouillons de revue (par agent et par PR) |

En développement : `--user-data-dir=.data` (cf. LINUX_SETUP.md).

---

## 2. Icône et dictée

**F-1 Geste.** Un appui, deux gestes : au-delà de 5 px c'est un **glisser**
(déplace la fenêtre, position enregistrée au relâché) ; immobile 300 ms c'est
une **dictée**, qui dure jusqu'au relâché où que soit le curseur (capture du
pointeur). Un simple clic ne fait rien. Clic droit : le menu (§ 8), ou celui du
robot cliqué.

**F-2 Position.** Retenue (`pos`) ; ignorée si elle tombe hors de tout écran
(moniteur débranché) : coin bas-droit de l'écran principal. Taille `size`
(32–200, au démarrage). La fenêtre s'élargit des petits boutons accolés
(lecture, un par robot, « + »), de moitié plus petits.

**F-3 Enregistrement.** Au seuil de maintien : `dictation:recording(true)`
(coupures, § 4), puis ouverture du micro (`deviceId`, retrouvé par son nom
s'il a changé, sinon le micro par défaut), 16 kHz mono. **Bip aigu** (880 Hz)
une fois le micro réellement ouvert, **bip grave** (520 Hz) au relâché
(réglage `sound`). Relâcher pendant l'ouverture du micro annule proprement.
Plafond : 5 min moins 5 s, coupé automatiquement.

**F-4 Silence.** Moins de 0,4 s ou énergie maximale < 0,008 RMS : rien n'est
envoyé à whisper (« Aucune parole détectée. ») — whisper invente du texte sur
du silence.

**F-5 Transcription.** `whisper-cli` local (langue `lang`, vocabulaire
`vocabulary` ≤ 300 car. en prompt, threads = cœurs, ≤ 8), délai 120 s. Le
texte sort sur **une seule ligne**, sans marqueurs `[BLANK_AUDIO]`, `[Musique]`.
Erreurs : `notInstalled`, `badAudio`, `timeout`, `failed`, chacune avec son
message dans l'infobulle de l'icône (4 s).

**F-6 Où va le texte.**
1. Un agent est sélectionné et *Relire avant d'envoyer* (`agentReview`) est
   coché → le texte arrive dans le **champ de son panneau** (ouvert en réduit
   au besoin), à la suite du brouillon. Rien n'est collé.
2. Agent sélectionné, relecture décochée → **envoyé** à l'agent aussitôt ;
   agent occupé ou Claude introuvable → le texte va au presse-papiers, avec
   l'erreur.
3. Aucun agent → **collage** (§ 3), puis, si `showText`, le panneau dans son
   contexte « Dictée » (F-76), ouvert **après** le Ctrl+V et sans prendre le
   clavier.

**F-7 Infobulle de l'icône.** Au repos : à qui va la dictée (« Maintenir pour
parler à <agent> » ou au curseur). Après une dictée : « Ajouté au message
pour X. », « Envoyé à X. », « Texte dans le presse-papiers : Ctrl+V… »,
« Collage impossible… ». Couleur : liseré du micro à la couleur de l'agent
sélectionné.

**F-8 Modèle au premier lancement.** Si aucun modèle n'est trouvé (dossier de
l'appli, puis `resources/bin` du paquet, puis l'installation de Cockpit), le
modèle `ggml-large-v3-turbo-q5_0.bin` (548 Mo) est téléchargé dans
`whisper/` (fichier `.part` renommé à la fin, supprimé en cas d'échec).
Avancement dans la bulle et dans le menu ; dicter pendant le téléchargement
dit le pourcentage.

## 3. Collage et presse-papiers

**F-10 Collage automatique** (`autoPaste`, par défaut) : le presse-papiers est
photographié (texte, HTML, RTF, image), le texte y est mis, Ctrl+V simulé ; si
le collage a réussi, l'ancien contenu est **rendu 400 ms après** (l'application
cible lit le presse-papiers à son rythme).

**F-11 Collage raté** (aucun outil) : le texte **reste** dans le presse-papiers.

**F-12 Collage désactivé** : aucune touche simulée (sous KDE Wayland, chaque
injection demande une autorisation) ; le texte reste dans le presse-papiers.

**F-13 Linux** : sous Wayland, wtype puis ydotool puis xdotool ; sous X11,
xdotool. **Windows** : l'assistant PowerShell, démarré avec l'appli (~1 s de
démarrage payé une fois), relancé s'il meurt, 5 s de délai par commande.

## 4. Bulle

**F-20 Placement.** Au-dessus de l'icône, centrée sur le micro (en dessous si
le haut manque de place), dans la zone de travail de l'écran ; elle suit
l'icône au glisser. La croix la ferme ; masquée après 10 s, le survol suspend
le délai. Hauteur mesurée par la page, 40–240 px. Le texte dicté n'y va plus
(depuis la 0.4.0 : panneau, contexte « Dictée », F-76).

**F-21 Usages** : `notice` (« Micro Discord coupé », bordure Discord, effacée
dès la fin de l'enregistrement, ignorée si elle arrive après), `status`
(téléchargement, installation de Pocket TTS), `volume` (curseur 0–100 %,
appliqué aussitôt, y compris à une lecture en cours). Rien n'y est cliquable
ni copiable.

**F-22 Effacement.** Le début d'une dictée efface la bulle.

**F-23 Panneau ouvert** : la bulle ne s'affiche pas ; son message (notice,
status) va **en tête du panneau** (F-74). Seul le curseur du volume garde la
bulle.

## 5. Coupure du son pendant la dictée

**F-30 Micro Discord** (`discordMute`, Linux et Windows) : le **flux de
capture** de Discord (reconnu à son binaire ou à son identifiant Flatpak),
pas le micro du système ni le bouton muet de Discord. « Micro Discord coupé »
s'affiche une fois la coupure **confirmée** (relue), si l'on enregistre encore.

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

**F-34 Dépannage** (clic droit → *Rétablir le son et le micro Discord*,
Linux et Windows, grisé pendant une dictée) : rétablit ce que l'appli a
coupé, les applications « à rétablir », et tout flux encore coupé parmi la
lecture des autres applications et la capture de Discord. La bulle dit combien
de flux ont été remis en marche. Sous Windows : ce que l'assistant a coupé.

## 6. Lecture à voix haute

**F-40 Bouton ▶** accolé à l'icône (`speak` : `selection` — Linux, Windows —,
`clipboard`, ou `off` qui le masque). État relevé toutes les 500 ms et poussé
à l'icône seulement s'il change : actif, grisé (rien à lire, Pocket TTS
absent), masqué. Clic : lit ; pendant la lecture (■) : arrête. Le clic droit
reste possible sur un bouton grisé (`aria-disabled`, pas `disabled`).

**F-41 Sources.** Linux Wayland : `wl-paste` (celui de l'hôte dans une
distrobox), sélection primaire ; la sélection de remplissage de Klipper
(`KLIPPER_REFILL`) compte comme vide. Windows : Ctrl+C simulé à la lecture,
presse-papiers rendu ensuite ; le bouton ne peut savoir d'avance s'il y a une
sélection (toujours actif). Ailleurs : presse-papiers d'Electron. ≤ 1 Mo lu,
≤ 20 000 caractères lus.

**F-42 Pocket TTS.** Absent : installé au premier clic (ou par le menu) dans
`userData/pocket-tts` par `uv` (Python 3.12 géré, PyTorch processeur,
`pocket-tts==3.3.0`), cache supprimé après ; message dans la bulle. Une
installation de l'utilisateur (`uv tool install`) sert aussi.

**F-43 Processus Python permanent** : démarré au **survol** du bouton
(préchargement du modèle de la langue du texte), arrêté après 10 min sans
lecture. L'audio arrive par morceaux (PCM 16 bits) et se joue bout à bout ;
une lecture annulée ignore ses morceaux tardifs.

**F-44 Langue** : `speakLang` `auto` (français ou anglais, compté sur le
texte entier ; indécis → français), `fr`, `en`. Voix par langue
(`speakVoices`) : Estelle, Mary, Marius / Jane, Anna, Alba.

**F-45** Commencer une dictée **arrête** la lecture (sinon le micro la capte).

**F-46 Réponse d'un agent** : ▶ *Écouter* d'une réponse du panneau lit son
résumé audio par le même lecteur (le principal retient le texte, l'icône ne
reçoit que l'ordre `tts:speakReply`).

## 7. Agents Claude Code

### Robots, sélection, dossiers

**F-50 Activation** : *Afficher les agents* (`agentsEnabled`, désactivé par
défaut). Un robot par agent à droite de l'icône, puis « + ».

**F-51 Un agent = un dossier** (un seul agent par dossier) : `{ id, dir, name,
model, effort, mode, sessionId, contextWindow }`, et pour VibeCoder `view`,
`vibe`, `temp` (§ 9). Nom = nom du dossier, modifiable dans `config.json`.

**F-52 « + »** : *Nouvel agent dans un dossier favori* (dossiers déjà choisis
sans agent), *Choisir un autre dossier…*, *Oublier un dossier favori* ;
entrées grisées si Claude Code est introuvable. Un dossier **jamais choisi**
passe par la confirmation de confiance (I-31). Le nouvel agent est
sélectionné ; panneau ouvert, il y affiche sa conversation.

**F-53 Couleur par dossier** : tirée au hasard parmi 8 (de préférence une
couleur libre), enregistrée, gardée si l'agent est retiré puis recréé ;
modifiable au clic droit. Robot, liseré du micro, panneau la portent.

**F-54 Clic sur un robot**, panneau fermé : réponse non lue ou demande
d'autorisation → son panneau s'ouvre ; sinon la sélection bascule (second
clic : la dictée revient au curseur). Panneau ouvert : le robot affiche sa
conversation dans le panneau, ou son écran VibeCoder (F-91) (les robots
servent d'onglets) ; second clic sur
le robot affiché et sélectionné → désélection, le panneau passe au contexte
« Dictée ».

**F-55 État d'un robot** : clignote au travail ; pulse lentement au repos
tant qu'une tâche de fond tourne (titre « surveille N tâche(s) de fond »,
F-77) ; « ? » demande d'autorisation ;
pastille verte = réponse non lue (bip 660 Hz à l'arrivée) ; erreur. La réponse
de l'agent affiché dans le panneau est **lue d'office** (jamais de pastille).

**F-56 Clic droit sur un robot** : nom, dossier ; *Ouvrir sur GitHub —
propriétaire/dépôt* (remote `origin` du `.git` du dossier, lu à chaque clic
droit ; grisé sans origine GitHub) ; *Ouvrir dans l'éditeur (zed)*
(`editorCommand`, sinon le premier trouvé parmi zed, code, cursor, codium,
dans une nouvelle fenêtre ; grisé sans éditeur) ; *◧ Ouvrir VibeCoder*, ou,
l'agent y étant, *💬 Revenir à la conversation* (F-91) ; *✎ Écrire un message…*
(panneau + focus du champ) ; couleur du dossier ; modèle (défaut, fable, opus,
sonnet, haiku) ; effort (défaut, low → max) ; mode (manuel, accepter les
modifications, auto, plan) ; *Dernier échange* ; *⤢ Conversation complète* ;
*Interrompre* (au travail) ; *Nouvelle session* (oublie la session) ; *Retirer*
(le dossier reste favori).

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
`claude_code` + la consigne de `consigne-agents.md` ; le plugin `vibecoder`
(`userData/vibecoder/plugin`, s'il existe : F-105) et le dossier de sorties de
l'agent (`userData/vibecoder-out/<agent>`) en dossier de travail en plus
(`additionalDirectories`). Pour tous les agents de l'appli, en VibeCoder ou
non, à chaque tour comme à la sonde ; jamais aux sessions Claude Code
habituelles.

**F-59 Un processus Claude Code par agent** (un `query()`), lancé au premier
message et **gardé entre les tours** : les messages suivants passent par son
entrée. Le premier tour crée la session (retenue dans `sessionId`). Relancé,
session reprise, s'il est mort ou si le dossier, l'effort, la consigne,
`agentCommand`, les plugins ou les dossiers en plus ont changé (`launchKey`). Fermé à *Nouvelle session*, *Retirer*, *Reprendre*
une autre session et à la sortie (I-19, I-33). Une course de VibeCoder
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
chaque message ; absent → recréé par défaut ; vide → aucune consigne.

**F-61 Fin de tour** : demandes restées en attente refusées (« Tour
terminé ») ; erreurs traduites (« Interrompu. », trop d'étapes, erreur
d'exécution…) ; demandes d'autorisation en échec comptées et signalées par
⚠ dans la réponse et **ÉCHEC** dans le journal.

**F-62 Journal** (`agents.log`) : début et fin de chaque tour (durée), chaque
demande d'autorisation, sa réponse et son délai, annulations, interruptions
(forcées ou non), « processus lancé », « processus terminé ».

### Panneau de conversation

**F-63 Un seul panneau**, attaché à l'icône (centré sur le micro, au-dessus ou
en dessous selon la place, toujours à l'écran), qui **suit l'icône** au
glisser. Un contenu à la fois : la conversation de l'agent sélectionné (ou
son écran VibeCoder), ou, aucun ne l'étant, le contexte « Dictée » (F-76) —
jamais deux panneaux.
- **Réduit** (par défaut) : 560 px de large, à la hauteur de son contenu
  (160–560 px) — le dernier échange : votre dernier message et ce qui suit.
- **Agrandi** (⤢ ; ⤡ pour revenir) : tout le fil, ouvert en bas (sur le
  dernier échange), l'🕘 Historique ;
  redimensionnable par ses bords, taille retenue (`convSize`, défaut 720×700,
  au moins 380 px de large et 160 px de haut).
- **VibeCoder** (un agent en VibeCoder, F-91) : toujours agrandi, y compris
  ouvert de lui-même (dictée, demande d'autorisation) ; à sa taille à lui,
  retenue à part (`vibeSize`, défaut 1280×820, au moins 960×600 dans la place
  de l'écran).

**F-64 Croix** : le panneau est **réduit au sens du système** (minimize), pas
masqué — rouvert par un clic (`restore`, avec le clavier), il garde « sur
tous les bureaux » (Alt+F3 sous KDE). Rouvert **de lui-même** (dictée,
demande d'autorisation), il est masqué puis montré sans activation : il ne
prend pas le clavier (`restore` le prendrait, vérifié sous X11), revient sur
le bureau courant et oublie ce réglage. Réduit, il ne compte plus comme
ouvert : les notifications repassent par les robots et la bulle.

**F-65 En-tête** : pastille de couleur, intitulé de la conversation (celui de
Claude Code ; « Nouvelle conversation » sinon), nom et dossier, jauge du
contexte, *⚙ Tâches (n)* (n en cours ; caché si la conversation n'a jamais
eu de tâche, F-77), Historique (agrandi), ⤢/⤡, ×.

**F-66 Fil** : messages avec leur heure (date complète au survol) ; texte tel
quel, liens cliquables, blocs ``` en blocs de code ; pièces jointes de vos
messages (aperçus d'images ≤ 800 px, clic : en grand ; fichiers, clic : montrés
dans le gestionnaire de fichiers ; sélection jointe, à déplier) ; actions de
l'agent sur une ligne, chemins raccourcis (`/home/…` et `/var/home/…`) ;
au-delà de 6 actions, les dernières, le reste à déplier ; longues lignes
repliées. Commandes affichées telles quelles ; leur sortie et le résumé d'une
compaction en messages « système » ; les messages que Claude Code s'envoie
(notifications de tâches de fond) ne sont pas affichés (F-77). Au travail : trois points animés et temps
écoulé au bas du fil. Le fil reste en bas quand un message arrive, sauf si
l'on lit plus haut. Mis à jour au plus toutes les 800 ms pendant un tour.

**F-67 Historique** (agrandi) : sessions Claude Code du dossier (de l'appli et
d'un terminal ; pas des worktrees), par date ; une ancienne conversation
s'ouvre **en lecture seule** (pas de champ) ; *← Conversation en cours* ;
*Reprendre cette conversation* (impossible pendant un tour) en fait la session
de l'agent. Sessions retrouvées sous `/home/…` comme sous `/var/home/…`.

**F-68 Champ de saisie** (réduit et agrandi, conversation en cours seulement) :
Entrée envoie (le message s'affiche aussitôt dans le fil, avant que
Claude Code ne l'écrive dans sa transcription), Maj+Entrée va à la ligne ;
il grandit jusqu'à 160 px.
**Brouillon par conversation**, pièces jointes comprises, gardé quand on
change d'agent. Agent au travail : on écrit, on n'envoie pas (bouton grisé).
La dictée vers l'agent s'y ajoute (espace de séparation) et y met le focus.

**F-69 Pièces jointes** : glisser-déposer et Ctrl+V (images PNG, JPEG, GIF,
WebP envoyées en image ; autres fichiers par leur **chemin**, l'agent les lit
lui-même ; un fichier sans chemin est refusé) ; 📎 → *Images ou fichiers…*
(une image choisie part en image) et *Texte sélectionné* (Linux, aperçu dans
le menu). Images réduites à 1568 px, ≤ 3,75 Mo (PNG, sinon JPEG 85) ;
≤ 20 images, ≤ 50 fichiers, sélection ≤ 100 000 caractères. Le message
envoyé : le texte, puis la sélection balisée `<selection>`, puis la liste des
fichiers — le panneau les retrouve dans la transcription pour les afficher.

**F-70 Commandes « / »** : un champ qui commence par « / » (sans espace)
propose les commandes de l'agent (Claude Code, skills, projet), d'abord celles
qui commencent par la saisie ; flèches, Entrée ou Tab choisissent, Échap
ferme. Liste demandée une fois par dossier (sonde).

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
en attente ». Rien d'affiché à l'écran (ni panneau ni bulle) → le panneau
s'ouvre **en réduit, sans prendre le clavier** ; on lit autre chose → le « ? »
du robot attend.

**F-74 Message en tête du panneau** (panneau ouvert) : notices et messages
de l'appli (ceux-ci effacés après 10 s), croix pour fermer.

**F-76 Contexte « Dictée »** (aucun robot sélectionné) : le panneau, réduit,
titré « Dictée », montre le **dernier** texte dicté pour ailleurs, son heure
et **Copier** (le principal copie son propre texte, cf. I-3). Ni champ de
saisie, ni jauge, ni historique, ni ⤢. Pas de redirection vers un agent :
pour un robot oublié, on copie, on sélectionne le robot, on colle dans son
champ. Sans dictée encore : une indication. Il reste ouvert jusqu'à la croix
(la bulle disparaissait seule après 10 s).

**F-77 Volet des tâches** (*⚙ Tâches*, à droite du fil, conversation en
cours ; en VibeCoder, l'onglet Tâches de la colonne de droite, F-92) : les tâches de fond de l'agent comme Claude Code les montre
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

**F-75 Fenêtre** : au-dessus des autres (`onTop`), hors barre des tâches,
liens vers le navigateur seulement, jamais de navigation.

## 7 bis. VibeCoder

Notes des tickets : `docs/tickets/feat/0.8.0-vibecoder.md`,
`0.9.0-actions-independantes.md` (les courses), `0.9.0-parcours-guide.md`
(le parcours guidé, Guide et Vibe séparés) ; le guide :
`docs/dev_guide/guide-travail-dev-ia.html`.

### Ouvrir, l'écran

**F-90 VibeCoder** : un mode IDE par agent, qui rend graphique le flow du
guide « Développer avec l'IA » : *Créer* une feature sur la branche du dossier
de l'agent (note, forme, invariants, un commit par module, revue, PR, release
candidate) ou *Relire* une PR du dépôt. Chaque étape a ses boutons, qui
envoient à l'agent le message du guide, avec le skill et le modèle qu'il faut
(F-96, F-106).

**F-91 Ouvrir, revenir** : clic droit sur un robot → *◧ Ouvrir VibeCoder* ;
*💬 Revenir à la conversation* (même menu, ou 💬 de l'en-tête). La vue est
retenue par agent (`agents[].view`), d'un lancement à l'autre : un agent en
conversation, un autre en VibeCoder ; cliquer un robot montre la vue de cet
agent (F-54). Le choix ouvre le panneau sur l'agent, agrandi, avec le
clavier. VibeCoder montre la conversation **en cours** de l'agent (pas
d'🕘 Historique : on revient à la conversation pour le consulter). La vue
conversation des agents qui ne sont pas en VibeCoder ne change pas.

**F-92 L'écran** (le panneau agrandi, F-63 ; couleurs de Whisper, fond
`#171b24`, la couleur de l'agent en accent) :
- **en-tête** : pastille (animée au travail) et nom de l'agent (son dossier
  au survol), branche (`⎇`, sa base au survol) ; *Créer* / *Relire* ;
  *Guide* / *Vibe* ; *FR* / *EN* ; ↻ (relever maintenant) ; 💬 (revenir à la
  conversation) ; × (la croix du panneau, F-64) ;
- à gauche, le **parcours** : les étapes (point plein : faite ; anneau à la
  couleur de l'agent : en cours, la première non faite ; gris : à venir),
  leurs faits en une ligne (« 2 fichiers · 5 cas · 3 lus »), le compte des
  étapes faites ; dessous, les commits de la branche (hash court, sujet ;
  `fixup!`, `squash!`, `amend!` en couleur d'attention). Le parcours mène :
  un clic (ou Ctrl+1…6) ouvre une étape faite ou celle en cours, pas une
  étape à venir, visible mais sans clic (son état au survol) ; en *Relire*,
  toutes s'ouvrent ;
- au centre, l'étape choisie — sinon celle en cours, que l'écran suit ; une
  étape choisie qui ne s'ouvre plus laisse place à celle en cours —, ses
  actions dans son en-tête (F-93) ; ni onglets des étapes ni carte
  « prochaine étape » : le parcours dit où l'on en est ;
- à droite, des onglets : **Conversation** (son intitulé ; le message en tête,
  F-74, le fil et ses demandes d'autorisation, le détail du contexte, la
  barre des skills, F-93, le champ, F-68 à F-70 : dictée, brouillon, pièces
  jointes, commandes « / ») : on lui parle toujours, même pendant qu'une
  action tourne ; **Actions (n)** (n en cours, en attente d'une
  autorisation ou arrêtées à trancher) : les courses (F-115) ; **Tâches (n)**
  (n en cours) : le volet des tâches (F-77) ; **Processus (n)** (F-111) ;
  par-dessus la conversation, qui garde sa place. Préparer un message dans
  le champ de la conversation, ou un message sans étape qui l'exige, revient
  à l'onglet Conversation ;
- en bas, la **barre d'état** : modèle, effort, mode de l'agent (des listes,
  comme son menu, F-56, F-57), jauge du contexte (clic : le détail, F-71),
  *⚙ Tâches (n)* (l'onglet Tâches, et retour ; la colonne masquée
  s'affiche), *⏹ Arrêter* quand la conversation travaille (son tour
  seulement, pas les courses), fichiers modifiés, heure
  du dernier relevé.

En *Vibe*, *Créer* a son propre écran (F-103), à la place du parcours et de
l'étape : le **fil d'Ariane** (les étapes de *Créer* en une ligne, faites, en
cours, à venir, sans clic), puis la **zone Vibe** (« la demande, puis
les questions de la note ; ensuite l'agent développe seul, vous testez et
approuvez à la fin » ; sans note, le champ et
*Rédiger la note* ; la note rédigée sans question ouverte, *Valider et
développer* ; la PR fusionnée, *PR mergée → revenir sur la base* et
*Release officielle*, F-114, masquées avant), puis la note, ses questions
et *Envoyer les réponses* (F-100).
La colonne de droite reste : les courses se suivent et s'arrêtent dans
l'onglet *Actions*. *Relire* n'a qu'un écran, celui du *Guide*. git introuvable, dossier sans
dépôt : un bandeau le dit au-dessus de l'étape, la conversation reste
utilisable. Une étape sans sortie dit ce qui manque et montre l'action qui le
produit. Une vue d'étape qui échoue sur un texte
inattendu : « Cette étape ne peut pas s'afficher. » et *Réessayer* ; le reste
de l'écran et le brouillon tiennent (I-29).

**F-93 Les actions d'une étape, Relancer, barre des skills.**
- Une action d'étape **court à part** de la conversation, dans sa propre
  conversation (une course, F-115) : pendant qu'elle tourne, on parle à
  l'agent comme d'habitude. Sous le titre de l'étape, le **champ de
  l'étape** quand une de ses actions prend un texte (F-98).
- Sous le titre de l'étape (et son champ), une **rangée d'actions** compacte : celles de
  l'étape, chacune avec qui travaille ou le choix du modèle (F-99) et
  pourquoi elle est grisée ; sans celles qui n'ont pas encore de sens
  (masquées, F-99), ni celles que la vue montre déjà ailleurs
  (une invitation, une carte, une ligne : jamais deux fois). À l'étape en
  cours, l'action qui la fait avancer (F-100, F-101, F-103) est en tête,
  discrètement mise en avant, même si elle appartient à une autre étape
  (*Préparer le commit* à l'étape Invariants). Ce qu'attend une validation
  reste dans la vue : *✓ Valider la note*, *✓ Valider la forme*, « N cas à
  valider » en tête des invariants. Une action dont la course tourne :
  « en cours » et ⏹ à côté de son bouton (arrêtée, à trancher dans l'onglet
  *Actions*). Conversation au travail : seuls les messages sans étape
  (*Demander sans modifier*, *Où j'en suis ?*, *Proposer les commandes*,
  *Valider et développer*) sont grisés ; *⏹ Arrêter* (barre
  d'état) arrête son tour, comme *Interrompre* de son menu (F-56), sans
  toucher aux courses.
- **Ce que l'IA fait seule n'a pas de bouton** ; les actions qui vont
  ensemble partent ensemble, en *Guide* comme en *Vibe*, sans que l'appli
  enchaîne rien : *Écrire les invariants (rouges), puis vérifier
  l'alignement* vérifie l'alignement dans sa course (skill `aligner`,
  `align.md` ; un écart → l'agent retouche les invariants et revérifie, 3
  tours au plus, puis dit les écarts qui restent) ; *Lancer les
  vérifications et la ponytail review* demande la ponytail review
  (`<sorties>/actions/ponytail.start`, F-115) : deux lectures, qui courent
  ensemble. En *Créer*, plus de bouton *Vérifier l'alignement* ni *Ponytail
  review* ; leurs cartes restent.
- **Relancer** : chaque carte d'une sortie de skill (relecture du diff,
  commit proposé, vérifications, CI, relecture de la note et des commits,
  plan de test) refait son action, mêmes arguments par défaut ; *Lire en
  pseudo-code* se refait par fichier (*Relire*, même lu) ou pour tous (*Tout
  relire*, F-100). L'alignement et la ponytail review n'ont pas de
  *Relancer* : on relance *Écrire les invariants* ou *Lancer les
  vérifications* (en *Relire*, *Vérifier l'alignement* reste dans la rangée
  de l'étape).
- La **barre des skills**, au-dessus du champ : deux liens, *Demander sans
  modifier* et *Retour → fixup* (*Créer*) ; les skills se trouvent par « / »
  dans le champ.

### Le relevé, les actions

**F-94 Le relevé** (sans modèle) : ce que l'écran montre, calculé par le
principal pour l'agent affiché en VibeCoder :
- le **dépôt**, par git en lecture seule (I-39), dans le dossier de l'agent :
  la branche, sa base (`origin/HEAD`, sinon `main`, sinon `master`), les
  fichiers changés (depuis la base, et la copie de travail, non suivis
  compris), les commits de la branche et leurs fichiers. *Relire* : la PR
  chargée, à sa référence `refs/vibecoder/pr/<n>`, comparée à `origin/<base>`
  de sa fiche (`pr-<n>.json`), sans la copie de travail ;
- la **note du ticket** : sa clé d'après la branche — un ticket (`G2-6675`),
  sinon une version (`0.8.0`) : la branche doit porter l'un ou l'autre — ; le
  premier `.md` de `docs/tickets/` que change la branche (*Relire* : la PR)
  dont le nom la contient en mot entier. Lue par ses
  titres (`## Ce que ça fait`, `## Ce que ça ne doit pas faire`, `## Forme`,
  ou `What it does`, `What it must not do`, `Shape`) : rédigée ou non, les
  lignes « ne doit pas » et leur marque (le premier mot connu après la
  dernière flèche : *invariant*, *variant*, *review*, *structure*), les
  modules de la Forme et leur contrat (un chemin en tête de ligne, ou un
  titre `###`) ;
- les **tests** de la branche : ses fichiers changés qui sont des tests
  (Vitest, Jest, pytest, Go, Rust sous `tests/`), leurs cas (titres `it` /
  `test`, fonctions `#[test]`, `def test_…`) et leur empreinte git ; ceux
  rangés sous `tests/invariants/` sont les invariants. Un fichier sans cas
  n'est pas montré ;
- les **modules** de la Forme : touchés par la branche ou non, les commits qui
  les touchent, leur fichier s'il existe (tel quel ou sous `src/`) ;
- les sorties des skills (F-95), les validations et le brouillon de revue
  (`vibecoder-state.json`), les actions (F-96), les skills du projet et de
  l'utilisateur.

*Créer* lit le disque (un fichier de 1 Mo au plus) ; *Relire*, `git show` à
la tête de la PR (une fois par commit de tête). **Rythme** : à chaque
conversation envoyée au panneau visible (ouverture, changement d'état d'un
agent, au fil d'un tour), toutes les 4 s tant que le panneau est visible, aussitôt
après une action, une validation, un réglage ou ↻ ; un relevé à la fois, au
plus un par seconde. L'agent affiché n'est plus en VibeCoder : `null`, une
fois, et le relevé régulier s'arrête. git manquant, pas de dépôt, fichier
illisible : le relevé part quand même, sans bloquer le fil ni l'agent
(I-29).

**F-95 Les sorties des skills** : ce qu'un skill produit pour l'écran, écrit
dans le dossier de sorties de l'agent (`{{out}}` :
`userData/vibecoder-out/<agent>/`, le même pour toutes ses branches ; Claude
Code le reçoit en dossier de travail, F-58). En *Créer*, elles suivent la
branche — celles d'une feature passée ne font pas croire qu'une étape est
faite : la dernière branche vue est retenue (`.branche`) ; quand elle change,
les sorties de *Créer* (`questions.md` à `ci.md` ci-dessous, ni les lectures
`invariants/`, ni celles de *Relire*) de la branche quittée vont dans
`branches/<branche>/` (caractères hors de `[A-Za-z0-9._-]` → `-` ; remplacé),
sauf si c'est la base — une feature lancée depuis la base (*Rédiger la note*)
crée sa branche et garde ce que ses skills ont écrit — ; puis
celles de la branche retrouvée, si elle en a de côté, reviennent. Une erreur
ne bloque pas le relevé (I-29). Seuls ces noms sont lus (I-37) : `questions.md` (questions ouvertes), `align.md`
(alignement), `review.md` (relecture d'un diff), `commit.md` (message
proposé), `checks.json` (vérifications : par élément `name`, `ok`,
`level` — `ok`, `warning` (des avertissements seulement : `ok` vrai, la
vérification passe) ou `error` ; sans `level`, d'après `ok` —, `detail`), `ponytail.md`, `pr.json` (la PR
ouverte, si gh ne l'a pas dite, F-112), `ci.md`, `prs.json` (PR à relire, d'un skill d'avant la
0.8.0-rc.10 ; ce que gh a répondu l'emporte) ; par PR `pr-<n>.json` (sa
fiche), `pr-<n>-note.md`, `pr-<n>-commits.md`, `pr-<n>-ecran.md` (plan de
test), `pr-<n>-review.json` (revue publiée), `pr-<n>-worktree.json` (son
worktree, F-110) ; les lectures
`invariants/<empreinte>.md`. Chaque étape montre les siennes (titre, fichier,
depuis quand ; un JSON mis en forme, un Markdown rendu, F-104).

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
suivie dans l'onglet *Actions*. Les autres (`vibe`, `guide`, `ask`,
`propose-run`) vont à l'agent affiché, sur sa conversation en cours, par le
chemin du champ (`sendToAgent` : refusé à un agent au travail, I-25 ; jamais
à un autre agent, I-33, ni à une ancienne conversation, I-22) : revenu en
conversation, elles sont dans le fil. Les quatre actions directes, elles,
l'appli les fait sans agent ni modèle (F-114). La page ne donne qu'un id d'action de son
dernier relevé et ses arguments (texte, rang de module, hash de commit,
id de test, numéro de PR, réponses, verdict, modèle), chacun vérifié (type, taille, valeur) par
la variable qui le prend ; une action inconnue, grisée ou `prefill` est
refusée.

**F-97 Gabarit et variables** (liste fermée, I-38) : `{{text}}` (le champ
de son étape — celui de la conversation pour un message sans étape, F-98 —,
sans ses blancs autour, 20 000 caractères au plus) ; `{{out}}` (F-95) ;
`{{lang}}` (`fr`, `en`) ; `{{branch}}`, `{{base}}` ; `{{note}}` (le chemin de
la note) ; `{{ref}}` (`WORKTREE` en *Créer*, `refs/vibecoder/pr/<n>` en
*Relire*) ; `{{files}}` (les tests d'invariants pas encore lus,
`chemin@empreinte` ; un test désigné par son id dans le relevé, `t<rang>`,
lu ou non : *Relire* ; `*` : tous, *Tout relire* ; un id absent refuse
l'action) ; `{{module}}` (le module choisi par son rang, sinon le
premier qu'aucun commit ne touche : `chemin — contrat`) ; `{{commit}}` (un
commit de la branche, sinon `WORKTREE` : les changements en cours) ; `{{pr}}`
(le numéro donné, sinon la PR du relevé) ; `{{answers}}` (« 1. … » par ligne,
une vide : « (pas de réponse) » ; 50 réponses de 2 000 caractères au plus) ; `{{verdict}}` (`approve`, `comment`,
`request-changes`) ; `{{draft}}` (« - [cible] texte » par remarque) ;
`{{quote}}` (`prefill` seulement, rempli par la page) ; `{{prefix}}` (le
préfixe des commandes vu de l'agent, F-112 ; vide permis). Les skills de
VibeCoder reçoivent d'abord `{{lang}} {{out}}`. Une valeur qui manque refuse
l'action, avec sa raison (« Dictez ou écrivez d'abord dans le champ », « Pas
encore de note pour cette branche », « Ce commit n'est pas dans la
branche »…) ; une variable inconnue aussi, ou une valeur autre que
`{{text}}`, `{{answers}}` et `{{draft}}` qui contient un caractère de
contrôle (« Action mal écrite (variable inconnue), ou valeur refusée
(caractère de contrôle) : voir le dossier de VibeCoder. »). Un **modèle**
choisi (F-99), autre que le conseillé : le `/vibecoder:<nom>` de tête devient
`/vibecoder:<nom>--<modèle>`, sa variante (F-106) ; un modèle que l'action ne
propose pas refuse l'action (« Ce modèle ne peut pas être choisi pour cette
action. »).

**F-98 Les champs** : une action dont le gabarit prend `{{text}}` emporte le
texte de **son champ** s'il y en a, ou l'exige (`needs: text` ; vide →
« Dictez ou écrivez d'abord votre demande dans le champ, puis cliquez. », le
champ prend le clavier) : on dicte, puis on clique. Son champ :
- une action d'étape : le **champ de l'étape**, sous son titre (F-93),
  montré quand une de ses actions prend un texte — *Rédiger la note* (exigé),
  *Poser la forme*, *Écrire les invariants (rouges)* ; la dictée y va quand
  il a le clavier ;
- en *Vibe* (*Créer*), le champ de la zone Vibe est celui de l'étape Note
  (*Rédiger la note*) ; *Valider et développer* ne prend pas de texte ;
- un message sans étape (*Où j'en suis ?*, *Demander sans modifier* (exigé),
  *Proposer les commandes*) : le **champ de la conversation**, qui ne sert
  plus qu'à elle et à eux.

Sauf quand la vue donne elle-même le texte
(*Appliquer* une remarque de la ponytail review : la remarque ; *Tout
appliquer* : rien) : aucun champ ne part, ils restent tels quels. Partie, le
champ se vide (celui de la conversation : ses pièces jointes restent, une
action n'envoie pas d'image, et le fil descend) ; refusée, sa raison
s'affiche sous le champ de la conversation. Une action `prefill`
ajoute son texte au champ de la conversation (à la ligne s'il n'est pas vide), `{{quote}}`
remplacé par ce qu'on cite (une ligne, 300 caractères au plus) : en *Créer*,
💬 sur un bloc, un module ou un cas (« À propos de « … » : »), ✗ sur un cas
de test (« Invariant « … » : à revoir — »), *Retour → fixup* ; possible
pendant que l'agent travaille. On complète, puis on envoie. En *Relire*, 💬
et ✗ vont au brouillon de revue (F-101), pas au champ.

**F-99 Qui travaille, grisée ou masquée.** Chaque action envoyée dit qui
travaille, d'après l'en-tête du skill qu'elle appelle, dans le plugin de
l'utilisateur (`model`, et `effort` au-delà de `low`) : *haiku*, *sonnet ·
moyen*, *opus · élevé* ; sans modèle, ou sans skill (un message en clair,
`/gear-guide`) : *agent*, le modèle de l'agent. Une action grisée dit
pourquoi (sous le bouton, au survol ; le principal la refuse de même) :
une action d'étape, par la règle des courses (F-115 : « Cette action est
déjà en cours », « Une autre action est en cours », « Une action modifie la
branche ») ; un message sans étape, quand la conversation travaille
(« L'agent travaille » : elle ne grise plus que ceux-là) ; une action directe en cours (les quatre, F-114) ; pas de dépôt git ; *Relire* :
aucune PR choisie, ou charger d'abord la PR ; brouillon de revue vide ;
*Relire* une PR fusionnée ou fermée (F-101).
Une action qui **n'a pas encore de sens** n'est pas affichée (`hidden`), au
lieu d'être grisée ; elle garde sa raison (`disabled`) : le principal la
refuse de même. Ce sont : pas encore de note (aussi la Forme et les
invariants en *Créer*) ; aucun test d'invariant ; *✓
Commiter* sans commit préparé ; *Envoyer les réponses* sans question
ouverte ; *Replier les fixups* sans commit `fixup!` ; *Ouvrir dans un
worktree* déjà ouvert ; *Décharger* hors du robot d'un worktree ; *Valider
et développer* tant que la note n'est pas rédigée (« Pas encore de note »),
avec des questions ouvertes (« Répondre d'abord aux questions de la note »)
ou la forme faite (« Déjà lancée : la forme est posée »), sauf pour
reprendre après une question qui bloque (la dernière course : *Envoyer les
réponses*). En *Créer*, l'étape PR suit l'état de la PR, qui ne
fait que masquer (une demande juste après *Valider la feature* ne tombe pas
sur un relevé en retard) : sans PR, *Valider la feature (ouvrir la PR)*
seule ; ouverte (ou son état pas encore connu), *Diagnostiquer la CI* et
*Release candidate* ; fusionnée, *PR mergée → revenir sur la base* et
*Release officielle* ; fermée, aucune. De même, *Écrire les invariants*
d'une note sans ligne « → invariant » est masquée sans être grisée, et
revient quand la note en gagne une.
Une action dont le skill tourne en sous-contexte (`context: fork`) sur
*haiku*, *sonnet* ou *opus* propose aussi les deux autres (`models`, le
conseillé : `model`) : on peut prendre plus léger (ou plus fort) pour cette
fois ; le conseillé reste le choix par défaut. Jamais Fable (I-36).

**F-115 Les courses** (une action d'étape qui court à part de la
conversation ; note `0.9.0-actions-independantes.md`).
- **Sa propre conversation** : une action `send` d'une étape (F-96) lance un
  processus Claude Code neuf, l'entrée `<agent>~<clé>` du runtime des agents
  (la clé : l'id de l'action ; *Envoyer les réponses* reprend celle de la
  note, `note`, et sa session : l'agent qui a rédigé la note garde son
  contexte). Mêmes dossier, consigne, plugin, dossiers en plus, mode et
  autorisations que l'agent (F-58), interruption comme lui (I-19) ; le modèle
  et l'effort de son skill en sous-contexte (ou celui choisi, F-99), sinon
  ceux de l'agent ; le suivi des fichiers écrits de Claude Code
  (`enableFileCheckpointing`). Pas de limite au nombre de courses ; la
  conversation de l'agent n'est jamais occupée par l'une d'elles.
  **Finie** : son tour fini et plus aucune tâche de fond que le runtime lui
  voit (sous-agents, commandes en fond, F-77) ; jusque-là *en cours*, sans
  limite de temps (une CI qui dure : ⏹ à la main). Finie, la course est
  fermée (son processus aussi), puis `actions.json` et l'avis de fin.
- **Un ancien résultat ne compte pas** : un `checks.json` dont le `time`
  précède le départ de la dernière course `checks` est ignoré (I-46).
- **La règle** (`blockedBy`, sans modèle) : une action qui **modifie la
  branche** attend toute course en cours ; une **lecture** (`reads`, F-96)
  n'attend qu'une modification, les lectures tournent ensemble ; la même
  action (même clé) ne court pas deux fois. En cours : *en cours*, *attend
  une autorisation*, ou *arrêtée* pas encore tranchée (I-44). Au clic, une
  action retenue est grisée avec la raison (F-99) ; le principal la refuse
  de même.
- **L'onglet Actions (n)** : une ligne par course, la plus récente d'abord —
  son libellé, qui travaille, son état (*en cours*, *attend une
  autorisation*, *arrêtée — à garder ou annuler*, *finie*, *en échec*,
  *gardée*, *annulée*), depuis quand ; ⏹ tant qu'elle travaille ; sa
  demande d'autorisation (outil, cible ; *Autoriser*, *Toujours*,
  *Refuser*) ; sa réponse, repliée. Une course se désigne par l'id de son
  action (`conv:vibeRunOp`), jamais par un texte ni un chemin.
- **Arrêter, puis Garder ou Annuler** : ⏹ (onglet *Actions*, ou à côté du
  bouton) interrompt son tour (I-19) ; son processus reste, et elle retient
  les autres, jusqu'au choix de l'utilisateur : *Garder* ce qu'elle a déjà
  écrit, ou *Annuler* — les fichiers que **ses** outils d'édition ont écrits
  reviennent à leur état d'avant son premier message (`rewindFiles` du SDK,
  sur son processus, I-45) ; puis elle est fermée. Un retour impossible :
  *en échec*, et la raison.
- **L'orchestrateur** (la conversation de l'agent, skill `actions`) : il lit
  `<sorties>/actions.json`, réécrit à chaque changement (`actions` : celles
  qui courent à part, et `reads` ; `runs` : chaque course, son état, sa
  réponse ; `waiting` : les demandes retenues et pourquoi), quand on le lui
  demande. Il demande un lancement par `<sorties>/actions/<id>.start` (un
  objet JSON de ses arguments : `text`, `module`, `commit`, `file`, `pr`,
  `model`, `answers` ; jamais `direct`) ou un arrêt par `<id>.stop` (vide) ;
  l'appli les lit au relevé, à la fin de chaque tour de la conversation et à
  la fin de chaque course, les `.stop` d'abord. Un lancement suit la même
  règle et les mêmes vérifications qu'un clic (`buildMessage`, I-38) ; parti,
  ou invalide, le fichier est supprimé ; retenu, il reste « en attente »
  (`waiting`) et **part de lui-même** au premier passage où plus rien ne le
  retient. En *Guide*, il ne lance ou n'arrête une action qu'à la demande de
  l'utilisateur ; en *Vibe*, il les enchaîne (F-103).
- **L'avis de fin** : une course finie (*finie*, *en échec*) envoie une
  ligne à la conversation de l'agent (« VibeCoder : « <libellé> » finie —
  <sa réponse, 300 caractères au plus>. État : <sorties>/actions.json ») ;
  gardée tant que la conversation travaille (I-25), envoyée dès qu'elle est
  libre, plusieurs en un message. Pas d'avis pour une course arrêtée :
  l'utilisateur (ou l'orchestrateur) le sait, et son état est dans
  `actions.json`.
- Les courses, les avis et les demandes retenues sont **en mémoire** ;
  *Nouvelle session*, *Retirer* l'agent ou retirer le robot d'un worktree
  (F-110) ferment et oublient ses courses.

### Créer, Relire

**F-100 Créer** (la branche du dossier de l'agent ; les étapes du guide,
§ 4.1). L'étape en cours est la première qui n'est pas faite :
1. **Note** — faite : « Ce que ça fait » rédigée, aucune question ouverte
   (`questions.md` vide), la note validée (F-102). Montre la note rendue
   (F-104), à jour pendant que l'agent l'écrit : ce qui a changé depuis le
   début du dernier tour (de la conversation, ou d'une course qui modifie la
   branche) porte un liseré, *Voir les modifications* montre le
   diff brut (retraits compris, replié autour des changements), *✓ Vu* en
   repart ; les lignes « ne doit pas » portent leur marque en pastille
   (*invariant*, *variant*, *review*, *structure*, sinon *à classer*) ;
   *Ouvrir* (dans l'éditeur). Au-dessus, les questions ouvertes, une carte
   numérotée par question : ses réponses proposées (une choisie, un second
   clic la retire), *Conseille-moi*, *Je te laisse trancher*, une précision
   libre ; *Envoyer les réponses* les envoie en une fois, une par question
   (grisé tant qu'aucune n'a de réponse). Prochaine action : *Rédiger la
   note* (la demande du champ de l'étape ; sur la base, l'agent crée d'abord la branche
   du ticket), puis *Envoyer les réponses*, puis *✓ Valider la note*.
2. **Forme** — faite : au moins un module dans la rubrique « Forme », validée.
   Montre les modules groupés par premier dossier (`src/` de tête ignoré) :
   chemin, contrat en rubriques (expose, ne connaît pas, utilisé par), état
   (touché par la branche, existe, à créer), commits ; 💬, *Ouvrir*. *Poser
   la forme* (dans la note, sans code ; le champ de l'étape peut la préciser), puis
   *✓ Valider la forme*.
3. **Invariants** — faite : aucune ligne « → invariant » dans la note (ni
   test ni commit attendus : la note et la forme se commitent à l'étape
   Modules ; *Écrire les invariants* masquée, elle revient quand la note
   gagne une ligne « → invariant »), ou des tests d'invariants dont chaque
   cas est validé, lu ou pas, note et tests commités. *Lire en pseudo-code*
   n'est qu'une aide à la lecture, facultative. Montre le
   résumé (cas, validés, refusés, modifiés depuis, avec un point d'attention,
   à lire), l'alignement (`align.md`, sans *Relancer*, F-93), puis chaque fichier : sa progression,
   *Ouvrir*, *Relire* (lu : refaire sa lecture) ; lu, une carte par cas —
   titre, pseudo-code en étapes `test "…":` / `given` / `when` / `then` /
   `and`, quel que soit le langage du test (coloré ; chaque `then` est une
   assertion, sa valeur attendue après `#` ; les lectures d'avant, proches
   de Vitest, se lisent encore), cas limites, ce qu'il garantit, un point
   d'attention quand le test n'observe pas vraiment la propriété — avec ✓,
   ✗ (cite le cas dans le champ), 💬, *Ouvrir*, et *Pseudo-code / Code* : le
   code d'origine du cas à la place du pseudo-code (de sa ligne à celle du cas
   suivant, monospace, numéroté, coloré : F-113) ; *✓ Tout valider* quand
   aucun cas n'a de point d'attention, le fichier lu ou pas ; *Voir le
   fichier* (replié : tout son code, numéroté) ; pas lu (ou changé depuis) :
   ses cartes sans lecture, avec ✓ et ✗, et *Lire en pseudo-code*. Le relevé porte le texte
   du test, vide au-delà de 200 000 caractères (rien de tout cela n'est
   alors montré). En tête : *Tout relire* (dès qu'un fichier
   est lu). Prochaine action : *Écrire les invariants
   (rouges), puis vérifier l'alignement* (d'après la note, ou le pseudo-code
   du champ de l'étape ; l'alignement dans la même course, F-93) tant qu'il
   n'y a pas de test, puis les cas à valider (dans la vue), *✓ Commiter* (un
   commit préparé), *Préparer le commit* (des fichiers à commiter). *Lire en
   pseudo-code* (les fichiers pas encore lus : une lecture est nommée par
   l'empreinte du fichier ; relire la remplace) n'est mise en avant qu'en
   *Vibe* ; en *Guide*, elle reste dans la rangée de l'étape.
4. **Modules** — faite : chaque module de la Forme touché par un commit de la
   branche. Montre en tête le commit proposé (`commit.md` : le message tel
   qu'il sera commité, *✓ Commiter*, direct ou *via* l'agent, F-114 ; 💬) et la relecture du dernier diff
   (`review.md`) ; puis une ligne par module (commité, en cours : modifié pas
   commité, à faire ; nom, dossier, contrat, « à créer », ses commits) avec
   *Générer* (ce module), *Relire le diff* (du dernier commit qui le touche,
   sinon des changements en cours), *Ouvrir*. Prochaine action : *✓ Commiter*
   (un commit préparé), *✓ Valider → commit → suivant* (un module en cours,
   un autre reste), *Préparer le commit* (le dernier en cours), sinon
   *Générer ce module* (le premier qu'aucun commit ne touche ; avec
   `ponytail`, tests lancés, sans commit) ; aussi *Relire le diff* (les
   quatre questions du § 5.1), *Générer les modules restants* (confiés à des
   agents Opus en parallèle, chaque diff relu, un commit par module).
5. **Revue** — faite : vérifications toutes passées (`checks.json` ; des
   avertissements seulement passent ; un ancien ne compte pas, I-46),
   ponytail review faite (`ponytail.md`),
   aucun commit `fixup!`. Montre la
   liste du § A.3, cochée d'après le dépôt quand c'est possible (la note dans
   un commit de la branche ; tous les contrôles dont le nom contient
   « invariant » passés, quelle que soit la partie : `invariants (backend)`… ;
   aucun `fixup!` et chaque module de la Forme dans au moins un commit) ; « chaque diff relu » (avec
   l'aide « Cochez une fois chaque module relu (Modules → Relire le diff) »)
   et « AGENTS.md à jour » se cochent à la main (« à vérifier » tant qu'elles
   ne le sont pas ; F-102, cible `a3:<rang>`, pour le commit de tête de la
   branche : un commit de plus les décoche ; grisées sans commit), cochées
   elles comptent comme faites ; les vérifications, une ligne
   chacune (✓, ✗, ou ! et la pastille orange « avertissements » ; le détail
   déplié en cas d'échec ; *Relancer*), le compte de la carte « n en échec »
   en rouge, sinon « n avertissements » en orange, sinon « n / n ok » ; les
   faits de l'étape ajoutent « n avertissements » ; la ponytail
   review rendue, 💬 et *Appliquer* par remarque, *Tout appliquer* sur la
   carte (l'action `apply`, qui travaille : l'agent ; *Appliquer* lui donne
   la remarque, `{{text}}`, *Tout appliquer* rien : toutes ; ni l'un ni
   l'autre ne prend le champ ; absents sans remarque en liste ; pas de
   *Relancer* ; sans sortie, une invitation sans bouton : elle part avec les
   vérifications). Prochaine action : *Lancer les vérifications et la
   ponytail review* (tant que `checks.json` ou `ponytail.md` manque, ou
   qu'une vérification échoue), puis *Replier les fixups*.
6. **PR** — faite : une PR pour la branche, lue par gh (F-112 ; sinon
   `pr.json`). Montre la PR (numéro, titre, base ← branche,
   *Ouvrir ↗* dans le navigateur) et l'état de la CI (`ci.md`). Ses actions
   suivent l'état de la PR (F-99) : sans PR, *Valider la feature (ouvrir la
   PR)* ; ouverte, *Diagnostiquer la CI* et *Release candidate* ; fusionnée,
   *PR mergée → revenir sur la base* (F-114) et *Release officielle*.

À l'étape Note et à l'étape Forme, l'agent n'étant pas sur Fable, une
pastille *✦ Fable · élevé* (« plus cher ») l'y passe d'un clic, comme son
menu (F-109).

**F-101 Relire** (une PR du dépôt ; la review du guide, § 5.4). La PR
suivie (`agents[].vibe.pr`) se choisit par son numéro ou son lien
(`…/pull/<n>`) et *Charger*, ou d'un clic dans la liste de *Mes PR à relire*
(celles où l'on est demandé en relecture, demandées à gh, F-112) : la suivre, puis la
charger. *Charger la PR* la récupère **sans toucher à la copie de travail** :
une référence locale `refs/vibecoder/pr/<n>` (`git fetch`, par l'appli,
F-114 ; *via* : le skill, dans la conversation) et sa fiche `pr-<n>.json` (titre, auteur, base, branche,
description, état). Le parcours se calcule alors sur la PR ; ce qui la lit attend
qu'elle soit chargée. Une PR **fusionnée ou fermée** (`state` de sa fiche ;
une fiche d'avant la 0.8.0-rc.2 n'en a pas : ouverte) se charge mais ne se
relit pas (l'état que gh donne l'emporte sur la fiche, F-112) : un bandeau le dit, et les actions des autres étapes sont grisées
avec cette raison (« PR déjà fusionnée : rien à relire », « PR fermée : rien
à relire »). Les étapes, faites quand :
1. **PR** — chargée. Montre la PR (titre, auteur, base ← tête, description
   rendue, *Ouvrir ↗*), ou celle qu'on suit, à charger ; la liste à relire.
   *Décharger la PR* : ne plus la suivre (le choix d'une PR revient ; sa
   référence locale reste).
2. **Note** — absente de la PR, ou jugée : ✓, ou ✗ (« La note est à revoir. »
   au brouillon). Montre la note de la PR (comme en *Créer*)
   et sa relecture par l'agent (`pr-<n>-note.md`). *Relire la note*
   (décisions à discuter, manques, invariants mal classés).
3. **Invariants** — chaque cas jugé (✓ ou ✗), lu ou pas. Les mêmes
   cartes qu'en *Créer* ; *Lire en pseudo-code* (facultative), *Vérifier
   l'alignement*.
4. **Commits** — relus (`pr-<n>-commits.md`). Sans IA, les commits de la PR
   (hash, sujet, fichiers touchés), chacun avec *Voir le diff*, *GitHub ↗*
   et ses fichiers à ouvrir (ci-dessous) ; relus, une carte par commit (hash,
   sujet, remarques). *Relire les commits* (un par un : les quatre questions,
   la duplication, les en-têtes, l'histoire des commits).
5. **À l'écran** — chaque case du plan de test cochée (dans le fichier, ou
   cochée à l'écran : validée pour ce plan-là, F-102 ; décocher la refuse,
   même cochée dans le fichier).
   *Plan de test à l'écran* (comment lancer la PR, puis quoi essayer).
6. **Revue** — publiée (`pr-<n>-review.json` : son état, son lien). Montre
   le **brouillon de revue**, le verdict (*Approuver*, *Commenter* par
   défaut, *Demander des changements*) et *Publier la revue*, qui l'envoie
   sur GitHub, tel quel, avec ce verdict (F-114).

Le brouillon, gardé par PR : une remarque = sa cible (une ligne, 300
caractères au plus) et son texte (5 000 au plus) — le texte du champ s'il y
en a (le champ se vide ; trop long, il reste et l'écran le dit), sinon ce
qu'on cite. ✗ sur la note ou un cas, 💬 sur la note, sa relecture,
l'alignement, un cas ou un commit y ajoutent une remarque ; elle se modifie
sur place (même cible, mêmes limites) ou se retire (×).

**Ouvrir**, en *Créer* comme en *Relire*, ce que désigne un id du dernier
relevé (I-37), dans l'éditeur (`editorCommand`, sinon le premier trouvé,
F-56) :
- un fichier (la note, un test, un variant, un module ; `c<rang>/<i>`, le
  i-ème fichier d'un commit), à une ligne si l'écran la donne (un cas de
  test : zed `fichier:ligne`, code, cursor, codium `-g fichier:ligne`, un
  autre éditeur : le fichier seul). *Créer* : la copie de travail ;
  *Relire* : sa version à la tête de la PR (`git show`), écrite dans
  `<sorties>/files/pr-<n>/<chemin>`, en lecture seule (un dossier ne
  s'ouvre pas) ;
- `c<rang>` : le diff d'un commit (`git show`, sans programme externe, I-39),
  écrit dans `<sorties>/files/<hash>.diff`, en lecture seule ;
- `gh:c<rang>` : la page du commit sur GitHub, dans le navigateur, d'après
  l'origine du dépôt comme *Ouvrir sur GitHub* (I-32) ; sans origine
  GitHub, rien.

Un fichier écrit pour être ouvert remplace le précédent ; son dossier reste
dans le dossier de sorties (un lien qui en sort : rien n'est écrit).

**F-110 Relire dans un worktree.** À l'étape **PR**, la PR chargée :
*Ouvrir dans un worktree* (skill `worktree-pr`, sous-contexte, sonnet ·
moyen) — l'agent du dépôt récupère la PR, crée un worktree selon la
convention du projet (son skill, son script ou sa doc de worktrees, ex.
`gt-plugins-worktrees/<branche>` ; sinon `../<dépôt>-worktrees/pr-<n>`), sur
la branche de la PR (ou `pr-<n>`), le prépare comme le projet le dit
(dépendances, fichiers copiés), et l'inscrit en dernier dans
`pr-<n>-worktree.json` (`{ dir, branch }`). Pendant ce temps : « Création du
worktree en cours… ». La fiche arrivée, l'appli ajoute un **robot
temporaire** « PR #n » sur ce dossier (`agents[].temp`, § 9 : le modèle,
l'effort, le mode et l'autonomie de l'agent du dépôt, en VibeCoder, *Relire*,
la PR suivie, sa fiche et son brouillon de revue repris) — seulement après la
question de confiance, toujours posée pour un worktree de PR (ses réglages
`.claude` sont ceux de la PR et se chargeront ; I-23, I-41). *Annuler* : pas
de robot ; *Ajouter le robot PR #n* la repose. Le robot là : *Aller au robot
PR #n*. C'est un agent comme un autre (conversation, éditeur, VibeCoder), son
dossier favori le temps de la relecture ; son en-tête porte « PR #n ·
worktree » et *Décharger* : le message part à **l'agent du dépôt** (le
worktree est à lui ; skill `retirer-worktree`, haiku · faible), qui fait
`git worktree remove` — refusé s'il reste des modifications, et il le dit —
puis supprime la fiche ; la fiche partie, l'appli retire le robot (pas au
travail) : son brouillon de revue revient à l'agent du dépôt, son dossier
quitte les favoris, le panneau passe à l'agent du dépôt. *Retirer* le robot
(clic droit) oublie aussi son dossier. La relecture sans worktree
(`refs/vibecoder/pr/<n>`) reste la même.

**F-102 Validations** : ✓, ✗ ou oublier, sur la note, sa Forme, un cas de
test, une case du plan de test (*Relire*), une case du § A.3 que le dépôt ne
peut pas cocher (*Créer*, `a3:<rang>` : cocher la valide, décocher l'oublie). La note et la forme : *✓ Valider*
(*Relire* : ✓ ou ✗), puis « validée » et *Annuler* ; un cas : ✓ ou ✗, un
second clic l'annule. Chacune vaut pour l'empreinte du contenu validé (le
texte de la note, la rubrique « Forme », le fichier du test, le plan, le
commit de tête de la branche pour une case du § A.3) : le
contenu change → « modifiée depuis » (*✓ Revalider*), et l'étape attend une
nouvelle validation. Une cible absente du dernier relevé est ignorée.
Gardées par agent (`vibecoder-state.json`) ; aucune n'envoie de message.

**F-103 Guide et Vibe** (par agent, `agents[].vibe.autonomy`), sur la même
mécanique, les courses (F-115). *Guide* (par
défaut) : le développeur valide la note, la forme et chaque cas des
invariants ; l'étape en cours attend ses validations ; il lance les actions
dans l'ordre qu'il veut, et l'orchestrateur ne lance ni n'arrête rien qu'il
ne lui demande. *Vibe* (*Créer* seulement : *Relire* n'a que l'écran du
*Guide*) : on donne la main à l'agent, le développeur teste et approuve à la
fin ; les validations ne sont plus attendues (note, forme, et invariants dès
qu'il y a des tests, faits sans ✓ ni lecture). Son écran (F-92), en deux
temps :
1. **La note et ses questions**, sans orchestrateur : la demande dans le
   champ de la zone Vibe, *Rédiger la note* (l'action `note`, sa course,
   mise en avant tant que la branche n'a pas de note) ; ses questions vont
   **toutes** à l'utilisateur (*Envoyer les réponses*) : personne ne les
   tranche à sa place.
2. ***Valider et développer*** (l'action `vibe`, mise en avant la note
   rédigée sans question ouverte et la forme pas faite ; masquée la note
   pas rédigée, avec des questions ouvertes, ou la forme faite sauf pour
   reprendre après une question qui bloque, F-99) : sans texte, au skill `vibe`,
   dans la conversation ; l'agent, l'**orchestrateur**, tient le rôle du
   développeur du guide, reprend à la première étape pas faite et **enchaîne les actions de
   l'écran** par leurs demandes (F-115) — forme, invariants rouges
   (l'alignement compris), premier commit, modules (confiés à des agents
   Opus avec `ponytail`), vérifications (la ponytail review comprise),
   fixups, PR, CI, release candidate si le projet en documente une —, une
   demande puis la fin de son tour, réveillé par l'avis de fin ; chaque
   action reste visible et arrêtable dans l'onglet *Actions*, et ce qui
   doit attendre part de soi-même. Rien n'est développé avant ce clic.

L'orchestrateur ne s'arrête que sur une question qui bloque
(`questions.md`), ne tranche aucune question de la note, ne lance ni
`note` ni `answers`, ne tranche jamais *Garder* / *Annuler* (c'est à
l'utilisateur), et le fil d'Ariane se remplit au fil du relevé. Jamais : `git push --force`, fusionner la PR, publier une version
officielle, supprimer une version, un tag ou une branche.

**F-104 Markdown** (la note, les sorties) : titres, paragraphes, listes et
cases à cocher, citations, code, tableaux, filets ; en ligne : code, gras,
italique, liens. Jamais de HTML : une balise reste du texte ; un lien n'est
un lien qu'en `http(s)`, ouvert dans le navigateur (I-40, I-21). Un 💬 au
survol de chaque bloc et de chaque élément de liste le cite (F-98 ; *Relire* :
au brouillon, F-101). Un JSON écrit par un skill est lu sans s'y fier :
illisible, l'écran le dit ou le montre tel quel.

### Lancer le projet

**F-111 Processus** : un onglet *Processus (n)* à côté de *Conversation* et
*Tâches* (n : les commandes en cours). Les commandes qui lancent le projet de
l'agent (serveur, front, services) sont dans
`userData/vibecoder/projets/<dossier>.json` (le chemin du dossier de l'agent,
ses séparateurs en `-`), propre à la machine — par exemple `gear` pour
gt-plugins, une fonction du `.bashrc` :
`{ "commands": [{ "name", "run", "cwd"? }], "shell"? }`. Un `name` sûr et
unique (lettres, chiffres, `.`, `_`, `-` : il nomme le journal), `run` tel
que tapé dans un terminal, `cwd` relatif au dossier de l'agent ; une entrée
mal formée est ignorée. Chaque commande a son nom (entier, coupé s'il est vraiment long ; la
bulle donne nom et commande), sa commande en petit dessous, ▶ *Lancer*, ⏹ *Arrêter*,
↻ *Relancer*, son état (en cours, arrêtée, en échec et son code), depuis
quand, et la fin de son journal (200 lignes au plus, sans couleurs, qui suit
la fin ; dépliable ; *Journal complet* l'ouvre dans l'éditeur).
- **Pas de fichier** : *Proposer les commandes* (action `propose-run`, skill
  `lancement`, sous-contexte, haiku · faible ; le champ peut le guider) :
  l'agent cherche comment lancer le projet (AGENTS.md, CLAUDE.md, README,
  `package.json`, `process-compose`, Makefile, compose, alias et fonctions du
  `.bashrc`) et écrit `lancement.json` dans ses sorties ; au relevé, l'appli
  en fait le fichier du projet **s'il n'existe pas** (jamais par-dessus,
  I-42), puis retire la proposition. *Modifier les commandes* ouvre le
  fichier dans l'éditeur (créé d'un exemple s'il manque).
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
  qu'il appelle de lui-même) et demande l'arrêt ou la relance par un fichier
  vide, `<sorties>/run/<nom>.stop` ou `.restart`, que l'appli exécute puis
  retire au relevé — pour un nom du fichier seulement (I-42).
- **Quitter l'appli** arrête tout ce qu'elle a lancé (F-81, I-43).

**F-112 GitHub sans IA** : l'appli lit elle-même trois faits de GitHub par
`gh`, sans agent ni modèle, en lecture seule (I-39) : `gh` lancé sans shell
derrière le préfixe de F-111 (l'appli tourne sur l'hôte, gh souvent dans la
box), au dossier de l'agent, 15 s au plus ; un échec n'est qu'une réponse
absente (I-29).
- *Créer*, étape **PR** : la PR de la branche (`gh pr view <branche>`, sauf
  sur la base) — numéro, titre, lien, état, base, branche ; une PR existe :
  l'étape est faite. Sans réponse, `pr.json` (le skill `pr`) est encore lu.
- *Relire* : *Mes PR à relire* (`gh pr list --search review-requested:@me`,
  au clic ; un échec garde la liste d'avant) ; l'état de la PR chargée
  (`gh pr view <n> --json state`), qui l'emporte sur sa fiche.
- Une réponse vaut 60 s (par branche, par PR) ; elle est demandée en fond,
  le relevé ne l'attend pas et repart quand elle change ; ↻ les redemande.
- Le skill `verifier` reçoit ce préfixe **vu de l'agent** (`{{prefix}}`,
  F-97) : sans la box où l'agent tourne déjà (vide si `agentCommand` y
  entre) ; il y lance les commandes du projet, sans en ajouter.

**F-113 Coloration du code d'un test** (F-100, étape Invariants : *Code*, *Voir le
fichier*) : d'après l'extension — `ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`,
`mts`, `cts` ; `rs` (attributs `#[…]`, macros `nom!`, durées de vie `'a`,
chaînes brutes `r#"…"#`, caractères) ; `py` (triples guillemets, préfixes,
décorateurs) ; `go` (chaînes brutes `` `…` ``) ; un autre : en texte. La
palette sombre de GitHub : mots-clés, chaînes, commentaires, nombres et
constantes, fonctions, types, attributs. Écrite à la main, sans dépendance ;
des morceaux de texte, jamais du HTML (I-40), qui redonnent le code tel
quel.

**F-114 Actions directes** (sans IA, au clic) : quatre actions ne sont que
des commandes connues d'avance ; l'appli les lance elle-même, sans agent, ni
modèle, ni jeton, au clic de leur bouton (« direct » à la place du modèle).
À côté, un petit *via* (et le choix du modèle, F-99) garde le chemin
d'avant, le skill dans la conversation, en cas de souci. Les `id` (`commit`,
`publish`, `load-pr`, `base`) restent ceux d'`actions.<langue>.json` : leur
gabarit est le *via* ; une entrée retirée retire les deux boutons.
- *✓ Commiter* : `git commit -F <sorties>/commit.md` (rien d'ajouté à
  l'index : ce que *Préparer le commit* y a mis), puis `commit.md`
  supprimé ; en échec (un hook, rien d'indexé), il reste.
- *Publier la revue* : le brouillon (« - [cible] texte » par remarque) écrit
  par l'appli dans `<sorties>/pr-<n>-review-body.md`, puis `gh pr review <n>
  --approve|--comment|--request-changes --body-file <ce fichier>` ; publiée,
  `pr-<n>-review.json` (`state` d'après le verdict, `url` : la PR).
- *Charger la PR* (le numéro saisi, un clic dans *Mes PR à relire*) : `gh pr
  view <n> --json number,title,url,author,baseRefName,headRefName,body,state`
  → `pr-<n>.json`, puis `git fetch origin +pull/<n>/head:refs/vibecoder/pr/<n>
  <base>`.
- *PR mergée → revenir sur la base* : seulement si `gh pr view <branche>
  --json state` dit `MERGED` : `git switch <base>`, `git pull --ff-only`, `git
  branch -d <branche>` (la branche et la base de sa PR, du relevé) ; sinon
  rien (« The PR of … is OPEN, not merged: nothing done. »). Une branche
  fusionnée par squash n'est pas supprimée (`-d` refuse) : *via* l'agent.

git (au dossier de l'agent) et gh derrière le préfixe (F-111 : la box, où
les hooks de git — Husky — trouvent Node), sans shell (I-27), 60 s au plus par commande ; une commande en
échec arrête l'action. Chacune s'inscrit dans `<sorties>/direct.log` (heure,
commande, code de sortie, sortie courte). En fond, une à la fois par agent :
pendant ce temps « … » sous le bouton et les quatre grisées (« Une commande
directe est en cours ») ; puis le dernier résultat, ✓ ou ✗ et une ligne (en
anglais, comme les skills techniques, F-108), le détail (chaque commande et
sa sortie) à déplier. Gardé en mémoire, par agent, jusqu'à la sortie de
l'appli (I-39, I-29).

### Skills, configuration

**F-105 Le plugin `vibecoder`** (`userData/vibecoder/plugin/`), donné par le
SDK au Claude Code de chaque agent (F-58) : ses skills s'appellent
`/vibecoder:<nom>` ; `disable-model-invocation` : seul un bouton, ou
l'utilisateur qui tape la commande, les lance (sauf `processus`, F-111, que
l'agent appelle quand il a besoin d'un journal ou d'une relance, et
`actions`, F-115, quand on lui demande où en sont les actions, ou d'en lancer
ou d'en arrêter une — en *Guide*, seulement à la demande de l'utilisateur)
— ils ne coûtent rien tant
qu'on ne les appelle pas —, et rien n'est écrit dans les projets pour eux.
Ils s'appuient sur les skills du projet et de l'utilisateur quand ils
existent (`gear-prompt-specs-to-feature-note`, `gear-commit-message`,
`gear-fix-up`, `ponytail`, `ponytail-review`) : ils en suivent les
instructions, sinon le guide du dépôt (`docs/dev_guide/`), sinon les leurs.
`vibe` est la consigne d'enchaînement de l'orchestrateur (F-103) : il ne
fait plus la feature dans un seul tour, il lance les actions par le
protocole d'`actions`, à partir de la forme. `invariants` suit `aligner`
dans sa course ; `verifier` demande `ponytail` (F-93).
Un agent du plugin, Opus à effort élevé : `developpeur` (un module de la
Forme, `ponytail` préchargé, rien de commité), lancé par `modules`. Aucun skill livré ne fait
`git push --force` ni ne fusionne une PR ; une version, un tag, une release
candidate ne se suppriment qu'avec l'accord de l'utilisateur.

**F-106 Modèles** : chaque skill fixe son modèle et son effort (son
en-tête). Ce qui se suffit à soi-même tourne dans un sous-contexte
(`context: fork`), sans relire la conversation : son coût ne dépend pas de la
longueur de celle-ci.
- *haiku* (effort faible) : `prs` (gardé, plus appelé par l'écran : F-112), `charger-pr`, `verifier`, `commit` (le
  message préparé, tel quel), `base`, `publier-revue` (`charger-pr`, `commit`, `base`, `publier-revue` : le
  *via* des actions directes, F-114), `retirer-worktree`, `lancement` ;
- *sonnet* : `commit-preparer` (faible) ; `pr`, `fixups`, `ci`, `ecran`,
  `lire-invariants`, `worktree-pr` (moyen) ;
- *opus · élevé* : `invariants`, `module`, `suivant`, `relire`, `aligner`,
  `ponytail`, `relire-note`, `relire-commits`.

`lire-invariants` : Sonnet à effort moyen, retenu par un banc (tests Rust de
workflows-tester, tests TypeScript de whisper) : 79/90, contre 84/90 pour
Opus à effort moyen, 1,8 fois plus cher ; Haiku écarté. Sans sous-contexte,
sur le modèle de l'agent : `note`, `forme`, `modules`, `rc`, `release` et les
messages sans skill d'une étape (*Envoyer les réponses*, *Appliquer la
revue*), chacun dans sa course (F-115) ; dans la conversation (en changer de
modèle en cours de conversation en perdrait le cache) : `vibe`, `processus`,
`actions`, et *Demander sans modifier*, *Où j'en suis ?*.

**Un autre modèle pour une étape** (F-99) : au démarrage (et à chaque
ouverture du dossier, F-107), pour chaque skill `<nom>` du plugin de
l'utilisateur qui tourne en sous-contexte sur *haiku*, *sonnet* ou *opus*,
l'appli écrit une variante par autre modèle, `skills/<nom>--<modèle>/SKILL.md` :
le même en-tête (`description`, `argument-hint`, `disable-model-invocation`,
`allowed-tools`, `context: fork`), ce modèle et son effort par défaut (haiku
`low`, sonnet `medium`, opus `high`), un corps qui suit `<nom>/SKILL.md` avec
les mêmes arguments. Ce sont des fichiers générés, pas des défauts : hors du
manifeste, réécrits à chaque fois (les noms en `--haiku`, `--sonnet`,
`--opus` leur sont réservés). Jamais Fable (I-36).

**F-107 Le dossier de VibeCoder** (`userData/vibecoder/` ; menu de l'icône,
*Agents Claude Code → Dossier de VibeCoder*, § 8) : `actions.fr.json`,
`actions.en.json` (les boutons : en modifier, en retirer, en ajouter),
`plugin/` (`.claude-plugin/plugin.json`, `skills/<nom>/SKILL.md` avec son
modèle et son effort, `agents/`), `README.md` (quoi modifier, comment revenir
à l'origine). Écrits d'après `resources/vibecoder/` au démarrage et à chaque
ouverture du dossier par le menu : un fichier absent est écrit — un fichier
supprimé revient donc par défaut — ; un fichier jamais modifié suit les mises
à jour de l'appli ; un fichier modifié par l'utilisateur, ou que l'appli n'a
pas écrit, n'est jamais remplacé (I-35). Le manifeste `.defaults.json` retient
l'empreinte de ce que l'appli a écrit ; illisible, plus rien n'est remplacé.
Un échec ne bloque rien (I-29). Les actions et l'en-tête des skills (qui
travaille) sont relus à chaque relevé. S'y ajoutent les variantes générées des
skills (F-106), réécrites à chaque fois.

**F-108 FR / EN** (`vibeLang`, pour tout VibeCoder) : la langue de l'écran
(libellés, faits du parcours, raisons et erreurs), des actions
(`actions.<langue>.json` : libellés, aides, messages envoyés) et de ce que
les skills écrivent pour l'utilisateur (`{{lang}}`) : la note, les questions
ouvertes, le plan de test à l'écran, la relecture de la note, les releases.
**Tout ce qui touche au code reste en anglais**, quelle que soit la langue :
le pseudo-code des invariants (`test "…":`, `given / when / then`) et ses rubriques `Edge cases:`, `Guarantees:`, `Warning:` (le relevé
lit encore `Cas limites :`, `Garantit :`, `Attention :` des lectures
d'avant), les relectures de diff et de commits, la ponytail review, la CI,
l'alignement, les vérifications, les réponses des skills techniques ; les
messages de commit et de PR suivent la convention du projet. Les composants
de la conversation (fil, champ, volet des tâches, détail du contexte)
restent en français.

**F-109 Fable** : VibeCoder ne fait jamais travailler Fable de lui-même
(I-36) : aucune action ni aucun skill livré ne le nomme ni ne change de
modèle, et le choix du modèle d'une étape (F-99) ne le propose pas ; seul un clic de l'utilisateur y passe l'agent (menu du robot, barre
d'état : « Fable (plus cher) », pastille *✦ Fable · élevé* des étapes Note et
Forme en *Créer* : modèle Fable, effort élevé).

## 8. Menu du clic droit (icône, bouton de lecture)

État du modèle ; Langue ; Micro (défaut du système + micros énumérés) ; Bip ;
Couper le son des autres applications (Linux, Windows) ; Coller
automatiquement ; Toujours au premier plan (icône, bulles, panneau ;
appliqué aussitôt) ; Afficher le texte transcrit ; Autoriser la coupure du
micro Discord (Linux, Windows) ; Rétablir le son et le micro Discord
(dépannage, F-34) ; Lecture à voix haute (installer, source,
désactivée, langue, voix, volume) ; Agents Claude Code (afficher, relire
avant d'envoyer, commande, changer la commande, éditeur, changer d'éditeur,
consigne, journal, *Dossier de VibeCoder* : ses fichiers par défaut écrits,
puis le dossier ouvert, F-107) ; Ouvrir le dossier whisper ; Modifier la configuration ;
À propos (page de la version) ; Quitter.

## 9. Réglages (`config.json`)

| Clé | Défaut | |
|---|---|---|
| `lang` | `fr` | fr, en, auto, es, de, it, pt, nl |
| `vocabulary` | `''` | prompt whisper, 300 car. |
| `sound` | `true` | bips |
| `showText` | `true` | panneau « Dictée » après une dictée |
| `autoPaste` | `true` | collage automatique |
| `onTop` | `true` | premier plan |
| `discordMute`, `muteOthers` | `false` | coupures |
| `speak` | `selection` | selection, clipboard, off |
| `speakVolume` | `1` | borné à 0–1 |
| `speakLang` | `auto` | auto, fr, en |
| `speakVoices` | `{ fr: estelle, en: jane }` | |
| `deviceId`, `deviceLabel` | `''` | micro |
| `size`, `pos` | `64`, `null` | icône |
| `agentsEnabled` | `false` | |
| `agentCommand` | `''` | → `claude` |
| `editorCommand` | `''` | → le premier éditeur trouvé |
| `agents`, `agentFolders` | `[]` | |
| `agentSelected` | `null` | remis à `null` au lancement |
| `agentReview` | `true` | dictée dans le champ |
| `convSize` | — | taille du panneau agrandi |
| `vibeLang` | `fr` | VibeCoder : fr, en (F-108) ; autre valeur → fr |
| `vibeSize` | — | taille du panneau en VibeCoder (défaut 1280×820) |
| `vibeCommandPrefix` | `''` | VibeCoder : ce qui précède les commandes du projet et gh (F-111, F-112) ; `''` → `distrobox enter <box> --` d'après `agentCommand`, sinon rien |

Dans `agents`, pour VibeCoder : `view` (`vibecoder` ; absent : la
conversation) et `vibe` `{ flow, autonomy, pr }` — `flow` `create` (défaut)
ou `review`, `autonomy` `guide` (défaut) ou `vibe`, `pr` la PR suivie (un
entier positif, sinon `null`) ; une valeur inconnue prend le défaut. Le
robot d'une PR ouverte dans un worktree porte `temp` `{ parent, pr }`
(l'agent du dépôt et la PR, F-110) ; mal formé, c'est un agent ordinaire.

Relue à chaque usage (une retouche à la main prend effet sans relancer, sauf
`size`). Clés inconnues ignorées (ex. l'ancien `speakEngine`). Anciens formats
tolérés : `agentFolders` en chemins seuls, couleur portée par l'agent.

## 10. Cycle de vie

**F-80** Une seule instance. Au lancement : fenêtres créées (bulle cachée,
prête), couleurs des dossiers complétées, **aucun agent sélectionné**,
assistant Windows démarré, modèle whisper vérifié après le chargement de la
bulle.

**F-81 Quitter** pendant une dictée ou un tour d'agent : on rend d'abord le son
et le micro Discord, on interrompt les agents et on attend la fin de leurs
tours (≤ 6 s), puis on quitte. À la sortie : assistant Windows, Pocket TTS et
agents arrêtés. Les processus lancés par l'onglet *Processus* (F-111) : arrêtés
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
`tests/invariants/` protégés) : I-2 à I-6 (texte collé, une ligne,
presse-papiers, collage désactivé), I-8, I-9, I-11 (page et principal), I-12,
I-13 à I-17, I-19, I-20, I-21, I-23, I-24, I-27, I-29, I-30, I-32 à I-34 ;
VibeCoder, I-35 à I-40 : `src/main/core/vibecoder/tests/invariants/`
(`defaults.test.ts` I-35, `fable.test.ts` I-36, `files.test.ts` I-37,
`actions.test.ts` I-38), `src/main/technicals/git/tests/invariants/read-only.test.ts`,
`src/main/technicals/github/tests/invariants/read-only.test.ts`, `src/main/technicals/direct/tests/invariants/direct.test.ts` (I-39), `src/renderer/core/vibecoder/tests/invariants/markdown.test.ts` (I-40) ;
I-42, I-43 : `src/main/core/runner/tests/invariants/runner.test.ts`,
`src/main/technicals/process/tests/invariants/process.test.ts` ; I-44 :
`src/main/app/controllers/tests/invariants/runs.test.ts` (sur le vrai
principal, git réel, SDK factice) ; I-45 :
`src/main/core/agents/tests/invariants/rewind.test.ts` (ce que l'appli
demande à Claude Code) et le dernier cas de `runs.test.ts` ; I-46 :
`src/main/core/vibecoder/tests/invariants/checks.test.ts`.
Les autres (focus, fenêtres, I-1, I-18, I-22, I-28) : scénarios du § 13 et
bancs de comparaison.

### Focus et collage

- **I-1** L'icône et la bulle ne prennent **jamais** le focus : le texte doit
  arriver dans l'application où est le curseur.
- **I-2** Ce qui est collé ou envoyé à un agent par la dictée est **toujours**
  ce que whisper vient de rendre, jamais un texte fourni par une page. Seule
  exception : le texte du champ du panneau, écrit ou relu par l'utilisateur.
  Une action de VibeCoder n'y ajoute que son gabarit et des valeurs du
  dernier relevé (I-38).
- **I-3** Aucun canal « colle ce texte », « lis ce texte » ou « copie ce
  texte » : Copier (contexte « Dictée ») demande au principal de copier
  **son** dernier texte ; le lecteur lit la sélection, ou le résumé retenu par
  le principal.
- **I-4** Jamais de retour à la ligne dans une transcription (collé dans un
  terminal, il **exécute** la commande).
- **I-5** Le presse-papiers de l'utilisateur est rendu après un collage
  réussi ; il n'est **pas** rendu si le collage a échoué ou est désactivé (le
  texte doit y rester).
- **I-6** Collage automatique désactivé : **aucune** touche simulée.
- **I-30** Une dictée destinée à un agent n'est **jamais perdue** : elle est
  remise au panneau **après** le fil de cet agent (sinon le premier fil reçu
  bascule le brouillon et l'efface), y compris quand le panneau est à créer.

### Vie privée

- **I-7** Rien ne quitte la machine, sauf ce qui est envoyé à un agent (et le
  téléchargement des modèles). Transcription et synthèse vocale : locales.
- **I-8** **Aucun agent sélectionné au lancement** : une dictée ne part pas
  chez Claude parce qu'un robot l'était la veille.
- **I-9** Le micro n'est autorisé qu'à nos propres pages (`file://`), en audio
  seul ; aucune autre permission.
- **I-10** Pas de whisper sur du silence (F-4).

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
- **I-18** Une ouverture du panneau que l'utilisateur n'a pas demandée
  (dictée pour ailleurs, demande d'autorisation) ne lui prend **pas** le
  clavier — y compris quand il avait été fermé par × (jamais `restore()` dans
  ce cas). Le texte dicté est collé **avant** que le panneau s'ouvre.

### Agents : processus et confiance

- **I-19** Interrompre = demander à Claude Code d'arrêter son tour ; tuer le
  processus seulement en dernier recours, après 5 s (lancé par une commande
  enveloppe, seule l'enveloppe mourrait). Quitter attend de même. Fermer un
  processus = fermer son entrée (Claude Code sort de lui-même), le tuer
  seulement après le même délai.
- **I-20** Un message IPC n'est accepté que de la fenêtre qui a le droit de
  l'envoyer : chaque fenêtre sur ses propres canaux (`agent:*` de l'icône,
  `conv:*` du panneau, `bubble:*` de la bulle…).
- **I-21** Le panneau ne navigue jamais ; un lien ne s'ouvre que s'il est en
  `http(s)`, dans le navigateur ; un fichier joint est **montré** dans le
  gestionnaire de fichiers, jamais **ouvert** (un script se lancerait), et
  seulement un chemin absolu existant.
- **I-22** Une ancienne conversation se lit, elle ne reçoit pas de message ;
  seules les sessions **de ce dossier** s'ouvrent ou se reprennent.
- **I-23** Un nouveau dossier passe par la question « Faire confiance à ce
  dossier ? » (Claude Code lancé par le SDK ne la pose pas, alors que hooks et
  serveurs MCP du projet se chargent) ; le worktree d'une PR, à chaque fois
  (I-41).
- **I-24** La consigne `<audio>` ne s'applique qu'aux sessions créées par
  l'appli, jamais aux sessions Claude Code habituelles.
- **I-25** Un message n'est jamais envoyé à un agent au travail (le texte est
  gardé : brouillon, ou presse-papiers). Une course de VibeCoder n'est pas
  un message à l'agent : elle part dans sa propre conversation (F-115) ; son
  avis de fin attend que la conversation de l'agent soit libre.
- **I-33** Le processus d'un agent survit à la fin d'un tour, et ce qu'il a
  lancé en arrière-plan aussi ; il n'est fermé qu'à *Nouvelle session*,
  *Retirer*, *Reprendre*, à la sortie ou pour être relancé (F-59), par la fin
  de son entrée d'abord (I-19). Un message part toujours au processus **de
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
  que l'appli n'a pas écrit, n'est **jamais remplacé**, à aucune version :
  seul un fichier absent, ou encore tel que l'appli l'a écrit (empreinte du
  manifeste `.defaults.json`), prend le défaut. Manifeste illisible : rien
  n'est remplacé. Les variantes des skills (`skills/<nom>--<modèle>/`, F-106)
  ne sont pas des fichiers de l'utilisateur : générées, hors manifeste,
  réécrites à chaque démarrage.
- **I-36** VibeCoder ne fait **jamais travailler Fable** de lui-même : un
  skill livré fixe haiku, sonnet ou opus, ou garde le modèle de l'agent ;
  rien dans le plugin livré (skills, agents) ne nomme Fable ; aucune action
  livrée ne le nomme ni ne change de modèle (`/model`) ; une variante
  générée (F-106) fixe haiku, sonnet ou opus, et une action n'accepte que
  ces modèles. Seul un clic de
  l'utilisateur y passe l'agent (coût).
- **I-37** Le principal ne lit pour VibeCoder que la note et les tests que git
  lui donne, **dans le dossier de l'agent** (`..` et liens résolus ; ni
  chemin absolu, ni NUL), et les sorties de cet agent **sous leurs noms
  connus** (F-95 ; ni `..`, ni autre dossier qu'`invariants/`, ni un lien). Une
  page désigne un fichier par son **id dans le dernier relevé**, jamais par un
  chemin : un id en forme de chemin, ou égal au chemin d'un fichier du relevé,
  ne désigne rien (I-34) ; un commit, par son rang (`c<rang>`, `gh:c<rang>`,
  `c<rang>/<i>`, F-101), jamais par une URL. Ce que le principal écrit pour
  ouvrir (une version de la PR, un diff) va sous `files/` du dossier de
  sorties de l'agent, en lecture seule, et n'est jamais relu.
- **I-38** Dans le message d'une action, seuls `{{text}}`, les réponses aux
  questions et les remarques du brouillon, écrits par l'utilisateur (le champ,
  I-2), sont libres : insérés une fois, tels quels, jamais relus comme un
  gabarit. Un commit, un module ne sont pris que dans le **dernier relevé**
  (un hash de la branche, un rang de la Forme), un numéro de PR est un entier
  positif ; aucune autre valeur n'a de caractère de contrôle (un chemin de
  test à saut de ligne) ; une variable inconnue **fait refuser l'action**
  (l'agent lance des commandes avec ces valeurs). Le message est le gabarit,
  ses variables remplies, rien d'autre.
- **I-39** Le principal ne **modifie jamais le dépôt**, ni rien sur GitHub,
  **hors des quatre actions directes** (F-114), et celles-ci seulement au
  **clic de leur bouton** (jamais au relevé, ni d'elles-mêmes), par une
  **liste fermée** de commandes (`DIRECT_GIT` : `commit -F <sorties>/commit.md`,
  `fetch origin +pull/<n>/head:refs/vibecoder/pr/<n> <base>`, `switch <base>`,
  `pull --ff-only`, `branch -d <branche>` ; `DIRECT_GH` : `pr review <n>
  --<verdict> --body-file <fichier>`, et `pr view` pour lire), sans shell,
  git et gh derrière le préfixe, 60 s au plus ; leurs valeurs : une PR **entier
  positif**, un verdict des trois, une branche et une base refs sûrs
  (ci-dessous) pris du relevé (la base d'une PR à charger : celle que gh
  donne), un fichier écrit par l'appli dans ses sorties — aucun texte d'une
  page n'en devient un argument. Hors de là, en lecture seule :
  gh lancé sans shell (I-27), derrière le préfixe (F-111), seulement pour
  `pr view` et `pr list` (`GH_READ`), aux autres arguments fixes ; une
  branche (lue par git) passe après `--` et doit être un ref sûr (ci-dessous),
  une PR est un **entier positif** ; aucun texte d'une page n'en devient un
  argument. Et git lancé sans shell
  (I-27), seulement pour une liste fermée de sous-commandes en lecture
  (`GIT_READ` : `rev-parse`, `status`, `diff`, `log`, `show`), sans verrou
  (`--no-optional-locks` : `status` ne réécrit pas l'index), sans programme
  externe (`--no-ext-diff`, `--no-textconv`). Un ref ou un chemin venu
  d'ailleurs ne devient **jamais une option** : refusé sans lancer git s'il
  commence par « - » ou contient un NUL, et pour un ref, « .. » ou un
  caractère hors de `[A-Za-z0-9._/-]` ; `--end-of-options` là où git le
  permet. Push, rebase, checkout, ouvrir une PR, et le *via* des actions
  directes passent par l'agent, dans la conversation, avec ses autorisations.
- **I-40** Aucun HTML rendu depuis un texte (note, sortie d'un skill) : le
  Markdown de VibeCoder ne produit que du texte, du code et des liens
  `http(s)` — une balise reste du texte, un lien `javascript:`, `data:`,
  `file:`, `vbscript:` ou `//hôte` n'est pas un lien —, ouverts dans le
  navigateur (I-21).
- **I-41** Le robot temporaire d'une PR (F-110) ne naît que de la fiche
  `pr-<n>-worktree.json` que le skill a écrite **dans les sorties de l'agent
  du dépôt** (un fichier, pas un lien), après une demande de l'écran pour
  cette PR, si son `dir` est un chemin absolu, un dossier existant, la
  **racine d'un worktree du même dépôt** (même `git rev-parse
  --git-common-dir`, résolu) autre que le dossier de l'agent du dépôt, sans
  agent ; et seulement après la question de confiance **acceptée**, posée à
  chaque fois (I-23). Aucune page ne donne de dossier : l'écran ne peut que
  demander d'afficher ou de proposer le robot de la PR suivie.
- **I-42** VibeCoder ne lance **que les commandes du fichier du projet**
  (F-111) : une page désigne une commande par son **rang** (un entier du
  fichier), jamais par un texte ; un rang hors du fichier, en texte, négatif
  ou non entier ne lance rien. L'appli n'écrit ce fichier que **s'il n'existe
  pas** (la proposition du skill, l'exemple de *Modifier*), jamais
  par-dessus. Les demandes de l'agent (`run/<nom>.stop`, `.restart`) ne
  valent que pour un nom du fichier. Exception à I-27, limitée à ces
  commandes, écrites par l'utilisateur : le shell du fichier (`bash -ic`).
- **I-43** Rien de ce que l'appli a lancé ne **survit à sa sortie**, et elle
  n'arrête **que ce qu'elle a lancé** : arrêter vise le groupe du processus
  et les processus marqués de **son** jeton (dans leur environnement), rien
  d'autre ; une clé inconnue n'arrête rien ; quitter arrête tout, même un
  descendant sorti du groupe. SIGTERM, puis SIGKILL après 5 s (comme I-19).
- **I-44** Jamais **deux courses qui modifient la branche** en cours en même
  temps, ni **une lecture pendant une modification** (F-115), qu'elles
  viennent d'un clic ou de l'orchestrateur (`actions/<id>.start`), de deux
  clics sans relevé entre eux ou de deux demandes lues au même passage. Une
  course arrêtée dont l'utilisateur n'a pas encore choisi *Garder* ou
  *Annuler* compte comme en cours (retour en arrière compris).
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

### Système et code

- **I-26** Rien n'est installé dans le système : Pocket TTS et son Python vont
  dans les données de l'appli ; aucun paquet système requis par l'appli.
- **I-27** Jamais de shell pour lancer un programme (`execFile` / `spawn` avec
  arguments) : chemins et texte ne sont jamais interprétés. Seule exception :
  les commandes du fichier du projet (F-111, I-42), écrites par
  l'utilisateur, passent par le shell de ce fichier (`bash -ic`) pour trouver
  ses alias et fonctions.
- **I-28** **Pas de code propre à un bureau** (KDE, KWin…) dans le produit :
  une limite d'un gestionnaire de fenêtres se contourne à la main et se
  documente (ex. Alt+F3 → *Sur tous les bureaux*).
- **I-29** Un échec d'un service annexe (journal, wpctl, wl-paste, Pocket TTS,
  éditeur ; git, le relevé et les fichiers de VibeCoder) ne bloque jamais la
  dictée ni un agent.

---

## 13. Scénarios de non-régression

À rejouer avant chaque fusion (et après chaque étape de la migration).
« Banc » : appli lancée avec `--user-data-dir` sur un dossier temporaire,
transcription simulée en remplaçant `whisper.transcribe` (cf. les essais de la
revue de la 0.4.0). Les pages seules se comparent automatiquement à une
version publiée : `npm run test:front-diff -- v0.4.0` (`tests/front-diff/`,
mêmes scénarios, mêmes messages vers le principal, mêmes captures). Le
principal, sur l'appli réelle : `npm run test:main-diff -- <version>`
(`tests/main-diff/` : démarrage, dictée vers un agent et vers le curseur,
Copier, erreurs ; mêmes relevés).

**Dictée**
- **S-1** Maintenir, parler, relâcher dans un éditeur : bips, texte collé, le
  presse-papiers d'avant revient.
- **S-2** Clic bref, glisser : ni micro ni bip ; la position est retenue.
- **S-3** Relâcher aussitôt (< 0,4 s) ou dicter du silence : « Aucune parole
  détectée », whisper non appelé.
- **S-4** *Coller automatiquement* décoché : rien de simulé, texte dans le
  presse-papiers.
- **S-5** Dicter dans un terminal : une seule ligne, rien d'exécuté.
- **S-6** Sans robot sélectionné, l'éditeur au premier plan : texte collé
  dans l'éditeur, panneau « Dictée » ouvert à côté, l'éditeur **garde le
  clavier** ; Copier ; ×, nouvelle dictée → le panneau revient, toujours sans
  le clavier. Bulle (téléchargement, volume) : croix, survol qui retient,
  suit l'icône.
- **S-7** Discord en appel, coupure autorisée : « Micro Discord coupé »,
  rétabli au relâché ; micro déjà coupé avant → toujours coupé après.
- **S-8** Son des autres applications : une vidéo se tait pendant la dictée,
  les bips restent. Vidéo arrêtée pendant la dictée, puis relancée : le son
  revient dans les 5 s. Clic droit → *Rétablir le son et le micro Discord* :
  un flux resté coupé reprend.

**Lecture**
- **S-10** Sélection → ▶ lit ; second clic arrête ; rien de sélectionné →
  grisé ; dicter pendant une lecture l'arrête.
- **S-11** Volume changé pendant une lecture : appliqué aussitôt.

**Agents**
- **S-20** Robot sélectionné, dicter : panneau réduit, texte dans le champ,
  Entrée → la réponse arrive dans le panneau, ▶ lit le résumé. Aussi à la
  première dictée après le lancement (panneau jamais ouvert, longue session).
- **S-21** *Relire avant d'envoyer* décoché : envoi direct ; agent occupé →
  texte au presse-papiers avec l'erreur.
- **S-22** **Dictée vers un autre agent** : panneau sur alpha, ×, clic sur le
  robot beta, dicter « deux » → le champ de **beta** contient « deux », le
  brouillon d'alpha est intact (bug corrigé en revue de la 0.4.0).
- **S-23** Mode manuel, deux lectures de fichiers en parallèle : les deux
  demandes passent l'une après l'autre, l'agent ne reste pas bloqué.
- **S-24** Demande d'autorisation, rien d'affiché : panneau réduit ouvert,
  **sans focus** (aussi après une fermeture par ×), demande visible dans le
  fil ; le texte affiché est complet.
- **S-25** *Toujours autoriser* : seule la règle annoncée, pour la session.
- **S-26** *Interrompre* pendant une longue commande (lancement par
  `distrobox enter`) : arrêt en moins d'une seconde, plus rien ne tourne
  dans la box.
- **S-27** Historique : ouvrir une ancienne conversation (lecture seule, pas de
  champ), *Reprendre*, *← Conversation en cours*.
- **S-28** Pièces jointes : capture collée, image et fichier déposés, image
  choisie par 📎, texte sélectionné ; l'agent les reçoit ; le fil les montre.
- **S-29** « /comp » → /compact proposé, Entrée le choisit, le message part ;
  la jauge attend une nouvelle mesure. Deux agents de même nom dans deux
  dossiers : chacun ses commandes.
- **S-30** Panneau ouvert sur un agent, second clic sur son robot : contexte
  « Dictée » ; dicter → texte collé au curseur et montré dans le panneau,
  avec *Copier* ; clic sur le robot → retour à sa conversation, brouillon
  intact.
- **S-31** × puis robot qui répond : pastille sur le robot (panneau réduit =
  fermé).
- **S-32** Nouveau dossier : question de confiance ; *Annuler* → rien
  d'ajouté.
- **S-33** Quitter pendant un tour : l'appli attend l'arrêt de l'agent. Agent
  au repos : elle quitte aussitôt (son processus sort de lui-même).
- **S-34** Relancer l'appli : aucun robot sélectionné.
- **S-35** Panneau ouvert sur alpha, « + » → nouvel agent beta (dossier
  favori, puis dossier choisi) : le panneau montre beta, beta est sélectionné,
  dicter → le champ de beta. Panneau fermé : beta sélectionné, rien ne s'ouvre.
- **S-36** Agent dans un dossier cloné de GitHub : clic droit → *Ouvrir sur
  GitHub — o/d*, la page s'ouvre dans le navigateur. Dossier sans `.git`, ou
  origine hors GitHub : entrée grisée. `git remote set-url origin …` puis clic
  droit : le nouveau nom s'affiche.
- **S-37** Clic droit → *Ouvrir dans l'éditeur (zed)* : le dossier s'ouvre
  dans une **nouvelle** fenêtre de Zed (celle déjà ouverte garde son projet).
  `editorCommand` réglé sur un programme absent : entrée grisée,
  *Aucun éditeur trouvé* dans le menu de l'icône. Quitter l'appli : l'éditeur
  reste ouvert.
- **S-38** « Lance `sleep 30 && echo fini` en arrière-plan et préviens-moi » :
  le tour finit ; ~30 s plus tard, l'agent répond de lui-même (pastille verte,
  bip), ou au plus tard avec le message suivant. *Nouvelle session* puis
  quitter : plus aucun processus `claude` (`pgrep claude`).
- **S-39** « Lance `for i in 1 2 3 4 5 6; do echo étape $i; sleep 2; done`
  en arrière-plan » : le tour fini, le robot pulse lentement ; *⚙ Tâches (1)*
  dans l'en-tête ; le volet montre la commande, sa sortie grandit au fil
  de l'eau, puis ✓ et le résumé. Un lien dans la description (« surveille
  https://github.com/… ») s'ouvre dans le navigateur. *Nouvelle session* :
  volet vide.

**Fenêtres**
- **S-40** *Toujours au premier plan* décoché : icône, bulle et panneau
  passent sous une vidéo en plein écran.
- **S-41** Panneau agrandi redimensionné : taille retenue au lancement
  suivant ; panneau qui suit l'icône au glisser.
- **S-42** Longue conversation en réduit, ⤢ : le fil s'ouvre sur le dernier
  échange, pas en haut ; on remonte, un message arrive : la lecture reste.

**VibeCoder** (un agent dans un dépôt d'essai qui a `docs/tickets/` ; pour
*Relire*, une PR d'essai sur GitHub)
- **S-50** Clic droit sur un robot → *◧ Ouvrir VibeCoder* : panneau agrandi
  (1280×820 la première fois), en-tête (nom, `⎇` branche), parcours à
  gauche, étape en cours au centre, conversation à droite. Redimensionner :
  taille retenue, celle de la conversation (`convSize`) inchangée. Barre
  d'état : changer modèle, effort, mode → le menu du robot les montre ;
  pastille *✦ Fable · élevé* de l'étape Note → Fable, effort élevé. Un
  dossier sans `.git` : le bandeau le dit, un message part quand même.
- **S-51** alpha en VibeCoder, beta en conversation, panneau ouvert : clic
  sur beta → sa conversation telle qu'avant (réduit ou agrandi, 🕘) ; clic
  sur alpha → VibeCoder. alpha sélectionné, dicter → le texte dans le champ
  de VibeCoder. Relancer l'appli : aucun robot sélectionné (I-8), chaque
  agent retrouve sa vue.
- **S-52** Sur la base, champ vide, *Rédiger la note* : « Dictez ou écrivez
  d'abord… », rien n'est envoyé. Dicter une demande → dans le champ ;
  *Rédiger la note* : `/vibecoder:note fr <sorties> <demande>` dans le fil,
  champ vidé, boutons grisés (« L'agent travaille »), 💬 cite toujours ;
  l'agent crée la branche et la note : la branche dans l'en-tête, la note
  rendue à l'étape Note. Sur la branche, une précision dans le champ,
  *Rédiger la note* : ses questions ouvertes s'affichent ; *Envoyer les
  réponses* : « 1. … 2. … » dans le fil, puis la note à jour.
- **S-53** Une branche avec deux tests d'invariants (TypeScript, Rust) :
  *Lire en pseudo-code* (sonnet · moyen) → une carte par cas (pseudo-code,
  cas limites, garantie, attention) ; ✓ sur un cas, ✗ sur un autre (cité
  dans le champ). Modifier l'un des tests : ses cas passent « modifié
  depuis », *Lire en pseudo-code* ne relit que lui. *Relire* sur un fichier
  lu : sa lecture est refaite (et remplacée) ; *Tout relire* : tous.
- **S-54** *Relire* : *Mes PR à relire* → la liste ; la PR d'essai, *Charger
  la PR* : branche courante, copie de travail et `git status` inchangés,
  `refs/vibecoder/pr/<n>` créée ; le parcours se calcule sur la PR (note,
  invariants, commits). *Relire la note*, *Relire les commits*, *Plan de test
  à l'écran* : leurs sorties dans les étapes. Un ✗ et un 💬 complété par le
  champ → deux remarques au brouillon ; en retirer une. Brouillon vide :
  *Publier la revue* grisé. *Publier la revue* (commenter) : la revue paraît
  sur la PR d'essai, telle quelle ; l'étape Revue est faite.
- **S-55** *EN* : l'écran, les boutons, les faits du parcours en anglais ;
  une action part en anglais (`/vibecoder:… en …`), l'agent répond en
  anglais ; le fil et le champ restent en français ; un autre agent en
  VibeCoder aussi en anglais. *FR* : retour.
- **S-56** Après quelques actions, 💬 → la conversation : chaque action est
  dans le fil, comme un message tapé, avec sa réponse. *◧ Ouvrir VibeCoder* :
  retour sur l'étape en cours.
- **S-57** Menu de l'icône → *Agents Claude Code → Dossier de VibeCoder* : le
  dossier s'ouvre. Changer un libellé de `actions.fr.json` : le bouton
  change au relevé suivant ; `model: haiku` dans un skill : son bouton dit
  « haiku ». Relancer l'appli (ou une nouvelle version) : les retouches
  restent. Supprimer le fichier, relancer : il revient tel que livré.
  `actions.fr.json` cassé : les boutons d'origine.
- **S-58** Mode manuel : *Lancer les vérifications*, puis × ; à la demande
  d'autorisation, le panneau se rouvre agrandi sur VibeCoder, **sans prendre
  le clavier** (I-18), la demande dans la colonne de la conversation, le
  bouton principal disant « L'agent attend votre autorisation… ».
- **S-59** *Relire* une PR déjà fusionnée : *Charger la PR* → sa fiche, son
  état ; le bandeau « rien à relire », *Relire la note*, *Lire en
  pseudo-code*, *Relire les commits*, *Plan de test*, *Publier* grisés avec
  cette raison. Une PR ouverte : rien de grisé pour cette raison.
- **S-60** *Relire* : étape Commits → *Voir le diff* d'un commit : son diff
  s'ouvre dans l'éditeur (`files/<hash>.diff`, en lecture seule) ; *GitHub ↗* :
  la page du commit dans le navigateur ; un fichier du commit : sa version de
  la PR, en lecture seule ; *Ouvrir* sur un cas d'invariant : le fichier, à la
  ligne du cas (zed, code).
- **S-61** *Lire en pseudo-code* (*Relire les commits*) sur un skill
  `sonnet · moyen` (`opus · élevé`) : choisir *haiku* → le message part en
  `/vibecoder:lire-invariants--haiku …` (le fil le montre). Les lectures sont en anglais, en *FR* comme en *EN*.
- **S-62** L'agent travaille sur un skill : *⏹ Arrêter* → le tour s'arrête
  comme par *Interrompre* (« Interrompu. »), les boutons se rallument.
- **S-63** Pas de carte « Prochaine étape » : les actions de l'étape sont
  sous son titre, celle qui fait avancer en tête. Une carte de sortie
  (relecture du diff, vérifications…) : *Relancer* la refait ; l'alignement
  et la ponytail review n'en ont pas. *Relire* : étape PR,
  *Décharger la PR* → le choix d'une PR revient. Une commande en
  arrière-plan : *⚙ Tâches* → l'onglet *Tâches (1)* à droite ;
  *Conversation* → le fil, à sa place.
- **S-64** *Relire* sur gt-plugins, une PR chargée : *Ouvrir dans un
  worktree* → « Création du worktree en cours… », le worktree dans
  `gt-plugins-worktrees/<branche>`, `yarn install` fait ; la question de
  confiance (« PR #n dans un worktree », ses réglages `.claude`) ; *Annuler*
  → pas de robot, *Ajouter le robot PR #n* ; accepter → le robot « PR #n »,
  *Aller au robot PR #n* → son VibeCoder en *Relire*, la PR chargée, le
  badge « PR #n · worktree ». Un fichier modifié dans le worktree :
  *Décharger* → refusé, l'agent du dépôt le dit, le robot reste ; sans
  modification → le worktree retiré, le robot parti, le panneau sur l'agent du
  dépôt, le brouillon de revue là.
- **S-65** gt-plugins en VibeCoder, appli sur l'hôte, `agentCommand`
  `distrobox enter dev -- …` : onglet *Processus* → « Aucune commande »,
  *Proposer les commandes* (haiku) → la commande `gear` (la fonction du
  `.bashrc`) dans `projets/<dossier>.json`. ▶ → point vert, « depuis 5 s »,
  le journal de process-compose défile ; *Processus (1)* dans l'onglet.
  L'agent, prié de relancer le serveur, écrit `run/gear.restart` → le journal
  repart. ⏹ → arrêtée, plus aucun processus de process-compose dans la box
  (`pgrep -f process-compose`). ▶ puis quitter l'appli → rien ne reste, ni
  sur l'hôte ni dans la box. Un `sleep 1000` lancé à la main dans la box
  survit à ⏹ et à la sortie. *Modifier les commandes* → le fichier dans
  l'éditeur ; une commande renommée → l'ancienne, si elle tournait, arrêtée.
- **S-66** Même appli sur l'hôte (sans gh), gh dans la box : *Créer* sur une
  branche qui a sa PR, sans `pr.json` → l'étape **PR** faite en quelques
  secondes, la carte de la PR (numéro, titre, base ← branche) ; une PR
  ouverte entre-temps sur GitHub → visible dans la minute, ou aussitôt par ↻.
  *Relire* : *Mes PR à relire* → la liste, sans message à l'agent ; la PR
  chargée fusionnée sur GitHub → le bandeau « PR déjà fusionnée » dans la
  minute. `vibeCommandPrefix` faux (`nexiste-pas`) → rien ne s'affiche de
  GitHub, rien ne bloque. *Code* sur un test Rust et un test TypeScript →
  colorés (attributs, macros, chaînes brutes ; mots-clés, chaînes…).
- **S-67** Actions directes (F-114), appli sur l'hôte, gh dans la box :
  *Préparer le commit*, puis *✓ Commiter* « direct » → « … », puis ✓ et
  « [branche abc1234] sujet » sous le bouton, le commit dans `git log`,
  `commit.md` parti, aucun message à l'agent ; rien d'indexé → ✗ et la raison,
  `commit.md` reste ; *via* → le skill dans le fil. *Relire* : un numéro,
  *Charger* → `pr-<n>.json` et `refs/vibecoder/pr/<n>`, copie de travail
  inchangée ; *Publier la revue* → la revue sur la PR d'essai. *PR mergée →
  revenir sur la base* sur une PR ouverte → ✗ « … OPEN, not merged: nothing
  done. », rien ne bouge ; fusionnée → sur la base, à jour, branche locale
  supprimée. `direct.log` : une ligne par commande.
- **S-68** Courses (F-115), *Guide*, une branche de ticket : à l'étape
  **Forme**, un mot dans le champ de l'étape, *Poser la forme* → le champ se
  vide, « en cours » et ⏹ à côté du bouton, *Actions (1)* ; pendant ce temps,
  une question dans le champ de la conversation → l'agent répond. *Écrire
  les invariants (rouges)* grisé « Une autre action est en cours » ; à
  l'étape Revue, *Lancer les vérifications et la ponytail review* grisé
  « Une action modifie la branche ».
  ⏹ → *arrêtée — à garder ou annuler*, les autres toujours grisées ;
  *Annuler* → la note revient telle qu'avant la course (`git diff` vide sur
  ce qu'elle avait touché), un autre fichier modifié à la main pendant ce
  temps reste modifié, *annulée*, les boutons se libèrent. Relancée puis *Garder*
  → ses changements restent. *Lancer les vérifications et la ponytail
  review* → deux lignes *en cours* (la ponytail review demandée par la
  course des vérifications). Une course finie → une ligne
  « VibeCoder : « … » finie — … » dans le fil (après le tour en cours de la
  conversation, s'il y en a un) ; une course arrêtée → aucune. Mode
  *manuel* : la demande d'autorisation d'une course dans l'onglet
  *Actions*, *Autoriser* → elle reprend. *Nouvelle session* → l'onglet se
  vide.
- **S-69** L'orchestrateur (F-115, F-103) : « Lance la relecture du diff »
  → `actions/review-diff.start`, la course part (onglet *Actions*), l'avis
  de fin arrive ; « où en sont les actions ? » → il lit `actions.json` et répond.
  Pendant *Poser la forme* (clic), « lance les vérifications » → *en
  attente* dans `actions.json` (`waiting`, avec la raison), puis part
  d'elle-même à la fin de la forme, sans qu'on redemande. « Arrête-la » →
  `.stop`, *arrêtée*, pas d'avis de fin. *Guide*, sans rien demander : il ne
  lance rien. *Vibe* : le fil d'Ariane, sans clic, et la zone Vibe ; une
  petite demande, *Rédiger la note* → la note et ses questions, sans
  orchestrateur, pas de *Valider et développer* tant qu'une question est
  ouverte ; les réponses envoyées, *Valider et développer* → les actions
  s'enchaînent une à une dans l'onglet *Actions* (forme, invariants, …), la
  conversation libre entre deux, aucune question de la note tranchée par
  l'agent ; ⏹ sur l'une d'elles → elle attend *Garder* / *Annuler*,
  l'orchestrateur ne tranche pas.
- **S-70** Le parcours guidé, *Guide*, *Créer*, une branche sans note : pas
  d'onglets d'étapes ; le parcours n'ouvre que la Note, les autres étapes
  visibles sans clic, Ctrl+3 ne fait rien. Plus loin : ni *Vérifier
  l'alignement* ni *Ponytail review* ; *✓ Commiter* seulement un commit
  préparé ; l'étape PR sans PR : *Valider la feature* seule ; la PR ouverte :
  *Diagnostiquer la CI* et *Release candidate* ; fusionnée : *PR mergée →
  revenir sur la base* et *Release officielle*.

---

## 14. Limites connues

- Windows : agents et VibeCoder non essayés ; pas de sélection jointe (le
  Ctrl+C simulé interromprait un terminal) ; l'historique du presse-papiers
  (Win+V) garde le texte lu à voix haute.
- Windows : `code` est un `code.cmd`, qu'on ne lance pas sans shell ; régler
  `editorCommand` sur le chemin de `Code.exe`.
- Le panneau prend le focus : sous KDE, il ne va sur tous les bureaux qu'à la
  main (Alt+F3), réglage perdu quand il se rouvre de lui-même (F-64).
- Un processus Claude Code par agent utilisé depuis le lancement (quelques
  centaines de Mo chacun), jusqu'à *Nouvelle session*, *Retirer* ou la sortie ;
  et un par course de VibeCoder en cours ou arrêtée (F-115).
- Réponses en texte brut dans le fil (Markdown non rendu, sauf blocs de code
  et liens ; VibeCoder rend celui de la note et des sorties, F-104).
- Les tâches de fond d'un lancement précédent de l'appli ne sont pas
  montrées (le volet lit le flux du processus, pas la transcription).
- Le renommage d'un agent et la commande de lancement passent par
  `config.json`.
- VibeCoder suppose le dossier de l'agent à la racine de son dépôt : dans un
  sous-dossier, git donne les chemins depuis la racine, lus depuis le
  dossier de l'agent — note et tests introuvables.
- VibeCoder : les sorties de *Créer* suivent la branche au relevé (F-95) : ce
  qu'un skill écrit juste après avoir quitté une feature pour une autre, avant
  que le relevé le voie, est mis de côté avec la feature quittée. La note
  n'est trouvée que si la branche porte le ticket ou la version et change la
  note. Les sorties des branches finies restent dans
  `vibecoder-out/<agent>/branches/`, et les références `refs/vibecoder/pr/<n>`
  dans le dépôt (`git update-ref -d`).
- VibeCoder : chaque lecture ou relecture par un skill se paie. En
  sous-contexte, ≈ 0,02 $ sur Haiku (≈ 25 000 jetons : le prompt de Claude
  Code et le skill ; SDK 0.3.285, Claude Code 2.1.285), quelle que soit la
  longueur de la conversation, bien davantage sur Opus à effort élevé ;
  *Générer les modules restants*, *Valider et développer*, les releases : longs et
  coûteux. Une lecture d'invariants n'est refaite que si le fichier change.
  Choisir un modèle plus léger pour une étape coûte moins, au prix de la
  qualité (`lire-invariants` sur Haiku a été écarté par le banc, F-106).
- VibeCoder : les fichiers écrits pour être ouverts
  (`vibecoder-out/<agent>/files/`) restent jusqu'au suivant du même nom ; un
  fichier d'un commit s'ouvre, en *Relire*, dans sa version à la tête de la
  PR (supprimé depuis : rien ne s'ouvre).
- VibeCoder : le relevé lance quelques git en lecture toutes les 4 s
  (panneau visible) et jusqu'à une fois par seconde pendant un tour
  (`git status` : 63 ms sur GT-2020, 1 761 fichiers suivis).
- VibeCoder : la note se lit par ses titres (guide, A.1) ; une note qui ne
  les suit pas laisse ses étapes vides.
- VibeCoder : seuls ses libellés passent en anglais ; la conversation (fil,
  champ, volet des tâches, détail du contexte), les menus et les messages de
  l'appli restent en français.
- VibeCoder : les images d'un Markdown ne sont pas montrées (leur texte
  reste, en lien s'il est en `http(s)`) ; pas d'🕘 Historique (revenir à la
  conversation) ; une revue de PR est un commentaire d'ensemble, pas de
  commentaire sur une ligne du diff.
- VibeCoder, *Relire dans un worktree* (F-110) : le robot temporaire arrive
  et part au relevé, donc seulement quand un agent est en VibeCoder dans le
  panneau ; la demande d'*Ouvrir dans un worktree* est gardée en mémoire —
  après un redémarrage, *Ajouter le robot PR #n*. Les validations faites sur
  le robot partent avec lui (son brouillon de revue, lui, revient).
- VibeCoder, *Processus* (F-111) : les demandes de l'agent (`.stop`,
  `.restart`) et l'adoption d'une proposition se font au relevé, donc VibeCoder
  affiché ; l'appli tuée net (crash, `kill -9`) laisse tourner ce qu'elle a
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
  (I-19) et *Annuler* échoue de même. Les courses, et la
  session de la note que reprend *Envoyer les réponses*, sont en mémoire :
  après un redémarrage de l'appli, l'onglet *Actions* est vide et les
  réponses partent dans une nouvelle conversation. Les demandes de
  l'orchestrateur ne sont lues qu'une fois VibeCoder affiché (au moins un
  relevé).
- VibeCoder, GitHub sans IA (F-112), coloration (F-113) : un échec de gh (pas connecté, pas
  d'origine GitHub, box absente) ne se dit pas ; *Mes PR à relire* ne change
  rien. La coloration du code ne connaît pas les expressions régulières de
  JavaScript (un guillemet dedans colore la fin de la ligne en chaîne) ni
  les commentaires imbriqués de Rust ; un extrait (*Code*) commencé dans un
  commentaire ou une chaîne se colore mal — le texte, lui, reste exact.

## 15. Décisions en attente

- **Autorisation qui sélectionne le robot** : aujourd'hui, l'ouverture d'office
  du panneau pour une demande d'autorisation sélectionne l'agent (le robot
  affiché et le robot sélectionné vont ensemble) ; la dictée suivante va donc
  à cet agent (dans son champ, à relire). Laissé tel quel : cohérent avec
  « le panneau suit le robot sélectionné ».
