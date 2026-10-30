# VibeCoder — les réglages

Ce dossier, `userData/vibecoder/` (`~/.config/whisper-dictation/vibecoder/`
sous Linux, `%APPDATA%\whisper-dictation\vibecoder\` sous Windows ; menu de
l'icône : *Agents Claude Code → Dossier de VibeCoder*), contient tout ce que
VibeCoder fait dire aux agents : ses boutons et ses skills. L'appli l'écrit au
premier usage, d'après sa copie d'origine.

**Un fichier modifié n'est jamais remplacé ; supprimez-le pour retrouver la
version d'origine.** Un fichier jamais modifié suit les mises à jour de
l'appli.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `actions.fr.json`, `actions.en.json` | les boutons, dans l'ordre d'affichage, pour chaque langue de l'écran (*FR* / *EN*) |
| `plugin/.claude-plugin/plugin.json` | le plugin `vibecoder` que l'appli donne à Claude Code |
| `plugin/skills/<nom>/SKILL.md` | un skill : son modèle, son effort, ses instructions |
| `plugin/skills/<nom>--<modèle>/SKILL.md` | une variante générée d'un skill, sur un autre modèle (voir plus bas) : réécrite à chaque démarrage |
| `projets/<dossier>.json` | l'ancien fichier du projet d'un dossier, d'avant la 0.12.0 : recopié dans `.vibecoder/project.json` du dossier (voir plus bas), gardé, sans effet ensuite |
| `README.md` | ce fichier |

## Les boutons : `actions.<langue>.json`

Un tableau, dans l'ordre d'affichage. Chaque bouton :

| Champ | Contenu |
|---|---|
| `id` | identifiant unique, le même dans les deux langues ; ceux livrés sont **fixes** (voir plus bas) |
| `flow` | `create` (*Créer*), `review` (*Relire*) ou `both` |
| `step` | l'étape où il apparaît : `note`, `forme`, `invariants`, `modules`, `revue`, `pr`, `commits`, `ecran` ; `null` : partout |
| `kind` | `send` : envoyé aussitôt à l'agent ; `prefill` : préparé dans le champ, à compléter puis envoyer |
| `needs` | `text` : il exige le texte de son champ — celui de son étape, ou celui de la conversation sans étape (vide : le bouton le demande) ; sinon `none` |
| `reads` | `true` : l'action ne fait que lire (relectures, vérifications…) ; absent : elle modifie la branche (le cas sûr pour un bouton ajouté) |
| `label` | le libellé : court, un verbe |
| `hint` | l'aide : une phrase, ce que ça fait et ce que ça coûte si c'est notable |
| `text` | le message, avec ses variables (`\n` pour aller à la ligne) |

Un bouton envoie un message écrit comme s'il avait été tapé : un skill
`/vibecoder:<nom>` et ses arguments, ou du texte. Celui d'une étape (`step`
renseigné) part dans **sa propre conversation**, à côté de celle de l'agent :
on la suit dans l'onglet *Actions*, on peut l'arrêter, puis garder ce qu'elle a
écrit ou l'annuler. Les autres (`vibe`, `guide`, `ask`, `propose-run`,
`new-request`) vont à la conversation, dans le fil.

Une action qui modifie la branche attend toute autre action en cours ; une
lecture (`reads`) n'attend qu'une modification, et les lectures tournent
ensemble. Le bouton qui doit attendre est grisé, avec la raison ; celui qui
n'a pas encore de sens (pas de note, pas de commit préparé, pas de PR…)
n'est pas affiché.

La conversation (l'orchestrateur, skill `actions`) suit et commande les
actions par des fichiers de `{{out}}` :

| Fichier | Rôle |
|---|---|
| `actions.json` | l'état, réécrit par l'appli : `{ actions: [{id, label, reads}], runs: [{id, label, state, reads, since, end, reply}], waiting: [{id, reason}] }` ; `state` : `running`, `asking`, `stopped` (arrêtée, à garder ou annuler), `done` (son tour fini et plus de tâche de fond, sans limite de temps), `failed`, `kept`, `undone` |
| `actions/<id>.start` | demande de lancement : un objet JSON de ses arguments (`text`, `module`, `commit`, `file`, `pr`, `check`, `model`, `answers`), `{}` sans argument |
| `actions/<id>.stop` | vide : demande d'arrêt |

L'appli supprime une demande une fois appliquée ; un lancement qui doit
attendre reste en place, en attente (`waiting`), et part de lui-même dès que la
voie est libre. À la fin de chaque action, la conversation reçoit une ligne
« VibeCoder : « <libellé> » … État : `{{out}}`/actions.json » (pas pour une
action arrêtée). Une demande que l'appli ne lance ni ne met en attente
(illisible, inconnue, pas proposée, déjà en cours, argument invalide, ou
*Vibe* arrêté par l'utilisateur : tout lancement, jusqu'au repos) est
supprimée, et la conversation reçoit « VibeCoder : demande <id> refusée —
<raison> » ; un argument que l'action ne lit pas (ou un modèle qu'elle ne
propose pas) ne la fait pas refuser : elle part, avec l'avis « … partie,
arguments ignorés : <noms> ».

**Ce qui se personnalise : `label`, `hint` et `text`** (le libellé, l'aide, le
message). Les `id` livrés sont un contrat : l'écran et le parcours s'appuient
sur eux (l'action mise en avant de l'étape en cours, les boutons propres à une vue : *✓ Commiter*,
*Relire le diff* d'un module, *Publier la revue*…) ; un `id` changé est un
bouton retiré suivi d'un bouton ajouté. `ponytail` n'a pas de bouton : `checks`
(skill `verifier`) la demande ; `align` n'en a qu'en *Relire* : en *Créer*,
`invariants` vérifie l'alignement. Les skills de VibeCoder reçoivent toujours d'abord
`{{lang}} {{out}}`. Le bouton `guide` n'apparaît que si le skill `gear-guide`
existe (dans le projet ou chez l'utilisateur).

Dix-neuf boutons ont aussi une voie **directe**, sans agent : `commit`,
`publish`, `load-pr`, `base`, `pr-here`, `pr-worktree`, `remove-worktree`,
`stash`, `unload-pr`, `new-here`, `new-worktree`, `switch-branch`, `pull`,
`rebase`, `push`, `fetch`, `request-review`, `copy-artifact` et `add-artifact`. Le bouton « direct »
lance lui-même des commandes fixes (`git commit -F`, `gh pr review`, `gh pr
view` puis `git fetch origin <tête>` (la PR se relit dans le dossier de
l'agent), `git switch` / `pull --ff-only` / `branch -d` si la PR est
fusionnée et le dossier sans modifications ; *Changer de branche* : `git
fetch` et `git switch` de la branche de la PR ; *Aller sur la branche* :
`git switch` d'une branche locale ; *Créer ici* : `git switch -c` de la
branche d'une nouvelle demande, ou du nom saisi depuis le départ choisi ;
*Revenir sur la branche principale* : `git switch` de la branche
principale ; ces quatre-là, le dossier sans modifications ; *Mettre de
côté* : `git stash push -u`, rien d'autre ; *Pull* : `git pull --ff-only
--autostash` ; *Rebase* : `git rebase --autostash <sur>`, et `git rebase
--abort` aussitôt s'il échoue ; *Pousser* : `git push --force-with-lease`,
jamais `--force` ; *Actualiser* : `git fetch origin`, seulement à son
clic ; *Copier dans le projet* (panneau *Artefacts*) : copie l'artefact
affiché dans le dossier choisi dans une boîte de dialogue, un fichier du
même nom remplacé seulement si vous l'acceptez), écrites dans l'appli et inscrites
dans `direct.log` des sorties, ou la recette du fichier du projet (*Dans un
nouveau worktree*, *Retirer le worktree* ; voir plus bas, `recipe.log` ; la
PR d'un worktree retiré perd aussi sa branche `pr-<n>`, `git branch -D`) ;
leur `text` reste le message du petit *via* à côté (le skill ou le message,
dans la conversation). Personnaliser leur `text` ne change donc que le
*via*. `remove-worktree`, `stash`, `unload-pr`, `new-here`,
`new-worktree`, `switch-branch`, `pull`, `rebase`, `push`, `fetch`, `request-review`,
`copy-artifact` et `add-artifact` n'ont pas de *via* : seule l'appli les fait. Les actions de branche sont
dans la vue des branches, qu'ouvre la branche de l'en-tête (*Pull*,
*Rebase*, *Pousser* : à côté d'elle).

### Les variables

Liste fermée : une variable inconnue fait refuser l'action. Seuls `{{text}}`,
`{{answers}}` et `{{draft}}`, écrits par vous, sont libres : toute autre valeur
qui contiendrait un saut de ligne (un chemin de fichier piégé…) refuse aussi
l'action.

| Variable | Valeur |
|---|---|
| `{{text}}` | le texte du champ de l'étape (sans étape : celui de la conversation) ; requis quand `needs` vaut `text`, sinon il peut être vide ; 20 000 caractères au plus |
| `{{out}}` | le dossier de sorties de l'agent : `userData/vibecoder-out/<agent>` |
| `{{lang}}` | `fr` ou `en` |
| `{{branch}}`, `{{base}}` | la branche et sa base (il faut un dépôt git) |
| `{{note}}` | le chemin de la note du ticket (il en faut une) |
| `{{ref}}` | `WORKTREE` (*Créer*) ou `HEAD` (*Relire* : la PR est la branche du dossier) |
| `{{files}}` | les tests d'invariants pas encore lus : `chemin@blob`, séparés par des espaces (il en faut un) |
| `{{module}}` | le module choisi, sinon le premier qu'aucun commit ne touche : `chemin — contrat` |
| `{{commit}}` | le commit choisi parmi ceux de la branche ; sans choix : `WORKTREE` (les changements en cours) |
| `{{pr}}` | le numéro de la PR choisie, sinon celui de la PR de la branche |
| `{{answers}}` | les réponses aux questions ouvertes, une par ligne : « 1. … » |
| `{{verdict}}` | `approve`, `comment` ou `request-changes` |
| `{{draft}}` | le brouillon de revue : une ligne « - [cible] texte » par remarque (il en faut une) |
| `{{check}}` | le rang d'une vérification de `checks.json` (*Relancer* sur l'une d'elles) ; sans choix : `*` (toutes) |
| `{{quote}}` | (`prefill` seulement) ce qu'on cite |
| `{{prefix}}` | le préfixe des commandes du projet vu de l'agent (sans la box où il tourne déjà) ; peut être vide |

### Ajouter un bouton

1. Ajoutez une entrée, à la place voulue, dans `actions.fr.json` **et** dans
   `actions.en.json`, avec le même `id`.
2. S'il appelle un nouveau skill : créez `plugin/skills/<nom>/SKILL.md` (en-tête
   ci-dessous), et appelez-le par `/vibecoder:<nom> {{lang}} {{out}} …`.

```json
{
  "id": "lint",
  "flow": "create",
  "step": "revue",
  "kind": "send",
  "needs": "none",
  "label": "Corriger le lint",
  "hint": "L'agent lance le lint du projet et en corrige les erreurs, en fixups.",
  "text": "Lance le lint du projet et corrige ses erreurs, chacune en fixup du commit qui possède le code."
}
```

Pour retirer un bouton : supprimez son entrée ; il disparaît de l'écran (et
n'est plus mis en avant). Un fichier vide (`[]`) : aucun
bouton ; un fichier illisible : les boutons d'origine.

## Les skills : `plugin/skills/<nom>/SKILL.md`

Ils arrivent dans Claude Code comme le plugin `vibecoder` : chacun s'appelle
`/vibecoder:<nom>`. Avec `disable-model-invocation: true`, seul un bouton (ou
vous, en tapant la commande) les lance : ils ne coûtent rien tant qu'on ne les
appelle pas. Ils suivent les skills du projet et de l'utilisateur quand ils
existent (`gear-prompt-specs-to-feature-note`, `gear-commit-message`,
`gear-fix-up`, `ponytail`, `ponytail-review`), sinon le guide du dépôt
(`docs/dev_guide/`), sinon leurs propres règles.

L'en-tête d'un skill :

```yaml
---
name: relire
description: "Une phrase : ce que fait le skill."
argument-hint: "<lang> <out> <commit | WORKTREE>"
disable-model-invocation: true
context: fork
model: opus
effort: high
allowed-tools: "Read, Glob, Grep, Write, Bash(git show *)"
---
```

| Ligne | Effet |
|---|---|
| `context: fork` | le skill tourne dans un sous-contexte, sans relire la conversation : son coût ne dépend pas de la longueur de celle-ci ; sans cette ligne, il tourne dans la conversation |
| `model` | `haiku`, `sonnet` ou `opus` ; sans cette ligne, le modèle de l'agent |
| `effort` | `low`, `medium`, `high`, `xhigh` ou `max` ; sans cette ligne, celui de l'agent |
| `allowed-tools` | les outils et les commandes que le skill utilise sans vous demander l'autorisation |

### Changer le modèle ou l'effort d'un skill

Modifiez les lignes `model:` et `effort:` de son en-tête. Le bouton affiche qui
travaille d'après elles (« haiku », « opus · élevé »… ou « agent » sans
`model`). Un bouton d'étape part dans sa propre course, qui prend ce modèle et
cet effort, que le skill ait `context: fork` ou non. Un skill envoyé à la
conversation de l'agent (`vibe`, `actions`, `processus`…) garde le modèle de
l'agent : changer de modèle en cours de conversation en perd le cache. `note`
et `forme` restent sans `model` : *Envoyer les réponses* reprend la
conversation de la note.

### Un modèle plus léger (ou plus fort) pour une étape

Un bouton dont le skill fixe son modèle (`haiku`, `sonnet` ou `opus`) propose
d'en choisir un autre, le conseillé (celui de l'en-tête) d'abord, s'il part
dans sa propre course (un bouton d'étape) ou si le skill tourne en
sous-contexte (`context: fork`) ; envoyé sans sous-contexte à la conversation
de l'agent, il garde le modèle de l'agent. Pour cela, VibeCoder écrit à chaque
démarrage, à côté de chaque skill `<nom>` qui fixe son modèle, avec ou sans
`context: fork`, une variante par autre modèle :
`plugin/skills/<nom>--<modèle>/SKILL.md` — même en-tête (`context: fork`
seulement si le skill l'a : `modules--sonnet` lance encore ses sous-agents),
ce modèle, son effort par défaut (haiku `low`, sonnet `medium`, opus
`high`), et un corps qui suit `<nom>/SKILL.md`. Ces variantes sont
**générées** : réécrites à chaque démarrage, ne les modifiez pas (modifiez le
skill lui-même) ; les noms finissant par `--haiku`, `--sonnet` ou `--opus` leur sont réservés. Jamais Fable.

### Langue

Tout ce qui touche au code est en anglais, quel que soit *FR* / *EN* : le
pseudo-code des invariants (et ses `Edge cases:`, `Guarantees:`, `Warning:`),
les relectures de diff et de commits, la ponytail review, la CI,
l'alignement, les vérifications, les réponses techniques ; les messages de
commit et de PR suivent la convention du projet. Dans la langue choisie : la
note, les questions ouvertes, le plan de test à l'écran, la relecture de la
note, les releases.

Si vous modifiez ce qu'un skill écrit dans `{{out}}`, gardez le nom et le
format du fichier : VibeCoder ne lit ses sorties que sous ces noms.

« conversation » : sans sous-contexte, là où le bouton l'envoie — la
conversation propre à l'action pour un bouton d'étape, celle de l'agent
sinon.

| Skill | Où | Modèle · effort | Écrit dans `{{out}}` |
|---|---|---|---|
| `note` | conversation | agent | `questions.md` |
| `forme` | conversation | agent | — |
| `invariants` | sous-contexte | opus · high | `align.md` (suit `aligner`) |
| `lire-invariants` | sous-contexte | sonnet · medium | `invariants/<blob>.md` |
| `aligner` | sous-contexte | opus · high | `align.md` |
| `module` | sous-contexte | sonnet · high | — |
| `suivant` | sous-contexte | sonnet · medium | `actions/module.start` (commite comme `commiter-modules`, puis, le commit fait, demande *Générer ce module* dans une seconde course) |
| `modules` | conversation | opus · high, sous-agents `developpeur` sonnet · high (opus au second échec) | — (ne commite pas) |
| `commiter-modules` | sous-contexte | sonnet · medium | — (un module, ou tous ceux qui ont des changements : un commit chacun, un fixup pour un module déjà commité) |
| `relire` | sous-contexte | opus · high | `review.md` |
| `commit-preparer` | sous-contexte | sonnet · low | `commit.md` |
| `commit` | sous-contexte | haiku · low | (supprime `commit.md`) |
| `verifier` | sous-contexte | haiku · low | `actions/ponytail.start` (toutes les vérifications seulement), `checks.json` |
| `ponytail` | sous-contexte | opus · high | `ponytail.md` |
| `appliquer-revue` | conversation | sonnet · high | `ponytail-applied.json` |
| `fixups` | sous-contexte | sonnet · medium | — |
| `pr` | sous-contexte | sonnet · medium | `pr.json` |
| `ci` | sous-contexte | sonnet · medium | `ci.md` |
| `base` | sous-contexte | haiku · low | — |
| `rc` | conversation | sonnet · medium | — |
| `release` | conversation | sonnet · medium | — |
| `charger-pr` | sous-contexte | haiku · low | `pr-<n>.json` |
| `relire-note` | sous-contexte | opus · high | `pr-<n>-note.md` |
| `relire-commits` | sous-contexte | opus · high | `pr-<n>-commits.md` |
| `ecran` | sous-contexte | sonnet · medium | `pr-<n>-ecran.md` |
| `publier-revue` | sous-contexte | haiku · low | `pr-<n>-review.json` |
| `vibe` | conversation | agent ; *Vibe* : reprend à la première étape pas faite et enchaîne les actions | `actions/<id>.start` |
| `actions` | conversation (l'agent l'appelle de lui-même) | agent | `actions/<id>.start`, `actions/<id>.stop` |
| `nouvelle-demande` | sous-contexte | haiku · low | `new-request.json` (`{ "branch" }` : le nom proposé pour la branche d'une nouvelle demande, ou de *Rédiger la note* sur la branche principale ; l'appli le montre prérempli, l'utilisateur le valide ou le change, puis la crée ici ou dans un worktree ; la demande n'y est pas) |
| `lancement` | sous-contexte | haiku · low | `lancement.json` (les commandes ; `setup` et `worktree`, une seule fois par projet) |
| `processus` | conversation (l'agent l'appelle de lui-même) | agent | `run/<nom>.stop`, `run/<nom>.restart` |
| `artefact` | conversation (l'agent l'appelle de lui-même, sans bouton ; aussi par « / ») | agent | `artifacts/<nom>` (un fichier par artefact, montré dans le panneau *Artefacts* ; jamais le projet) |

`checks.json` : `{"items":[{"name","ok","level","detail"}],"time"}`, un
élément par commande ; `level` vaut `ok`, `warning` (des avertissements
seulement : la vérification passe, en orange à l'écran) ou `error` (`ok` :
`false` pour `error` seulement). Un fichier sans `level` se lit d'après `ok`.
`verifier` reçoit `{{lang}} {{out}} {{check}} {{prefix}}` et lance chaque commande
derrière ce préfixe (vide : telle quelle) ; `{{check}}` un rang : cette
vérification seule, les autres éléments de `checks.json` gardés tels quels,
sans ponytail review. Un `checks.json` dont le `time`
précède le départ de la course de vérifications (ou sans `time`) est ignoré ;
appli relancée, sans course connue, il compte.

`ponytail-applied.json` : `{"applied":["<fichier>:L<ligne>",…]}`, écrit par
*Appliquer la revue* (`apply`, skill `appliquer-revue`) : les remarques de `ponytail.md`
appliquées, marquées ✓ à l'écran ; plus vieux que `ponytail.md`, ignoré.

## Le fichier du projet : `.vibecoder/project.json`

L'onglet *Processus* lance, arrête et relance les commandes qui font tourner
le projet d'un agent (serveur, front, services), et l'appli y prend la
**recette** du projet : le préparer, créer et retirer un worktree. Tout est
dans `.vibecoder/project.json` à la racine du dossier du parent (l'agent de
la copie principale du dépôt ; un robot enfant prend celui de son parent,
jamais celui de son worktree), propre à cette machine et jamais remplacé par
l'appli. L'appli ajoute `.vibecoder/` à `.git/info/exclude` (rien à
commiter) et, la première fois, y recopie l'ancien
`userData/vibecoder/projets/<dossier>.json` s'il existe.

```json
{
  "commands": [
    { "name": "gear", "run": "gear" },
    { "name": "front", "run": "npm run dev", "cwd": "frontend" }
  ],
  "setup": ["yarn install"],
  "worktree": {
    "create": "yarn setup-worktree \"$VIBECODER_BRANCH\" \"$VIBECODER_BASE\"",
    "remove": "yarn cleanup-worktree \"$VIBECODER_BRANCH\"",
    "dir": "../gt-plugins-worktrees/{branch}"
  }
}
```

| Champ | Contenu |
|---|---|
| `name` | court, unique : lettres, chiffres, `.`, `_`, `-` (il nomme le journal) |
| `run` | la commande, telle que tapée dans un terminal au dossier de l'agent |
| `cwd` | facultatif : le dossier où la lancer, relatif à celui de l'agent |
| `shell` | facultatif, pour tout le fichier : `["bash", "-ic"]` par défaut — vos alias et fonctions du `.bashrc` marchent |
| `prefix` | facultatif : ce qui précède chaque commande et `gh` (`""` : rien) ; sinon le réglage `vibeCommandPrefix`, sinon la box de `agentCommand` |
| `setup` | facultatif : les commandes qui préparent une copie neuve, dans l'ordre (*Préparer le projet*, et dans chaque worktree que l'appli vient de créer) ; une entrée mal formée : toute la liste ignorée |
| `worktree.create` | facultatif : la commande qui crée un worktree, lancée au dossier du parent ; sans elle, `git worktree add -b <branche> <dossier> <départ>` puis `setup` dans le worktree (avec elle, le script prépare son worktree) |
| `worktree.remove` | facultatif : la commande qui le retire ; sans elle, `git worktree remove <dossier>` (jamais `--force`) |
| `worktree.dir` | facultatif : où `create` met le worktree d'une branche (l'appli y vérifie qu'il est bien né, puis y ouvre le robot), relatif au dossier du parent, `{branch}` pour la branche ; par défaut `../<dossier>-worktrees/{branch}` |

Chaque commande passe par ce shell, derrière le préfixe. Son
journal : `userData/vibecoder-out/<agent>/run/<nom>.log` (le précédent en
`.log.old`). *Proposer les commandes* (skill `lancement`) écrit le fichier s'il
n'existe pas encore, sinon y ajoute les commandes dont le nom n'y est pas, et
`setup`, `worktree` seulement si le fichier n'a pas encore la clé (les autres
restent telles quelles ; jamais `prefix`) ;
*Modifier les commandes* l'ouvre dans l'éditeur (créé d'un exemple s'il
manque). Quitter l'appli arrête tout ce qu'elle a lancé.

**La recette** est lancée par l'appli, sans IA : une commande après l'autre,
l'entrée fermée (une question y/N lit une fin de fichier et échoue :
répondez-la d'avance dans la commande), 15 min au plus chacune, arrêt au
premier échec, dont la dernière ligne s'affiche ; une à la fois par famille ;
le journal : `userData/vibecoder-out/<agent>/recipe.log`. La branche et la
base n'y sont jamais écrites : elles arrivent par l'environnement,
`VIBECODER_BRANCH` (la branche du worktree) et `VIBECODER_BASE` (celle d'où
il part) — entre guillemets dans la commande, comme ci-dessus. Un worktree
n'est retiré que si `git status --porcelain` n'y affiche rien.
