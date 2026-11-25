# Whisper — VibeCoder, à la voix

Une fenêtre : **VibeCoder**, un écran de développement qui fait travailler des
agents [Claude Code](https://claude.com/claude-code), un par dossier de projet,
en suivant le guide du dépôt étape par étape. On leur parle au clavier ou à la
voix : la voix est transcrite **en local** par
[whisper.cpp](https://github.com/ggml-org/whisper.cpp), et leurs réponses
s'écoutent, lues en local par [Pocket TTS](https://github.com/kyutai-labs/pocket-tts)
(Kyutai).

- **Dicter** : chaque zone où l'on écrit à un agent (le champ de la
  conversation, un commentaire, la réponse libre à une question) a, en bas à droite, un **micro** puis *Envoyer*. **Maintenez** le
  micro, parlez, relâchez (bip aigu = parlez, bip grave = fin) : le texte
  arrive dans ce champ, à relire avant d'envoyer.
- **Écouter** : *▶ Écouter* sous une réponse de l'agent lit son résumé à voix
  haute.
- **Les agents**, tout à gauche de l'en-tête, en petits robots : un clic en
  affiche un, **+** en crée un ; **Chercher** (Ctrl+K) les retrouve, avec leurs
  branches et leurs PR.
- **⚙ Réglages** (l'engrenage, en haut à droite) : la **page des réglages**,
  par-dessus l'écran, au centre, comme la palette (Échap ou un clic dehors la
  ferme). À gauche les catégories, à droite les réglages de celle qu'on
  choisit, modifiables sur place, sans ouvrir `config.json` : une liste ou une
  case s'écrit aussitôt, un champ de texte en le quittant ou par Entrée. Une
  valeur que l'appli ne garderait pas telle quelle n'est pas écrite.
  - *Dictée* : l'état du modèle whisper, la langue de dictée, le vocabulaire,
    le micro, le bip de début / fin, la coupure du son des autres applications
    et du micro Discord, *Rétablir le son et le micro Discord* (dépannage) ;
  - *Lecture à voix haute* : installer Pocket TTS, la langue du texte, les voix
    française et anglaise, le volume ;
  - *Interface* : la **langue de l'interface** (FR / EN : l'écran, les boutons),
    et à part la **langue de ce qu'écrivent les agents** (la note, les
    questions, les relectures…), la taille au-delà de laquelle un artefact est
    tronqué ;
  - *Actions* : le **modèle** et l'**effort** de chaque action (plus de listes
    sur les boutons) ;
  - *Agents* : la commande de lancement de Claude Code, l'éditeur, le terminal,
    le préfixe des commandes du projet et de `gh`, la consigne des agents, leur
    journal, le dossier de VibeCoder ;
  - *Général* : le dossier whisper, le fichier de configuration, la version
    (*À propos*), quitter.

C'est une fenêtre comme les autres (barre des tâches, redimensionnable, taille
retenue) mais sans le cadre du système : l'**en-tête de VibeCoder sert de
barre de titre** (on le glisse pour déplacer la fenêtre), et les boutons
réduire, agrandir, fermer sont tout à droite. La fermer quitte l'appli. Au
lancement, elle revient sur l'agent affiché la dernière fois ; sans agent,
elle propose *Nouvel agent…*.

Pour qui modifie le code : [SPEC.md](SPEC.md) décrit le comportement attendu,
les invariants à ne jamais casser et les scénarios de non-régression.

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

- **au premier lancement**, le modèle de dictée (548 Mo) ; le message en tête
  de la fenêtre et la page *⚙ Réglages* en montrent l'avancement ;
- **à la première lecture à voix haute**, Pocket TTS et son Python (~400 Mo à
  télécharger, 1,2 Go sur le disque), puis ses modèles.

Paquets non signés : Windows affiche un avertissement SmartScreen (*Informations
complémentaires* → *Exécuter quand même*).

### Depuis les sources

```bash
npm install
npm start          # construit les pages et le principal (out/) puis lance l'appli
```

Pour qui modifie le code (règles : [AGENTS.md](AGENTS.md)) :

```bash
npm run typecheck                    # TypeScript des pages et du principal
npm test                             # tests (npm run test:invariants : les invariants seuls)
npm run test:front-diff -- <tag ou branche>  # la page comparée à une version (0.14.0 ou plus) : mêmes écrans, mêmes messages
npm run test:main-diff -- <tag ou branche>   # appli réelle comparée à une version (0.14.0 ou plus) : mêmes résultats
npm run test:contract                        # appli réelle (profil neuf, faux claude) appelée par la commande vibecoder, toutes les commandes de la table, un résumé à la fin ; à la main, comme le banc
```

**Itérer sans attendre une release.** Lancée depuis les sources
(`app.isPackaged` faux), l'appli compare toutes les 2 s ce qui est construit
dans `out/` à ce qu'elle a chargé (par empreinte du contenu) et le montre dans
l'en-tête de VibeCoder, à côté de Chercher :

- les pages seules ont changé : **Recharger l'interface** recharge la
  fenêtre ; le principal et les agents continuent ;
- le principal ou un pont a changé : **Redémarrer**, avec une pastille,
  relance l'appli (des pages neuves face à l'ancien principal pourraient
  casser) ; si des agents travaillent, l'appli le demande d'abord ;
- rien : aucun bouton.

Pour que `out/` suive les sources, les reconstruire en continu à côté de
l'appli :

```bash
npx vite build --watch                            # les pages (src/renderer)
npx vite build -c vite.main.config.mts --watch    # le principal et les ponts
```

La version publiée n'a rien de tout cela.

### whisper.cpp (depuis les sources)

`npm run build:whisper` compile whisper-cli dans `resources/bin/` (git, cmake,
un compilateur C++ et le SDK Vulkan), comme le paquet ; il ne reste que le
modèle, téléchargé au premier lancement. Sinon, placez `whisper-cli`
(`whisper-cli.exe` sous Windows) et un modèle `ggml-*.bin` dans le dossier
whisper (*⚙ Réglages* → *Général* → *Ouvrir le dossier whisper*) :

| OS      | Dossier                                    |
|---------|--------------------------------------------|
| Windows | `%APPDATA%\whisper-dictation\whisper\`     |
| Linux   | `~/.config/whisper-dictation/whisper/`     |

Le modèle se pose à la racine du dossier ; l'exécutable peut être jusqu'à deux
niveaux plus bas (`bin/Release/` d'une release Windows, `build/bin/` d'un build
Linux). L'exécutable et le modèle sont cherchés séparément : dans ce dossier,
puis dans `resources/bin/` (paquet), puis dans l'installation de **Cockpit**
(`…/cockpit/whisper/`).

### Lecture à voix haute (Pocket TTS)

*▶ Écouter*, sous chaque réponse d'un agent, lit à voix haute son résumé
audio (le bloc `<audio>` de la réponse, plus bas) ; une autre lecture prend
la place de celle en cours. Commencer une dictée arrête la lecture (sinon le
micro la capterait).
*⚙ Réglages* → *Lecture à voix haute* : langue du texte, voix, **volume**
(de 0 à 1, appliqué aussitôt, y compris à une lecture en cours).

La voix est produite en local, sur le processeur, par
[Pocket TTS](https://github.com/kyutai-labs/pocket-tts) de Kyutai. S'il manque,
l'appli l'installe elle-même au premier clic sur *Écouter* (ou *⚙ Réglages* →
*Lecture à voix haute* → *Installer Pocket TTS*), avec `uv`, dans ses données : Python, Pocket TTS et PyTorch en
version processeur (~400 Mo à télécharger, 1,2 Go sur le disque). Rien n'est
installé dans le système. `uv` est livré avec le paquet ; depuis les sources,
`npm run fetch:uv` le télécharge dans `resources/bin/` (ou celui du système
sert). Une installation faite à la main sert aussi :

```bash
uv tool install pocket-tts==3.3.0 --index https://download.pytorch.org/whl/cpu
```

Les modèles se téléchargent à la première lecture (cache Hugging Face).

L'audio arrive au fil de la génération : la lecture commence peu après le
clic. Le modèle se charge à la première lecture (~3 s, ~1,5 Go de mémoire par
langue) et se décharge après 10 min sans lecture.

**Langues et voix.** Le texte est lu en français ou en anglais, selon la
langue détectée sur l'ensemble du texte (*⚙ Réglages* → *Lecture à voix
haute* → *Langue du texte* pour l'imposer). La voix française dit très bien les termes techniques anglais.
Trois voix par langue, fournies par Kyutai (*Voix française* / *Voix
anglaise*, même menu) : Estelle, Mary, Marius (homme) ; Jane, Anna, Alba (homme).
Toutes sous licence libre (CC0 ou CC-BY 4.0) ; le clonage d'une autre voix
demande des poids à accès restreint, non utilisés ici.

### Agents Claude Code

Il faut [Claude Code](https://claude.com/claude-code) installé et connecté sur
la machine : l'appli lance **le vôtre** (rien d'embarqué, pas de clé API).

Un agent est une conversation Claude Code attachée à un **dossier de projet**
(un seul par dossier), représenté par un petit robot tout à gauche de
l'en-tête de la fenêtre :

- **Les robots** : tous les agents, chacun à la couleur de son dossier, dans
  un **ordre fixe** (celui de la configuration ; un worktree ou une PR, plus
  petit, juste après son agent) : afficher un agent ne déplace personne.
  L'agent affiché est à sa place, en **badge éclairé** : son robot, son dépôt,
  le titre d'un worktree ou d'une PR ; un clic dessus ouvre la palette sur
  *Agents*. **Clic** sur un autre robot : il s'affiche aussitôt. **Ctrl+Tab** :
  l'agent affiché juste avant.
- **« + »** (ou **Ctrl+N**) : un nouvel agent, dans un **dossier favori** (déjà
  choisi une fois, sans agent pour l'instant) ou dans un dossier à choisir,
  qui devient favori. Le nouvel agent est affiché. Chaque **dossier** reçoit
  une couleur au hasard, qu'il garde : son robot la porte.
- **Worktrees** : les agents d'un même dépôt git forment une famille,
  reconnue toute seule. L'agent du dossier principal est le parent ; l'agent
  d'un autre worktree du dépôt, un **robot enfant**, plus petit, rangé juste
  après lui. Clic droit sur le parent → *Worktrees* : les worktrees du dépôt
  qui n'ont pas d'agent, chacun avec *Ouvrir un agent ici* (un dossier jamais
  choisi passe par la question de confiance) ; l'enfant porte le nom de sa
  branche et la couleur du parent. C'est un agent comme un autre ; il reste
  jusqu'à ce qu'on le retire (ou avec son worktree : *Retirer le worktree*, en
  [VibeCoder](#vibecoder)), et retirer le parent ne le retire pas. VibeCoder
  crée aussi des worktrees et leur robot : pour relire une PR, pour une
  nouvelle demande.
- **L'état d'un robot** (jamais celui de l'agent affiché, dont la réponse est
  lue d'office) : il **clignote** pendant qu'il travaille ; **« ? »** : il
  attend votre réponse (une demande d'autorisation, ou une question sans
  réponse envoyée au questionnaire de l'agent), jusqu'à ce qu'elle parte ; il
  prime sur le « ! » et sur la pastille verte ; **pastille verte** : il a fini (une réponse non lue) ;
  **« ! »** : il a échoué (*en échec*). Chacun avec le **bip** de la réponse (660 Hz,
  réglage *Bip*), seulement pour ce qui vient d'apparaître chez un autre agent :
  le quitter ne fait pas sonner ce que vous aviez sous les yeux. Afficher un
  agent, ou lire sa conversation, efface sa pastille verte ; un « ! » reste
  jusqu'à l'ouverture de son onglet *Actions*. Au repos, un
  robot qui surveille des **tâches de fond** (celles de sa conversation et de
  ses actions) pulse lentement, et son infobulle le dit (« surveille n tâches
  de fond »). Fenêtre en arrière-plan : une notification du système pour
  une question ou un échec ; un clic dessus affiche l'agent.
- **Chercher** (en haut à droite, **Ctrl+K**) : la **palette**, par portées
  (*Tout*, *Agents*, *Branches*, *PR* ; **Tab** : la portée suivante). Les
  agents par dépôt, avec leurs worktrees et leurs PR, chacun son étape et son
  état (*travaille*, *attend ta réponse*, *vient de finir*, *en échec*, *au
  repos* ou « surveille n tâches de fond ») ; les branches du dépôt, chacune avec l'agent qui la tient ; les
  PR ; les actions (*Nouvel agent…*, *Créer une branche…*, *Gérer les
  branches et les PR…* — Ctrl+Maj+B —, *Mettre de côté les changements*).
  Chaque mot tapé filtre, sans casse. **Entrée** : aller à l'agent, ou
  basculer ici sur la branche ; **⇧ Entrée** sur une branche que personne ne
  tient : la vue des branches ; **Échap** ferme.
- **La conversation** de l'agent affiché, dans l'onglet *Conversation*, à
  droite de VibeCoder (plus bas). Elle porte son **intitulé** (celui que lui
  donne Claude Code) ; chaque message, son **heure** ; les réponses de l'agent
  sont mises en forme (Markdown : titres, gras, listes, code, liens), avec
  **▶ Écouter** ; vos messages restent tels que vous les avez écrits. Pendant
  que l'agent travaille, le fil le suit et l'anime (avec le temps écoulé).
  Les **liens** s'ouvrent dans le navigateur. Les **pièces jointes** de vos
  messages se voient : aperçu des images (clic : en grand), fichiers (clic :
  montrés dans le gestionnaire de fichiers), texte sélectionné d'un message venu du
  socket (à déplier).
- **L'🕘 Historique**, une icône à droite de l'onglet *Conversation* : les
  conversations passées du dossier (de l'appli comme celles lancées dans un
  terminal), par intitulé et date, à la place du fil. Une ancienne
  conversation s'y lit, en lecture seule ; *← Conversation en cours* y
  revient ; *Reprendre cette conversation* en refait la session en cours —
  celle qu'elle remplace reste dans l'historique, comme après *Nouvelle
  session*.
- **Le champ de saisie**, en bas de la conversation : **Entrée** envoie (le
  message s'affiche aussitôt dans le fil), **Maj+Entrée** va à la ligne ; un
  brouillon par agent. Le **micro**, en bas à droite avant *Envoyer* :
  maintenu, il dicte dans ce champ (à relire, compléter, envoyer). **Pièces
  jointes** : glisser-déposer ou **Ctrl+V** (images envoyées à Claude —
  réduites au-delà de 2576 px ou 3,75 Mpx, le maximum des modèles : une capture en 1440p passe entière —, autres fichiers par leur chemin, que l'agent
  lit lui-même) ; le **trombone**, au début du champ : choisir des images ou
  fichiers. Pendant que l'agent travaille, on écrit mais on
  n'envoie pas.
- **Commandes de Claude Code** : un champ qui commence par **« / »** propose les
  commandes de l'agent — celles de Claude Code (`/compact`, `/context`…), ses
  skills, celles du projet —, avec leur description ; flèches, Entrée ou Tab
  pour choisir. Le message part comme si on l'avait tapé dans Claude Code.
- **Jauge du contexte** (barre d'état) : la part de la fenêtre de contexte
  occupée (orange à 80 %, rouge à 90 %). Un clic : le détail, par catégorie
  (instructions, outils, skills, fichiers de mémoire, messages…), et
  **Compacter (/compact)** pour résumer la conversation et libérer de la place.
  La mesure vient de la dernière réponse ; le détail, de Claude Code, lancé le
  temps de répondre (la conversation n'en est pas touchée).
- **Autorisations** (mode manuel) : la demande s'affiche dans le fil de
  l'agent, *Autoriser*, *Toujours autoriser*, *Refuser* ; pour un autre agent
  que l'affiché, son « ? » attend qu'on l'affiche.
- **Clic droit sur un robot** : couleur du dossier, modèle, effort, mode
  (manuel, accepter les modifications de fichiers, auto, plan), *✎ Écrire un
  message…*, interrompre, *Nouvelle session* (repartir de zéro), retirer (son
  dossier reste favori). Le **mode** et le **modèle** changés pendant qu'il
  travaille s'appliquent aussitôt ; passer en *accepter les modifications*
  accorde la demande de modification de fichier en attente. En tête du menu,
  *Ouvrir sur GitHub — propriétaire/dépôt* ouvre la page du dépôt (grisé si
  le dossier n'a pas d'origine GitHub). *Ouvrir dans l'éditeur (zed)* ouvre
  le dossier dans une nouvelle fenêtre de l'éditeur de code (grisé si aucun
  n'est trouvé). *Ouvrir un terminal ici* ouvre le terminal du système dans
  le dossier de l'agent (grisé si aucun n'est trouvé).

**Entre deux messages**, l'agent garde son Claude Code lancé : ce qu'il a lancé
en arrière-plan (une commande, une surveillance) continue, et il vous prévient
quand c'est fini (pastille verte, comme une réponse). *Nouvelle session* ou
*Retirer* l'arrêtent, comme la sortie de l'appli. Chaque agent utilisé garde
ainsi un Claude Code en mémoire (quelques centaines de Mo).

**Tâches de fond** : tant qu'une commande en arrière-plan, une surveillance
ou un sous-agent tourne pour l'agent, l'onglet *Tâches (n)* de VibeCoder (ou
*⚙ Tâches* de la barre d'état) les montre :
chaque tâche telle que l'agent la décrit, son état, son temps écoulé, sa
commande et, pour une commande, les dernières lignes de sa sortie
(*Montrer le fichier* la montre dans le gestionnaire de fichiers). Les
tâches finies restent jusqu'à la sortie de l'appli. Le volet ne fait rien :
pour arrêter une tâche, demandez-le à l'agent.

**Ce qui quitte la machine, ce à quoi l'on fait confiance.**

- La transcription reste locale : le texte dicté arrive dans le champ, et
  rien ne part chez Claude avant que vous l'envoyiez, comme tout message tapé
  dans Claude Code. Les pièces jointes (images, fichiers) partent
  avec le message. Rien de l'interface ne se charge depuis le réseau (les
  polices sont livrées avec l'appli).
- Choisir un **nouveau dossier** demande confirmation : Claude Code y est lancé
  avec les réglages du projet (`.claude/` : hooks, serveurs MCP, autorisations),
  qui peuvent exécuter des commandes. N'ajoutez que des dossiers connus.
- La demande d'autorisation (dans le fil) montre la commande ou le fichier **en entier, tel
  quel** : c'est ce texte qui est autorisé. *Toujours autoriser* n'apparaît que
  si Claude Code propose une règle, l'affiche, et ne vaut que **pour la session
  en cours** — rien n'est écrit dans les réglages du projet ou de l'utilisateur.
- Les modes *accepter les modifications* et *auto* ne demandent plus rien (ou
  presque) : à réserver aux dossiers sous git.

**Réponse écrite et réponse orale.** Chaque réponse de l'agent se termine par
un bloc `<audio>…</audio>` : un résumé court, sans formatage, fait pour
l'oreille. Le fil montre la réponse sans ce bloc ; *▶ Écouter* ne lit que lui,
avec le moteur de lecture à voix haute. La consigne n'est ajoutée qu'aux sessions
créées par l'appli : vos sessions Claude Code habituelles ne changent pas.

Cette consigne est un fichier, `consigne-agents.md`, à côté de `config.json` :
*⚙ Réglages* → *Agents* → *Modifier la consigne des agents*
l'ouvre dans votre éditeur. Relue à chaque message ; supprimée, elle revient
par défaut ; vidée, plus de consigne (*Écouter* lit alors la réponse entière).

**Commande de lancement** (réglage `agentCommand`, *⚙ Réglages* → *Agents*
→ *Commande de lancement*) : vide, c'est `claude`. À régler
quand les outils du projet vivent ailleurs — l'appli ajoute ses arguments
derrière :

```json
"agentCommand": "distrobox enter dev -- mise exec -- claude"
```

La commande doit transmettre l'entrée et la sortie standard telles quelles,
c'est par là que l'appli dialogue avec Claude Code : pas de shell de connexion
(`bash -lc …`), dont les scripts de profil consomment l'entrée.

**Éditeur** (réglage `editorCommand`, *⚙ Réglages* → *Agents* →
*Éditeur*) : vide, c'est le premier trouvé parmi `zed`, `code`,
`cursor`, `codium`, ouvert dans une nouvelle fenêtre (`-n`). Réglé, la
commande est lancée telle quelle, le dossier en dernier argument (ajouter
`-n` pour une nouvelle fenêtre) :

```json
"editorCommand": "flatpak run com.visualstudio.code -n"
```

**Terminal** (réglage `terminalCommand`, dans `config.json`) : vide, c'est le
premier trouvé — sous Linux `konsole`, `gnome-terminal`, `kitty`,
`alacritty`, `wezterm`, `xterm` ; sous Windows `wt`, sinon `cmd` —, ouvert
dans le dossier de l'agent. Réglé, la commande est découpée comme
`agentCommand` (guillemets respectés) et `{dir}` y est remplacé par le
dossier ; jamais de shell. Pour arriver directement dans une box :

```json
"terminalCommand": "konsole --workdir {dir} -e distrobox enter dev"
```

(Windows : `"wt.exe -d {dir}"`.)

**Autorisations en série, interruption, journal.**

- Plusieurs demandes d'autorisation peuvent arriver à la fois (l'agent lance
  des outils en parallèle) : elles attendent en file, le fil les montre
  l'une après l'autre (« 1 autre en attente ») et chaque clic ne répond qu'à
  celle affichée. Une demande sans réponse bloquerait l'agent indéfiniment.
- *Interrompre* demande à Claude Code d'arrêter son tour, ce qui arrête aussi
  la commande en cours. Tuer le processus ne suffirait pas : avec une commande
  de lancement comme `distrobox enter …`, seule l'enveloppe mourrait, et Claude
  Code continuerait seul dans le conteneur. Il n'est tué qu'en dernier recours,
  s'il n'a pas obéi en 5 s. Quitter l'appli attend de même que les agents
  aient arrêté.
- *⚙ Réglages* → *Agents* → *Ouvrir le journal des agents*
  (`agents.log`, à côté de `config.json`) : début et fin de chaque tour, chaque
  demande d'autorisation, sa réponse et son délai, les interruptions. Une
  demande qui n'a pas pu aboutir y est notée **ÉCHEC**, et la réponse de
  l'agent le signale par un ⚠.

### VibeCoder

Pour développer avec un agent en suivant le guide
[*Développer avec l'IA*](docs/dev_guide/guide-travail-dev-ia.html) sans tout
lui redire à chaque étape (« fais la note », « c'est bon, commit et passe au
suivant », « replie les fixups et sors la PR ») : VibeCoder, l'écran de
l'appli, montre pour l'agent affiché où en est
le travail. Le système enchaîne les étapes : vous validez la note, vous
regardez aux deux pauses, vous répondez aux questions `[toi]`, et le reste se
demande à l'agent, qui lance les actions (le bon message, avec le bon skill et
le bon modèle) par la CLI de VibeCoder. Un seul parcours, pour **créer**
une feature sur la branche du dossier de l'agent comme pour **relire** une PR
du dépôt : vous n'avez pas à choisir, l'appli décide de votre rôle (créateur ou
relecteur, plus bas).

**Le dépôt.** Il faut un dossier sous git, à la racine du dépôt, et ses notes
de ticket sous `docs/tickets/` ; sans dépôt, l'écran le dit et la
conversation reste utilisable. Ce qu'on a commencé sur l'écran d'un agent
(réponses aux questions, modèle choisi, verdict de la
revue, étape choisie, et par étape : le fichier choisi, les dossiers pliés,
le défilement ; plus d'onglet ni de vue retenus) l'attend quand on revient sur lui,
le temps que l'appli tourne (un redémarrage l'oublie). En changeant d'agent, l'écran garde l'affichage d'avant jusqu'à ce
que la conversation et le relevé du nouvel agent soient là : jamais de page
vide, l'en-tête et les robots ne bougent pas.

**Des notes hors du projet** (0.16.0). Un projet public, ou qui code en
anglais, n'a pas à garder des notes en français : ajoutez la ligne
`docs/tickets/` au fichier `.git/info/exclude` du dépôt (partagé par ses
worktrees ; rien n'est écrit dans le dépôt). Git ignore alors les notes, et
VibeCoder le voit seul : pas de réglage. Il les retrouve sur le disque, ne les
commite jamais (le premier commit ne garde que les squelettes et les
invariants rouges) et la PR ne les cite pas. Le prix : la note vit dans la
copie de travail, retirer le worktree de la branche l'efface. Relire la PR d'un
autre, dont la note est restée chez lui : « pas de note », sans reproche.

**L'écran.**

- en haut, l'**en-tête** (la barre de titre de la fenêtre) : à gauche les
  robots des agents et **+** (plus haut), puis la **branche** — un bouton, qui
  ouvre (et referme) la **vue des branches**, plus bas — avec *Pull* et
  *Rebase* à côté ; le badge *Relecteur* quand vous relisez la PR d'un
  autre ; au milieu, le nom **VibeCoder** ; à droite **Artefacts** (plus
  bas), **Chercher** (Ctrl+K, la palette), puis en icônes la conversation affichée ou
  masquée et **⚙ Réglages** (la page des réglages), puis les boutons de la
  fenêtre ;
- au centre, en tête, le **fil d'Ariane** : les étapes en une ligne (point
  plein : faite ; anneau qui pulse : en cours ; gris : à venir), tous leurs faits
  au survol (l'en-tête de l'étape, lui, n'en répète aucun qu'elle montre déjà) ; au bout,
  l'interrupteur **Express** (le rythme, voir *Vibe*). Plus de compte
  « N commits » ni de liste des commits pour le créateur ; le relecteur garde son
  « N commits », qui déplie les commits de la branche. Il
  mène : un clic (ou Ctrl+1…6) ouvre n'importe quelle étape, faite, en
  cours ou à venir (une branche créée à la main, sans note, se gère ainsi) ;
  ouvrir une étape à venir ne lance rien ;
- sous le fil, la **ligne d'état** (créateur) : toujours là, une seule phrase qui
  dit ce que le système est en train de faire, ou ce qu'il attend de vous — « Demandez la
  note à l'agent, dans la conversation », « 2 questions : répondez dans le
  questionnaire », « Vérifiez, puis validez la note », « Le système écrit les
  modules », « Regardez vos règles, puis reprenez », « Essayez l'appli, puis
  reprenez », « La PR est ouverte, la CI tourne », « La PR est verte : à vous de la
  fusionner » —, avec à côté **le bouton du moteur** quand il sert (à toutes les étapes ;
  *Arrêter* pendant que le système enchaîne, *Reprendre* quand il est arrêté ;
  pas de *Reprendre* quand il ne reste rien à faire : la PR verte et chaque étape
  faite, fusionnée ou fermée).
  La note qui a perdu son ✓, un ✓ d'étape que vous avez retiré : la ligne le
  dit, sans bouton. Rien de tout cela pour le relecteur ;
- dessous, sur toute la largeur, l'étape choisie — la note du ticket, ce
  que les skills ont produit —, avec son en-tête (son nom, son badge d'état, ses
  faits), **sans bouton d'action** pour le créateur (le relecteur garde sa
  rangée d'actions, et le *Relancer* de ses cartes) ; sans champ : aucune étape
  n'en a ; les champs où l'on écrit à un agent
  (les réponses aux questions, la conversation) acceptent
  des **pièces jointes** (le trombone, glisser-déposer, Ctrl+V), qui partent avec
  l'action de leur champ ; chaque étape se lit comme décrit au *Parcours*, plus
  bas : la Forme en liste, les Invariants rangés par règle, les Modules en un arbre
  et son diff ;
- à droite, quatre onglets : la **conversation** de l'agent (fil,
  autorisations, champ et son micro, commandes « / », l'🕘 Historique au bout
  de la rangée des onglets), les **Actions**
  lancées, ses **Tâches** de fond et les **Processus** du projet (le nombre
  en cours dans l'onglet) ;
- en bas : modèle, effort et mode de l'agent (comme dans son menu), jauge du
  contexte, *⚙ Tâches* (l'onglet), l'action en cours ou « N actions en
  cours » (un clic : l'onglet *Actions*), *⏹ Arrêter* quand la conversation
  travaille, fichiers modifiés, heure du dernier relevé et, à côté, ↻
  (relire le dépôt tout de suite).

L'écran se lit sur le dépôt, sans modèle : la branche, ses commits et ses
fichiers changés, la note du ticket (trouvée parmi ces fichiers : celle nommée comme la
branche, sinon d'après le ticket — `G2-6675` — ou la version — `0.8.0` — que
porte son nom), ses tests
d'invariants, ce que les skills ont écrit. Il suit tout seul (toutes les 4 s,
et pendant que l'agent travaille).

**Les actions tournent à côté de la conversation.** Une action d'étape
(*Rédiger la note*, *Écrire les invariants (rouges)*, *Lancer les vérifications*…),
lancée par le moteur ou par l'agent (la CLI : **aucun bouton d'étape** chez le
créateur depuis la 0.16.0, rien n'est retiré de ce qu'elle sait faire), tourne dans
**sa propre conversation**, avec son skill et son
modèle, comme si vous aviez tapé `/vibecoder:note fr … votre demande` : la
conversation de l'agent reste libre, vous lui parlez pendant ce temps. Une
action qui a besoin d'un texte — la demande de feature — prend celui du **champ de
la conversation**, en bas (les étapes n'ont pas de champ) : dictez-y (son
micro, maintenu) ou écrivez, et demandez la note à l'agent ; le
texte et ses pièces jointes partent avec l'action et le champ se vide ; vide :
« Dictez ou écrivez d'abord votre demande dans le champ, puis cliquez. » et le
champ prend le clavier. *Poser la forme* et *Écrire les invariants (rouges)*
partent toujours sans texte, jamais avec votre brouillon. Chaque zone de
prompt a son micro : il donne le clavier à son champ,
et la dictée y arrive — un commentaire de relecteur, la réponse libre d'une
question —, à la place de la sélection, sans dépasser
sa longueur (pleine : rien n'est ajouté) ; une autre zone qui n'en a pas (un
éditeur de code, un champ d'une ligne) : au champ de la conversation. *Commenter* sur un passage (de la note, d'une relecture) l'y cite, à
compléter puis envoyer.

L'onglet **Actions** suit chaque action lancée : qui travaille, son état,
depuis quand, sa réponse ; pour *Générer les modules*, son avancement (la
vague en cours, les modules faits sur le total, les corrections renvoyées, une relance
Opus), lu dans le flux de l'agent : un champ absent ne montre que moins, l'état n'en
dépend pas. *Arrêter* (là, ou à côté du bouton) l'arrête à tout moment ;
vous choisissez ensuite **Garder** ce qu'elle a déjà écrit, ou **Annuler** :
les fichiers qu'elle a écrits — et eux seuls, pas les vôtres ni ceux d'une
autre action — reviennent à leur état d'avant (ce qu'elle a changé par une
commande, `git` ou un script, reste). Deux actions qui modifient la branche
ne tournent jamais ensemble, ni une relecture pendant une modification ; les
relectures et vérifications, elles, tournent ensemble. Une action n'est
finie que quand son travail l'est (ses sous-agents, la CI qu'elle attend) :
pas de limite de temps, *Arrêter* l'arrête. Quand ce qu'elle attendait se termine,
elle reste en cours 10 s : si l'agent repart en dire le résultat, elle finit
avec cette réponse ; sinon, au bout des 10 s (un agent qui repart plus tard
trouve l'action déjà finie). Une action dont le skill tourne en sous-contexte
ne lance rien en arrière-plan : elle attend ses commandes au premier plan (en fond,
sa réponse les couperait). Si une commande a quand même été coupée à sa fin, l'action
finit en échec et sa réponse le dit en première ligne (le travail est peut-être
incomplet). Un sous-agent qu'une action relance tient aussi l'action en cours ;
fini sans qu'aucun tour relise sa réponse, l'action finit en échec et le dit.
Chaque action a son dossier temporaire (sous les sorties de l'agent, `tmp/`),
effacé à sa fin quelle qu'elle soit ; au-delà de 1 Go (`runTmpMax`), elle est arrêtée
comme par *⏹ Arrêter* et sa réponse le dit en première ligne.
**Une action ne demande jamais rien** : elle part toujours en mode « ne pas
demander », quel que soit le mode de l'agent. Elle a les outils de son skill et
`Bash` entier : toute commande du projet passe (`cargo build && cargo test`,
`cd frontend && npm test`, `npx vitest`…), sauf une courte liste de refus
(ci-dessous), tenue même si l'agent est en mode *Auto*. Un refus ne la fait pas
échouer : sa réponse cite chaque appel refusé en première ligne (« Appels
refusés : … »), et c'est vous, ou l'orchestrateur, qui jugez en la lisant si le
travail est complet. Vos règles `permissions.allow` (réglages de
Claude Code) s'ajoutent, `permissions.ask` compte comme un refus,
`permissions.deny` l'emporte. Ses outils de fichiers lisent dans le projet, les
sorties de l'agent et le plugin de VibeCoder, écrivent dans le projet et les
sorties (une action en lecture : les sorties seules), jamais `.claude/`, `.git/`,
`.husky/`, un `AGENTS.md` ni un `package.json` (une dépendance à ajouter, c'est
vous) : c'est le vrai rempart. L'appli rappelle à
chaque action, au lancement, la même consigne d'outils (pas à la conversation) :
rester dans son travail ; lire avec `Read`, `Glob`, `Grep` plutôt que par `Bash` ;
une commande refusée se contourne autrement ou se signale, sans la répéter.
Elle ne change pas les droits, elle évite les refus. Un bouton qui doit
attendre est grisé et dit pourquoi ; un bouton qui n'a pas encore de sens
n'est pas affiché ; une action arrêtée retient les autres
tant que vous n'avez pas choisi. *⏹ Arrêter* de la barre d'état n'arrête
que le tour de la conversation. Quand sa conversation est au repos, le robot
de l'agent montre ses actions : il clignote pendant qu'une action travaille ;
« ! » ou
pastille verte quand l'une échoue ou finit, jusqu'à ce que vous ouvriez son
onglet *Actions* (la pastille verte s'efface aussi quand vous affichez l'agent ;
avec le bip, sauf pour le clignotement) ; une action que
vous avez arrêtée, non.

**Ce que chaque action peut faire** — `Bash` entier et les outils de son skill
(`resources/vibecoder/plugin/skills/<skill>/SKILL.md`, son `allowed-tools`), moins
la **liste de refus** : ce qui part à l'extérieur (`git push`, `curl`, `wget`,
`gh` par ses commandes qui écrivent : `pr create`, `pr review`, `api`, `issue`… ;
ses lectures passent), ce qui change les dépendances (`npm install`, `yarn add`,
`cargo add`, `pip install`…), ce qui détruit (`git reset --hard`, `git restore`,
`git clean`, `rm -rf` et ses graphies `-fr`, `-Rf`, `-r -f`, `sudo`), les commandes git qui écrivent (`add`, `commit`,
`rebase`, `checkout`, `switch`, `pull`, `stash`, `merge`, `tag`, `branch -D`,
`config`), le système (`kill`, `pkill`, `systemctl`, `podman`, `distrobox`
`create`, `rm`, `stop`, `assemble`, `upgrade` : `distrobox enter <box> --` passe)
et la CLI de VibeCoder. Chaque refus vaut seul, avec des arguments et derrière le
préfixe des commandes (git aussi derrière `-C` et `-c`), et chaque morceau d'un enchaînement est jugé. Une action
rouvre ce que son skill nomme dans son `allowed-tools` (colonne « Rouvre »). Ni
`gh pr merge`, ni `gh release`, ni `gh repo` ne sont rouverts : fusionner une PR
ou publier une release reste à vous. Compromis : une forme tordue que Claude Code
ne découpe pas (`bash -c "…"`) peut passer ; les skills sont les nôtres et les
bornes de fichiers restent le rempart. « Lecture seule » : l'action n'écrit que
dans les sorties de l'agent, jamais dans le projet.

| Action | Ses outils | Rouvre | Lecture seule |
|---|---|---|---|
| Rédiger la note, Envoyer les réponses | lecture, écriture, édition | — | non |
| Vérifier la conception, Lire en pseudo-code | lecture, écriture des sorties | — | oui |
| Poser la forme, Écrire les invariants (rouges), Vérifier l'alignement | lecture, écriture, édition | — | non |
| Préparer le commit | lecture, écriture des sorties | `git add` | oui |
| ✓ Commiter | lecture | `git commit` (l'appli efface `commit.md` une fois le commit passé) | non |
| Générer ce module, Générer les modules | lecture, écriture, édition, ses sous-agents `developpeur` | — | non |
| Commiter les modules | lecture, écriture des sorties | `git add`, `git commit`, `rm -rf` de son dossier temporaire | non |
| Relire le diff, Ponytail review, Plan de test à l'écran, Relire la note, Relire les commits | lecture, écriture des sorties | — | oui |
| Lancer les vérifications et la ponytail review | lecture, écriture des sorties | — (la ponytail review est lancée par l'appli, en même temps) | oui |
| Appliquer la revue | lecture, écriture, édition | `git add`, `git commit --fixup`, `git commit -m` (le commit ordinaire de l'historique simple) | non |
| Replier les fixups | lecture | `git rebase` | non |
| Valider la feature (ouvrir la PR) | lecture, écriture des sorties | `git push` de la branche, `gh pr create` | non |
| Diagnostiquer la CI | lecture, écriture des sorties | — | oui |
| PR mergée → revenir sur la base | — | `git switch`, `git pull` | non |
| Charger la PR | écriture des sorties | — | oui |
| Publier la revue | écriture des sorties | `gh pr review` | oui |

La conversation est l'**orchestrateur** : elle est prévenue de la fin de
chaque action (une ligne dans le fil, pas pour une action que vous avez
arrêtée) ; demandez-lui « où en sont les actions ? », ou de lancer ou
d'arrêter l'une d'elles. Elle agit par la commande `vibecoder` (ci-dessous), pas
par des fichiers. Une action qu'elle lance et qui doit attendre est mise en
attente (la commande le répond aussitôt) et part d'elle-même dès que la voie est
libre ; une demande refusée (action inconnue, pas proposée, déjà en cours…) lui
est dite tout de suite, avec la raison, et un argument que l'action ne prend pas
est ignoré (l'action part, la réponse le dit).
Le moteur arrêté (ou à une pause du rythme par défaut), elle ne lance rien que vous ne lui demandiez.

**Les commandes.** Tout ce que VibeCoder sait faire est décrit dans une table
versionnée, `resources/vibecoder/commands.json` (nom, arguments, réponse des
lectures, ouverte ou non aux agents) : le contrat du moteur, pour qui veut monter
sa propre interface. Elle ne liste pas tout ce que fait l'interface : les gestes de
la page (*Commenter*, *À revoir*), l'éditeur, l'ouverture d'un fichier ou d'un lien,
la dictée et les réglages restent à l'écran. Les skills `actions` et `processus` en
tirent leurs arguments. Un exécuteur la lit et lance la commande demandée, avec les
mêmes règles pour tous : y compris les pièces jointes du champ (`pieces`) et le
brouillon de revue (`draft`, `draft.add`, `draft.edit`, `draft.remove`, sur la PR
suivie), la lecture des tests d'invariants de la branche avec le verdict que vous leur avez
donné à l'écran (`invariants` : c'est par elle qu'un agent sait lesquels vous avez notés « à
revoir »), et la lecture des artefacts (`artifacts`, `artifact`), `add-artifact`
acceptant un chemin ou un nom avec son contenu en base64. Une commande d'artefact
ne répond qu'une fois son travail fini : refusé ou échoué, elle rend l'erreur (et
son code, ci-dessous), jamais « ok ».

**Le socket.** Au lancement, l'appli ouvre un socket TCP sur `127.0.0.1`, un port
libre, un objet JSON par ligne : `{ "cmd", "args", "token", "target" }` en entrée
(`target` : le chemin réel du dossier), `{ ok: true, result }` ou `{ ok: false, error }`
en sortie. Le jeton de l'écran est tiré à chaque lancement et reste en mémoire : une
commande sans un jeton connu est refusée (`bad-token`), et une ligne qui n'est pas
une commande — une requête d'un navigateur, par exemple — ferme la connexion. **Les boutons de l'écran
passent par ce socket** : l'appli est le client de sa propre porte, et un bouton
refuse (« Socket indisponible ») plutôt que de passer outre. Les agents y passent
aussi, par la commande `vibecoder` (ci-dessous), avec leur propre jeton.
`~/.config/whisper-dictation/live.json` dit le port et le pid (`{ "port": …, "pid": … }`),
jamais le jeton de l'écran, plus le jeton des agents extérieurs tant que ce réglage est
activé (ci-dessous) ; il est supprimé à la sortie ; la version de dev et l'AppImage, qui
ne tournent pas en même temps, s'y retrouvent.

**La commande `vibecoder`.** Le client du socket pour les agents, un script node livré
avec le plugin : l'agent principal et ses courses l'appellent d'eux-mêmes (le robot a
son port et son jeton dans son environnement), et un Claude Code lancé dans un terminal
peut l'appeler aussi, depuis le dossier de son projet.

```bash
vibecoder status                       # où j'en suis : la branche, l'étape, ce qui court
vibecoder next                         # les actions proposées, et pourquoi les autres sont grisées
vibecoder run start forme              # lancer une action ; en attente si une autre tient le dossier
vibecoder run wait forme               # rend la main à la fin de la course
vibecoder run list | run stop <action>
vibecoder proc list | proc logs <nom> | proc restart <nom> | proc stop <nom>
vibecoder draft.add target=… text=…    # toute commande de la table : <commande> [clé=valeur…]
vibecoder step.validate step=modules verdict=ok   # valider une étape (forme, invariants, modules ; jamais la note) ; sans verdict : la retirer
vibecoder commands | schema <commande> # la table, sans l'appli ; --json : une ligne
```

Code de sortie : 0 si tout va bien (une demande mise en attente aussi, et le texte le
dit), 1 un refus (le code, le message et ce qu'il faut faire) ou l'appli injoignable,
2 un usage faux ; jamais de question.

Pour l'appeler depuis un terminal sans écrire son chemin, un lien dans `~/.local/bin`
(`ln -s` crée un raccourci : taper `vibecoder` lance alors le script, de n'importe quel
dossier ; il faut `node` dans le `PATH`) :

```bash
mkdir -p ~/.local/bin
ln -s ~/.config/whisper-dictation/vibecoder/plugin/bin/vibecoder.mjs ~/.local/bin/vibecoder
```

C'est le même chemin pour l'AppImage et pour la version de dev (les données de l'appli,
`userData`) ; il existe après le premier lancement de l'appli, qui rend aussi le script
exécutable. Sous Windows, pas de lien : `node %APPDATA%\whisper-dictation\vibecoder\plugin\bin\vibecoder.mjs status`.

**Les agents extérieurs** (un Claude Code lancé dans un terminal, hors de l'appli) sont
**désactivés par défaut** : *⚙ Réglages* → *Agents* → *Autoriser les agents
extérieurs*. Activé, `live.json` porte un jeton « extérieur » (écrit seulement tant que le
réglage est activé) et la commande agit sur le robot du dossier où on la lance (le robot
affiché s'il est sur ce dossier, sinon le premier ; un sous-dossier compte ; aucun robot
dans ce dossier : refusé) : tout ce que fait l'écran, sauf répondre aux demandes
d'autorisation, changer les réglages et faire confiance à un projet. Un robot, lui, n'agit
que sur lui-même et ne lit jamais `live.json`.

Une erreur est une donnée sans langue : un code, des détails, un message et ce qu'il
faut faire, en anglais ; c'est l'appelant qui l'interprète. Les codes (`errors`
dans la table) :

- `unknown-command` : aucune commande de ce nom ;
- `closed` : fermée aux agents, l'utilisateur seul la fait ;
- `invalid-args` : un argument manque, est inconnu ou mal typé, un nom d'artefact
  est refusé (`arg: name`), ou une remarque du brouillon est inconnue (`arg: id`) ;
- `no-survey` : pas encore de relevé pour ce dossier ;
- `not-offered` : l'action n'existe pas, ou n'est pas proposée à cette étape ;
- `disabled` : proposée mais grisée, le motif est dans les détails ;
- `same` : la même action court déjà ;
- `busy` : une autre course retient le dossier, et cette action y écrit ;
- `changing` : une course écrit dans le dossier, une action qui le lit attend ;
- `worktree` : un worktree reste sur sa branche, le changement de branche est refusé ;
- `unknown-process` : aucun processus du projet de ce nom ;
- `no-run` : aucune course de cette action dans l'état voulu ;
- `refused` : l'appli a refusé, le motif est dans les détails (un nom pris, une
  confirmation qui diffère, une partie des fichiers d'une commande d'artefact…) ;
- `failed` : l'opération a démarré et échoué (le disque, pour un artefact), le
  message est dans les détails ;
- `no-pr` : aucune PR suivie, donc pas de brouillon de revue à changer ;
- `unknown-artifact` : cet id n'est pas dans le dernier relevé, ou c'est un lien
  (aussi pour un dossier d'arrivée inconnu : rien n'est écrit à la racine) ;
- `bad-token` : le jeton du socket est absent ou faux (rendu par le socket, jamais par l'exécuteur).

**Artefacts.** Demandez à l'agent un document qui sort du projet — un PDF,
une présentation, un wireframe, un document externe, un fichier de
conception : preuve de concept ou autre — : il le crée en **artefact**, de
lui-même (skill `/vibecoder:artefact`, sans bouton), dans le **dossier
d'artefacts du projet** (`vibecoder-artifacts/<clé>/`, dans les données de l'appli) : le
dépôt, ses worktrees et leurs robots partagent le même, et chaque robot du projet
y lit et y écrit (deux robots qui écrivent le même nom écrivent le même fichier) ;
un dossier hors git est son propre projet. Le
bouton *Artefacts* de l'en-tête ouvre leur panneau à la place du fil d'Ariane
et de l'étape : l'arborescence à gauche, au centre le fichier que vous choisissez. Image,
PDF, son, vidéo, page HTML ou SVG s'affichent tels quels (une page sans
script ni réseau) ; le reste en texte, un binaire compris, coupé au-delà de
10 Mo (`artifactTextMax`) — *Ouvrir dans l'éditeur* montre la suite. L'icône de dossier montre le fichier dans
le gestionnaire de fichiers, pour le récupérer ou l'envoyer. *Copier
dans le projet* le copie dans le dossier que vous choisissez (un fichier du
même nom n'est remplacé que si vous l'acceptez). La conversation reste à
droite : demandez-y une retouche, l'artefact se met à jour.

**Ranger les artefacts.** La liste est une **arborescence**, comme l'explorateur
de VS Code : les dossiers se plient et se déplient (*Tout replier* les referme),
et vous rangez les artefacts du projet à votre façon. Un **clic droit** sur un
élément ouvre un menu : *Renommer*, *Supprimer*, *Copier*, *Couper*, *Coller*,
*Dupliquer* ; sur un dossier ou sur le vide, *Nouveau fichier* et *Nouveau
dossier*. Au clavier, F2 renomme, Suppr supprime, les flèches parcourent
l'arborescence, Échap annule un renommage ; Ctrl et Maj choisissent plusieurs
éléments à la fois (le centre reste alors vide). Le nom se tape sur place : un
nom impossible (déjà pris, vide, avec un séparateur…) met l'encart en rouge et dit
pourquoi. *Supprimer* demande confirmation, puis envoie à la **corbeille du
système** : rien n'est effacé pour de bon. Glissez un élément sur un dossier pour
le déplacer ; un dossier se déplace, se renomme et se supprime avec tout son
contenu. Là où un nom est déjà pris, le nouveau reçoit un numéro (`rapport-2.md`),
rien n'est jamais écrasé. Tout reste dans le dossier d'artefacts du projet.

Vous pouvez aussi **ajouter les vôtres** : déposez des fichiers ou un dossier du
gestionnaire de fichiers sur l'arborescence, dans le dossier où vous les lâchez
(à la racine, hors de tout dossier). Ils sont copiés (l'original ne bouge pas),
sans limite de taille ; un nom déjà pris reçoit un numéro (`rapport-2.md`),
rien n'est jamais écrasé. Un lien, un dossier caché (`.git`…) ne sont pas copiés,
et le résultat le dit. Ce qu'on lâche sur l'arborescence n'est pas joint
à la conversation.
Retirer un agent, un robot ou un worktree ne touche pas à ce dossier. Au premier
démarrage, les artefacts d'avant (`vibecoder-out/<agent>/artifacts/`) rejoignent le
dossier de leur projet, sans rien écraser (un nom pris reçoit un numéro).

**Citer un artefact avec `@`.** Dans le champ de la conversation et dans celui d'une
étape, `@` en début de mot (pas au milieu, comme dans une adresse e-mail) ouvre la
liste des artefacts du projet, filtrée à la frappe ; flèches, Entrée ou Tab choisissent,
Échap ferme, comme les commandes « / ». Le choix remplace le `@…` tapé par le chemin du
fichier, que l'agent lit s'il en a besoin. Rien ne correspond : Entrée et Tab
servent comme d'habitude (`@types/node` se tape et part).

**Ouvrir dans l'éditeur.** *Ouvrir* sur la note, un module, un test (chez le
créateur, une icône discrète : la sortie de secours vers votre éditeur, puisque le
code ne se modifie plus à l'écran ; à la
ligne du cas : zed, VS Code, Cursor, VSCodium). Un commit : *Voir le diff*
(écrit en lecture seule sous `vibecoder-out/<agent>/files/`, puis ouvert)
ou *GitHub* (sa page, dans le navigateur).

**Le parcours** — les étapes du guide, les mêmes pour créer une feature et pour
relire une PR (le relecteur, plus bas) :

1. **Note** : sans note, l'écran ne montre qu'une phrase, qui vous renvoie à l'agent
   (« Demandez la note à l'agent, dans la conversation », sans *Rédiger la note* ni
   *Nouvelle demande* : l'agent les lance par la CLI) ; il rédige la note d'après
   votre demande dans le champ de la conversation (sur la branche
   principale, c'est une nouvelle demande : l'agent propose d'abord un nom
   de branche, plus bas) ; ses questions
   ouvertes s'affichent à part, chacune avec un badge *important* ou *secondaire*,
   un peu de contexte en langage simple
   (ce qui se passe, pourquoi choisir), des réponses proposées (une suggestion de
   la vérification de conception montre son choix en gras, l'endroit grisé, le
   texte à ajouter en vert), la conseillée
   marquée « (recommandé) » avec sa raison, une précision libre (micro, sans
   *Envoyer* propre) : *Envoyer les
   réponses* (à l'action qui a rédigé la note : elle garde son contexte) ;
   puis **deux gestes** : *Vérifier* (un bouton ordinaire) lance la vérification de
   conception (une seule passe, Opus) qui cherche les cas
   oubliés, les contradictions, les cas limites des règles chiffrées, un
   comportement qu'on ne peut pas atteindre à l'écran, une ligne qui serait
   plutôt un invariant ou un variant. Elle ne modifie jamais la note, et ne la
   valide jamais : ses trouvailles sont des suggestions au questionnaire, à accepter
   ou refuser (*Envoyer les réponses* les écrit dans la note) ; vous relancez
   *Vérifier* autant de fois que vous voulez. Sa course s'affiche à côté du bouton
   (*en cours*, ⏹, ou *en attente*). *Valider la note*, le bouton vert, n'apparaît que
   lorsque la vérification ne trouve plus rien (« rien de bloquant ») : vous relisez
   alors toute votre note, vous la nettoyez, et vous validez vous-même, à la fin ;
   c'est ce geste, et lui seul, qui lance le moteur (valider ne lance pas de
   vérification, la vérification ne valide pas). Si vous modifiez la note après une
   vérification qui n'a rien trouvé, *Valider la note* reste affiché (c'est vous qui
   avez relu), *Vérifier* reste à côté pour un second passage, et l'écran dit que la
   note a changé depuis la vérification. **Seul vous
   validez la note**, quel que soit le rythme (voir *Vibe*, plus bas). Une fois
   validée, aucune étape de l'IA ne change ce qu'elle fait, ce qu'elle ne doit pas
   faire, où ça casse, ni ses étiquettes (sauf pour écrire une de vos réponses),
   et elle ne garde son ✓ après un changement que si l'appli constate que ce
   changement n'ajoute que le texte exact d'une réponse « Accepter » que vous avez
   choisie : une réponse libre ou tout autre changement le fait tomber, et la note
   attend sa revalidation, en express aussi ; l'appli relancée entre-temps, il
   tombe aussi. La note s'affiche tout de suite ;
   *Modifier* la rend modifiable sur place (*Fermer* garde la modification),
   comme dans Obsidian : ce qu'on tape se met en forme au fil de la frappe (un titre
   apparaît en titre, pas en `#`) ; *Brut* montre le Markdown tel qu'il est
   dans le fichier, modifiable aussi. Enregistrée par Ctrl+S ou
   *Enregistrer* ; grisée pendant un tour de la conversation ou une action de
   l'agent. La note est le seul texte que vous modifiez à l'écran (0.16.0) : c'est
   votre document ; une bulle de remarque sur une ligne dit quelque chose à l'agent
   en montrant de quoi vous parlez.
2. **Forme** : *Poser la forme* écrit d'un seul passage les squelettes dans le code
   (chemins, en-têtes = les contrats, signatures, corps qui échouent ; le typage
   passe), puis recopie la forme dans la note (les modules et leurs contrats, en prose : ce
   qu'ils exposent en une ou deux lignes, les signatures typées restent dans les squelettes et
   leurs en-têtes ; sous chacun, ses variants : le fichier de tests et les cas à
   couvrir, à challenger avant le code ; des modules qui ne compilent
   qu'ensemble : une seule entrée, leurs chemins séparés par « + »). Le système
   valide la forme (« validée par le système »). **À l'écran, la Forme est la liste des
   modules** : une ligne par module, son chemin et ce qu'il fait en une phrase (le
   début de son contrat) ; ni arbre, ni diff, ni code (le code n'est qu'à l'étape
   Modules, un seul endroit pour l'arbre et le diff), ni badge « touché », ni
   commits, ni bouton. Sans Forme : une phrase. La note (ou sa Forme) modifiée après avoir
   été commitée, par vous ou par l'agent : l'étape revient « en cours » (et sa validation est
   décochée si ce qu'elle validait a changé, voir *Valider chaque étape*, plus bas) ; une fois la note et la forme
   revalidées, *Préparer le commit* en fait un fixup du premier commit
   (`fixup! <son sujet>`), puis le commit est fait par le moteur ou l'agent (plus de
   carte du commit proposé à l'écran) ; *Replier les fixups*, à la Revue, le fond dans son commit.
   La PR déjà ouverte : un nouveau commit qui dit pourquoi, pas de fixup. Un projet
   en historique simple (voir *Modules*) : toujours un commit ordinaire, rien à replier.
   Une retouche de la forme, à n'importe quelle étape, change la note et les
   squelettes ensemble (on modifie, on ne régénère pas) ; l'étape n'attend aucun
   clic de vous.
3. **Invariants** : *Écrire les invariants (rouges)*, d'après la note ou
   d'après la note, à partir des squelettes
   — dans la même action, l'alignement ne regarde que les invariants (chaque
   test observe vraiment sa ligne « → invariant », chaque test a sa ligne),
   corrige seul les tests (3 tours au plus) et ne vous remonte
   qu'un changement de contrat ou une note qui rend
   un test impossible à écrire ; il ne corrige que les
   fichiers de tests d'invariants que la branche crée : l'appli lui refuse d'écrire
   dans un fichier qui existait au départ de la branche, et, si l'un d'eux a changé
   à la fin de la course (par une commande du terminal), la course échoue et le
   nomme (un cas resté vert dans un tel fichier vous remonte). **Le moteur lance
   ensuite *Lire en pseudo-code*** (0.16.0), après chaque écriture des tests
   d'invariants : après *Écrire les invariants*, avant la pause et le premier
   commit, et après une correction des tests par l'alignement de la preuve ; c'est
   un regard indépendant de celui qui a écrit les tests : chaque cas de test
   traduit en étapes simples (`test "…":`, `given`, `when`, `then` — une ligne
   `then` par assertion), quel que soit le langage du test, avec ses cas limites,
   ce qu'il garantit, et un point d'attention s'il n'observe pas vraiment la
   propriété ; une lecture n'est refaite que si le test change (la pause attend
   cette lecture).
   **À l'écran, les invariants sont rangés par ligne « → invariant » de votre
   note.** En titre, le texte de la ligne tel que vous l'avez écrit, et son état :
   *écrite* (ses tests sont rouges), *prouvée*, *non prouvée* (un état par ligne :
   c'est ce que la preuve donne, et c'est la ligne que vous jugez). Dessous, les
   tests qui la gardent, en pseudo-code (un test pas encore lu : son titre, « lecture
   en cours »), chacun avec *Validé* / *À revoir* et sa 💬 pour le citer à l'agent. Ces deux
   verdicts sont vos notes : ce que vous avez lu, ce que vous contestez. *Validé* n'est
   jamais exigé pour avancer ; un test *À revoir* retient le moteur (la ligne d'état dit
   combien) jusqu'à ce qu'il soit corrigé ou revalidé, et vous pouvez dire à l'agent
   « traite ceux que j'ai notés à revoir » : il les lit par sa CLI. En tête, où vous en
   êtes : « 10 tests · 6 validés · 1 à revoir · 3 à lire ». Quel test garde
   quelle ligne vient de l'alignement, qui l'écrit dans `liens.md` ; un test d'avant la
   branche qui garde déjà la ligne y est nommé, sans pseudo-code. Une ligne sans test
   s'affiche quand même, « aucun test » ; les tests qui
   ne gardent aucune ligne vont dans un dernier groupe, « Autres tests » : rien
   n'est caché, un trou dans la garde se voit. **Le résultat de la preuve ne
   s'affiche qu'ici**, sous chaque ligne, pas à l'étape Modules. L'alignement suit
   la règle de la Revue : ses écarts `[toi]` en avant, les `[agent]` repliés
   avec leur nombre, rien quand tout est aligné. La bulle de remarque est sur une
   règle : c'est par elle que vous dites quelque chose à l'agent en montrant de quoi
   vous parlez. *Ouvrir dans l'éditeur*, une icône discrète par test. C'est ce que
   vous regardez à la pause après les invariants : chaque règle critique de votre
   note, et ce qui la garde, dans vos mots. Plus de validation cas par cas, de
   chiffres en tête, de barre « 0 / 3 validé », ni de *Tout valider*, *Voir le
   fichier* ou *Invariants seuls* ; aucun test ne s'édite. **Le relecteur garde sa
   vue** : à gauche les fichiers de la Forme (grisés) et les tests d'invariants (en
   vert : ajouté par la branche, en jaune : modifié), au centre une carte par cas
   (pseudo-code ou *Code*, la ligne « → invariant » qu'il garde, *Validé* ou *À
   revoir*, *Tout valider*, *Voir le fichier* et son diff depuis la base de la PR, *Relire* /
   *Tout relire*, « lecture périmée » cas par cas), son menu de diff (« Depuis la
   base de la branche », *En ligne* · *Côte à côte*) ; la validation d'un cas porte sur son
   bloc (retoucher un cas ne décoche que lui, retoucher le code commun du fichier les
   décoche tous). Le système valide
   l'étape du créateur (« alignement avec la note ») ; il ne pose jamais *Validé* ni
   *À revoir* sur un test : ces verdicts sont vos notes. Si un test est écrit ou
   réécrit plus tard (une correction, par exemple), la pause revient au rythme par
   défaut — « Des tests ont changé : regardez vos règles, puis reprenez » — et rien
   ne se valide ni ne se commite côté modules avant votre *Reprendre*. Le premier commit (*Préparer le commit* puis le commit : un fichier
   déjà porté par un commit de la branche : un fixup, sauf PR ouverte, où il va
   dans un nouveau commit qui dit pourquoi ; en historique simple, toujours un
   commit ordinaire) est fait par le moteur ou l'agent.
   Une note sans ligne « → invariant » passe l'étape dès la forme validée (pas de
   test à écrire, *Écrire les invariants* n'est pas proposée) : la note et la
   forme se commitent à l'étape Modules. Des lignes « → invariant » déjà
   observées par des tests existants (aucun test ajouté par la branche) :
   l'étape passe quand *Écrire les invariants* ou *Vérifier l'alignement*
   a fini, ou par *Rien à écrire* (à revalider si la note change ;
   le moteur en marche aussi).
4. **Modules** : le moteur (ou l'agent) lance *Générer les modules*, *Prouver les
   invariants* (voir plus bas) puis *Commiter les modules*. Un fichier encore identique au squelette de la Forme est en retrait,
   « à générer » : on voit d'un coup d'œil ce qui reste à écrire. On génère tout (ou un module à la fois, avec *Générer ce module* :
   ses variants écrits d'abord et vus rouges, puis le code (TDD),
   `ponytail`, typecheck et tests du module lancés, sans commit, avec la boucle de
   *Générer les modules* pour un seul : son diff relu, les défauts corrigés, les
   tests relancés jusqu'au vert, dans la même course ; seules les remarques
   `[toi]` remontent), on relit, on ajuste, et l'agent range les commits à la
   fin. *Générer les modules* : jusqu'à 4 modules de code dans la Forme (sans
   compter ceux qui n'ont pas de variants : la doc, les textes de skills), un seul agent
   les écrit tous, à la suite, dans l'ordre de la Forme, les variants rouges
   d'abord pour chacun ; au-delà, des agents Sonnet en parallèle, par vagues. Le
   seuil se compte dans la Forme, il n'est pas réglable. Chaque diff est relu pour sa
   conformité (le périmètre, une dépendance ajoutée, une lecture ou une écriture dans une
   boucle, une donnée hors de son périmètre ; l'en-tête fidèle au contrat ; les variants
   vus rouges puis verts ; les invariants verts et intacts) : un défaut est corrigé ou
   renvoyé au même agent, relancé sur Opus au second échec ; les doublons, cas limites,
   failles et code mort sont ceux de la ponytail review, qui relit toute la branche
   juste après. Typage et tests des fichiers modifiés après chaque vague (toute la
   suite si le projet ne sait pas les choisir), rien avant la première ; la suite
   complète une seule fois, à la fin ; sans commit. Générer
   et commiter sont deux gestes : *Commiter les modules* (un commit par module dans l'ordre de la Forme, un fixup
   pour un module déjà commité ; le typage de chaque commit est vérifié sur son
   contenu, hors du dossier de travail, avec les `node_modules` du dossier reliés à leur place,
   ceux de chaque workspace compris ; des modules qui ne compilent
   qu'ensemble, notés sur une seule entrée de la Forme (« a.ts + b.ts »), font un seul
   commit, et un module suivant que l'erreur de typage nomme les rejoint ; une
   autre erreur arrête là, sans rattrapage) ; vous pouvez donc retoucher le code entre les deux.
   **Deux historiques**, au choix du projet : l'historique par module, décrit ci-dessus,
   est le défaut et ne demande aucun réglage ; un projet qui écrit « Historique simple »
   (« Simple history » en anglais) dans sa convention de commit, `AGENTS.md` ou
   `CLAUDE.md`, que les skills de commit lisent, passe à l'historique simple : après le
   premier commit (la note, la forme, les invariants rouges), *Commiter les modules*
   fait un seul commit pour le code de tous les modules, avec tous les fichiers
   modifiés, nouveaux ou supprimés du dossier (sauf une note ignorée par git), et sa réponse nomme
   ceux qu'aucun module de la Forme ne possède. Les corrections d'après (*Appliquer la
   revue*, une vérification rouge, un retour d'essai) sont des commits ordinaires,
   « revue : … » : jamais un fixup, rien à replier (*Replier les fixups* dit « Rien à
   replier : historique simple », sauf s'il reste un commit `fixup!` fait à la main :
   il le replie alors comme d'habitude, avant la PR).
   **À l'écran, les modules** (0.16.0) : en tête, **une seule ligne d'état**
   (« 16 modules écrits · commités ») ; puis **un seul arbre et son diff**, en lecture
   seule, sans bouton. À gauche, l'arbre : les fichiers des modules, puis les variants
   que la branche écrit (à leur place : on voit où ils vont), avec le numéro de
   chacun et son nom coloré comme dans VS Code (vert : nouveau, jaune : modifié,
   rouge barré : supprimé ; blanc une fois commité ; atténué : à générer). À droite,
   le fichier choisi, **en diff depuis la base de la branche** (tout ce que le ticket
   a changé), en ligne ; il suit le disque (pendant la génération, on voit le code
   s'écrire ; plus d'1 Mo : « fichier trop gros ») ; un fichier supprimé : tout en
   retraits. **Le code ne se modifie plus à l'écran** : ni éditeur ni *Enregistrer* ;
   une correction se demande à l'agent. *Ouvrir dans l'éditeur*, une icône discrète
   sur le fichier affiché, est la sortie de secours vers votre éditeur. Pas de menu
   de diff, pas de *En ligne* · *Côte à côte*, pas de *IDE* · *liste*, pas de
   « n commité · n en cours · n à faire ». Une seule exception, et seulement quand
   elle sert : après une correction, l'en-tête de l'étape dit « modifiée depuis la
   validation », et un clic dessus bascule le diff sur ce qui a changé depuis le ✓ ;
   un second revient à la base. Sur un gros ticket (16 modules), l'étape reste
   lisible : une ligne d'état, un arbre. Le relecteur garde ses modules en lecture
   seule, puis les commits de la PR (voir *Relecteur*).
   **Prouver les invariants** (0.16.0) : pour chaque ligne « → invariant » de la note,
   le système casse volontairement la règle dans une copie du code, faite hors du
   dossier de travail, et lance le test : il doit échouer, un test qui reste vert ne
   protège rien. Un mutant ne compte que si le test passe d'abord sur la copie
   intacte, si la copie mutée passe le typage du projet et si le test échoue alors
   sur une de ses assertions ; sinon un autre est essayé. Le résultat, `preuve.md`
   (une rubrique *prouvé* ou *pour toi* par ligne ; « Rien à prouver » sans ligne),
   ne s'affiche qu'à l'étape Invariants, sous chaque ligne « → invariant », pas à
   l'étape Modules. La preuve ne modifie rien dans le projet : l'appli
   compare le dossier de travail et l'index à ceux d'avant, et la moindre
   différence fait échouer la preuve en nommant les fichiers (les fichiers que git
   ignore ne sont pas regardés ; un fichier que vous modifiez pendant la preuve la
   fait échouer à tort : relancez-la). Un test resté vert repart à l'alignement,
   avec la règle cassée dite dans les mots de la note, puis la preuve est relancée
   une fois ; seuls les tests d'invariants que la branche crée se corrigent, un test
   d'avant le ticket (protégé) vous remonte, comme tout invariant que le système
   n'arrive pas à prouver. Les modules ne sont validés par le système que si la
   preuve passe, et elle reste valable quand le code change ensuite (une correction
   après votre essai à l'écran).
5. **Revue** : le moteur lance *Lancer les vérifications et la ponytail review* (les deux
   tournent ensemble ; des avertissements seulement : la
   vérification passe ; les
   commandes du projet sont vraiment lancées, par le préfixe des commandes,
   et un résultat d'avant ce lancement ne compte pas), puis applique la revue (en
   fixups, ou, en historique simple, en un commit ordinaire « revue : … »)
   et replie les fixups ; « Chaque diff a été relu »
   l'est par le système (modules validés et ponytail review faite), seule
   « AGENTS.md à jour » se coche à la main, facultative, jusqu'au prochain commit
   (le relevé et la CLI gardent cette liste du guide avant une PR, l'écran ne la montre plus).
   **À l'écran, la Revue est une seule carte** (0.16.0) : avant la revue, une ligne,
   « la revue part après votre essai » au rythme par défaut, « la revue part après
   les modules » en express ; après, une ligne par vérification en échec (rien quand
   tout passe), les remarques `[toi]` de la ponytail review en avant, sans bouton
   (vous y répondez dans le questionnaire ou à l'agent, comme le moteur le fait déjà), les
   `[agent]` repliées avec leur nombre. Plus de liste « Avant la PR », plus de
   cartes vides (« Pas encore de vérification », « Pas encore de ponytail review »,
   « Pas encore de plan de test »). Le plan de test à l'écran (*Relire à l'écran*,
   pour vous comme pour un relecteur, utile aussi en créant : comment lancer la
   branche, puis ce qu'il faut essayer, une case chacun), s'il existe : ses cases
   à cocher, sans *Relancer* ; sans plan, rien. Toutes les cases cochées comptent pour que la
   Revue soit faite. La ponytail review porte sur la technique (le code, ce
   qui n'a pas pu être anticipé), pas sur la structure ni le contrat déjà
   validés. Chaque ligne des retours du créateur (alignement, ponytail review,
   relecture du diff, vérifications, CI) porte une étiquette : `[toi]` pour ce qui
   demande votre décision (un changement de contrat), `[agent]` pour le reste, que
   l'agent règle seul ; l'écran remplace l'étiquette par un badge (*pour toi*, en
   accent ; *pour l'agent*, grisé) et grise le texte d'une `[agent]`, qui reste
   lisible. Le relecteur d'une PR n'a pas d'étiquettes : il lit tout, et garde son
   *Relire à l'écran* tel qu'il est (plan de test, *Tout cocher*, *Relancer*).
6. **PR** : **à l'écran, la carte de la PR et l'état de la CI, sans bouton**
   (0.16.0) : une ligne par vérification en échec, rien quand tout passe. Le moteur
   ouvre la PR (*Valider la feature*), suit la CI jusqu'au vert (*Diagnostiquer la
   CI*) ; la fusion est à vous (*PR mergée →
   revenir sur la base* : refusé s'il y a des modifications en cours ; sur
   le robot d'un worktree, *Retirer le worktree*, dans la vue des branches,
   à la place). L'étape est faite dès qu'une PR existe pour la branche :
   l'appli la demande elle-même à `gh` (sans IA, en lecture seule ; toutes
   les 60 s au plus, ↻ pour tout de suite). Assigné à la PR d'un autre,
   *Me retirer de la PR* (l'agent, par la CLI) vous refait relecteur.

**Sans IA** (des boutons du relecteur et de la vue des branches ; chez le créateur, l'agent
les lance par la CLI) : *✓ Commiter*, *Charger* (une PR), *Publier la revue*, *PR
mergée → revenir sur la base*, *Changer de branche*, *Aller sur la
branche*, *Créer ici*, *Dans un nouveau worktree*, *Mettre de côté*,
*Revenir sur la branche principale*, *Retirer le worktree*, *Pull*,
*Rebase*, *Pousser*, *Actualiser*, *S'assigner la PR* et *Me retirer de la PR* ne sont
que des commandes connues : l'appli les lance elle-même (bouton « direct »,
aucun jeton) — `git commit -F` du message affiché ; `gh pr view` puis `git
fetch origin` de la branche de la PR et de sa base ; `gh pr review` du brouillon ; seulement
si la PR est fusionnée, `git switch`, `git pull --ff-only`, `git branch -d`
; `git switch` d'une branche (jamais avec des modifications en cours),
suivi pour celle d'une PR de `git pull --ff-only origin <branche>` ;
`git stash push -u`, et rien d'autre ; `git pull --ff-only --autostash`,
`git rebase --autostash` (un conflit : `git rebase --abort` aussitôt),
`git push --force-with-lease`, `git fetch origin`, `gh pr edit --add-assignee` / `--remove-assignee` ; la recette du projet (plus bas) pour
créer ou retirer un worktree. Le résultat s'affiche sous le bouton (✓ ou ✗,
le détail à déplier ; sa place est réservée, rien ne se décale), chaque commande dans `direct.log` des sorties de
l'agent ; git et `gh` passent par le préfixe des commandes (la box : les
hooks de commit y trouvent Node). En cas de souci, le petit *via* à côté
passe par l'agent, comme avant. Une action faite et dont rien n'a changé ne se
relance pas d'un clic par erreur : *PR mergée → revenir sur la base*, une fois
fait, est grisé (« Déjà sur la base ») ; *Mettre de côté*, *Actualiser*, *Pull*
et *Rebase* restent relançables. *Créer une branche dans un nouveau
worktree* reste possible pendant une action : il travaille dans un autre
dossier.

Une validation vaut pour le contenu validé : une note modifiée ensuite
repasse « modifiée depuis », à revalider. Quand l'étape n'attend plus que
votre validation, l'étape vous le dit (*Valider la note* ; le relecteur d'une PR : « N cas à valider »). Les lignes de la note que
l'agent vient de changer sont surlignées depuis votre dernière relecture, et ce
qu'il a retiré s'affiche à sa place, en rouge barré (lecture seule : ni 💬, ni
remarque ; une ligne changée montre son ancienne version juste au-dessus de la
nouvelle) ; *Voir les modifications* : le diff brut ; *Vu* ou la validation de la
note : ne plus surligner ni barrer ; un nouveau tour ne l'efface pas, les
modifications s'accumulent. Le badge *variant* de
la note est d'un bleu plus clair que *invariant*.

**Valider chaque étape, voir ce qui a changé** (créateur). Chaque étape a sa validation,
le même geste partout. Depuis la 0.16.0, vous ne validez que la note (*Valider la
note*, après *Vérifier*) : la forme, les invariants et les modules sont validés par
le système quand leurs contrôles passent (squelettes posés, alignement avec la note,
conformité à la forme et preuve par mutation) ; plus de bouton *Valider la forme*,
*Valider les invariants*, *Valider les modules* ni de ✓ par cas à l'écran (l'agent
garde ces gestes par la CLI). **Le ✓ est sur le badge de l'étape** : dans son
en-tête, le badge d'état dit « faite ✓ » quand l'étape est validée, « faite · ✓
retiré » tant que votre retrait tient ; un clic dessus, à la Forme, aux Invariants et
aux Modules, retire le ✓ ou le rend, et ne fait rien d'autre. Une étape faite que le
système n'a pas validée (une preuve qui ne passe pas, un contenu changé depuis) : le
badge sans ✓ et sans clic, il ne valide jamais à la place du système. La note, la
Revue et la PR : ni ✓ ni clic. Le relecteur : jamais. La validation retient ce que
l'étape a validé : la conception de la note (sans sa rubrique Forme), la rubrique
Forme, les fichiers de test, et pour les modules tout ce que la branche change d'après git
(hors la note et les tests d'invariants). Ces versions sont
gardées dans le dossier de sorties de l'agent (`validated/<empreinte>`), jamais dans le
dépôt ni sous `.git/` ; l'index git n'est jamais touché : un `git add` ou un commit ne
valide rien, et un commit ne change pas une validation.

Qui que ce soit qui modifie ce qu'une étape a validé (vous, à la main, ou un agent),
l'étape perd sa coche, et celles qui suivent aussi (note, Forme, Invariants, Modules) :
son en-tête dit « modifiée depuis la validation » (à l'étape Modules, un clic bascule le
diff sur ce qui a changé depuis le ✓, un second revient à la base), les suivantes « à revoir : la note a changé » (la première étape
décochée). Revalider une étape ne recoche pas les suivantes : chacune se revalide, puisqu'elle
ne tient peut-être plus. Changer la seule rubrique Forme de la note ne décoche pas la
note, seulement la Forme et ce qui suit. *Commiter les modules* est grisé (« modules pas
validés ») tant que les modules ne sont pas validés (le système les valide quand la preuve passe).

**Un ✓ d'étape que vous retirez à la main tient.** Retirer la validation de la forme, des
invariants ou des modules (un clic sur le badge de l'étape), c'est dire « pas d'accord » : tant que le contenu de l'étape
ne change pas, le système ne la remet pas, ni celles des étapes suivantes ; le contenu
changé, ou l'étape revalidée (un clic sur le badge) : le retrait est oublié. Ce
retrait est enregistré avec les validations de l'agent : il survit à un redémarrage de
l'appli. Tant qu'il tient, le moteur s'arrête sur cette étape, dans les deux rythmes :
pas de *Reprendre*, la ligne d'état nomme l'étape (« modifiez-la ou
revalidez-la pour reprendre ») ; une fois l'étape modifiée ou revalidée, *Reprendre*
revient, et le moteur ne repart qu'à votre clic.

**Le diff, et son menu pour le relecteur.** Le créateur n'a plus de menu de diff
(0.16.0) : l'étape Modules montre un seul diff, depuis la base de la branche, en
ligne ; seule exception, « modifiée depuis la validation » dans l'en-tête de
l'étape bascule sur ce qui a changé depuis le ✓, et revient. Le relecteur garde son
menu, à l'étape Invariants : un seul menu
en tête de la vue : *Fichier* · *Depuis la base de la branche* (par défaut) · *Depuis le
dernier commit* (grisé tant que la branche n'a aucun commit, ou que rien ne diffère du dernier commit), puis *En
ligne* · *Côte à côte*. Il vaut pour toute la vue, plus pour le seul fichier affiché :
l'arborescence ne liste que les fichiers qui diffèrent de la référence choisie, comme
`git status` (suppressions et fichiers hors de la Forme compris), et le
fichier choisi montre son diff depuis elle (ajouts en vert, retraits barrés en rouge ;
un fichier créé : tout en ajouts, supprimé : tout en retraits). Aucun fichier : « Rien de
modifié depuis … ». À l'étape Invariants, la case *Invariants seuls* (cochée par défaut)
ne garde que les tests d'invariants ; décochée, le reste suit, en retrait.

**L'agent principal revalide.** Si vous testez, demandez une correction et qu'il la fait
lui-même, il relance ce qu'il faut et revalide les étapes touchées par la CLI
(`vibecoder step.validate step=forme|invariants|modules verdict=ok` ; jamais la note,
dont la conception est à vous), puis vous dit ce qu'il a modifié et revalidé : vous le
relisez avec « modifiée depuis la validation » (l'en-tête de l'étape Modules).

**Relecteur** — la PR de la branche du dossier. Pas de bouton à choisir :
l'appli décide d'après la PR. Vous êtes **relecteur**, par défaut, sur une PR
ouverte dont vous n'êtes pas l'auteur (celle d'un autre chargée dans la vue des
branches, ci-dessous, ou la sienne si vous êtes sur sa branche), qu'on vous ait
demandé de la relire ou non ; **créateur** sur votre propre PR, sur une PR que
vous vous êtes assignée (*S'assigner la PR*, étape PR : vous la modifiez alors
en créateur ; *Me retirer de la PR* vous refait relecteur) et sur une branche
sans PR ouverte — la branche principale comprise : sans PR, rien à relire. Une
PR fusionnée ou fermée se charge, mais on y est créateur. Le badge *Relecteur*,
en haut, dit que rien ne s'édite ici : en relecteur, tout est en lecture seule
— ni le code d'un module, ni la note, ni un test ne s'écrivent, rien ne se
génère ni ne se commite, et les actions qui modifient sont masquées.

La PR se charge **dans le dossier de l'agent** (`gh pr view`, puis `git fetch
origin` de la branche de la PR et de sa base ; une PR venue d'un fork, dont la
branche n'est pas sur `origin`, est refusée), et on la relit sur sa branche,
dans les mêmes étapes que le créateur : la note (*Relire la note* : les
décisions à discuter), les invariants (les mêmes cartes en pseudo-code), les
modules, en lecture, puis les commits de la PR (*Relire les commits* — ou, sans
IA, la liste des commits, leurs fichiers, leur diff —, une carte par commit ; un
clic sur un fichier d'un commit l'ouvre sous sa carte, tel qu'il est dans la
PR, en lecture seule, ou son diff dans ce commit, ou depuis la base de la PR ;
*Commenter* sur des lignes les cite dans une remarque), le plan de test à
l'écran (étape Revue, *Plan de test à l'écran* : des cases à cocher pendant
l'essai) et, à l'étape PR, la publication. *Commenter* ajoute
une remarque au **brouillon de revue** (un par PR) : le texte du champ, sinon ce
qu'on cite ; elle reste sous l'élément commenté (un passage de la note, un module,
un cas, un commit), grisée, avec un crayon pour la modifier sur place et une ×
pour la retirer, et s'empile quand il y en a plusieurs. *À revoir* (sur la note, un
cas, ou un commit : chacun a *Validé* / *À revoir*) ne met rien au brouillon :
il montre « Ajouter une remarque au brouillon », qui ouvre la zone. *Poser une
question à l'agent* (à côté de *Commenter*) cite l'élément dans le champ de la
conversation, comme le *Commenter* du créateur : rien n'est envoyé avant *Envoyer*. Le 💬 du bloc *Attention*
d'un cas ajoute son point d'attention à la zone de commentaire de la carte
(ouverte au besoin, ce que vous y aviez écrit gardé) : vous précisez, puis
*Ajouter* le verse au brouillon (pour un créateur, le même 💬 cite le cas dans
le champ de la conversation). Enfin, à l'étape PR, le verdict (*Commenter* par
défaut, *Approuver*, *Demander des changements*) et *Publier la revue*, qui
l'envoie sur GitHub telle quelle. Un *À revoir* quelque part propose *Demander
des changements*, tout validé propose *Approuver* ; votre choix l'emporte, et
rien ne part sans votre clic. Une fois publiée, la revue est marquée envoyée
(grisée : le verdict, le nombre de remarques, la date, le lien) et *Publier la
revue* est grisé (« déjà publiée ») tant que ni le brouillon ni le verdict n'ont
changé.

**La vue des branches.** Tout ce qui change de branche passe par un seul
endroit : un clic sur la branche, en haut à gauche, ouvre la vue des
branches à la place de l'étape (un nouveau clic la referme). Elle montre :

- les PR ouvertes du dépôt (que l'appli demande à `gh`, sans IA), en trois
  onglets : *Mes PR* (celles que vous avez créées), *À relire* (celles où
  l'on vous demande en relecture), *Toutes les PR* ; un clic sur l'une
  d'elles la charge, son nom apparaît aussitôt dans le bouton ;
- *Branches locales* : un clic passe sur la branche (`git switch`) ;
- un champ de recherche, à droite des onglets, filtre l'onglet ouvert : le
  numéro, le titre ou l'auteur d'une PR, le nom d'une branche ;
- dans *Toutes les PR*, *Me demander en relecture* sur une PR d'un autre où
  l'on ne vous demande pas encore : au clic, l'appli vous ajoute comme
  relecteur sur GitHub (`gh pr edit --add-reviewer`), et la PR passe dans
  *À relire* ;
- *Revenir sur la branche principale* ; *Créer une branche* ; *Retirer le
  worktree* (sur le robot d'un worktree) ; *Actualiser* (`git fetch origin` :
  l'état du distant, pour *Pull* et *Rebase* ; les listes de PR relues, *À relire* à jour
  tout de suite).

Dans un worktree (l'enfant d'une demande, le robot d'une PR), on ne change
pas de branche : la vue n'y montre qu'*Actualiser* et *Retirer le worktree*.
*Pull* et *Rebase*, à côté de la branche, servent à le mettre à jour (sur la
branche principale ou celle dont il part).

La PR chargée, l'appli vous demande toujours quoi faire de votre dossier :

- *Changer de branche* : le dossier passe sur la branche de la PR (`git
  switch`) ; grisé s'il y a des modifications en cours (et refusé si vous en
  faites une juste avant de cliquer) ; ce que votre branche avait produit
  revient avec elle ;
- *Dans un nouveau worktree*, le dossier propre ou pas : l'appli crée un
  worktree de la PR avec la recette du projet (plus bas ; sans `worktree`
  réglé, `git worktree add` à côté du dépôt, `<dépôt>-worktrees/pr-<n>`) et
  le prépare (`setup`), sans toucher à votre dossier. Elle vous demande
  alors si vous faites confiance à ce dossier — à chaque fois : les
  réglages `.claude` de la PR, écrits par son auteur, se chargeront —, puis
  ajoute un robot « PR #n » sur ce dossier, sous celui du dépôt, déjà
  relecteur : *Aller au robot PR #n*. Sur ce robot, *Retirer le worktree* le
  retire (refusé s'il reste des modifications) ; le robot part avec lui, et
  votre brouillon de revue revient à l'agent du dépôt ;
- avec des modifications en cours, en plus, *Mettre de côté* : `git stash
  push -u` (fichiers non suivis compris ; `git stash pop` les reprend).
  Seulement à ce clic, et sans changer de branche : le dossier propre,
  *Changer de branche* n'est plus grisé, un deuxième clic y passe.

*Revenir sur la branche principale* remet le dossier sur la branche
principale du dépôt et ne suit plus la PR (publier la revue, lui, ne change
pas de branche). Avec des modifications en cours : *Mettre de côté* puis
revenir, ou *Rester sur la branche* (ne plus suivre la PR, sans git). Passer
sur une branche locale suit la même règle.

*Créer une branche* : son nom, son départ (par défaut la branche principale
à jour, `origin/<base>`, ou une branche locale), puis *Créer ici* (`git
switch -c`, grisé s'il y a des modifications en cours) ou *Dans un nouveau
worktree* (un robot enfant s'y ouvre, comme pour une nouvelle demande,
ci-dessous).

**Pull et Rebase.** À côté de la branche, deux boutons à icône, comme dans
VS Code, sur toute branche (la PR d'un autre comprise) :

- *Pull* : `git pull --ff-only --autostash` ; grisé quand la branche est à
  jour avec sa branche distante (ou n'en a pas) ; sans avance rapide
  possible, l'échec s'affiche ;
- *Rebase* : `git rebase --autostash` sur la branche principale distante
  (`origin/<base>`), ou sur une autre branche au choix (▾). Une pastille le
  signale quand `origin/<base>` a avancé depuis la base de la branche (une
  PR à rebaser sur un `master` mis à jour) ; il reste permis à tout moment,
  sauf sur la branche principale elle-même, où il est masqué.
  Un conflit : `git rebase --abort` aussitôt, l'échec affiché, rien ne
  bouge. Réussi : *Pousser* apparaît (`git push --force-with-lease`, à son
  seul clic).

Les deux sont permis avec des modifications en cours : `--autostash` les
met de côté le temps de l'opération et les reprend après. Leur état se lit
sans rien modifier (`git log`) ; il suit le distant tel que le dernier
*Actualiser* l'a laissé : l'appli ne fait jamais de `git fetch` d'elle-même.

**Une nouvelle demande.** Sur la branche principale, dictez la
demande dans le champ de la conversation et demandez la note à l'agent (*Rédiger la note*) : l'agent
propose un nom de branche (Haiku, selon la convention du projet, sinon
`<type>/<ticket>-<intitulé>` ou `<type>/<version>-<intitulé>`), et l'appli
vous demande « Voulez-vous créer la branche … ? », le nom prérempli et
modifiable. Rien n'est créé sans votre clic :

- *Créer ici* : la branche est créée depuis la base à jour (`git
  switch -c`) et le dossier y passe, puis la note s'écrit d'après votre
  demande ; grisé s'il y a des modifications en cours ;
- *Dans un nouveau worktree*, le dossier propre ou pas (l'appli crée le
  worktree sur cette branche, vous demande si vous lui faites confiance,
  puis un robot enfant s'y ouvre et rédige la note ; votre robot
  reste sur sa branche, avec ses modifications s'il en a) ;
- avec des modifications en cours, en plus : *Mettre de côté*, puis
  *Créer ici* d'un deuxième clic.

Sur une autre branche, la note demandée rédige la note de cette branche,
sans proposer de nouvelle branche. Un échec : ✗ et sa raison à côté du
choix. La PR de l'enfant fusionnée : *Retirer le worktree*, dans la vue des
branches (à la place de *PR mergée → revenir sur la base*) ; le robot part
avec lui.

**Lancer le projet.** L'onglet *Processus* lance, arrête et relance les
commandes qui font tourner le projet de l'agent (serveur, front, services) :
le nom de chacune, sa commande en petit dessous, *Lancer*, *Arrêter*, *Relancer* (icônes), son état, depuis quand, et la fin de son journal (à
déplier ; *Journal complet* dans l'éditeur). Les commandes sont à vous, propres
à la machine, dans le **fichier du projet**, `.vibecoder/project.json` à la
racine du dossier (comme `.zed` ou `.claude` ; l'appli ajoute `.vibecoder/`
à `.git/info/exclude` : rien à commiter ; un ancien
`vibecoder/projets/<dossier>.json` y est recopié) : *Proposer les commandes*
(Haiku lit le README, `package.json`, `process-compose`, vos alias et
fonctions du `.bashrc`…) les écrit s'il n'y en a pas encore, sinon n'y
ajoute que celles dont le nom n'y est pas (les vôtres restent telles
quelles) ; *Modifier les commandes* ouvre le fichier, et une commande
ajoutée apparaît, enregistrée, sans relancer l'appli. Chacune passe par `bash -ic` (vos alias et
fonctions marchent : `gear` pour gt-plugins), dans la box de l'agent si sa
commande passe par `distrobox enter <box> --`. Autre chose devant (une
autre box, `toolbox run`, rien) : le réglage `vibeCommandPrefix`, ou
`"prefix"` dans le fichier du projet (`""` : rien), qui l'emporte ; le même
préfixe sert aux appels de l'appli à `gh` (l'AppImage tourne sur l'hôte,
`gh` est souvent dans la box). C'est l'appli qui lance :
quitter l'appli arrête tout ce qu'elle a lancé, et rien d'autre. L'agent lit
les mêmes journaux et peut demander l'arrêt ou la relance d'une commande (il
écrit un petit fichier que l'appli exécute, VibeCoder affiché). Un robot
enfant reprend les commandes de son parent et les lance dans son propre
dossier ; une commande ne tourne qu'à un endroit de la famille (ports et
base partagés) : la lancer ailleurs demande « <nom> tourne dans <branche> :
l'arrêter et le lancer ici ? ». Le fichier du projet est toujours celui
du dossier du parent, jamais celui d'un worktree (une PR pourrait y apporter
ses propres commandes) : le parent retiré, ses enfants n'en ont plus.

La même proposition, une fois par projet, apporte la **recette** si le
fichier ne l'a pas encore : `setup` (ce qui prépare une copie neuve, ex.
`yarn install`) et `worktree` (`create`, `remove`, `dir` : les scripts de
worktree du projet). L'appli la lance elle-même, sans IA : *Préparer le
projet* (onglet *Processus*) ; créer et retirer un worktree (ci-dessus).
Pour gt-plugins :

```json
"setup": ["yarn install"],
"worktree": {
  "create": "yarn setup-worktree \"$VIBECODER_BRANCH\" \"$VIBECODER_BASE\"",
  "remove": "yarn cleanup-worktree \"$VIBECODER_BRANCH\"",
  "dir": "../gt-plugins-worktrees/{branch}"
}
```

La branche et sa base n'arrivent que par `VIBECODER_BRANCH` et
`VIBECODER_BASE`. Une étape à la fois, 15 min au plus chacune, sans
clavier (une question y/N échoue, et l'écran montre sa dernière ligne) ;
le journal : `recipe.log` des sorties de l'agent. Un worktree n'est jamais
retiré s'il a des modifications.

**Vibe, un seul moteur, deux rythmes** (0.16.0). Il n'y a plus de parcours
entièrement manuel : le système enchaîne toujours, vous ne validez que la note et
quelques pauses vous laissent regarder (créateur seulement). Même
écran, sans bannière, et plus de bouton *Vibe* : **un seul bouton** pour le moteur, à côté
de la ligne d'état sous le fil d'Ariane, *Arrêter* pendant que le système enchaîne, *Reprendre* quand il est arrêté (une
pause, un arrêt à la main, un redémarrage de l'appli : le moteur ne repart jamais
tout seul) ; plus rien n'attend vos validations autres que celle de la note. Les deux
rythmes ne diffèrent que par leurs pauses :

- **Le rythme par défaut, deux pauses.** La première après les invariants, avant
  le premier commit : vous vérifiez ce qui a été posé (la forme, les invariants),
  rien n'est encore commité, puis vous reprenez et le premier commit part. La seconde après les modules, avant la revue : vous essayez à
  l'écran, sans que les tokens de la revue soient déjà dépensés ; si c'est bon,
  vous reprenez, et la revue, la PR et la CI suivent. À une pause le moteur est
  arrêté, le bouton dit *Reprendre* et la ligne d'état dit quoi regarder (« Regardez vos
  règles, puis reprenez », « Essayez l'appli, puis reprenez ») ;
  absent, rien ne part et rien n'est dépensé.
- **Le mode express, à tout moment**, par l'interrupteur *Express* du fil d'Ariane :
  avant de valider la note, à une pause ou en cours de route. Le système n'attend
  plus rien et enchaîne sans pause jusqu'à la PR ouverte et sa CI, sauf pour la note,
  que seul vous validez (choisi avant, l'express part de votre validation).
  Éteint en route, la pause suivante est tenue. L'express ne survit pas à un
  redémarrage de l'appli : elle revient au rythme par défaut (au pire une pause
  est tenue en trop, jamais une sautée) ; rien n'en est écrit dans les réglages.
  C'est le rythme pour s'éloigner.

Dans les deux, une question `[toi]` arrête la chaîne, et *Arrêter* reste
possible à tout moment. En deux temps :

1. la demande dans le champ de la conversation, puis la note demandée à l'agent (*Rédiger la note*) ; l'agent vous pose
   **toutes** les questions de la note (*Envoyer les réponses*, ou vos
   réponses dans la conversation : le questionnaire suit) — il n'en
   tranche aucune ; puis *Vérifier* autant de fois que vous voulez, vous relisez la note
   et vous la validez (*Valider la note*) : le moteur part seul quand vous validez, et
   pas avant. C'est la première validation qui le lance : une note que vous validez
   de nouveau plus tard (elle a changé pendant votre essai, une décision y a été
   écrite) retrouve son ✓ sans rien relancer — vous restez où vous étiez, et
   *Reprendre* relance quand vous voulez, en express aussi ; seul un moteur qui
   enchaînait quand la note a changé repart à votre validation. Reparti après un
   changement de la note, il revérifie d'abord que les tests collent à la note ;
2. le moteur, son bouton à côté de la ligne d'état (proposé une fois la
   note validée, à n'importe quelle étape ensuite : écrivez vos invariants
   à la main, puis *Reprendre* pour le reste) : l'agent reprend à la première
   étape pas faite et tient le rôle du développeur du guide jusqu'à la PR
   et sa CI au vert en
   **enchaînant lui-même les actions de
   l'écran** — les mêmes que vous lanceriez, visibles et arrêtables dans
   l'onglet *Actions* (modules confiés à un agent, ou au-delà de 4 modules de code à des agents Sonnet en parallèle, la
   preuve des invariants, puis les modules commités) —, ne choisit jamais *Garder* / *Annuler* à votre place. Une
   question qui bloque vous attend à l'étape Note, sans arrêter le moteur :
   vos réponses envoyées, il reprend seul. Il ne s'arrête que sur une ligne
   `[toi]` d'un retour ou une question de la note ; une ligne `[agent]` n'est
   jamais une raison de s'arrêter. Il ne fusionne pas la PR et ne
   publie pas de version officielle. Il ne valide jamais la note à votre place ni
   n'en change la conception, et n'accepte jamais en silence un invariant non
   prouvé : il vous remonte, en express aussi.

*Arrêter* (le même bouton, qui devient *Reprendre*) : l'action en cours finit, la
suivante ne part pas. Le moteur ne survit pas à un redémarrage de l'appli :
*Reprendre* pour continuer.

Les relectures pensées pour un humain qui lit le code restent à la demande :
*Relire le diff* d'un module n'est jamais proposée comme prochaine action ;
*Lire en pseudo-code*, elle, est lancée par le moteur après chaque écriture des
tests d'invariants, et la pause après les invariants l'attend ; *Relire la note* et
*Relire les commits* ne sont proposées qu'au relecteur d'une PR. La revue ponytail
reste sur le chemin.

**Qui travaille, ce que ça coûte.** Chaque action sait qui travaille :
*haiku*, *sonnet · moyen*, *opus · élevé*… ou *agent* (le modèle de l'agent) ;
le bouton ne l'affiche pas, son infobulle le dit (« — sonnet »), ainsi que celle de
« via » ; seul « direct » reste sur le bouton.
Ce qui se suffit à soi-même tourne à part, sans relire la conversation : son
prix ne dépend pas de la longueur de celle-ci (≈ 0,02 $ sur Haiku : lister ou
charger une PR, lancer les vérifications, commiter, publier une revue,
nommer la branche d'une nouvelle demande, proposer les commandes).
Sonnet écrit le code : il génère chacun des modules de *Générer les modules*
(*Générer* sur un module est mené par Opus, qui relit et corrige, avec un
agent Sonnet pour l'écrire), applique la revue, publie les releases ; il
prépare aussi un commit, commite les modules, ouvre la PR, replie les
fixups, diagnostique la CI, écrit le plan de test, lit les invariants en
pseudo-code (une lecture n'est refaite que si le test change). Opus, effort
élevé, juge : il vérifie la conception de la note, écrit les invariants, relit un diff, une note ou des
commits, vérifie l'alignement, fait la ponytail review, et orchestre
*Générer les modules* (il relit chaque diff, renvoie une
correction au même agent Sonnet, et ne relance un module sur Opus qu'au
second échec). Sur le modèle de l'agent, chacune dans sa conversation : la
note, la forme et les réponses aux questions (qui reprennent la
conversation de la note, et son cache) ; dans la conversation de l'agent :
*Reprendre* (le moteur), *Où j'en suis ?* — le moteur, *Générer les
modules* et les releases sont longs et coûteux. Pour une action qui
tourne à part, vous pouvez choisir un modèle plus léger (ou plus fort) que
le conseillé : *⚙ Réglages* → *Actions*, une rubrique par action. VibeCoder génère pour cela une variante
de chaque skill qui fixe son modèle (`<nom>--haiku`, `--sonnet`, `--opus`). La
rubrique propose aussi l'**effort**, à côté du modèle : sans choix, celui du skill
(ou de la variante du modèle choisi) ; le choix est enregistré dans `config.json` :
il vaut pour tous les agents et tient après un redémarrage (variantes
`<nom>--<modèle>--<effort>`, cachées des commandes « / »). L'infobulle du bouton
de l'action dit qui travaille d'après ce choix.
Le moteur tourne dans la conversation de l'agent : pour le passer sur Sonnet,
passez l'agent sur Sonnet (menu du robot ou barre d'état) avant de lancer
le moteur. VibeCoder ne passe jamais un
agent sur Fable de lui-même : vous seul le faites (menu du robot ou barre
d'état — plus cher) ; le choix d'une action ne propose jamais Fable, même
écrit à la main dans `config.json`.

**Mesurer le coût d'un ticket.** Claude Code journalise chaque session dans
`~/.claude/projects/<dossier>/<session>.jsonl` (`<dossier>` : le chemin du
projet, chaque `/` et `.` changé en `-` ; un même projet peut en avoir deux,
`-home-…` et `-var-home-…`), et chaque sous-agent ou skill en sous-contexte
(`context: fork`) dans `<session>/subagents/*.jsonl`. Dans la box `dev`, ce
`node -e` fait la somme des jetons (`message.usage` : entrée, cache écrit,
cache lu, sortie) par modèle, sur les sessions du dossier passées par la
branche du ticket (sans branche : toutes), d'un côté les sessions, de
l'autre leurs `subagents/` :

```bash
node -e '
const fs=require("fs"),p=require("path"),[dir,branch]=process.argv.slice(1),t={},vus=new Set();
const lire=(f,part)=>{for(const l of fs.readFileSync(f,"utf8").split("\n")){let m;try{m=JSON.parse(l).message}catch{continue}
  if(!m?.usage||vus.has(m.id))continue;vus.add(m.id);const u=m.usage,s=t[part+" "+m.model]??={entrée:0,"cache écrit":0,"cache lu":0,sortie:0};
  s.entrée+=u.input_tokens;s["cache écrit"]+=u.cache_creation_input_tokens??0;s["cache lu"]+=u.cache_read_input_tokens??0;s.sortie+=u.output_tokens}};
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith(".jsonl"))){const g=p.join(dir,f),sub=p.join(dir,f.slice(0,-6),"subagents");
  if(branch&&!fs.readFileSync(g,"utf8").includes(`"gitBranch":"${branch}"`))continue;lire(g,"session");
  if(fs.existsSync(sub))for(const h of fs.readdirSync(sub).filter(h=>h.endsWith(".jsonl")))lire(p.join(sub,h),"subagents")}
console.table(t)' ~/.claude/projects/<dossier> <branche>
```

Un message est compté une fois (le journal le répète, une ligne par bloc).
Multipliez chaque colonne par le tarif du modèle pour un prix. Une course
dont le skill tourne en sous-contexte n'a de jetons que dans ses
`subagents/` : son processus n'appelle pas le modèle lui-même.

**Les skills.** Les boutons s'appuient sur un plugin, `vibecoder`, que l'appli
donne à Claude Code : ses skills (`/vibecoder:note`, `/vibecoder:relire`…)
servent à tous les agents sans rien écrire dans vos projets, et ne coûtent
rien tant qu'on ne les appelle pas. Ils suivent les skills de votre projet ou
les vôtres quand ils existent (`gear-prompt-specs-to-feature-note`,
`gear-commit-message`, `gear-fix-up`, `ponytail`, `ponytail-review` ; avec
`gear-guide`, un bouton *Où j'en suis ?*), sinon le guide du dépôt. Ce qu'ils
produisent pour l'écran va dans `vibecoder-out/`, à côté de `config.json` :
un dossier par agent ; quand l'agent change de branche, ce qui a été produit
pour l'ancienne est mis de côté (`branches/`) et revient avec elle.

**Personnaliser.** *⚙ Réglages* → *Agents* → *Dossier
de VibeCoder* (`vibecoder/`, à côté de `config.json`) : `actions.fr.json` et
`actions.en.json` (les boutons : libellé, aide, message envoyé ; à modifier,
retirer, ajouter — mais pas l'`id` d'un bouton livré, sur lequel l'écran
s'appuie), `plugin/skills/<nom>/SKILL.md` (un skill : ses
instructions, son modèle, son effort) et un `README.md` qui détaille tout. Un
fichier que vous avez modifié n'est jamais remplacé, même par une nouvelle
version de l'appli ; un fichier jamais modifié suit les mises à jour. **Pour
revenir à l'origine, supprimez le fichier** : il revient au prochain
lancement (ou en rouvrant le dossier par le menu). Un fichier d'actions
illisible : les boutons d'origine ; vide (`[]`) : aucun bouton.

**FR / EN** (*⚙ Réglages* → *Interface*) : deux réglages. La **langue de
l'interface** (`vibeLang`) : l'écran, les boutons, les messages envoyés. La
**langue de ce qu'écrivent les agents** (`agentLang`, par défaut celle de
l'interface) : l'agent écrit dans cette langue la
note, ses questions, le plan de test, la relecture de la note, la ponytail
review. Ce qui touche au
code reste en anglais : le pseudo-code des invariants, les relectures de diff
et de commits, la CI, les vérifications (les messages de
commit et de PR suivent la convention du projet). Pour tous les agents. La conversation elle-même (fil,
champ) reste en français.

**Limites.** La note n'est trouvée que si le nom de la branche porte le
ticket ou la version, et que la branche la change (ou la crée), ou que git
l'ignore (note hors du projet, plus haut). Les actions
lancées, et une nouvelle demande dans un worktree pas encore créé, ne
survivent pas à un redémarrage de l'appli ; *Annuler* une action
suppose que Claude Code reçoive le suivi des fichiers à travers sa commande
de lancement (une box : la variable d'environnement doit passer). Non essayé
sous Windows.

### Son des autres applications

Sur haut-parleurs, une vidéo ou un appel seraient captés par le micro et
transcrits avec la dictée. *⚙ Réglages* → *Dictée* → *Couper le son des autres applications
pendant la dictée* (désactivé par défaut) : leur son est coupé le temps de
l'enregistrement, puis rétabli. Les bips de l'appli restent audibles ; une
application déjà muette le reste. Même mécanisme que pour le micro Discord
ci-dessous (PipeWire sous Linux, Core Audio sous Windows).

Un son ou le micro Discord resté coupé (par exemple après un arrêt brutal de
l'appli) : *⚙ Réglages* → *Dictée* → *Rétablir le son et le micro Discord (dépannage)*.
Sous Linux, une application dont le son s'est arrêté pendant la dictée
retrouve d'elle-même le son quand elle rejoue (WirePlumber retient la
coupure de chaque application ; l'appli la lève).

### Micro Discord

*⚙ Réglages* → *Dictée* → *Autoriser la coupure du micro Discord* (désactivé par défaut) :
en appel Discord, le micro est coupé le temps de l'enregistrement, puis
rétabli. Un micro déjà coupé le reste.

C'est le flux de capture de Discord qui est coupé, pas le bouton « muet » de
Discord : son icône ne change pas. À la place, *Micro Discord coupé* s'affiche
en tête de la fenêtre le temps de l'enregistrement, une fois la coupure
confirmée.

- **Linux** : dans PipeWire, par `wpctl` (livré avec WirePlumber, installé
  d'office avec PipeWire).
- **Windows** : la session de capture de Discord, par l'API audio de Windows
  (Core Audio). Rien à installer.

## Configuration

`config.json`, à côté du dossier whisper (*⚙ Réglages* → *Général* → *Modifier la configuration*) ; la plupart de ces réglages se changent dans la page (*⚙ Réglages*), sans l'ouvrir :

| Clé          | Rôle                                                              |
|--------------|-------------------------------------------------------------------|
| `lang`       | `fr`, `en`, `auto`…                                               |
| `vocabulary` | Mots propres à votre domaine, pour guider whisper (300 car. max) |
| `sound`      | Bips de début / fin                                               |
| `agentCommand` | Commande qui lance Claude Code (vide : `claude`)               |
| `editorCommand` | Éditeur de code des agents (vide : `zed`, `code`, `cursor` ou `codium`, le premier trouvé) |
| `terminalCommand` | Terminal de *Ouvrir un terminal ici*, `{dir}` pour le dossier (vide : le premier trouvé, ex. `konsole`) |
| `agents`     | Les agents : dossier, nom, modèle, effort, mode, session, parent d'un robot enfant (`parent`), réglages VibeCoder (`vibe`) (gérés par l'appli ; `name` se modifie ici) |
| `agentFolders` | Dossiers favoris proposés par « + », chacun avec sa couleur    |
| `agentSelected` | L'agent affiché, retrouvé au lancement (géré par l'appli)     |
| `vibeLang`   | VibeCoder : langue de l'interface, `fr` ou `en`                  |
| `agentLang`  | Langue de ce qu'écrivent les agents, `fr` ou `en` (absente : celle de l'interface) |
| `actionModels`, `actionEfforts` | Le modèle et l'effort choisis par action, `{ "<id de l'action>": "sonnet" }` (jamais Fable) |
| `vibeSize`   | Taille de la fenêtre (retenue au redimensionnement)             |
| `vibeCommandPrefix` | VibeCoder : ce qui précède les commandes du projet et `gh` (vide : `distrobox enter <box> --` tiré de `agentCommand`, sinon rien) ; ex. `toolbox run -c dev` |
| `outsideAgents` | VibeCoder : autoriser un Claude Code lancé dans un terminal à piloter le robot de son dossier par la commande `vibecoder` (`false` par défaut) |
| `artifactTextMax` | VibeCoder : taille (octets) au-delà de laquelle un artefact affiché en texte est coupé (10 Mo par défaut) |
| `runTmpMax` | VibeCoder : taille (octets) du dossier temporaire d'une action au-delà de laquelle elle est arrêtée (1 Go par défaut ; pas dans la fenêtre des réglages) |
| `muteOthers` | Couper le son des autres applications pendant l'enregistrement   |
| `discordMute`| Couper le micro Discord pendant l'enregistrement                 |
| `speakVolume`| Volume de lecture, de `0` à `1`                                   |
| `speakLang`  | `auto` (français ou anglais, détecté), `fr` ou `en`               |
| `speakVoices`| Voix par langue : `{ "fr": "estelle", "en": "jane" }`             |

Relu à chaque usage : pas besoin de relancer.

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
