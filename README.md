# Whisper — dictée flottante

Une icône ronde, toujours au premier plan. **Maintenez le clic** dessus, parlez,
relâchez : la voix est transcrite **en local** par [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
et le texte est collé là où se trouve le curseur, dans n'importe quelle application.
C'est la dictée de l'icône compacte de Cockpit, seule.

![L'icône de dictée et son bouton de lecture](docs/icone.png)

- **Maintenir** : dicter (bip aigu = parlez, bip grave = fin).
- **Glisser** : déplacer l'icône (la position est retenue).
- **Bouton ▶ accolé** : lire à voix haute le texte sélectionné (ou le presse-papiers), en local avec [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) (Kyutai).
- **Robots accolés** (optionnels) : des agents [Claude Code](https://claude.com/claude-code), un par dossier de projet, à qui parler par la dictée.
- **Clic droit** : langue, micro, bip, son des autres applications, collage automatique, premier plan, affichage du texte, micro Discord, lecture à voix haute, dossier whisper, configuration, version (*À propos*), quitter.

À la fin d'une dictée, une bulle montre le texte transcrit à côté de l'icône :
**un clic dessus le copie** dans le presse-papiers. Elle suit l'icône quand on
la déplace, se ferme avec sa croix et disparaît seule après 10 s (le survol
suspend ce délai). Désactivable : clic droit → *Afficher le texte transcrit*.

L'icône, ses bulles et le panneau des conversations restent **au-dessus des
autres fenêtres**. Pour une vidéo en plein écran : clic droit → décocher
*Toujours au premier plan* ; ils redeviennent des fenêtres comme les autres.

![La bulle du texte transcrit, au-dessus de l'icône](docs/bulle.png)

L'icône ne prend jamais le focus : le texte arrive dans l'application active.
Le presse-papiers est restauré après le collage (sauf si le collage a échoué,
ou si le collage automatique est désactivé : le texte y reste, pour un Ctrl+V
manuel).

## Installation

### Paquet autonome (recommandé)

Dans les [Releases](https://github.com/GearProductions/whisper/releases) :

- **Windows** : `whisper-dictation-<version>-win.exe`, exécutable portable, sans
  installation (il se décompresse à chaque lancement : quelques secondes).
- **Linux** : `whisper-dictation-<version>-linux.AppImage`, à rendre exécutable
  (`chmod +x`) puis lancer.

Le paquet contient l'appli, whisper-cli (accéléré sur toute carte graphique
par Vulkan, sinon sur le processeur) et `uv`. Les modèles, trop lourds pour le
paquet, se téléchargent **au premier usage**, une seule fois, dans les données
de l'appli (tableau ci-dessous) :

- **au premier lancement**, le modèle de dictée (548 Mo) ; la bulle et le
  menu en montrent l'avancement ;
- **à la première lecture à voix haute**, Pocket TTS et son Python (~400 Mo à
  télécharger, 1,2 Go sur le disque), puis ses modèles.

Paquets non signés : Windows affiche un avertissement SmartScreen (*Informations
complémentaires* → *Exécuter quand même*).

### Depuis les sources

```bash
npm install
npm start
```

### whisper.cpp (depuis les sources)

`npm run build:whisper` compile whisper-cli dans `resources/bin/` (git, cmake,
un compilateur C++ et le SDK Vulkan), comme le paquet ; il ne reste que le
modèle, téléchargé au premier lancement. Sinon, placez `whisper-cli`
(`whisper-cli.exe` sous Windows) et un modèle `ggml-*.bin` dans le dossier
whisper (clic droit → *Ouvrir le dossier whisper*) :

| OS      | Dossier                                    |
|---------|--------------------------------------------|
| Windows | `%APPDATA%\whisper-dictation\whisper\`     |
| Linux   | `~/.config/whisper-dictation/whisper/`     |

Le modèle se pose à la racine du dossier ; l'exécutable peut être jusqu'à deux
niveaux plus bas (`bin/Release/` d'une release Windows, `build/bin/` d'un build
Linux). L'exécutable et le modèle sont cherchés séparément : dans ce dossier,
puis dans `resources/bin/` (paquet), puis dans l'installation de **Cockpit**
(`…/cockpit/whisper/`).

### Collage sous Linux

Il faut un outil pour simuler Ctrl+V :

- **X11** : `xdotool` (`sudo apt install xdotool`)
- **Wayland** : `wtype` (Sway, Hyprland…) ou `ydotool` (avec son démon `ydotoold`)

Sans outil, le texte reste dans le presse-papiers. Note : la plupart des
terminaux Linux collent avec Ctrl+Maj+V, pas Ctrl+V.

Sous **KDE Plasma (Wayland)**, simuler une touche demande une autorisation
(« contrôle de la saisie ») à chaque collage, sauf à l'accorder une fois pour
toutes. Pour ne rien simuler du tout : clic droit → décocher *Coller
automatiquement là où est le curseur* (réglage `autoPaste`). Le texte dicté
reste alors dans le presse-papiers, à coller soi-même.

### Lecture à voix haute (Pocket TTS)

Le petit bouton ▶ à droite de l'icône lit le texte **sélectionné** dans
n'importe quelle application, ou le **presse-papiers** (au choix). Il est grisé
quand il n'y a rien à lire ; pendant la lecture il devient ■ : un clic arrête.

Sous **Windows**, qui n'a pas de sélection « primaire », le clic envoie Ctrl+C
à l'application active, lit le presse-papiers puis le rend tel qu'il était.
Le bouton ne peut donc pas savoir d'avance s'il y a une sélection : il reste
actif (« Rien à lire » sinon). L'historique du presse-papiers de Windows
(Win+V) garde une trace du texte lu.

Clic droit → *Lecture à voix haute* : source du texte, ou *Désactivée* pour
masquer le bouton ; *Volume…* ouvre un curseur à côté de l'icône, appliqué
aussitôt, y compris à une lecture en cours.

La voix est produite en local, sur le processeur, par
[Pocket TTS](https://github.com/kyutai-labs/pocket-tts) de Kyutai. S'il manque,
l'appli l'installe elle-même au premier clic sur ▶ (ou clic droit → *Installer
Pocket TTS*), avec `uv`, dans ses données : Python, Pocket TTS et PyTorch en
version processeur (~400 Mo à télécharger, 1,2 Go sur le disque). Rien n'est
installé dans le système. `uv` est livré avec le paquet ; depuis les sources,
`npm run fetch:uv` le télécharge dans `resources/bin/` (ou celui du système
sert). Une installation faite à la main sert aussi :

```bash
uv tool install pocket-tts==3.3.0 --index https://download.pytorch.org/whl/cpu
```

Les modèles se téléchargent à la première lecture (cache Hugging Face).

L'audio arrive au fil de la génération : la lecture commence ~0,1 s après le
clic. Le modèle se charge au survol du bouton (~3 s, ~1,5 Go de mémoire par
langue) et se décharge après 10 min sans lecture.

**Langues et voix.** Le texte est lu en français ou en anglais, selon la
langue détectée sur l'ensemble du texte (clic droit → *Langue du texte* pour
l'imposer). La voix française dit très bien les termes techniques anglais.
Trois voix par langue, fournies par Kyutai (clic droit → *Voix française* /
*Voix anglaise*) : Estelle, Mary, Marius (homme) ; Jane, Anna, Alba (homme).
Toutes sous licence libre (CC0 ou CC-BY 4.0) ; le clonage d'une autre voix
demande des poids à accès restreint, non utilisés ici.

Sous **Wayland**, il faut aussi `wl-paste` (paquet `wl-clipboard`) : le
compositeur ne donne la sélection qu'à la fenêtre qui a le focus, et l'icône
ne le prend jamais. Dans une distrobox, celui de l'hôte est utilisé.

### Agents Claude Code

Clic droit → *Agents Claude Code* → *Afficher les agents* (désactivé par
défaut). Il faut [Claude Code](https://claude.com/claude-code) installé et
connecté sur la machine : l'appli lance **le vôtre** (rien d'embarqué, pas de
clé API).

Un agent est une conversation Claude Code attachée à un **dossier de projet**
(un seul par dossier), représenté par un petit robot à droite de l'icône :

- **« + »** : un nouvel agent, dans un **dossier favori** (déjà choisi une
  fois, sans agent pour l'instant) ou dans un dossier à choisir, qui devient
  favori. Chaque **dossier** reçoit une couleur au hasard, qu'il garde : son
  robot, le liseré du micro et ses bulles la portent.
- **Clic sur un robot** : il est sélectionné (violet). La dictée du gros bouton
  lui est alors **destinée** au lieu d'être collée. Un second clic le
  désélectionne.
- **Relecture avant l'envoi** : au relâché, une fenêtre *Message pour…*
  s'ouvre au-dessus de l'icône avec le texte dicté, à corriger. Dicter à
  nouveau l'ajoute au brouillon ; cliquer un autre robot change le
  destinataire. On peut y joindre du **contexte** :
  - des **images** (glissées-déposées ou collées par Ctrl+V : capture d'écran,
    photo…), envoyées à Claude — réduites si elles dépassent 1568 px ;
  - d'autres **fichiers**, glissés depuis le gestionnaire de fichiers : l'agent
    reçoit leur chemin et les lit lui-même ;
  - le **texte sélectionné** au moment de la dictée (Linux) : montré en aperçu,
    joint **seulement si l'on coche** la case ; *↻ Relire la sélection* reprend
    ce qui est sélectionné maintenant, dans n'importe quelle application.
    Sous Windows, lire la sélection demanderait un Ctrl+C simulé (qui, dans un
    terminal, interromprait le programme) : collez-la plutôt dans le texte.

  **Ctrl+Entrée** envoie, **Échap** abandonne. Sans parler (micro
  indisponible, lieu calme) : clic droit sur le robot → *✎ Écrire un message…*
  ouvre la même fenêtre, vide, à remplir au clavier. Clic droit → *Agents Claude
  Code* → *Relire avant d'envoyer* (décoché) : la dictée part aussitôt, sans
  fenêtre.
- **Pendant qu'il travaille**, le robot clignote. **« ? »** : il demande une
  autorisation (mode manuel) — la bulle propose *Autoriser*, *Toujours
  autoriser*, *Refuser*. Elle s'ouvre d'elle-même si aucune bulle n'est
  affichée ; si vous lisez déjà quelque chose (la réponse d'un autre agent…),
  elle ne la remplace pas : cliquez le robot quand vous êtes prêt.
  **Pastille verte** : il a répondu ; un clic ouvre la bulle avec sa réponse
  (un clic dessus la copie) et un bouton **▶ Écouter**. En tête, en gris, le
  message qu'on lui avait envoyé (replié sur 3 lignes, un clic le déplie) : avec
  plusieurs agents, on sait à quoi il répond. Dicter la suite à ce même agent
  laisse la bulle affichée, pour la relire en répondant ; la fenêtre de
  relecture s'ouvre alors à côté d'elle. **⤢** l'agrandit (ci-dessous).
- **Conversation complète** (⤢ d'une bulle, ou clic droit sur le robot) : la
  bulle agrandie en un grand panneau **attaché à l'icône**, à sa place. Comme
  elle, il reste au-dessus des autres fenêtres (voir *Toujours au premier
  plan*), sur tous les bureaux virtuels, et **suit l'icône** quand on la
  déplace : on ne le perd pas. Redimensionnable par ses bords (la taille est
  retenue). **⤡ Réduire** le ramène à la bulle (la dernière réponse) ; **×** le
  ferme. Chaque conversation porte son **intitulé**, celui que lui donne Claude
  Code ; chaque message, son **heure**. Pendant que l'agent travaille, le fil le
  suit et l'anime (avec le temps écoulé). Les **liens** s'ouvrent dans le
  navigateur (aussi depuis la bulle). Les **pièces jointes** de vos messages se
  voient : aperçu des images (clic : en grand), fichiers (clic : montrés dans le
  gestionnaire de fichiers), texte sélectionné (à déplier).
  **🕘 Historique** (panneau seulement) : toutes les conversations passées du
  dossier (de l'appli comme celles lancées dans un terminal), par intitulé et
  date. Une ancienne conversation s'y lit, en lecture seule ; *← Conversation en
  cours* y revient ; *Reprendre cette conversation* en refait la session en
  cours de l'agent — celle qu'elle remplace reste dans l'historique, comme
  après *Nouvelle session*.
- **Les robots servent d'onglets** : une conversation à la fois dans le
  panneau, celle du robot sélectionné ; panneau ouvert, cliquer un robot y
  affiche la sienne (et le sélectionne : la dictée lui ira). Un second clic sur
  le robot affiché rend la dictée au curseur.
- **Champ de saisie** au bas du panneau : écrire à l'agent affiché (**Entrée**
  envoie, **Maj+Entrée** va à la ligne ; un brouillon par agent, pièces jointes
  comprises). Panneau ouvert, **la dictée y arrive** au lieu d'ouvrir la fenêtre
  de relecture : on la relit, la complète, l'envoie. **Pièces jointes**
  directement dans le champ : glisser-déposer ou **Ctrl+V** (images envoyées à
  Claude, autres fichiers par leur chemin) ; **📎** : choisir des images ou
  fichiers, ou joindre le texte sélectionné (aperçu dans le menu). Pendant que
  l'agent travaille, on écrit mais on n'envoie pas.
- **Panneau ouvert**, il tient lieu de bulle (aucune bulle ne s'affiche
  par-dessus). Réponse de l'agent affiché : lue d'office, ni pastille ni bip ;
  sa demande d'autorisation : dans le fil, avec les mêmes boutons que la bulle.
  Les autres agents signalent les leurs sur leur **robot** (pastille, « ? ») :
  un clic affiche leur conversation. Panneau réduit ou fermé : retour à la
  bulle, et une demande en attente s'y affiche.
- **Clic droit sur un robot** : couleur du dossier, modèle, effort, mode
  (manuel, accepter les modifications de fichiers, auto, plan), dernière
  réponse, **conversation complète** (et historique), interrompre, *Nouvelle
  session* (repartir de zéro), retirer (son dossier reste favori). Le **mode** et le **modèle**
  changés pendant qu'il travaille s'appliquent aussitôt ; passer en *accepter
  les modifications* accorde la demande de modification de fichier en attente.

**Ce qui quitte la machine, ce à quoi l'on fait confiance.**

- La transcription reste locale, mais ce qui est dicté à un agent part chez
  Claude, comme tout message tapé dans Claude Code. Le robot sélectionné (et le
  liseré du micro à sa couleur) dit où ira la dictée ; au lancement de l'appli,
  aucun agent n'est sélectionné. Les images jointes et la sélection cochée
  partent avec le message.
- Choisir un **nouveau dossier** demande confirmation : Claude Code y est lancé
  avec les réglages du projet (`.claude/` : hooks, serveurs MCP, autorisations),
  qui peuvent exécuter des commandes. N'ajoutez que des dossiers connus.
- La bulle d'autorisation montre la commande ou le fichier **en entier, tel
  quel** : c'est ce texte qui est autorisé. *Toujours autoriser* n'apparaît que
  si Claude Code propose une règle, l'affiche, et ne vaut que **pour la session
  en cours** — rien n'est écrit dans les réglages du projet ou de l'utilisateur.
- Les modes *accepter les modifications* et *auto* ne demandent plus rien (ou
  presque) : à réserver aux dossiers sous git.

**Réponse écrite et réponse orale.** Chaque réponse de l'agent se termine par
un bloc `<audio>…</audio>` : un résumé court, sans formatage, fait pour
l'oreille. La bulle montre la réponse sans ce bloc ; ▶ ne lit que lui, avec le
moteur de lecture à voix haute. La consigne n'est ajoutée qu'aux sessions
créées par l'appli : vos sessions Claude Code habituelles ne changent pas.

Cette consigne est un fichier, `consigne-agents.md`, à côté de `config.json` :
clic droit → *Agents Claude Code* → *Modifier la consigne des agents* l'ouvre
dans votre éditeur. Relue à chaque message ; supprimée, elle revient par
défaut ; vidée, plus de consigne (▶ lit alors la réponse entière).

**Commande de lancement** (réglage `agentCommand`, clic droit → *Agents Claude
Code* → *Changer la commande de lancement…*) : vide, c'est `claude`. À régler
quand les outils du projet vivent ailleurs — l'appli ajoute ses arguments
derrière :

```json
"agentCommand": "distrobox enter dev -- mise exec -- claude"
```

La commande doit transmettre l'entrée et la sortie standard telles quelles,
c'est par là que l'appli dialogue avec Claude Code : pas de shell de connexion
(`bash -lc …`), dont les scripts de profil consomment l'entrée.

**Autorisations en série, interruption, journal.**

- Plusieurs demandes d'autorisation peuvent arriver à la fois (l'agent lance
  des outils en parallèle) : elles attendent en file, la bulle les montre
  l'une après l'autre (« 1 autre en attente ») et chaque clic ne répond qu'à
  celle affichée. Une demande sans réponse bloquerait l'agent indéfiniment.
- *Interrompre* demande à Claude Code d'arrêter son tour, ce qui arrête aussi
  la commande en cours. Tuer le processus ne suffirait pas : avec une commande
  de lancement comme `distrobox enter …`, seule l'enveloppe mourrait, et Claude
  Code continuerait seul dans le conteneur. Il n'est tué qu'en dernier recours,
  s'il n'a pas obéi en 5 s. Quitter l'appli attend de même que les agents
  aient arrêté.
- Clic droit → *Agents Claude Code* → *Ouvrir le journal des agents*
  (`agents.log`, à côté de `config.json`) : début et fin de chaque tour, chaque
  demande d'autorisation, sa réponse et son délai, les interruptions. Une
  demande qui n'a pas pu aboutir y est notée **ÉCHEC**, et la réponse de
  l'agent le signale par un ⚠.

### Son des autres applications

Sur haut-parleurs, une vidéo ou un appel seraient captés par le micro et
transcrits avec la dictée. Clic droit → *Couper le son des autres applications
pendant la dictée* (désactivé par défaut) : leur son est coupé le temps de
l'enregistrement, puis rétabli. Les bips de l'appli restent audibles ; une
application déjà muette le reste. Même mécanisme que pour le micro Discord
ci-dessous (PipeWire sous Linux, Core Audio sous Windows).

### Micro Discord

Clic droit → *Autoriser la coupure du micro Discord* (désactivé par défaut) :
en appel Discord, le micro est coupé le temps de l'enregistrement, puis
rétabli. Un micro déjà coupé le reste.

C'est le flux de capture de Discord qui est coupé, pas le bouton « muet » de
Discord : son icône ne change pas. À la place, une bulle *Micro Discord coupé*
s'affiche le temps de l'enregistrement, une fois la coupure confirmée.

- **Linux** : dans PipeWire, par `wpctl` (livré avec WirePlumber, installé
  d'office avec PipeWire).
- **Windows** : la session de capture de Discord, par l'API audio de Windows
  (Core Audio). Rien à installer.

## Configuration

`config.json`, à côté du dossier whisper (clic droit → *Modifier la configuration*) :

| Clé          | Rôle                                                              |
|--------------|-------------------------------------------------------------------|
| `lang`       | `fr`, `en`, `auto`…                                               |
| `vocabulary` | Mots propres à votre domaine, pour guider whisper (300 car. max) |
| `sound`      | Bips de début / fin                                               |
| `agentsEnabled` | Afficher les agents Claude Code                               |
| `agentCommand` | Commande qui lance Claude Code (vide : `claude`)               |
| `agents`     | Les agents : dossier, nom, modèle, effort, mode, session (gérés par l'appli ; `name` se modifie ici) |
| `agentFolders` | Dossiers favoris proposés par « + », chacun avec sa couleur    |
| `agentReview` | Relire (et joindre du contexte) avant d'envoyer à un agent ; `false` : envoi direct |
| `onTop`      | Icône, bulles et panneau au-dessus des autres fenêtres            |
| `convSize`   | Taille du panneau des conversations (retenue au redimensionnement) |
| `muteOthers` | Couper le son des autres applications pendant l'enregistrement   |
| `autoPaste`  | Coller le texte là où est le curseur ; `false` : il reste dans le presse-papiers |
| `showText`   | Bulle du texte transcrit à la fin d'une dictée                    |
| `discordMute`| Couper le micro Discord pendant l'enregistrement                 |
| `speak`      | Bouton de lecture : `selection`, `clipboard` ou `off`             |
| `speakVolume`| Volume de lecture, de `0` à `1`                                   |
| `speakLang`  | `auto` (français ou anglais, détecté), `fr` ou `en`               |
| `speakVoices`| Voix par langue : `{ "fr": "estelle", "en": "jane" }`             |
| `size`       | Taille de l'icône en px (32–200, appliquée au redémarrage)        |

Relu à chaque dictée : pas besoin de relancer (sauf pour `size`).

## Paquets

Construits par la CI (`.github/workflows/ci.yml`) pour chaque nouvelle version.
Pousser un tag crée la Release :

```bash
git tag v0.2.0 && git push origin v0.2.0
```

La CI construit alors l'exe et l'AppImage (version prise sur le tag) et les
publie dans la Release GitHub de ce tag.

Pour essayer une version avant de la publier : un tag de **pré-version**
(`v0.3.0-rc.1`, depuis la branche de la PR). Même construction, mais la
Release est marquée pré-version : la version officielle (« Latest ») ne change
pas. Une fois validée et la PR fusionnée, le tag `v0.3.0` sur `master`.

Les PR ne font que les vérifications rapides ; *Actions* → *CI* → *Run workflow* construit les paquets sans rien
publier (artefacts).

En local, sur le système visé (`dist/`) :

```bash
npm run build:whisper && npm run fetch:uv   # binaires embarqués (resources/bin/)
npm run dist:linux                          # AppImage
npm run dist:win                            # exe portable (sous Windows)
```
