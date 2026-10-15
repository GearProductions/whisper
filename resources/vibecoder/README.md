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
| `README.md` | ce fichier |

## Les boutons : `actions.<langue>.json`

Un tableau, dans l'ordre d'affichage. Chaque bouton :

| Champ | Contenu |
|---|---|
| `id` | identifiant unique, le même dans les deux langues ; ceux livrés sont **fixes** (voir plus bas) |
| `flow` | `create` (*Créer*), `review` (*Relire*) ou `both` |
| `step` | l'étape où il apparaît : `note`, `forme`, `invariants`, `modules`, `revue`, `pr`, `commits`, `ecran` ; `null` : partout |
| `kind` | `send` : envoyé aussitôt à l'agent ; `prefill` : préparé dans le champ, à compléter puis envoyer |
| `needs` | `text` : il exige le texte du champ (vide : le bouton le demande) ; sinon `none` |
| `label` | le libellé : court, un verbe |
| `hint` | l'aide : une phrase, ce que ça fait et ce que ça coûte si c'est notable |
| `text` | le message, avec ses variables (`\n` pour aller à la ligne) |

Un bouton envoie à l'agent un message de la conversation, écrit comme s'il
avait été tapé : un skill `/vibecoder:<nom>` et ses arguments, ou du texte. On
le retrouve dans le fil.

**Ce qui se personnalise : `label`, `hint` et `text`** (le libellé, l'aide, le
message). Les `id` livrés sont un contrat : l'écran et le parcours s'appuient
sur eux (la prochaine étape, les boutons propres à une vue : *✓ Commiter*,
*Relire le diff* d'un module, *Publier la revue*…) ; un `id` changé est un
bouton retiré suivi d'un bouton ajouté. Les skills de VibeCoder reçoivent toujours d'abord
`{{lang}} {{out}}`. Le bouton `guide` n'apparaît que si le skill `gear-guide`
existe (dans le projet ou chez l'utilisateur).

### Les variables

Liste fermée : une variable inconnue fait refuser l'action. Seuls `{{text}}`,
`{{answers}}` et `{{draft}}`, écrits par vous, sont libres : toute autre valeur
qui contiendrait un saut de ligne (un chemin de fichier piégé…) refuse aussi
l'action.

| Variable | Valeur |
|---|---|
| `{{text}}` | le texte du champ ; requis quand `needs` vaut `text`, sinon il peut être vide ; 20 000 caractères au plus |
| `{{out}}` | le dossier de sorties de l'agent : `userData/vibecoder-out/<agent>` |
| `{{lang}}` | `fr` ou `en` |
| `{{branch}}`, `{{base}}` | la branche et sa base (il faut un dépôt git) |
| `{{note}}` | le chemin de la note du ticket (il en faut une) |
| `{{ref}}` | `WORKTREE` (*Créer*) ou `refs/vibecoder/pr/<n>` (*Relire*) |
| `{{files}}` | les tests d'invariants pas encore lus : `chemin@blob`, séparés par des espaces (il en faut un) |
| `{{module}}` | le module choisi, sinon le premier qu'aucun commit ne touche : `chemin — contrat` |
| `{{commit}}` | le commit choisi parmi ceux de la branche ; sans choix : `WORKTREE` (les changements en cours) |
| `{{pr}}` | le numéro de la PR choisie, sinon celui de la PR de la branche |
| `{{answers}}` | les réponses aux questions ouvertes, une par ligne : « 1. … » |
| `{{verdict}}` | `approve`, `comment` ou `request-changes` |
| `{{draft}}` | le brouillon de revue : une ligne « - [cible] texte » par remarque (il en faut une) |
| `{{quote}}` | (`prefill` seulement) ce qu'on cite |

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
n'est plus proposé comme prochaine étape). Un fichier vide (`[]`) : aucun
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
`model`). Un skill qui tourne dans la conversation (sans `context: fork`) reste
sans `model` : changer de modèle en cours de conversation en perd le cache.

### Un modèle plus léger (ou plus fort) pour une étape

Un bouton dont le skill tourne en sous-contexte (`context: fork`, sur `haiku`,
`sonnet` ou `opus`) propose de choisir son modèle, le conseillé (celui de
l'en-tête) d'abord. Pour cela, VibeCoder écrit à chaque démarrage, à côté de
chaque tel skill `<nom>`, une variante par autre modèle :
`plugin/skills/<nom>--<modèle>/SKILL.md` — même en-tête, ce modèle, son effort
par défaut (haiku `low`, sonnet `medium`, opus `high`), et un corps qui suit
`<nom>/SKILL.md`. Ces variantes sont **générées** : réécrites à chaque
démarrage, ne les modifiez pas (modifiez le skill lui-même) ; les noms finissant
par `--haiku`, `--sonnet` ou `--opus` leur sont réservés. Jamais Fable.

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

| Skill | Où | Modèle · effort | Écrit dans `{{out}}` |
|---|---|---|---|
| `note` | conversation | agent | `questions.md` |
| `forme` | conversation | agent | — |
| `invariants` | sous-contexte | opus · high | — |
| `lire-invariants` | sous-contexte | sonnet · medium | `invariants/<blob>.md` |
| `aligner` | sous-contexte | opus · high | `align.md` |
| `module` | sous-contexte | opus · high | — |
| `suivant` | sous-contexte | opus · high | — |
| `modules` | conversation | agent, sous-agents opus | — |
| `relire` | sous-contexte | opus · high | `review.md` |
| `commit-preparer` | sous-contexte | sonnet · low | `commit.md` |
| `commit` | sous-contexte | haiku · low | (supprime `commit.md`) |
| `verifier` | sous-contexte | haiku · low | `checks.json` |
| `ponytail` | sous-contexte | opus · high | `ponytail.md` |
| `fixups` | sous-contexte | sonnet · medium | — |
| `pr` | sous-contexte | sonnet · medium | `pr.json` |
| `ci` | sous-contexte | sonnet · medium | `ci.md` |
| `base` | sous-contexte | haiku · low | — |
| `rc` | conversation | agent | — |
| `release` | conversation | agent | — |
| `prs` | sous-contexte | haiku · low | `prs.json` |
| `charger-pr` | sous-contexte | haiku · low | `pr-<n>.json` |
| `relire-note` | sous-contexte | opus · high | `pr-<n>-note.md` |
| `relire-commits` | sous-contexte | opus · high | `pr-<n>-commits.md` |
| `ecran` | sous-contexte | sonnet · medium | `pr-<n>-ecran.md` |
| `publier-revue` | sous-contexte | haiku · low | `pr-<n>-review.json` |
| `vibe` | conversation | agent, sous-agents opus | ceux des étapes qu'il déroule |
