# AGENTS.md

## Commandes (dans la box `dev`)

- Lancer : `npm start` (construit les pages puis lance Electron)
- Typage : `npm run typecheck` · Tests : `npm test` · invariants seuls :
  `npm run test:invariants`
- Contrat de la CLI : `npm run test:contract` (l'appli réelle, profil neuf, faux
  `claude` et faux `gh`, appelée par `resources/vibecoder/plugin/bin/vibecoder.mjs` ;
  une famille de cas par fichier de `tests/contract/cases/`, un résumé qui échoue
  sur une commande de la table sans cas ; lancé à la main après `npm run build`,
  comme `test:main-diff`, hors de `npm test`)
- Comparer à une version (0.14.0 ou plus) : page `npm run test:front-diff -- <tag ou branche>`,
  principal (appli réelle) `npm run test:main-diff -- <tag ou branche>`
- Paquets : `npm run dist:linux`, `npm run dist:win`

## Règles d'architecture

- Comportement attendu : `SPEC.md`. Un changement de comportement met à jour
  `SPEC.md` et le README.
- `src/renderer/` (la page) et `src/main/` (le principal), rangés comme les
  plugins Gear ; `src/preload/` (le pont) ; `src/shared/bridge` (le contrat
  du pont : types et canaux de la fenêtre, partagé par les trois).
- Pages (`src/renderer/`) :
  - `app/` : la fenêtre (`panel` : VibeCoder seul, depuis la 0.14.0), ses
    composants et ses hooks ;
  - `core/` : les modules métier (`dictation`, `speech`, `conversation`,
    `links`, `switcher`, `vibecoder`, `ui` : dont le thème) ;
  - `helpers/` : fonctions pures sans lien avec le métier ;
  - `technicals/` : ce que fournit la plateforme (`bridge` : types des ponts ;
    `audio` : micro, bips, PCM ; `dom` ; `codemirror` : réglages de
    l'éditeur, sans métier).
- Principal (`src/main/`) :
  - `app/` : ce qui connaît Electron et les fenêtres (`state`, `settings`,
    `windows`, `controllers`, `menus`, `ipc`, `lifecycle`) ;
  - `core/` : le métier, sans Electron (`config`, `dictation`, `sound`,
    `agents`, `conversation`, `switcher`, `guards`…) ; outils, SDK et disque
    injectés ;
  - `helpers/` : fonctions pures ;
  - `technicals/` : ce que fournit le système (`ipc`, `whisper-cli`,
    `pipewire`, `pocket-tts`, `claude`…).
- Un module = un dossier avec son `index.ts` (barrel) ; on importe le module,
  jamais un de ses fichiers (`import … from 'core/conversation'`). Imports
  absolus depuis la racine de son processus (`src/renderer/` ou `src/main/`),
  plus `shared/`. Fichiers en kebab-case.
- `core/` et `helpers/` ne dépendent pas de `app/` ; `technicals/` ne dépend
  que de lui-même, de `helpers/` et de `shared/`.
- Le principal n'écoute les pages que par `technicals/ipc` (`listenFrom`) :
  la table de gestionnaires de la fenêtre, typée par ses canaux.
- La page ne parle au principal que par son pont (`src/preload/panel.ts`,
  typé par `shared/bridge`). Un seul fichier connaît le pont :
  `panel-app.tsx`. Les composants reçoivent des props et des rappels.
- Rien n'est envoyé à un agent que le texte du champ ou ce que whisper vient
  de rendre, plus le gabarit d'une action (SPEC I-2, réduit) ; aucun canal ne
  lit ni ne copie un texte fourni par la page : *Écouter* désigne une réponse
  par son rang (I-3, réduit) ; le principal vérifie l'expéditeur de chaque
  message (`sentBy`, I-20).
- Logique dans des fonctions pures (`*.ts`), testées ; composants sans logique
  métier.
- La CLI `vibecoder` (`resources/vibecoder/plugin/bin/`) : du JS lancé par node
  sans construction, aucun import de `src/`, le pur dans `cli.mjs` ; un robot la
  joint par son environnement (`VIBECODER_PORT`, `VIBECODER_TOKEN`) et ne lit jamais
  `live.json` (SPEC I-54) ; aucun jeton d'agent n'est écrit ni envoyé à la page
  (I-51 à I-53).
- Pas de code propre à un bureau (KDE, KWin…) : une limite d'un gestionnaire
  de fenêtres se contourne à la main et se documente (I-28, devenu règle de
  structure) ; rien d'installé dans le système : Pocket TTS et son Python vont
  dans les données de l'appli, aucun paquet système requis (I-26, idem) ; pas
  de shell pour lancer un programme (I-27, `tests/structure/no-shell.test.ts`).
- En-tête de chaque fichier : ce qu'il fait, ce qu'il ne connaît pas, qui
  l'utilise. À tenir à jour.

## Tests

- `**/tests/invariants/` : ce qu'une refonte ne doit jamais changer (disque,
  permissions, fuites, bornes, processus, vie privée, travail en cours,
  isolement, frontière de la page, argent, irréversible) ; le reste est un
  variant (`tests/variants/`).
- `tests/structure/` : les règles de structure, des tests qui lisent le code
  source (pas de shell, un seul module écoute la page, qui lance les actions
  directes, aucun canal `file`/`tail`/`output`, aucune insertion de HTML).
  Pas protégé.
- `src/main/app/tests/harness/` : le décor commun des tests qui démarrent le
  principal réel sans fenêtre (faux d'Electron et du SDK, dépôt git d'essai,
  `config.json`, socket ; `orchestratorAsks` fait parler un robot par le socket,
  comme la CLI : plus de boîte aux lettres) ; import
  `app/tests/harness`. Pas protégé, sans aucune vérification : les témoins
  restent dans les fichiers protégés.
- Une retouche de `tests/structure/` ou du décor se signale dans la PR.

## Ne pas modifier sans demander

- `**/tests/invariants/**` : protégés. Si un invariant échoue, corriger le
  code, pas le test.
- `src/preload/` et `src/shared/bridge/channels.ts` : les ponts et leurs
  canaux, frontière de sécurité.

## PR

- Une note par ticket : `docs/tickets/<type>/<ticket>-<slug>.md`.
- Un commit par module : fonctions pures → orchestration → composants → colle.
