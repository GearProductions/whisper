# Whisper — dictée flottante

Une icône ronde, toujours au premier plan. **Maintenez le clic** dessus, parlez,
relâchez : la voix est transcrite **en local** par [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
et le texte est collé là où se trouve le curseur, dans n'importe quelle application.
C'est la dictée de l'icône compacte de Cockpit, seule.

- **Maintenir** : dicter (bip aigu = parlez, bip grave = fin).
- **Glisser** : déplacer l'icône (la position est retenue).
- **Bouton ▶ accolé** : lire à voix haute le texte sélectionné (ou le presse-papiers), en local avec [Piper](https://github.com/OHF-Voice/piper1-gpl).
- **Clic droit** : langue, micro, bip, affichage du texte, micro Discord (Linux), lecture à voix haute, dossier whisper, configuration, quitter.

À la fin d'une dictée, une bulle montre le texte transcrit à côté de l'icône :
**un clic dessus le copie** dans le presse-papiers. Elle suit l'icône quand on
la déplace, se ferme avec sa croix et disparaît seule après 10 s (le survol
suspend ce délai). Désactivable : clic droit → *Afficher le texte transcrit*.

L'icône ne prend jamais le focus : le texte arrive dans l'application active.
Le presse-papiers est restauré après le collage (sauf si le collage a échoué :
le texte y reste, pour un Ctrl+V manuel).

## Installation

```bash
npm install
npm start
```

### whisper.cpp

Placez `whisper-cli` (`whisper-cli.exe` sous Windows) et un modèle `ggml-*.bin`
dans le dossier whisper (clic droit → *Ouvrir le dossier whisper*) :

| OS      | Dossier                                    |
|---------|--------------------------------------------|
| Windows | `%APPDATA%\whisper-dictation\whisper\`     |
| Linux   | `~/.config/whisper-dictation/whisper/`     |

Le modèle se pose à la racine du dossier ; l'exécutable peut être jusqu'à deux
niveaux plus bas (`bin/Release/` d'une release Windows, `build/bin/` d'un build
Linux). Si ce dossier est incomplet, l'installation de **Cockpit**
(`…/cockpit/whisper/`) est utilisée.

Linux : compilez whisper.cpp (`cmake -B build && cmake --build build -j`) puis
copiez ou liez `build/bin/whisper-cli` et le modèle.

### Collage sous Linux

Il faut un outil pour simuler Ctrl+V :

- **X11** : `xdotool` (`sudo apt install xdotool`)
- **Wayland** : `wtype` (Sway, Hyprland…) ou `ydotool` (avec son démon `ydotoold`)

Sans outil, le texte reste dans le presse-papiers. Note : la plupart des
terminaux Linux collent avec Ctrl+Maj+V, pas Ctrl+V.

### Lecture à voix haute (Piper)

Le petit bouton ▶ à droite de l'icône lit le texte **sélectionné** dans
n'importe quelle application (Linux), ou le **presse-papiers** (Windows, ou au
choix). Il est grisé quand il n'y a rien à lire ; pendant la lecture il devient
■ : un clic arrête. Clic droit → *Lecture à voix haute* : source du texte, ou
*Désactivée* pour masquer le bouton ; *Volume…* ouvre un curseur à côté de
l'icône, appliqué aussitôt, y compris à une lecture en cours.

Il faut Piper et une voix :

```bash
uv tool install piper-tts        # ou pipx install piper-tts : l'exécutable `piper` sur le PATH
```

Puis des voix (`.onnx` **et** son `.onnx.json`) dans le dossier des voix
(clic droit → *Lecture à voix haute* → *Ouvrir le dossier des voix*), prises
sur [piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main) —
par exemple `fr_FR-upmc-medium` (deux voix : jessica, pierre) et
`fr_FR-siwis-medium` en français, `en_US-lessac-high` et `en_US-ryan-high` en
anglais. La qualité (`low`, `medium`, `high`) est dans le nom : `high` sonne
mieux mais demande ~0,4 s de plus par lecture (aucune voix française n'existe
en `high`). Sans choix de l'utilisateur, c'est la meilleure qualité qui est
prise, voix féminine d'abord :

| OS      | Dossier                                    |
|---------|--------------------------------------------|
| Windows | `%APPDATA%\whisper-dictation\piper\`       |
| Linux   | `~/.config/whisper-dictation/piper/`       |

Un exécutable `piper` posé dans ce dossier (jusqu'à deux niveaux plus bas)
passe avant celui du PATH. Tout tourne sur le processeur : moins d'une
seconde de préparation, surtout le chargement de la voix.

**Plusieurs langues.** Avec des voix françaises et anglaises, la langue est
détectée phrase par phrase et chaque passage est lu par la voix de sa
langue : un paragraphe anglais cité dans un texte français est lu en anglais.
Une phrase française parsemée de mots anglais reste, elle, en français. Clic
droit → *Lecture à voix haute* : *Langue du texte* (détection automatique ou
langue imposée) et une voix par langue, avec son sexe et sa qualité.

**Mots anglais dans une phrase française.** Une voix française n'a appris que
les sons du français : « feature » ou « pull request » sortent déformés. Le
réglage `pronunciations` les réécrit « à la française » dans les passages lus
en français (mots entiers, casse
ignorée) ; une liste de termes de développement est fournie, à compléter
(clic droit → *Lecture à voix haute* → *Prononciation des mots anglais…*) :

```json
"pronunciations": {
  "feature": "fitcheur",
  "pull request": "pouleu riquouest",
  "Kubernetes": "[[ kubɛʁnˈɛtɛs ]]"
}
```

Une valeur entre `[[ ]]` est prise comme phonèmes espeak-ng bruts. Préférez
les sons du français (pas de `ɹ`, `θ`, `ɜː`…) : la voix ne sait pas les dire.

Sous **Wayland**, il faut aussi `wl-paste` (paquet `wl-clipboard`) : le
compositeur ne donne la sélection qu'à la fenêtre qui a le focus, et l'icône
ne le prend jamais. Dans une distrobox, celui de l'hôte est utilisé.

### Micro Discord (Linux)

Clic droit → *Autoriser la coupure du micro Discord* (désactivé par défaut) :
en appel Discord, le micro est coupé le temps de l'enregistrement, puis
rétabli. Un micro déjà coupé le reste.

C'est le flux de capture de Discord qui est coupé, dans PipeWire, pas le bouton
« muet » de Discord : son icône ne change pas. À la place, une bulle
*Micro Discord coupé* s'affiche le temps de l'enregistrement, une fois la
coupure confirmée par PipeWire.

Il faut `wpctl`, livré avec WirePlumber (installé d'office avec PipeWire).

## Configuration

`config.json`, à côté du dossier whisper (clic droit → *Modifier la configuration*) :

| Clé          | Rôle                                                              |
|--------------|-------------------------------------------------------------------|
| `lang`       | `fr`, `en`, `auto`…                                               |
| `vocabulary` | Mots propres à votre domaine, pour guider whisper (300 car. max) |
| `sound`      | Bips de début / fin                                               |
| `showText`   | Bulle du texte transcrit à la fin d'une dictée                    |
| `discordMute`| Linux : couper le micro Discord pendant l'enregistrement          |
| `speak`      | Bouton de lecture : `selection` (Linux), `clipboard` ou `off`     |
| `speakVolume`| Volume de lecture, de `0` à `1`                                   |
| `speakLang`  | `auto` (français / anglais détecté par phrase), `fr`, `en`…       |
| `speakVoices`| Voix par langue : `{ "fr": "fr_FR-upmc-medium:jessica" }` (`:locuteur` pour un modèle à plusieurs voix) |
| `pronunciations` | Mots réécrits avant la lecture : `{ "feature": "fitcheur" }`  |
| `size`       | Taille de l'icône en px (32–200, appliquée au redémarrage)        |

Relu à chaque dictée : pas besoin de relancer (sauf pour `size`).

## Paquet

```bash
npm run build:win
```

```bash
npm run build:linux
```
