# Whisper — spécification de comportement

Comportement de l'appli (état de la **0.4.0**, inchangé en **0.5.0**, où les
pages et le principal passent en TypeScript, les pages en React) : ce qu'elle fait, ce qu'elle ne doit
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
| **Panneau** | `app/panel/` (`panel-app.tsx`) | `src/preload/panel.ts` | oui (on y écrit) ; jamais pris quand il s'ouvre de lui-même | conversation de l'agent sélectionné (champ de saisie) ou contexte « Dictée » |

Les pages sont en React + TypeScript, construites par Vite dans
`out/renderer/` et chargées en `file://`, rangées en `app/` (fenêtres),
`core/` (métier), `helpers/`, `technicals/` (ponts, micro, DOM). Le contrat
des ponts (types et canaux de chaque fenêtre) est dans `src/shared/bridge` ;
dans chaque page, seul le fichier `*-app.tsx` connaît son pont. Découpage et
règles : `AGENTS.md`, `docs/tickets/refactor/0.5.0-front-react.md` et
`0.5.0-main-typescript.md`.

Toutes : sans cadre, hors de la barre des tâches, `contextIsolation`,
`sandbox`, préchargement minimal (`contextBridge`). Le principal
(`src/main/`) est le seul à lire la config, toucher au presse-papiers, lancer
des processus.

### Modules du principal (`src/main/`, construit dans `out/main/`)

| Module | Rôle |
|---|---|
| `app/lifecycle` | démarrage (une instance, aucun agent sélectionné, permissions), sortie |
| `app/windows` | les trois fenêtres : créer, placer, montrer (icône, bulle, panneau) |
| `app/controllers` | dictée (coupures, transcription, destination, modèle), lecture, agents, contenu du panneau |
| `app/menus` | menus de l'icône, des robots, du « + », du trombone |
| `app/ipc` | une table de gestionnaires par fenêtre, écoutée par `technicals/ipc` |
| `core/config` | réglages, démarrage, dossiers favoris et couleurs, confiance |
| `core/dictation` | transcription d'une ligne, destination, collage et presse-papiers |
| `core/sound` | couper et rétablir ce qu'on a coupé |
| `core/agents` | tours, file d'autorisations, interruption, sonde, transcriptions, sessions |
| `core/conversation` | actions et demandes d'autorisation écrites, pièces jointes |
| `core/guards` | permissions des pages, liens, fichiers montrés |
| `technicals/*` | `ipc` (expéditeur contrôlé), `whisper-cli`, `paste`, `windows-helper`, `pipewire`, `clipboard`, `selection`, `pocket-tts`, `claude`, `journal`, `images`, `paths`, `config-file` |
| `helpers` | découper une commande, français ou anglais, une ligne |

Scripts lancés par l'appli : `resources/scripts/` (`windows-helper.ps1`,
`pocket-helper.py`), livrés hors de l'archive comme les binaires.

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
  `conv:copy`, `conv:openLink`, `conv:showFile`.

Vers les pages : `tts:state`, `tts:chunk`, `tts:end`, `tts:speakReply`,
`agents:state` (icône) ; `bubble:show` (bulle) ; `conv:thread`, `conv:notice`,
`conv:dictation`, `conv:focusInput`, `conv:attached` (panneau).

Chaque fenêtre n'est écoutée que sur ses propres canaux, et un message d'une
autre fenêtre est ignoré (`technicals/ipc`, cf. I-20).

### Fichiers de données (`userData`)

| Fichier | Contenu |
|---|---|
| `config.json` | réglages (§ 9), relu à chaque usage |
| `whisper/` | modèle téléchargé (et whisper-cli posé à la main) |
| `pocket-tts/` | Python, Pocket TTS, PyTorch installés par uv |
| `consigne-agents.md` | consigne ajoutée au prompt système des agents |
| `agents.log` (`.old`) | journal des agents, 1 Mo puis rotation |

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
model, effort, mode, sessionId, contextWindow }`. Nom = nom du dossier,
modifiable dans `config.json`.

**F-52 « + »** : *Nouvel agent dans un dossier favori* (dossiers déjà choisis
sans agent), *Choisir un autre dossier…*, *Oublier un dossier favori* ;
entrées grisées si Claude Code est introuvable. Un dossier **jamais choisi**
passe par la confirmation de confiance (I-31). Le nouvel agent est
sélectionné.

**F-53 Couleur par dossier** : tirée au hasard parmi 8 (de préférence une
couleur libre), enregistrée, gardée si l'agent est retiré puis recréé ;
modifiable au clic droit. Robot, liseré du micro, panneau la portent.

**F-54 Clic sur un robot**, panneau fermé : réponse non lue ou demande
d'autorisation → son panneau s'ouvre ; sinon la sélection bascule (second
clic : la dictée revient au curseur). Panneau ouvert : le robot affiche sa
conversation dans le panneau (les robots servent d'onglets) ; second clic sur
le robot affiché et sélectionné → désélection, le panneau passe au contexte
« Dictée ».

**F-55 État d'un robot** : clignote au travail ; « ? » demande d'autorisation ;
pastille verte = réponse non lue (bip 660 Hz à l'arrivée) ; erreur. La réponse
de l'agent affiché dans le panneau est **lue d'office** (jamais de pastille).

**F-56 Clic droit sur un robot** : nom, dossier ; *✎ Écrire un message…*
(panneau + focus du champ) ; couleur du dossier ; modèle (défaut, fable, opus,
sonnet, haiku) ; effort (défaut, low → max) ; mode (manuel, accepter les
modifications, auto, plan) ; *Dernier échange* ; *⤢ Conversation complète* ;
*Interrompre* (au travail) ; *Nouvelle session* (oublie la session) ; *Retirer*
(le dossier reste favori).

**F-57 Mode et modèle changés en cours de tour** s'appliquent aussitôt ;
passer en *Accepter les modifications* accorde les demandes de modification de
fichier en attente.

### Tours

**F-58 Lancement** : le Claude Code **de l'utilisateur** (`agentCommand`, vide
→ `claude` trouvé dans PATH ou `~/.local/bin`). Commande personnalisée
(« distrobox enter dev -- mise exec -- claude ») : découpée (guillemets
gérés), les arguments du SDK passent derrière, stdin/stdout tels quels.
Options : `cwd` = dossier, réglages `user`, `project`, `local`, préréglage
`claude_code` + la consigne de `consigne-agents.md`.

**F-59 Un tour = un `query()`** ; le premier crée la session (retenue dans
`sessionId`), les suivants la reprennent. Images avant le texte ; sans image,
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
(forcées ou non).

### Panneau de conversation

**F-63 Un seul panneau**, attaché à l'icône (centré sur le micro, au-dessus ou
en dessous selon la place, toujours à l'écran), qui **suit l'icône** au
glisser. Un contenu à la fois : la conversation de l'agent sélectionné, ou,
aucun ne l'étant, le contexte « Dictée » (F-76) — jamais deux panneaux.
- **Réduit** (par défaut) : 560 px de large, à la hauteur de son contenu
  (160–560 px) — le dernier échange : votre dernier message et ce qui suit.
- **Agrandi** (⤢ ; ⤡ pour revenir) : tout le fil, ouvert en bas (sur le
  dernier échange), l'🕘 Historique ;
  redimensionnable par ses bords, taille retenue (`convSize`, défaut 720×700,
  au moins 380 px de large et 160 px de haut).

**F-64 Croix** : le panneau est **réduit au sens du système** (minimize), pas
masqué — rouvert par un clic (`restore`, avec le clavier), il garde « sur
tous les bureaux » (Alt+F3 sous KDE). Rouvert **de lui-même** (dictée,
demande d'autorisation), il est masqué puis montré sans activation : il ne
prend pas le clavier (`restore` le prendrait, vérifié sous X11), revient sur
le bureau courant et oublie ce réglage. Réduit, il ne compte plus comme
ouvert : les notifications repassent par les robots et la bulle.

**F-65 En-tête** : pastille de couleur, intitulé de la conversation (celui de
Claude Code ; « Nouvelle conversation » sinon), nom et dossier, jauge du
contexte, Historique (agrandi), ⤢/⤡, ×.

**F-66 Fil** : messages avec leur heure (date complète au survol) ; texte tel
quel, liens cliquables, blocs ``` en blocs de code ; pièces jointes de vos
messages (aperçus d'images ≤ 800 px, clic : en grand ; fichiers, clic : montrés
dans le gestionnaire de fichiers ; sélection jointe, à déplier) ; actions de
l'agent sur une ligne, chemins raccourcis (`/home/…` et `/var/home/…`) ;
au-delà de 6 actions, les dernières, le reste à déplier ; longues lignes
repliées. Commandes affichées telles quelles ; leur sortie et le résumé d'une
compaction en messages « système ». Au travail : trois points animés et temps
écoulé au bas du fil. Le fil reste en bas quand un message arrive, sauf si
l'on lit plus haut. Mis à jour au plus toutes les 800 ms pendant un tour.

**F-67 Historique** (agrandi) : sessions Claude Code du dossier (de l'appli et
d'un terminal ; pas des worktrees), par date ; une ancienne conversation
s'ouvre **en lecture seule** (pas de champ) ; *← Conversation en cours* ;
*Reprendre cette conversation* (impossible pendant un tour) en fait la session
de l'agent. Sessions retrouvées sous `/home/…` comme sous `/var/home/…`.

**F-68 Champ de saisie** (réduit et agrandi, conversation en cours seulement) :
Entrée envoie, Maj+Entrée va à la ligne ; il grandit jusqu'à 160 px.
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

**F-75 Fenêtre** : au-dessus des autres (`onTop`), hors barre des tâches,
liens vers le navigateur seulement, jamais de navigation.

## 8. Menu du clic droit (icône, bouton de lecture)

État du modèle ; Langue ; Micro (défaut du système + micros énumérés) ; Bip ;
Couper le son des autres applications (Linux, Windows) ; Coller
automatiquement ; Toujours au premier plan (icône, bulles, panneau ;
appliqué aussitôt) ; Afficher le texte transcrit ; Autoriser la coupure du
micro Discord (Linux, Windows) ; Rétablir le son et le micro Discord
(dépannage, F-34) ; Lecture à voix haute (installer, source,
désactivée, langue, voix, volume) ; Agents Claude Code (afficher, relire
avant d'envoyer, commande, changer la commande, consigne, journal) ; Ouvrir le
dossier whisper ; Modifier la configuration ; À propos (page de la version) ;
Quitter.

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
| `agents`, `agentFolders` | `[]` | |
| `agentSelected` | `null` | remis à `null` au lancement |
| `agentReview` | `true` | dictée dans le champ |
| `convSize` | — | taille du panneau agrandi |

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
agents arrêtés.

## 11. Paquets et CI

- PR et `master` (Linux, Windows) : typage, tests (invariants et variants) et
  construction des pages et du principal ; essai de l'assistant PowerShell
  (réponses attendues `0, ok, \d+, ok, err`).
- Tag `vX.Y.Z` : paquets (AppImage sur Ubuntu 22.04, exe portable), avec
  `whisper-cli` v1.9.4 (Vulkan + repli processeur, essayé sur `jfk.wav`) et
  `uv` 0.12.20 ; Release GitHub. `vX.Y.Z-rc.N` : pré-version. Déclenchement
  manuel : artefacts sans publication.
- L'exécutable embarqué du SDK Claude (230 Mo par plateforme) est **exclu** du
  paquet ; `resources/scripts/` (`*.ps1`, `*.py`) livré hors de l'asar.

---

## 12. Invariants — ce que l'appli ne doit jamais faire

Testés automatiquement (`npm run test:invariants`, dossiers
`tests/invariants/` protégés) : I-2 à I-6 (texte collé, une ligne,
presse-papiers, collage désactivé), I-8, I-9, I-11 (page et principal), I-12,
I-13 à I-17, I-19, I-20, I-21, I-23, I-24, I-27, I-29. Les autres (focus,
fenêtres, I-1, I-18, I-22, I-28) : scénarios du § 13 et bancs de comparaison.

### Focus et collage

- **I-1** L'icône et la bulle ne prennent **jamais** le focus : le texte doit
  arriver dans l'application où est le curseur.
- **I-2** Ce qui est collé ou envoyé à un agent par la dictée est **toujours**
  ce que whisper vient de rendre, jamais un texte fourni par une page. Seule
  exception : le texte du champ du panneau, écrit ou relu par l'utilisateur.
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
  enveloppe, seule l'enveloppe mourrait). Quitter attend de même.
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
  serveurs MCP du projet se chargent).
- **I-24** La consigne `<audio>` ne s'applique qu'aux sessions créées par
  l'appli, jamais aux sessions Claude Code habituelles.
- **I-25** Un message n'est jamais envoyé à un agent au travail (le texte est
  gardé : brouillon, ou presse-papiers).

### Système et code

- **I-26** Rien n'est installé dans le système : Pocket TTS et son Python vont
  dans les données de l'appli ; aucun paquet système requis par l'appli.
- **I-27** Jamais de shell pour lancer un programme (`execFile` / `spawn` avec
  arguments) : chemins et texte ne sont jamais interprétés.
- **I-28** **Pas de code propre à un bureau** (KDE, KWin…) dans le produit :
  une limite d'un gestionnaire de fenêtres se contourne à la main et se
  documente (ex. Alt+F3 → *Sur tous les bureaux*).
- **I-29** Un échec d'un service annexe (journal, wpctl, wl-paste, Pocket TTS)
  ne bloque jamais la dictée ni un agent.

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
  Entrée → la réponse arrive dans le panneau, ▶ lit le résumé.
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
- **S-33** Quitter pendant un tour : l'appli attend l'arrêt de l'agent.
- **S-34** Relancer l'appli : aucun robot sélectionné.

**Fenêtres**
- **S-40** *Toujours au premier plan* décoché : icône, bulle et panneau
  passent sous une vidéo en plein écran.
- **S-41** Panneau agrandi redimensionné : taille retenue au lancement
  suivant ; panneau qui suit l'icône au glisser.
- **S-42** Longue conversation en réduit, ⤢ : le fil s'ouvre sur le dernier
  échange, pas en haut ; on remonte, un message arrive : la lecture reste.

---

## 14. Limites connues

- Windows : agents non essayés ; pas de sélection jointe (le Ctrl+C simulé
  interromprait un terminal) ; l'historique du presse-papiers (Win+V) garde le
  texte lu à voix haute.
- Le panneau prend le focus : sous KDE, il ne va sur tous les bureaux qu'à la
  main (Alt+F3), réglage perdu quand il se rouvre de lui-même (F-64).
- Réponses en texte brut (Markdown non rendu, sauf blocs de code et liens).
- Le renommage d'un agent et la commande de lancement passent par
  `config.json`.

## 15. Décisions en attente

- **Autorisation qui sélectionne le robot** : aujourd'hui, l'ouverture d'office
  du panneau pour une demande d'autorisation sélectionne l'agent (le robot
  affiché et le robot sélectionné vont ensemble) ; la dictée suivante va donc
  à cet agent (dans son champ, à relire). Laissé tel quel : cohérent avec
  « le panneau suit le robot sélectionné ».
